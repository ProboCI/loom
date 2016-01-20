var controllers = require('./controllers')

module.exports.configure = function (server, config){
  var auth = require('./auth')({
    tokens: config.tokens
  }).auth

  server.post('/stream/', auth, controllers.streams.create)
  server.post('/stream/:id', auth, controllers.streams.create)
  server.get ('/stream/:id', auth, controllers.streams.get)
  server.get ('/spy', auth, controllers.streams.spy)
}
