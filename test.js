'use strict';
var test = require('ava');
var psList = require('./');

test(function (t) {
	t.plan(2);

	var binName = process.platform === 'win32' ? 'node.exe' : 'node';

	psList(function (err, list) {
		t.assert(!err, err);
		t.assert(list.some(function (el) {
			return el.name.indexOf(binName) !== -1;
		}));
	});
});
