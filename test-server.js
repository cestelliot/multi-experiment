//make sure everything is loaded in that's needed
const { v4: uuidv4 } = require('uuid'),
      {app} = require('../app'),
      {io} = require('../app');




//random number generation for shuffling
//in the html these can be handled by native jsPsych functions, but here this is needed
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
//sessions is the object containing all the session information - when participants get put in a group a session is created and then put here to be indexed
var sessions = {};
//stimuli that are used - on the server side this is basically just text that can be sent to the client to tell it what to look up locally
var test_audio = ["stimuli/1.wav", "stimuli/2.wav", "stimuli/3.wav", "stimuli/4.wav",
                "stimuli/5.wav", "stimuli/6.wav", "stimuli/7.wav", "stimuli/8.wav",
                "stimuli/9.wav", "stimuli/10.wav", "stimuli/11.wav", "stimuli/12.wav",
                "stimuli/13.wav", "stimuli/14.wav", "stimuli/15.wav", "stimuli/16.wav"];
var cardStim = ["stimuli/1001.jpg", "stimuli/2001.jpg", "stimuli/3001.jpg", "stimuli/4001.jpg"];


//not as of yet randomised to something less dumb
var experiment_id = 1;





//app.js calls this to start the server
exports.start_socketserver = function(){

//when the server picks up that someone is trying to connect, what should it do?
io.on('connection', function(socket){

//called when the player finishes the 'start' trial, putting them in a session to wait for others
//before this point a connection is not needed as it's just checking eligibility for the experiment
//after this point a continuous connection isn't necessarily needed, but we need to know what the mappings between stimuli are so they can be kept consistent
  socket.on('new player', function(data){
    //the client generates a random id and sends it to the server, this id has to be used because the client will generate a few different socketIDs as they move through the experiment
    //having a code generated at the start gets around that, because then we can just index the participant based on this being sent with every package
    socket.cookie = data.cookie;
    var total_players = data.num_players;
    //generate the session
    let session = find_session(experiment_id, total_players, socket);
    session.total_trials = data.num_test_trials;
    //this is the index.html joining the session
    io.to(session.id).emit('session id', session.id);
    io.to(session.id).emit('images', session.cardStim);
    io.to(session.id).emit('audio', session.test_audio[0]);
    //just to make sure nothing odd is going on with the timers - they should be clear because the sessions only just been generated, but it's nice to check
    clearInterval(session.set_clock);
    //tell the people in the session how many people there are so it can update the waiting room numbers
    io.to(session.id).emit('player connect', session.participants());
  });


//called when each round of the trial loads - this joins the plugin sockets to the server as well
//this is a minor issue that needed solving - I found something that works but am certain there'll be a better way
//basically as trials get loaded by jsPsych they generate new sockets, so 2 trials that both need a socket connection to the server will generate new socketIDs from the same client
//this means the server thinks there's 2 connections rather than 1, and it can cause problems where info that needs to be sent to client socket 1 gets sent to 2 and does nothing
//all this does is put all client sockets in the session, information is then sent to everyone, which guarantees that no matter what the client will get the info it needs
//inelegant, but effective for what it needs to do
  socket.on('loaded', function(data){
      socket.join(data.session_id);
      sessions[data.session_id].loaded(data);
      });


//called when players have finished training and want to begin testing
socket.on('want to start', function(data){
  //update waiting room numbers
  sessions[data].ready_for_test++;
  io.to(data).emit('ready for test', sessions[data].ready_for_test);
  //only start if everyone that is left is ready
  //in a dyad the players_disconnected bit doesn't come up - 1 person leaving aborts the experiment, but in larger groups some number can leave and we can continue
  if (sessions[data].ready_for_test == (sessions[data].total_participants-sessions[data].players_disconnected)){
    io.to(data).emit('begin test', sessions[data].cardStim)
  }
})



//update the movement of players and keep them in bounds
  socket.on('movement', function(data){
    if (typeof sessions[data.session_id] !== 'undefined'){
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

    }
  });


  //check if the images chosen are the same for participants
  socket.on('image choice', function(data){
    sessions[data.session_id].image_picks.push(data.image_choice);
    if(sessions[data.session_id].image_picks.length ==  (sessions[data.session_id].total_participants-sessions[data.session_id].players_disconnected)){
      let valid_choice = sessions[data.session_id].image_picks.filter(x => x !== 'No choice');
      console.log(valid_choice);
      if (valid_choice.length >= 2 && valid_choice.every(x => x === valid_choice[0])) {
        io.to(data.session_id).emit('agreement')
      }
    }

  });






  // disconnect is for automatic disconnects like closing the browser window
  socket.on('disconnect', function () {
    if(typeof socket.session !== 'undefined'){
      console.log('disconnect');
      socket.session.leave(socket.cookie);
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
    setTimeout(destroy_session, 1e6, data);
    console.log('experiment ended');
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
  session.total_trials = 32;
  session.ready_for_test = 0;
  session.image_picks = [];
  session.players_disconnected = 0;




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
  session.leave = function(cookie) {
    console.log('leave');
    delete session.players[cookie];
    if (this.started==false){
      io.to(this.id).emit('disconnect before start', this.participants())
    } else {
      io.to(this.id).emit('disconnect');
      this.players_disconnected++;
    }

};


  // called if someone disconnects
  session.disconnect = function(client) {
    // leaving the session is automatic when client disconnects,
    // TODO: do something useful here
    console.log('disconnect');
    io.to(this.id).emit('disconnect');
    clearInterval(this.set_clock);
    clearTimeout(this.trial_limit);
  };





//called when the timer runs out to end the trial
session.end_trial = function(session){
  session.trial_started = false;
  session.image_picks = [];
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
     this.trial_limit = setTimeout(this.end_trial, 8e3, this);
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
