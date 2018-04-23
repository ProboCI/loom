"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const restify = require("restify");
const logger_1 = require("../logger");
const routes_1 = require("./routes");
require("../../typings/TConfig");
class Server {
    constructor(config) {
        this.server = restify.createServer({
            name: require(process.env.PWD + "/package.json").name,
            log: logger_1.getLogger("").child({ component: "server" })
        });
        this.configure(config);
    }
    configure(config) {
        var server = this.server;
        server.use(restify.requestLogger({
            serializers: restify.bunyan.serializers
        }));
        server.use(function (req, res, next) {
            req.log.info({ req: req }, "REQUEST");
            next();
        });
        this.log = this.server.log;
        this.listen = this.server.listen;
        this.close = this.server.close;
        server.on("after", restify.auditLogger({
            log: server.log
        }));
        server.on("uncaughtException", function (req, res, route, err) {
            console.log("uncaughtException", err.stack);
            req.log.error({ err: err }, "uncaughtException");
        });
        server.use(function (req, res, next) {
            req.connection.setTimeout(0);
            res.connection.setTimeout(0);
            next();
        });
        server.use(restify.queryParser({ mapParams: false }));
        routes_1.configure(server, config);
        server.use(restify.queryParser({ mapParams: false }));
    }
}
exports.Server = Server;
//# sourceMappingURL=server.js.map