'use strict';
const util = require('util');
const path = require('path');
const childProcess = require('child_process');

const TEN_MEGABYTES = 1000 * 1000 * 10;
const execFile = util.promisify(childProcess.execFile);

const windows = async () => {
	// Source: https://github.com/MarkTiedemann/fastlist
	const bin = path.join(__dirname, 'fastlist.exe');

	const {stdout} = await execFile(bin, {
		maxBuffer: TEN_MEGABYTES,
		windowsHide: true
	});

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
	return Object.entries(ret)
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
};

const ERROR_MESSAGE_PARSING_FAILED = 'ps output parsing failed';

const psFields = 'pid,ppid,uid,%cpu,%mem,comm,args';

// TODO: Use named capture groups when targeting Node.js 10
const psOutputRegex = /^[\s]*(?<pid>\d+)[\s]+(?<ppid>\d+)[\s]+(?<uid>\d+)[\s]+(?<cpu>\d+\.\d+)[\s]+(?<memory>\d+\.\d+)[\s]+(?<comm>[\S]+(?:\s+<defunct>)?)[\s]+(?<args>.*)/;

const nonWindowsSingleCall = async (options = {}) => {
	const flags = options.all === false ? 'wwxo' : 'awwxo';

	const [, stdout] = await new Promise((resolve, reject) => {
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

	return lines.map(line => {
		const match = psOutputRegex.exec(line);
		if (match === null) {
			throw new Error(ERROR_MESSAGE_PARSING_FAILED);
		}

		const {pid, ppid, uid, cpu, memory, comm, args} = match.groups;
		const divided = args.split(' ');
		return {
			pid: Number.parseInt(pid, 10),
			ppid: Number.parseInt(ppid, 10),
			uid: Number.parseInt(uid, 10),
			cpu: Number.parseFloat(cpu),
			memory: Number.parseFloat(memory),
			name: comm,
			cmd: [path.basename(divided[0]), divided.slice(1).join(' ')].join(' ')
		};
	});
};

const nonWindows = async (options = {}) => {
	try {
		return await nonWindowsSingleCall(options);
	} catch (_) { // If the error is not a parsing error, it should manifest itself in multicall version too.
		return nonWindowsMultipleCalls(options);
	}
};

module.exports = process.platform === 'win32' ? windows : nonWindows;

