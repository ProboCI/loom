'use strict';

var controllers = require('./controllers');

module.exports.configure = function(server, config) {
  var auth = require('./auth')({
    tokens: config.tokens,
  }).auth;

  // inject server configuration into the controllers
  var conf = function(req, res, next) {
    req.loomConfig = config;
    next();
  };

  server.post('/stream/', auth, conf, controllers.streams.create);
  server.post('/stream/:id', auth, conf, controllers.streams.create);
  server.get('/stream/:id', auth, conf, controllers.streams.get);
  server.get('/spy', auth, conf, controllers.streams.spy);
};
