
# htracr

htracr is a packet sniffer and visualisation tool for HTTP. It does not give
you a score, grade, or hold your hand when you're crying because your site
is so damn slow, but it will give you unparalleled insight into what's 
actually happening on the wire between your browser and the Web.


## Installing htracr

First you'll need [Node](http://nodejs.org/) and its package manager, 
[npm](http://npmjs.org/). You'll also need a modern Web browser 
(known to work: Safari 5, FireFox 4, and Chrome).

Then, htracr can be installed with npm like this:

  > sudo npm -g install htracr

which will install dependencies automatically. 

See 'Installation Problems?' below if you have any issues getting htracr
onto your system.

Under the covers, htracr relies upon
 [node_pcap](https://github.com/mranney/node_pcap/), 
 [Raphael](http://raphaeljs.com/), [JQuery](http://jquery.com/), 
 [optimist](https://github.com/substack/node-optimist), and 
 [formidable](https://github.com/felixge/node-formidable).


## Using htracr

htracr is designed for use on the same machine your web browser or other 
client runs on; while it's possible to run it on a server, it'll be difficult
to make sense of all of the traffic coming to a normal server.

To use htracr, start it up like this:

  > htracr [listen-port]

where _listen_port_ is the port you'd like htracr to be available on. Then,
point your browser at it; e.g.:

  > htracr 8000

means you should point at:

  > http://localhost:8000/

On some operating systems, you may need to specify the interface to listen
on. For example:

  > htracr 8000 eth0
  
and in some cases, you may need permission to listen to the device, making 
the appropriate command line something like:

  > sudo htracr 8000 eth0

Then, press 'start' to start capturing HTTP traffic, and 'stop' to show it.
Currently, htracr only captures traffic on port 80.

The slider will adjust the time scale. You can use the keyboard arrows 
to navigate between packets and HTTP messages.


## Installation Problems?

### libpcap

If npm complains about problems with pcap, like this:

    npm ERR! Failed at the pcap@0.2.7 install script.

it usually means that it couldn't find libpcap when building. See the
instructions here: <https://github.com/mranney/node_pcap>. 

On my OSX machine, I have to build like this (becoming root first):

  > CXXFLAGS=-I/opt/local/include npm -g install htracr
  
because my pcap headers are in a non-standard place (thanks to MacPorts). 
YMMV.

### npm

Older versions of npm interact strangely with optimist and htracr. If you
have other issues installing npm, try upgrading npm, then re-installing 
htracr.


## Contact

Mark Nottingham <mnot@mnot.net>

http://github.com/mnot/htracr/


## Obligatory Screenshot

![htracr screenshot](https://mnot.github.io/htracr/htracr.png)

