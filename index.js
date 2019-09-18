'use strict';
const util = require('util');
const path = require('path');
const childProcess = require('child_process');
const fs = require('fs');

const TEN_MEGABYTES = 1000 * 1000 * 10;
const execFile = util.promisify(childProcess.execFile);

const windows = async () => {
	// Source: https://github.com/MarkTiedemann/fastlist
	const bin = path.join(__dirname, 'fastlist.exe');

	const {stdout} = await execFile(bin, {maxBuffer: TEN_MEGABYTES});

	return stdout
		.trim()
		.split('\r\n')
		.map(line => line.split('\t'))
		.map(([name, pid, ppid]) => ({
			name,
			pid: Number.parseInt(pid, 10),
			ppid: Number.parseInt(ppid, 10)
		}));
};

const nonWindowsMultipleCalls = async (options = {}) => {
	const flags = (options.all === false ? '' : 'a') + 'wwxo';
	const ret = {};

	await Promise.all(['comm', 'args', 'ppid', 'uid', '%cpu', '%mem'].map(async cmd => {
		const {stdout} = await execFile('ps', [flags, `pid,${cmd}`], {maxBuffer: TEN_MEGABYTES});

		for (let line of stdout.trim().split('\n').slice(1)) {
			line = line.trim();
			const [pid] = line.split(' ', 1);
			const val = line.slice(pid.length + 1).trim();

			if (ret[pid] === undefined) {
				ret[pid] = {};
			}

			ret[pid][cmd] = val;
		}
	}));

	// Filter out inconsistencies as there might be race
	// issues due to differences in `ps` between the spawns
	const processes = Object.entries(ret)
		.filter(([, value]) => value.comm && value.args && value.ppid && value.uid && value['%cpu'] && value['%mem'])
		.map(([key, value]) => ({
			pid: Number.parseInt(key, 10),
			name: path.basename(value.comm),
			cmd: value.args,
			ppid: Number.parseInt(value.ppid, 10),
			uid: Number.parseInt(value.uid, 10),
			cpu: Number.parseFloat(value['%cpu']),
			memory: Number.parseFloat(value['%mem'])
		}));

	processes.forEach(p => {
		if (p.name.length === 15) {
			p.name = nonWindowsGetFullName(p.pid);
		}
	});

	return processes;
};

const ERROR_MESSAGE_PARSING_FAILED = 'ps output parsing failed';

const psFields = 'pid,ppid,uid,%cpu,%mem,comm,args';

// TODO: Use named capture groups when targeting Node.js 10
const psOutputRegex = /^[ \t]*(\d+)[ \t]+(\d+)[ \t]+(\d+)[ \t]+(\d+\.\d+)[ \t]+(\d+\.\d+)[ \t]+/; // Groups: pid, ppid, uid, cpu, mem

const nonWindowsSingleCall = async (options = {}) => {
	const flags = options.all === false ? 'wwxo' : 'awwxo';

	// TODO: Use the promise version of `execFile` when https://github.com/nodejs/node/issues/28244 is fixed
	const [psPid, stdout] = await new Promise((resolve, reject) => {
		const child = childProcess.execFile('ps', [flags, psFields], {maxBuffer: TEN_MEGABYTES}, (error, stdout) => {
			if (error === null) {
				resolve([child.pid, stdout]);
			} else {
				reject(error);
			}
		});
	});

	const lines = stdout.trim().split('\n');
	lines.shift();

	let psIndex;
	let commPosition;
	let argsPosition;

	const processes = lines.map((line, i) => {
		const match = psOutputRegex.exec(line);
		if (match === null) {
			throw new Error(ERROR_MESSAGE_PARSING_FAILED);
		}

		const process = {
			pid: Number.parseInt(match[1], 10),
			ppid: Number.parseInt(match[2], 10),
			uid: Number.parseInt(match[3], 10),
			cpu: Number.parseFloat(match[4]),
			memory: Number.parseFloat(match[5]),
			name: undefined,
			cmd: undefined
		};
		if (process.pid === psPid) {
			psIndex = i;
			commPosition = line.indexOf('ps', match[0].length);
			argsPosition = line.indexOf('ps', commPosition + 2);
		}

		return process;
	});

	if (psIndex === undefined || commPosition === -1 || argsPosition === -1) {
		throw new Error(ERROR_MESSAGE_PARSING_FAILED);
	}

	const commLength = argsPosition - commPosition;
	for (const [i, line] of lines.entries()) {
		processes[i].name = line.slice(commPosition, commPosition + commLength).trim();
		processes[i].cmd = line.slice(argsPosition).trim();
	}

	processes.forEach(p => {
		if (p.name.length === 15) {
			p.name = nonWindowsGetFullName(p.pid);
		}
	});

	processes.splice(psIndex, 1);
	return processes;
};

const nonWindows = async (options = {}) => {
	try {
		return await nonWindowsSingleCall(options);
	} catch (_) { // If the error is not a parsing error, it should manifest itself in multicall version too
		return nonWindowsMultipleCalls(options);
	}
};

const nonWindowsGetFullName = pid => {
	const path = `/proc/${pid}/exe`;
	const value = fs.readlinkSync(path, 'utf8');
	return value.split('/')[value.split('/').length - 1].trim();
};

module.exports = process.platform === 'win32' ? windows : nonWindows;
// TODO: remove this in the next major version
module.exports.default = module.exports;
