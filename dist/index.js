"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const knex_1 = require("./lib/knex");
const server_1 = require("./lib/api/server");
require("./typings/TConfig");
exports.run = (config) => {
    var server = new server_1.Server(config);
    server.log.info({ config: config }, "Configuration loaded");
    knex_1.Database.knex.select('id').from('meta').limit(1);
    server.listen(config.server.port, config.server.host, function () {
        server.log.info("%s listening at %s", server.server.name, server.server.url);
    });
};
//# sourceMappingURL=index.js.map