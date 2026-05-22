const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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
        <p style="margin-top:2rem; font-size:0.8rem;">v0.1.0 · hello world</p>
      </div>
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

app.listen(PORT, () => {
  console.log(`argo-eval running on port ${PORT}`);
});
