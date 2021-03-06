var Event = require('../app/Event.js');
var User = require('../app/User.js');
var bodyParser = require('body-parser');
var escapeStringRegexp = require('escape-string-regexp');
var ICS = require('../app/icsparser.js');
var alexaVerifier = require('alexa-verifier');

var userPins = {};

module.exports = function(app, passport){
        app.get('/', function(req, res) {
			res.render('index.ejs');
		});

        // ::: VIEWS :::

        app.get('/profile', isLoggedIn, function(req, res) {
                res.render('profile.ejs', {user : req.user});
        });

        app.get('/login', function(req, res) {
                res.render('index.ejs');
        });

        app.get('/logout', function(req, res) {
                req.logout();
                res.redirect('/login');
        });

        // ::: GOOGLE AUTHENTICATION ::: 

        // profile gets us their basic information including their name
        // email gets their emails
        app.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] }));

        // the callback after google has authenticated the user
        app.get('/auth/google/callback',
                passport.authenticate('google', {
                        successRedirect : '/profile',
                        failureRedirect : '/login'
                }));

        // ::: USER-CREATED EVENTS HANDLING :::

        app.post('/getCurrentEvents', function(req, res) {

        });

		app.post('/addUserToEvent', function(req, res) {
			var eventName = req.body.eventAdd;
			Event.find({'events.name' : eventAdd}, function(err, docs) {
				
			});
		});
		
        app.get('/testAddEvent', function(req, res) {
                res.render('testEventAdd.ejs');
        });

        app.post('/createevent', function(req, res) {
                var events = req.body;
                console.log(req.body); 
                var newEvent = new Event();

                newEvent.events.tags = events.tags;
                newEvent.events.friendsVisible = events.friendsVisible;
                newEvent.events.time_started = events.time_started;
                newEvent.events.time_ended = events.time_ended;
                newEvent.events.name = events.name;
                newEvent.events.description = events.description;

                newEvent.save(function(err) {
                        console.log(err);
                });
        });

        app.post('/findeventbytags', function(req, res) {
                var tagList = req.body.tags;
                var eventList = [];

                for (var i = 0 ; i < tagList.length; i++) {
                        var currTag = tagList[i];
                        Event.find({'events.tags.tag' : currTag}, function(err, docs){
                                for (var j = 0 ; j < docs.length; j++){
                                        eventList.push(docs[j]);
                                        console.log(eventList);
                                }

                                if (i == tagList.length - 1)
                                        res.end(JSON.stringify(eventList));
                        });
                }

        });

        app.post('/findeventall', function(req, res) {
			Event.find({}, function(err, docs) {
				res.send(JSON.stringify(docs));
			});
        });
        app.get('/findeventall', function(req, res) {
                var user = req.user;

                var result = {};
                Event.find({ 'events.friendsVisible.friend': user.user.google.id }, (err, docs) => {
                        docs.forEach(eventDoc => {
                        });
                });
        });

        app.get('/findeventbyfriend', function(req, res) {

        });

        // ::: FRIEND HANDLING :::

        app.get('/searchusers', isLoggedIn, function(req, res) {
                res.render('searchusers.ejs', {user: req.user});
        });

        app.post('/searchusers', function(req, res) {
                var namequery = req.param('namequery');
                if (namequery) {
                        User.find({
                                'user.google.name': new RegExp(escapeStringRegexp(namequery), "i")
                        }).select({'user.google.name': 1, 'user.google.email': 1}).exec((error, users) => {
                                res.setHeader('Content-Type', 'application/json');
                                res.send(JSON.stringify(users.map(user => user.user.google)));
                        });
                }

        });

        app.post('/findAllUsers', function(req, res) {
                User.find({}, function(err, docs) {
                        res.send(JSON.stringify(docs));
                });
        });
		
        app.post('/friends', isLoggedIn, function(req, res) {
                var friends = req.user.user.data.friends;
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify(friends));
        });

        app.post('/searchFriendById', function(req, res) {
                var idToCheck = req.body.friendId;
                res.end(JSON.stringify(getDocumentFromId(idToCheck)));
        });

        app.post('/addfriend', function(req, res) {
                var friend = req.body.friend;
				console.log(req.body);
                var user = req.user;
                user.user.data.friends.push(friend);
                user.save();
				res.end("FINISHED");
        });

        app.post('/removefriend', function(req, res) {
                var friend = req.body.friend;
                User.find('user.google.id', friend, function(err, docs){
                        docs.remove();
                });
        });

        app.post('/seeIfFree', function(req, res) {
                var idToCheck = req.body.friendId;
                var documentToCheck = getDocumentFromId(idToCheck);

                var now = new Date();
                var free = isFree(documentToCheck, now);

                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify({free: free}));
        });

        app.get('/findFreeFriends', function(req, res) {
                var user = req.user;

                freeFriends = findFreeFriends(user);

                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify({freeFriends: freeFriends}));
        });

        // ::: SCHEDULE(RECURRING) STUFF :::

        app.get('/addschedule', isLoggedIn, function(req, res) {
                res.render('addschedule.ejs', {user: req.user});
        });

        app.post('/addschedule', function(req, res) {
                var user = req.user;
                var ical = req.body.ical;
                if (typeof ical === "string") {
                        var parsed = ICS.parseICS(req.body.ical)
                        parsed.forEach(item => {
                                user.user.data.schedule.push({
                                        scheduleEvent: {
                                                name: item.name,
                                                location: item.location,
                                                ignore: item.ignore,
                                                start_date: item.start_date,
                                                end_date: item.end_date,
                                                days_of_week: item.days_of_week,
                                                start_time: item.start_time,
                                                end_time: item.end_time
                                        }
                                });

                        });

                        user.save();
                        console.log(user.user.data.schedule);
                }

        });

        app.post('/clearschedule', function(req, res) {
                req.user.user.data.schedule = [];
                req.user.save();
        });

        app.get('/schedule', function(req, res) {
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify(req.user.user.data.schedule));
        });

        app.post('/removescheduleelement', function(req, res) {

        });

        // ::: EXTRANEOUS METHODS :::

        app.post('/changeuservisibility', function(req, res) {

        });

        app.get('/alexapin', isLoggedIn, function(req, res) {
                var user = req.user;
                var pin = Math.floor(Math.random() * 9000) + 1000;
                userPins[pin] = user.user.google.id;
                res.setHeader('Content-Type', 'text/plain');
                res.send(pin.toString());
        });


        // ::: ALEXA SHIT :::
        

        app.post('/alexa', function(req, res) {
                var body = req.body;
                if (!body.request.intent) {
                        res.send(makeAlexaResponse("oops"));
                        return;
                }

                var intent = body.request.intent.name;
                var alexaUserId = body.session.user.userId;

                var response = "";

                switch(intent) {
                        case "FreeFriends": {
                                User.findOne({ 'user.data.alexaUserId': alexaUserId }, (err, userDoc) => {
                                        if (userDoc) {
                                                findFreeFriends(userDoc, freeFriends => {
                                                        var names = freeFriends.map(friendDoc => friendDoc.user.google.name);
                                                        nameList = englishConcat(names);
                                                        if (names.length == 0) {
                                                                response = "You have no free friends right now. Perhaps you should make some?";
                                                        } else if (names.length == 1) {
                                                                response = "Your only free friend right now is " + names[0];
                                                        } else {
                                                                response = "You have " + names.length + " free friends right now. ";
                                                                response += "They are " + nameList + ".";

                                                        }

					                res.json(makeAlexaResponse(response));
                                                });
						return;

                                        } else {
                                                response = "You are not logged in. [insert instructions to login here]"
                                        }
                                        res.json(makeAlexaResponse(response));
                                });

                                return;
                        }
                        case "LogIn": {
                                var pin = parseInt(body.request.intent.slots.pin.value, 10);
                                if (pin >= 1000 && pin < 10000) {
                                        if (pin in userPins) {
                                                var id = userPins[pin];
                                                getDocumentFromId(id, userDoc=> {
                                                        if (!userDoc || Object.keys(userDoc).length === 0) {
                                                                response = "That user doesn't exist anymore.";
                                                        } else {
                                                                userDoc.user.data.alexaUserId = alexaUserId;
                                                                userDoc.save();
                                                                response = "Succesfully logged in as " + userDoc.user.google.name + ".";
                                                        }

                                                        res.json(makeAlexaResponse(response));
                                                });
                                                return;
                                        } else {
                                                response = "Invalid pin.";
                                        }
                                } else {
                                        respone = "Invalid pin.";
                                }

                                break;
                        }
                        case "GetEvents": {
                                Event.aggregate({ $sample: {size: 3} }, (err, eventDocs) => {
                                        var names = eventDocs.map(edoc => edoc.events.name);
                                        if (names.length == 0) {
                                                response = "There are no events scheduled.";
                                        } else if (names.length == 1) {
                                                response = "There is one event. It is ";
                                        } else {
                                                response = "Here are some events that are scheduled. They're called ";
                                        }

                                        if (names.length != 0) {
                                                response += englishConcat(names);
                                        }

                                        res.json(makeAlexaResponse(response));
                                });

                                return;
                        }
                }

                res.json(makeAlexaResponse(response));


        });
}	

