// var bodyParser = require('body-parser');
//imports the express Node module.
var express = require('express');
//Creates and Express server.
var app = express();

//defines what happens when it receives the 'GET /' request

// app.use(bodyParser.text());

//You run the server from 'server', so '..client/build' is 'server/../client/build'
//',,' means "go up one directory"

app.use(express.static('../client/build'));

//Starts the server on port 3000!
app.listen(3000, function(){
  console.log('Example app listening on port 3000');
});
