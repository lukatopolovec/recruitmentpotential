'use strict';

var Server = require('./server.js').Server; //importamo server

var server = Server(8083);

server.listen(function(){
	console.log("Server started and listening on port",server.options.port);
});