'use strict';
const spawn = require('child_process').spawn;
const exec = require('child_process').exec;
const _ = require('lodash');
const fs = require('fs');
var currentFile;
exports.run = run;
exports.reload = reload;
exports.getCurrentVcl = getCurrentVcl;
exports.stats = stats;

/**
 * [getCurrentVcl description]
 * @return {[type]} [description]
 */
function getCurrentVcl() {
	return new Promise((resolve, reject) => {
		if (!currentFile) {
			return reject(new Error('there is not vcl file'));
		}
		fs.readFile(currentFile, 'utf8', (err, str) => {
			if (err) {
				reject(err);
			} else {
				resolve(str);
			}
		});
	});
}


function stats() {
	return new Promise(resolve => {
		const complete = (data) => {
			const statsData = {
				createdAt: Date.now()
			};
			delete data.timestamp;
			_.forEach(data, function(v, k) {
				k = k.replace('MAIN.', '');
				statsData[k] = v.value;
			});
			resolve(data);
		};
		const proc = exec('varnishstat -j -f MAIN.', {
			maxBuffer: 2048 * 1024
		});
		const list = [];
		proc.stdout.on('data', function(data) {
			list.push(data);
		});
		proc.on('close', function() {
			if (list.length === 0) {
				list.push('{}');
			}
			complete(JSON.parse(list.join('')));
		});
	});
}

/**
 * [run description]
 * @param  {[type]} file [description]
 * @return {[type]}      [description]
 */
function run(file) {
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
		console.info(msg.toString());
	});
	currentFile = file;
}


/**
 * [varnishdLoadVcl description]
 * @param  {[type]} tag  [description]
 * @param  {[type]} file [description]
 * @return {[type]}      [description]
 */
function reload(tag, file) {
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
					currentFile = file;
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