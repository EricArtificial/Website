const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');
const path = require('path');

const ADMIN_PW = process.env.ADMIN_PW || '971314';

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve static site for convenience (optional)
app.use('/', express.static(path.join(__dirname, '..')));

// Messages API
app.get('/api/messages', (req, res) => {
  db.all('SELECT id, name, text, time FROM messages ORDER BY time ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'db' });
    res.json(rows);
  });
});

app.post('/api/messages', (req, res) => {
  const { name, text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'empty' });
  const time = Date.now();
  db.run('INSERT INTO messages(name, text, time) VALUES (?,?,?)', [name || '', text.trim(), time], function(err) {
    if (err) return res.status(500).json({ error: 'db' });
    res.json({ id: this.lastID, name: name||'', text: text.trim(), time });
  });
});

app.delete('/api/messages/:id', (req, res) => {
  const pw = req.get('x-admin-pw') || req.query.pw;
  if (pw !== ADMIN_PW) return res.status(403).json({ error: 'unauthorized' });
  const id = Number(req.params.id);
  db.run('DELETE FROM messages WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: 'db' });
    res.json({ ok: true });
  });
});

app.delete('/api/messages', (req, res) => {
  const pw = req.get('x-admin-pw') || req.query.pw;
  if (pw !== ADMIN_PW) return res.status(403).json({ error: 'unauthorized' });
  db.run('DELETE FROM messages', [], function(err) {
    if (err) return res.status(500).json({ error: 'db' });
    res.json({ ok: true });
  });
});

// Tree API
app.get('/api/tree', (req, res) => {
  db.get('SELECT wateredCount, lastWatered, harvestCount, readyForHarvest FROM tree_state WHERE id = 1', (err, row) => {
    if (err) return res.status(500).json({ error: 'db' });
    res.json({
      wateredCount: row.wateredCount || 0,
      lastWatered: row.lastWatered || null,
      harvestCount: row.harvestCount || 0,
      readyForHarvest: !!row.readyForHarvest
    });
  });
});

// POST /api/water -> attempt to water (server enforces once-per-day globally)
app.post('/api/water', (req, res) => {
  const today = new Date().toISOString().slice(0,10);
  db.get('SELECT wateredCount, lastWatered, harvestCount, readyForHarvest FROM tree_state WHERE id = 1', (err, row) => {
    if (err) return res.status(500).json({ error: 'db' });
    const st = row || { wateredCount:0, lastWatered:null, harvestCount:0, readyForHarvest:0 };
    if (st.readyForHarvest) return res.json({ allowed: false, reason: 'need_harvest', waterCount: st.wateredCount });
    if (st.lastWatered === today) return res.json({ allowed: false, reason: 'already_today', waterCount: st.wateredCount });
    const next = (st.wateredCount||0) + 1;
    const ready = next >= 10 ? 1 : 0;
    db.run('UPDATE tree_state SET wateredCount = ?, lastWatered = ?, readyForHarvest = ? WHERE id = 1', [Math.min(next,10), today, ready], function(err2){
      if (err2) return res.status(500).json({ error: 'db' });
      res.json({ allowed: true, waterCount: Math.min(next,10), readyForHarvest: !!ready });
    });
  });
});

// POST /api/harvest -> must include admin pw header x-admin-pw
app.post('/api/harvest', (req, res) => {
  const pw = req.get('x-admin-pw') || req.body && req.body.pw;
  if (pw !== ADMIN_PW) return res.status(403).json({ error: 'unauthorized' });
  db.get('SELECT wateredCount, harvestCount, readyForHarvest FROM tree_state WHERE id = 1', (err, row) => {
    if (err) return res.status(500).json({ error: 'db' });
    if (!row || !row.readyForHarvest) return res.json({ ok: false, message: 'not_ready', harvestCount: row ? row.harvestCount : 0 });
    const nextHarvest = (row.harvestCount||0) + 1;
    db.run('UPDATE tree_state SET wateredCount = 0, lastWatered = NULL, harvestCount = ?, readyForHarvest = 0 WHERE id = 1', [nextHarvest], function(err2){
      if (err2) return res.status(500).json({ error: 'db' });
      res.json({ ok: true, harvestCount: nextHarvest });
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server listening on', PORT));
