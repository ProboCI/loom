"use strict"

var stream = require('stream')
var MultiStream = require('multistream')

var seq = 0

class AbstractStream extends stream.Duplex {
  constructor(id){
    if (constructor === AbstractStream) {
      throw new Error("Can't instantiate abstract class " + this.constructor.name)
    }

    super({
      allowHalfOpen: true
    })

    this.id = id || `stream-${seq++}`
    this.chunks = []
    this.metadata = null
    this.open = true
    this.size = 0

    // internal
    this._producers = []
    this._consumers = []
  }

  /**
   * currently only one producer is supported
   */
  addProducerStream(producer){
    var self = this

    if(this._producers.length){
      throw new Error("Only one producer per stream is supported")
    }
    this._producers.push(producer)
    producer.pipe(this)

    this.on("finish", function(){
      self.open = false
    })
  }

  _write(chunk, encoding, callback){
    this.size += Buffer.byteLength(chunk)
    // callback(new Error("Not Implemented"))
  }

  _read(){
    // throw new Error("Not Implemented")
  }
}

var MS = require('memorystream')
class MemoryStream extends AbstractStream {
  constructor(id){
    super(id)

    this._storage = new MS()
  }

  _write(chunk, encoding, callback){
    super._write(chunk, encoding, callback)
    return this._storage.write(chunk, encoding, callback)
  }

  _read(size){
    super._read(size)
    return this._storage.read(size)
  }
}

module.exports = {
  AbstractStream,
  MemoryStream
}
