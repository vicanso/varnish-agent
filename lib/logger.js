'use strict';
const winston = require('winston');
const _ = require('lodash');
const pkg = require('../package');
const mkdirp = require('mkdirp');
const path = require('path');
const util = require('util');

let transports = [];
if (process.env.NODE_ENV !== 'production') {
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
}

const logger = new(winston.Logger)({
  transports: transports
});

logger.log('afoejaofejaofjeoaf');

_.forEach(_.functions(console), function(fn) {
  if (_.isFunction(logger[fn])) {
    console[fn] = function() {
      let str = util.format.apply(util, arguments);
      logger[fn](str);
    };
  }
});

exports.logger = logger;
