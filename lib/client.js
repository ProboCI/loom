var http = require('http')
var url = require('url')

/**
 * Create a client
 * @param {Object} config - Config object
 * @param {Object} config.url - url of server
 */
function createClient(config){
  config = config || {}
  if(!config.url){
    throw new Exception("url config required for client")
  }

  return {
    config: config,
    createWriteStream: function(metadata, opts){
      if(opts.id){
        opts.id = require('querystring').escape(opts.id)
      }

      var client = http.request({
        hostname: url.parse(config.url).hostname,
        port: url.parse(config.url).port,
        method: 'post',
        path: '/stream' + (opts.id ? `/${opts.id}` : '') + (opts.force ? '?force=true' : ''),
        headers: {
          connection: 'keep-alive',
          'x-stream-metadata': JSON.stringify(metadata)
        }
      }, function(res){
        res.pipe(process.stdout)
      })

      // disable connection timeout: let the output flow for as long as it wants
      client.setTimeout(0)

      client.on("error", function(err){
        console.error("socket closed: " + err.message)
      })

      // client.on("finish", function(){
      //   console.error("input finished")
      // })

      return client
    }
  }
}

module.exports = createClient
