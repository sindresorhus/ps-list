#!/usr/bin/env node

const sleep = () => {
	setTimeout(sleep, 10_000);
};

sleep();
