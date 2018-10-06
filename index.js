'use strict';
const path = require('path');
const childProcess = require('child_process');
const pify = require('pify');

const TEN_MEGABYTES = 1000 * 1000 * 10;

function win() {
	const bin = path.join(__dirname, 'fastlist.exe');
	return pify(childProcess.execFile)(bin, {maxBuffer: TEN_MEGABYTES})
		.then(stdout =>
			stdout.trim()
				.split('\r\n')
				.map(line => line.split('\t'))
				.map(([name, pid, ppid]) => ({
					name,
					pid: Number.parseInt(pid, 10),
					ppid: Number.parseInt(ppid, 10)
				}))
		);
}

function def(options = {}) {
	const ret = {};
	const flags = (options.all === false ? '' : 'a') + 'wwxo';

	return Promise.all(['comm', 'args', 'ppid', '%cpu', '%mem'].map(cmd => {
		return pify(childProcess.execFile)('ps', [flags, `pid,${cmd}`], {maxBuffer: TEN_MEGABYTES}).then(stdout => {
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
	});
}

module.exports = process.platform === 'win32' ? win : def;
