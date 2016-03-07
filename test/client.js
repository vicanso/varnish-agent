'use strict';
const assert = require('assert');
const _ = require('lodash');
const client = require('../lib/client');

describe('client', () => {
	it('create micro-service client success', () => {
		assert(_.isFunction(client.list));
	});
});