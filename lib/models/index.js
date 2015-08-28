"use strict"
var stream = require('stream')

var Storage = require('./storage')
var ArrayStreamStorage = require('./array_stream_storage')

var seq = 0
class Stream {
  constructor(id){
    this.id = id || `stream-${seq++}`
    this.chunks = []
    this.metadata = null
    this.open = true
    this.size = 0

    // internal
    this._producers = []
    this._consumers = []

    // TODO: pluggable storages
    this._storage = new ArrayStreamStorage()
  }

  /**
   * currently only one producer is supported
   */
  setProducerStream(producer){
    var self = this
    this.open = true

    if(this._producers.length){
      throw new Error("Only one producer per stream is supported")
    }
    this._producers.push(producer)

    // start piping producer to storage
    producer.pipe(this._storage)

    producer.on("finish", function(){
      // console.log("producer finished, ending all consumers")
      self.open = false

      // tell all existing consumers that the producer is done
      self._consumers.forEach(function(consumer){
        consumer.end()
        // console.log("consumer buffer:", consumer.id, consumer.getBuffer())
      })
    })
  }

  /**
   * Can be called multiple times for multiple consumers
   */
  createConsumerStream(){
    var consumer = this._storage.createReadableStream()
    this._consumers.push(consumer)

    // if the producer is finished already, tell this consumer about it too
    if(!this.open){
      consumer.end()
    }

    return consumer
  }
}


module.exports = {
  Stream, ArrayStreamStorage
}
