"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bunyan = require("bunyan");
exports.getLogger = (component) => {
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
    }
    else {
        return logger;
    }
};
//# sourceMappingURL=logger.js.map