import process from 'node:process';
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

	t.true(
		list.every(x =>
			typeof x.pid === 'number'
			&& typeof x.name === 'string'
			&& typeof x.ppid === 'number',
		),
	);

	if (!isWindows) {
		t.true(
			list.every(x =>
				typeof x.cmd === 'string'
				&& typeof x.cpu === 'number'
				&& typeof x.memory === 'number'
				&& typeof x.uid === 'number',
			),
		);
	}
});

test('custom binary', async t => {
	const args = ['./fixtures/sleep-forever.js'];
	for (let i = 0; i < 100; i++) {
		args.push(`arg${i}`);
	}

	const sleepForever = childProcess.spawn(nodeBinaryName, args);

	const list = await psList();

	await new Promise(resolve => {
		sleepForever.kill(9);

		sleepForever.once('exit', () => {
			resolve();
		});
	});

	const record = list.find(process => process.pid === sleepForever.pid);

	t.is(record.pid, sleepForever.pid);
	t.is(record.name, nodeBinaryName);
	t.is(record.ppid, process.pid);

	if (!isWindows) {
		t.is(record.cmd, `${nodeBinaryName} ${args.join(' ')}`);
		t.is(record.uid, process.getuid());
	}
});
