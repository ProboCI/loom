var bunyan, gelfStream, logger;

bunyan = require('bunyan');
gelfStream = require('gelf-stream');

logger = bunyan.createLogger({
  name: require('../package.json').name,
  level: 'debug',
  src: true,
  serializers: bunyan.stdSerializers,
  streams: [
    {
      stream: process.stdout
    }
  ]
});

// support for logging to graylog
if (process.env.GRAYLOG_HOST) {
  logger.info("logging to GrayLog2 %s:%s", process.env.GRAYLOG_HOST, process.env.GRAYLOG_PORT);
  logger.addStream({
    stream: gelfStream.forBunyan(process.env.GRAYLOG_HOST, process.env.GRAYLOG_PORT || 12201),
    type: 'raw',
    level: 'debug',
    closeOnExit: true
  });
} else {
  logger.warn("GRAYLOG_HOST not set, not logging to GrayLog2");
}

module.exports = {
  getLogger: function(component) {
    if(component) {
      return logger.child({component: component})
    }
    else {
      return logger;
    }
  }
};
