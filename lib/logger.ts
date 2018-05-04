"use strict";

import * as bunyan from "bunyan";

export const getLogger = (component: string): bunyan => {
  const logLevel = process.env.NODE_ENV == "test" ? bunyan.FATAL + 1 : "debug";
  const logger = bunyan.createLogger({
    name: require(process.env.PWD + "/package.json").name,
    level: logLevel,
    src: true,
    serializers: bunyan.stdSerializers,
    streams: [
      {
        stream: process.stdout
      }
    ]
  });

  if (component) {
    return logger.child({ component: component });
  } else {
    return logger;
  }
};
