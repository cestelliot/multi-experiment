const { v4: uuidv4 } = require('uuid'),
      {app} = require('../app'),
      {io} = require('../app');


//random number generation
function rand(min, max) {
  let randomNum = Math.random() * (max - min) + min;
  return Math.floor(randomNum);
};



//shuffle
var shuffle = function (array) {

	var currentIndex = array.length;
	var temporaryValue, randomIndex;

	// While there remain elements to shuffle...
	while (0 !== currentIndex) {
		// Pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;

		// And swap it with the current element.
		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}

	return array;

};


//stuff that needs to be added in
var sessions = [];
var session;
var test_audio = ["stimuli/1.wav", "stimuli/2.wav", "stimuli/3.wav", "stimuli/4.wav",
                "stimuli/5.wav", "stimuli/6.wav", "stimuli/7.wav", "stimuli/8.wav",
                "stimuli/9.wav", "stimuli/10.wav", "stimuli/11.wav", "stimuli/12.wav",
                "stimuli/13.wav", "stimuli/14.wav", "stimuli/15.wav", "stimuli/16.wav"];
var cardStim = ["stimuli/1001.jpg", "stimuli/2001.jpg", "stimuli/3001.jpg", "stimuli/4001.jpg"];


//not as of yet randomised to something less dumb
var experiment_id = 1;
//this could be passed by the multiexperiment plugin but right now it isn't
var total_players = 2;


//player detection
var num_players = 0;
var start_pos = [{x:350, y:300, colour:'blue'}, {x:450, y:300, colour:'red'}]



exports.start_socketserver = function(){


io.on('connection', function(socket){

//called when the player finishes the 'start' trial, putting them in a session to wait for others
  socket.on('new player', function(cookie){
    socket.cookie = cookie;
    var session = find_session(experiment_id, total_players, socket);
    //this is the index.html joining the session
    io.to(socket.session.id).emit('session id', session.id);
    io.to(socket.session.id).emit('images', session.cardStim);
    io.to(socket.session.id).emit('audio', session.test_audio[0]);
    clearInterval(session.clock);
    session.clock = setInterval(function(){
      for (player in session.players){
        let idx = session.players[player].socketID
        io.to(idx).emit('state', {players: session.players});
      }
      }, 1000/60);

  });


//called when each round of the trial loads
  socket.on('loaded', function(data){
    socket.join(data.session_id);
    for (session in sessions){
      if (sessions[session].id == data.session_id){
        var session = sessions[session]
      }
    };
    //update the socket id if it changed due to a small disconnect or whatever
    for (id in session.players){
      if (id == data.cookie){
        session.players[data.cookie].socketID = socket.id
      };
    }
    //this is the plugin.js joining the session
    //both this and index are needed or the server won't be able to send to things not in the specific plugin
    socket.session = session;
    session.set_players(socket.id);

    if (session.trial_started == false){
        session.set_timer();
        session.trial_started=true;
    };
  }
  );




//update the movement of players and keep them in bounds
  socket.on('movement', function(data){
    var player = {};
    for (cookie in socket.session.players){
      if (socket.session.players[cookie].socketID == socket.id){
        player = socket.session.players[cookie];
      }
    };
    if(data.left){
      player.x -= 2;
      if (player.x<0){
        player.x=0
      };
    };
    if(data.up){
      player.y -= 2;
      if (player.y < 0){
        player.y=0
      };
    };
    if(data.right){
      player.x += 2;
      if (player.x>800){
        player.x=800
      };
    };
    if(data.down){
      player.y += 2;
      if (player.y>600){
        player.y=600
      };
    };



  });




  // disconnect is for automatic disconnects like closing the browser window
  socket.on('disconnect', function () {
    if(typeof socket.session !== 'undefined'){
      console.log('disconnect');
      socket.session.leave();
    };
  });

  // leave is for manual disconnects triggered by the client for whatever reason
  socket.on('leave', function(){
    if(typeof socket.session !== 'undefined'){
      console.log('leave');
      socket.session.leave();
    };
  });





});
};




//creating sessions and such
function find_session(experiment_id, participants, client){
  var session;

  // first join sessions that are waiting for players
  for(var i=0; i<sessions.length; i++){
    if(sessions[i].join(experiment_id, participants, client)){
      session = sessions[i];
      break;
    }
  }
  // otherwise, create a new session and join it.
  if(typeof session == 'undefined'){
    session = create_session(experiment_id, participants);
    sessions.push(session);
    session.join(experiment_id, participants, client);
  }

  return session;
}


function create_session(experiment_id, total_participants){

  var session = {};
  session.id = uuidv4();
  session.experiment_id = experiment_id;
  session.total_participants = total_participants;
  session.trial_limit;
  session.started = false;
  session.trial_started = false;
  session.clients = [];
  session.players = {};
  session.test_audio = shuffle(test_audio);
  session.cardStim = shuffle(cardStim);
  session.trial_num = 0;
  session.total_trials = 1;




  // returns the number of people in the session
  session.participants = function(){
    if(typeof io.sockets.adapter.rooms[this.id] == 'undefined'){
      return 0;
    } else {
      return io.sockets.adapter.rooms[this.id].length;
    }
  };



  // adds client to this session if space is available and experiment_id matches
  session.join =  function(experiment_id, total_participants, client) {
    // check if experiment has already started or if session is full
    if(this.experiment_id !== experiment_id || total_participants !== this.total_participants || this.started || this.participants() >= this.total_participants) {
      return false;
    }
    client.join(this.id);
    client.session = this;
    var address = client.cookie;
    session.players[address] = start_pos[num_players];
    session.players[address].socketID = client.id
    num_players++;


    // when session is full, send start message
    if(this.participants() == this.total_participants){
      this.started = true;
      io.to(this.id).emit('room full');
    }
    return true;
  };


//return the client ids
  session.get_ids = function(){
    var player_ids = [];
    for (player in session.players){
      player_ids.push(session.players[player].socketID)
    }
    return player_ids
  }


  // called if someone leaves
  session.leave = function(client) {
    console.log('leave');
    io.to(this.id).emit('disconnect');
};


  // called if someone disconnects
  session.disconnect = function(client) {
    // leaving the session is automatic when client disconnects,
    // TODO: do something useful here
    console.log('disconnect');
    io.to(this.id).emit('disconnect');
  };





//called when the timer runs out to end the trial
session.end_trial = function(){
  session.trial_started = false;
  //shuffle the images and send them to the clients
    session.cardStim = shuffle(session.cardStim);
    io.to(session.id).emit('images', session.cardStim);
    //check what number trial we are on and either end the test, or reshuffle the audio,
    //then send it to the clients
    session.trial_num++;
    if (session.trial_num==session.total_trials){
      io.to(session.id).emit('end test')
    };
    if (session.trial_num%16==0){
      session.test_audio = shuffle(session.test_audio);
    };
    io.to(session.id).emit('audio', session.test_audio[session.trial_num%16]);
    console.log(session.trial_num);

    //tell the participants that the trial has ended and send data to be recorded clientside
     io.to(session.id).emit('end_trial', session.players);
     console.log('end trial');
   };



//set the timer at the start of the trial
   session.set_timer = function(){
     session.trial_limit = setTimeout(session.end_trial, 5e3);
     console.log('timer set');
   };



//set the players for the round
session.set_players = function(id){
  for (id in session.players){
    session.players[id].x = rand(350, 450);
    session.players[id].y = rand(250, 350);
  }

};



  return session;
}


function destroy_session(id) {
  delete sessions[id];
}
