//Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
const { v4: uuidv4 } = require('uuid');


var app = express();
var server = http.Server(app);
var io = socketIO(server);

app.set('port', 5000);
app.use('/static', express.static(__dirname + '/static'));
app.use('/jspsych-6.1.0', express.static(__dirname + "/jspsych-6.1.0"));
app.use('/node_modules', express.static(__dirname + "/node_modules"))
app.use('/stimuli', express.static(__dirname + "/stimuli"));



//Routing
app.get('/', function(request, response){
  response.sendFile(path.join(__dirname, 'multiexperiment.html'))
});







//Start server
server.listen(5000, function(){
  console.log('Starting server on port 5000');
});


//stuff that needs to be added in
var sessions = [];
var experiment_id = 1;
var session;


//player detection
var num_players = 0;
var start_pos = [{x:350, y:300, player_num:0}, {x:450, y:300, player_num:1}]


io.on('connection', function(socket){


  socket.on('new player', function(){
    session = find_session(experiment_id, 2, socket);

    session.players[socket.id] = start_pos[num_players];
    num_players ++;
    console.log(session);
  });



  socket.on('loaded', function(){
    session.set_timer()
  }
  );




  socket.on('movement', function(data){
    var player = session.players[socket.id] || {};
    if(data.left){
      player.x -= 5;
    }
    if(data.up){
      player.y -= 5;
    }
    if(data.right){
      player.x += 5;
    }
    if(data.down){
      player.y += 5;
    }
    if (player.x<0){
      player.x=0
    };
    if (player.x>800){
      player.x=800
    };
    if (player.y < 0){
      player.y=0
    };
    if (player.y>600){
      player.y=600
    };
  });




socket.on('disconnect', function(){

});




});





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
  session.clients = [];
  session.players = [];
  session.clock = setInterval(function(){
    io.sockets.emit('state', session.players);
  }, 1000/60);



  // returns the number of people in the session
  session.participants = function(){
    if(typeof io.sockets.adapter.rooms[this.id] == 'undefined'){
      return 0;
    } else {
      return io.sockets.adapter.rooms[this.id].length;
    }
  };

  // returns client ids in this session
  session.client_ids = function(){
    if(typeof io.sockets.adapter.rooms[this.id] == 'undefined'){
      return [];
    } else {
      console.log(io.sockets.adapter.rooms[this.id].sockets);
      return Object.keys(io.sockets.adapter.rooms[this.id].sockets);
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

    this.update('joined');

    // when session is full, get confirmation from everyone that session can start
    if(this.participants() == this.total_participants){
      this.confirm_ready();
    }
    return true;
  };

  // called if someone leaves
  session.leave = function(client) {
    this.update('leave');
    io.to(this.id).emit('disconnect');
};

  // called if someone disconnects
  session.disconnect = function(client) {
    // leaving the session is automatic when client disconnects,
    // TODO: do something useful here
    this.update('disconnect');
    io.to(this.id).emit('disconnect');
  };

  // updates each client with the number of currently connected participants
  session.update = function(message){
    /* TODO: this is from the code I copied. It's for sending a message to the entire room;
    currently doesn't have an endpoint in the client script, so if one person leaves,
    from their partner's viewpoint, it still looks like they're ready to go
    */
    var n_participants = this.participants();
    io.to(this.id).emit('session-update', {
      participants: n_participants,
      message: message
    });
  };

  session.confirm_ready = function() {
    // reset ready counter
    this.messages.ready = 0;
    // reset status of all clients
    var clients = io.in(this.id).connected;
    for(var id in clients){
      clients[id].confirmed_ready = false;
    }
    // send ready-check messages to all clients
    io.to(this.id).emit('ready-check', {});
    /* I'm commenting the following out for now. Ultimately, we want to get participants to confirm that they're ready,
    once their room is full, and have it boot them out of the particular room if they take too long,
    so that their partner is free to join up with another partner who is ready to go
    */
    // set timeout to abort ready process after Xms
    // setTimeout(()=>{
    //   this.abort_start();
    // }, READY_TIMEOUT);
  };

  /*
  TODO: I've commented the following few function out, cos they depend on participants having to confirm
  that they're ready, and that endpoint hasn't been implemented yet
  */
   session.client_ready = function(client) {
     if(!client.confirmed_ready){
       this.messages.ready++;
       client.confirmed_ready = true;
       if(this.messages.ready == this.total_participants){
         this.start();
       }
     }
   };

   session.start = function(){
     this.started = true;
     var clients = io.in(this.id).connected;
     var idx = 0;
     for(var id in clients){
       clients[id].player_id = idx;
       idx++;
       clients[id].emit('start', {player_id: clients[id].player_id});
     }
   };

session.end_trial = function(){
     io.to('session').emit('end_trial', this.players);
     console.log(session.trial_limit);
     console.log('end trial');
   };

   session.set_timer = function(){
     session.trial_limit = setTimeout(session.end_trial, 1e4);
     console.log('timer set');
   };


  return session;
}


function destroy_session(id) {
  delete sessions[id];
}
