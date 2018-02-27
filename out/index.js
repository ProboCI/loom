'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const rethink_1 = require("./lib/rethink");
const server_1 = require("./lib/api/server");
exports.run = (config) => {
    var server = new server_1.Server(config);
    server.log.info({ config: config }, 'Configuration loaded');
    rethink_1.rethink.connect(config.db);
    server.listen(config.server.port, config.server.host, function () {
        server.log.info('%s listening at %s', server.server.name, server.server.url);
    });
};
//# sourceMappingURL=index.js.map