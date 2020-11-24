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
      }
    }
  }

  plugin.trial = function(display_element, trial) {

    //set up canvas and place the images
    var canvasbg;
    var contextbg;
    var canvasfg;
    var contextfg;

    drawCanvas();
    function drawCanvas() {
      var html = '<script src="node_modules/jquery/dist/jquery.js"></script>'+
       "<canvas id='canvasbg' width='"+trial.canvas_width+"'; height='"+trial.canvas_height+"'; style='border:5px solid black; position: absolute; left: 0; top: 0; z-index: 0'></canvas>";

      canvasfg = document.createElement('canvas');
      canvasfg.id = 'canvasfg';
      canvasfg.height = parseInt(trial.canvas_height);
      canvasfg.width = parseInt(trial.canvas_width);
      canvasfg.style = 'border:5px solid black; position: absolute; left: 0; top: 0; z-index: 1'
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
        };
        image2.onload = function(){
          contextbg.drawImage(image2, (parseInt(trial.canvas_width)-this.width), 0);
        };
        image3.onload = function(){
          contextbg.drawImage(image3, 0, (parseInt(trial.canvas_height)-this.height));
        };
        image4.onload = function(){
          contextbg.drawImage(image4, (parseInt(trial.canvas_width)-this.width), parseInt(trial.canvas_height)-this.height);
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
        case 37:
          movement.left = true;
          break;
        case 38:
          movement.up = true;
          break;
        case 39:
          movement.right = true;
          break;
        case 40:
          movement.down = true;
          break;
      }
    };
    function keyup(event){
      switch(event.keyCode){
        case 37:
          movement.left = false;
          break;
        case 38:
          movement.up = false;
          break;
        case 39:
          movement.right = false;
          break;
        case 40:
          movement.down = false;
          break;
      }
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('keyup', keyup);

    var movingInterval = setInterval(function(){
      socket.emit('movement', movement);
    }, 1000/60);








    // data saving


    // end trial
    socket.on('end_trial', function(players){
      console.log('trial is over');
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('keyup', keyup);
      socket.removeEventListener('state');
      socket.removeEventListener('end_trial');
      var trial_data = [];
      for (var id in players){
        var player = players[id];
        trial_data[id] = {
          "images": trial.images, 
          "player": player.socketID,
          "x": player.x,
          "y": player.y
        }
      };
      clearInterval(movingInterval);
      contextfg.clearRect(0, 0, parseInt(trial.canvas_width), parseInt(trial.canvas_height));
      $('canvas').detach();
      display_element.innerHTML = '';


      jsPsych.finishTrial(trial_data);
    });


    //when the trial actually begins this tells the server to start a timer and assign players
    socket.emit('loaded', trial.cookie);
    console.log('loaded');



    //make the player
    socket.on('state', function(players){
      console.log('state');
      contextfg.clearRect(0, 0, parseInt(trial.canvas_width), parseInt(trial.canvas_height));
      for (var id in players.players){
        let player = players.players[id];
        contextfg.fillStyle = player.colour;
        contextfg.beginPath();
        contextfg.arc(player.x, player.y, 10, 0, 2*Math.PI);
        contextfg.fill();
      }
    });


  };

  return plugin;
})();
