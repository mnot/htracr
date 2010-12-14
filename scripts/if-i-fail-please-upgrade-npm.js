#!/usr/bin/env node

var npm = require("npm")
var semver = require("./semver")

if (! semver.satisfies(npm.version, ">=0.2.11")) 
  throw new Error(
    process.env.npm_package_name + 
    " cannot be installed by " +
    "npm@" + 
    npm.version + 
    "\nPlease upgrade npm and try again.\n"
  )