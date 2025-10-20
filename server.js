import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { MongoClient } from 'mongodb';

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

// Serve static files (HTML, CSS, JS)
app.use(express.static(__dirname));

// MongoDB setup (optional). If not available, fallback to JSON file.
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'student_feedback_portal';
const MONGODB_COLLECTION = process.env.MONGODB_COLLECTION || 'feedbacks';

let mongoClient = null;
let feedbacksCollection = null;

async function initMongo() {
  try {
    mongoClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
    await mongoClient.connect();
    const db = mongoClient.db(MONGODB_DB);
    feedbacksCollection = db.collection(MONGODB_COLLECTION);
    await feedbacksCollection.createIndex({ id: 1 }, { unique: true });
    await feedbacksCollection.createIndex({ createdAt: -1 });
    console.log('[mongo] connected');
  } catch (err) {
    feedbacksCollection = null;
    console.warn('[mongo] not available, using JSON file storage');
  }
}
initMongo();

// Global process-level error handlers to avoid silent crashes
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// List feedbacks
app.get('/api/feedbacks', async (req, res, next) => {
  try {
    if (feedbacksCollection) {
      const items = await feedbacksCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      return res.json(items);
    }
    const items = readAll();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// Create feedback
app.post('/api/feedbacks', async (req, res, next) => {
  const { category, subcategory, text, suggestions, urgency, studentName, rollNo, department, courseNo } = req.body || {};
  if (!category || !subcategory || !text || !urgency) {
    return res.status(400).json({ error: 'category, subcategory, text, urgency are required' });
  }
  try {
    const now = new Date();
    const item = {
      id: `FB-${nanoid(8)}`,
      category,
      subcategory: String(subcategory).trim(),
      text: String(text).trim(),
      urgency,
      // Optional free-text suggestions from the student
      ...(suggestions ? { suggestions: String(suggestions).trim() } : {}),
      // Optional student fields (only stored if provided)
      ...(studentName ? { studentName: String(studentName).trim() } : {}),
      ...(rollNo ? { rollNo: String(rollNo).trim() } : {}),
      ...(department ? { department: String(department).trim() } : {}),
      ...(courseNo ? { courseNo: String(courseNo).trim() } : {}),
      status: 'pending',
      createdAt: now.toISOString(),
      createdAtDisplay: new Intl.DateTimeFormat(undefined, {
        year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
      }).format(now)
    };

    if (feedbacksCollection) {
      await feedbacksCollection.insertOne(item);
      return res.status(201).json(item);
    }

    const items = readAll();
    items.unshift(item);
    writeAll(items);
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// Get single feedback by ID
app.get('/api/feedbacks/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (feedbacksCollection) {
      const feedback = await feedbacksCollection.findOne({ id });
      if (!feedback) return res.status(404).json({ error: 'Not found' });
      return res.json(feedback);
    }
    const items = readAll();
    const feedback = items.find(f => f.id === id);
    if (!feedback) return res.status(404).json({ error: 'Not found' });
    res.json(feedback);
  } catch (err) {
    next(err);
  }
});

// Update feedback status
app.patch('/api/feedbacks/:id/status', async (req, res, next) => {
  try {
    const id = req.params.id;
    const { status, adminComment } = req.body;
    
    if (!status || !['pending', 'in-progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be pending, in-progress, or resolved' });
    }

    const updateData = { 
      status,
      updatedAt: new Date().toISOString(),
      updatedAtDisplay: new Intl.DateTimeFormat(undefined, {
        year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
      }).format(new Date())
    };

    if (adminComment) {
      updateData.adminComment = String(adminComment).trim();
    }

    if (feedbacksCollection) {
      const result = await feedbacksCollection.findOneAndUpdate(
        { id },
        { $set: updateData },
        { returnDocument: 'after' }
      );
      if (!result || !result.value) return res.status(404).json({ error: 'Not found' });
      return res.json(result.value);
    }
    
    const items = readAll();
    const idx = items.findIndex(f => f.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    
    Object.assign(items[idx], updateData);
    writeAll(items);
    res.json(items[idx]);
  } catch (err) {
    next(err);
  }
});

// Resolve feedback (legacy endpoint for backward compatibility)
app.patch('/api/feedbacks/:id/resolve', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (feedbacksCollection) {
      const result = await feedbacksCollection.findOneAndUpdate(
        { id },
        { $set: { status: 'resolved' } },
        { returnDocument: 'after' }
      );
      if (!result || !result.value) return res.status(404).json({ error: 'Not found' });
      return res.json(result.value);
    }
    const items = readAll();
    const idx = items.findIndex(f => f.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    items[idx].status = 'resolved';
    writeAll(items);
    res.json(items[idx]);
  } catch (err) {
    next(err);
  }
});

// Delete feedback
app.delete('/api/feedbacks/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (feedbacksCollection) {
      const result = await feedbacksCollection.deleteOne({ id });
      if (result.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
      return res.status(204).send();
    }
    const items = readAll();
    const nextItems = items.filter(f => f.id !== id);
    if (nextItems.length === items.length) return res.status(404).json({ error: 'Not found' });
    writeAll(nextItems);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Centralized error handler
// Ensures stack traces are logged and a JSON error is returned to clients
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[express-error]', err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


