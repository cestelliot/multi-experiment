/*
 * Example plugin template
 */

jsPsych.plugins["multi-experiment"] = (function() {

  var plugin = {};
  var socket = io();

  plugin.info = {
    name: "multi-experiment",
    parameters: {
      images: {
        type: jsPsych.plugins.parameterType.STRING, // BOOL, STRING, INT, FLOAT, FUNCTION, KEYCODE, SELECT, HTML_STRING, IMAGE, AUDIO, VIDEO, OBJECT, COMPLEX
        default: undefined
      },
      stimulus: {
        type: jsPsych.plugins.parameterType.AUDIO,
        default: undefined
      },
      canvas_height: {
        type: jsPsych.plugins.parameterType.STRING,
        default: '600px'
      },
      canvas_width: {
        type: jsPsych.plugins.parameterType.STRING,
        default: '800px'
      },
      cookie : {
        type: jsPsych.plugins.parameterType.String,
        default: undefined
      },
      session_id : {
        type: jsPsych.plugins.parameterType.String,
        default: undefined
      },
      continuous_feedback : {
        type: jsPsych.plugins.parameterType.BOOL,
        default: true
      },
      num_players : {
        type: jsPsych.plugins.parameterType.INT,
        default: 2
      }
    }
  }

  plugin.trial = function(display_element, trial) {

    //set up canvas and place the images
    socket.session_id = trial.session_id;
    var trajectory = {x:[], y:[]};
    var canvasbg;
    var contextbg;
    var canvasfg;
    var contextfg;
    var imgs = {}

    drawCanvas();
    function drawCanvas() {
      var html = '<script src="node_modules/jquery/dist/jquery.js"></script>'+
       "<canvas id='canvasbg' width='"+trial.canvas_width+"'; height='"+trial.canvas_height+"'; style='border:5px solid black; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 0'></canvas>";

      canvasfg = document.createElement('canvas');
      canvasfg.id = 'canvasfg';
      canvasfg.height = parseInt(trial.canvas_height);
      canvasfg.width = parseInt(trial.canvas_width);
      canvasfg.style = 'border:5px solid black; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 1'
      document.body.appendChild(canvasfg);



      display_element.innerHTML = html;
      canvasbg = document.getElementById('canvasbg');
      contextbg = canvasbg.getContext('2d');
      canvasfg = document.getElementById('canvasfg');
      contextfg = canvasfg.getContext('2d');

    };


    //loading the images onto the canvas
    loadImage(contextbg);
    function loadImage(contextbg){
        var image1 = new Image();
        var image2 = new Image();
        var image3 = new Image();
        var image4 = new Image();
        image1.src = trial.images[0];
        image2.src = trial.images[1];
        image3.src = trial.images[2];
        image4.src = trial.images[3];
        image1.onload = function(){
          contextbg.drawImage(image1, 0, 0);
          imgs[1] = {width: this.width, height:this.height};
        };
        image2.onload = function(){
          contextbg.drawImage(image2, (parseInt(trial.canvas_width)-this.width), 0);
          imgs[2] = {width: this.width, height:this.height};
        };
        image3.onload = function(){
          contextbg.drawImage(image3, 0, (parseInt(trial.canvas_height)-this.height));
          imgs[3] = {width: this.width, height:this.height};
        };
        image4.onload = function(){
          contextbg.drawImage(image4, (parseInt(trial.canvas_width)-this.width), parseInt(trial.canvas_height)-this.height);
          imgs[4] = {width: this.width, height:this.height};
        };
    };


    //play audio
    var context = jsPsych.pluginAPI.audioContext();
    var start_time = performance.now();
      if(context !== null){
        var source = context.createBufferSource();
        source.buffer = jsPsych.pluginAPI.getAudioBuffer(trial.stimulus);
        source.connect(context.destination);
      } else {
        var audio = jsPsych.pluginAPI.getAudioBuffer(trial.stimulus);
        audio.currentTime = 0;
      };
      if(context !== null){
        startTime = context.currentTime;
        source.start(startTime);
      } else {
        audio.play();
      };






    //movement

    var movement = {
      up: false,
      down: false,
      left: false,
      right: false
    };
    function keydown(event){
      switch(event.keyCode){
        case 37 || 123:
          movement.left = true;
          break;
        case 38 || 126:
          movement.up = true;
          break;
        case 39 || 124:
          movement.right = true;
          break;
        case 40 || 125:
          movement.down = true;
          break;
      }
    };
    function keyup(event){
      switch(event.keyCode){
        case 37 || 123:
          movement.left = false;
          break;
        case 38 || 126:
          movement.up = false;
          break;
        case 39 || 124:
          movement.right = false;
          break;
        case 40 || 125:
          movement.down = false;
          break;
      }
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('keyup', keyup);

    var movingInterval = setInterval(function(){
      socket.emit('movement', {movement: movement, session_id:trial.session_id, socket_id:socket.id});
    }, 1000/60);






    // end trial
    socket.on('end_trial', function(players){
      console.log('trial is over');
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('keyup', keyup);
      socket.removeEventListener('state');
      socket.removeEventListener('end_trial');
      var trial_data = [];
      for (var id in players){
        if (id == trial.cookie){
          var player = players[id];
          if (player.x <= imgs[1].width && player.y <= imgs[1].height){
            var image_choice = trial.images[0]
          } else if (parseInt(trial.canvas_width) - imgs[2].width <= player.x && player.y <= imgs[2].height){
            var image_choice = trial.images[1]
          } else if (player.x <= imgs[3].width && parseInt(trial.canvas_height)-imgs[3].height <= player.y ){
            var image_choice = trial.images[2]
          } else if (parseInt(trial.canvas_width) - imgs[4].width <= player.x && parseInt(trial.canvas_height)-imgs[4].height <= player.y){
            var image_choice = trial.images[3]
          } else {
            var image_choice = 'No choice'
          };
          socket.emit('image choice', {session_id: trial.session_id, image_choice: image_choice});
          trial_data = {
            "session": trial.session_id,
            "player": trial.cookie,
            "stimulus": trial.stimulus,
            "x_trajectory": trajectory.x,
            "y_trajectory": trajectory.y,
            "final_x": player.x,
            "final_y": player.y,
            "image_choice": image_choice
          }
        }

      };
      clearInterval(movingInterval);
      contextfg.clearRect(0, 0, parseInt(trial.canvas_width), parseInt(trial.canvas_height));
      $('canvas').detach();
      display_element.innerHTML = '';


      jsPsych.finishTrial(trial_data);
    });


    //when the trial actually begins this tells the server to start a timer and assign players
    socket.emit('loaded', {cookie: trial.cookie, session_id: trial.session_id, socket_id: socket.id});



    //make the player
    //this could be tidied up i think but it works so i'm wary about changing much
    var ticks = 0;
    socket.on('state', function(players){
      ticks++;
      contextfg.clearRect(0, 0, parseInt(trial.canvas_width), parseInt(trial.canvas_height));
      for (var id in players.players){
        //first check if we want participants to be able to see what other people are doing
        if (trial.continuous_feedback == true || ticks >= 120){
          let player = players.players[id];
          //push the trajectories to a storage for data, make the player blue for themselves
          if (id == trial.cookie){
            trajectory.x.push(player.x);
            trajectory.y.push(player.y);
            var colour = 'blue';
          } else {
            //make other players red
            var colour = 'red';
          }
          //draw in players based on this
          contextfg.fillStyle = colour;
          contextfg.beginPath();
          contextfg.arc(player.x, player.y, 10, 0, 2*Math.PI);
          contextfg.fill();
        } else {
          //this is when we don't want other players to be drawn, the client can only see their own piece
          let player = players.players[id];
          if (id == trial.cookie){
            trajectory.x.push(player.x);
            trajectory.y.push(player.y);
            contextfg.fillStyle = 'blue';
            contextfg.beginPath();
            contextfg.arc(player.x, player.y, 10, 0, 2*Math.PI);
            contextfg.fill();
          }
        }

      }
    });




  };

  return plugin;
})();
