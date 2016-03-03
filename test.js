import test from 'ava';
import fn from './';

test(async t => {
	const binName = process.platform === 'win32' ? 'node.exe' : 'ava';
	const list = await fn();

	t.true(list.some(x => x.name.indexOf(binName) !== -1));
	t.true(list.every(x =>
		typeof x.pid === 'number' &&
		typeof x.name === 'string' &&
		typeof x.cmd === 'string'));
});
