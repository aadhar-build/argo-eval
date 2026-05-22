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
      notes       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('db: traces table ready');
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f0f1a; --surface: #1a1a2e; --border: #2a2a45;
    --text: #e0e0f0; --muted: #6272a4; --accent: #bd93f9;
    --green: #50fa7b; --red: #ff5555; --yellow: #f1fa8c;
    --font: 'SF Mono', 'Fira Code', monospace;
  }
  body { font-family: var(--font); background: var(--bg); color: var(--text); font-size: 13px; line-height: 1.5; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* Layout */
  .shell { display: grid; grid-template-columns: 320px 1fr; height: 100vh; overflow: hidden; }
  .sidebar { border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
  .main { overflow-y: auto; padding: 1.5rem; }

  /* Header */
  .topbar { padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }
  .topbar h1 { font-size: 1rem; color: var(--accent); letter-spacing: 0.05em; }
  .topbar .badge { font-size: 0.65rem; background: var(--border); border-radius: 999px; padding: 0.1rem 0.5rem; color: var(--muted); }

  /* Filters */
  .filters { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); display: flex; gap: 0.4rem; flex-shrink: 0; flex-wrap: wrap; }
  .filter-btn { font-family: var(--font); font-size: 0.7rem; padding: 0.25rem 0.65rem; border-radius: 999px; border: 1px solid var(--border); background: transparent; color: var(--muted); cursor: pointer; transition: all 0.15s; }
  .filter-btn:hover, .filter-btn.active { border-color: var(--accent); color: var(--accent); background: rgba(189,147,249,0.08); }

  /* Trace list */
  .trace-list { overflow-y: auto; flex: 1; }
  .trace-item { padding: 0.85rem 1.25rem; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.1s; }
  .trace-item:hover { background: rgba(189,147,249,0.05); }
  .trace-item.active { background: rgba(189,147,249,0.1); border-left: 2px solid var(--accent); }
  .trace-item .row1 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
  .trace-item .etype { font-size: 0.72rem; color: var(--accent); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .trace-item .ts { font-size: 0.65rem; color: var(--muted); }
  .trace-item .sid { font-size: 0.7rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 0.4rem; vertical-align: middle; }
  .dot.approved { background: var(--green); }
  .dot.rejected { background: var(--red); }
  .dot.pending  { background: var(--border); }

  /* Detail panel */
  .detail-empty { height: 100%; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 0.85rem; }
  .detail-header { margin-bottom: 1.25rem; }
  .detail-header h2 { font-size: 0.85rem; color: var(--accent); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.35rem; }
  .detail-meta { display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.72rem; color: var(--muted); }
  .detail-meta span { display: flex; align-items: center; gap: 0.3rem; }

  /* Review bar */
  .review-bar { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; padding: 0.85rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; flex-wrap: wrap; }
  .review-bar label { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .btn { font-family: var(--font); font-size: 0.72rem; padding: 0.3rem 0.8rem; border-radius: 4px; border: 1px solid; cursor: pointer; transition: all 0.15s; }
  .btn-approve { border-color: var(--green); color: var(--green); background: transparent; }
  .btn-approve:hover, .btn-approve.active { background: rgba(80,250,123,0.15); }
  .btn-reject  { border-color: var(--red); color: var(--red); background: transparent; }
  .btn-reject:hover, .btn-reject.active  { background: rgba(255,85,85,0.15); }
  .score-input { font-family: var(--font); font-size: 0.72rem; width: 48px; padding: 0.28rem 0.5rem; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--text); }
  .notes-input { font-family: var(--font); font-size: 0.72rem; flex: 1; min-width: 160px; padding: 0.28rem 0.5rem; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--text); }
  .btn-save { border-color: var(--accent); color: var(--accent); background: transparent; }
  .btn-save:hover { background: rgba(189,147,249,0.1); }
  .save-status { font-size: 0.68rem; color: var(--muted); }

  /* Payload */
  .payload-label { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
  pre { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 1rem; overflow-x: auto; font-size: 0.78rem; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }

  /* Empty state */
  .empty { text-align: center; padding: 3rem 1rem; color: var(--muted); }
  .empty .big { font-size: 2rem; margin-bottom: 0.5rem; }
`;

function relativeTime(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function statusDot(t) {
  if (t.approved === true)  return '<span class="dot approved"></span>';
  if (t.approved === false) return '<span class="dot rejected"></span>';
  return '<span class="dot pending"></span>';
}

// ── API endpoints ─────────────────────────────────────────────────────────────

app.get('/api/traces', async (req, res) => {
  const { filter = 'all', limit = 50, offset = 0 } = req.query;
  let where = '';
  if (filter === 'unreviewed') where = 'WHERE approved IS NULL';
  if (filter === 'approved')   where = 'WHERE approved = true';
  if (filter === 'rejected')   where = 'WHERE approved = false';

  const { rows } = await pool.query(
    `SELECT id, session_id, event_type, approved, score, created_at
     FROM traces ${where}
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  res.json(rows);
});

