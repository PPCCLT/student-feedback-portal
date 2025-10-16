import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data', 'feedbacks.json');

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
}

function readAll() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeAll(items) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');
}

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// List feedbacks
app.get('/api/feedbacks', (req, res) => {
  const items = readAll();
  res.json(items);
});

// Create feedback
app.post('/api/feedbacks', (req, res) => {
  const { category, text, urgency } = req.body || {};
  if (!category || !text || !urgency) {
    return res.status(400).json({ error: 'category, text, urgency are required' });
  }
  const now = new Date();
  const item = {
    id: `FB-${nanoid(8)}`,
    category,
    text: String(text).trim(),
    urgency,
    status: 'pending',
    createdAt: now.toISOString(),
    createdAtDisplay: new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(now)
  };
  const items = readAll();
  items.unshift(item);
  writeAll(items);
  res.status(201).json(item);
});

// Resolve feedback
app.patch('/api/feedbacks/:id/resolve', (req, res) => {
  const id = req.params.id;
  const items = readAll();
  const idx = items.findIndex(f => f.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  items[idx].status = 'resolved';
  writeAll(items);
  res.json(items[idx]);
});

// Delete feedback
app.delete('/api/feedbacks/:id', (req, res) => {
  const id = req.params.id;
  const items = readAll();
  const next = items.filter(f => f.id !== id);
  if (next.length === items.length) return res.status(404).json({ error: 'Not found' });
  writeAll(next);
  res.status(204).send();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


