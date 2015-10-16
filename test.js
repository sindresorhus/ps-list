'use strict';
var test = require('ava');
var psList = require('./');

test(function (t) {
	t.plan(2);

	var binName = process.platform === 'win32' ? 'node.exe' : 'node';

	psList().then(function (list) {
		t.assert(list.some(function (x) {
			return x.name.indexOf(binName) !== -1;
		}));

		t.assert(list.every(function (x) {
			return typeof x.pid === 'number' &&
				typeof x.name === 'string' &&
				typeof x.cmd === 'string';
		}));
	});
});
