'use strict';
const logger = require('./lib/logger');
const varnish = require('./lib/varnish');
const config = require('./config');
const httpServer = require('./lib/server');
const server = httpServer.start();
const stats = require('./lib/stats');
logger.init();
varnish.start(config.tags, {
	name: 'default-backend',
	ip : '127.0.0.1',
	port: server.address().port
});
stats.start(10 * 1000);





