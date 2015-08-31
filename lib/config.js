var config = {
  server: {
    host: process.env.HOST || 'localhost',
    port: process.env.PORT || 3060
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 28015,
    db: process.env.DB_NAME || "logs",
    logs_table: process.env.DB_LOGS_TABLE || "logs",
    meta_table: process.env.DB_META_TABLE || "meta"
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
