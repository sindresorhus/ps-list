'use strict';
var childProcess = require('child_process');
var tasklist = require('tasklist');

function win(cb) {
	tasklist(function (err, data) {
		if (err) {
			cb(err);
			return;
		}

		var ret = data.map(function (el) {
			return {
				pid: el.pid,
				name: el.imageName
			};
		});

		cb(null, ret);
	});
}

function def(opts, cb) {
	if (typeof opts !== 'object') {
		cb = opts;
		opts = {};
	}

	var columns = 'pid,' + (opts.args ? 'args' : 'comm');

	childProcess.execFile('ps', ['axo', columns], function (err, stdout) {
		if (err) {
			cb(err);
			return;
		}

		var ret = stdout.trim().split('\n').slice(1).map(function (el) {
			var parts = el.trim().split(/\d /);
			return {
				pid: Number(parts[0]),
				name: parts[1]
			};
		});

		cb(null, ret);
	});
}

module.exports = process.platform === 'win32' ? win : def;
