"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const passport = require("passport");
const Strategy = require("passport-http-bearer");
const BearerStrategy = Strategy.Strategy;
exports.Auth = function (config) {
    let authlib = {
        verify: function (token, done) {
            process.nextTick(function () {
                var user = {
                    token: token
                };
                const found = config.tokens.indexOf(token) > -1;
                if (!found) {
                    return done(null, false);
                }
                return done(null, user);
            });
        },
        auth: function (req, res, next) { }
    };
    passport.use(new BearerStrategy({ realm: "API Key" }, (token, done) => {
        return authlib.verify(token, done);
    }));
    var tokenAuth = passport.authenticate("bearer", {
        session: false,
        failWithError: true
    });
    authlib.auth = function (req, res, next) {
        if (Array.isArray(config.tokens)) {
            return tokenAuth(req, res, err => {
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
//# sourceMappingURL=auth.js.map