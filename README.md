# Multi-Tenant WhatsApp AI Sales Agent

Digital Box AI Developer Assessment.

This repository is intentionally independent from any other product or production codebase.

## Architecture

- **Backend:** Node.js + Express + MongoDB/Mongoose
- **Queue:** Redis + BullMQ
- **Worker:** Dedicated Node.js worker process with per-lead Redis locking
- **AI service:** Python + FastAPI + LangGraph
- **LLM:** Google Gemini via langchain-google-genai
- **Frontend:** React + Vite
- **WhatsApp:** local simulation + MongoDB mock sender
- **Deployment target:** Docker Compose with separate API, worker, AI, frontend, MongoDB, and Redis services

## AI configuration

The real agent uses **Gemini 3.8 Flash**, a current stable/GA Gemini model suited to low-latency agentic workloads.

Copy `ai/.env.example` to `ai/.env` and provide:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` (defaults to `gemini-2.5-flash`)
- `LLM_MODE=real`

The API key is intentionally not included in this repository. For load testing without an external LLM, use `LLM_MODE=mock`.

## Engineering rules

- Never commit secrets or real credentials.
- Tenant identity is derived from trusted authentication context or WhatsApp phone number metadata.
- All tenant-scoped database reads/writes must include `accountId`.
- WhatsApp message IDs are idempotency keys.
- Webhooks acknowledge quickly and enqueue work; they never call the LLM directly.
- Same-lead messages are processed in order; different leads remain parallel.
- API and worker processes are independently deployable/scalable.
- Changes are developed on feature branches and reviewed through pull requests.
- CI must be green before a feature is considered complete.

## Local development

### Backend API

    cd backend
    npm install
    npm start

### BullMQ worker

In a second terminal:

    cd backend
    npm run worker

### AI service

    cd ai
    python -m venv .venv
    pip install -r requirements.txt
    uvicorn app.main:app --host 0.0.0.0 --port 8000

### Frontend

    cd frontend
    npm install
    npm run dev

Docker Compose starts MongoDB, Redis, the seed job, API, worker, AI service, and frontend. The seed job creates the required Sunrise Realty and FitZone Gym demo tenants/users before the API and worker start.

For the Docker stack, run:

    docker compose up --build

Then open http://localhost:3000.

### Demo credentials

- Sunrise Realty: owner@sunrise.test / Sunrise@123
- FitZone Gym: owner@fitzone.test / FitZone@123

These are assessment demo credentials only; do not reuse them in production.

## Assessment source of truth

The implementation follows the supplied Digital Box assessment specification, including its required scripts, tests, dashboard behavior, seed data, reliability requirements, and submission artifacts.
