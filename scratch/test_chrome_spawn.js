const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

const exe = puppeteer.executablePath();
const cp = spawn(exe, ['--version', '--no-crashpad', '--disable-crashpad']);
cp.stdout.on('data', d => console.log('stdout:', d.toString()));
cp.stderr.on('data', d => console.log('stderr:', d.toString()));
cp.on('error', e => console.log('error:', e));
cp.on('close', code => console.log('close:', code));
