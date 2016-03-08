'use strict';
const http = require('http');
const url = require('url');
const querystring = require('querystring');
const varnishd = require('./varnishd');
const config = require('../config');

exports.start = start;

function start() {
	const server = http.createServer((req, res) => {
		requestHandler(req, res);
	});
	server.listen();
	return server;
}


function requestHandler(req, res) {
	const urlInfo = url.parse(req.url);
	if (urlInfo.pathname === '/ping') {
		return ping(res);
	}
	if (!urlInfo.query) {
		return forbidden(res, 'pwd can not be null');
	}
	if (querystring.parse(urlInfo.query).pwd !== config.pwd) {
		return forbidden(res, 'pwd is wrong');
	}
	switch (urlInfo.pathname) {
	case '/v-vcl':
		getVcl(res);
		break;
	case '/v-stats':
		getStats(res);
		break;
	default:
		res.writeHead(404, {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
		});
	}
}


function forbidden(res, msg) {
	res.writeHead(403);
	res.end(msg);
}


function getVcl(res) {
	varnishd.getCurrentVcl().then(str => {
		res.writeHead(200, {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
		});
		res.end(str);
	}).catch(err => {
		res.writeHead(500, {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
		});
		res.end(err.message);
	});
}


function getStats(res) {
	varnishd.stats().then(data => {
		res.writeHead(200, {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
		});
		res.end(JSON.stringify(data));
	}).catch(err => {
		res.writeHead(500, {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
		});
		res.end(err.message);
	});
}


function ping(res) {
	res.writeHead(200, {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
	});
	res.end('OK');
}