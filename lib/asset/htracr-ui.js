if (! window.console) {
  window.console = {
    log: function log (msg) {}
  };
}

Raphael.fn.curve = function (s, e) {
  if (! s.x || ! s.y || ! e.x || ! e.y) {
    // dummy
    console.log("Can't draw curve.");
    console.log(s);
    console.log(e);
    return undefined;
  }
  var s_ctrl = {x: s.x, y: s.y};
  var e_ctrl = {x: s.x, y: s.y};

  if (s.y == e.y) {
    s_ctrl.y = s.y - 30;
    e_ctrl.y = s.y - 30;
  } else {
    s_ctrl.y -= ((s.y - e.y) / 4);
    e_ctrl.y -= ((s.y - e.y) / 5);
  }
  var path = "M" + s.x + "," + s.y + " " +
             "C" + s_ctrl.x + "," + s_ctrl.y + " " +
                   e_ctrl.x + "," + e_ctrl.y + " " +
                   e.x + "," + e.y;
  return this.path(path);
};

if (! htracr) {
  var htracr = {};
}

// General Ui elements (non-data)
htracr.ui = function () {
  var paper;
  var labels;
  var logo;
  var msg;
  var default_pix_per_sec = 500;        // starting pixels per second
  var margin = [100, 20, 100, 20];      // top, right, bottom, left (pixels)
  
  
  // object for user interaction
	var ui = {
  
	  // defaults and settings
    w: 550,                             // width (pixels)
    h: 400,                             // height (pixels)
    conn_size: 12,                      // how high connections are (pixels)
  	msg_size: 8,                        // width of an http message (pixels)
    label_w: 600,                       // how wide labels are (pixels)
    conn_pad: 36,                       // padding between conns (pixels)
    server_pad: 48,                     // padding between servers (pixels)
    show_referer_elements: true,        // default
    show_location_elements: true,       // default
    show_ack_elements: true,            // default

    // don't adjust these
    pix_per_sec: default_pix_per_sec,   // pixels per second
    y: margin[0],                       // tracks y value
    urls: {},                           // tracks url relationships
    server_names: undefined,            // ip->name mapping
    capture: {},                        // the capture
    capture_idx: {},                    // index into the capture
    capturing: false,                   // whether we're capturing now
    selected: undefined,                // selected item
    referer_elements: [],               // referer elements
    location_elements: [],              // location elements
    ack_elements: [],                   // ack-only packet elements
  
		// reset the UI and state to defaults  
		clear: function () {
		  var self = this;
		  self.clear_state();
		  self.clear_ui();
		},
		
		clear_state: function () {
		  var self = this;
		  self.pix_per_sec = default_pix_per_sec;
		  self.capture = {};
		  self.capture_idx = {};
		  self.server_names = undefined;
		  self.show_referer_elements = true;
		  self.show_location_elements = true;
		  self.show_ack_elements = true;
		},
		
		clear_ui: function() {
		  var self = this;
		  self.y = margin[0];
		  self.urls = {};
		  self.selected = undefined;
		  self.referer_elements = [];
		  self.location_elements = [];
		  self.ack_elements = [];
		  paper.clear();
		  labels.clear();      

		},

    // update with new capture data and re-render
    update: function (capture) {
      var self = this;
      self.clear();
      self.capture = capture;
      self.capture_idx = index_capture(capture);
      self.render();      
    },

    // render the data
    render: function () {
      var self = this;

      self.clear_ui();
      self.resize();
      self.draw_scale();

      self.capture_idx.servers.forEach(function (bundle) {
        var server_name = bundle[0];
        var conn_ids = bundle[1];
        var i;
        self.y += self.server_pad;
        self.draw_server_label(server_name);
        self.y += self.server_pad;
        conn_ids.forEach(function (conn_id) {
          var conn = self.capture.sessions[server_name][conn_id];
          htracr.connection(conn).draw(
            di, [server_name, conn_id, undefined, 0]);
          i = 0;
          conn.http_reqs.forEach(function (http_req) {
            var msg = htracr.http_msg(http_req);
            msg.kind = "req";
            msg.draw(di, [server_name, conn_id, 'http_reqs', i]);
            i += 1;
          });
          i = 0;
          conn.http_ress.forEach(function (http_req) {
            var msg = htracr.http_msg(http_req);
            msg.kind = "res";
            msg.draw(di, [server_name, conn_id, 'http_ress', i]);
            i += 1;
          });
          i = 0;
          conn.packets.forEach(function (packet) {
            var pkt = htracr.packet(packet);
            pkt.draw(di, [server_name, conn_id, 'packets', i]);
            i += 1;
          });
          self.y += self.conn_pad;
        });
        
        self.draw_referers();
        self.draw_locations();
      });
    },
  
    // change the paper and label sizes to suit the capture
		resize: function() {
			var self = this;
			var idx = self.capture_idx;
      self.w = (
        (idx.end - idx.start) / 1000 * self.pix_per_sec) + 
        margin[1] + margin[3];
      self.h = margin[0] + margin[2];
      for (var s in idx.servers) {
        self.h += (self.server_pad * 2);
        self.h += ((idx.servers[s][1].length) * self.conn_pad);
      }
			console.log("resizing to " + self.w + " x " + self.h);
			paper.setSize(self.w, self.h);
			labels.setSize(self.label_w, self.h);
		},

    // draw scale markings appropriate for the capture
    draw_scale: function () {
      var self = this;
      var start_x = time_x(self.capture_idx.start);
      var end_x = time_x(self.capture_idx.end);
      var end_y = self.h - margin[2];
      var end_attrs = {
        stroke: "#666",
        "stroke-width": "1"
      };
      var label_attrs = {
        fill: "white",
        "font-size": "16",
        "opacity": ".5"
      };
      paper.path(
        "M" + start_x + "," + margin[0] + " " +
        "L" + start_x + "," + end_y).attr(end_attrs);
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
      for (var i = self.capture_idx.start; i < self.capture_idx.end; i += m) {
        var i_x = time_x(i);
        paper.path(
          "M" + i_x + "," + margin[0] + " " +
          "L" + i_x + "," + end_y
        ).attr({
          stroke: "#444",
          "stroke-width": "1"
        });
        paper.text(i_x, end_y + 10,
          ((i - self.capture_idx.start) / 1000) + "s").attr(label_attrs);
        paper.text(i_x, margin[0] - 20,
          ((i - self.capture_idx.start) / 1000) + "s").attr(label_attrs);
      }
      paper.path(
        "M" + end_x + "," + margin[0] + " " +
        "L" + end_x + "," + end_y
      ).attr(end_attrs);
    },

    draw_server_label: function (label) {
      var self = this;
      var server_name = di.server_name(label);
      labels.text(margin[3] * 2, self.y, server_name).attr({
        'font-size': 20,
        'text-anchor': 'start',
        'font-weight': 'bold',
        'fill': "#ccc",
        'opacity': '0.7'
      });
    },

    draw_referers: function () {
      var self = this;
      for (var referer in self.urls.referer) {
        if (self.urls.request_uri[referer]) {
          
          var s = self.urls.request_uri[referer].getEndPoint(1);
          self.urls.referer[referer].forEach(function (referee) {
            var e = referee.getEndPoint(-1);
            var ref_e = paper.curve(s, e);
            if (ref_e) {
              ref_e.attr({
                "stroke": "#aac",
                "stroke-width": "0.25px",
                "stroke-opacity": "0.25",
                "shape-rendering": "optimizeSpeed",
                "color-rendering": "optimizeSpeed"
              });
              ref_e.toBack();
              if (! self.show_referer_elements) {
                ref_e.hide();
              }
              self.referer_elements.push(ref_e);              
            }
          });
        }
      }
    },

    draw_locations: function () {
      var self = this;
      for (var location in self.urls.location) {
        var request_node = self.urls.request_uri[location];
        if (request_node) {
          var e = request_node.getEndPoint(1);
          var s = self.urls.location[location].getEndPoint(-1);
          var loc_e = paper.curve(s, e);
          if (loc_e) {
            loc_e.attr({
              "stroke": "#9c9",
              "stroke-width": "2px",
              "stroke-opacity": "0.6"
            });
            loc_e.toBack();
            if (! self.show_location_elements) {
              loc_e.hide();
            }
            self.location_elements.push(loc_e);            
          }
        }
      }
    },

    // change the zoom level and re-render
		zoom: function (val) {
			var self = this;
			console.log("zooming to " + val + "...");
			self.pix_per_sec = val;
			self.render();
		},

  	// set the message area's content
  	set_message: function (content) {
  		msg.html(content);
  	},

	  toggle_array: function (eid, arr_name) {
      var self = this;
      jQuery(eid).toggle(function (ev) {
        self[arr_name].forEach(function (e) {
          e.hide();
        });
        jQuery(eid).removeClass("on").addClass("off");
        self["show_" + arr_name] = false;
      }, function (ev) {
        self[arr_name].forEach(function (e) {
          e.show();
        });
        jQuery(eid).removeClass("off").addClass("on");
        self["show_" + arr_name] = true;
      });
    },

  	draw_logo: function () {
  	  if (logo === undefined) {
    		logo = paper.text(0, 50, "htracr").attr({
    			"fill": "white",
    			"font-size": "120",
    			'text-anchor': 'start',
    			'opacity': "0.02"
    		});
  	  }
  	},

		pulse_logo: function() {
			var self = this;
			self.capturing = true;
			if (logo === undefined) {
				self.draw_logo();
			}
			logo.animate({
				'opacity': '0.6',
				'fill': '#669'
			},
			1500, function() {
				self.unpulse_logo();
			});
		},

		unpulse_logo: function(done) {
			var self = this;
			if (done) {
				self.capturing = false;
			}
			if (logo === undefined) {
				draw();
			}
			logo.animate({
				'opacity': '0.02',
				'fill': 'white'
			},
			1500, function() {
				if (self.capturing) {
					self.pulse_logo();
				}
			});
		},

    handle_key: function (ch) {
      var self = this;
      if (! self.selected) {
        return true;
      }
      var cursor = self.selected.cursor.slice();
      var conn = self.capture.sessions[cursor[0]][cursor[1]];
      switch (ch.keyCode) {
        case 37: // left
          cursor[3] = Math.max(0, cursor[3] - 1);
          break;
        case 39: // right
          cursor[3] = Math.min(conn[cursor[2]].length - 1, cursor[3] + 1);
          break;
        case 38: // up
          switch (cursor[2]) {
            case 'packets':
              // TODO
              return false;
              break;
            case 'http_reqs':
              return true;
            case 'http_ress':
              cursor[2] = 'packets';
              cursor[3] = self.selected.start_packet;
              break;
            default:
              console.log('Unknown cursor kind: ' + cursor[2]);
              return true;
          }
          break;
        case 40: // down
          switch (cursor[2]) {
            case 'packets':
              // TODO
              return false;
              break;
            case 'http_reqs':
              cursor[2] = 'packets';
              cursor[3] = self.selected.start_packet;
              break;
            case 'http_ress':
              return true;
            default:
              console.log('Unknown cursor kind: ' + cursor[2]);
              return true;
          }
          break;
        default:
          return true;
      }
      var server = cursor[0];
      var conn_id = cursor[1];
      var kind = cursor[2];
      var offset = cursor[3];
      if (kind === undefined) {
        return false;
      }
      self.selected.uninspect();
      self.selected = self.capture.sessions[cursor[0]]
                                           [cursor[1]]
                                           [cursor[2]]
                                           [cursor[3]];
      self.selected.inspect();
      return false;
    }    
    
	};

  paper = new Raphael(document.getElementById("paper"), ui.w, ui.h);
  labels = new Raphael(document.getElementById("labels"), ui.label_w, ui.h);
  msg = jQuery("#msg");


  // object for data drawing use
  var di = {
    // draw a horizontal line from the time offsets start to end with
    // attrs. If start or end isn't set, use the left and right margins
    // respectively. y_adj can be used to adjust y.
    h_line: function (start, end, y_adj, attrs) {
      var start_x = time_x(start) || margin[3];
      var end_x = time_x(end) || ui.w - margin[1];
      var y = ui.y + y_adj;
      var e = paper.path(
        "M" + start_x + "," + y + " " +
        "L" + end_x + "," + y
      ).attr(attrs || {});
      return e;
    },
  
    // draw a line at when from y as far as len pixels with attrs.
    v_line: function (when, len, attrs) {
      var x = time_x(when);
      var end_y = ui.y + len;
      var e = paper.path(
        "M" + x + "," + ui.y + " " +
        "L" + x + "," + end_y
      ).attr(attrs || {});
      return e;    
    },
  
    server_name: function (server) {
      var self = this;
      if (ui.server_names === undefined) {
        ui.server_names = htracr.comm.get_servers();
      }
      return ui.server_names[server] || server;
    },
    
    // save the cursor location for a named value
    save: function (name, value, cursor, single) {
      if (value) {
        if (! htracr.ui.urls[name]) {
          ui.urls[name] = {};
        }
        if (single === true) {
          ui.urls[name][value] = cursor;
        } else {
          if (! ui.urls[name][value]) {
            ui.urls[name][value] = [];
          }
          ui.urls[name][value].push(cursor);
        }
      }
    }
  };

  // given a time, return the corresponding x value for paper
  function time_x (t) {
    var self = this;
    if (t === null) {
      return null;
    }
    var delta = t - ui.capture_idx.start;
    if (delta < 0) {
      console.log('Negative delta for time ' + t);
    }
    var pix = delta * ui.pix_per_sec / 1000;
    var x = margin[3] + pix;
    return x;
  }

  // Given a hash of {server: {conn_id: [...]}}, return an ordered list
  // of [server_name, [conn_id1...], start], based upon first connection.
  function index_capture (capture) {

    function server_sortfunc (a, b) {
      return capture.sessions[a[0]][a[1][a[1].length - 1]].start -
             capture.sessions[b[0]][b[1][b[1].length - 1]]
    }

    function conn_sortfunc (a, b) {
      return a.start - b.start;
    }

    var servers = [];
    var start;
    var end;
    for (var server_id in capture.sessions) {
      if (capture.sessions.hasOwnProperty(server_id)) {
        var conns = [];
        for (var conn_id in capture.sessions[server_id]) {
          if (capture.sessions[server_id].hasOwnProperty(conn_id)) {
            var conn = capture.sessions[server_id][conn_id];
            if (conn.http_reqs.length) {
              conns.push(conn);
            }
          }
        }
        conns.sort(conn_sortfunc);
        var conn_ids = [];
        conns.forEach(function (conn) {
          conn_ids.push(conn.local_port);
          
        })

        if (conn_ids.length) {
          if (! start || conns[0].start < start) {
            start = conns[0].start || capture.start;
          }
          if (! end || conns[conns.length - 1].end > end) {
            end = conns[conns.length - 1].end || capture.end;
          }
          servers.push([server_id, conn_ids]);
        }
      }
    }
    servers.sort(server_sortfunc);
    return {
      start: start,
      end: end,
      servers: servers
    };
  }

  // setup
  jQuery.noConflict();
  jQuery(document).ready(function () {  
    jQuery("#stop").hide();
    jQuery("#filename").hide();
    jQuery("#panel").draggable();
    jQuery("#panel").resizable({
      stop: function (event, ui) {
        jQuery("#panel").css('position', 'fixed');
      }
    });
    jQuery("#zoom").slider({
      max: 10000,
      min: 100,
      step: 50,
      value: default_pix_per_sec,
      change: function (event, slider) {
        var orig_w = ui.w;
        var orig_scroll = jQuery(window).scrollLeft();
        ui.zoom(slider.value);
        var new_w = ui.w;
        var new_scroll = (orig_scroll / orig_w) * new_w;
        jQuery(window).scrollLeft(new_scroll);
      }
    });
    jQuery("#show-upload").click(function() {
      jQuery("#show-upload").hide();
      jQuery("#filename").show();
      jQuery("#filename").change(function() {
        jQuery("#upload").submit();
      });
    });
    ui.toggle_array("#refs", "referer_elements");
    ui.toggle_array("#redirs", "location_elements");
    ui.toggle_array("#acks", "ack_elements");
    jQuery(window).scroll(function () {
      jQuery('#labels').css('top', -(jQuery(window).scrollTop()));
    });
    jQuery("html").keydown(function(ch){return ui.handle_key(ch)});
    htracr.comm.update_state();
    htracr.ui.draw_logo();
  });

	return ui;
}();
