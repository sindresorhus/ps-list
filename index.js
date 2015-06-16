'use strict';
var path = require('path');
var childProcess = require('child_process');
var tasklist = require('tasklist');
var parseColumns = require('parse-columns');

function win(cb) {
	tasklist(function (err, data) {
		if (err) {
			cb(err);
			return;
		}

		var ret = data.map(function (el) {
			return {
				pid: el.pid,
				name: el.imageName,
				cmd: el.imageName
			};
		});

		cb(null, ret);
	});
}

function def(cb) {
	childProcess.execFile('ps', ['axo', 'pid,comm,args'], function (err, stdout) {
		if (err) {
			cb(err);
			return;
		}

		var ret = parseColumns(stdout, {
			headers: [
				'pid',
				'name',
				'cmd'
			],
			transform: function (el, header) {
				if (header === 'pid') {
					return Number(el);
				}

				if (header === 'name') {
					return path.basename(el);
				}

				return el;
			}
		});

		cb(null, ret);
	});
}

module.exports = process.platform === 'win32' ? win : def;
