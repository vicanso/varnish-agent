'use strict';
const varnishd = require('./varnishd');
const config = require('../config');
const _ = require('lodash');
var currentStatsData;

exports.start = start;

function start(interval) {
	setInterval(stats, interval).unref();
}


function stats() {
	varnishd.stats().then(data => {
		const statsData = {
			cache: getCacheStats(data),
			sess: getSessStats(data),
			backend: getBackendStats(data),
			fetch: getFetchStats(data)
		};

		if (currentStatsData) {
			writeStats(statsData, currentStatsData);
		}
		// console.dir(statsData)
		currentStatsData = statsData;
	}).catch(err => {
		console.error(err);
	});
}

function writeStats(newData, oldData) {
	_.forEach(newData, (data, type) => {
		const tags = {
			inst: config.name,
			type: type
		};
		const values = {};
		const tmpData = oldData[type];
		_.forEach(data, (v, k) => {
			values[k] = v - tmpData[k];
		});
		console.dir(tags);
		console.dir(values);
	});
}


function getCacheStats(data) {
	const keys = 'hit hitpass miss'.split(' ');
	return getStats(data, 'cache', keys);
}

function getSessStats(data) {
	const keys = 'conn drop fail queued dropped closed closed_err readahead herd'.split(' ');
	return getStats(data, 'sess', keys);
}


function getBackendStats(data) {
	const keys = 'conn unhealthy busy fail reuse recycle retry'.split(' ');
	return getStats(data, 'backend', keys);
}

function getFetchStats(data) {
	const keys = 'head length chunked eof bad none 1xx 204 304 failed no_thread'.split(' ');
	return getStats(data, 'fetch', keys);
}


function getStats(data, type, keys) {
	const result = {};
	_.forEach(keys, key => {
		const v = _.get(data, `MAIN.${type}_${key}`).value;
		if (key === 'length') {
			key = 'len';
		}
		result[key] = v;
	});
	return result;
}