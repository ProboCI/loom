var server = require('./lib/api/server');
var config = require('./lib/config');

server.listen(config.server.port, config.server.host, function() {
  server.log.info('%s listening at %s', server.name, server.url);
});

// wire up event stream handling
server.log.info({config: config}, "Configuration loaded");
