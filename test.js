import test from 'ava';
import psList from '.';
import childProcess from 'child_process';

const isWindows = process.platform === 'win32';

const nodeBinaryName = isWindows ? 'node.exe' : 'node';
const testBinaryName = isWindows ? nodeBinaryName : 'ava';

test('main', async t => {
	const list = await psList();

	t.true(list.some(x => x.name.includes(testBinaryName)));
	t.true(
		list.every(x =>
			typeof x.pid === 'number' &&
			typeof x.name === 'string' &&
			typeof x.ppid === 'number'
		)
	);

	if (!isWindows) {
		t.true(
			list.every(x =>
				typeof x.cmd === 'string' &&
				typeof x.cpu === 'number' &&
				typeof x.memory === 'number' &&
				typeof x.uid === 'number'
			)
		);
	}
});

test('some name', async t => {
	let args = [];
	for(let i = 0; i < 100; i++) {
		args.push(`arg${i}`);
	}

	const sleepForever = childProcess.spawn('./fixtures/sleep-forever.js', args);

	const list = await psList();
	await new Promise(resolve => {
		sleepForever.kill(9);
		sleepForever.once('exit', () => resolve());
	});

	const record = list.find(process => process.pid === sleepForever.pid);

	t.is(record.pid, sleepForever.pid);
	t.is(record.name, nodeBinaryName);
	t.is(record.ppid, process.pid);
	if (!isWindows) {
		t.is(record.cmd, `${nodeBinaryName} ./fixtures/sleep-forever.js ${args.join(' ')}`);
		t.is(record.uid, process.getuid());
	}
});
