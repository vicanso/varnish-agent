'use strict';
const MicroService = require('micro-service');
const _ = require('lodash');
const client = new MicroService(getOptions());
const varnishGenerator = require('varnish-generator');
const varnishName = process.env.NAME || process.env.HOSTNAME || `varnish-${Date.now()}`;
const crc32 = require('buffer-crc32');
const fs = require('fs');
const spawn = require('child_process').spawn;
const backendTags = (process.env.BACKEND_TAG || 'backend:http').split(',');
const interval = 6 * 1000;
const globalConfig = {
	version: '',
	vclFile: '',
	updateList: []
};

start();

/**
 * [start description]
 * @return {[type]} [description]
 */
function start() {
	let version = '';
	getBackends().then(backends => {
		version = getVersion(backends);
		return writeVcl(backends, version);
	}).then(data => {
		const file = data.file;
		varnishd(file);
		globalConfig.version = version;
		globalConfig.vclFile = file;
		setTimeout(loop, interval);
	}).catch(err => {
		console.error(err);
	});
}

/**
 * [loop description]
 * @return {[type]} [description]
 */
function loop() {
	let version = '';
	let file = '';
	getBackends().then(backends => {
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
		}
		setTimeout(loop, interval);
	}).catch(err => {
		console.error(err);
		setTimeout(loop, interval);
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
 * [getOptions description]
 * @return {[type]} [description]
 */
function getOptions() {
	const url = require('url');
	const urlInfo = url.parse(process.env.REGISTER || 'http://127.0.0.1:2379/backend');
	return {
		host: urlInfo.hostname,
		port: parseInt(urlInfo.port),
		key: urlInfo.path.substring(1)
	};
}

/**
 * [getBackends description]
 * @return {[type]} [description]
 */
function getBackends() {
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
			const file = `/tmp/${date}.vcl`;
			fs.writeFile(`/tmp/${date}.vcl`, vcl, err => {
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
	const args = `-f ${file} -s malloc,256m -a 0.0.0.0:8080 -F`.split(' ');
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