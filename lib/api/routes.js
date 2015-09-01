var controllers = require('./controllers')
var auth = require('./auth').auth

module.exports.configure = function (server){
  server.post('/stream/', controllers.streams.create)
  server.post('/stream/:id', controllers.streams.create)
  server.get ('/stream/:id', controllers.streams.get)
  server.get ('/spy', controllers.streams.spy)
}
