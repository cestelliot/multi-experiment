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
var sessions = {};
var test_audio = ["stimuli/1.wav", "stimuli/2.wav", "stimuli/3.wav", "stimuli/4.wav",
                "stimuli/5.wav", "stimuli/6.wav", "stimuli/7.wav", "stimuli/8.wav",
                "stimuli/9.wav", "stimuli/10.wav", "stimuli/11.wav", "stimuli/12.wav",
                "stimuli/13.wav", "stimuli/14.wav", "stimuli/15.wav", "stimuli/16.wav"];
var cardStim = ["stimuli/1001.jpg", "stimuli/2001.jpg", "stimuli/3001.jpg", "stimuli/4001.jpg"];


//not as of yet randomised to something less dumb
var experiment_id = 1;






exports.start_socketserver = function(){


io.on('connection', function(socket){

//called when the player finishes the 'start' trial, putting them in a session to wait for others
  socket.on('new player', function(data){
    socket.cookie = data.cookie;
    var total_players = data.num_players
    let session = find_session(experiment_id, total_players, socket);
    //this is the index.html joining the session
    io.to(session.id).emit('session id', session.id);
    io.to(session.id).emit('images', session.cardStim);
    io.to(session.id).emit('audio', session.test_audio[0]);
    clearInterval(session.set_clock);
    io.to(session.id).emit('player connect', session.participants());


  });


//called when each round of the trial loads
  socket.on('loaded', function(data){
      socket.join(data.session_id);
      sessions[data.session_id].loaded(data);

      });




//update the movement of players and keep them in bounds
  socket.on('movement', function(data){
    let player = {};
    for (cookie in sessions[data.session_id].players){
      if (sessions[data.session_id].players[cookie].socketID == data.socket_id){
        player = sessions[data.session_id].players[cookie];
      }
    };
    if(data.movement.left){
      player.x -= 2;
      if (player.x<0){
        player.x=0
      };
    };
    if(data.movement.up){
      player.y -= 2;
      if (player.y < 0){
        player.y=0
      };
    };
    if(data.movement.right){
      player.x += 2;
      if (player.x>800){
        player.x=800
      };
    };
    if(data.movement.down){
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
      console.log('leave outside');
      socket.session.leave();
    };
  });


  //destroy the room at the end of the experiment
  socket.on('end of experiment', function(data){
    setTimeout(destroy_session, 3e4, data);
    console.log(sessions);
  });





});
};




//creating sessions and such
function find_session(experiment_id, participants, client){
  var session;

  // first join sessions that are waiting for players
  for(id in sessions){
    if(sessions[id].join(experiment_id, participants, client)){
      session = sessions[id];
      break;
    }
  }
  // otherwise, create a new session and join it.
  if(typeof session == 'undefined'){
    session = create_session(experiment_id, participants);
    session.join(experiment_id, participants, client);
    sessions[session.id] = session;
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
  session.total_trials = 2;




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
    let address = client.cookie;
    this.players[address] = {x: 400, y: 300, socketID: client.id};


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
    console.log(this.participants())
};


  // called if someone disconnects
  session.disconnect = function(client) {
    // leaving the session is automatic when client disconnects,
    // TODO: do something useful here
    console.log('disconnect');
    io.to(this.id).emit('disconnect');
    clearInterval(this.set_clock);
  };





//called when the timer runs out to end the trial
session.end_trial = function(session){
  session.trial_started = false;
  clearInterval(session.set_clock);
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

    //check that players definitely moved - implement something where if they havent done it for a while they are disconnected
    for (id in session.players){
      if (session.players[id].start_x == session.players[id].x && session.players[id].start_y == session.players[id].y){
        if (session.players[id].no_moves == undefined){
          session.players[id].no_moves = 1;
        } else {
          session.players[id].no_moves++;
        }
      } else {
        session.players[id].no_moves = 0;
      }
    };

    //tell the participants that the trial has ended and send data to be recorded clientside
     io.to(session.id).emit('end_trial', session.players);

     console.log('end trial');
   };


//called when players load in
session.loaded = function(data){
  //update the socket id if it changed due to a small disconnect or whatever
  for (id in this.players){
    if (data.cookie == id){
      this.players[id].socketID = data.socket_id
    };
  };
    if (this.trial_started == false){
      this.set_players();
      this.set_timer();
      this.set_clock = setInterval(this.clock, 1000/60, this);
      this.trial_started=true;
      };
}




//set the timer at the start of the trial
   session.set_timer = function(){
     this.trial_limit = setTimeout(this.end_trial, 5e3, this);
     console.log('timer set');
   };


//set the clock for the trial
session.clock = function(session){
    io.to(session.id).emit('state', {players: session.players});
}





//set the players for the round
session.set_players = function(){
  for (id in this.players){
    this.players[id].x = rand(350, 450);
    this.players[id].y = rand(250, 350);
    this.players[id].start_x = this.players[id].x;
    this.players[id].start_y = this.players[id].y;
  }

};



  return session;
}


function destroy_session(id) {
  delete sessions[id];
}
