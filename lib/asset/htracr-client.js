/*jslint white: true, browser: true, devel: true, evil: true, undef: true, nomen: true, eqeqeq: true, plusplus: true, bitwise: true, regexp: true, newcap: true, immed: true, indent: 2 */
/*global Raphael: true, jQuery: false, window: true, ActiveXObject: false */

if (! window.console) {
  window.console = {
    log: function (msg) {}
  };
}

var default_pix_per_sec = 500;
var htracr;



Raphael.fn.line = function (s, e) {
  if (! s[0] || ! s[1] || ! e[0] || ! e[1]) {
    // dummy
    console.log("Can't draw line: " + s + " to " + e);
    return this.circle(0, 0, 0);
  }
  return this.path(
      "M" + s[0] + "," + s[1] + " " +
      "L" + e[0] + "," + e[1]
  );
};

Raphael.fn.curve = function (s, e) {
  if (! s[0] || ! s[1] || ! e[0] || ! e[1]) {
    // dummy
    return this.circle(0, 0, 0);
  }
  var s_ctrl = [s[0], s[1]];
  var e_ctrl = [s[0], s[1]];

  if (s[1] == e[1]) {
    s_ctrl[1] = s[1] - 30;
    e_ctrl[1] = s[1] - 30;
  } else {
    s_ctrl[1] -= ((s[1] - e[1]) / 4);
    e_ctrl[1] -= ((s[1] - e[1]) / 5);
  }
  var path = "M" + s[0] + "," + s[1] + " " +
             "C" + s_ctrl[0] + "," + s_ctrl[1] + " " +
                   e_ctrl[0] + "," + e_ctrl[1] + " " +
                   e[0] + "," + e[1];
  return this.path(path);
};



