// var bodyParser = require('body-parser');
//imports the express Node module.
var express = require('express');
//Creates and Express server.
var app = express();
var StatusUpdateSchema = require('./schemas/statusupdate.json');
var postCommentSchema = require('./schemas/comment.json');
var validate = require('express-jsonschema').validate;
var bodyParser = require('body-parser');
var database = require('./database');
var db = require('./database');
var writeDocument = database.writeDocument;
var addDocument = database.addDocument;
//defines what happens when it receives the 'GET /' request
// Support receiving text in HTTP request bodies
app.use(bodyParser.text());
// Support receiving JSON in HTTP request bodies
app.use(bodyParser.json());
app.use(express.static('../client/build'));
//You run the server from 'server', so '..client/build' is 'server/../client/build'
//',,' means "go up one directory"




function postStatusUpdate(user, location, contents){
  var time = new Date().getTime();
  // The new status update. The database will assign the ID for us.
  var newStatusUpdate = {
  "likeCounter": [],
  "type": "statusUpdate",
  "contents": {
  "author": user,
  "postDate": time,
  "location": location,
  "contents": contents,
  "likeCounter": []
  },
  // List of comments on the post
  "comments": []
  };
  // Add the status update to the database.
  // Returns the status update w/ an ID assigned.
  newStatusUpdate = addDocument('feedItems', newStatusUpdate);
  // Add the status update reference to the front of the current user's feed.
  var userData = db.readDocument('users', user);
  var feedData = db.readDocument('feeds', userData.feed);
  feedData.contents.unshift(newStatusUpdate._id);

  // Update the feed object.
  writeDocument('feeds', feedData);

    //return the newly-posted onject
    return newStatusUpdate;
  }
  app.post('/feeditem',
validate({ body: StatusUpdateSchema }), function(req, res) {
  var body = req.body;
  var fromUser = getUserIdFromToken(req.get('Authorization'));

    //check if the requester is authorized to post this update

    if (fromUser === body.userId) {
    var newUpdate = postStatusUpdate(body.userId, body.location,
    body.contents);
    // When POST creates a new resource, we should tell the client about it
    // in the 'Location' header and use status code 201.
    res.status(201);
    res.set('Location', '/feeditem/' + newUpdate._id);
    // Send the update!
    res.send(newUpdate);
    }
    else{
      res.status(401).end();
    }
  });

  function postComment(feedItemId, author, contents) {
    var feedItem = db.readDocument('feedItems', feedItemId);
    feedItem.comments.push({
      "author": author,
      "contents": contents,
      "postDate": new Date().getTime(),
      "likeCounter": []
    });
    writeDocument('feedItems', feedItem);
    // Return a resolved version of the feed item.
    return feedItem;
  }

//Post comment
app.post('/feeditem/:feeditemid/CommentThread',validate({body: postCommentSchema}),function(req,res){
  var fromUser = getUserIdFromToken(req.get('Authorization'));
  var body = req.body;
  if(fromUser === body.author){
    var newComment = postComment(req.params.feeditemid, body.author, body.contents);
    res.status(201);
    // writeDocument('/feedItems', newComment);
    res.send(newComment);
  }
  else{
    res.status(401).end();
  }
});

/**
* Resolves a feed item. Internal to the server, since it's synchronous.
*/
function getFeedItemSync(feedItemId) {
  var feedItem = db.readDocument('feedItems', feedItemId);
  // Resolve 'like' counter.
  feedItem.likeCounter = feedItem.likeCounter.map((id) =>
  db.readDocument('users', id));
  // Assuming a StatusUpdate. If we had other types of
  // FeedItems in the DB, we would
  // need to check the type and have logic for each type.
  feedItem.contents.author = db.readDocument('users',
  feedItem.contents.author);
  // Resolve comment author.
  feedItem.comments.forEach((comment) => {
    comment.author = db.readDocument('users', comment.author);
  });
  return feedItem;
}


