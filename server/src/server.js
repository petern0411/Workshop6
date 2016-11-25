// var bodyParser = require('body-parser');
//imports the express Node module.
var express = require('express');
//Creates and Express server.
var app = express();
var rd = require('./database.js');
var StatusUpdateSchema = require('./schemas/statusupdate.json');
var validate = require('express-jsonschema').validate;
var wd = require('./database');
var ad = require('./database');
var bodyParser = require('body-parser');


//defines what happens when it receives the 'GET /' request

app.use(bodyParser.text());
app.use(bodyParser.json());
//You run the server from 'server', so '..client/build' is 'server/../client/build'
//',,' means "go up one directory"


function postStatusUpdate(user, location, contents){
  var time = new Date().getTime();
  var newStatusUpdate = {
    "lkeCounter":[],
    "type": "StatusUpdate",
    "contents":{
      "author": user,
      "postDate": time,
      "location": location,
      "contents": contents,
      "likeCounter": []
    },
    "comments": []
  };
    newStatusUpdate = ad.addDocument('feedItems', newStatusUpdate);
    var userData = rd.readDocument('users', user);
    var feedData = rd.readDocument('feeds',userData.feed);
    feedData.contents.unshift(newStatusUpdate._id);

    //update the Feed object
    wd.WRITEDocument('feeds', feedData);

    //return the newly-posted onject
    return newStatusUpdate;
  }
  app.post('.feeditem', validate({body: StatusUpdateSchema}), function(req,res){
    var body = req.body;
    var fromUser = getUserIdFromToken(req.get('Authorization'));

    //check if the requester is authorized to post this update

    if(fromUser === body.id){
      var newUpdate = postStatusUpdate(body.userId, body.location, body.contents);
      res.status(201);
      res.set('Location', '/feeditem' + newUpdate._id);
      // Send the update
      res.send(newUpdate);
    }
    else{
      res.status(401).end();
    }
  });




app.use(express.static('../client/build'));



/**
* Resolves a feed item. Internal to the server, since it's synchronous.
*/
function getFeedItemSync(feedItemId) {
  var feedItem = rd.readDocument('feedItems', feedItemId);
  // Resolve 'like' counter.
  feedItem.likeCounter = feedItem.likeCounter.map((id) =>
  rd.readDocument('users', id));
  // Assuming a StatusUpdate. If we had other types of
  // FeedItems in the DB, we would
  // need to check the type and have logic for each type.
  feedItem.contents.author = rd.readDocument('users',
  feedItem.contents.author);
  // Resolve comment author.
  feedItem.comments.forEach((comment) => {
    comment.author = rd.readDocument('users', comment.author);
  });
  return feedItem;
}


function getFeedData(user) {
  var userData = rd.readDocument('users', user);
  var feedData = rd.readDocument('feeds', userData.feed);
  // While map takes a callback, it is synchronous,
  // not asynchronous. It calls the callback immediately.
  feedData.contents = feedData.contents.map(getFeedItemSync);
  // Return FeedData with resolved references.
  return feedData;
}

/**
* Get the user ID from a token. Returns -1 (an invalid ID)
* if it fails.
*/
function getUserIdFromToken(authorizationLine) {
  try {
    // Cut off "Bearer " from the header value.
    var token = authorizationLine.slice(7);
    // Convert the base64 string to a UTF-8 string.
    var regularString = new Buffer(token, 'base64').toString('utf8');
    // Convert the UTF-8 string into a JavaScript object.
    var tokenObj = JSON.parse(regularString);
    var id = tokenObj['id'];
    // Check that id is a number.
    if (typeof id === 'number') {
      return id;
    } else {
      // Not a number. Return -1, an invalid ID.
      return -1;
    }
  } catch (e) {
    // Return an invalid ID.
    return -1;
  }
}

/**
* Get the feed data for a particular user.
*/
app.get('/user/:userid/feed', function(req, res) {
  var userid = req.params.userid;
  var fromUser = getUserIdFromToken(req.get('Authorization'));
  // userid is a string. We need it to be a number.
  // Parameters are always strings.
  var useridNumber = parseInt(userid, 10);
  if (fromUser === useridNumber) {
    // Send response.
    res.send(getFeedData(userid));
  } else {
    // 401: Unauthorized request.
    res.status(401).end();
  }
});

app.use(function(err,req,res,next){
  if(err.name ==='JsonSchemaValidation'){
    res.status(400).end();
  }else{
    next(err);
  }
});


app.listen(3000, function(){
  console.log('Example app listening on port 3000');
});
