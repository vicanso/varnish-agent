'use strict';
const http = require('http');

exports.start = start;

function start() {
	const server = http.createServer((req,res) => {
		res.setHeader('Content-Type', 'text/html');
		res.setHeader('X-Foo', 'bar');
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('ok');
	});
	server.listen();
	console.dir(server.address());
	return server;
}