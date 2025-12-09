import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { MongoClient } from 'mongodb';
import compression from 'compression';

// Get the current directory name in ES module
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

// Minimal write queue to avoid concurrent file writes clobbering
let fileWriteQueue = Promise.resolve();
function writeAll(items) {
  ensureDataFile();
  fileWriteQueue = fileWriteQueue
    .then(() => fs.promises.writeFile(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8'))
    .catch((err) => {
      console.error('[file-write]', err);
    });
  return fileWriteQueue;
}

const app = express();

// CORS configuration - permissive for development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'https://student-feedback-portal-2nn6.onrender.com',
    ];

    // Check for exact matches, .onrender.com subdomains, or any localhost port
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.onrender.com') ||
      /^http:\/\/localhost:\d+$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
    ) {
      callback(null, true);
    } else {
      console.warn('CORS blocked request from origin:', origin);
      const err = new Error('Not allowed by CORS');
      err.status = 403; // forbidden
      callback(err);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  optionsSuccessStatus: 200
};

// Apply CORS with the above configuration
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Add CORS headers to all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// Limit JSON payload size
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

// --- Admin authentication setup ---
// Admin passwords via env: ADMIN_PASSWORDS_JSON,
// e.g. {"Super Admin":"super","Facilities":"facilities123",...}
// or flat envs like ADMIN_PASSWORD_SUPER, ADMIN_PASSWORD_FACILITIES, etc.
function loadAdminPasswords() {
  // First check for environment variables
  const fromJson = process.env.ADMIN_PASSWORDS_JSON ? safeParseJson(process.env.ADMIN_PASSWORDS_JSON) : null;
  if (fromJson && typeof fromJson === 'object') return fromJson;

  // Default passwords (for development only)
  const map = {
    'Super Admin': 'superadmin123',
    'Facilities': 'facilities123',
    'Academic': 'academic123',
    'Infrastructure': 'infrastructure123',
    'Events': 'events123',
    'General': 'general123'
  };

  // Override with any environment variables if they exist
  if (process.env.ADMIN_PASSWORD_SUPER) map['Super Admin'] = process.env.ADMIN_PASSWORD_SUPER;
  if (process.env.ADMIN_PASSWORD_FACILITIES) map['Facilities'] = process.env.ADMIN_PASSWORD_FACILITIES;
  if (process.env.ADMIN_PASSWORD_ACADEMIC) map['Academic'] = process.env.ADMIN_PASSWORD_ACADEMIC;
  if (process.env.ADMIN_PASSWORD_INFRASTRUCTURE) map['Infrastructure'] = process.env.ADMIN_PASSWORD_INFRASTRUCTURE;
  if (process.env.ADMIN_PASSWORD_EVENTS) map['Events'] = process.env.ADMIN_PASSWORD_EVENTS;
  if (process.env.ADMIN_PASSWORD_GENERAL) map['General'] = process.env.ADMIN_PASSWORD_GENERAL;

  console.log('Loaded admin passwords for departments:', Object.keys(map));
  return map;
}

function safeParseJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-insecure-secret-change-me';
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'admin_session';
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 24); // 24h

function signAdminToken(payload) {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  let token = null;
  if (header.startsWith('Bearer ')) token = header.slice('Bearer '.length);
  if (!token && req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    token = req.cookies[SESSION_COOKIE_NAME];
  }
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    req.admin = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Optional: simple role check in future
function requireAdmin(req, res, next) {
  return authMiddleware(req, res, next);
}

// Serve static files from the root directory
app.use(express.static('.'));

// Serve admin_login.html at the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin_login.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});


// MongoDB setup (optional). If not available, fallback to JSON file.
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/student_feedback_portal';
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

// Handle OPTIONS for /api/login
app.options('/api/login', cors(corsOptions), (req, res) => {
  // Send response to OPTIONS requests
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(204).end();
});

// Admin login
app.post('/api/login', cors(corsOptions), (req, res) => {
  const { department, password } = req.body || {};
  console.log('Login attempt for department:', department);

  if (!department || !password) {
    console.log('Missing department or password');
    return res.status(400).json({ error: 'Department and password are required' });
  }

  const passwords = loadAdminPasswords();
  console.log('Available departments:', Object.keys(passwords));
  console.log('Expected password for', department, ':', passwords[department] ? '***' : 'Not found');

  const expected = passwords[department];
  if (!expected) {
    console.log('Department not found in passwords');
    return res.status(401).json({ error: 'Invalid department' });
  }

  if (String(expected) !== String(password)) {
    console.log('Password mismatch');
    return res.status(401).json({ error: 'Invalid password' });
  }

  console.log('Login successful for department:', department);
  const token = signAdminToken({ department });

  // Set httpOnly cookie for browser clients; also return token for programmatic use
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(process.env.COOKIE_SECURE || process.env.NODE_ENV === 'production'),
    maxAge: SESSION_TTL_SECONDS * 1000
  });

  return res.json({ ok: true, token, department });
});

