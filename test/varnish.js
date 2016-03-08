'use strict';
const assert = require('assert');
const rimraf = require('rimraf');
const varnish = require('../lib/varnish');
const client = require('../lib/client');
const fs = require('fs');

describe('varnish', () => {
	varnish.debug = true;

	varnish.vclPath = __dirname + '/vcl';

	it('start to create varnish vcl success', done => {
		client.list = () => {
			return new Promise((resolve, reject) => {
				setTimeout(() => {
					resolve([{"key":"/backend/00000000000000001407","value":{"config":{"port":3000,"ip":"172.17.0.8","name":"influx-stats","prefix":"/influx-stats"},"tags":["backend:http","app:influx-stats","ping:http"]},"expiration":"2016-03-08T01:50:25.426046767Z","ttl":402,"modifiedIndex":1669,"createdIndex":1669},{"key":"/backend/00000000000000000006","value":{"config":{"port":3000,"ip":"172.17.0.7","name":"timtam","prefix":"/timtam"},"tags":["backend:http","app:timtam","ping:http"]},"expiration":"2016-03-08T01:48:23.130221289Z","ttl":279,"modifiedIndex":1668,"createdIndex":1668}]);
				}, 100);
			});
		};

		varnish.start(['backend:http']).then(file => {
			assert(file);
			done();
		});
	});


	it('should reload vcl success', done => {
		client.list = () => {
			return new Promise((resolve, reject) => {
				setTimeout(() => {
					resolve([{"key":"/backend/00000000000000001407","value":{"config":{"port":3000,"ip":"172.17.0.9","name":"influx-stats","prefix":"/influx-stats"},"tags":["backend:http","app:influx-stats","ping:http"]},"expiration":"2016-03-08T01:50:25.426046767Z","ttl":402,"modifiedIndex":1669,"createdIndex":1669},{"key":"/backend/00000000000000000006","value":{"config":{"port":3000,"ip":"172.17.0.7","name":"timtam","prefix":"/timtam"},"tags":["backend:http","app:timtam","ping:http"]},"expiration":"2016-03-08T01:48:23.130221289Z","ttl":279,"modifiedIndex":1668,"createdIndex":1668}]);
				}, 100);
			});
		};

		varnish.loop(['backend:http']).then(status => {
			assert.equal(status, 'success');
			done();
		});

	});


	it('remove *.vcl success', done => {
		rimraf(varnish.vclPath, done);
	});
});