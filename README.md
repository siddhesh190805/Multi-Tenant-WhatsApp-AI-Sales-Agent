# Multi-Tenant WhatsApp AI Sales Agent

Digital Box AI Developer Assessment.

This repository is intentionally independent from any other product or production codebase.

## Status

Repository bootstrap only. Implementation is being developed through feature branches and pull requests.

## Required stack

- Backend: Node.js + Express + MongoDB/Mongoose + BullMQ + Redis
- Frontend: React
- AI agent: LangGraph in Python
- WhatsApp: local simulation + MongoDB mock sender

## Engineering rules

- Never commit secrets or real credentials.
- Tenant identity is derived from trusted authentication context or WhatsApp phone number metadata.
- All tenant-scoped database reads/writes must include `accountId`.
- WhatsApp message IDs are idempotency keys.
- Webhooks acknowledge quickly and enqueue work; they never call the LLM directly.
- Same-lead messages are processed in order; different leads remain parallel.
- Changes are developed on feature branches and reviewed through pull requests.
- CI must be green before a feature is considered complete.

## Assessment source of truth

The implementation follows the supplied Digital Box assessment specification, including its required scripts, tests, dashboard behavior, seed data, and submission artifacts.
