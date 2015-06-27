'use strict';
var childProcess = require('child_process');
var tasklist = require('tasklist');
var parseColumns = require('parse-columns');

function win(cb) {
	tasklist(function (err, data) {
		if (err) {
			cb(err);
			return;
		}

		var ret = data.map(function (el) {
			el.name = el.cmd = el.imageName;
			return el;
		});

		cb(null, ret);
	});
}

// https://www.freebsd.org/cgi/man.cgi?query=ps(1)&sektion=#KEYWORDS
def.cols = [
	{o: 'pid',  header: 'pid',  transform: Number},
	{o: 'ppid', header: 'ppid', transform: Number},
	{o: 'user', header: 'user'},
	{o: 'comm', header: 'name'},
	{o: 'args', header: 'cmd'},
	{o: '%cpu', header: 'cpu'},
	{o: '%mem', header: 'mem'},
];
def.cols.byHeader = def.cols.reduce(function (colsByHeader, col) {
	colsByHeader[col.header] = col;
	return colsByHeader;
}, {});

function def(cb) {
	var os = def.cols.map(function (col) { return col.o; }).join(',');
	childProcess.execFile('ps', ['axo', os], function (err, stdout) {
		if (err) {
			cb(err);
			return;
		}

		var ret = parseColumns(stdout, {
			headers: def.cols.map(function (col) { return col.header; }),
			transform: function (el, header) {
				var transform = def.cols.byHeader[header].transform;
				return transform ? transform(el) : el;
			}
		});

		cb(null, ret);
	});
}

module.exports = process.platform === 'win32' ? win : def;
