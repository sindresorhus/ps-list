import test from 'ava';
import m from '.';

const isWindows = process.platform === 'win32';

test('main', async t => {
	const binName = isWindows ? 'node.exe' : 'ava';
	const list = await m();

	t.true(list.some(x => x.name.includes(binName)));
	t.true(
		list.every(x =>
			typeof x.pid === 'number' &&
			typeof x.name === 'string' &&
			typeof x.cmd === 'string'
		)
	);

	if (!isWindows) {
		t.true(
			list.every(x =>
				typeof x.cpu === 'string' &&
				typeof x.memory === 'string'
			)
		);
		t.true(
			list.every(x => 
				typeof x.ppid === 'number'
			)
		);
	}
});
