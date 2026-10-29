const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:net');
const { WebSocket } = require('ws');
const { startSignaling } = require('../dist/main/signaling.js');

const KEY = '0123456789abcdef0123456789abcdef';

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function connect(port, role, key = KEY) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    const timer = setTimeout(() => reject(new Error('Timeout')), 3500);
    socket.on('open', () => socket.send(JSON.stringify({ type: 'auth', role, key })));
    socket.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'welcome') { clearTimeout(timer); resolve({ socket, welcome: msg }); }
    });
    socket.on('error', (e) => { clearTimeout(timer); reject(e); });
    socket.on('close', (code) => { if (code !== 1000) { clearTimeout(timer); reject(new Error(`Closed ${code}`)); } });
  });
}

function nextMessage(socket, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('message', handler); reject(new Error(`Missing ${type}`)); }, 3500);
    const handler = (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === type) {
        clearTimeout(timer);
        socket.off('message', handler);
        resolve(message);
      }
    };
    socket.on('message', handler);
  });
}

test('host and viewer authenticate and forward answer to host', async () => {
  const port = await freePort();
  const server = await startSignaling({ bindIp: '127.0.0.1', port, accessKey: KEY });
  const sessions = [];
  try {
    const host = await connect(port, 'host');
    sessions.push(host.socket);
    assert.equal(host.welcome.peerId, 'host');
    const joined = nextMessage(host.socket, 'viewer-joined');
    const viewer = await connect(port, 'viewer');
    sessions.push(viewer.socket);
    const msg = await joined;
    assert.equal(msg.peerId, viewer.welcome.peerId);
    const answer = nextMessage(host.socket, 'signal');
    viewer.socket.send(JSON.stringify({ type: 'signal', to: 'host', data: { kind: 'answer', sdp: 'v=0' } }));
    const relayed = await answer;
    assert.equal(relayed.from, viewer.welcome.peerId);
    assert.equal(relayed.data.kind, 'answer');
    assert.equal(relayed.data.sdp, 'v=0');
  } finally {
    sessions.forEach((socket) => socket.terminate());
    await server.close();
  }
});

test('wrong room key is rejected', async () => {
  const port = await freePort();
  const server = await startSignaling({ bindIp: '127.0.0.1', port, accessKey: KEY });
  try {
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}`);
      const timeout = setTimeout(() => reject(new Error('No rejection')), 3500);
      socket.on('open', () => socket.send(JSON.stringify({ type: 'auth', role: 'host', key: 'bad' })));
      socket.on('close', (code) => { clearTimeout(timeout); try { assert.equal(code, 1008); resolve(); } catch (e) { reject(e); } });
      socket.on('error', reject);
    });
  } finally {
    await server.close();
  }
});
