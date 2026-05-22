const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ── Database ──────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS traces (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id  TEXT,
      event_type  TEXT        NOT NULL,
      payload     JSONB       NOT NULL,
      approved    BOOLEAN,
      score       NUMERIC,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('db: traces table ready');
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Argo Eval</title>
      <style>
        body { font-family: monospace; background: #1a1a2e; color: #e0e0e0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .box { text-align: center; }
        h1 { font-size: 2rem; color: #bd93f9; margin-bottom: 0.5rem; }
        p { color: #6272a4; }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>Argo Eval</h1>
        <p>Trace viewer · Human review queue</p>
        <p style="margin-top:2rem; font-size:0.8rem;">v0.2.0 · POST /ingest ready</p>
      </div>
    </body>
    </html>
  `);
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', version: '0.2.0', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: err.message });
  }
});

// Ingest a trace event from any agent or hook
app.post('/ingest', async (req, res) => {
  const { session_id, event_type, payload } = req.body;

  if (!event_type || !payload) {
    return res.status(400).json({ error: 'event_type and payload are required' });
  }

  const { rows } = await pool.query(
    `INSERT INTO traces (session_id, event_type, payload)
     VALUES ($1, $2, $3)
     RETURNING id, created_at`,
    [session_id ?? null, event_type, JSON.stringify(payload)]
  );

  res.status(201).json(rows[0]);
});

// ── Boot ──────────────────────────────────────────────────────────────────────

initDb()
  .then(() => app.listen(PORT, () => console.log(`argo-eval running on port ${PORT}`)))
  .catch(err => { console.error('failed to init db:', err); process.exit(1); });
