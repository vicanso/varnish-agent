'use strict';
const crc32 = require('buffer-crc32');
const varnishGenerator = require('varnish-generator');
const varnishName = process.env.NAME || `varnish-${process.env.HOSTNAME || Date.now()}`;
const fs = require('fs');
const spawn = require('child_process').spawn;
const path = require('path');
const _ = require('lodash');
const client = require('./client');

const globalConfig = {
	version: '',
	vclFile: '',
	updateList: []
};

exports.start = start;

exports.interval = 60 * 1000;

exports.vclPath = '/tmp';

function start(backendTags) {
	let version = '';
	return getBackends(backendTags).then(backends => {
		if (!backends || !backends.length) {
			throw new Error('backend is empty');
		}
		version = getVersion(backends);
		return writeVcl(backends, version);
	}).then(data => {
		const file = data.file;
		varnishd(file);
		globalConfig.version = version;
		globalConfig.vclFile = file;
		setTimeout(() => {
			loop(backendTags);
		}, exports.interval);
		console.info(`start varnishd use ${file}`);
		return file;
	}).catch(err => {
		setTimeout(start, exports.interval);
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
			const file = path.join(exports.vclPath, `${date}.vcl`);
			fs.writeFile(file, vcl, err => {
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


/**
 * [varnishd description]
 * @param  {[type]} file [description]
 * @return {[type]}      [description]
 */
function varnishd(file) {
	const args = `-f ${file} -s malloc,256m -a 0.0.0.0:8081 -F`.split(' ');
	const cmd = spawn('varnishd', args);
	cmd.on('error', function(err) {
		console.error(err);
	});
	cmd.on('close', function(code) {
		process.exit(code);
	});
	cmd.stdout.on('data', function(msg) {
		console.info(msg.toString());
	});
	cmd.stderr.on('data', function(msg) {
		console.error(msg.toString());
	});
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
function loop(backendTags) {
	let version = '';
	let file = '';
	getBackends(backendTags).then(backends => {
		if (!backends || !backends.length) {
			throw new Error('backend is empty');
		}
		version = getVersion(backends);
		if (version !== globalConfig.version) {
			return writeVcl(backends, version);
		} else {
			return Promise.resolve();
		}
	}).then(data => {
		file = _.get(data, 'file');
		if (file) {
			return varnishdLoadVcl(data.date, file);
		} else {
			return Promise.resolve();
		}
	}).then(status => {
		if (status === 'success') {
			globalConfig.version = version;
			globalConfig.vclFile = file;
			console.info(`reload varnishd use ${file}`);
		}
		setTimeout(() => {
			loop(backendTags);
		}, exports.interval);
	}).catch(err => {
		console.error(err);
		setTimeout(() => {
			loop(backendTags);
		}, exports.interval);
	});
}

/**
 * [varnishdLoadVcl description]
 * @param  {[type]} tag  [description]
 * @param  {[type]} file [description]
 * @return {[type]}      [description]
 */
function varnishdLoadVcl(tag, file) {
	const load = function() {
		return new Promise(function(resolve, reject) {
			const cmd = spawn('varnishadm', ['vcl.load', tag, file]);
			cmd.on('error', function(err) {
				console.error(err);
			});
			cmd.on('close', function(code) {
				if (code === 0) {
					resolve('success');
				} else {
					reject(code);
				}
			});
			cmd.stdout.on('data', function(msg) {
				console.info(msg.toString());
			});
			cmd.stderr.on('data', function(msg) {
				console.error(msg.toString());
			});
		});
	};

	const use = function() {
		return new Promise(function(resolve, reject) {
			const cmd = spawn('varnishadm', ['vcl.use', tag]);
			cmd.on('error', function(err) {
				console.error(err);
			});
			cmd.on('close', function(code) {
				if (code === 0) {
					resolve('success');
				} else {
					reject(code);
				}
			});
			cmd.stdout.on('data', function(msg) {
				console.info(msg.toString());
			});
			cmd.stderr.on('data', function(msg) {
				console.error(msg.toString());
			});
		});
	};

	return load().then(use);
}
