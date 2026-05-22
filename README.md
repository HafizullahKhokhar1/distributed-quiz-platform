# Parallel & Distributed Quiz Platform

Parallel & Distributed Quiz Platform is a microservices-based quiz application built to demonstrate distributed system concepts, parallel grading, and interactive frontend/backend communication.

## Overview

The application is split into three services plus a React frontend:

- `auth-service` handles user login and registration.
- `quiz-service` serves quiz questions and supports generated question sets.
- `result-service` evaluates submissions in parallel and maintains the leaderboard.
- The frontend provides the quiz experience, service monitoring, and submission flow.

## Features

- Microservice architecture with separate auth, quiz, and result services
- Parallel grading using `Promise.all`
- Live service health monitoring and control toggles
- Category-based quiz generation with difficulty selection
- Optional OpenTDB question source without API keys
- Real-time leaderboard updates

## Tech Stack

- Frontend: React, Vite
- Backend: Node.js, Express
- Styling: Custom CSS
- Data: In-memory stores and local JSON fixtures

## Project Structure

```text
backend/
	auth-service/
	quiz-service/
	result-service/
frontend/
	src/
	public/
scripts/
server.js
```

## Local Development

Install dependencies:

```powershell
npm run install-all
```

Start the app:

```powershell
npm start
```

By default, the app is available on the local port configured by the root server.

## Notes

- The frontend uses environment-based API configuration for local and production usage.
- The quiz service can serve static, generated, or OpenTDB-backed question sets.
- The result service grades submissions against the current quiz session data.

## License

See the repository license for usage terms.
