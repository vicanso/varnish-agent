'use strict';
const varnishd = require('./varnishd');
const config = require('../config');
const _ = require('lodash');
const Influx = require('influxdb-nodejs');
const client = getClient();
var currentStatsData;

exports.start = start;

function start(interval) {
	setInterval(stats, interval).unref();
}


function stats() {
	varnishd.stats().then(data => {
		if (!data || !data.createdAt) {
			console.error('get varnish stats fail');
			return;
		}
		const statsData = {
			cache: getCacheStats(data),
			sess: getSessStats(data),
			backend: getBackendStats(data),
			client: getClientStats(data),
			fetch: getFetchStats(data),
			threads: getThreadsStats(data),
			n: getNStats(data)
		};
		if (client) {
			writeStats(statsData, currentStatsData);
			currentStatsData = statsData;
		} else {
			console.info(`varnish stats:${JSON.stringify(statsData)}`);
		}
	}).catch(err => {
		console.error(err);
	});
}

function writeStats(newData, oldData) {
	oldData = oldData || {};
	_.forEach(newData, (data, type) => {
		const tags = {
			inst: config.name
		};
		const fields = {};
		const tmpData = oldData[type] || {};
		_.forEach(data, (v, k) => {
			fields[k] = v - (tmpData[k] || 0);
		});
		client.write(type)
			.tag(tags)
			.field(fields)
			.queue();
	});
	client.syncWrite().catch(err => {
		console.error(`influx sync data:${JSON.stringify(err.data)}`);
		console.error(err);
	});
}

function getClient() {
	if (!config.influx) {
		return;
	}
	const client = new Influx(config.influx);
	client.createDatabaseNotExists().catch(err => {
		console.error(err);
	});
	return client;
}

function getClientStats(data) {
	const keys = 'req_400 req_417 req'.split(' ');
	return getStats(data, 'client', keys);
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
	const keys = 'conn unhealthy busy fail reuse recycle retry req'.split(' ');
	return getStats(data, 'backend', keys);
}

function getFetchStats(data) {
	const keys = 'head length chunked eof bad none 1xx 204 304 failed no_thread'.split(' ');
	return getStats(data, 'fetch', keys);
}

function getThreadsStats(data) {
	const keys = 'total limited created destroyed failed queue_len'.split(' ');
	return getStats(data, 'threads', keys);
}

function getNStats(data) {
	const keys = 'object vampireobject objectcore objecthead waitinglist backend expired lru_nuked lru_moved purges obj_purged'.split(' ');
	return getStats(data, 'n', keys);
}


function getStats(data, type, keys) {
	const result = {};
	const convertKeys = {
		'threads_total': 'threads',
		'threads_queue_len': 'thread_queue_len'
	};
	_.forEach(keys, key => {
		let tmp = `${type}_${key}`;
		if (convertKeys[tmp]) {
			tmp = convertKeys[tmp];
		}
		const v = _.get(data, tmp, 0);
		if (key === 'length') {
			key = 'len';
		}
		result[key] = v;
	});
	return result;
}