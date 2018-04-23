"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./controllers/index");
const auth_1 = require("./auth");
require("../../typings/TConfig");
exports.configure = (server, config) => {
    const auth = auth_1.Auth({
        tokens: config.tokens
    }).auth;
    const conf = function (req, res, next) {
        req.loomConfig = config;
        next();
    };
    server.post("/stream/", auth, conf, index_1.controllers.streams.create);
    server.post("/stream/:id", auth, conf, index_1.controllers.streams.create);
    server.get("/stream/:id", auth, conf, index_1.controllers.streams.get);
    server.get("/spy", auth, conf, index_1.controllers.streams.spy);
};
//# sourceMappingURL=routes.js.map