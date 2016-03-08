'use strict';
const mkdirp = require('mkdirp');
const crc32 = require('buffer-crc32');
const config = require('../config');
const varnishGenerator = require('varnish-generator');
const varnishName = config.name;
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const client = require('./client');
const varnishd = require('./varnishd');
const globalConfig = {
	version: '',
	vclFile: '',
	updateList: []
};

exports.start = start;

exports.interval = 60 * 1000;

exports.vclPath = '/tmp';

exports.debug = false;

if (process.env.NODE_ENV === 'test') {
	exports.loop = loop;
}

function start(backendTags, defaultBackend) {
	let version = '';
	return getBackends(backendTags).then(backends => {
		/* istanbul ignore if */
		if (!backends || !backends.length) {
			throw new Error('backend is empty');
		}
		if (defaultBackend) {
			backends.push(defaultBackend);
		}
		version = getVersion(backends);
		return writeVcl(backends, version);
	}).then(data => {
		const file = data.file;
		startVarnishd(file);
		globalConfig.version = version;
		globalConfig.vclFile = file;
		setTimeout(() => {
			/* istanbul ignore next */
			loop(backendTags, defaultBackend);
		}, exports.interval).unref();
		console.info(`start varnishd use ${file}`);
		return file;
	}).catch(err => {
		/* istanbul ignore next */
		setTimeout(() => {
			start(backendTags, defaultBackend);
		}, exports.interval).unref();
		/* istanbul ignore next */
		console.error(err);
	});
}


/**
 * [getBackends description]
 * @param  {[type]} backendTags [description]
 * @return {[type]}             [description]
 */
function getBackends(backendTags) {
	return client.list(backendTags).then(data => {
		return _.map(data, tmp => {
			return tmp.value.config;
		});
	});
}


/**
 * [writeVcl description]
 * @param  {[type]} backends [description]
 * @param  {[type]} version  [description]
 * @return {[type]}          [description]
 */
function writeVcl(backends, version) {
	const writeFile = (date, vcl) => {
		return new Promise((resolve, reject) => {
			const vclPath = exports.vclPath;
			mkdirp.sync(vclPath);
			const file = path.join(vclPath, `${date}.vcl`);
			fs.writeFile(file, vcl, err => {
				/* istanbul ignore if */
				if (err) {
					reject(err);
				} else {
					resolve(file);
				}
			});
		});
	};
	const date = (new Date()).toISOString();
	const updateList = globalConfig.updateList.slice();
	updateList.push(date);
	return varnishGenerator.getVcl({
		backends: backends,
		name: varnishName,
		version: version,
		updatedAt: updateList.join()
	}).then(vcl => {
		return writeFile(date, vcl);
	}).then(file => {
		globalConfig.updateList.push(date);
		return {
			date: date,
			file: file
		};
	});
}

function startVarnishd(file) {
	if (exports.debug) {
		console.info(`run varnishd use vcl:${file}`);
		return;
	}
	/* istanbul ignore next */
	return varnishd.run(file);
}




/**
 * [getVersion description]
 * @param  {[type]} backends [description]
 * @return {[type]}          [description]
 */
function getVersion(backends) {
	const arr = _.map(backends, tmp => {
		return JSON.stringify(tmp);
	});
	return crc32.unsigned(arr.sort().join());
}


/**
 * [loop description]
 * @return {[type]} [description]
 */
function loop(backendTags, defaultBackend) {
	let version = '';
	let file = '';
	return getBackends(backendTags).then(backends => {
		/* istanbul ignore if */
		if (!backends || !backends.length) {
			throw new Error('backend is empty');
		}
		if (defaultBackend) {
			backends.push(defaultBackend);
		}
		version = getVersion(backends);
		if (version !== globalConfig.version) {
			return writeVcl(backends, version);
		} else {
			/* istanbul ignore next */
			return Promise.resolve();
		}
	}).then(data => {
		file = _.get(data, 'file');
		if (file) {
			return varnishdLoadVcl(data.date, file);
		} else {
			/* istanbul ignore next */
			return Promise.resolve();
		}
	}).then(status => {
		if (status === 'success') {
			globalConfig.version = version;
			globalConfig.vclFile = file;
			console.info(`reload varnishd use ${file}`);
		}
		setTimeout(() => {
			/* istanbul ignore next */
			loop(backendTags, defaultBackend);
		}, exports.interval).unref();
		return status;
	}).catch(err => {
		/* istanbul ignore next */
		console.error(err);
		/* istanbul ignore next */
		setTimeout(() => {
			loop(backendTags, defaultBackend);
		}, exports.interval).unref();
	});
}

/**
 * [varnishdLoadVcl description]
 * @param  {[type]} tag  [description]
 * @param  {[type]} file [description]
 * @return {[type]}      [description]
 */
function varnishdLoadVcl(tag, file) {
	if (exports.debug) {
		console.info(`varnish reload vcl, tag:${tag}, file:${file}`);
		return Promise.resolve('success');
	}
	/* istanbul ignore next */
	return varnishd.reload(tag, file);
}
