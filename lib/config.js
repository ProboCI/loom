var config = {
  server: {
    host: process.env.HOST || 'localhost',
    port: process.env.PORT || 3000
  }
}

// process generated or derived config
for(var sec in config){
  for(var param in config[sec]){
    if(typeof config[sec][param] == "function"){
      config[sec][param] = config[sec][param].call(config);
    }
  }
}

function truthy(val){
  return ["true", "t", "yes", "y", "1"].indexOf((""+val).toLowerCase()) >=0
}


module.exports = config;
