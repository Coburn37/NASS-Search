"use strict";

//Responsible for all the common functionality shared between a bunch of the js files

//Common functions outside namespace
function isDef(o)
{
	return !(typeof o === "undefined" || o === null);
}
//A jQuery addition to get the value of some form input
//Most return value,
//Checkbox should return true/false if checked or not
$.prototype.formVal = function(setTo)
{
	if(this.length > 1)
	{
		if(isDef(setTo))
		{
			$.each(this, function(idx,el){el.v(setTo);});
			return null;
		}
		else
		{
			return this.first().formVal(setTo);
		}
	}
	else if(this.is("input[type='checkbox']"))
		return this.prop("checked", setTo);
	else
		return this.val(setTo);
};

//NASSSearch related namespace stuff
//Includes the terms and joins similar to the python backend with some added functionality
(function(NASSSearch){
	function is(o, which)
	{
		switch(which)
		{
			case "func":
				return typeof o === "function";
			case "obj":
				return Object.prototype.toString.call(o) === "[object Object]";
			case "array":
				return Object.prototype.toString.call(o) === "[object Array]";
			case "string":
				return typeof o === "string";
			default:
				throw "Invalid which \"" + which + "\" specified for comparison";
		}
	}	
	
	function NASSSearchJoin(val)
	{
		var findName = null;
		$.each(NASSSearchJoin.values, function(name, v){
			if(val == v)
			{
				findName = name;
				return false;
			}
		});
		if(!isDef(findName))
			throw "NASSSearchJoin with value " + val + " does not exist";
		this.name = findName;
		this.val = val;
	}
	NASSSearchJoin.values = {
		"AND" : 0,
		"OR" : 1
	};
	$.each(NASSSearchJoin.values, function(name, val){
		NASSSearchJoin[name] = new NASSSearchJoin(val);
	});

	//Holds an entire search similar to the python version
	function NASSSearchTerm(terms)
	{
		this.inverse = false;
		this.terms = terms;
		this.errorCheck();
		
		this.flagDelete = false;
	};
	NASSSearch.NASSSearchTerm = NASSSearchTerm;
	NASSSearchTerm.prototype.errorCheck = function(){
		//Safety check for empty lists
		if(this.terms.length == 0)
			throw "No search terms were given"
		//Error check a dictionary (or in javascript, a plain object as an assoc array) (db Term)
		if(is(this.terms, "obj"))
		{
			var keys = Object.keys(this.terms);
			if(keys.length != 4 || !($.inArray("dbName", keys) > -1) || !($.inArray("colName", keys) > -1) || !($.inArray("searchValue", keys) > -1) || !($.inArray("compareFunc", keys) > -1))
				throw "Dictionary for search term did not contain the right terms";
		}
		//Error check an array (list term)
		else if(is(this.terms, "array"))
		{
			if(this.terms.length == 1)
				throw "Only one search term given. Do not create list terms containing one term.";
			if(this.terms.length % 2 != 1)
				throw "Search must contain an odd number of terms";
				
			$.each(this.terms, function(idx, term){
				//Even Term
				if(idx % 2 == 0 && !(term instanceof NASSSearchTerm))
					throw "Even term was not a search term";
				//Odd Term
				else if(idx % 2 == 1 && !(term instanceof NASSSearchJoin))
					throw "Odd term was not a join term";
				//Recursive check
				if(term instanceof NASSSearchTerm)
					term.errorCheck();
			});
		}
		else
		{
			throw "Terms was not a dict term or a list term";
		}
	};
	NASSSearchTerm.prototype.prune = function()
	{
		if(is(this.terms, "obj"))
			return; //Nothing we can do about ourselves
		else if(is(this.terms, "array"))
		{
			var self = this;
			$.each(this.terms, function(idx, term){
				if(term instanceof NASSSearchTerm && term.flagDelete)
				{
					if(idx == self.terms.length-1)
					{
						//Last term, must remove the join before, not after
						self.terms.splice(idx-1,2);
					}
					else
					{
						//Remove the term and following join
						self.terms.splice(idx, 2);
					}
					return false; //Should only delete once per prune of an item (for now)
				}
				else if(term instanceof NASSSearchTerm)
				{
					term.prune();
				}
			});
			//If there's only one element left, make this object a dict object
			if(this.terms.length == 1)
				this.terms = this.terms[0].terms;
		}
	};
	NASSSearchTerm.prototype.remove = function()
	{
		this.flagDelete = true;
	};
	NASSSearchTerm.prototype.add = function()
	{
		var blankTerm = new NASSSearchTerm(
		{"dbName":"Empty",
		"colName":"Empty",
		"searchValue":"Empty",
		"compareFunc":"Empty"});
		
		if(is(this.terms, "obj"))
			this.terms = [new NASSSearchTerm(this.terms), NASSSearchJoin.AND, blankTerm];
		else if(is(this.terms, "array"))
		{
			this.terms.push(NASSSearchJoin.AND);
			this.terms.push(blankTerm);
		}
	};
	NASSSearchTerm.prototype.toDOM = function()
	{
		var topTerm = $.parseHTML("<div class=\"term" + (this.inverse ? " not" : "") + (is(this.terms, "obj") ? " dbTerm" : " listTerm") + "\"></div>")[0];
		topTerm.NASSTerm = this; //Save ourselves on the DOM node for future reference
		
		var uprLeftTerm = $.parseHTML("<div class=\"uprLeft\"></div>")[0];
		var uprLeftText = (this.inverse ? "Not" : "");
		
		var nodes;
		if(is(this.terms, "obj"))
		{
			uprLeftText += (uprLeftText.length > 0 ? " | " : "") + this.terms["dbName"];
			nodes = [document.createTextNode(this.terms["colName"] + " == " + this.terms["searchValue"])];
		}
		else if(is(this.terms, "array"))
		{
			nodes = []
			$.each(this.terms, function(idx, term){
				if(term instanceof NASSSearchTerm)
					nodes.push(term.toDOM());
				else if(term instanceof NASSSearchJoin)
					nodes.push($.parseHTML("<div class=\"term join\">" + term.name + "</div>")[0]);
			});
		}
		$.each(nodes, function(idx, node){
			topTerm.appendChild(node);
		});
		
		if(uprLeftText.length > 0)
		{
			uprLeftTerm.appendChild(document.createTextNode(uprLeftText));
			topTerm.insertBefore(uprLeftTerm, topTerm.firstChild);
		}
		
		return topTerm;
	};
})(window.NASSSearch = window.NASSSearch || {});