'use strict';
const util = require('util');
const path = require('path');
const childProcess = require('child_process');

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

const nonWindowsFallback = async (options = {}) => {
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

const RE_PID_PPID_UID_CPU_MEM = /[ \t]*(\d+)[ \t]+(\d+)[ \t]+(\d+)[ \t]+(\d+\.\d+)[ \t]+(\d+\.\d+)[ \t]+/;
const ERROR_MSG_PARSING_FAILED = 'ps output parsing failed';
const nonWindows = async (options = {}) => {
	const flags = (options.all === false ? '' : 'a') + 'wwxo';

	let child;
	const stdout = await new Promise((resolve, reject) => {
		child = childProcess.execFile('ps', [flags, 'pid,ppid,uid,%cpu,%mem,comm,args'], {maxBuffer: TEN_MEGABYTES}, (err, stdout) => err ? reject(err) : resolve(stdout));
	});
	const lines = stdout.trim().split('\n').slice(1);
	let psIdx = -1;
	let commPos;
	let argsPos;
	const procs = lines.map((line, i) => {
		const m = RE_PID_PPID_UID_CPU_MEM.exec(line);
		if (m === null) {
			throw new Error(ERROR_MSG_PARSING_FAILED);
		}

		const proc = {
			pid: Number.parseInt(m[1], 10),
			ppid: Number.parseInt(m[2], 10),
			uid: Number.parseInt(m[3], 10),
			cpu: Number.parseFloat(m[4]),
			memory: Number.parseFloat(m[5]),
			name: undefined,
			cmd: undefined
		};
		if (proc.pid === child.pid) {
			psIdx = i;
			commPos = line.indexOf('ps', m[0].length);
			argsPos = line.indexOf('ps', commPos + 2);
		}

		return proc;
	});

	if (psIdx === -1 || commPos === -1 || argsPos === -1) {
		throw new Error(ERROR_MSG_PARSING_FAILED);
	}

	const commLen = argsPos - commPos;
	lines.forEach((line, i) => {
		procs[i].name = line.substr(commPos, commLen).trim();
		procs[i].cmd = line.substr(argsPos).trim();
	});
	procs.splice(psIdx, 1);
	return procs;
};

const main = async (options = {}) => {
	try {
		return await nonWindows(options);
	} catch (error) {
		return nonWindowsFallback(options);
	}
};

module.exports = process.platform === 'win32' ? windows : main;
// TODO: remove this in the next major version
module.exports.default = module.exports;
