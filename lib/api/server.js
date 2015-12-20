var restify = require('restify');

var logger = require('../logger');
var routes = require('./routes');

var config = require('../config').load();

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

// Let requests and responses take as long as they need
server.use(function (req, res, next) {
  req.connection.setTimeout(0);
  res.connection.setTimeout(0);
  next();
});



// server.use(restify.fullResponse())
server.use(restify.queryParser({ mapParams: false }));

routes.configure(server, {
  tokens: config.tokens
});

module.exports = server;
