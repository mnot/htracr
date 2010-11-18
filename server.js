var fs = require("fs");
var http = require('http');
var path = require("path");
var url = require("url");


// load static assets
function load(name, media_type) {
  return [fs.readFileSync("lib/" + name), media_type];
}
var static = {
  'raphael': load('raphael-min.js', 'application/javascript'),
  'jquery': load('jquery-min.js', 'application/javascript'),
  'jquery-ui': load('jquery-ui-min.js', 'application/javascript'),
  'jquery-ui-style': load('jquery-ui.css', 'text/css'),
  'zoom': load('zoom.js', 'application/javascript'),
  '': load('htracr.html', 'text/html'),
}
  
function req_done(request, response, htracr) {
  var path = url.parse(request.url).pathname;
  var path_segs = path.split("/");
  path_segs.shift();
  var seg = path_segs.shift();
  switch (seg) {
    case 'conns':
      response.writeHead(200, {
        'Content-Type': 'application/json'
      })
      response.end(JSON.stringify(htracr.conns))
      break;
    case 'clear':
      // FIXME: check method
      htracr.conns = {}
      response.writeHead(200, {})
      response.end()
    case 'stop':
      // FIXME: check method
      response.writeHead(200, {})
      response.end()
    default:
      if (seg in static) {
        response.writeHead(200, {
          'Content-Type': static[seg][1],
          'Cache-Control': "max-age=7200"
        })
        response.end(static[seg][0])
      } else {
        response.writeHead(404, {'Content-Type': "text/html"});
        response.end("<html><body><h1>Not Found</h1></body></html>")
      }
      break;
  }
};

exports.start = function(port, htracr) {
  http.createServer(function (request, response) {
    request.input_buffer = "";
    request.on('data', function(chunk) {
      request.input_buffer += chunk;
    });
    request.on('end', function() {
      req_done(request, response, htracr);
    });
  }).listen(port);  
  console.log('Server running on port ' + port + '.');
}
  
