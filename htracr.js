#!/usr/bin/env node

var util = require("util")
var node_http = require('http')
var node_url = require('url')
var pcap = require("pcap")
var server = require("./server")
var argv = require('./lib/optimist').argv


var htracr = {
  conns: {},
  pcap_session: undefined,

  start_capture: function() {
    var self = this
    var f = "tcp port 80"
    var b = 10
    self.pcap_session = pcap.createSession('', f, (b * 1024 * 1024))
    this.setup_listeners()
    console.log("Sniffing on " + self.pcap_session.device_name)
    
    // Check for pcap dropped packets on an interval
    setInterval(function () {
      var stats = self.pcap_session.stats()
      if (stats.ps_drop > 0) {
        console.log(
          "dropped packets, need larger buffer or less work to do: " 
          + util.inspect(stats)
        )
      }
    }, 2000)
  },
  
  stop_capture: function () {
    var self = this
    this.pcap_session.close()
    this.pcap_session = undefined
    console.log("Stopped sniffing.")
  },

  setup_listeners: function () {
    var self = this
    var tcp_tracker = new pcap.TCP_tracker()

    // listen for packets, decode them, and feed TCP to the tracker
    self.pcap_session.on('packet', function (raw_packet) {
      var packet = pcap.decode.packet(raw_packet)
      self.note_packet(packet)
      tcp_tracker.track_packet(packet)
    })

    tcp_tracker.on("start", function (session) {
      self.note_session(session, 'tcp-start')
    })

    tcp_tracker.on("retransmit", function (session, direction, seqno) {
      self.note_session(session, 'tcp-retransmit', 
        {'direction': direction, 'seqno': seqno}
      )
    })

    tcp_tracker.on("end", function (session) {
      self.note_session(session, 'tcp-end')
    })

    tcp_tracker.on("reset", function (session) {
      // Right now, it's only from dst.
      self.note_session(session, 'tcp-reset')
    })

    tcp_tracker.on("syn retry", function (session) {
      self.note_session(session, 'tcp-retry')
    })

    tcp_tracker.on('http error', function (session, direction, error) {
      console.log(" HTTP parser error: " + error)
      // TODO - probably need to force this transaction to be over at this point
    })

    tcp_tracker.on('http request', function (session, http) {
      self.note_session(session, 'http-req-start', http.request)
    })

    tcp_tracker.on('http request body', function (session, http, data) {
      self.note_session(session, 'http-req-data', {'http': http, 'data': data.length})
    })

    tcp_tracker.on('http request complete', function (session, http) {
      self.note_session(session, 'http-req-end', http)
    })

    tcp_tracker.on('http response', function (session, http) {
      self.note_session(session, 'http-res-start', http.response)
    })

    tcp_tracker.on('http response body', function (session, http, data) {
      self.note_session(session, 'http-res-data', data.length)
    })

    tcp_tracker.on('http response complete', function (session, http) {
      self.note_session(session, 'http-res-end', http)
    })

  },

  note_session: function (session, what, details) {
    if (session.dst.split(":")[1] == 80) {
      var server = session.dst
      var local_port = session.src.split(":")[1]
    } else {
      var server = session.src
      var local_port = session.dst.split(":")[1]
    }
    this.note(server, local_port, session.current_cap_time, what, details)
  },

  note_packet: function (packet) {
    var detail = ''
    if (packet.link.ip.tcp.dport == 80) {
      var server = packet.link.ip.daddr + ":" + packet.link.ip.tcp.dport
      var local_port = packet.link.ip.tcp.sport
      what = "packet-out"
    } else {
      var server = packet.link.ip.saddr + ":" + packet.link.ip.tcp.sport
      var local_port = packet.link.ip.tcp.dport
      what = "packet-in"
    }
    if (packet.link.ip.tcp.data) {
      detail = {
        data: packet.link.ip.tcp.data.toString('utf8'),
        ws: packet.link.ip.tcp.window_size,
        flags: packet.link.ip.tcp.flags,        
      }
    }
    this.note(server, local_port, packet.pcap_header.time_ms, what, detail)
  },

  note: function (server, local_port, time, what, details) {
    if (this.conns[server] == undefined) {
      this.conns[server] = {}
    }
    var server_conn = this.conns[server]
    if (server_conn[local_port] == undefined)
      server_conn[local_port] = []
    server_conn[local_port].push({
      'what': what,
      'time': time,
      'details': details,
    })
  },
  
}






// port to listen to 
var port = parseInt(argv._[0])
if (! port || port == NaN) {
  console.log("Usage: test-browser.js listen-port [state-file]")
  process.exit(1)
}

server.start(port, htracr)
