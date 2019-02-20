import childProcess from 'child_process';
import test from 'ava';
import psList from '.';

const isWindows = process.platform === 'win32';

test('main', async t => {
	const binName = isWindows ? 'node.exe' : 'ava';
	const list = await psList();

	t.true(list.some(x => x.name.includes(binName)));
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

if (!isWindows) {
	const spawnDummy = name => childProcess.spawn(`bash -c "exec -a '${name}' sleep 60"`, {shell: true});

	test('process names', async t => {
		const cases = [
			[spawnDummy('foo'), 'foo'],
			[spawnDummy('foobarbazfoobarbazfoobarbaz'), 'foobarbazfoobarbazfoobarbaz'],
			[spawnDummy('/foo/foobarbazfoobarbazfoobarbaz'), 'foobarbazfoobarbazfoobarbaz'],
			[spawnDummy('/foo/bar --bar baz'), 'bar'],
			[spawnDummy('baz --bar baz'), 'baz'],
			[spawnDummy('[foo]'), '[foo]']
		];

		const list = await psList();

		cases.forEach(c => c[0].kill());

		t.true(
			cases.every(c =>
				list.some(x => x.name === c[1])
			)
		);
	});
}
