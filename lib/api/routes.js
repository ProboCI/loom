var controllers = require('./controllers')
var auth = require('./auth').auth

module.exports.configure = function (server){
  server.post('/stream', controllers.stream.create)
  server.get ('/stream/:id', controllers.stream.get)
}
