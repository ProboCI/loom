'use strict';

import * as bunyan from 'bunyan';


const logger = bunyan.createLogger({
  name: require('../package.json').name,
  level: 'debug',
  src: true,
  serializers: bunyan.stdSerializers,
  streams: [
    {
      stream: process.stdout,
    },
  ],
});

export const getLogger = (component: string): bunyan => {
  if (component) {
    return logger.child({ component: component });
  }
  else {
    return logger;
  }
};
