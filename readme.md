# ps-list [![Build Status](https://travis-ci.org/sindresorhus/ps-list.svg?branch=master)](https://travis-ci.org/sindresorhus/ps-list) [![Build status](https://ci.appveyor.com/api/projects/status/i733mfqw11sja2xf/branch/master?svg=true)](https://ci.appveyor.com/project/sindresorhus/ps-list/branch/master)

> Get running processes

Works on OS X, Linux, Windows.


## Install

```
$ npm install --save ps-list
```


## Usage

```js
const psList = require('ps-list');

psList().then(data => {
	console.log(data);
	//=> [{pid: 3213, name: 'node', cmd: 'node test.js'}, ...]
});
```


## API

### psList([options])

Returns a promise for an array with the running processes.

#### options

##### all

Type: `boolean`  
Default: `true`

Return other users' processes as well as your own.

On Windows this has no effect and will always be the users' own processes.


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
