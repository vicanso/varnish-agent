'use strict';
const config = require('../config');
const MicroService = require('micro-service');

module.exports = new MicroService(getOptions());


/**
 * [getOptions description]
 * @return {[type]} [description]
 */
function getOptions() {
	const url = require('url');
	const urlInfo = url.parse(config.register);
	return {
		host: urlInfo.hostname,
		port: parseInt(urlInfo.port),
		key: urlInfo.path.substring(1)
	};
}