var fs = require("fs");
var http = require('http');
var path = require("path");
var url = require("url");

// load static assets
var static = {
  'raphael': fs.readFileSync('lib/raphael-min.js'),
  'jquery': fs.readFileSync('lib/jquery-min.js'),
  'htracr': fs.readFileSync('lib/htracr.html'),
}

  
function req_done(request, response, htracr) {
  var path = url.parse(request.url).pathname;
  var path_segs = path.split("/");
  path_segs.shift();
  var root = path_segs.shift();
  switch (root) {
    case 'state':
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
    case 'raphael':
      response.writeHead(200, {
        'Content-Type': "application/javascript",
        'Cache-Control': "max-age=7200"
      })
      response.end(static['raphael']);
      break;
    case 'jquery':
      response.writeHead(200, {
        'Content-Type': "application/javascript",
        'Cache-Control': "max-age=7200"
      })
      response.end(static['jquery']);
      break;
    default:
      response.writeHead(200, {'Content-Type': 'text/html'});
      response.end(static['htracr']);
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
  
