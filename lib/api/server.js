var restify = require('restify');
var bunyan = require('bunyan')
// var restifyValidation = require('node-restify-validation');

var logger = require('../logger');
var routes = require('./routes');

var server = restify.createServer({
  name: require('../../package.json').name,
  log: logger.getLogger().child({component: "server"})
});

// Extend logger using the plugin.
server.use(restify.requestLogger({
  serializers: restify.bunyan.serializers
}));
server.use(function (req, res, next) {
  req.log.info({req: req}, 'REQUEST');
  next();
});
server.on('after', restify.auditLogger({
  log: server.log
}));
server.on('uncaughtException', function (req, res, route, err) {
  console.log("uncaughtException", err.stack)
  req.log.error({err: err}, "uncaughtException");
  //err._customContent = 'something is wrong!';
});

// server.use(restify.fullResponse())
server.use(restify.queryParser({ mapParams: false }));

routes.configure(server);

module.exports = server;
