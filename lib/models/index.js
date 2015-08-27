"use strict"
var stream = require('stream')
var seq = 0

class Storage extends stream.Duplex {
  constructor(){
    super()
    this.id = `-${seq++}`
  }

  /**
   * Handle incoming data here from .write()
   */
  writeChunk(chunk, enc, cb){
    throw new Error("Abstract method of a class. Must be implemented in subclasses")
  }

  /**
   * Handle outgoing data here from .read(). Return next chunk to read to
   * enqueue data for reader, and `null` to end the stream
   */
  readChunk(size){
    throw new Error("Abstract method of a class. Must be implemented in subclasses")
  }

  // creates a new readable stream of the data from the beginning
  createReadableStream(){
    throw new Error("Abstract method of a class. Must be implemented in subclasses")
  }


  // Internal methods, should not need to be overriden

  _write(chunk, enc, cb){
    this.writeChunk(chunk, enc, cb)
    this.read(0)
  }

  _read(size){
    var chunk = this.readChunk(size)
    this.push(chunk)
  }

  end(){
    super.end()
    this.read(0) // trigger 'readable' again to drain writable stream and emit 'end' event on readable
  }
}

class ArrayStreamStorage extends Storage {
  constructor(buffer){
    super()
    this.pointer = 0
    this._array_buffer = buffer || []
  }

  writeChunk(chunk, enc, cb){
    // console.log("chunk written", this.id, chunk.toString())

    this._array_buffer.push(chunk)
    cb()

    // console.log("write buffer:", this.id, this.getBuffer())
  }

  readChunk(size){
    if(this.pointer >= this._array_buffer.length){
      // nothing left in the array, wait for more data
      // but if the writer is also finished, then close the readable stream
      return this._writableState.finished ? null : ''
      // console.log("read(): finished:", this._writableState.finished)
    }
    else {
      return this._array_buffer[this.pointer++]
      // console.log("read():", this._array_buffer[this.pointer-1].toString(), "finished:", this._writableState.finished)
    }
  }

  // creates a new readable stream of the data from the beginning
  createReadableStream(){
    return new ArrayStreamStorage(this.getBuffer())
  }

  getBuffer() {
    return this._array_buffer
  }
}




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
