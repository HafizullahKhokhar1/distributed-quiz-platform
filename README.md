# Parallel & Distributed Quiz Platform

This is a lightweight quiz app that demonstrates parallel grading and distributed microservices.

## What it does

- Auth service handles login and registration.
- Quiz service serves the questions.
- Result service grades answers in parallel and updates the leaderboard.
- Frontend shows the quiz UI and live service monitor.

## Tech stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Styling: custom CSS
- Deployment: Render for backend, Vercel for frontend

## Run locally

```powershell
npm run install-all
npm run start
```

Open:

- Frontend: http://localhost:5173
- Auth: http://localhost:5001
- Quiz: http://localhost:5002
- Result: http://localhost:5003

## Deploy free

1. Push the repo to GitHub.
2. Deploy the three backend services on Render.
3. Deploy the frontend on Vercel.
4. Set these env vars on Vercel:

```bash
VITE_AUTH_API_URL=https://your-auth-service.onrender.com
VITE_QUIZ_API_URL=https://your-quiz-service.onrender.com
VITE_RESULT_API_URL=https://your-result-service.onrender.com
```

5. Set this env var on the result service in Render:

```bash
QUIZ_SERVICE_URL=https://your-quiz-service.onrender.com
```

The `render.yaml` file in this repo can help you deploy the backend services faster on Render.

## Project notes

- The app uses parallel processing in the result service through `Promise.all`.
- The monitor shows health and control states for all services.
- The code supports both local and deployed URLs through environment variables.

## Author

Made by Richa.
