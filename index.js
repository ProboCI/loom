var server = require('./lib/api/server');
var config = require('./lib/config');

server.log.info({config: config}, "Configuration loaded");

// connect to the DB
var rethink = require('./lib/rethink')
rethink.connect(config.db).ready.then(function(){
  server.log.info("RethinkDB connection initialized")

  server.listen(config.server.port, config.server.host, function() {
    server.log.info('%s listening at %s', server.name, server.url);
  });

}).catch(function(err){
  server.log.error({err: err}, "RethinkDB connection failed")
})
