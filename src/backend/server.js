'use strict';

var Percolator = require('percolator').Percolator; //easy to generate API
const https = require('https');
var request = require('request');
var dbSession = require('../../src/backend/dbSession.js');
var cheerio = require('cheerio');
var express = require('express');
var Moment = require('moment');
var schedule = require('node-schedule');


var Server = function(port){  //defining server for export
	var server = Percolator({'port':port, 'autoLink':false, 'staticDir':__dirname+'/../frontend'}); 


	var rule = new schedule.RecurrenceRule();
	rule.minute = new schedule.Range(0,59,3); //how frequently should we start a new run job on parsehub. Every 3 minute

	var j = schedule.scheduleJob(rule, function(){
		console.log("ParseHub job started - it takes some time to get result"); //

		runParseEvent(function(parseHubJobValues){
			console.log(parseHubJobValues.run_token + ":date" + parseHubJobValues.start_time) ;

			setTimeout(function () { 
				console.log('Parse hub - read results'); 

				getDataFromFeriWebPage(parseHubJobValues.run_token);

			}, 1000*60*1.5);  

		});


	});



	function runParseEvent(callback){

	//we need api key and project
	var opts = {
		uri: 'https://www.parsehub.com/api/v2/projects/tcaUCut8Rx2L/run?api_key=twAgSfGzzLtgax_mVwPvSfX8',
		gzip: true,
		json:true
	}

	request.post(opts, function (err, res, body) {
	 		// now body and res.body both will contain decoded content.	 		
	 		var parseHubJobValues = {'run_token': body.run_token, 'start_time': body.start_time}
	 		callback(parseHubJobValues);

	 	}).on('error',(e)=>{
	 		console.error(e);
	 	});

	 }




	 function getDataFromFeriWebPage(lastRunToken)
	 {

	 	var opts = {
	 		uri: 'https://www.parsehub.com/api/v2/runs/'+lastRunToken+'/data?api_key=twAgSfGzzLtgax_mVwPvSfX8',
	 		gzip: true,
	 		json:true
	 	}

	 	request(opts, function (err, res, body) {
 		// now body and res.body both will contain decoded content.
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