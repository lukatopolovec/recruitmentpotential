'use strict';

var Percolator = require('percolator').Percolator; //easy to generate API
const https = require('https');
var request = require('request');
var dbSession = require('../../src/backend/dbSession.js');
var cheerio = require('cheerio');
var express = require('express');
var Moment = require('moment');

var Server = function(port){  //defining server for export
	var server = Percolator({'port':port, 'autoLink':false, 'staticDir':__dirname+'/../frontend'}); 

	getDataFromFeriWebPage();

	function getDataFromFeriWebPage()
	{
		var opts = {
			uri: 'https://www.parsehub.com/api/v2/runs/t1ux73YiSpoT/data?api_key=twAgSfGzzLtgax_mVwPvSfX8',
			gzip: true,
			json:true
		}

		request(opts, function (err, res, body) {
 		// now body and res.body both will contain decoded content.
 		console.log("v requestu"); 	 	
 		writeThesesInDB(body.zadnjeDiplome,res);


 	}).on('error',(e)=>{
 		console.error(e);
 	});
 }


 function writeThesesInDB(thesesJson,res)
 {

 	thesesJson.forEach(function(item){

 		//for each item we have to parse avtor and mentor
 		getAvtorMentor(item.url, function(avtorMentorJson){

 			var avtorBetterForm = avtorMentorJson.avtor.split(",");

 			dbSession.query('INSERT into student (titletheses,urltheses,student,mentor, dateadded) VALUES (?,?,?,?,?);',
 				[item.name,item.url,avtorBetterForm[1] + avtorBetterForm[0] ,avtorMentorJson.mentor,Date.now()], function(err,results){


 					if(err){
 						console.log("error:"+err);

 					} else{
 						console.log("added");
 					}

 				});
 		});

 	}); 		
 }


 function getAvtorMentor(url, callbackJson)
 {

 	var avtor1, mentor1;


 	request(url, function(error, res, html){
 		if(!error)
 		{
 			var $ = cheerio.load(html);

		$('.izpisGradiva-col1 .IzpisZadetka').filter(function(){ //you have to be specific, there are several instances of classes

			var data = $(this);
			var avtorBlox = data.children().eq(1);  //eq is index indentifier		
			var avtorAndMentorString = avtorBlox.children().eq(1).text(); //.text has to be included to unwrap objects in console.
			var avtorMentorJson = avtorAndMentorString.split("(Avtor)");
			avtor1 = avtorMentorJson[0];
			mentor1 = avtorMentorJson[1].split("(Mentor)")[0];			
			var jsonAvtorMentor = {avtor: avtor1, mentor: mentor1};
			
			callbackJson(jsonAvtorMentor);
		});
	} 	

});
 }



 return server;
};




module.exports = {'Server':Server};