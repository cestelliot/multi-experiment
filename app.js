
//modules
var express = require('express');
var ejs = require('ejs');


//start the app
var app = express();
const PORT = process.env.PORT || 5000;
var server = app.listen(PORT, function(){
  console.log('Listening on port %d', server.address().port);
  session.start_socketserver();
});
const io = require('socket.io')(server);

//export to controller
module.exports = {
  app: app,
  io: io
};

//static middleware
const session = require(__dirname+'/controller/session.js');
app.use(express.static(__dirname + '/static'));
app.use('/jspsych', express.static(__dirname+'/jspsych'));
app.use('/node_modules', express.static(__dirname+'/node_modules'));
app.set('views', __dirname + '/views');
app.engine('html', ejs.renderFile);
app.set('view engine', 'html');


//direct participants to the experiment
app.get('/', function(request, response){
  response.render('multiexperiment.html');
});

//for testing the training
app.get('/training', function(request, response){
  response.render('training-working.html');
})
