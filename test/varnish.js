'use strict';
const assert = require('assert');
const varnish = require('../lib/varnish');
const client = require('../lib/client');

describe('varnish', () => {
	client.list = () => {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve([{
					"value": {
						"name": "timtam",
						"prefix": "/timtam",
						"ip": "127.0.0.1",
						"port": 3000
					}
				}, {
					"value": {
						"name": "timtam",
						"prefix": "/timtam",
						"ip": "127.0.0.1",
						"port": 3010
					}
				}]);
			}, 100);
		});
	}

	it('start to create varnish vcl success', done => {
		varnish.start(['backend:http']).then(data => {
			console.dir(data);
		});
	});
});