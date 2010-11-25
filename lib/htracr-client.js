
if (! window.console) {
  window.console = {
    log: function(msg) {},
  }
}

var margin = [100, 20, 50, 20];
var server_padding = 48;
var conn_pad = 36; // padding between connections
var conn_w = 12;  // how wide the connection is
var http_w = 8;  // how wide http request and response messages are
var default_pix_per_sec = 500;
var label_w = 600;

jQuery.noConflict();
jQuery(document).ready(function() {
	jQuery("#stop").hide();
	jQuery("#msg").draggable();
	jQuery("#msg").resizable();
	jQuery("#zoom").slider({
		max: 5000, 
		min: 300, 
		step: 10, 
		value: default_pix_per_sec,
		slide: function(event, ui) {
			htracr.zoom(ui.value);
		},
	});
	htracr.toggle_array("#refs", "ref_elements");
	htracr.toggle_array("#redirs", "loc_elements");
	jQuery(window).scroll(function(){
    jQuery('#labels').css('top','-' + jQuery(window).scrollTop());
  });
	update_state();
	htracr.draw_logo();
});



Raphael.fn.line = function(s, e) {
	if (! s[0] || ! s[1] || ! e[0] || ! e[1]) {
		// dummy
		return this.circle(0,0,0);
	}
	return this.path(
			"M" + s[0] + "," + s[1] + " " +
   	  "L" + e[0] + "," + e[1]
	);
}

