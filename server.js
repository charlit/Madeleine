// Serveur Madeleine auto-hébergé : sert le jeu ET remplace la fonction
// Netlify (netlify/functions/scores.js), avec un stockage en fichier JSON
// local à la place de Netlify Blobs. Pensé pour tourner sur un Mac mini
// via Docker, comme PalmStreet.

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8083;
const DATA_DIR = path.join(__dirname, 'data');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');
const MAX_ENTRIES = 10;
const MAX_SCORE = 100000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- petits utilitaires de stockage (fichier JSON, comme Netlify Blobs) ----
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return fallback;
  }
}
function writeJson(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
}

// ---- /api/scores : identique à netlify/functions/scores.js ----
app.get('/api/scores', (req, res) => {
  const list = readJson(SCORES_FILE, []);
  res.json(list);
});

app.post('/api/scores', (req, res) => {
  let name = String((req.body && req.body.name) || 'Anonyme').trim().slice(0, 14);
  if (!name) name = 'Anonyme';
  const score = Math.floor(Number(req.body && req.body.score));
  if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
    return res.status(400).json({ error: 'invalid score' });
  }
  let list = readJson(SCORES_FILE, []);
  list.push({ name, score, date: Date.now() });
  list.sort((a, b) => b.score - a.score);
  list = list.slice(0, MAX_ENTRIES);
  writeJson(SCORES_FILE, list);
  res.json(list);
});

app.listen(PORT, () => {
  console.log('Madeleine auto-hébergé, écoute sur le port ' + PORT);
});
