# Microservice: Loom

The "loom" server allows for streaming in arbitrary data streams from `producers` (assumed to be stdout/stderr from applications), and attaching arbitrary metadata to them. The streams are persisted live and can be read by `consumers` either in real-time or after input is complete. This project was created to compliment the [ProboCI](http://probo.ci) stack but is no way Probo specific nor directly integrated with Probo.

Binary as well as text content is supported automatically.

Note: The codebase uses generators, so it requires node.js 4.x+ or io.js (or node 0.11.x+ with the --harmony-generators flag). The Docker microservices uses Node 12.

## Authentication

Token-based authentication can be enabled for the APIs. To enable it, add at least one token in the config file

```yaml
tokens:
  - token1
  - token2
```

To authenticate API calls use a bearer-token authentication header: `Authentication: Bearer token1`

```
curl -H "Authorization: Bearer token1" http://localhost:3060/stream/test
```

## Producers

Create a new stream with metadata by initiating a `POST` request to the server. Any metadata must be encoded in JSON in the `X-Stream-Metadata` header

### Request

```
POST /stream
X-Stream-Metadata: { ... arbitrary JSON metadata here ... }
... incoming data ...
```

### Response

```
201 HTTP Created
X-Stream-Id: generated-stream-id
```

The response headers will be sent immediately once the stream is configured on the backend, and the producer can continue pumping data into the connection, closing the stream when all data is written. There is no body in the response.

### Example
Here's a curl example for uploading the contents of a file called `file.txt` into a stream:

```
curl -i -X POST  -H x-stream-metadata:"{\"meta\": true}" http://localhost:3060/stream/ --data-binary @file.txt
```

### CLI tool

Curl and other command line tools support non-buffered output, but wait for input to end before uploading content. In order to stream arbitrary input data to the server in real time, a CLI tool called `stream` is included. You can use it like so:

```
for i in {1..5}; do echo $i; sleep 1; done | ./bin/stream http://localhost:3060 streamid
```

Usage:
```
stream server_domain streamid [--force]
```


### Specifying a Stream ID

It's possible for a producer to specify a stream id to use instead of the server generating one. The `id` is specified in the URL, similarly to a `GET` request:

```
POST /stream/:id
X-Stream-Metadata: { ... arbitrary JSON metadata here ... }

... incoming data ...
```

If a stream with that `id` does not yet exist, everything proceeds as normal, with a `201` HTTP response.

However, if that `id` is already taken the server will return a `409 Conflict` error

```
409 Conflict

{
  error: "The stream with ID XXXXX already exists. Specify force=true query param to override."
}
```

If the desired behavior is to override the existing stream, use  the `force=true` query parameter. The server will silently overwrite (or discard) the original stream.

```
POST /stream/:id?force=true
X-Stream-Metadata: { ... arbitrary JSON metadata here ... }

... incoming data ...
```

## Consumers

Consumers that know a stream ID can make request to read it back out. If the full stream is stored on the server, the response will be send and the HTTP request closed. If the producer is still contributing data to the stream, anything already sent by the producer will be sent first, and the consumer stream will remain open and updated with new producer data as it comes in until the producer finishes.

### Request
```
GET /stream/:id

... streamed data here ...
```

### Response

If the server already has the full stream buffered, a content-length header will be sent (this is a TODO). Otherwise, since the size of the stream is not known, no content-length header will be present and sets `Transfer-Encoding` header to `chunked`.

The metadata will be returned as JSON in the `X-Stream-Metadata' header.

```
200 HTTP Ok
Content-Type: application/octet-stream
X-Stream-Metadata: { ... arbitrary JSON metadata here ... }
Conent-Length: XXXX

... streamed data here ...
```

In case the stream with the specified ID doesn't exist, a 404 response will be sent.

```
404 Not Found

{
  error: "The stream with ID XXXXX does not exist"
}
```

Curl example:

```
curl --no-buffer http://localhost:3060/stream/:id
```

### Only get current content

It's possible to only request the current content of the steam for active streams. This may be useful if the client is an AJAX call and cannot stream data or wait arbitrarily long for the stream to end. To do this, use the `notail` URL parameter in the GET request:

```
curl http://localhost:3060/stream/:id?notail
```

## All seeing eye

The streamer also comes with a helpful `/spy` endpoint that multiplexes all active and new streams.

```
curl --no-buffer localhost:3060/spy
```

If you're calling this from a terminal, you can enable color-coding that renders each stream in a separate color for easy visual identification:

```
curl --no-buffer localhost:3060/spy?color
```
