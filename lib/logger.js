'use strict';
const config = require('../config');
const logger = require('timtam-logger');
const url = require('url');

exports.init = init;

function init() {
	const logUrl = config.logServer;
	if (!logUrl) {
		return;
	}
	const urlInfo = url.parse(logUrl);
	logger.set('app', 'varnish-agent');
	logger.set('extra', {
		process: config.name
	});
	logger.wrap(console);
	logger.add('udp', {
		port: parseInt(urlInfo.port),
		host: urlInfo.hostname
	});
}