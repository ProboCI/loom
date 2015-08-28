"use strict"

var Storage = require('./storage')

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

module.exports = ArrayStreamStorage