htracr = {
  w: 550,
  h: 400,
  server_padding: 48, // padding between servers
  conn_pad: 36, // padding between connections
  conn_w: 12,  // how wide the connection is
  http_w: 8,  // how wide http request and response messages are
  label_w: 600,
  margin: [100, 20, 50, 20],

  paper: new Raphael(document.getElementById("paper"), this.w, this.h),
  labels: new Raphael(document.getElementById("labels"), this.label_w, this.h),
  msg: jQuery("#msg"),
  conns: [], // raw data about the connections
  ele: [], // elements representing the connections
  urls: {},
  refs: {},
  ref_elements: [],
  show_ref_elements: true,
  locs: {},
  loc_elements: [],
  show_loc_elements: true,
  server_labels: [],
  server_names: {},
  first: undefined,
  last: undefined,
  logo: undefined,
  pix_per_sec: default_pix_per_sec,  // pixels per second
  cursor_loc: undefined, // offset into elements structure
  inspected_element: undefined, // the element currently highlit

  clear: function () {
    var self = this;
    self.conns = [];
    self.ele = [];
    self.first = undefined;
    self.last = undefined;
    self.server_labels = [];
    self.urls = {};
    self.refs = {};
    self.ref_elements = [];
    self.loc_elements = [];
    self.cursor_loc = undefined;
    self.msg.html("");
    self.render();
    console.log('cleared.');
  },

  start_capture: function () {
    var self = this;
    console.log('starting capture...');
    self.clear();
    var req = self.get_req();
    req.onreadystatechange = function () {
      if (req.readyState === 4) {
        if (req.status == 200) {
          console.log('started.');
          jQuery("#start").hide();
          jQuery("#stop").show();
          self.pulse_logo();          
        } else {
          var error = eval("(" + req.responseText + ")");
          alert("Sorry, I can't start the sniffer; it says \"" + error.message + "\".");
          console.log("start problem: " + error);
        }
      }
    };
    req.open("POST", "/start", true);
    req.send("");
    return false;
  },

  stop_capture: function () {
    var self = this;
    console.log('stopping capture...');
    var req = self.get_req();
    req.onreadystatechange = function () {
      if (req.readyState === 4) {
        self.update_state();
        console.log('stopped.');
        jQuery("#stop").hide();
        jQuery("#start").show();
        self.unpulse_logo(true);
      }
    };
    req.open("POST", "/stop", true);
    req.send("");
    return false;
  },

  update_state: function () {
    var self = this;
    console.log('updating...');
    var req = self.get_req();
    req.onreadystatechange = function () {
      if (req.readyState === 4) {
        if (req.status === 200) {
          // FIXME: proper json parse, please!
          var server_conns = eval("(" + req.responseText + ")");
          if (server_conns.error) {
            alert(server_conns.error.message);
          }
          self.process_conns(server_conns);
          self.render();
          console.log('updated.');
        }
      }
    };
    req.open("GET", "/conns", true);
    req.send("");
    return false;
  },

  clear_state: function () {
    var self = this;
    console.log('clearing...');
    var req = self.get_req();
    req.onreadystatechange = function () {
      if (req.readyState === 4) {
        self.clear();
      }
    };
    req.open("POST", "/clear", true);
    req.send("");
    return false;
  },

  get_servers: function () {
    var self = this;
    console.log('getting servers...');
    var req = self.get_req();
    req.onreadystatechange = function () {
      if (req.readyState === 4) {
        // FIXME: proper json parse, please!
        self.server_names =  eval("(" + req.responseText + ")");
      }
    };
    req.open("GET", "/servers", false);
    req.send("");
  },

  get_req: function () {
    var self = this;
    var req;
    if (window.XMLHttpRequest) {
      try {
        req = new XMLHttpRequest();
      } catch (e1) {
        req = false;
      }
    } else if (window.ActiveXObject) {
      try {
        req = new ActiveXObject("Microsoft.XMLHTTP");
      } catch (e2) {
        req = false;
      }
    }
    return req;
  },

  resize: function () {
    var self = this;
    console.log("resizing to " + self.w + " x " + self.h);
    self.paper.setSize(self.w, self.h);
    self.labels.setSize(self.label_w, self.h);
  },

  zoom: function (val) {
    var self = this;
    console.log("zooming to " + val + "...");
    self.pix_per_sec = val;
    self.render();
  },

  // render all of our various data.
  render: function () {
    var self = this;
    self.paper.clear();
    self.labels.clear();
    self.draw_logo();

    self.w = ((self.last - self.first) / 1000 * self.pix_per_sec) +
             self.margin[1] + self.margin[3];
//    self.h = Math.max(y + self.margin[2], self.h);

    self.resize();

    self.draw_scale();

    for (var ref in self.refs) {
      if (self.urls[ref]) {
        self.refs[ref].forEach(function (r) {
          var s = [self.time_x(self.urls[ref][0]), self.urls[ref][1]];
          var e = [self.time_x(r[0]), r[1]];
          var ref_e = self.paper.curve(s, e).attr({
            "stroke": "#ccf",
            "stroke-width": "1",
            "opacity": "0.3",
            "shape-rendering": "optimizeSpeed"
          });
          if (! self.show_ref_elements) {
            ref_e.hide();
          }
          self.ref_elements.push(ref_e);
        });
      }
    }

    self.conns.forEach(function (c) {
      self.draw_conn(c);
      c.packets.forEach(function (p) {
        self.draw_packet(p, c.y);
      });
      c.http_reqs.forEach(function (msg) {
        self.draw_http_message(c, msg, c.y);
      });

      c.http_ress.forEach(function (msg) {
        self.draw_http_message(c, msg, c.y);
      });
    });

    for (var loc in self.locs) {
      if (self.urls[loc]) {
        var s = [self.time_x(self.urls[loc][0]), self.urls[loc][1]];
        var e = [self.time_x(self.locs[loc][0]), self.locs[loc][1]];
        var loc_e = self.paper.curve(s, e).attr({
          "stroke": "#9c9",
          "stroke-width": "3",
          "opacity": "0.8"
        });
        if (! self.show_loc_elements) {
          loc_e.hide();
        }
        self.loc_elements.push(loc_e);
      }
    }

    self.server_labels.forEach(function (label) {
      self.draw_server_label(label);
    });
  },

  // return an adjusted y value for the given message type (req or res)
  http_msg_y: function (y, msg_type) {
    var self = this;
    return msg_type === 'req' ?
      (y - (self.conn_w / 2) - (self.http_w / 2)) :
      (y + (self.conn_w / 2) + (self.http_w / 2));
  },

  draw_server_label: function (label) {
    var self = this;
    var y = label[0];
    var server = self.server_name(label[1]);
    self.labels.text(self.margin[3] * 2, y, server).attr({
      'font-size': 20,
      'text-anchor': 'start',
      'font-weight': 'bold',
      'fill': "#ccc",
      'opacity': '0.7'
    });
  },

  server_name: function (server) {
    var self = this;
    var server_ip = server.split(":")[0];
    var port = server.split(":")[1];
    if (server_ip in self.server_names &&
        self.server_names[server_ip] !== "") {
      server = self.server_names[server_ip] + ":" + port;
    }
    return server;
  },

  draw_conn: function (conn) {
    var self = this;
    var start_x = self.time_x(conn.start) || self.margin[3];
    var end_x = self.time_x(conn.end) || self.w - self.margin[1];
    var conn_e = self.paper.line(
      [start_x, conn.y], [end_x, conn.y]
    ).attr({
      "stroke": "#888",
      "stroke-width": self.conn_w,
      "opacity": "0.8"
    });
    conn_e.html_msg =
      "<h4>Connection to " + self.server_name(conn.server) + "</h4>" +
      "<ul>" +
      "<li>Duration: " +
      (
        ((conn.end || self.last) -
         (conn.start || self.first)) /
        1000).toFixed(3) +
      "s</li>" +
      "<li>RTT: " + conn.rtt.toFixed(1) + "ms</li>" +
      "</ul>";
    self.install_hover(conn_e);
    self.ele.push({
      'conn': conn_e,
      'packets': [],
      'http_reqs': [],
      'http_ress': []
    });
  },

  draw_packet: function (item, y, loc) {
    var self = this;
    var my_x = self.time_x(item.time);
    var pcolour = '#bbb';
    var y_start;
    var y_end;
    var direction;
    switch (item.what) {
    case "packet-in":
      y_start = y + 1;
      y_end = y + (self.conn_w / 2);
      direction = "&lt;";
      break;
    case "packet-out":
      y_start = y - 1;
      y_end = y - (self.conn_w / 2);
      direction = "&gt;";
      break;
    default:
      console.log("Unrecognised packet: " + item.what);
      return;
    }
    if (item.data_sz > 0) {
      pcolour = 'white';
    }
    if (item.flags.psh) {
      pcolour = 'green';
    }
    if (item.flags.syn) {
      pcolour = 'yellow';
    }
    if (item.flags.rst) {
      pcolour = 'blue';
    }
    if (item.flags.fin) {
      pcolour = 'purple';
    }
    var pkt_e = self.paper.line([my_x, y_start], [my_x, y_end]).attr({
//      "stroke-width": self.pix_per_sec <= 2500 ? "1" : "2",
      "stroke-width" : 1,
      "stroke": pcolour,
      "shape-rendering": "crispEdges"
    });
    pkt_e.html_msg = function () {
      var data = "";
      var flags = item.flags;
      var req = self.get_req();
      req.onreadystatechange = function () {
        if (req.readyState === 4 && req.status === 200) {
          // FIXME: proper json parse, please!
          data = eval("(" + req.responseText + ")").data;
        }
      };
      req.open("GET", "/packet/" + item.packet_id, false);
      req.send("");
      return "<table>" +
      "<tr>" +
      "<td class='" + (flags.syn ? "on" : "off") + "'> SYN </td>" +
      "<td class='" + (flags.ack ? "on" : "off") + "'> ACK </td>" +
      "<td class='" + (flags.rst ? "on" : "off") + "'> RST </td>" +
      "<td class='" + (flags.fin ? "on" : "off") + "'> FIN </td>" +
      "<td class='" + (flags.psh ? "on" : "off") + "'> PSH </td>" +
      "<td class='direction'> " + direction + " </td>" +
      "</tr>" +
      "</table>" +
      "<ul>" +
      "<li>window size: " + item.ws + "</li>" +
      "<li>data bytes: " + item.data_sz + "</li>" +
      "</ul>" +
      "<pre>" + data + "</pre>";
    }
    self.ele[self.ele.length-1]['packets'].push(pkt_e);
    pkt_e.loc = self.current_loc('packets');
    self.install_hover(pkt_e);
  },

  current_loc: function (kind) {
    var self = this;
    var y_offset = self.ele.length - 1 || 0;
    var x_offset = self.ele[y_offset][kind].length - 1 || 0;
    return {
      'x': x_offset,
      'y': y_offset,
      'kind': kind
    }
  },
  
  loc_to_element: function (loc) {
    var self = this;
    return self.ele[loc['y']][loc['kind']][loc['x']];
  },

  draw_http_message: function (conn, msg, y) {
    var self = this;
    var a = {
      'fill': 'white',
      'opacity': '0.4',
      'font-size': '11'
    };
    var desc;
    var start_x = self.time_x(msg.start) || self.margin[3];
    var end_x = self.time_x(msg.end) || self.w - self.margin[1];
    var msg_y = self.http_msg_y(y, msg.kind);

    var packet_count = 0;
    var byte_count = 0;
    var target_dir = msg.kind === 'req' ? 'packet-out' : 'packet-in';
    var start_p = msg.start_packet || 0;
    var end_p = msg.end_packet || (conn.packets.length - 1);
    for (var i = start_p; i < end_p; i += 1) {
      var packet = conn.packets[i];
      if (packet.data_sz > 0 && packet.what === target_dir) {
        packet_count += 1;
        byte_count += packet.data_sz;
      }
    }

    desc = "<h4>HTTP " + (msg.kind === 'req' ? "Request" : "Response") +
           "</h4>" +
           "<ul>" +
           "<li>Data packets: " + packet_count + "</li>" +
           "<li>Data size: " + byte_count + " bytes</li>" +
           "<li>Duration: " + (msg.end - msg.start).toFixed(1) + "ms</li>" +
           "</ul><pre>";

    if (msg.kind === 'req') {
      desc += msg.pl.method + " " +
              msg.pl.url +
              " HTTP/" + msg.pl.http_version + "\n";
      if (msg.pl.method !== 'GET') {
        self.paper.text(start_x + 20, msg_y - 10, msg.pl.method).attr(a);
      }
    } else {
      desc += "HTTP/" + msg.pl.http_version + " " +
              msg.pl.status_code + "\n";
      if (msg.pl.status_code !== 200) {
        self.paper.text(
          start_x + 16, msg_y + 10, msg.pl.status_code
        ).attr(a);
      }
    }
    for (var hdr in msg.pl.headers) {
      if (msg.pl.headers.hasOwnProperty(hdr)) {
        var val = msg.pl.headers[hdr];
        desc += hdr + ": " + val + "\n";          
      }
    }
    desc += "</pre>";

    var msg_e = self.paper.line([start_x, msg_y], [end_x, msg_y]).attr({
      "stroke": "red",
      "stroke-linecap": "round",
      "stroke-width": "" + self.http_w,
      "opacity": ".6"
    });
    msg_e.html_msg = desc;
    var ele_kind = msg.kind === 'req' ? "http_reqs" : "http_ress";
    self.ele[self.ele.length-1][ele_kind].push(msg_e);
    msg_e.loc = self.current_loc(ele_kind);
    self.install_hover(msg_e);
  },

  h_timeout: undefined,
  install_hover: function (e) {
    var self = this;
    e.click(function (event) {
      if (self.h_timeout) {
        clearTimeout(self.h_timeout);
        self.h_timeout = undefined;
      }
      self.inspect_element(e);
      self.cursor_loc = this.loc;
    });
    return; // FIXME
    e.hover(function (event) {
      if (self.h_timeout) {
        clearTimeout(self.h_timeout);
        self.h_timeout = undefined;
      }
      self.inspect_element(e);
    }, function (event) {
      self.uninspect_element(e);
    });
  },
  
  inspect_element: function (e) {
    var self = this;
    if (! e) {
      console.log("I can't do that...");
      return;
    }
    var msg;
    if (typeof e.html_msg === 'function') {
      msg = e.html_msg();
    } else {
      msg = e.html_msg;
    }
    if (! msg) {
      return;
    }
    if (self.inspected_element) {
      self.uninspect_element(self.inspected_element);
    }
    self.inspected_element = e;
    self.colour_adjust(e, 'stroke', 90);
    self.msg.html(msg);
    jQuery("#panel").css({position: "fixed"});
  },
  
  uninspect_element: function (e) {
    var self = this;
    self.colour_adjust(e, 'stroke');
  },

  colour_adjust: function (element, property, adjust) {
    var self = this;
    var colour;
    var opacity;
    var a;
    if (! adjust) {
      colour = element.orig_colour;
      opacity = element.orig_opacity;
      a = 0;
    } else {
      colour = Raphael.getRGB(element.attr(property));
      opacity = "1";
      element.orig_opacity = element.attr("opacity");
      element.orig_colour = colour;
      a = adjust;
    }
    if (! colour || ! opacity) {
      return;
    }
    var new_colour = Raphael.getRGB("rgb(" +
       Math.max(Math.min(colour.r + a, 255), 0) + "," +
       Math.max(Math.min(colour.g + a, 255), 0) + "," +
       Math.max(Math.min(colour.b + a, 255), 0) +
      ")").hex;
    var attrs = {'opacity': opacity};
    attrs[property] = new_colour;
    element.attr(attrs);
  },

  draw_scale: function () {
    var self = this;
    var start_x = self.time_x(self.first);
    var end_x = self.time_x(self.last);
    var end_y = self.h - self.margin[2];
    var end_attrs = {
      stroke: "#666",
      "stroke-width": "1"
    };
    var label_attrs = {
      fill: "white",
      "font-size": "16",
      "opacity": ".5"
    };
    self.paper.line(
      [start_x, self.margin[0]],
      [start_x, end_y]
    ).attr(end_attrs);
    var m;
    if (self.pix_per_sec <= 1000) {
      m = 1000;
    } else if (self.pix_per_sec <= 2000) {
      m = 500;
    } else if (self.pix_per_sec <= 3500) {
      m = 250;
    } else if (self.pix_per_sec <= 5000) {
      m = 100;
    } else {
      m = 50;
    }
    for (var i = self.first; i < self.last; i += m) {
      var i_x = self.time_x(i);
      self.paper.line([i_x, self.margin[0]], [i_x, end_y]).attr({
        stroke: "#444",
        "stroke-width": "1"
      });
      self.paper.text(i_x, end_y + 10,
        ((i - self.first) / 1000) + "s").attr(label_attrs);
      self.paper.text(i_x, self.margin[0] - 20,
        ((i - self.first) / 1000) + "s").attr(label_attrs);
    }
    self.paper.line([end_x, self.margin[0]], [end_x, end_y]).attr(end_attrs);
  },

  draw_logo: function () {
    var self = this;
    self.logo = self.paper.text(
      0, 50, "htracr").attr({
        "fill": "white",
        "font-size": "120",
        'text-anchor': 'start',
        'opacity': "0.02"
      });
  },

  capturing: false,
  pulse_logo: function () {
    var self = this;
    self.capturing = true;
    if (self.logo === undefined) {
      self.draw_logo();
    }
    self.logo.animate({
      'opacity': '0.6',
      'fill': '#669'
    }, 1500, function () {
      self.unpulse_logo();
    });
  },

  unpulse_logo: function (done) {
    var self = this;
    if (done) {
      self.capturing = false;
    }
    if (self.logo === undefined) {
      self.draw_logo();
    }
    self.logo.animate({
      'opacity': '0.02',
      'color': 'white'
    }, 1500, function () {
      if (self.capturing) {
        self.pulse_logo();
      }
    });
  },

  time_x: function (t) {
    var self = this;
    if (t === null) {
      return null;
    }
    var delta = t - self.first;
    if (delta < 0) {
      console.log('Negative delta for time ' + t);
    }
    var pix = delta * self.pix_per_sec / 1000;
    var x = self.margin[3] + pix;
    return x;
  },

  toggle_array: function (eid, arr_name) {
    var self = this;
    jQuery(eid).toggle(function (ev) {
      jQuery.each(htracr[arr_name], function (i, e) {
        e.hide();
      });
      jQuery(eid).removeClass("on").addClass("off");
      self["show_" + arr_name] = false;
    }, function (ev) {
      jQuery.each(htracr[arr_name], function (i, e) {
        e.show();
      });
      jQuery(eid).removeClass("off").addClass("on");
      self["show_" + arr_name] = true;
    });
  },


  // given a server_conns data structure, parse it into something
  // we can render().
  process_conns: function (server_conns) {
    var self = this;
    var y = self.margin[0];
    self.ordered_servers(server_conns).forEach(function (server) {
      self.server_labels.push([y, server]);
      var s = server_conns[server];
      for (var connection in s) {
        if (s.hasOwnProperty(connection)) {
          y += self.conn_pad;
          var conn = s[connection];
          self.process_conn(server, conn, y);          
        }
      }
      y += self.server_padding;
    });
    self.h = y + self.margin[2];
    self.get_servers();
  },

  // Given a hash of {server: {conn_id: [...]}}, return an ordered list
  // of servers, based upon first connection time.
  ordered_servers: function (server_conns) {
    function sortfunc(a, b) {
      var a_first;
      for (var aconn in a) {
        if (! a_first || aconn[0].time < a_first) {
          a_first = aconn[0].time;
        }
      }
      var b_first;
      for (var bconn in b) {
        if (! b_first || bconn[0].time < b_first) {
          b_first = bconn[0].time;
        }
      }
      return a_first - b_first;
    }
    var servers = [];
    for (var server in server_conns) {
      if (server_conns.hasOwnProperty(server)) {
        servers.push(server);        
      }
    }
    servers.sort(sortfunc);
    return servers;
  },

  process_conn: function (server, conn, y) {
    var self = this;
    var conn_start = null;
    var conn_end = null;
    var packets = [];
    var http_reqs = [];
    var http_ress = [];

    if (! conn) {
      console.log("got bad conn: " + conn);
      return; // shrug
    }

    conn.forEach(function (item) {
      if (! self.first || item.time < self.first) {
        self.first = item.time;
      }
      if (! self.last || item.time > self.last) {
        self.last = item.time;
      }
      switch (item.what) {
      case "packet-in":
      case "packet-out":
        packets.push(item);
        break;
      case "tcp-start":
        conn_start = item.time;
        break;
      case "tcp-end":
        conn_end = item.time;
        var tcp_last_res = http_ress.slice(-1)[0];
        if (tcp_last_res && tcp_last_res.end === null) {
          // close delimits messages.
          tcp_last_res.end = item.time;
          tcp_last_res.end_packet = packets.length;
        }
        break;
      case "http-req-start":
        var packet_log = self.rewind_packets(packets, item);
        http_reqs.push({
          start: packet_log.start,
          end: null,
          pl: item,
          kind: 'req',
          start_packet: packet_log.index
        });
        break;
      case "http-req-data":
        break;
      case "http-req-end":
        var last_req = http_reqs.slice(-1)[0];
        if (last_req) {
          last_req.end = item.time;
          last_req.end_packet = packets.length;
        } else {
          console.log("Can't find last request.");
        }
        break;
      case "http-res-data":
        break;
      case "http-res-start":
        var packet_log2 = self.rewind_packets(packets, item);
        http_ress.push({
          start: packet_log2.start,
          end: null,
          pl: item,
          kind: 'res',
          start_packet: packet_log2.index
        });
        break;
      case "http-res-end":
        var last_res = http_ress.slice(-1)[0];
        if (last_res) {
          last_res.end = item.time;
          last_res.end_packet = packets.length;
        } else {
          console.log("Can't find last response.");
        }
        break;
      default:
        console.log("unknown item: " + item.what + " (in " + item + ")");
        break;
      }
    });

    http_reqs.forEach(function (req) {
      var url = "http://" + req.pl.headers.Host + req.pl.url;
      self.urls[url] = [req.end, self.http_msg_y(y, 'req')];

      var ref = req.pl.headers.Referer;
      if (ref) {
        (self.refs[ref] = self.refs[ref] || []).push(
          [req.end, self.http_msg_y(y, 'req')]
        );
      }
    });

    http_ress.forEach(function (res) {
      var loc = res.pl.headers.Location;
      if (loc) {
        self.locs[loc] = [res.end, self.http_msg_y(y, 'res')];
      }
    });

    var first_syn;
    var rtt;
    packets.forEach(function (p) {
      if (p.flags.syn) {
        switch (p.what) {
        case "packet-out":
          first_syn = p.time;
          break;
        case "packet-in":
          rtt = p.time - first_syn;
          break;
        default:
          console.log("Unknown item in packet list: " + p.what);
          break;
        }
      }
    });

    self.conns.push({
      server: server,
      start: conn_start,
      end: conn_end,
      http_reqs: http_reqs,
      http_ress: http_ress,
      packets: packets,
      rtt: rtt,
      y: y
    });
  },

  // search backwards through a list of packets and find where a http message
  // really started. This is imprecise, but should be OK most of the time.
  // see: https://github.com/mranney/node_pcap/issues#issue/9
  rewind_packets: function (packets, msg) {
    var num_packets = 0;
    var bytes = [
      msg.method || "",
      msg.url || "",
      msg.status_code || "", // don't have access to phrase :(
      " HTTP/1.x", // works out the same for request or response
      "\r\n"
    ];
    for (var h in msg.headers) {
      if (msg.headers.hasOwnProperty(h)) {
        bytes.push(h + ": " + msg.headers[h] + "\r\n");        
      }
    }
    bytes.push("\r\n");
    var num_bytes = bytes.join("").length;
    var bytes_seen = 0;
    for (var i = packets.length - 1; i >= 0; i -= 1) {
      var packet = packets[i];
      bytes_seen += packet.data_sz;
      if (packet.data_sz > 0) {
        num_packets += 1;
      }
      if (bytes_seen >= num_bytes) {
        return {
          start: packet.time,
          count: num_packets,
          index: i
        };
      }
    }
    // Shouldn't get here...
    console.log("Couldn't find the start of message: " + msg);
    return {
      start: msg.time,
      count: 1,
      index: packets.length
    };
  },

  handle_key: function (ch) {
    var self = htracr;
    if (! self.cursor_loc) {
      return;
    }
    switch (ch.keyCode) {
      case 37: // left
        self.cursor_loc['x'] = Math.max(0, self.cursor_loc['x'] - 1);
        break;
      case 39: // right
        self.cursor_loc['x'] = Math.min(
          self.ele[self.cursor_loc['y']][self.cursor_loc['kind']].length - 1,
          self.cursor_loc['x'] + 1
        );
        break;
      default:
        return;
    }
    self.inspect_element(self.loc_to_element(self.cursor_loc));
    return false;
  }
};



