import process from 'node:process';
import path from 'node:path';
import {once} from 'node:events';
import childProcess from 'node:child_process';
import test from 'ava';
import psList from './index.js';

const isWindows = process.platform === 'win32';
const nodeBinaryName = isWindows ? 'node.exe' : 'node';
const testBinaryName = isWindows ? nodeBinaryName : 'ava';

test('main', async t => {
	const list = await psList();

	if (isWindows) {
		t.true(list.some(x => x.name.includes(testBinaryName)));
	} else {
		t.true(list.some(x => x.cmd.includes(testBinaryName)));
	}

	t.true(list.every(x =>
		typeof x.pid === 'number'
		&& typeof x.name === 'string'
		&& typeof x.ppid === 'number'));

	if (!isWindows) {
		t.true(list.every(x =>
			typeof x.cmd === 'string'
			&& typeof x.cpu === 'number'
			&& typeof x.memory === 'number'
			&& (typeof x.uid === 'number' || x.uid === undefined)
			&& typeof x.path === 'string'
			&& (x.startTime instanceof Date || x.startTime === undefined)));

		// Verify Date objects are valid (not Invalid Date)
		for (const process_ of list) {
			if (process_.startTime) {
				t.false(Number.isNaN(process_.startTime.getTime()), `Process ${process_.pid} has Invalid Date`);
				t.true(process_.startTime <= new Date(), `Process ${process_.pid} startTime is not in future`);
			}
		}

		// Verify percentages are in valid range
		t.true(
			list.every(x => x.cpu >= 0 && x.cpu <= 100 * 10), // Allow up to 1000% for multi-core
			'CPU percentages should be valid',
		);
		t.true(
			list.every(x => x.memory >= 0 && x.memory <= 100),
			'Memory percentages should be valid',
		);
	}
});

test('custom binary', async t => {
	const arguments_ = ['./fixtures/sleep-forever.js', 'arg1', 'arg2'];
	const sleepForever = childProcess.spawn(nodeBinaryName, arguments_);

	const list = await psList();
	const record = list.find(process_ => process_.pid === sleepForever.pid);

	sleepForever.kill(9);
	await once(sleepForever, 'exit');

	t.is(record.pid, sleepForever.pid);
	t.is(record.name, nodeBinaryName);
	t.is(record.ppid, process.pid);

	if (!isWindows) {
		t.is(record.cmd, `${nodeBinaryName} ${arguments_.join(' ')}`);
		t.is(record.uid, process.getuid());
		// Path can be empty (relative command) or absolute (CI environments)
		t.true(typeof record.path === 'string', 'Path should be a string');
		if (record.path) {
			// If path is resolved, it should contain node
			t.true(record.path.includes('node'), 'Resolved path should contain node');
		}

		t.true(record.startTime instanceof Date);
		t.true(record.startTime <= new Date());

		// Verify startTime is valid (not Invalid Date)
		if (record.startTime) {
			t.false(Number.isNaN(record.startTime.getTime()), 'startTime should be valid Date');
		}
	}
});

test('path resolution', async t => {
	if (isWindows) {
		t.pass('Path resolution test skipped on Windows');
		return;
	}

	const list = await psList();

	// On Linux, test /proc/{pid}/exe resolution for current process
	if (process.platform === 'linux') {
		const currentProcess = list.find(x => x.pid === process.pid);
		if (currentProcess) {
			t.true(currentProcess.path.startsWith('/'), 'Current process should have absolute path from /proc/pid/exe');
			t.true(currentProcess.path.includes('node'), 'Current process path should contain node');
			// Path should be different from name (which is truncated)
			t.not(currentProcess.path, currentProcess.name, 'Path should be full path, not truncated name');
		}
	}

	// Find init process - should have absolute path
	const initProcess = list.find(x => x.pid === 1);
	if (initProcess) {
		t.true(initProcess.path.startsWith('/'), 'Init process should have absolute path');
	}

	// Find any node process - should have path resolved
	const nodeProcess = list.find(x => x.name === 'node' || x.name === nodeBinaryName);
	if (nodeProcess) {
		t.true(nodeProcess.path.includes('node'), 'Node process path should contain node');
		// Verify path is not just the truncated comm
		if (nodeProcess.path.startsWith('/')) {
			t.true(nodeProcess.path.length > nodeProcess.name.length, 'Path should be longer than truncated name');
		}
	}
});

test('large command line', async t => {
	if (isWindows) {
		t.pass('Large command test skipped on Windows');
		return;
	}

	// Create a process with very long arguments
	const longArgument = 'x'.repeat(10_000);
	const sleepForever = childProcess.spawn(nodeBinaryName, ['./fixtures/sleep-forever.js', longArgument]);

	try {
		const list = await psList();
		const record = list.find(process_ => process_.pid === sleepForever.pid);
		t.truthy(record, 'Should find process with large command line');
		if (record) {
			t.true(record.cmd.length > 9000, 'Should capture long command line');
		}
	} finally {
		sleepForever.kill(9);
		await once(sleepForever, 'exit');
	}
});

test('quoted paths and name selection', async t => {
	if (isWindows) {
		t.pass('Quoted paths test skipped on Windows');
		return;
	}

	const list = await psList();

	// Find processes with absolute paths to test name selection
	const processesWithPaths = list.filter(x => x.path && x.path.startsWith('/'));
	t.true(processesWithPaths.length > 0, 'Should have processes with absolute paths');

	for (const process_ of processesWithPaths) {
		// When path is absolute, name should be basename of path
		const expectedName = path.basename(process_.path);
		t.is(process_.name, expectedName, `Process ${process_.pid} name should be basename of path: ${process_.path}`);

		// Name should be different from raw comm when path is resolved
		if (process_.path !== process_.comm) {
			t.not(process_.name, process_.comm, `Process ${process_.pid} name should be derived from path, not truncated comm`);
		}
	}
});

test('locale handling', async t => {
	if (isWindows) {
		t.pass('Locale test skipped on Windows');
		return;
	}

	// Test with Japanese locale (this ensures LC_ALL=C is working)
	const originalLang = process.env.LANG;
	const originalLcAll = process.env.LC_ALL;
	process.env.LANG = 'ja_JP.UTF-8';
	process.env.LC_ALL = 'ja_JP.UTF-8';

	try {
		const list = await psList();
		t.true(list.length > 0, 'Should get processes even with non-English locale');

		let validDateCount = 0;
		let undefinedDateCount = 0;

		// Check all dates are either valid Date objects or undefined
		for (const process_ of list) {
			if (process_.startTime === undefined) {
				undefinedDateCount++;
			} else {
				t.true(process_.startTime instanceof Date, `Process ${process_.pid} startTime should be Date object`);
				t.false(Number.isNaN(process_.startTime.getTime()), `Process ${process_.pid} should not have Invalid Date`);
				t.true(process_.startTime <= new Date(), `Process ${process_.pid} startTime should not be in future`);
				validDateCount++;
			}
		}

		// Ensure we have some valid dates (proves LC_ALL=C is working)
		t.true(validDateCount > 0, 'Should have at least some valid dates with LC_ALL=C forcing English');
		t.log(`Valid dates: ${validDateCount}, Undefined dates: ${undefinedDateCount}`);
	} finally {
		process.env.LANG = originalLang;
		process.env.LC_ALL = originalLcAll;
	}
});