function getFeedData(user) {
  var userData = db.readDocument('users', user);
  var feedData = db.readDocument('feeds', userData.feed);
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

// Reset database.
app.post('/resetdb', function(req, res) {
  console.log("Resetting database...");
  // This is a debug route, so don't do any validation.
  db.resetDatabase();
  // res.send() sends an empty response with status code 200
  res.send();
});

// Like a feed item.
app.put('/feeditem/:feeditemid/likelist/:userid', function(req, res) {
  var fromUser = getUserIdFromToken(req.get('Authorization'));
  // Convert params from string to number.
  var feedItemId = parseInt(req.params.feeditemid, 10);
  var userId = parseInt(req.params.userid, 10);
  if (fromUser === userId) {
    var feedItem = db.readDocument('feedItems', feedItemId);
    // Add to likeCounter if not already present.
    if (feedItem.likeCounter.indexOf(userId) === -1) {
      feedItem.likeCounter.push(userId);
      writeDocument('feedItems', feedItem);
    }
    // Return a resolved version of the likeCounter
    res.send(feedItem.likeCounter.map((userId) =>
    db.readDocument('users', userId)));
  } else {
    // 401: Unauthorized.
    res.status(401).end();
  }
});

app.put('/feeditem/:feeditemid/content', function(req,res){
  var fromUser = getUserIdFromToken(req.get('Authorization'));
  var feedItemId = req.params.feeditemId
  var feedItem = db.readDocument('feedItems', feedItemId);
  //Check  if the requester is the author of the feed item
  if(fromUser === feedItem.contents.author){
    if(typeof(req.body)!== 'string'){
      res.status(400).end();
      return;
    }
    //Update text content of Update
    feedItem.contents.contents  = req.body;
    writeDocument('feedItems', feedItem);
    res.send(getFeedItemSync(feedItemId));
  }
  else{
    res.status(401).end();
  }
});



app.delete('/feeditem/:feeditemid', function(req,res){
  var fromUser = getUserIdFromToken(req.get('Authorization'));
  var feedItemId = parseInt(req.params.feeditemid,10);
  var feedItem = db.readDocument('feedItems', feedItemId);
  if(feedItem.contents.author === fromUser){
    db.deleteDocument('feedItems', feedItemId);
    var feeds = db.getCollection('feeds');
    var feedIds = Object.keys(feeds);
    feedIds.forEach((feedId) =>{
      var feed = feeds[feedId];
      var itemIdx = feed.contents.indexOf(feedItemId);
      if(itemIdx !== -1) {
        feed.contents.splice(itemIdx, 1);
        writeDocument('feeds', feed);
      }
    });
    res.send();
  }else{
    res.status(401).end();
  }
})

app.delete('/feeditem/:feeditemid/likelist/:userid', function(req, res) {
  var fromUser = getUserIdFromToken(req.get('Authorization'));
  // Convert params from string to number.
  var feedItemId = parseInt(req.params.feeditemid, 10);
  var userId = parseInt(req.params.userid, 10);
  if (fromUser === userId) {
    var feedItem = db.readDocument('feedItems', feedItemId);
    var likeIndex = feedItem.likeCounter.indexOf(userId);
    // Remove from likeCounter if present
    if (likeIndex !== -1) {
      feedItem.likeCounter.splice(likeIndex, 1);
      writeDocument('feedItems', feedItem);
    }
    // Return a resolved version of the likeCounter
    // Note that this request succeeds even if the
    // user already unliked the request!
    res.send(feedItem.likeCounter.map((userId) =>
    db.readDocument('users', userId)));
  } else {
    // 401: Unauthorized.
    res.status(401).end();
  }
});

app.post('/search', function(req, res) {
  var fromUser = getUserIdFromToken(req.get('Authorization'));
  var user = db.readDocument('users', fromUser);
  if (typeof(req.body) === 'string') {
    // trim() removes whitespace before and after the query.
    // toLowerCase() makes the query lowercase.
    var queryText = req.body.trim().toLowerCase();
    // Search the user's feed.
    var feedItemIDs = db.readDocument('feeds', user.feed).contents;
    // "filter" is like "map" in that it is a magic method for
    // arrays. It takes an anonymous function, which it calls
    // with each item in the array. If that function returns 'true',
    // it will include the item in a return array. Otherwise, it will
    // not.
    // Here, we use filter to return only feedItems that contain the
    // query text.
    // Since the array contains feed item IDs, we later map the filtered
    // IDs to actual feed item objects.
    res.send(feedItemIDs.filter((feedItemID) => {
      var feedItem = db.readDocument('feedItems', feedItemID);
      return feedItem.contents.contents
      .toLowerCase()
      .indexOf(queryText) !== -1;
    }).map(getFeedItemSync));
  } else {
    // 400: Bad Request.
    res.status(400).end();
  }
});

/**
* Translate JSON Schema Validation failures into error 400s.
*/
app.use(function(err, req, res, next) {
  if (err.name === 'JsonSchemaValidation') {
    // Set a bad request http response status
    res.status(400).end();
  } else {
    // It's some other sort of error; pass it to next error middleware handler
    next(err);
  }
});

app.listen(3000, function(){
  console.log('Example app listening on port 3000');
});
