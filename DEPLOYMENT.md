# 100% Free Cloud Deployment Guide

This guide shows how to deploy the entire **Multi-Tenant WhatsApp AI Sales Agent** stack for **$0 / free** using the best free cloud tiers:

| Component | Free Platform | Tier Specs |
|---|---|---|
| **Frontend Dashboard** | **Vercel** | Free Hobby (Global Edge CDN, auto-deploy from Git) |
| **Backend API + Worker** | **Render** or **Railway** or **Koyeb** | Free Web & Worker containers |
| **Python AI Engine** | **Render** or **Koyeb** | Free Python FastAPI container |
| **MongoDB Database** | **MongoDB Atlas** | M0 Free Sandbox (512 MB, free forever) |
| **Redis Queue & Locks** | **Upstash Redis** | Free Serverless Redis (10,000 requests/day) |

---

## Step 1: Free Databases (MongoDB & Redis)

### 1. MongoDB Atlas (Free Forever)
1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and sign up (free).
2. Create an **M0 Free Cluster**.
3. Under **Database Access**, create a database user (e.g., `appuser` / password).
4. Under **Network Access**, click **Add IP Address** -> select **Allow Access from Anywhere (`0.0.0.0/0`)**.
5. Click **Connect** -> **Drivers** -> Copy your connection URI:
   ```env
   mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/whatsapp_ai_agent?retryWrites=true&w=majority
   ```

### 2. Upstash Redis (Free Forever)
1. Go to [upstash.com](https://upstash.com/) and sign up with GitHub.
2. Click **Create Database** -> Name: `whatsapp-ai-redis`.
3. Select region closest to your backend (e.g. `us-east-1`).
4. Copy the standard Redis connection string from the dashboard:
   ```env
   rediss://default:<password>@<endpoint>:6379
   ```

---

## Step 2: Deploy Backend Services (Free on Render)

Your repository includes a pre-configured `render.yaml` blueprint.

1. Sign up for free at [render.com](https://render.com/) with GitHub.
2. In the Render Dashboard, click **New +** -> **Blueprint**.
3. Connect your repository: `siddhesh190805/Multi-Tenant-WhatsApp-AI-Sales-Agent`.
4. Render will detect `render.yaml` and configure:
   - `whatsapp-ai-backend` (Node.js API)
   - `whatsapp-ai-engine` (Python FastAPI RAG Service)
   - `whatsapp-ai-worker` (BullMQ persistent worker)
5. Fill in the prompt environment variables:
   - `MONGODB_URI`: Your MongoDB Atlas URI from Step 1.
   - `REDIS_URL`: Your Upstash Redis URI from Step 1.
   - `AI_SERVICE_URL`: The internal Render URL of the AI engine (e.g. `http://whatsapp-ai-engine:10000`).
   - `GEMINI_API_KEY` or `OPENAI_API_KEY`: Your AI API key.
6. Click **Apply**.
7. Once deployed, run the one-time database seed command from the Render Shell tab of the backend:
   ```bash
   node scripts/seed.js
   ```
8. Note your public backend URL (e.g., `https://whatsapp-ai-backend.onrender.com`).

---

## Step 3: Deploy Frontend on Vercel (100% Free)

1. Sign up / Log in to [vercel.com](https://vercel.com/) with GitHub.
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository: `siddhesh190805/Multi-Tenant-WhatsApp-AI-Sales-Agent`.
4. In the Project Configuration:
   - **Root Directory**: Click edit and select `frontend`.
   - **Framework Preset**: Vite (detected automatically).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Expand **Environment Variables** and add:
   - Key: `VITE_API_URL`
   - Value: `https://whatsapp-ai-backend.onrender.com` (Your backend URL from Step 2 without trailing slash)
6. Click **Deploy**.

Within 45 seconds, your frontend will be live on a `*.vercel.app` URL with automatic SSL!

---

## Alternative 1-Command Option: Oracle Cloud Always Free VM

If you prefer everything in one place with zero sleep timeouts:
1. Sign up for **Oracle Cloud Free Tier** (provides 2 Free AMD Compute VMs and up to 24GB RAM ARM compute for life).
2. SSH into your instance, install Docker:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose
   ```
3. Clone your repository:
   ```bash
   git clone https://github.com/siddhesh190805/Multi-Tenant-WhatsApp-AI-Sales-Agent.git
   cd Multi-Tenant-WhatsApp-AI-Sales-Agent
   ```
4. Run the entire stack:
   ```bash
   docker compose up -d --build
   ```
Everything (Frontend, Backend, BullMQ Worker, Python AI, Redis, MongoDB) will run in background containers on port 3000 and 4000.
