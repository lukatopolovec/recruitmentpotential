'use strict';
var Percolator = require('percolator').Percolator; //easy to generate API
const https = require('https');
var request = require('request');
var dbSession = require('../../src/backend/dbSession.js');
var cheerio = require('cheerio');
var express = require('express');
var Moment = require('moment');
var schedule = require('node-schedule');
var fs = require('fs');
var jstoxml = require('jstoxml');
const Feed = require('feed')
var AWS = require("aws-sdk");

var Server = function(port){  //defining server for export
	var server = Percolator({'port':port, 'autoLink':false, 'staticDir':__dirname+'/../frontend'}); 
	var s3 = new AWS.S3({'region':'eu-west-1'});

	var rule = new schedule.RecurrenceRule();
	rule.seconds = [0,new schedule.Range(10,20,30,40,50)]; //how frequently should we start a new run job on parsehub. Every 3 minute
	//rule.seconds = 5; //vsako minuto

	var casZacetek = 0; 
	var vmesniCas = 0; 
	//var j = schedule.scheduleJob(rule, function(){
	var j = schedule.scheduleJob('45 * * * *', function(){

	
		console.log("ParseHub job started - it takes some time to get result: "+ Date.now());

				runParseEvent(function(parseHubJobValues){
					console.log(parseHubJobValues.run_token + ":date" + parseHubJobValues.start_time) ;

						setTimeout(function () { 
							console.log('Parse hub - read results - setTimeout'); 

							getDataFromFeriWebPage(parseHubJobValues.run_token);

						}, 3000*60);  

				 });


	});

	

	//getDataFromFeriWebPage(parseHubJobValues.run_token);
	//getDataFromFeriWebPage("t5fVF28akEGk");



function uploadXMLtoBucket(xml)
{
		var params = {
		Key: "rssthesesfeed.xml",
		Bucket:"nodelukacrawlers",
		Body: xml,
		ACL:"public-read",
	}

	s3.putObject(params, function(err,data){
		if(err){
			    console.log(err);
		}
		else {
			console.log("Uspesno shranjeno na AWS");
		}

	});			
}



	server.route('/api/getstudents',{


		GET:function(req,res){
			console.log("smo v apiju get students");
			dbSession.fetchAll('Select id, student, titletheses, mentor, dateadded FROM student', function(err, rows){
				if(err)
				{
					console.log(err);
					res.status.internalServerError(err);
				} else
				{
					res.collection(rows).send();
				}
			});			
		}

	});


	server.route('/luka',{
			GET:function(req,res){
			console.log("smo v apiju get students");
		}
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
 		//writeThesesInDB(body.zadnjeDiplome,res);
 		writeThesesInDB(body.ZadnjiZagovori.concat(body.zadnjeDiplome),res);


 	}).on('error',(e)=>{
 		console.error(e);
 	});
 }


 function writeThesesInDB(thesesJson,res)
 {
 	//console.log("writeThesesInDB");
 //	console.dir(thesesJson);
 	var inProgress = 0;
	var numberOfThesesAdded = 0;
	var jsonToRSS = [];
	console.log("dolzina jsonov:"+Object.keys(thesesJson).length);


 	thesesJson.forEach(function(item, index){ 	
 		//we check if the item is already added to db
 		dbSession.fetchAll('SELECT * FROM student WHERE titletheses = ?', item.name, function (err, results) {
 			if (results.length<=0)
 			{
 				//this item doesn't exist yet (that's good)
 				if(!item.url) //this means it doesn't have enought data. You can just import in the database. 
 				{
					dbSession.query('INSERT into student (titletheses,urltheses,student,mentor, dateadded) VALUES (?,?,?,?,?);',
		  				[item.name,"",item.selection2 ,"unknown",Date.now()], function(err,results){  		  					
  		  					if(err){
  		  						console.log("Napaka pri dodajanju manjkajocega querya:"+err);
  		  					} else{
  		  						console.log("Zagovor diplome dodan v seznam:"+item.name);  		
  		  						numberOfThesesAdded++;
  		  						jsonToRSS.push([item.name,"",item.selection2 ,item.selection1,Date.now()]);	  		  						

  		  					}
  		  					inProgress++;
  		  						//if this was the last item, export to json
		  						if(inProgress==Object.keys(thesesJson).length){
		  							//call callback end of query  		  						
		  							exportNewThesisToRSS(jsonToRSS);
		  						}
		  					});
				} else { //we have all the data

	  		  			getAvtorMentor(item.url, function(avtorMentorJson){
	  		  			var avtorBetterForm = avtorMentorJson.avtor.split(",");
	  		  			if(avtorBetterForm[0].length==0){
	  		  				console.log("we have all the data");
	  		  				avtorBetterForm = item.selection2;
	  		  			}
	  		  			dbSession.query('INSERT into student (titletheses,urltheses,student,mentor, dateadded) VALUES (?,?,?,?,?);',
	  		  				[item.name,item.url,avtorBetterForm[1] + avtorBetterForm[0] ,avtorMentorJson.mentor,Date.now()], function(err,results){  		  					
		  		  					if(err){
		  		  						console.log("error:"+err);
		  		  					} else{
		  		  						console.log("dodan item v podatkovno bazo z vsem:"+item.url);  		
		  		  						numberOfThesesAdded++;
		  		  						jsonToRSS.push([item.name,item.url,avtorBetterForm[1] + avtorBetterForm[0] ,avtorMentorJson.mentor,Date.now()]);	  		  						

		  		  					}
		  		  					inProgress++;
	  		  						if(inProgress==Object.keys(thesesJson).length){
	  		  							//call callback end of query  		  						
	  		  							exportNewThesisToRSS(jsonToRSS);
	  		  						}
	  		  					});
	  		  				});
  		  			}
  		  		}
  		  		else  
  		  		{
  		  				inProgress++;
  		  				if(inProgress==Object.keys(thesesJson).length){  		  						
  		  						exportNewThesisToRSS(jsonToRSS);
  		  				}
  		  		} 
  		  }); 	 	
 	}); 	 		
 }


 function exportNewThesisToRSS(listOfNewTheses)
 {
 	var date = new Date();

 	if(listOfNewTheses.length>0){
  		console.log("Dodali smo nove diplome - funkcija:"+listOfNewTheses.length);
 		console.dir(listOfNewTheses);

 		let feed = new Feed({
 			title: 'Nove diplome, in prihajajoči zagovori diplom',
 			link: 'https://s3-eu-west-1.amazonaws.com/nodelukacrawlers/rssthesesfeed.xml',
 			updated : date

 		});

 		listOfNewTheses.forEach(function(item)	{
 			feed.addItem({
 				title : item[0] + ", Študent:"+ item[2] + ", Mentor/Zagovor:"+item[3],
 				link : item[1],
 				content : "student:"+ item[2] + ", mentor:"+item[4]					

 			});
 		});
 		console.log("ZAKLJUCEK ");	 		
		//console.log(feed.rss2());

		uploadXMLtoBucket(feed.rss2());
		
		fs.writeFile("RSS.xml", feed.rss2(), function(err) {
			if(err) {
				return console.log(err);
			}
			console.log("The file was saved!");
		});  		
 	}

 }



 function getAvtorMentor(url, callbackJson)
 {	

 	var avtor1, mentor1;
 	if(url!=null)
 	{

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
 	else
 	{
 				var jsonAvtorMentor = {avtor: "", mentor: "unknown"};
				callbackJson(jsonAvtorMentor);
 	}
}



 return server;
};




module.exports = {'Server':Server};