app.get('/api/traces/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM traces WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

app.patch('/api/traces/:id', async (req, res) => {
  const { approved, score, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE traces SET
       approved = COALESCE($1, approved),
       score    = COALESCE($2, score),
       notes    = COALESCE($3, notes)
     WHERE id = $4
     RETURNING id, approved, score, notes`,
    [approved ?? null, score ?? null, notes ?? null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

// ── Ingest ────────────────────────────────────────────────────────────────────

app.post('/ingest', async (req, res) => {
  const { session_id, event_type, payload } = req.body;
  if (!event_type || !payload) return res.status(400).json({ error: 'event_type and payload are required' });

  const { rows } = await pool.query(
    `INSERT INTO traces (session_id, event_type, payload) VALUES ($1, $2, $3) RETURNING id, created_at`,
    [session_id ?? null, event_type, JSON.stringify(payload)]
  );
  res.status(201).json(rows[0]);
});

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', version: '0.3.0', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: err.message });
  }
});

// ── UI ────────────────────────────────────────────────────────────────────────

app.get('/', async (req, res) => {
  const { rows: traces } = await pool.query(
    `SELECT id, session_id, event_type, approved, score, created_at
     FROM traces ORDER BY created_at DESC LIMIT 100`
  );
  const total = traces.length;

  const listItems = traces.length === 0
    ? `<div class="empty"><div class="big">∅</div>No traces yet. Sessions will appear here automatically.</div>`
    : traces.map(t => `
        <div class="trace-item" data-id="${t.id}" onclick="selectTrace('${t.id}', this)">
          <div class="row1">
            <span class="etype">${statusDot(t)}${t.event_type}</span>
            <span class="ts">${relativeTime(t.created_at)}</span>
          </div>
          <div class="sid">${t.session_id || '—'}</div>
        </div>`).join('');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Argo Eval</title>
  <style>${CSS}</style>
</head>
<body>
<div class="shell">

  <!-- Sidebar -->
  <div class="sidebar">
    <div class="topbar">
      <h1>Argo Eval</h1>
      <span class="badge">${total} traces</span>
    </div>
    <div class="filters">
      <button class="filter-btn active" onclick="applyFilter('all', this)">All</button>
      <button class="filter-btn" onclick="applyFilter('unreviewed', this)">Unreviewed</button>
      <button class="filter-btn" onclick="applyFilter('approved', this)">Approved</button>
      <button class="filter-btn" onclick="applyFilter('rejected', this)">Rejected</button>
    </div>
    <div class="trace-list" id="trace-list">${listItems}</div>
  </div>

  <!-- Detail -->
  <div class="main" id="main">
    <div class="detail-empty">← Select a trace to review</div>
  </div>

</div>

<script>
let currentFilter = 'all';
let currentId = null;

function applyFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  fetch('/api/traces?filter=' + f)
    .then(r => r.json())
    .then(traces => {
      const list = document.getElementById('trace-list');
      if (!traces.length) {
        list.innerHTML = '<div class="empty"><div class="big">∅</div>No traces in this filter.</div>';
        return;
      }
      list.innerHTML = traces.map(t => \`
        <div class="trace-item\${t.id === currentId ? ' active' : ''}" data-id="\${t.id}" onclick="selectTrace('\${t.id}', this)">
          <div class="row1">
            <span class="etype">\${dot(t)}\${t.event_type}</span>
            <span class="ts">\${rel(t.created_at)}</span>
          </div>
          <div class="sid">\${t.session_id || '—'}</div>
        </div>\`).join('');
    });
}

function dot(t) {
  if (t.approved === true)  return '<span class="dot approved"></span>';
  if (t.approved === false) return '<span class="dot rejected"></span>';
  return '<span class="dot pending"></span>';
}

function rel(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}

function selectTrace(id, el) {
  currentId = id;
  document.querySelectorAll('.trace-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');

  fetch('/api/traces/' + id)
    .then(r => r.json())
    .then(t => renderDetail(t));
}

function renderDetail(t) {
  const approvedState = t.approved === true ? 'approved' : t.approved === false ? 'rejected' : 'pending';
  document.getElementById('main').innerHTML = \`
    <div class="detail-header">
      <h2>\${t.event_type}</h2>
      <div class="detail-meta">
        <span>ID: \${t.id}</span>
        <span>Session: \${t.session_id || '—'}</span>
        <span>\${new Date(t.created_at).toLocaleString()}</span>
      </div>
    </div>

    <div class="review-bar">
      <label>Review</label>
      <button class="btn btn-approve\${t.approved === true ? ' active' : ''}" id="btn-approve" onclick="setApproval(true)">✓ Approve</button>
      <button class="btn btn-reject\${t.approved === false ? ' active' : ''}" id="btn-reject" onclick="setApproval(false)">✗ Reject</button>
      <label>Score</label>
      <input class="score-input" id="score-input" type="number" min="1" max="5" step="1" placeholder="1–5" value="\${t.score ?? ''}">
      <input class="notes-input" id="notes-input" type="text" placeholder="Notes…" value="\${t.notes ?? ''}">
      <button class="btn btn-save" onclick="saveReview()">Save</button>
      <span class="save-status" id="save-status"></span>
    </div>

    <div class="payload-label">Payload</div>
    <pre>\${JSON.stringify(t.payload, null, 2)}</pre>
  \`;
}

let pendingApproval = null;

function setApproval(val) {
  pendingApproval = val;
  document.getElementById('btn-approve').classList.toggle('active', val === true);
  document.getElementById('btn-reject').classList.toggle('active', val === false);
}

function saveReview() {
  const score = document.getElementById('score-input').value;
  const notes = document.getElementById('notes-input').value;
  const body = {};
  if (pendingApproval !== null) body.approved = pendingApproval;
  if (score) body.score = parseFloat(score);
  if (notes) body.notes = notes;

  fetch('/api/traces/' + currentId, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  .then(r => r.json())
  .then(() => {
    document.getElementById('save-status').textContent = 'Saved ✓';
    setTimeout(() => { document.getElementById('save-status').textContent = ''; }, 2000);
    applyFilter(currentFilter, document.querySelector('.filter-btn.active'));
  });
}
</script>
</body>
</html>`);
});

// ── Boot ──────────────────────────────────────────────────────────────────────

initDb()
  .then(() => app.listen(PORT, () => console.log(`argo-eval running on port ${PORT}`)))
  .catch(err => { console.error('failed to init db:', err); process.exit(1); });
