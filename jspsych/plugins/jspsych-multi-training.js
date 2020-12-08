/*
 * Example plugin template
 */

jsPsych.plugins["multi-training"] = (function() {

  var plugin = {};

  plugin.info = {
    name: "multi-training",
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
      num_players : {
        type: jsPsych.plugins.parameterType.INT,
        default: 2
      }
    }
  }

  plugin.trial = function(display_element, trial) {

    //set up canvas and place the images
    var trajectory = {x:[], y:[]};
    var canvasbg;
    var contextbg;
    var canvasfg;
    var contextfg;
    var imgs = {}

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

    var player = {x: rand(350, 450), y: rand(250, 350)};
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


    //set the movingInterval and the end trial
    var movingInterval = setInterval(move, 1000/60);
    var trial_limit = setTimeout(end_trial, 5e3);






    // end trial
function end_trial(){
      console.log('trial is over');
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('keyup', keyup);
      var trial_data = [];
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
          trial_data = {
            "stimulus": trial.stimulus,
            "x_trajectory": trajectory.x,
            "y_trajectory": trajectory.y,
            "final_x": player.x,
            "final_y": player.y,
            "image_choice": image_choice
          };
      clearInterval(movingInterval);
      clearTimeout(trial_limit);
      contextfg.clearRect(0, 0, parseInt(trial.canvas_width), parseInt(trial.canvas_height));
      $('canvas').detach();
      display_element.innerHTML = '';


      jsPsych.finishTrial(trial_data);
    };





    //make the player
    //this could be tidied up i think but it works so i'm wary about changing much
    var ticks = 0;
    function move(){
      ticks++;
      contextfg.clearRect(0, 0, parseInt(trial.canvas_width), parseInt(trial.canvas_height));
      trajectory.x.push(player.x);
      trajectory.y.push(player.y);
      //actually move the player
      if(movement.left){
        player.x -= 2;
        if (player.x<0){
          player.x=0
        };
      };
      if(movement.up){
        player.y -= 2;
        if (player.y < 0){
          player.y=0
        };
      };
      if(movement.right){
        player.x += 2;
        if (player.x>800){
          player.x=800
        };
      };
      if(movement.down){
        player.y += 2;
        if (player.y>600){
          player.y=600
        };
      };

      //draw the player
      contextfg.fillStyle = 'blue';
      contextfg.beginPath();
      contextfg.arc(player.x, player.y, 10, 0, 2*Math.PI);
      contextfg.fill();
    }

};

  return plugin;
})();
