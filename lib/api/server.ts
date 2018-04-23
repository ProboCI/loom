"use strict";
import * as restify from "restify";
import { getLogger } from "../logger";
import { configure } from "./routes";
import "../../typings/TConfig";

export class Server {
  public server: restify.Server;
  public log: any;
  public listen: any;
  public close: any;

  constructor(config: TConfig) {
    this.server = restify.createServer({
      name: require(process.env.PWD + "/package.json").name,
      log: getLogger("").child({ component: "server" })
    });
    this.configure(config);
  }

  configure(config) {
    var server = this.server;
    // Extend logger using the plugin.
    server.use(
      restify.requestLogger({
        serializers: restify.bunyan.serializers
      })
    );
    server.use(function(req, res, next) {
      req.log.info({ req: req }, "REQUEST");
      next();
    });
    this.log = this.server.log;
    this.listen = this.server.listen;
    this.close = this.server.close;
    server.on(
      "after",
      restify.auditLogger({
        log: server.log
      })
    );
    server.on("uncaughtException", function(req, res, route, err) {
      console.log("uncaughtException", err.stack);
      req.log.error({ err: err }, "uncaughtException");
    });

    // Let requests and responses take as long as they need
    server.use(function(req, res, next) {
      req.connection.setTimeout(0);
      res.connection.setTimeout(0);
      next();
    });

    server.use(restify.queryParser({ mapParams: false }));

    configure(server, config);

    server.use(restify.queryParser({ mapParams: false }));
  }
}
