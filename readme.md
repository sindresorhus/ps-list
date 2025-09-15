# ps-list

> Get running processes

Works on macOS, Linux, and Windows. Windows ARM64 is not supported yet.

## Install

```sh
npm install ps-list
```

## Usage

```js
import psList from 'ps-list';

console.log(await psList());
//=> [{pid: 3213, name: 'node', cmd: 'node test.js', ppid: 1, uid: 501, cpu: 0.1, memory: 1.5, path: '/usr/local/bin/node', startTime: 2025-01-15T10:30:00.000Z}, …]
```

## API

### psList(options?)

Returns a `Promise<ProcessDescriptor[]>` with the running processes.

On macOS and Linux:
- The `name` property is truncated to 15 characters by the system
- The `cmd` property contains the full command line with arguments
- The `cpu` property is the CPU usage percentage (0-100)
- The `memory` property is the memory usage percentage (0-100)
- The `path` property is a best-effort attempt to get the full executable path:
  - On Linux: reads from `/proc/{pid}/exe` when available
  - On macOS: extracted from command line when possible
  - Falls back to `comm` (which may be truncated)
- The `startTime` property contains the process start time as a Date object

The `cmd`, `cpu`, `memory`, `uid`, `path`, and `startTime` properties are not available on Windows.

#### options

Type: `object`

##### all

Type: `boolean`\
Default: `true`

Include other users' processes as well as your own.

On Windows this has no effect and will always be the user's own processes.

## Related

- [fastlist](https://github.com/MarkTiedemann/fastlist) - The binary used in this module to list the running processes on Windows
