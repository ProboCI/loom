'use strict';
var restify = require('restify');

var logger = require('../logger');
var routes = require('./routes');

class Server {

  constructor(config) {
    this.server = restify.createServer({
      name: require('../../package.json').name,
      log: logger.getLogger().child({component: 'server'}),
    });
    this.configure(config);
  }

  configure(config) {
    var server = this.server;
    // Extend logger using the plugin.
    server.use(restify.requestLogger({
      serializers: restify.bunyan.serializers,
    }));
    server.use(function(req, res, next) {
      req.log.info({req: req}, 'REQUEST');
      next();
    });
    this.log = this.server.log;
    this.listen = this.server.listen;
    this.close = this.server.close;
    server.on('after', restify.auditLogger({
      log: server.log,
    }));
    server.on('uncaughtException', function(req, res, route, err) {
      console.log('uncaughtException', err.stack);
      req.log.error({err: err}, 'uncaughtException');
    });

    // Let requests and responses take as long as they need
    server.use(function(req, res, next) {
      req.connection.setTimeout(0);
      res.connection.setTimeout(0);
      next();
    });

    server.use(restify.queryParser({mapParams: false}));

    routes.configure(server, config);

    server.use(restify.queryParser({mapParams: false}));
  }

}

module.exports = Server;
