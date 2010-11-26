
# htracr

htracr is a packet sniffer and visualisation tool for HTTP. It does not give
you a score, grade, or hold your hand when you're crying because your site
is so damn slow, but it will give you unparalleled insight into what's 
actually happening on the wire between your browser and the Web.

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
point your browser at it; e.g.:

  > ./htracr.js 8000

means you should point at:

  > http://localhost:8000/

Then, press 'start' to start capturing HTTP traffic, and 'stop' to show it.
Currently, htracr only captures traffic on port 80.

The slider will adjust the time scale.

## Contact

Mark Nottingham <mnot@mnot.net>

http://github.com/mnot/htracr/


## Obligatory Screenshot

![htracr screenshot](http://mnot.github.com/htracr/htracr.png)


## TODO

### TCP visualisation

- Make connection states visible:
  - handshaking
  - connected
  - half-connected
  - idle
  - disconnecting
  - buffer-full?
- per-connection stats:
  - total packets (graph of types?)
  - congestion window (over time?)
  - receive window (over time?)
  - rtt over time?
- handle tcp-retransmit / tcp-reset
- show ack relationships?

### HTTP visualisation

- Highlight message headers that are split across packets
- Highlight pipelining
- message stats
  - message delay
  - number of round trips
- click on response to open window with it
- click on request to re-make request
- server stall time (based upon rtt / packet sizes / psh)
- content types - message colours?

### Misc. Features

- configurable sniff port(s)
- printing
- trace DNS
- per-server stats
- allow removing connections / servers
- keyboard controls
- dump / load pcap sessions
- magnifier, because packets get lost between the pixels

### Bugs

- needs one mother of a refactoring
- header names are case-sensitive here
- prettify packet display
- need HTTP status phrase
- some requests not drawn in firefox 3
- connection: close on requests - do we get a http-res-end?
- pipelining
- improve RTT calculation
- keep centre on zoom