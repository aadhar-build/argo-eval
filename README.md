# Argo Eval

A lightweight trace viewer and human-in-the-loop review queue for AI agent sessions.

## Why this exists

Running AI agents in production generates output you need to evaluate — but most eval frameworks are designed for structured test suites, not free-form agent traces. I needed a way to capture sessions from my Claude agents, replay them, and apply human judgment without wiring up a full observability stack.

Argo Eval is that tool. Lightweight, self-hosted, no vendor dependencies.

## What it does

- **Ingest traces** — agent sessions POST events (tool calls, completions, errors) to a REST endpoint with arbitrary JSON payloads
- **Review queue** — sidebar lists all traces, filterable by `pending / approved / rejected`
- **Human scoring** — approve or reject each trace, add a 1–5 score and notes
- **Session grouping** — traces grouped by `session_id` for multi-turn replay
- **No build step** — single Express file with embedded HTML/CSS/JS

## Stack

- Node.js + Express
- PostgreSQL (event storage, review state)
- Deployed on Railway

## Quick start

```bash
npm install
DATABASE_URL=postgres://... node server.js
```

## Ingest API

```bash
# Write a trace from any agent
curl -X POST http://localhost:3000/api/traces \
  -H 'Content-Type: application/json' \
  -d '{"session_id": "sess_abc", "event_type": "tool_call", "payload": {"tool": "Bash", "cmd": "ls"}}'
```

## Schema

```sql
traces (
  id          UUID PRIMARY KEY,
  session_id  TEXT,
  event_type  TEXT,
  payload     JSONB,
  approved    BOOLEAN,   -- null = pending, true = approved, false = rejected
  score       NUMERIC,   -- 1–5
  notes       TEXT,
  created_at  TIMESTAMPTZ
)
```

---

Built to support human-in-the-loop eval for personal agent infrastructure. Pairs with [llm-evals-comparison](https://github.com/aadhar-build/llm-evals-comparison) for framework selection context.
