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

module.exports = Storage
