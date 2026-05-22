const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors());
app.use(express.json());

// In-Memory Database (Volatile - perfect for simple, database-free execution)
const users = [
  { username: 'student1', password: 'password123', name: 'Student One' },
  { username: 'student2', password: 'password123', name: 'Student Two' }
];

// Distributed System State Variables
let isOffline = false;
let responseDelay = 0; // ms
let requestCount = 0;

// Middleware to simulate network issues
app.use((req, res, next) => {
  requestCount++;

  if (req.path === '/api/auth/health' || req.path === '/api/auth/control') {
    if (responseDelay > 0) {
      return setTimeout(next, responseDelay);
    }
    return next();
  }
  
  if (isOffline) {
    return res.status(503).json({ error: 'Auth Service is currently Offline (Simulated Crash)' });
  }
  
  if (responseDelay > 0) {
    setTimeout(next, responseDelay);
  } else {
    next();
  }
});

// Authentication Endpoints
app.post('/api/auth/register', (req, res) => {
  const { username, password, name } = req.body;
  
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'All fields (username, password, name) are required!' });
  }
  
  const userExists = users.find(u => u.username === username.toLowerCase());
  if (userExists) {
    return res.status(409).json({ error: 'Username already exists!' });
  }
  
  const newUser = { username: username.toLowerCase(), password, name };
  users.push(newUser);
  
  res.status(201).json({
    message: 'User registered successfully!',
    user: { username: newUser.username, name: newUser.name }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required!' });
  }
  
  const user = users.find(
    u => u.username === username.toLowerCase() && u.password === password
  );
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password!' });
  }
  
  res.status(200).json({
    message: 'Login successful!',
    user: { username: user.username, name: user.name, token: `mock-jwt-token-${user.username}` }
  });
});

// Distributed Systems Control & Diagnostics Endpoints
app.get('/api/auth/health', (req, res) => {
  // Simulate CPU usage based on requests
  const simulatedCpu = Math.min(10 + Math.floor(requestCount * 1.5), 95);
  const activeConn = Math.max(1, Math.floor(Math.random() * 4) + (responseDelay > 0 ? 3 : 1));
  
  res.json({
    status: isOffline ? 'offline' : 'healthy',
    port: PORT,
    simulatedCpu: `${simulatedCpu}%`,
    activeConnections: activeConn,
    totalRequests: requestCount,
    delay: responseDelay
  });
});

app.post('/api/auth/control', (req, res) => {
  const { action, value } = req.body;
  
  if (action === 'offline') {
    isOffline = value;
    res.json({ message: `Auth Service is now ${isOffline ? 'OFFLINE' : 'ONLINE'}` });
  } else if (action === 'delay') {
    responseDelay = parseInt(value) || 0;
    res.json({ message: `Auth Service response delay set to ${responseDelay}ms` });
  } else {
    res.status(400).json({ error: 'Invalid control action' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`[AUTH SERVICE] running on port ${PORT}`);
});
