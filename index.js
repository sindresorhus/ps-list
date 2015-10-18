'use strict';
var path = require('path');
var childProcess = require('child_process');
var tasklist = require('tasklist');
var pify = require('pify');
var Promise = require('pinkie-promise');
var TEN_MEBIBYTE = 1024 * 1024 * 10;

function win(opts) {
	opts = opts || {};

	return tasklist().then(function (data) {
		return data.map(function (x) {
			return {
				pid: x.pid,
				name: x.imageName,
				cmd: x.imageName
			};
		});
	});
}

function def(opts) {
	opts = opts || {};

	var ret = {};
	var flags = (opts.all !== false ? 'a' : '') + 'wwxo';

	return Promise.all(['comm', 'args'].map(function (cmd) {
		return pify(childProcess.execFile, Promise)('ps', [flags, 'pid,' + cmd], {
			maxBuffer: TEN_MEBIBYTE
		}).then(function (stdout) {
			stdout.trim().split('\n').slice(1).forEach(function (x) {
				x = x.trim();

				var pid = x.split(' ', 1)[0];
				var val = x.slice(pid.length + 1).trim();

				if (ret[pid] === undefined) {
					ret[pid] = {};
				}

				ret[pid][cmd] = val;
			});
		});
	})).then(function () {
		return Object.keys(ret).filter(function (x) {
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
	});
}

module.exports = process.platform === 'win32' ? win : def;
