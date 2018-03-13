"use strict";

import { rethink } from "./lib/rethink";
import { Server } from "./lib/api/server";
import "./typings/TConfig";

export const run = (config: TConfig) => {
  var server = new Server(config);
  server.log.info({ config: config }, "Configuration loaded");

  // connect to the DB
  rethink.connect(config.db);

  server.listen(config.server.port, config.server.host, function() {
    server.log.info(
      "%s listening at %s",
      server.server.name,
      server.server.url
    );
  });
};
