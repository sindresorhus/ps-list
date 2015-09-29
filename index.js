'use strict';
var path = require('path');
var childProcess = require('child_process');
var tasklist = require('tasklist');
var eachAsync = require('each-async');
var TEN_MEBIBYTE = 1024 * 1024 * 10;

function win(opts, cb) {
	if (typeof opts !== 'object') {
		cb = opts;
		opts = {};
	}

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

function def(opts, cb) {
	if (typeof opts !== 'object') {
		cb = opts;
		opts = {};
	}

	var ret = {};
	var flags = (opts.all !== false ? 'a' : '') + 'wwxo';

	eachAsync(['comm', 'args'], function (cmd, i, next) {
		childProcess.execFile('ps', [flags, 'pid,' + cmd], {
			maxBuffer: TEN_MEBIBYTE
		}, function (err, stdout) {
			if (err) {
				next(err);
				return;
			}

			stdout.trim().split('\n').slice(1).forEach(function (x) {
				x = x.trim();

				var pid = x.split(' ', 1)[0];
				var val = x.slice(pid.length + 1).trim();

				if (ret[pid] === undefined) {
					ret[pid] = {};
				}

				ret[pid][cmd] = val;
			});

			next();
		});
	}, function (err) {
		if (err) {
			cb(err);
			return;
		}

		var list = Object.keys(ret).filter(function (x) {
			// filter out inconsistencies as there might be race
			// issues due to differences in `ps` between the spawns
			return ret[x].comm && ret[x].args;
		}).map(function (x) {
			return {
				pid: parseInt(x, 10),
				name: path.basename(ret[x].comm),
				cmd: ret[x].args
			};
		});

		cb(null, list);
	});
}

module.exports = process.platform === 'win32' ? win : def;
