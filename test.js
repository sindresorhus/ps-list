import test from 'ava';
import m from '.';

const isWindows = process.platform === 'win32';

test(async t => {
	const binName = isWindows ? 'node.exe' : 'ava';
	const list = await m();

	t.true(list.some(x => x.name.indexOf(binName) !== -1));
	t.true(list.every(x =>
		typeof x.pid === 'number' &&
		typeof x.name === 'string' &&
		typeof x.cmd === 'string'));

	if (!isWindows) {
		t.true(list.every(x =>
			typeof x.cpu === 'string' &&
			typeof x.memory === 'string'));
	}
});
