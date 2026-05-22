import React, { useState, useEffect, useRef } from 'react';
import ServerMonitor from './components/ServerMonitor';
import { ENDPOINTS } from './config/api';

export default function App() {
  // User Authentication State
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [regName, setRegName] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Quiz State
  const [questions, setQuestions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('P&DC Concepts');
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [selectedSource, setSelectedSource] = useState('local');
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { questionId: selectedIndex }
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [parallelReport, setParallelReport] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [quizSessionId, setQuizSessionId] = useState('');
  const timerRef = useRef(null);

  // Leaderboard & Global State
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeTab, setActiveTab] = useState('quiz'); // 'quiz' or 'leaderboard'
  const [notification, setNotification] = useState({ text: '', type: '' });

  // Distributed Architecture Health States
  const [authHealth, setAuthHealth] = useState(null);
  const [quizHealth, setQuizHealth] = useState(null);
  const [resultHealth, setResultHealth] = useState(null);
  const [healthReady, setHealthReady] = useState(false);
  const [activeFlow, setActiveFlow] = useState('idle'); // 'auth', 'quiz', 'result', 'result-sync', 'idle'

  // Server health polling
  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, 4000);
    return () => clearInterval(interval);
  }, []);

  // Timer logic when quiz is active
  useEffect(() => {
    if (quizStarted && !quizFinished) {
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [quizStarted, quizFinished]);

  const fetchHealthData = async () => {
    // Poll Auth Service
    try {
      const res = await fetch(ENDPOINTS.authHealth);
      if (res.ok) setAuthHealth(await res.json());
      else setAuthHealth(null);
    } catch {
      setAuthHealth(null);
    }

    // Poll Quiz Service
    try {
      const res = await fetch(ENDPOINTS.quizHealth);
      if (res.ok) setQuizHealth(await res.json());
      else setQuizHealth(null);
    } catch {
      setQuizHealth(null);
    }

    // Poll Result Service
    try {
      const res = await fetch(ENDPOINTS.resultHealth);
      if (res.ok) setResultHealth(await res.json());
      else setResultHealth(null);
    } catch {
      setResultHealth(null);
    }

    if (!healthReady) {
      setHealthReady(true);
    }
  };

  const triggerNotification = (text, type = 'info') => {
    setNotification({ text, type });
    setTimeout(() => setNotification({ text: '', type: '' }), 5000);
  };

  const handleControlChange = async (service, action, value) => {
    const portMap = { auth: 5001, quiz: 5002, result: 5003 };
    const port = portMap[service];
    const controlMap = {
      auth: ENDPOINTS.authControl,
      quiz: ENDPOINTS.quizControl,
      result: ENDPOINTS.resultControl,
    };
    try {
      const res = await fetch(controlMap[service], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value })
      });
      if (res.ok) {
        const data = await res.json();
        triggerNotification(data.message, 'success');
        fetchHealthData();
      } else {
        triggerNotification(`Failed to apply chaos settings to ${service}!`, 'error');
      }
    } catch {
      triggerNotification(`Unable to communicate with ${service} control unit!`, 'error');
    }
  };

  // Auth Operations
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regName || !regUser || !regPass) {
      triggerNotification('Please fill in all register fields!', 'error');
      return;
    }

    setActiveFlow('auth');
    try {
      const res = await fetch(ENDPOINTS.authRegister, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, username: regUser, password: regPass })
      });
      const data = await res.json();
      
      if (res.ok) {
        triggerNotification('Account created! Logging you in...', 'success');
        setUser({ username: regUser.toLowerCase(), name: regName, token: `mock-jwt-${regUser}` });
        setRegName(''); setRegUser(''); setRegPass('');
      } else {
        triggerNotification(data.error || 'Registration failed!', 'error');
      }
    } catch {
      triggerNotification('Auth Service is offline! Cannot register user.', 'error');
    } finally {
      setTimeout(() => setActiveFlow('idle'), 1500);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginUser || !loginPass) {
      triggerNotification('Enter your username and password!', 'error');
      return;
    }

    setActiveFlow('auth');
    try {
      const res = await fetch(ENDPOINTS.authLogin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });
      const data = await res.json();

      if (res.ok) {
        setUser(data.user);
        triggerNotification(`Welcome back, ${data.user.name}!`, 'success');
      } else {
        triggerNotification(data.error || 'Login failed!', 'error');
      }
    } catch {
      triggerNotification('Auth Service is offline! Cannot authenticate.', 'error');
    } finally {
      setTimeout(() => setActiveFlow('idle'), 1500);
    }
  };

  // Quiz Operations
  const startQuiz = async () => {
    if (!user) {
      triggerNotification('Please register or log in first!', 'error');
      return;
    }

    setActiveFlow('quiz');
    try {
      // Request generated questions by category (10 by default)
      const catParam = selectedCategory === 'P&DC Concepts' ? 'mixed' : selectedCategory.toLowerCase();
      const params = new URLSearchParams({ category: catParam, count: '10', difficulty: selectedDifficulty });
      if (selectedSource === 'opentdb') params.set('source', 'opentdb');
      const res = await fetch(`${ENDPOINTS.quizQuestions}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const quizQuestions = Array.isArray(data) ? data : (data.questions || []);
        setQuestions(quizQuestions);
        setQuizSessionId(Array.isArray(data) ? '' : (data.sessionId || ''));
        setQuizStarted(true);
        setQuizFinished(false);
        setCurrentQIndex(0);
        setSelectedAnswers({});
        setTimeElapsed(0);
        setParallelReport(null);
        triggerNotification('Quiz downloaded from Distributed Quiz Server!', 'success');
      } else {
        triggerNotification('Failed to retrieve quiz questions!', 'error');
      }
    } catch {
      triggerNotification('Quiz Service is offline! Question list unavailable.', 'error');
    } finally {
      setTimeout(() => setActiveFlow('idle'), 1500);
    }
  };

  const handleSelectOption = (qId, optionIdx) => {
    setSelectedAnswers(prev => ({ ...prev, [qId]: optionIdx }));
  };

  const handleNextQuestion = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQIndex > 0) {
      setCurrentQIndex(prev => prev - 1);
    }
  };

  const submitQuiz = async () => {
    const formattedAnswers = questions.map(q => ({
      questionId: q.id,
      selectedOption: selectedAnswers[q.id] !== undefined ? selectedAnswers[q.id] : -1
    }));

    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    };

    setActiveFlow('result');
    try {
      // Simulate Service-to-Service call indication on svg (results service calling quiz service for answers)
      setTimeout(() => setActiveFlow('result-sync'), 400);

      const res = await fetch(ENDPOINTS.resultSubmit, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          name: user.name,
          userAnswers: formattedAnswers,
          timeTaken: formatTime(timeElapsed),
          quizSessionId
        })
      });
      const data = await res.json();

      if (res.ok) {
        setScore(data.score);
        setParallelReport(data.parallelReport);
        setQuizFinished(true);
        triggerNotification('Submissions graded in parallel on Result Server!', 'success');
        fetchLeaderboard();
      } else {
        triggerNotification(data.error || 'Quiz submission failed!', 'error');
      }
    } catch {
      triggerNotification('Result Service is offline! Submission failed.', 'error');
    } finally {
      setTimeout(() => setActiveFlow('idle'), 2500);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(ENDPOINTS.resultLeaderboard);
      if (res.ok) {
        setLeaderboard(await res.json());
      }
    } catch {
      console.error('Failed to update leaderboard.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setQuizStarted(false);
    setQuizFinished(false);
    triggerNotification('Logged out successfully.', 'info');
  };

  // Convert time taken format
  const formatSecs = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Dynamic Header */}
      <header className="app-header">
        <div className="header-brand">
          <span className="project-badge">P&DC</span>
          <div>
            <h1 className="brand-text">Parallel & Distributed Quiz Platform</h1>
            <p className="brand-subtitle">Built for parallel processing and distributed services</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <span className="info-badge">🎓 {user.name}</span>
              <button 
                onClick={handleLogout}
                className="btn btn-secondary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto' }}
              >
                Logout
              </button>
            </div>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--clr-text-secondary)' }}>
              🔒 Secure Microservice Channel
            </span>
          )}
        </div>
      </header>

      {/* Main UI layout */}
      <main className="main-layout">
        
        {/* Left Column: Interactive App Interface */}
        <section className="app-column" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Global Notification Banner */}
          {notification.text && (
            <div style={{
              background: notification.type === 'error' ? 'rgba(255, 59, 48, 0.15)' : 'rgba(0, 255, 136, 0.15)',
              border: `1px solid ${notification.type === 'error' ? 'var(--clr-danger)' : 'var(--clr-success)'}`,
              color: '#fff',
              padding: '0.85rem 1.25rem',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'var(--transition-smooth)'
            }}>
              <span>{notification.type === 'error' ? '❌' : '⚡'}</span>
              <span>{notification.text}</span>
            </div>
          )}

          {/* User authentication panels (if not logged in) */}
          {!user && (
            <div className="glass-panel" style={{ margin: '2rem auto', width: '100%', maxWidth: '480px' }}>
              <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <button 
                  onClick={() => setAuthMode('login')}
                  style={{ background: 'none', border: 'none', color: authMode === 'login' ? 'var(--clr-auth)' : 'var(--clr-text-muted)', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', outline: 'none' }}
                >
                  Log In
                </button>
                <button 
                  onClick={() => setAuthMode('register')}
                  style={{ background: 'none', border: 'none', color: authMode === 'register' ? 'var(--clr-auth)' : 'var(--clr-text-muted)', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', outline: 'none' }}
                >
                  Register Account
                </button>
              </div>

              {authMode === 'login' ? (
                <form onSubmit={handleLogin}>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input 
                      type="text" 
                      placeholder="e.g. student1" 
                      className="form-input" 
                      value={loginUser}
                      onChange={(e) => setLoginUser(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="form-label">Password</label>
                    <input 
                      type="password" 
                      placeholder="••••••••" 
                      className="form-input" 
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">
                    Login to Auth Node
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister}>
                  <div className="form-group">
                    <label className="form-label">FullName</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Student One" 
                      className="form-input" 
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input 
                      type="text" 
                      placeholder="e.g. student1" 
                      className="form-input" 
                      value={regUser}
                      onChange={(e) => setRegUser(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="form-label">Password</label>
                    <input 
                      type="password" 
                      placeholder="Create secure password" 
                      className="form-input" 
                      value={regPass}
                      onChange={(e) => setRegPass(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">
                    Register User Node
                  </button>
                </form>
              )}

              <div style={{ marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--clr-text-muted)', lineHeight: 1.4, textAlign: 'center' }}>
                🔑 Credentials checked against Auth Microservice (Port 5001) in real-time.
              </div>
            </div>
          )}

          {/* Active Application Panels (When Logged in) */}
          {user && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Navigation Tabs */}
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '0.35rem', border: '1px solid var(--border-light)' }}>
                <button 
                  onClick={() => { setActiveTab('quiz'); fetchLeaderboard(); }}
                  style={{
                    flex: 1, padding: '0.6rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                    background: activeTab === 'quiz' ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                    color: activeTab === 'quiz' ? '#fff' : 'var(--clr-text-secondary)',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  🎮 Attempt Quiz App
                </button>
                <button 
                  onClick={() => { setActiveTab('leaderboard'); fetchLeaderboard(); }}
                  style={{
                    flex: 1, padding: '0.6rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                    background: activeTab === 'leaderboard' ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                    color: activeTab === 'leaderboard' ? '#fff' : 'var(--clr-text-secondary)',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  🏆 Real-time Leaderboard
                </button>
              </div>

              {/* TAB 1: Quiz Workspace */}
              {activeTab === 'quiz' && (
                <div>
                  {/* State A: Start Screen */}
                  {!quizStarted && !quizFinished && (
                    <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                      <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>⚡</span>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                        Parallel & Distributed Quiz Challenge
                      </h2>
                      <p style={{ color: 'var(--clr-text-secondary)', fontSize: '0.95rem', maxWidth: '500px', margin: '0 auto 2rem auto', lineHeight: 1.5 }}>
                        Attempt questions on parallel computing, distributed systems, and service communication.
                        Your submission will trigger parallel computational grading.
                      </p>
                      <div style={{ margin: '0 auto 1.25rem', maxWidth: '360px', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                        <label style={{ color: 'var(--clr-text-secondary)', fontSize: '0.9rem', marginRight: '0.5rem' }}>Category</label>
                        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ padding: '0.45rem 0.6rem', borderRadius: '6px', background: 'var(--bg-panel)', color: '#fff', border: '1px solid var(--border-light)' }}>
                          <option>P&DC Concepts</option>
                          <option>Tech</option>
                          <option>History</option>
                          <option>Country</option>
                          <option>Science</option>
                          <option>Sports</option>
                        </select>
                      </div>
                      <div style={{ margin: '0 auto 1.25rem', maxWidth: '520px', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                        <label style={{ color: 'var(--clr-text-secondary)', fontSize: '0.9rem', marginRight: '0.5rem' }}>Difficulty</label>
                        <select value={selectedDifficulty} onChange={(e) => setSelectedDifficulty(e.target.value)} style={{ padding: '0.45rem 0.6rem', borderRadius: '6px', background: 'var(--bg-panel)', color: '#fff', border: '1px solid var(--border-light)' }}>
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>

                        <label style={{ color: 'var(--clr-text-secondary)', fontSize: '0.9rem', margin: '0 0.5rem 0 1rem' }}>Source</label>
                        <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} style={{ padding: '0.45rem 0.6rem', borderRadius: '6px', background: 'var(--bg-panel)', color: '#fff', border: '1px solid var(--border-light)' }}>
                          <option value="local">Local Generator</option>
                          <option value="opentdb">OpenTDB (no key)</option>
                        </select>
                      </div>
                      <button 
                        onClick={startQuiz}
                        className="btn btn-primary"
                        style={{ maxWidth: '280px', margin: '0 auto' }}
                      >
                        Launch Quiz Session
                      </button>
                    </div>
                  )}

                  {/* State B: Active Question Answering */}
                  {quizStarted && !quizFinished && (
                    <div className="glass-panel quiz-card">
                      
                      {/* Timer & Meta details */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span className="info-badge" style={{ color: 'var(--clr-quiz)', borderColor: 'rgba(208, 0, 255, 0.2)' }}>
                          🏷️ {questions[currentQIndex]?.category}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                          <span>⏱️ Elapsed:</span>
                          <span style={{ color: 'var(--clr-auth)', fontWeight: 'bold' }}>{formatSecs(timeElapsed)}</span>
                        </div>
                      </div>

                      {/* Top Horizontal Progress Bar */}
                      <div className="progress-bar-container">
                        <div 
                          className="progress-bar" 
                          style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }}
                        ></div>
                      </div>

                      <div className="question-meta">
                        <span>Question {currentQIndex + 1} of {questions.length}</span>
                        <span>Value: {questions[currentQIndex]?.points} Points</span>
                      </div>

                      <h3 className="question-text">
                        {questions[currentQIndex]?.question}
                      </h3>

                      <div className="options-list">
                        {questions[currentQIndex]?.options.map((option, idx) => {
                          const isSelected = selectedAnswers[questions[currentQIndex].id] === idx;
                          return (
                            <button
                              key={idx}
                              onClick={() => handleSelectOption(questions[currentQIndex].id, idx)}
                              className={`option-btn ${isSelected ? 'selected' : ''}`}
                            >
                              <span className="option-index">{String.fromCharCode(65 + idx)}</span>
                              <span>{option}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Navigation controls */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
                        <button 
                          onClick={handlePrevQuestion}
                          disabled={currentQIndex === 0}
                          className="btn btn-secondary"
                          style={{ opacity: currentQIndex === 0 ? 0.3 : 1, cursor: currentQIndex === 0 ? 'not-allowed' : 'pointer' }}
                        >
                          ◀ Previous
                        </button>
                        
                        {currentQIndex === questions.length - 1 ? (
                          <button 
                            onClick={submitQuiz}
                            className="btn btn-primary"
                            style={{ background: 'linear-gradient(135deg, #ffb300, #ff5e00)', boxShadow: 'var(--shadow-glow-result)' }}
                          >
                            🚀 Submit Quiz
                          </button>
                        ) : (
                          <button 
                            onClick={handleNextQuestion}
                            className="btn btn-secondary"
                          >
                            Next Question ▶
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* State C: Quiz Completed & Parallel Analysis Report */}
                  {quizFinished && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      
                      {/* Score Summary Box */}
                      <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
                        <h2 style={{ color: 'var(--clr-success)', fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                          Quiz Completed Successfully!
                        </h2>
                        <p style={{ color: 'var(--clr-text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                          Your response has been distributedly verified and parallel-graded.
                        </p>
                        
                        <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '1rem 2rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                          <span style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--clr-success)' }}>{score}</span>
                          <span style={{ color: 'var(--clr-text-muted)', fontSize: '1.2rem' }}>/ 100</span>
                        </div>

                        <div style={{ marginTop: '1.5rem' }}>
                          <button onClick={startQuiz} className="btn btn-primary" style={{ maxWidth: '240px', margin: '0 auto' }}>
                            Attempt Quiz Again
                          </button>
                        </div>
                      </div>

                      {/* Live Parallel Grading Report (Viva Wow Factor!) */}
                      {parallelReport && (
                        <div className="glass-panel parallel-report-card">
                          <div className="report-header">
                            <div className="report-title">
                              <span>⚡ Parallel Grading Analyzer</span>
                            </div>
                            <span className="info-badge" style={{ color: 'var(--clr-success)', borderColor: 'rgba(0, 255, 136, 0.2)' }}>
                              Speedup Active
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                              <span style={{ color: 'var(--clr-text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Grading Concurrency Mode</span>
                              <strong style={{ fontSize: '0.95rem', color: '#fff' }}>Asynchronous MapReduce (Promise.all)</strong>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                              <span style={{ color: 'var(--clr-text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Result Server CPU Latency</span>
                              <strong style={{ fontSize: '0.95rem', color: 'var(--clr-result)' }}>{parallelReport.totalLatencyMs} ms</strong>
                            </div>
                          </div>

                          {/* 4 CPU Core Displays */}
                          <div className="core-distribution-grid">
                            {[1, 2, 3, 4].map(coreNum => {
                              const coreTasks = parallelReport.gradings.filter(g => g.core === coreNum).length;
                              return (
                                <div key={coreNum} className={`core-box ${coreTasks > 0 ? 'active' : ''}`}>
                                  <div className="core-name">Core {coreNum}</div>
                                  <div className="core-load">{coreTasks} Tasks</div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Parallel Math Analysis: Amdahl's Law Speedup */}
                          <div style={{ background: 'rgba(6, 8, 13, 0.8)', border: '1px solid rgba(255, 179, 0, 0.1)', borderRadius: '8px', padding: '0.85rem', fontSize: '0.75rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                            <strong style={{ color: 'var(--clr-result)', display: 'block', marginBottom: '0.25rem' }}>📊 Amdahl's Law Speedup Calculations:</strong>
                            If graded sequentially with a simulated latency, it would take: <code style={{ color: 'var(--clr-danger)' }}>~250.0ms</code> (10 tasks × 25ms delay).
                            <br />
                            Using parallel execution in 4 cores, the grading finished in <code style={{ color: 'var(--clr-success)' }}>{parallelReport.totalLatencyMs}ms</code>.
                            <br />
                            <strong style={{ color: '#fff' }}>
                              Theoretical Speedup Factor (S) = T_sequential / T_parallel = {(250 / parallelReport.totalLatencyMs).toFixed(2)}x !
                            </strong>
                          </div>

                          {/* Dynamic execution terminal console */}
                          <div className="execution-console">
                            <div className="console-line">
                              <span className="console-timestamp">[{new Date().toLocaleTimeString()}]</span>
                              <span>[INITIALIZER] Spawning parallel grading threads...</span>
                            </div>
                            <div className="console-line">
                              <span className="console-timestamp">[{new Date().toLocaleTimeString()}]</span>
                              <span className="console-accent">[MAP STAGE] Allocating questions 1-10 across 4 active CPU cores...</span>
                            </div>
                            {parallelReport.gradings.map((grad, i) => (
                              <div key={i} className="console-line">
                                <span className="console-timestamp">[{new Date().toLocaleTimeString()}]</span>
                                <span>
                                  [CORE {grad.core}] Question {grad.questionId} assessment: {grad.isCorrect ? <span className="console-success">CORRECT (+10pts)</span> : <span style={{ color: 'var(--clr-danger)' }}>INCORRECT</span>} (compiled in {grad.latencyMs}ms)
                                </span>
                              </div>
                            ))}
                            <div className="console-line">
                              <span className="console-timestamp">[{new Date().toLocaleTimeString()}]</span>
                              <span className="console-success">[REDUCE STAGE] Summing up points across all threads... Output Score: {score}/100</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Dynamic Leaderboard rankings */}
              {activeTab === 'leaderboard' && (
                <div className="glass-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                      Leaderboard Rankings
                    </h2>
                    <button 
                      onClick={fetchLeaderboard}
                      className="btn btn-secondary" 
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', width: 'auto' }}
                    >
                      🔄 Refresh
                    </button>
                  </div>

                  <div className="leaderboard-list">
                    {leaderboard.length > 0 ? (
                      leaderboard.map((player, idx) => {
                        const isTopThree = idx < 3;
                        const rankMedals = ['gold', 'silver', 'bronze'];
                        return (
                          <div 
                            key={idx} 
                            className={`leaderboard-item ${isTopThree ? 'top-three' : ''}`}
                          >
                            <span className={`user-rank ${isTopThree ? rankMedals[idx] : ''}`}>
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                            </span>
                            
                            <div className="user-name-info">
                              <div className="user-fullname">{player.name}</div>
                              <div className="user-username">@{player.username}</div>
                            </div>
                            
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <span className="user-score-badge">{player.score} pts</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--clr-text-muted)' }}>⏱️ {player.timeTaken}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--clr-text-secondary)', padding: '2rem' }}>
                        No scores recorded yet. Attempt the quiz above to register your ranking!
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '1.5rem', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.85rem', fontSize: '0.75rem', color: 'var(--clr-text-secondary)', lineHeight: 1.4 }}>
                    📊 <strong>Distributed Database Simulation:</strong> This leaderboard dataset is held and compiled independently by the <strong>Result & Leaderboard Microservice (Port 5003)</strong>.
                  </div>
                </div>
              )}

            </div>
          )}

        </section>

        {/* Right Column: Real-time Distributed Monitor */}
        <section className="monitor-column">
          <ServerMonitor 
            authHealth={authHealth}
            quizHealth={quizHealth}
            resultHealth={resultHealth}
            healthReady={healthReady}
            activeFlow={activeFlow}
            onControlChange={handleControlChange}
          />
        </section>

      </main>
      
      {/* Footer credits */}
      <footer style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid var(--border-light)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--clr-text-muted)' }}>
        <strong>Made by Richa</strong> • Parallel and Distributed Computing final project
      </footer>
    </div>
  );
}
