
if (! window.console) {
  window.console = {
    log: function(msg) {},
  }
}

var margin = [100, 20, 50, 20];
var server_padding = 48;
var conn_pad = 36; // padding between connections
var conn_w = 10;  // how wide the connection is
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
	locs: {},
	server_labels: [],
	server_names: {},
	first: undefined,
	last: undefined,
	logo: undefined,
  pix_per_sec: default_pix_per_sec,  // pixels per second
	
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

		self.draw_bookends();

		for (ref in self.refs) {
			if (self.urls[ref]) {
				self.refs[ref].forEach(function(r) {
				  var s = [self.time_x(self.urls[ref][0]), self.urls[ref][1]];
				  var e = [self.time_x(r[0]), r[1]];
					self.paper.curve(s, e).attr({
						"stroke": "#ccf",
						"stroke-width": "1",
						"opacity": "0.3",
					});
				});
			}
		}

    self.conns.forEach(function(i) {
      var conn_start = i[0];
      var conn_end = i[1];
      var http_reqs = i[2];
      var http_ress = i[3];
      var packets = i[4];
      var y = i[5];
      self.draw_conn(conn_start, conn_end, y);
      packets.forEach(function(p) {
        self.draw_packet(p, y);
      })
  		http_reqs.forEach(function(req) {
  			self.draw_http_message('req', y, req[0], req[1], req[2]);
  		});

  		http_ress.forEach(function(res) {
  			self.draw_http_message('res', y, res[0], res[1], res[2]);
  		});
    });

    for (loc in self.locs) {
      if (self.urls[loc]) {
			  var s = [self.time_x(self.urls[loc][0]), self.urls[loc][1]];
			  var e = [self.time_x(self.locs[loc][0]), self.locs[loc][1]];
        self.paper.curve(s, e).attr({
						"stroke": "#9c9",
						"stroke-width": "3",
						"opacity": "0.8",
        });
      }
    }

		self.server_labels.forEach(function(label) {
		  self.draw_server_label(label);
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
				self.process_conn(conn, y);
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

	process_conn: function (conn, y) {
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
		    self.first = item.time
		  }
		  if (! self.last || item.time > self.last) {
		    self.last = item.time
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
					break;
				case "http-req-start":
				  var real_start = self.rewind_packets(packets, item.details)
					http_reqs.push([real_start, null, item.details]);
					break;
				case "http-req-end":
					http_reqs.slice(-1)[0][1] = item.time;
					break;
				case "http-res-start":
					http_ress.push([item.time, null, item.details]);
					break;
				case "http-res-end":
					http_ress.slice(-1)[0][1] = item.time;
					break;
				default:
					console.log("unknown item: " + item.what);
					break;
			}
		});

		http_reqs.forEach(function(req) {
			var url = "http://" + req[2].headers.Host + req[2].url;
			self.urls[url] = [req[1], self.http_msg_y(y, 'req')];

			var ref = req[2].headers.Referer;
			if (ref) {
				(self.refs[ref] = self.refs[ref] || []).push(
				  [req[1], self.http_msg_y(y, 'req')]
				);
			}	
		});

    http_ress.forEach(function(res) {
      var loc = res[2].headers.Location;
      if (loc) {
        self.locs[loc] = [res[1], self.http_msg_y(y, 'res')];
      }
    });

    self.conns.push([conn_start, conn_end, http_reqs, http_ress, packets, y]);
				
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
    var server = label[1];
    var server_ip = server.split(":")[0];
    var port = server.split(":")[1];
    if (server_ip in self.server_names && 
        self.server_names[server_ip] != "") {
      server = self.server_names[server_ip] + ":" + port;
    }

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

  draw_conn: function(conn_start, conn_end, y) {
		var self = this;
		var start_x = self.time_x(conn_start) || margin[3];
		var end_x = self.time_x(conn_end) || self.w - margin[1];
		self.paper.line(
			[start_x, y], [end_x, y]
		).attr({
			"stroke": "#888",
			"stroke-width": conn_w,
  		"opacity": "0.8",
		});
  },

  // search backwards through a list of packets and find where a http message
  // really started. This is imprecise, but should be OK most of the time.
  rewind_packets: function(packets, msg) {
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
    console.log("looking for " + num_bytes + " bytes.");
    var bytes_seen = 0;
    for (var i = packets.length - 1; i >= 0; i--) {
      var packet = packets[i];
      bytes_seen += packet.details.data_sz;
      console.log("... " + bytes_seen + " seen...");
      if (bytes_seen >= num_bytes) {
        console.log("... and decided on " + packet.time);
        return packet.time;
      }
    }
  },

	draw_packet: function(item, y) {
		var self = this;
		var my_x = self.time_x(item.time);
		var pkt_e = self.paper.line(
			[my_x, item.what == 'packet-in' ? y + 1 : y - 1],
			[my_x, item.what == 'packet-in' ? y + (conn_w / 2) : y - (conn_w / 2)]
		).attr({
			"stroke-width": "1",
			"stroke": "yellow",
		});
	  self.hover(pkt_e,
			function() {
    		var data = "";
			  var flags = item.details.flags;
      	var req = get_req();
      	req.onreadystatechange = function () {
      		if (req.readyState == 4 && req.status == 200) {
    			  // FIXME: proper json parse, please!
      			data = eval("(" + req.responseText + ")").data;
       		};
      	};
      	req.open("GET", "/packet/" + item.details.packet_id, false);
      	req.send("");
      	console.log("displaying packet: " + item.details.packet_id);
  			return "<table>" +
  			"<tr>" + 
  			"<td class='" + (flags.syn ? "on" : "off") + "'> SYN </td>" +
  			"<td class='" + (flags.ack ? "on" : "off") + "'> ACK </td>" +
  			"<td class='" + (flags.rst ? "on" : "off") + "'> RST </td>" +
  			"<td class='" + (flags.fin ? "on" : "off") + "'> FIN </td>" +
  			"</tr>" +
  			"</table>" +
  			"<ul>" + 
  			"<li>window size: " + item.details.ws + "</li>" +
  			"<li>data bytes: " + item.details.data_sz + "</li>" +
  			"</ul>" +
  			"<pre>" + data + "</pre>";
			}
		);
	},

	draw_http_message: function(msg_type, y, start, end, details) {
	    var self = this;
			var a = {
			  'fill': 'white',
			  'opacity': '0.4', 
			  'font-size': '15',
			};
			var desc;
			var start_x = self.time_x(start) || margin[3]
			var end_x = self.time_x(end) || self.w - margin[1]
			var msg_y = self.http_msg_y(y, msg_type);

  		function show_hdrs(hdrs) {
  				var l = [];
  				for (hdr in hdrs) {
  					var val = hdrs[hdr];
  					l.push(hdr + ": " + val);
  				}
  				return l.join("<br>");
  		}
		
			if (msg_type == 'req') {
				desc = details.method + " " 
				     + details.url 
		         + " HTTP/" + details.http_version 
		         + "<br>" + show_hdrs(details.headers);
			  if (details.method != 'GET') {
			    self.paper.text(start_x+20, msg_y-10, details.method).attr(a);
			  }
			}	else {
			  desc = "HTTP/" + details.http_version + " " 
			       + details.status_code 
			  if (details.status_code != 200) {
			    self.paper.text(start_x+16, msg_y+10, details.status_code).attr(a);
			  }
			}
 		  desc += "<br>" + show_hdrs(details.headers);
			var msg_e = self.paper.line([start_x, msg_y], [end_x, msg_y]).attr({
				"stroke": "red",
				"stroke-linecap": "round", 
				"stroke-width": "" + http_w,
				"opacity": ".6",
			});
			self.hover(msg_e, desc);	
	},

  _h_timeout: undefined,
	hover: function(e, html) {
	  var self = this;
		e.hover(function(event) {
  	  if (self._h_timeout) {
  	    clearTimeout(self._h_timeout);
  	    self._h_timeout = undefined;
  	  }
  	  if (typeof html == 'function') {
  	    self.msg.innerHTML = html();
  	  } else {
  			self.msg.innerHTML = html;
  	  }
		}, function(event) {
		  self._h_timeout = setTimeout(function() {
			  self.msg.innerHTML = "";
		  }, 2000);
		});
	},

	draw_bookends: function() {
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

	show: function(x) {
		if (x < 3) {
			return 3;
		}
		return x;
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
	
	clear: function () {
		var self = this;
		self.conns = [];
		self.first = undefined;
		self.last = undefined;
  	self.server_labels = [],
		self.urls = {};
		self.refs = {};
		self.render();
		console.log('cleared.');
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
	
