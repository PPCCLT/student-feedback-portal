# Student Feedback Portal - Local Backend

## Prerequisites
- Node.js 18+

## Setup
```bash
npm install
npm run start
```
Server runs at `http://localhost:3000`.

## API Endpoints
- GET `/api/feedbacks` → list feedbacks
- POST `/api/feedbacks` → create feedback
  - body: `{ category, text, urgency }`
- PATCH `/api/feedbacks/:id/resolve` → mark resolved
- DELETE `/api/feedbacks/:id` → delete

## Frontend Integration
- `feedback.html` posts to the API, falling back to localStorage if offline.
- `admin_dashboard.html` loads/manages via API, falling back to localStorage.


