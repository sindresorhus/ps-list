# ps-list [![Build Status](https://travis-ci.org/sindresorhus/ps-list.svg?branch=master)](https://travis-ci.org/sindresorhus/ps-list)

> Get running processes

Works on macOS, Linux, and Windows.

## Install

```
$ npm install ps-list
```

## Usage

```js
const psList = require('ps-list');

(async () => {
	console.log(await psList());
	//=> [{pid: 3213, name: 'node', cmd: 'node test.js', ppid: 1, uid: 501, cpu: 0.1, memory: 1.5}, …]
})();
```

## Search by several parameters
```js
const psList = require('ps-list');

/**
 * @param {Object} param
 * @param {number} param.pid
 * @param {string} param.name
 * @param {string} param.cmd
 * @param {number} param.ppid
 * @param {number} param.uid
 * @param {number} param.cpu
 * @param {number} param.memory
 *
 * @return {Object}
 */
const checkProcess = async (param) => {
	const list = await psList();
	let founds = [];

	if (typeof param !== 'object' || Object.keys(param).length === 0) return founds;

	for (let i = 0; i < list.length; i++) {
		let found = true;

		for (const k in param) {
			if (!param.hasOwnProperty(k)) continue;
			let re = new RegExp(param[k], 'i');
			let test = re.test(list[i][k]);
			if (!test) found = false;
		}

		if (found) founds.push(list[i]);
	}

	return founds;
};
(async () => {
	console.log(await psList());
	/**
	 * => [
	 * 	{
	 * 		pid: 2892,
	 * 		ppid: 2890,
	 * 		uid: 1000,
	 * 		cpu: 0,
	 * 		memory: 0.3,
	 * 		name: 'code',
	 * 		cmd: '/usr/share/code/code --type=zygote --no-sandbox'
	 * 	},
	 * 	{
	 * 		pid: 2948,
	 * 		ppid: 2929,
	 * 		uid: 1000,
	 * 		cpu: 0,
	 * 		memory: 0.4,
	 * 		name: 'chrome',
	 * 		cmd: '/opt/google/chrome/chrome --type=zygote --enable-crash-reporter=2b9b2731-a8d1-4faa-841e-14672f78cdd1,'
	 * 	}
	 * ]
	 */
})();
```

> The `cmd`, `cpu`, `memory`, and `uid` properties are not supported on Windows.

## API

### psList(options?)

Returns a `Promise<Array>` with the running processes.

#### options

Type: `object`

##### all

Type: `boolean`\
Default: `true`

Include other users' processes as well as your own.

On Windows this has no effect and will always be the users' own processes.