// Admin logout
app.post('/api/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.json({ ok: true });
});

// Helpers for pagination and filtering
function parsePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

// List feedbacks (with pagination and filters)
// Query params: limit, page, status, category, search
app.get('/api/feedbacks', async (req, res, next) => {
  try {
    const limit = Math.min(parsePositiveInt(req.query.limit, 50), 200);
    const page = parsePositiveInt(req.query.page, 1);
    const skip = (page - 1) * limit;
    const status = req.query.status ? String(req.query.status).trim() : undefined;
    const category = req.query.category ? String(req.query.category).trim() : undefined;
    const search = req.query.search ? String(req.query.search).trim() : undefined;

    if (feedbacksCollection) {
      const mongoQuery = {};
      if (status) mongoQuery.status = status;
      if (category) mongoQuery.category = category;
      if (search) {
        mongoQuery.$or = [
          { text: { $regex: search, $options: 'i' } },
          { suggestions: { $regex: search, $options: 'i' } }
        ];
      }
      const cursor = feedbacksCollection.find(mongoQuery).sort({ createdAt: -1 }).skip(skip).limit(limit);
      const [items, total] = await Promise.all([cursor.toArray(), feedbacksCollection.countDocuments(mongoQuery)]);
      return res.json({ data: items, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    }

    const allItems = readAll();
    let filtered = allItems;
    if (status) filtered = filtered.filter((f) => f.status === status);
    if (category) filtered = filtered.filter((f) => f.category === category);
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((f) =>
        (f.text && f.text.toLowerCase().includes(s)) || (f.suggestions && f.suggestions.toLowerCase().includes(s))
      );
    }
    const total = filtered.length;
    const slice = filtered.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)).slice(skip, skip + limit);
    res.json({ data: slice, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
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
    const maxTextLen = Number(process.env.MAX_TEXT_LEN || 4000);
    const maxSuggestionsLen = Number(process.env.MAX_SUGGESTIONS_LEN || 2000);
    const maxNameLen = 200;
    const maxShortLen = 100;
    const item = {
      id: `FB-${nanoid(8)}`,
      category,
      subcategory: String(subcategory).trim().slice(0, maxShortLen),
      text: String(text).trim().slice(0, maxTextLen),
      urgency,
      // Optional free-text suggestions from the student
      ...(suggestions ? { suggestions: String(suggestions).trim().slice(0, maxSuggestionsLen) } : {}),
      // Optional student fields (only stored if provided)
      ...(studentName ? { studentName: String(studentName).trim().slice(0, maxNameLen) } : {}),
      ...(rollNo ? { rollNo: String(rollNo).trim().slice(0, maxShortLen) } : {}),
      ...(department ? { department: String(department).trim().slice(0, maxShortLen) } : {}),
      ...(courseNo ? { courseNo: String(courseNo).trim().slice(0, maxShortLen) } : {}),
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
    await writeAll(items);
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
app.patch('/api/feedbacks/:id/status', requireAdmin, async (req, res, next) => {
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
    await writeAll(items);
    res.json(items[idx]);
  } catch (err) {
    next(err);
  }
});

// Resolve feedback (legacy endpoint for backward compatibility)
app.patch('/api/feedbacks/:id/resolve', requireAdmin, async (req, res, next) => {
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
    await writeAll(items);
    res.json(items[idx]);
  } catch (err) {
    next(err);
  }
});

// Delete feedback
app.delete('/api/feedbacks/:id', requireAdmin, async (req, res, next) => {
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
    await writeAll(nextItems);
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
  // Return the specific error message for CORS or other known client errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS Error: Origin not allowed' });
  }

  res.status(status).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`[mongo] ${mongoClient ? 'Connected to MongoDB' : 'not available, using JSON file storage'}`);
  console.log('==> ///////////////////////////////////////////////////////////');
});


