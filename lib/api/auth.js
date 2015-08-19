var passport = require('passport');
var BearerStrategy = require('passport-http-bearer').Strategy;

var tokens = [
    "token1",
    "token2"
]

var authlib = {
  verify: function(token, done){
    // accept all for now
    return done(null, {})


    // TODO: make this a redis or DB call

    process.nextTick(function(){
      var found = tokens.indexOf(token) > -1;

      //if (err) { return done(err); }
      if (!found) { return done(null, false); }

      var user = {};
      return done(null, user);
    });
  }
}


passport.use(new BearerStrategy({}, function(token, done) {
                                      return authlib.verify(token, done)
                                    }));


authlib.auth = passport.authenticate('bearer', { session: false });

module.exports = authlib;