jQuery.noConflict();
jQuery(document).ready(function () {
  jQuery("#stop").hide();
  jQuery("#filename").hide();
  jQuery("#panel").draggable();
  jQuery("#panel").resizable();
  jQuery("#zoom").slider({
    max: 10000,
    min: 300,
    step: 10,
    value: default_pix_per_sec,
    slide: function (event, ui) {
      var orig_w = htracr.w;
      var orig_scroll = jQuery(window).scrollLeft();
      htracr.zoom(ui.value);
      var new_w = htracr.w;
      var new_scroll = (orig_scroll / orig_w) * new_w;
      console.log("orig scroll: " + orig_scroll + " new scroll: " + new_scroll);
      jQuery(window).scrollLeft(new_scroll);      
    }
  });
  jQuery("#show-upload").click(function() {
    jQuery("#show-upload").hide();
    jQuery("#filename").show();
    jQuery("#filename").change(function() {
      jQuery("#upload").submit()
    });
  });
  htracr.toggle_array("#refs", "ref_elements");
  htracr.toggle_array("#redirs", "loc_elements");
  jQuery(window).scroll(function () {
    jQuery('#labels').css('top', '-' + jQuery(window).scrollTop());
  });
  jQuery("html").keydown(htracr.handle_key);
  htracr.update_state();
  htracr.draw_logo();
});