Raphael.fn.curve = function(s, e) {
	if (! s[0] || ! s[1] || ! e[0] || ! e[1]) {
		// dummy
		return this.circle(0,0,0);
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
}


var htracr = {
	w: 600,
	h: 800,
	paper: Raphael(document.getElementById("paper"), self.w, self.h),
	labels: Raphael(document.getElementById("labels"), label_w, self.h),
	msg: document.getElementById("msg"),
	conns: [],
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

	clear: function () {
		var self = this;
		self.conns = [];
		self.first = undefined;
		self.last = undefined;
  	self.server_labels = [],
		self.urls = {};
		self.refs = {};
		self.ref_elements = [];
		self.loc_elements = [];
		self.render();
		console.log('cleared.');
	},
	
	// render all of our various data.
	render: function () {
	  var self = this;
		self.paper.clear();
		self.labels.clear();
		self.draw_logo();
		
		self.w = ((self.last - self.first) / 1000 * self.pix_per_sec) 
		       + margin[1] + margin[3];
//		self.h = Math.max(y + margin[2], self.h);

		self.resize();

		self.draw_scale();

		for (ref in self.refs) {
			if (self.urls[ref]) {
				self.refs[ref].forEach(function(r) {
				  var s = [self.time_x(self.urls[ref][0]), self.urls[ref][1]];
				  var e = [self.time_x(r[0]), r[1]];
					var ref_e = self.paper.curve(s, e).attr({
						"stroke": "#ccf",
						"stroke-width": "1",
						"opacity": "0.3",
					});
					self.show_ref_elements || ref_e.hide();
					self.ref_elements.push(ref_e);
				});
			}
		}

    self.conns.forEach(function(c) {
      self.draw_conn(c);
      c.packets.forEach(function(p) {
        self.draw_packet(p, c.y);
      })
  		c.http_reqs.forEach(function(msg) {
  			self.draw_http_message(c, msg, c.y);
  		});

  		c.http_ress.forEach(function(msg) {
  			self.draw_http_message(c, msg, c.y);
  		});
    });

    for (loc in self.locs) {
      if (self.urls[loc]) {
			  var s = [self.time_x(self.urls[loc][0]), self.urls[loc][1]];
			  var e = [self.time_x(self.locs[loc][0]), self.locs[loc][1]];
        var loc_e = self.paper.curve(s, e).attr({
						"stroke": "#9c9",
						"stroke-width": "3",
						"opacity": "0.8",
        });
        self.show_loc_elements || loc_e.hide();
        self.loc_elements.push(loc_e);
      }      
    }

		self.server_labels.forEach(function(label) {
		  self.draw_server_label(label);
		});

	},

  // return an adjusted y value for the given message type (req or res)
	http_msg_y: function(y, msg_type) {
		return msg_type == 'req' ?
			(y - (conn_w / 2) - (http_w / 2)) :
			(y + (conn_w / 2) + (http_w / 2))		
	},

  draw_server_label: function(label) {
    var self = this;
    var y = label[0];
    var server = self.server_name(label[1]);
		self.labels.text(
			margin[3] * 2, 
 			y, 
 			server
		).attr({
			'font-size': 20,
			'text-anchor': 'start',
			'font-weight': 'bold',
			'fill': "#ccc",
			'opacity': '0.7',
		});

  },

  server_name: function(server) {
    var self = this;
    var server_ip = server.split(":")[0];
    var port = server.split(":")[1];
    if (server_ip in self.server_names && 
        self.server_names[server_ip] != "") {
      server = self.server_names[server_ip] + ":" + port;
    }
    return server;
  },

  draw_conn: function(conn) {
		var self = this;
		var start_x = self.time_x(conn.start) || margin[3];
		var end_x = self.time_x(conn.end) || self.w - margin[1];
		var conn_e = self.paper.line(
			[start_x, conn.y], [end_x, conn.y]
		).attr({
			"stroke": "#888",
			"stroke-width": conn_w,
  		"opacity": "0.8",
		});
		self.hilight(conn_e, 
		  "<h4>Connection to " + self.server_name(conn.server) + "</h4>" +
		  "<ul>" +
		  "<li>Duration: " + 
		  (
		    ((conn.end || self.last) - 
		     (conn.start || self.first)) / 
		    1000).toFixed(3) + 
		  "s</li>" +
		  "<li>RTT: " + conn.rtt.toFixed(1) + "ms</li>" +
		  "</ul>"
		);
  },

  // search backwards through a list of packets and find where a http message
  // really started. This is imprecise, but should be OK most of the time.
  rewind_packets: function(packets, msg) {
    var num_packets = 0;
    var bytes = [
        msg.method || "",
        msg.url || "",
        msg.status_code || "", // don't have access to phrase :(
        " HTTP/1.x", // works out the same for request or response
        "\r\n"
    ]
    for (h in msg.headers) {
      bytes.push(h + ": " + msg.headers[h] + "\r\n");
    }
    bytes.push("\r\n");
    var num_bytes = bytes.join("").length;
    var bytes_seen = 0;
    for (var i = packets.length - 1; i >= 0; i--) {
      var packet = packets[i];
      bytes_seen += packet.data_sz;
      if (packet.data_sz > 0) {
        num_packets += 1;
      }
      if (bytes_seen >= num_bytes) {
        return {
          start: packet.time, 
          count: num_packets,
          index: i,
        }
      }
    }
  },

	draw_packet: function(item, y) {
		var self = this;
		var my_x = self.time_x(item.time);
		var pcolour = '#bbb';
		if (item.data_sz > 0)
		  pcolour = 'white';
		if (item.flags.psh)
		  pcolour = 'green';
		if (item.flags.syn)
		  pcolour = 'yellow';
		if (item.flags.rst)
		  pcolour = 'blue';
		if (item.flags.fin)
		  pcolour = 'purple';
		var pkt_e = self.paper.line(
			[my_x, item.what == 'packet-in' ? y + 1 : y - 1],
			[my_x, item.what == 'packet-in' ? y + (conn_w / 2) : y - (conn_w / 2)]
		).attr({
			"stroke-width": self.pix_per_sec <= 2500 ? "1" : "2",
			"stroke": pcolour,
		});
	  self.hilight(pkt_e,
			function() {
    		var data = "";
			  var flags = item.flags;
      	var req = get_req();
      	req.onreadystatechange = function () {
      		if (req.readyState == 4 && req.status == 200) {
    			  // FIXME: proper json parse, please!
      			data = eval("(" + req.responseText + ")").data;
       		};
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
  			"</tr>" +
  			"</table>" +
  			"<ul>" + 
  			"<li>window size: " + item.ws + "</li>" +
  			"<li>data bytes: " + item.data_sz + "</li>" +
  			"</ul>" +
  			"<pre>" + data + "</pre>";
			}
		);
	},

	draw_http_message: function(conn, msg, y) {
	    var self = this;
			var a = {
			  'fill': 'white',
			  'opacity': '0.4', 
			  'font-size': '15',
			};
			var desc;
			var start_x = self.time_x(msg.start) || margin[3]
			var end_x = self.time_x(msg.end) || self.w - margin[1]
			var msg_y = self.http_msg_y(y, msg.kind);
			
			var packet_count = 0;
			var byte_count = 0;
			var target_dir = msg.kind == 'req' ? 'packet-out' : 'packet-in';
			var start_p = msg.start_packet || 0;
			var end_p = msg.end_packet || (conn.packets.length - 1);
			for (var i = start_p; i < end_p; i+=1 ) {
			  var packet = conn.packets[i];
			  if (packet.data_sz > 0 && packet.what == target_dir) {
			    packet_count += 1;
			    byte_count += packet.data_sz;
			  }
			};

      desc = "<h4>HTTP " + (msg.kind == 'req' ? "Request" : "Response")
           + "</h4>"
           + "<ul>"
           + "<li>Data packets: " + packet_count + "</li>"
           + "<li>Data size: " + byte_count + " bytes</li>"
           + "<li>Duration: " + (msg.end - msg.start).toFixed(1) + "ms</li>"
           + "</ul><pre>"

			if (msg.kind == 'req') {
				desc += msg.pl.method + " " 
				      + msg.pl.url 
		          + " HTTP/" + msg.pl.http_version + "\n";
			  if (msg.pl.method != 'GET') {
			    self.paper.text(start_x+20, msg_y-10, msg.pl.method).attr(a);
			  }
			}	else {
			  desc += "HTTP/" + msg.pl.http_version + " " 
			        + msg.pl.status_code + "\n"
			  if (msg.pl.status_code != 200) {
			    self.paper.text(
			      start_x+16, msg_y+10, msg.pl.status_code
			    ).attr(a);
			  }
			}
			for (hdr in msg.pl.headers) {
				var val = msg.pl.headers[hdr];
				desc += hdr + ": " + val + "\n";
			}
			desc += "</pre>";

			var msg_e = self.paper.line([start_x, msg_y], [end_x, msg_y]).attr({
				"stroke": "red",
				"stroke-linecap": "round", 
				"stroke-width": "" + http_w,
				"opacity": ".6",
			});
			self.hilight(msg_e, desc);	
	},

  _h_timeout: undefined,
	hilight: function(e, html) {
	  var self = this;
	  var oc;
		e.hover(function(event) {
  	  var oc = Raphael.getRGB(e.attr('stroke'));
  	  if (self._h_timeout) {
  	    clearTimeout(self._h_timeout);
  	    self._h_timeout = undefined;
  	  }
  	  self.colour_adjust(e, 'stroke', 50);
  	  if (typeof html == 'function') {
  	    self.msg.innerHTML = html();
  	  } else {
  			self.msg.innerHTML = html;
  	  }
		}, function(event) {
  	  self.colour_adjust(e, 'stroke');
		  self._h_timeout = setTimeout(function() {
			  self.msg.innerHTML = "";
		  }, 2000);
		});
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
    var new_colour = Raphael.getRGB("rgb(" +
  	   Math.max(Math.min(colour.r + a, 255), 0) + "," +
  	   Math.max(Math.min(colour.g + a, 255), 0) + "," + 
  	   Math.max(Math.min(colour.b + a, 255), 0) +
  	  ")").hex;
  	var attrs = {'opacity': opacity};
  	attrs[property] = new_colour;
  	element.attr(attrs);
  },

	draw_scale: function() {
		var self = this;
		var start_x = self.time_x(self.first);
		var end_x = self.time_x(self.last);
		var end_y = self.h - margin[2];
		var end_attrs = {
			stroke: "#666",
			"stroke-width": "1",
		};
		var label_attrs = {
	    fill: "white",
	    "font-size": "16",
	    "opacity": ".5",		  
		};
		self.paper.line([start_x, margin[0]], [start_x, end_y]).attr(end_attrs);
		var m;
		if (self.pix_per_sec <= 1000) {
		  m = 1000;
		} else if (self.pix_per_sec <= 2000) {
		  m = 500;
		} else if (self.pix_per_sec <= 3500) {
		  m = 250;
		} else {
		  m = 125;
		};
		for (var i = self.first; i < self.last; i += m) {
		  var i_x = self.time_x(i);
		  self.paper.line([i_x, margin[0]], [i_x, end_y]).attr({
		    stroke: "#444",
		    "stroke-width": "1",
		  });
		  self.paper.text(i_x, end_y + 10,
		    ((i - self.first) / 1000) + "s").attr(label_attrs);
		  self.paper.text(i_x, margin[0] - 20,
		    ((i - self.first) / 1000) + "s").attr(label_attrs);
		}
		self.paper.line([end_x, margin[0]], [end_x, end_y]).attr(end_attrs);
	},

  draw_logo: function () {
    var self = this;
    self.logo = self.paper.text(
      0, 50, "htracr").attr({
        "fill": "white",
        "font-size": "120",
  			'text-anchor': 'start',
  			'opacity': "0.02",
      });
  },

  capturing: false,
  pulse_logo: function () {
    var self = this;
    self.capturing = true;
    if (self.logo == undefined) {
      self.draw_logo();
    }
    self.logo.animate({
      'opacity': '0.6',
      'fill': '#669',
    }, 1500, function () {
      self.unpulse_logo();
    });
  },
  
  unpulse_logo: function (done) {
    var self = this;
    if (done) {
      self.capturing = false;
    }
    if (self.logo == undefined) {
      self.draw_logo();
    }
    self.logo.animate({
      'opacity': '0.02',
      'color': 'white',
    }, 1500, function () {
      if (self.capturing) {
         self.pulse_logo();
      }
    });
  },

	time_x: function (t) {
	  var self = this;
	  if (t == null) {
	    return null;
	  }
		var delta = t - self.first;
		var pix = delta * self.pix_per_sec / 1000;
		var x = margin[3] + pix;
		return x;
	},

  toggle_array: function (eid, arr_name) {
    var self = this;
    jQuery(eid).toggle(function(ev) {
      jQuery.each(htracr[arr_name], function (i, e) {
        e.hide();
      });
      jQuery(eid).removeClass("on").addClass("off");
      self["show_" + arr_name] = false;
    }, function(ev) {
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
		var y = margin[0];
		self.ordered_servers(server_conns).forEach(function(server) {
		  self.server_labels.push([y, server]);
			var s = server_conns[server];
			for (connection in s) {
				y += conn_pad;
				var conn = s[connection];
				self.process_conn(server, conn, y);
			}
			y += server_padding;
		});
		self.h = y + margin[2];
		get_servers();
	},

  // Given a hash of {server: {conn_id: [...]}}, return an ordered list
  // of servers, based upon first connection time.
	ordered_servers: function (server_conns) {
		function sortfunc(a, b) {
			var a_first;
			for (conn in a) {
				if (! a_first || conn[0].time < a_first) {
					a_first = conn[0].time;
				}
			}
			var b_first;
			for (conn in b) {
				if (! b_first || conn[0].time < b_first) {
					b_first = conn[0].time;
				}
			}
			return a_first - b_first;
		};
		var servers = [];
		for (server in server_conns) {
			servers.push(server);
		};
		servers.sort(sortfunc);
		return servers;
	},

	process_conn: function (server, conn, y) {
		var self = this;
		var conn_start = margin[3];
		var conn_end = null;
		var packets = [];
		var http_reqs = [];
		var http_ress = [];

		if (! conn) {
			console.log("got bad conn: " + conn);
			return; // shrug
		}
		
		conn.forEach(function(item) {
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
				  var last_res = http_ress.slice(-1)[0];
				  if (last_res) {
  					var conn_hdr = last_res.pl.headers.Connection;
  					if (conn_hdr && conn_hdr.match(/close/)) {
  					  // connection: close delimits the message.
  				    last_res.end = item.time;
  				    last_res.end_packet = packets.length;
  					}				    
				  }
					break;
				case "http-req-start":
				  var packet_log = self.rewind_packets(packets, item);
					http_reqs.push({
					  start: packet_log.start,
					  end: null,
					  pl: item,
					  kind: 'req',
					  start_packet: packet_log.index,
					});
					break;
				case "http-req-data":
				  break;
				case "http-req-end":
				  var last_req = http_reqs.slice(-1)[0];
				  if (last_req) {
				    last_req.end = item.time;
				    last_req.end_packet = packets.length;
				  }
					break;
				case "http-res-data":
				  break;
				case "http-res-start":
				  var packet_log = self.rewind_packets(packets, item);
					http_ress.push({
					  start: packet_log.start,
					  end: null,
					  pl: item,
					  kind: 'res',
					  start_packet: packet_log.index,
					});
					break;
				case "http-res-end":
				  var last_res = http_ress.slice(-1)[0];
				  if (last_res) {
					  last_res.end = item.time;
				    last_res.end_packet = packets.length;
				  } else {
				    console.log("Can't find response end!")
				  }
					break;
				default:
					console.log("unknown item: " + item.what + " (in " + item + ")");
					break;
			}
		});

		http_reqs.forEach(function(req) {
			var url = "http://" + req.pl.headers.Host + req.pl.url;
			self.urls[url] = [req.end, self.http_msg_y(y, 'req')];

			var ref = req.pl.headers.Referer;
			if (ref) {
				(self.refs[ref] = self.refs[ref] || []).push(
				  [req.end, self.http_msg_y(y, 'req')]
				);
			}	
		});

    http_ress.forEach(function(res) {
      var loc = res.pl.headers.Location;
      if (loc) {
        self.locs[loc] = [res.end, self.http_msg_y(y, 'res')];
      }
    });

    var first_syn;
    var rtt;
    packets.forEach(function(p) {
      if (p.flags.syn) {
        switch (p.what) {
          case "packet-out":
            first_syn = p.time;
            break;
          case "packet-in":
            rtt = p.time - first_syn;
            break;
        };
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
      y: y,
    });
	},
	
	resize: function () {
		var self = this;
		console.log("resizing to " + self.w + " x " + self.h);
		self.paper.setSize(self.w, self.h);
		self.labels.setSize(label_w, self.h);
	},

  zoom: function (val) {
  	var self = this;
  	console.log("zooming to " + val + "...");
  	self.pix_per_sec = val;
  	self.render();
  },

}


function start_capture() {
	console.log('starting capture...');
	htracr.clear();
	var req = get_req();
	req.onreadystatechange = function () {
		if (req.readyState == 4) {
			console.log('started.');
			jQuery("#start").hide();
			jQuery("#stop").show();
			htracr.pulse_logo();
		}; 
	};
	req.open("POST", "/start", true);
	req.send("");
	return false;	
}

function stop_capture() {
	console.log('stopping capture...');
	var req = get_req();
	req.onreadystatechange = function () {
		if (req.readyState == 4) {
			update_state();
			console.log('stopped.');
			jQuery("#stop").hide();
			jQuery("#start").show();
			htracr.unpulse_logo(true);
		}; 
	};
	req.open("POST", "/stop", true);
	req.send("");
	return false;	
}

function update_state() {
	console.log('updating...');
	var req = get_req();
	req.onreadystatechange = function () {
		if (req.readyState == 4) {
		  if (req.status == 200) {
			  // FIXME: proper json parse, please!
  			var server_conns = eval("(" + req.responseText + ")");
  			htracr.process_conns(server_conns);
  			htracr.render();
  			console.log('updated.');		    
		  }
		}; 
	};
	req.open("GET", "/conns", true);
	req.send("");
	return false;
}

function clear_state() {
	console.log('clearing...');
	var req = get_req();
	req.onreadystatechange = function () {
		if (req.readyState == 4) {
			htracr.clear();
		}; 
	};
	req.open("POST", "/clear", true);
	req.send("");
	return false;
}

function get_servers() {
	console.log('getting servers...');
	var req = get_req();
	req.onreadystatechange = function () {
		if (req.readyState == 4) {
		  // FIXME: proper json parse, please!
			htracr.server_names =  eval("(" + req.responseText + ")");
		}; 
	};
	req.open("GET", "/servers", false);
	req.send("");
}

		
function get_req() {
	var req;
	if (window.XMLHttpRequest) {
		try {
		  req = new XMLHttpRequest();
		} catch(e) {
		  req = false;
		}
	} else if (window.ActiveXObject) {
		try {
		  req = new ActiveXObject("Microsoft.XMLHTTP");
		} catch(e) {
		  req = false;
		}
	}
	return req;
}
	
