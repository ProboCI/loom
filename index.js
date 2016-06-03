'use strict';
var rethink = require('./lib/rethink');
var Server = require('./lib/api/server');

module.exports.run = function run(config) {

  var server = new Server(config);
  server.log.info({config: config}, 'Configuration loaded');

  // connect to the DB
  rethink.connect(config.db);

  server.listen(config.server.port, config.server.host, function() {
    server.log.info('%s listening at %s', server.server.name, server.server.url);
  });
};
