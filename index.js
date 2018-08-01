'use strict';
const path = require('path');
const childProcess = require('child_process');
const tasklist = require('tasklist');
const pify = require('pify');
const mypid = require('process').pid;

function win() {
	return tasklist().then(data => {
		return data.map(x => {
			return {
				pid: x.pid,
				name: x.imageName,
				cmd: x.imageName
			};
		});
	});
}

function def(options = {}) {
	const ret = {};
	const flags = (options.all === false ? '' : 'a') + 'wwxo';
	const includeSelf = options.includeSelf;

	return Promise.all(['comm', 'args', 'ppid', '%cpu', '%mem'].map(cmd => {
		return pify(childProcess.execFile)('ps', [flags, `pid,${cmd}`]).then(stdout => {
			for (let line of stdout.trim().split('\n').slice(1)) {
				line = line.trim();
				const [pid] = line.split(' ', 1);
				const val = line.slice(pid.length + 1).trim();

				if (ret[pid] === undefined) {
					ret[pid] = {};
				}

				ret[pid][cmd] = val;
			}
		});
	})).then(() => {
		// Filter out inconsistencies as there might be race
		// issues due to differences in `ps` between the spawns
		// TODO: Use `Object.entries` when targeting Node.js 8
		if (includeSelf) {
			return Object.keys(ret).filter(x => ret[x].comm && ret[x].args && ret[x].ppid && ret[x]['%cpu'] && ret[x]['%mem']).map(x => {
				return {
					pid: Number.parseInt(x, 10),
					name: path.basename(ret[x].comm),
					cmd: ret[x].args,
					ppid: Number.parseInt(ret[x].ppid, 10),
					cpu: Number.parseFloat(ret[x]['%cpu']),
					memory: Number.parseFloat(ret[x]['%mem'])
				};
			});
		} else {
			return Object.keys(ret).filter(x => ret[x].comm && ret[x].args && ret[x].ppid && ret[x]['%cpu'] && ret[x]['%mem']).filter(x => parseInt(x, 10) !== mypid).map(x => {
				return {
					pid: Number.parseInt(x, 10),
					name: path.basename(ret[x].comm),
					cmd: ret[x].args,
					ppid: Number.parseInt(ret[x].ppid, 10),
					cpu: Number.parseFloat(ret[x]['%cpu']),
					memory: Number.parseFloat(ret[x]['%mem'])
				};
			});
		}
	});
}

module.exports = process.platform === 'win32' ? win : def;
