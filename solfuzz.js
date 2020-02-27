#!/usr/bin/env node

const env = {
    apiKey: process.env.MYTHX_API_KEY,
    apiUrl: process.env.MYTHX_API_URL
};


let { apiKey, apiUrl } = env;

if (!apiKey) {
    console.log('Please set the MYTHX_API_KEY enviroment variable. You can get an API key for free at https://mythx.io/');

    process.exit(-1);
}

const args = require('minimist')(process.argv.slice(2), {
    boolean: [ 'help', 'debug' ],
    string: [ 'mode', 'format' ],
    default: { mode: 'quick', format: 'text' },
});

let command = args._[0];

let controller;

switch (command) {
case 'version':
    controller = require('./lib/controllers/version');
    break;
case 'status':
    controller = require('./lib/controllers/status');
    break;
case 'list':
    controller = require('./lib/controllers/list');
    break;
case 'check':
    controller = require('./lib/controllers/check');
    break;
default:
    controller = require('./lib/controllers/help');
    break;
}

controller(env, args);
