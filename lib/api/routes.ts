'use strict';

import { controllers } from './controllers/index';
import { Auth } from './auth';

type TConfig = {
  tokens: string[]
}

export const configure = (server: any, config: TConfig) => {
  const auth = Auth({
    tokens: config.tokens,
  }).auth;

  // inject server configuration into the controllers
  const conf = function(req, res, next) {
    req.loomConfig = config;
    next();
  };

  server.post('/stream/', auth, conf, controllers.streams.create);
  server.post('/stream/:id', auth, conf, controllers.streams.create);
  server.get('/stream/:id', auth, conf, controllers.streams.get);
  server.get('/spy', auth, conf, controllers.streams.spy);
};
