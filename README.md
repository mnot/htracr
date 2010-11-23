
# htracr

An HTTP packet sniffer + visualisation tool

## Installation

To install htracr, you'll need:

- Node.JS <http://nodejs.org/>
- node_pcap <https://github.com/mranney/node_pcap/>
- A Web browser


## Using htracr

htracer is designed for use on the same machine your web browser or other 
client runs on; while it's possible to run it on a server, it'll be difficult
to make sense of all of the traffic coming to a normal server.

To use htracr, start it up like this:

  > ./htracr.js [listen-port]

where _listen_port_ is the port you'd like htracr to be available on. Then,
point your browser at it; e.g.,:

  > ./htracr.js 8000

means you should point at:

  > http://localhost:8000/

Then, press 'start' to start capturing HTTP traffic, and 'stop' to show it.
Currently, htracr only captures traffic on port 80.

## TODO

### TCP visualisation

- Colour packets based on type (syn, ack, etc.)
- Hover / click on connection for statistics
- tcp retransmit / congestion
- window scaling?
- bytes in flight?

### HTTP visualisation

- Highlight requests that are split across packets
- Highlight pipelining
- show compression
- content types?
- timings
- connection: close
- conditional requests
- click on response to open window with it
- click on request to re-make request

### Bugs / Misc.

- proper display of packet / http body content
- proper zoom control
- layering, ability to turn on / off
- show hostname instead of IP
- make server identity visible even when scrolled / zoomed
- configurable sniff port(s)
- need HTTP status phrase
- dump / load pcap sessions
- keyboard controls
- allow removing connections / servers
- missing requests in firefox
- msg loses resizable after running
- printing
- show all?
- summary stats
- DNS