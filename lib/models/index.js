"use strict"
var stream = require('stream')

class ArrayStream extends stream.Duplex {
  constructor(buffer){
    super()
    this.pointer = 0
    this._array_buffer = buffer || []
    this.id = `ArrayStream-${seq++}`
  }

  _write(chunk, enc, cb){
    // console.log("chunk written", this.id, chunk.toString())

    this._array_buffer.push(chunk)
    cb()
    this.read(0) // trigger 'readable' event

    // console.log("write buffer:", this.id, this.getBuffer())
  }

  end(){
    super.end()
    this.read(0) // trigger 'readable' again to drain writable stream and emit 'end' event on readable
  }

  _read(size){
    if(this.pointer >= this._array_buffer.length){
      // nothing left in the array, wait for more data
      // but if the writer is also finished, then close the readable stream
      this.push(this._writableState.finished ? null : '')
      // console.log("read(): finished:", this._writableState.finished)
    }
    else {
      this.push(this._array_buffer[this.pointer++])
      // console.log("read():", this._array_buffer[this.pointer-1].toString(), "finished:", this._writableState.finished)
    }
  }

  getBuffer() {
    return this._array_buffer
  }

  // creates a new readable stream of the data from the beginning
  createReadableStream(){
    return new ArrayStream(this.getBuffer())
  }
}

var seq = 0
var STATES = ["INIT", "STORAGE_SENT", "PRODUCER_SENT", "DONE"].reduce(function(prev, curr){prev[curr] = curr;  return prev}, {})

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
    this._storage = new ArrayStream()
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
  Stream, ArrayStream
}
