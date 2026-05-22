const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5002;

// Middlewares
app.use(cors());
app.use(express.json());

// Load Questions from local JSON
let questions = [];
try {
  const filePath = path.join(__dirname, 'questions.json');
  const rawData = fs.readFileSync(filePath, 'utf-8');
  questions = JSON.parse(rawData);
  console.log(`[QUIZ SERVICE] Loaded ${questions.length} questions successfully.`);
} catch (error) {
  console.error('[QUIZ SERVICE] Error loading questions.json:', error);
}

// Offline question generator (no external APIs)
const crypto = require('crypto');
const generator = require('./generator');

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const generatedQuizzes = new Map();

function decodeHtmlEntities(text = '') {
  const namedEntities = {
    '&quot;': '"',
    '&#039;': "'",
    '&amp;': '&',
    '&apos;': "'",
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&ndash;': '-',
    '&mdash;': '-',
    '&hellip;': '...'
  };

  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&[a-zA-Z#0-9]+;/g, (match) => namedEntities[match] || match);
}

function mapOpenTdbCategory(categoryName = '') {
  const normalized = categoryName.toLowerCase();
  const fallback = {
    tech: 18,
    computer: 18,
    history: 23,
    country: 22,
    geography: 22,
    science: 17,
    nature: 17,
    sports: 21,
    sport: 21
  };

  return fallback[normalized];
}

function storeGeneratedQuiz(questionsList) {
  const sessionId = crypto.randomUUID();
  generatedQuizzes.set(sessionId, questionsList);
  return sessionId;
}

// Distributed System State
let isOffline = false;
let responseDelay = 0; // ms
let requestCount = 0;

// Middleware to simulate network latency / service outage
app.use((req, res, next) => {
  requestCount++;

  if (req.path === '/api/quiz/health' || req.path === '/api/quiz/control') {
    if (responseDelay > 0) {
      return setTimeout(next, responseDelay);
    }
    return next();
  }
  
  if (isOffline) {
    return res.status(503).json({ error: 'Quiz & Question Service is currently Offline (Simulated Crash)' });
  }
  
  if (responseDelay > 0) {
    setTimeout(next, responseDelay);
  } else {
    next();
  }
});

// Quiz Endpoints
app.get('/api/quiz/questions', async (req, res) => {
  // Accept optional params: category, count, difficulty, source
  const { category, count, difficulty, source } = req.query;
  const num = parseInt(count) || 10;

  // If external OpenTDB source requested, proxy and normalize
  if (source === 'opentdb') {
    try {
      // Map simple category names to OpenTDB category IDs where possible
      const catId = category ? mapOpenTdbCategory(category) : undefined;
      const params = new URLSearchParams({ amount: String(num), type: 'multiple' });
      if (difficulty) params.set('difficulty', difficulty);
      if (catId) params.set('category', String(catId));

      const url = `https://opentdb.com/api.php?${params.toString()}`;
      const resp = await fetch(url);
      const body = await resp.json();

      if (body.response_code !== 0 || !Array.isArray(body.results)) {
        return res.status(502).json({ error: 'OpenTDB returned no results' });
      }

      const mapped = body.results.map((r, idx) => {
        const correct = decodeHtmlEntities(r.correct_answer);
        const incorrect = r.incorrect_answers.map(a => decodeHtmlEntities(a));
        const options = shuffle([correct, ...incorrect]);
        return {
          id: Date.now() + idx,
          question: decodeHtmlEntities(r.question),
          options,
          answer: options.indexOf(correct),
          category: r.category || (category || 'OpenTDB'),
          points: difficulty === 'hard' ? 15 : 10
        };
      });

      const sessionId = storeGeneratedQuiz(mapped);

      // strip answers for the public endpoint
      const secure = mapped.map(q => ({ id: q.id, question: q.question, options: q.options, category: q.category, points: q.points }));
      return res.status(200).json({ sessionId, questions: secure });
    } catch (err) {
      console.error('[QUIZ SERVICE] OpenTDB proxy error', err.message);
      return res.status(502).json({ error: 'Failed to fetch from OpenTDB' });
    }
  }

  // If client requests generated questions by category/count/difficulty, return those
  if (category || count || difficulty) {
    const generated = generator.generate(category, num, difficulty || 'medium');
    const sessionId = storeGeneratedQuiz(generated);
    const secure = generated.map(q => ({ id: q.id, question: q.question, options: q.options, category: q.category, points: q.points }));
    return res.status(200).json({ sessionId, questions: secure });
  }

  // Default: serve static bank (strip answers)
  const secureQuestions = questions.map(q => ({
    id: q.id,
    question: q.question,
    options: q.options,
    category: q.category,
    points: q.points
  }));

  const sessionId = storeGeneratedQuiz(questions.map(q => ({ id: q.id, answer: q.answer, points: q.points })));
  res.status(200).json({ sessionId, questions: secureQuestions });
});

// Dedicated generation endpoint (returns answers too for internal use)
app.get('/api/quiz/generate', (req, res) => {
  const { category, count, difficulty } = req.query;
  const num = parseInt(count) || 10;
  const generated = generator.generate(category, num, difficulty || 'medium');
  const sessionId = storeGeneratedQuiz(generated);
  res.status(200).json({ sessionId, questions: generated });
});

// Admin-only direct access for validation (from Result service, secure internally)
app.get('/api/quiz/answers-internal', (req, res) => {
  const { sessionId } = req.query;
  if (sessionId && generatedQuizzes.has(sessionId)) {
    return res.status(200).json(generatedQuizzes.get(sessionId));
  }

  res.status(200).json(questions.map(q => ({ id: q.id, answer: q.answer, points: q.points })));
});

// Health check endpoint
app.get('/api/quiz/health', (req, res) => {
  const simulatedCpu = Math.min(15 + Math.floor(requestCount * 1.2), 90);
  const activeConn = Math.max(1, Math.floor(Math.random() * 5) + (responseDelay > 0 ? 4 : 1));
  
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
app.post('/api/quiz/control', (req, res) => {
  const { action, value } = req.body;
  
  if (action === 'offline') {
    isOffline = value;
    res.json({ message: `Quiz Service is now ${isOffline ? 'OFFLINE' : 'ONLINE'}` });
  } else if (action === 'delay') {
    responseDelay = parseInt(value) || 0;
    res.json({ message: `Quiz Service response delay set to ${responseDelay}ms` });
  } else {
    res.status(400).json({ error: 'Invalid control action' });
  }
});

app.listen(PORT, () => {
  console.log(`[QUIZ SERVICE] running on port ${PORT}`);
});
