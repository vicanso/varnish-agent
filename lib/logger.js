'use strict';
const winston = require('winston');
const _ = require('lodash');
const pkg = require('../package')
const mkdirp = require('mkdirp');
const path = require('path');

let transports = [];
if (process.NODE_ENV !== 'production') {
  transports.push(new(winston.transports.Console)({
    timestamp: true
  }));
} else {
  let logPath = path.join('/var/log', pkg.name);
  mkdirp.sync(logPath);
  transports.push(
    new(winston.transports.File)({
      name: 'file-log',
      filename: path.join(logPath, 'out.log'),
      timestamp: true
    })
  );
  transports.push(
    new(winston.transports.File)({
      name: 'file-error',
      filename: path.join(logPath, 'err.log'),
      level: 'error',
      timestamp: true
    })
  );
}

const logger = new(winston.Logger)({
  transports: transports
});

_.forEach(_.functions(console), function(fn) {
  if (_.isFunction(logger[fn])) {
    console[fn] = function() {
      logger[fn].apply(logger, arguments);
    };
  }
});

exports.logger = logger;
