const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'data.sqlite');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('Failed to open DB', err);
  else console.log('Opened DB at', DB_PATH);
});

// Initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    text TEXT NOT NULL,
    time INTEGER NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tree_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    wateredCount INTEGER DEFAULT 0,
    lastWatered TEXT,
    harvestCount INTEGER DEFAULT 0,
    readyForHarvest INTEGER DEFAULT 0
  )`);

  // ensure single row exists
  db.get('SELECT COUNT(*) AS c FROM tree_state', (err, row) => {
    if (err) return console.error(err);
    if (!row || row.c === 0) {
      db.run("INSERT INTO tree_state(id, wateredCount, lastWatered, harvestCount, readyForHarvest) VALUES (1,0,NULL,0,0)");
    }
  });
});

module.exports = db;
