"use strict"

var stream = require('stream')
var MultiStream = require('multistream')

var MemoryStream = require('memorystream')

class ArrayStream extends stream.Duplex {
  constructor(buffer){
    super({end: false})
    this.pointer = 0
    this.__buffer = buffer ? buffer.slice(0) : []
  }

  // write(chunk){
  //   return super.write(chunk)
  // }

  _write(chunk, enc, cb){

    console.log(`==>> written '${chunk}' to stream`)
    // console.log(this)
    console.log("push()ing.", this.pointer, this.__buffer.length)
    this.__buffer.push(chunk)
    if(this.pointer == this.__buffer.length){
      // this.push(chunk, enc, cb)
    }
    cb()
    this.read(0) // trigger 'readable' event
  }

  _read(size){
    var to_push = ''
    if(this.pointer >= this.__buffer.length){
      // nothing left in the stream, wait for more data
    }
    else {
      to_push = this.__buffer[this.pointer++]
    }
    console.log("_read() called, push: ", to_push.toString())
    this.push(to_push)
    if(to_push == ''){
      // console.trace("empty push")
    }
  }

  // creates a new readable stream of the data from the beginning
  createReadableStream(){
    return new ArrayStream(this.__buffer)
  }
}

var seq = 0
var STATES = ["INIT", "STORAGE_SENT", "PRODUCER_SENT", "DONE"].reduce(function(prev, curr){prev[curr] = curr;  return prev}, {})

class Stream {
  constructor(id){
    this.id = id || `stream-${seq++}`
    this.chunks = []
    this.metadata = null
    this.open = false
    this.size = 0

    // internal
    this._producers = []
    this._consumers = []

    // TODO: pluggable storages
    //this._storage = new MemoryStream()
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

    this._storage.on("finish", function(){
      console.log("producer finished")
      self.open = false
    })
  }

  /**
   * Returns a unified readable stream of stored and live (producer data) married
   * together correctly at this point in time. Can be called multiple times for multimple
   * consumers
   */
  createConsumerStream(){
    var consumer = this._storage.createReadableStream()
    return consumer

    // var self = this
    // var state = STATES.INIT
    // var factory = function(cb){
    //   // called every time we're ready for a new stream
    //   var nextState, nextStream

    //   switch(state){
    //   case STATES.INIT:
    //     // send our storage stream first
    //     nextState = STATES.STORAGE_SENT
    //     nextStream = self._storage
    //     break;
    //   case STATES.STORAGE_SENT:
    //     // send producer if we have it, otherwise advance to done
    //     var producer = self._producers[0]
    //     if(producer && self.open){
    //       // console.log(producer)

    //       nextState = STATES.PRODUCER_SENT
    //       nextStream = producer
    //     } else {
    //       nextState = STATES.DONE
    //       nextStream = null
    //     }
    //     break;
    //   case STATES.PRODUCER_SENT:
    //   case STATES.DONE:
    //     nextState = STATES.DONE
    //     nextStream = null
    //     break;
    //   default:
    //     console.log("ERROR STATE:", state)
    //     cb(new Error("unkown state: " + state))
    //   }

    //   console.log("open: ", self.open)
    //   console.log(`SM: ${state} -> ${nextState}`)

    //   state = nextState
    //   setTimeout(function(){
    //     cb(null, nextStream)
    //   }, 0)
    // }

    // return new MultiStream(factory)
    // // return this._storage
  }
}


module.exports = {
  Stream, ArrayStream
}
