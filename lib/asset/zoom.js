/*
 * raphael.zoom 0.0.4
 *
 * Copyright (c) 2010 Wout Fierens - http://boysabroad.com
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */

// get all elements in the paper
Raphael.fn.elements = function() {
  var b = this.bottom,
      r = [];
  while (b) {
    r.push(b);
    b = b.next;
  }
  return r;
}

// initialize zoom of paper
Raphael.fn.initZoom = function(zoom) {
  var elements = this.elements();
  this.zoom = zoom || 1;

  for (var i = 0; i < elements.length; i++) {
    elements[i].initZoom();
  }

  return this;
}

// set the zoom of all elements
Raphael.fn.setZoom = function(zoom) {
  if (!zoom) return;

  var elements = this.elements();
  if (!this.zoom)
    this.initZoom();

  for (var i = 0; i < elements.length; i++) {
    elements[i].setZoom(zoom);
  }
  this.zoom = zoom;

  return this;
}

// initialize zoom of element
Raphael.el.initZoom = function(zoom) {
  var sw = parseFloat(this.attr("stroke-width")) || 0;
  zoom = zoom || this.paper.zoom;

  if (this.type != "text") sw /= zoom;
  this.zoom = zoom;
  this.zoom_memory = {
    "stroke-width": sw,
    rotation:       360
  };

  this.setStrokeWidth(sw / zoom);

  if (this.type == "text") {
    var fs = parseFloat(this.attr("font-size")) || 0
    this.zoom_memory["font-size"] = fs;
    this.zoom_memory["x"] = (parseFloat(this.attrs["x"]) || 0) / zoom;
    this.zoom_memory["y"] = (parseFloat(this.attrs["y"]) || 0) / zoom;
  }
  return this;
}

// zoom element preserving some original values
Raphael.el.setZoom = function(zoom) {
  if (!zoom) return;
  if (!this.zoom_memory)
    this.initZoom();

  // scale to zoom
  var new_zoom = zoom / this.zoom;
  this.scale(new_zoom, new_zoom, 0, 0);
  this.applyScale();

  // save new zoom
  this.zoom = zoom;
  this.setStrokeWidth(this.zoom_memory["stroke-width"]);

  if (this.type == "text")
    this.attr({
      "font-size":  this.zoom_memory["font-size"] * zoom,
      "x":          this.zoom_memory["x"] * zoom,
      "y":          this.zoom_memory["y"] * zoom
    });

  return this;
}

// set element zoomed attributes
Raphael.el.setAttr = function() {
  if (typeof arguments[0] == "string") {
    attr = {};
    attr[arguments[0]] = arguments[1];
  } else {
    attr = arguments[0];
  }

  for (var key in attr) {
    switch(key) {
      case "stroke-width":
        this.setStrokeWidth(attr[key]);
      break;
      case "font-size":
        this.setFontSize(attr[key]);
      break;
      case "x":
      case "y":
        if (this.type == "text")
          this.zoom_memory[key] = attr[key] / this.zoom;
        this.attr(key, attr[key]);
      break;
      default:
        this.attr(key, attr[key]);
      break;
    }
  }
  return this;
}

// set element translation
Raphael.el.setTranslation = function(x, y) {
  if (this.type == "text")
    this.setAttr({
      x: this.attrs["x"] + x,
      y: this.attrs["y"] + y
    });
  else
    this.translate(x,y);

  return this;
}

// set element rotation
Raphael.el.setRotation = function(angle, x, y) {
  if (!this.zoom_memory) this.initZoom();
  if (angle == 0)
    angle = 360;
  this.rotate(angle, x, y);
  this.zoom_memory.rotation = angle;
  this.transformations = [];
  this._.rt = { cx: null, cy: undefined, deg: 360 };

  return this;
}

// set element zoomed stroke width
Raphael.el.setStrokeWidth = function(value) {
  if (value == 0 || (value = parseFloat(value))) {
    this.attr({ "stroke-width": value * this.zoom });
    this.zoom_memory["stroke-width"] = value;
  }

  return this;
}

// set element font size
Raphael.el.setFontSize = function(value) {
  if (value == 0 || (value = parseFloat(value))) {
    this.attr({ "font-size": value * this.zoom });
    this.zoom_memory["font-size"] = value;
  }

  return this;
}

// apply the current scale and reset it to 1
Raphael.el.applyScale = function() {
  this._.sx = 1;
  this._.sy = 1;
  this.scale(1, 1);

  return this;
}

