'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const bunyan = require("bunyan");
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
exports.getLogger = (component) => {
    if (component) {
        return logger.child({ component: component });
    }
    else {
        return logger;
    }
};
//# sourceMappingURL=logger.js.map