function englishConcat(list) {
        if (list.length == 0) {
                return "";
        } else if (list.length == 1) {
                return list[0];
        } else if (list.length == 2) {
                return list[0] + " and " + list[1];
        } else {
                return list.slice(0, -1).join(", ") + ", and " + list[list.length-1];
        }
}

// userDoc is a user document
// time is a Date object.
function isFree(userDoc, time) {
        const now = new Date();
        const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
        var schedule = userDoc.user.data.schedule;

        var day = time.getDay();

        // This is the amount of seconds since midnight.
        // Sorry for the stupid variable name
        var secs = time.getSeconds() + (60 * (now.getMinutes() + (60 * now.getHours())));

        var free = !schedule.some(itemobj => {
                var item = itemobj.scheduleEvent;
                if (item.ignore) return true;

                var days = item.days_of_week.split(" ").map(day => days[day]);

                if (days.indexOf(dayNumber) > -1) {
                        return secs >= item.start_time && secs <= item.end_time;
                }

                return false;

        });

        return free;
}

function findFreeFriends(userDoc, callback) {
        var friends = userDoc.user.data.friends;
        var now = new Date();

        var freeFriends = [];

        var count = 0;
        friends.filter(friendId => {
                const friendDoc = getDocumentFromId(friendId, (friendDoc) => {
                        if (isFree(friendDoc, now)) {
                                freeFriends.push(friendDoc);
                        }
                        count++;
                        if (count >= friends.length) {
                                callback(freeFriends);
                        }
                });
        });
}

function makeAlexaResponse(responseText) {
        return ({"version": "1.0",
         "response": {"shouldEndSession": true,
                      "outputSpeech": {
                                "type": "SSML",
                                "ssml": "<speak>" + responseText + "</speak>"}}});
}

function getDocumentFromId(id, callback) {
        User.findOne({'user.google.id' : id }, function(err, docs) {
                if (err)
                        callback({});
                return callback(docs);
        });
}

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {

        // if user is authenticated in the session, carry on
        if (req.isAuthenticated())
                return next();

        // if they aren't redirect them to the home page
        res.redirect('/login');
}
