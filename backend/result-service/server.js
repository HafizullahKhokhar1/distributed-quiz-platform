const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5003;
const QUIZ_SERVICE_URL = (process.env.QUIZ_SERVICE_URL || 'http://localhost:5002').replace(/\/$/, '');

// Middlewares
app.use(cors());
app.use(express.json());

// In-Memory Leaderboard Database
const leaderboard = [
  { username: 'student1', name: 'Student One', score: 80, timeTaken: '2m 15s', submittedAt: new Date(Date.now() - 3600000) },
  { username: 'student2', name: 'Student Two', score: 90, timeTaken: '1m 50s', submittedAt: new Date(Date.now() - 1800000) },
  { username: 'student3', name: 'Student Three', score: 70, timeTaken: '2m 45s', submittedAt: new Date(Date.now() - 900000) }
];

// Distributed System State
let isOffline = false;
let responseDelay = 0; // ms
let requestCount = 0;

// Middleware to simulate network latency / service outage
app.use((req, res, next) => {
  requestCount++;

  if (req.path === '/api/result/health' || req.path === '/api/result/control' || req.path === '/api/result/leaderboard' || req.path === '/api/result/submit') {
    if (responseDelay > 0) {
      return setTimeout(next, responseDelay);
    }
    return next();
  }
  
  if (isOffline) {
    return res.status(503).json({ error: 'Result & Leaderboard Service is currently Offline (Simulated Crash)' });
  }
  
  if (responseDelay > 0) {
    setTimeout(next, responseDelay);
  } else {
    next();
  }
});

// Fetch answers from Quiz Service (Distributed Service-to-Service Communication)
async function fetchAnswersFromQuizService(sessionId) {
  try {
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    const response = await fetch(`${QUIZ_SERVICE_URL}/api/quiz/answers-internal${query}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch from Quiz Service (HTTP ${response.status})`);
    }
    return await response.json();
  } catch (error) {
    console.error('[RESULT SERVICE] Service-to-service communication failed:', error.message);
    // Fallback static answers in case Quiz service is offline or crashed (Simulates resilience)
    return [
      { id: 1, answer: 0, points: 10 },
      { id: 2, answer: 1, points: 10 },
      { id: 3, answer: 2, points: 10 },
      { id: 4, answer: 2, points: 10 },
      { id: 5, answer: 0, points: 10 },
      { id: 6, answer: 0, points: 10 },
      { id: 7, answer: 1, points: 10 },
      { id: 8, answer: 1, points: 10 },
      { id: 9, answer: 0, points: 10 },
      { id: 10, answer: 1, points: 10 }
    ];
  }
}

// Quiz Submission Endpoint - Featuring Parallel Grading Engine!
app.post('/api/result/submit', async (req, res) => {
  const { username, name, userAnswers, timeTaken, quizSessionId } = req.body;
  
  if (!username || !userAnswers || !Array.isArray(userAnswers)) {
    return res.status(400).json({ error: 'Invalid submission payload!' });
  }
  
  console.log(`[RESULT SERVICE] Received quiz submission from ${username}. Launching parallel grading...`);
  
  // 1. Fetch answers from Quiz service (Demonstrates Distributed Architecture Communication)
  const actualAnswers = await fetchAnswersFromQuizService(quizSessionId);
  
  // 2. Parallel Processing Grading Engine
  // We use Promise.all to map user answers in parallel, logging process threads & timings
  const startTime = Date.now();
  
  const gradingPromises = userAnswers.map(async (userAns, index) => {
    const startNs = process.hrtime.bigint();
    
    // Find matching question correct key
    const correctKey = actualAnswers.find(ans => ans.id === userAns.questionId);
    
    // Simulate compute complexity (e.g. SHA-256 integrity validation)
    const randomLatency = Math.floor(Math.random() * 25) + 15; // 15-40ms computation delay
    await new Promise(resolve => setTimeout(resolve, randomLatency));
    
    const isCorrect = correctKey && correctKey.answer === userAns.selectedOption;
    const pointsEarned = isCorrect ? (correctKey.points || 10) : 0;
    
    const endNs = process.hrtime.bigint();
    const timeTakenNs = Number(endNs - startNs);
    
    // Simulate thread scheduling in a multi-core CPU (Core 1, 2, 3, or 4)
    const assignedCore = (index % 4) + 1;
    
    return {
      questionId: userAns.questionId,
      isCorrect,
      pointsEarned,
      latencyMs: (timeTakenNs / 1000000).toFixed(2),
      core: assignedCore
    };
  });
  
  // Execute all grading steps IN PARALLEL
  const gradingResults = await Promise.all(gradingPromises);
  const totalScore = gradingResults.reduce((acc, curr) => acc + curr.pointsEarned, 0);
  const executionTimeMs = Date.now() - startTime;
  
  // 3. Save to Global Memory Leaderboard
  const userRecord = {
    username: username.toLowerCase(),
    name: name || username,
    score: totalScore,
    timeTaken: timeTaken || 'N/A',
    submittedAt: new Date()
  };
  
  // Update score if user already exists on leaderboard and got higher score
  const existingUserIndex = leaderboard.findIndex(entry => entry.username === userRecord.username);
  if (existingUserIndex !== -1) {
    if (totalScore > leaderboard[existingUserIndex].score) {
      leaderboard[existingUserIndex] = userRecord;
    }
  } else {
    leaderboard.push(userRecord);
  }
  
  // Sort Leaderboard descending
  leaderboard.sort((a, b) => b.score - a.score || a.timeTaken.localeCompare(b.timeTaken));
  
  res.status(200).json({
    message: 'Quiz evaluated successfully in parallel!',
    score: totalScore,
    totalQuestions: userAnswers.length,
    executionTimeMs,
    parallelReport: {
      coresUsed: 4,
      totalLatencyMs: executionTimeMs,
      gradings: gradingResults
    }
  });
});

// Fetch Leaderboard
app.get('/api/result/leaderboard', (req, res) => {
  res.status(200).json(leaderboard);
});

// Health check endpoint
app.get('/api/result/health', (req, res) => {
  const simulatedCpu = Math.min(20 + Math.floor(requestCount * 1.8), 98);
  const activeConn = Math.max(1, Math.floor(Math.random() * 6) + (responseDelay > 0 ? 5 : 1));
  
  res.json({
    status: isOffline ? 'offline' : 'healthy',
    port: PORT,
    simulatedCpu: `${simulatedCpu}%`,
    activeConnections: activeConn,
    totalRequests: requestCount,
    delay: responseDelay
  });
});

// Control endpoint
app.post('/api/result/control', (req, res) => {
  const { action, value } = req.body;
  
  if (action === 'offline') {
    isOffline = value;
    res.json({ message: `Result Service is now ${isOffline ? 'OFFLINE' : 'ONLINE'}` });
  } else if (action === 'delay') {
    responseDelay = parseInt(value) || 0;
    res.json({ message: `Result Service response delay set to ${responseDelay}ms` });
  } else {
    res.status(400).json({ error: 'Invalid control action' });
  }
});

app.listen(PORT, () => {
  console.log(`[RESULT SERVICE] running on port ${PORT}`);
});
