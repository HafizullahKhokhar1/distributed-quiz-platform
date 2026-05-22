const trimTrailingSlash = (value) => value.replace(/\/$/, '');

const getBaseUrl = (envKey, fallback) => {
  const value = import.meta.env[envKey];
  if (value) return trimTrailingSlash(value);

  // In production builds without explicit env vars, use same-origin API routes.
  if (import.meta.env.PROD) return '';

  return trimTrailingSlash(fallback);
};

export const API = {
  auth: getBaseUrl('VITE_AUTH_API_URL', 'http://localhost:5001'),
  quiz: getBaseUrl('VITE_QUIZ_API_URL', 'http://localhost:5002'),
  result: getBaseUrl('VITE_RESULT_API_URL', 'http://localhost:5003'),
};

export const ENDPOINTS = {
  authHealth: `${API.auth}/api/auth/health`,
  authRegister: `${API.auth}/api/auth/register`,
  authLogin: `${API.auth}/api/auth/login`,
  authControl: `${API.auth}/api/auth/control`,
  quizHealth: `${API.quiz}/api/quiz/health`,
  quizQuestions: `${API.quiz}/api/quiz/questions`,
  quizControl: `${API.quiz}/api/quiz/control`,
  resultHealth: `${API.result}/api/result/health`,
  resultSubmit: `${API.result}/api/result/submit`,
  resultLeaderboard: `${API.result}/api/result/leaderboard`,
  resultControl: `${API.result}/api/result/control`,
};