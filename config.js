'use strict';

exports.register = process.env.REGISTER || 'http://127.0.0.1:2379/backend';

exports.logServer = process.env.LOG;


exports.name = process.env.NAME || `varnish-${process.env.HOSTNAME || Date.now()}`;

exports.tags = (process.env.BACKEND_TAG || 'backend:http').split(',');

exports.pwd = process.env.PASSWORD || 'pwd';