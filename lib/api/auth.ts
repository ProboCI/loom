'use strict';

import * as passport from 'passport';
import * as Strategy from 'passport-http-bearer';

const BearerStrategy = Strategy;

type TConfig = {
  tokens: string[]
}

/**
 * Function that returns an auth lib object to use as route auth middleware
 * @param {Object} config - auth config
 * @param {Array} config.tokens - Used with Bearer strategy, list of
 *                                valid tokens. If this value is not
 *                                an array, authentication is disabled!
 * @return {Object} - auth lib with the '.auth' function to use
 *                    as the auth middleware with routes
 */
export const Auth = function(config: TConfig) {
  let authlib = {
    verify: function(token: string, done: (temp: any, param: boolean | { token: string }) => void) {
      process.nextTick(function() {
        var user = {
          token: token
        };

        const found = config.tokens.indexOf(token) > -1;

        if (!found) { return done(null, false); }
        return done(null, user);
      });
    },
    auth: function(req, res, next){}
  };

  passport.use('bearer', new BearerStrategy({realm: 'API Key'}, (token, done) => {
    return authlib.verify(token, done);
  }));

  var tokenAuth = passport.authenticate('bearer', {session: false, failWithError: true}, (req, res) => {

  });

  // auth middleware that only checks for token authentication if its configured
  authlib.auth = function(req, res, next) {
    if (Array.isArray(config.tokens)) {
      return tokenAuth(req, res, function(err) {
        // This callback is only called when `failWithError` is
        // set. We need a custom callback here to call `next()` so
        // that Restify can log the end of the request properly (and
        // all middleware continues to run).

        // AuthenticationError in the Bearer strategy plugin only sets
        // `err.status`, which is ignored by Restify. In order to pass
        // through the correct error code to the HTTP response, we
        // must set `err.statusCode` on the error otherwise it'll get
        // reset to 500 (even though the passport middleware already
        // set `res.statusCode` to 401 previously)
        if (err) {
          err.statusCode = err.status;
        }

        return next(err);
      });
    }
    else {
      next();
    }
  };

  return authlib;
};
