import React, { useState, useEffect } from 'react';

export default function ServerMonitor({ 
  authHealth, 
  quizHealth, 
  resultHealth, 
  healthReady,
  activeFlow, 
  onControlChange 
}) {
  // Local toggles for offline simulation
  const [authOffline, setAuthOffline] = useState(false);
  const [quizOffline, setQuizOffline] = useState(false);
  const [resultOffline, setResultOffline] = useState(false);
  
  // Local sliders for delay simulation
  const [authDelay, setAuthDelay] = useState(0);
  const [quizDelay, setQuizDelay] = useState(0);
  const [resultDelay, setResultDelay] = useState(0);

  // Sync state values on initial load (if any backend returns value)
  useEffect(() => {
    if (authHealth?.delay !== undefined) setAuthDelay(authHealth.delay);
    if (quizHealth?.delay !== undefined) setQuizDelay(quizHealth.delay);
    if (resultHealth?.delay !== undefined) setResultDelay(resultHealth.delay);
  }, [authHealth, quizHealth, resultHealth]);

  const handleToggleOffline = (service, currentVal, setter) => {
    const newVal = !currentVal;
    setter(newVal);
    onControlChange(service, 'offline', newVal);
  };

  const handleDelayChange = (service, val, setter) => {
    const delayVal = parseInt(val) || 0;
    setter(delayVal);
  };

  const handleDelayRelease = (service, val) => {
    onControlChange(service, 'delay', val);
  };

  const getStatusMeta = (health, offlineFlag) => {
    if (!healthReady) {
      return { label: 'Checking...', tone: 'neutral', active: false };
    }

    if (offlineFlag || !health || health.status !== 'healthy') {
      return { label: 'Offline', tone: 'danger', active: false };
    }

    return { label: 'Online', tone: 'success', active: true };
  };

  const authStatus = getStatusMeta(authHealth, authOffline);
  const quizStatus = getStatusMeta(quizHealth, quizOffline);
  const resultStatus = getStatusMeta(resultHealth, resultOffline);

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.25rem', background: 'linear-gradient(135deg, #00f0ff, #d000ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Distributed System Monitor
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--clr-text-secondary)' }}>
          Real-time microservices mapping, latency control, and fault tolerance visualizer.
        </p>
      </div>

      {/* 1. SVG Live Network Map */}
      <div className="network-visualizer">
        <svg className="network-lines">
          {/* Client to Auth Server path */}
          <path 
            d="M 50 70 Q 115 35 180 35" 
            fill="none" 
            stroke="rgba(255,255,255,0.06)" 
            strokeWidth="3" 
          />
          {activeFlow === 'auth' && (
            <path 
              d="M 50 70 Q 115 35 180 35" 
              fill="none" 
              className="network-path auth-flow" 
              strokeWidth="3" 
            />
          )}

          {/* Client to Quiz Server path */}
          <path 
            d="M 50 70 Q 115 70 180 70" 
            fill="none" 
            stroke="rgba(255,255,255,0.06)" 
            strokeWidth="3" 
          />
          {activeFlow === 'quiz' && (
            <path 
              d="M 50 70 Q 115 70 180 70" 
              fill="none" 
              className="network-path quiz-flow" 
              strokeWidth="3" 
            />
          )}

          {/* Client to Result Server path */}
          <path 
            d="M 50 70 Q 115 105 180 105" 
            fill="none" 
            stroke="rgba(255,255,255,0.06)" 
            strokeWidth="3" 
          />
          {activeFlow === 'result' && (
            <path 
              d="M 50 70 Q 115 105 180 105" 
              fill="none" 
              className="network-path result-flow" 
              strokeWidth="3" 
            />
          )}

          {/* Service-to-Service: Quiz Server to Result Server (Distributed Fetch) */}
          <path 
            d="M 230 70 L 230 105" 
            fill="none" 
            stroke="rgba(255,255,255,0.04)" 
            strokeWidth="2.5" 
            strokeDasharray="4, 4"
          />
          {activeFlow === 'result-sync' && (
            <path 
              d="M 230 70 L 230 105" 
              fill="none" 
              className="network-path result-flow" 
              strokeWidth="2.5" 
            />
          )}
        </svg>

        {/* Node: Client (React Frontend) */}
        <div className={`network-node client ${activeFlow !== 'idle' ? 'active' : ''}`}>
          <div className="node-icon-circle">UI</div>
          <span className="node-label">Frontend</span>
        </div>

        {/* Nodes: Backend Microservices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Auth Server */}
          <div className={`network-node auth ${authStatus.active ? 'active' : ''}`}>
            <div className="node-icon-circle">5001</div>
            <span className="node-label">Auth</span>
          </div>

          {/* Quiz Server */}
          <div className={`network-node quiz ${quizStatus.active ? 'active' : ''}`}>
            <div className="node-icon-circle">5002</div>
            <span className="node-label">Quiz</span>
          </div>

          {/* Result Server */}
          <div className={`network-node result ${resultStatus.active ? 'active' : ''}`}>
            <div className="node-icon-circle">5003</div>
            <span className="node-label">Result</span>
          </div>
        </div>
      </div>

      {/* 2. Microservice Server Details Panel */}
      <div className="server-grid">
        
        {/* Server Node: Auth */}
        <div className="server-node auth">
          <div className="server-header">
            <div className="server-title">
              <div className={`dot ${authStatus.tone === 'success' ? 'online' : 'offline'}`}></div>
              <span>Auth Service</span>
            </div>
            <span className="server-port">PORT 5001</span>
          </div>
          {!healthReady ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-secondary)', textAlign: 'center', padding: '0.2rem' }}>
              Checking service status...
            </div>
          ) : authHealth && !authOffline && authHealth.status === 'healthy' ? (
            <div className="server-stats">
              <div className="stat-box">
                <div className="stat-label">CPU</div>
                <div className="stat-value" style={{ color: 'var(--clr-auth)' }}>{authHealth.simulatedCpu}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Conns</div>
                <div className="stat-value">{authHealth.activeConnections}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Requests</div>
                <div className="stat-value">{authHealth.totalRequests}</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--clr-danger)', textAlign: 'center', padding: '0.2rem' }}>
              ⚠️ Node Offline - Connection Refused (Simulated Crash)
            </div>
          )}
        </div>

        {/* Server Node: Quiz */}
        <div className="server-node quiz">
          <div className="server-header">
            <div className="server-title">
              <div className={`dot ${quizStatus.tone === 'success' ? 'online' : 'offline'}`}></div>
              <span>Quiz & Questions</span>
            </div>
            <span className="server-port">PORT 5002</span>
          </div>
          {!healthReady ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-secondary)', textAlign: 'center', padding: '0.2rem' }}>
              Checking service status...
            </div>
          ) : quizHealth && !quizOffline && quizHealth.status === 'healthy' ? (
            <div className="server-stats">
              <div className="stat-box">
                <div className="stat-label">CPU</div>
                <div className="stat-value" style={{ color: 'var(--clr-quiz)' }}>{quizHealth.simulatedCpu}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Conns</div>
                <div className="stat-value">{quizHealth.activeConnections}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Requests</div>
                <div className="stat-value">{quizHealth.totalRequests}</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--clr-danger)', textAlign: 'center', padding: '0.2rem' }}>
              ⚠️ Node Offline - Connection Refused (Simulated Crash)
            </div>
          )}
        </div>

        {/* Server Node: Result */}
        <div className="server-node result">
          <div className="server-header">
            <div className="server-title">
              <div className={`dot ${resultStatus.tone === 'success' ? 'online' : 'offline'}`}></div>
              <span>Result & Leaderboard</span>
            </div>
            <span className="server-port">PORT 5003</span>
          </div>
          {!healthReady ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--clr-text-secondary)', textAlign: 'center', padding: '0.2rem' }}>
              Checking service status...
            </div>
          ) : resultHealth && !resultOffline && resultHealth.status === 'healthy' ? (
            <div className="server-stats">
              <div className="stat-box">
                <div className="stat-label">CPU</div>
                <div className="stat-value" style={{ color: 'var(--clr-result)' }}>{resultHealth.simulatedCpu}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Conns</div>
                <div className="stat-value">{resultHealth.activeConnections}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Requests</div>
                <div className="stat-value">{resultHealth.totalRequests}</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--clr-danger)', textAlign: 'center', padding: '0.2rem' }}>
              ⚠️ Node Offline - Connection Refused (Simulated Crash)
            </div>
          )}
        </div>

      </div>

      {/* 3. Distributed Resilience Controllers */}
      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--clr-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Chaos Testing Simulator
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Controls: Auth Service */}
          <div className="control-switch-container">
            <div className="control-label-info">
              <span className="control-name">Crash Auth Service (5001)</span>
              <span className="control-desc">Tests system tolerance when login is unavailable.</span>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={authOffline}
                onChange={() => handleToggleOffline('auth', authOffline, setAuthOffline)}
              />
              <span className="slider"></span>
            </label>
          </div>

          {/* Controls: Quiz Service */}
          <div className="control-switch-container">
            <div className="control-label-info">
              <span className="control-name">Crash Quiz Service (5002)</span>
              <span className="control-desc">Quiz loaded from cache if offline (Resilience).</span>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={quizOffline}
                onChange={() => handleToggleOffline('quiz', quizOffline, setQuizOffline)}
              />
              <span className="slider"></span>
            </label>
          </div>

          {/* Controls: Result Service */}
          <div className="control-switch-container">
            <div className="control-label-info">
              <span className="control-name">Crash Result Service (5003)</span>
              <span className="control-desc">Students can take quiz, but submissions fail/queue.</span>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={resultOffline}
                onChange={() => handleToggleOffline('result', resultOffline, setResultOffline)}
              />
              <span className="slider"></span>
            </label>
          </div>

          {/* Lag Injector */}
          <div className="control-switch-container" style={{ borderBottom: 'none', paddingTop: '0.5rem' }}>
            <div className="control-label-info">
              <span className="control-name">Inject Network Latency</span>
              <span className="control-desc">Adds simulated lag (ms) to all microservice requests.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="range" 
                min="0" 
                max="2500" 
                step="250"
                value={quizDelay}
                className="lag-slider"
                onChange={(e) => handleDelayChange('quiz', e.target.value, setQuizDelay)}
                onMouseUp={(e) => handleDelayRelease('quiz', e.target.value)}
                onTouchEnd={(e) => handleDelayRelease('quiz', e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', minWidth: '45px', textAlign: 'right' }}>
                {quizDelay}ms
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PDC Learning Note */}
      <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.85rem', fontSize: '0.75rem', color: 'var(--clr-text-secondary)', lineHeight: 1.4 }}>
        <strong style={{ color: 'var(--clr-success)', display: 'block', marginBottom: '0.2rem' }}>💡 Distributed Computing Viva Tip:</strong>
        In a microservices setup, if the <strong>Quiz Server</strong> crashes, the <strong>Auth Server</strong> continues working perfectly. This is called <strong>Fault Isolation (Fault Tolerance)</strong>, which is impossible in single monolith servers!
      </div>
    </div>
  );
}
