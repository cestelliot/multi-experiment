var socket = io();
socket.on('message', function(data){
  console.log(data);
});


//movement
var movement = {
  up: false,
  down: false,
  left: false,
  right: false
}
document.addEventListener('keydown', function(event){
  switch(event.keyCode){
    case 65:
      movement.left = true;
      break;
    case 87:
      movement.up = true;
      break;
    case 68:
      movement.right = true;
      break;
    case 83:
      movement.down = true;
      break;
  }
});

document.addEventListener('keyup', function(event){
    switch(event.keyCode){
      case 65:
        movement.left = false;
        break;
      case 87:
        movement.up = false;
        break;
      case 68:
        movement.right = false;
        break;
      case 83:
        movement.down = false;
        break;
    }
})

//communicating this to the Server so it knows whos moving
//60 times per second
socket.emit('new player');
setInterval(function(){
  socket.emit('movement', movement);
}, 1000/60);


//making the client do something with the movement information it receives from the Server
var canvas = document.getElementById('canvas');
canvas.width = 800;
canvas.height = 600;
var context = canvas.getContext('2d');
socket.on('state', function(players){
  context.clearRect(0, 0, 800, 600);
  context.fillStyle = 'green';
  for (var id in players){
    var player = players[id];
    context.beginPath();
    context.arc(player.x, player.y, 10, 0, 2*Math.PI);
    context.fill();
  }
}); 
