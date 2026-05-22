const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const rootDir = __dirname;
const publicPort = parseInt(process.env.PORT, 10) || 3000;
const spawnServices = process.env.SPAWN_SERVICES !== 'false';
const distDir = path.join(rootDir, 'frontend', 'dist');

const services = [
  { name: 'auth', port: 5001, cwd: path.join(rootDir, 'backend/auth-service'), cmd: 'node', args: ['server.js'] },
  { name: 'quiz', port: 5002, cwd: path.join(rootDir, 'backend/quiz-service'), cmd: 'node', args: ['server.js'] },
  { name: 'result', port: 5003, cwd: path.join(rootDir, 'backend/result-service'), cmd: 'node', args: ['server.js'] },
];

const childProcesses = [];

function checkPortFree(port) {
  return new Promise((resolve) => {
    const tester = http.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => tester.close(() => resolve(true)));
    tester.listen(port, '0.0.0.0');
  });
}

function spawnService(service) {
  const child = spawn(service.cmd, service.args, {
    cwd: service.cwd,
    env: { ...process.env, PORT: String(service.port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (data) => process.stdout.write(`[${service.name}] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[${service.name} ERR] ${data}`));
  child.on('exit', (code, signal) => {
    console.log(`[${service.name}] exited with ${signal || code}`);
  });

  childProcesses.push(child);
}

function shutdown(code = 0) {
  for (const child of childProcesses) {
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  process.exit(code);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
  };

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function proxyRequest(req, res, targetPort) {
  const proxy = http.request(
    {
      hostname: '127.0.0.1',
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxy.on('error', (error) => {
    sendJson(res, 502, { error: `Unable to reach service on port ${targetPort}`, detail: error.message });
  });

  req.pipe(proxy);
}

function resolveFrontendFile(urlPath) {
  const cleanPath = urlPath.split('?')[0];
  if (cleanPath === '/' || cleanPath === '') return path.join(distDir, 'index.html');

  const assetPath = path.join(distDir, cleanPath);
  if (assetPath.startsWith(distDir) && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
    return assetPath;
  }

  return path.join(distDir, 'index.html');
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

(async () => {
  if (spawnServices) {
    for (const service of services) {
      const free = await checkPortFree(service.port);
      if (!free) {
        console.log(`[${service.name}] port ${service.port} is in use — skipping start.`);
        continue;
      }
      spawnService(service);
    }
  }

  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/auth/')) return proxyRequest(req, res, 5001);
    if (req.url.startsWith('/api/quiz/')) return proxyRequest(req, res, 5002);
    if (req.url.startsWith('/api/result/')) return proxyRequest(req, res, 5003);
    if (req.url === '/health') return sendJson(res, 200, { status: 'ok' });

    const filePath = resolveFrontendFile(req.url || '/');
    serveStatic(res, filePath);
  });

  server.listen(publicPort, '0.0.0.0', () => {
    console.log(`Unified deployment server running on port ${publicPort}`);
    if (spawnServices) console.log('Backend services are managed automatically from this process.');
    console.log('Frontend is served from frontend/dist.');
  });
})();
