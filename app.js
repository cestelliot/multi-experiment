
//modules
var express = require('express');
var ejs = require('ejs');
var body_parser = require('body-parser');
var mongoose = require('mongoose');

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

//mongoose data saving
var emptySchema = new mongoose.Schema({}, {strict: false});
var Entry = mongoose.model('Entry', emptySchema);
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/jspsych');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error'));
db.once('open', function callback(){
  console.log('database opened')
});


//static middleware
const session = require(__dirname+'/controller/session.js');
app.use(express.static(__dirname + '/static'));
app.use('/jspsych', express.static(__dirname+'/jspsych'));
app.use('/node_modules', express.static(__dirname+'/node_modules'));
app.set('views', __dirname + '/views');
app.engine('html', ejs.renderFile);
app.set('view engine', 'html');
app.use(body_parser.json());


//direct participants to the experiment
app.get('/', function(request, response){
  response.render('full_experiment.html');
});

//for testing the training
app.get('/test', function(request, response){
  response.render('short_bugtest.html');
});

//data treatment
app.post('/experiment-data', function(request, response) {
    Entry.create({
      'data': request.body
    });
    response.end();
});

//show a finish page for a completion and an interrupt due to disconnection
app.get('/disconnect', function(request, response){
  response.render('disconnect.html');
});
app.get('/finish', function(request, response){
  response.render('finish.html');
});
app.get('/data_fail', function(request, response){
  response.render('data_fail.html');
});
