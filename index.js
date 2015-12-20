module.exports.run = function run(config){
  var server = require('./lib/api/server');

  server.log.info({config: config}, "Configuration loaded");

  // connect to the DB
  var rethink = require('./lib/rethink')
  rethink.connect(config.db)

  server.listen(config.server.port, config.server.host, function() {
    server.log.info('%s listening at %s', server.name, server.url);
  });
}
