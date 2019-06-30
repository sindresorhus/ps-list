#!/usr/bin/env node
'use strict';

const sleep = () => {
	setTimeout(sleep, 10000);
};

sleep();
