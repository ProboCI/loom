'use strict';

var passport = require('passport');
var BearerStrategy = require('passport-http-bearer').Strategy;

module.exports = function(config){
  var authlib = {
    verify: function(token, done) {
      process.nextTick(function() {
        var found = config.tokens.indexOf(token) > -1;

        if (!found) { return done(null, false); }

        var user = {};
        return done(null, user);
      });
    },
  };


  passport.use(new BearerStrategy({}, function(token, done) {
    return authlib.verify(token, done);
  }));


  authlib.auth = passport.authenticate('bearer', {session: false});
  return authlib
};
