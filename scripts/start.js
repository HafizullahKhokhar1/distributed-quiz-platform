const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const services = [
  { name: 'auth', cmd: 'node', args: ['server.js'], cwd: path.join(rootDir, 'backend/auth-service'), port: 5001 },
  { name: 'quiz', cmd: 'node', args: ['server.js'], cwd: path.join(rootDir, 'backend/quiz-service'), port: 5002 },
  { name: 'result', cmd: 'node', args: ['server.js'], cwd: path.join(rootDir, 'backend/result-service'), port: 5003 },
  { name: 'front', cmd: process.execPath, args: [path.join(rootDir, 'frontend/node_modules/vite/bin/vite.js')], cwd: path.join(rootDir, 'frontend'), port: 5173 },
];

const procs = [];
const startedNames = [];

function checkPortFree(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const tester = net.createServer()
      .once('error', () => {
        resolve(false);
      })
      .once('listening', () => {
        tester.once('close', () => resolve(true)).close();
      })
      // listen on unspecified address so both IPv4 and IPv6 are checked
      .listen(port);
  });
}

function spawnService(s) {
  const p = spawn(s.cmd, s.args, { env: process.env, cwd: s.cwd || rootDir });
  p.stdout.on('data', (d) => process.stdout.write(`[${s.name}] ${d}`));
  p.stderr.on('data', (d) => process.stderr.write(`[${s.name} ERR] ${d}`));
  p.on('exit', (code, signal) => {
    console.log(`[${s.name}] exited with ${signal || code}`);
    // do not shut down other services automatically; just report
  });
  p.on('error', (err) => {
    console.error(`[${s.name}] spawn error:`, err && err.message);
  });
  return p;
}

function shutdown(code = 0) {
  for (const p of procs) {
    try { p.kill('SIGTERM'); } catch (e) {}
  }
  process.exit(code);
}

async function resetServiceState() {
  const controlCalls = [
    ['http://localhost:5001/api/auth/control', { action: 'offline', value: false }],
    ['http://localhost:5001/api/auth/control', { action: 'delay', value: 0 }],
    ['http://localhost:5002/api/quiz/control', { action: 'offline', value: false }],
    ['http://localhost:5002/api/quiz/control', { action: 'delay', value: 0 }],
    ['http://localhost:5003/api/result/control', { action: 'offline', value: false }],
    ['http://localhost:5003/api/result/control', { action: 'delay', value: 0 }],
  ];

  for (const [url, body] of controlCalls) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.warn(`[reset] Unable to apply ${url}: ${error.message}`);
    }
  }
}

process.on('SIGINT', () => {
  console.log('\nShutting down services (SIGINT)');
  shutdown(0);
});
process.on('SIGTERM', () => {
  console.log('\nShutting down services (SIGTERM)');
  shutdown(0);
});

(async () => {
  for (const s of services) {
    if (s.port) {
      const free = await checkPortFree(s.port);
      if (!free) {
        console.log(`[${s.name}] port ${s.port} is in use — skipping start.`);
        continue;
      }
    }

    procs.push(spawnService(s));
    startedNames.push(s.name);
  }

  if (procs.length === 0) {
    console.log('No services were started (all ports in use).');
  } else {
    console.log('Started services:', startedNames.join(', '));
    console.log('Press Ctrl+C to stop.');
  }

  // Give the microservices a moment to boot, then restore them to a clean online state.
  setTimeout(() => {
    resetServiceState().then(() => {
      console.log('Service state reset to online mode.');
    });
  }, 1200);
})();
