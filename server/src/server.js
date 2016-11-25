var util = require('./util.js');
var bodyParser = require('body-parser');
//imports the express Node module.
var express = require('express');
//Creates and Express server.
var app = express();

//defines what happens when it receives the 'GET /' request
app.get('/', function(req,res){
  res.send('Hello World!');
});
app.use(bodyParser.text());

//Starts the server on port 3000!
app.listen(3000, function(){
  console.log('Example app listening on port 3000');
});


//Handle POST /reverse [data]
app.post('/reverse', function(req,res){
  if(typeof(req.body) === 'string'){
    var reversed = util.reverseString(req.body);
    res.send(reversed);
  }
  else{
    res.status(404).end();
  }
  //How do we get the input text?
  //How do we send the output text?
});
