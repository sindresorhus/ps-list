# ps-list [![Build Status](https://travis-ci.org/sindresorhus/ps-list.svg?branch=master)](https://travis-ci.org/sindresorhus/ps-list) [![Build status](https://ci.appveyor.com/api/projects/status/i733mfqw11sja2xf/branch/master?svg=true)](https://ci.appveyor.com/project/sindresorhus/ps-list/branch/master)

> Get running processes

Works on macOS, Linux, and Windows.


## Install

```
$ npm install ps-list
```


## Usage

```js
const psList = require('ps-list');

psList().then(data => {
	console.log(data);
	//=> [{pid: 3213, name: 'node', cmd: 'node test.js', cpu: '0.1'}, ...]
});
```

> The `cpu` percentage is not supported on Windows.


## API

### psList([options])

Returns a `Promise<Array>` with the running processes.

#### options

Type: `Object`

##### all

Type: `boolean`<br>
Default: `true`

Return other users' processes as well as your own.

On Windows this has no effect and will always be the users' own processes.


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
