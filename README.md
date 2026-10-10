# Multi-Tenant WhatsApp AI Sales Agent

Digital Box AI Developer Assessment.

This repository is intentionally independent from any other product or production codebase.

## Architecture

- **Backend:** Node.js + Express + MongoDB/Mongoose
- **Queue:** Redis + BullMQ
- **Worker:** Dedicated Node.js worker process with per-lead Redis locking
- **AI service:** Python + FastAPI + LangGraph
- **LLM:** Configurable Gemini or OpenAI-compatible provider via LangChain
- **Frontend:** React + Vite
- **WhatsApp:** local simulation + MongoDB mock sender
- **Deployment target:** Docker Compose with separate API, worker, AI, frontend, MongoDB, and Redis services

## AI configuration

AI credentials and model selection are **runtime configuration**, not build-time configuration. The Docker image contains no API key. Edit `ai/.env`, then recreate the AI container; you do **not** need to rebuild the image.

Supported runtime adapters:

- `AI_PROVIDER=gemini` — Google Gemini using `AI_API_KEY` and `AI_MODEL`.
- `AI_PROVIDER=openai-compatible` — OpenAI-compatible APIs using `AI_API_KEY`, `AI_MODEL`, and `AI_BASE_URL`. This covers providers exposing the OpenAI Chat Completions-compatible protocol, such as OpenAI, OpenRouter, and Groq.

Example:

    copy ai/.env.example ai/.env
    # edit ai/.env and set the provider/key/model/base URL
    docker compose up -d --force-recreate ai

For OpenAI:

    AI_PROVIDER=openai-compatible
    AI_API_KEY=<your-key>
    AI_MODEL=<your-model>
    AI_BASE_URL=https://api.openai.com/v1

For OpenRouter:

    AI_PROVIDER=openai-compatible
    AI_API_KEY=<your-key>
    AI_MODEL=<your-model>
    AI_BASE_URL=https://openrouter.ai/api/v1

For Gemini:

    AI_PROVIDER=gemini
    AI_API_KEY=<your-key>
    AI_MODEL=gemini-3.8-flash

Changing `AI_API_KEY` later only requires editing `ai/.env` and recreating the `ai` service. Changing the model/provider/base URL works the same way. No source-code change or Docker image rebuild is required.

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

For the Docker stack, set the required secrets first (never commit them), then run:

    $env:JWT_SECRET="replace-with-a-long-random-secret"
    $env:WHATSAPP_APP_SECRET="replace-with-your-whatsapp-app-secret"
    docker compose up --build

The Compose demo explicitly enables the authenticated developer simulation panel so the dashboard remains usable locally. Keep `ENABLE_DEV_SIMULATION=false` for a real production deployment.

Then open http://localhost:3000.

### Demo credentials

- Sunrise Realty: owner@sunrise.test / Sunrise@123
- FitZone Gym: owner@fitzone.test / FitZone@123

These are assessment demo credentials only; do not reuse them in production.

## WhatsApp / Meta Cloud API boundary

The assessment intentionally uses a simulated Meta/WhatsApp transport, so no Meta account or phone number is required. The inbound contract is nevertheless shaped for the real Cloud API:

- `POST /webhook/whatsapp` accepts Meta-style message payloads.
- `metadata.phone_number_id` selects the tenant.
- `X-Hub-Signature-256` is verified with `WHATSAPP_APP_SECRET`.
- `GET /webhook/whatsapp` supports Meta webhook verification using `WHATSAPP_VERIFY_TOKEN`.
- `WHATSAPP_MODE=mock` stores outbound messages in MongoDB for the assessment.
- `WHATSAPP_MODE=real` uses the WhatsApp Cloud API text-message endpoint with `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_GRAPH_VERSION`, and `WHATSAPP_GRAPH_BASE_URL`.

Meta's Cloud API sends outbound messages through `POST /{version}/{phone-number-id}/messages`; the implementation keeps that integration behind the existing sender interface.

## Core Technical Design & Assessment Answers

### 1. How we kept messages of the same lead in order
- **Mechanism:** Redis-based Distributed Mutex per Lead (`lock:lead:{leadId}`).
- **Why this method:** BullMQ worker acquires an exclusive Redis lock for `leadId` before processing. If a secondary message arrives for the same lead while the first is generating an AI reply, the secondary job waits or re-queues via exponential backoff until the lock is released.
- **Result:** Strict chronological execution per lead while maintaining 100% horizontal parallelism across different leads.

### 2. How we prevented duplicate replies
- **Mechanism:** Dual-layer idempotency (Redis NX + MongoDB unique index).
- **Inbound Webhook Layer:** When Meta dispatches `wamid.XXX`, Redis executes `SET wamid:{msgId} 1 NX EX 86400`. If the key exists, the webhook immediately returns `HTTP 200` without creating a duplicate job.
- **Database Durability Layer:** `Message.waMessageId` has a MongoDB unique sparse index. Even under theoretical network re-delivery edge cases, duplicate writes are rejected at the database engine level.

### 3. How we made sure tenants never see each other's data
- **At the Webhook Layer:** Tenant identity is strictly derived from Meta's `metadata.phone_number_id`. The payload text and URLs are never trusted for tenant routing.
- **At the Database Layer:** Every single Mongoose query enforces `accountId` scoping (`Lead.find({ accountId, ... })`). Querying cross-tenant leads returns `404 Not Found` (never `403`), ensuring total tenant invisibility.
- **At the AI / Prompt Layer:** Prompt context is dynamically populated exclusively with the caller's tenant profile. Tenant A's pricing and FAQs are physically absent from Tenant B's prompt context.
- **At the Vector DB / RAG Layer:** ChromaDB isolates data into physically segregated per-tenant collections (`t_sunrise_realty`, `t_fitzone_gym`). Cross-tenant vector similarity retrieval is architecturally impossible.

### 4. Production-Grade RAG Architecture
- **Vector DB:** ChromaDB in persistent on-disk mode (`/app/chroma_db`).
- **Embedding Model:** `all-MiniLM-L6-v2` (384-dimensional dense semantic vectors via ONNX Runtime).
- **Latency:** ~3–6ms local inference on CPU with zero external API rate-limit or downtime risks.
- **Indexing:** HNSW graphs with Cosine distance metric (`hnsw:space: cosine`).
- **Inspection Endpoint:** `GET /rag/info` exposes active collections and telemetry.

## Production scaling / 10,000 simultaneous leads

For a production deployment at much higher concurrency, I would:

1. Run multiple stateless API instances behind a load balancer.
2. Keep webhook acknowledgement independent from LLM execution and move to a durable outbox/transactional handoff if message/job durability becomes stricter than Redis enqueue acknowledgement.
3. Scale BullMQ workers horizontally and keep per-lead ordering with a distributed sequencing/locking strategy.
4. Partition or shard queues by workload/tenant tier so a large tenant cannot monopolize worker capacity.
5. Move tenant lookup and hot configuration to a distributed cache with bounded TTL and invalidation.
6. Add MongoDB replica sets, appropriate compound indexes, retention/archival for message history, and query profiling.
7. Add provider rate-limit handling, circuit breakers, token/cost budgets, and model fallback.
8. Add centralized logs, metrics, traces, alerting, and dead-letter replay tooling.
9. Use Meta Cloud API delivery/status webhooks for outbound delivery state rather than assuming an API request equals delivery.
10. Keep production developer simulation disabled and store all credentials in a managed secret store.

## Assessment source of truth

The implementation follows the supplied Digital Box assessment specification, including its required scripts, tests, dashboard behavior, seed data, reliability requirements, bonus features, and submission artifacts.

