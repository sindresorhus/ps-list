# ps-list [![Build Status](https://travis-ci.org/sindresorhus/ps-list.svg?branch=master)](https://travis-ci.org/sindresorhus/ps-list) [![Build status](https://ci.appveyor.com/api/projects/status/i733mfqw11sja2xf/branch/master?svg=true)](https://ci.appveyor.com/project/sindresorhus/ps-list/branch/master)

> Get running processes

Works on OS X, Linux, Windows.


## Install

```
$ npm install --save ps-list
```


## Usage

```js
var psList = require('ps-list');

psList(function (err, data) {
	console.log(data);
	//=> [{pid: 3213, name: 'node'}, ...]
});

psList({args: true}, function (err, data) {
	console.log(data);
	//=> [{pid: 3213, name: 'node test.js'}, ...]
});
```


## API

### psList([options], callback)

#### options

##### args

Type: `boolean`  
Default: `false`

Include process startup arguments. Moot on Windows.


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
