"use strict"
var events = require('events')
var seq = 0

class Storage extends events.EventEmitter {
  constructor(){
    super()
    this.id = `${this.constructor.name}-${seq++}`
  }

  /**
   * Handle incoming data here from .write()
   */
  write(chunk, enc, cb){
    throw new Error("Abstract method of a class. Must be implemented in subclasses")
  }

  /**
   * Handle outgoing data here from .read(). Return next chunk to read to
   * enqueue data for reader, and `null` to end the stream
   */
  read(size){
    throw new Error("Abstract method of a class. Must be implemented in subclasses")
  }

  /**
   * Call this to signify that there will be no more writes to this data source
   */
  end(){
    this.write(null)
  }
}

module.exports = Storage
