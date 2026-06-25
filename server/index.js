const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const { S3Client, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { Upload } = require("@aws-sdk/lib-storage");
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['https://lustbuster.cloud', 'https://www.lustbuster.cloud', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// ── SQLite DB ─────────────────────────────────────────────────────────────────
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'lustbuster.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    username       TEXT    UNIQUE NOT NULL,
    password_hash  TEXT    NOT NULL,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    video_key  TEXT    NOT NULL,
    user_id    INTEGER NOT NULL,
    username   TEXT    NOT NULL,
    content    TEXT    NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_key);
  CREATE TABLE IF NOT EXISTS likes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    video_key  TEXT    NOT NULL,
    user_id    INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(video_key, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_likes_user  ON likes(user_id);
  CREATE INDEX IF NOT EXISTS idx_likes_video ON likes(video_key);
  CREATE TABLE IF NOT EXISTS history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    video_key  TEXT    NOT NULL,
    user_id    INTEGER NOT NULL,
    watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(video_key, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id);
  CREATE TABLE IF NOT EXISTS user_videos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    video_key   TEXT    UNIQUE NOT NULL,
    user_id     INTEGER NOT NULL,
    title       TEXT    NOT NULL,
    size        INTEGER DEFAULT 0,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_user_videos_user ON user_videos(user_id);
  CREATE TABLE IF NOT EXISTS thumbnails (
    video_key     TEXT PRIMARY KEY,
    thumbnail_key TEXT NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS views (
    video_key TEXT PRIMARY KEY,
    count     INTEGER NOT NULL DEFAULT 0
  );
`);

// ── Cloudflare R2 ─────────────────────────────────────────────────────────────
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// ── Google OAuth client ───────────────────────────────────────────────────────
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Migrate: add google_id column to existing users tables
try {
  db.exec('ALTER TABLE users ADD COLUMN google_id TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
} catch { /* column already exists */ }

// Migrate: add role column
try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
} catch { /* column already exists */ }

// Promote admins listed in ADMIN_USERNAMES env var (comma-separated)
const adminUsernames = (process.env.ADMIN_USERNAMES || '').split(',').map(s => s.trim()).filter(Boolean);
if (adminUsernames.length > 0) {
  const promote = db.prepare("UPDATE users SET role = 'admin' WHERE username = ?");
  for (const u of adminUsernames) promote.run(u);
  console.log(`Admin users: ${adminUsernames.join(', ')}`);
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

// Accept Bearer token (Authorization header) OR httpOnly cookie
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token =
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null)
    ?? req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired session' });
  }
};

const makeToken = payload => jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

const setTokenCookie = (res, payload) => {
  const token = makeToken(payload);
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  return token;
};

// ── Auth routes ───────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username?.trim() || !password)
    return res.status(400).json({ error: 'Username and password are required' });
  if (username.trim().length < 3)
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const hash = await bcrypt.hash(password, 10);
  try {
    const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username.trim(), hash);
    const user = { id: result.lastInsertRowid, username: username.trim(), role: 'user' };
    const token = setTokenCookie(res, user);
    res.json({ user, token });
  } catch (e) {
    if (e.message.includes('UNIQUE'))
      return res.status(409).json({ error: 'Username already taken' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username?.trim());
  if (!row) return res.status(401).json({ error: 'Invalid username or password' });

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

  const user = { id: row.id, username: row.username, role: row.role || 'user' };
  const token = setTokenCookie(res, user);
  res.json({ user, token });
});

app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: 'Missing credential' });
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google sign-in not configured' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub: googleId, name, email } = ticket.getPayload();

    // Find existing Google user
    let user = db.prepare('SELECT id, username, role FROM users WHERE google_id = ?').get(googleId);

    if (!user) {
      // Build a unique username from their display name
      const base = (name || email.split('@')[0]).replace(/[^\w]/g, '_').slice(0, 24);
      let username = base;
      let suffix = 1;
      while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
        username = `${base}${suffix++}`;
      }
      const result = db.prepare(
        'INSERT INTO users (username, password_hash, google_id) VALUES (?, ?, ?)'
      ).run(username, 'GOOGLE_OAUTH', googleId);
      user = { id: result.lastInsertRowid, username, role: 'user' };
    }

    const payload = { id: user.id, username: user.username, role: user.role || 'user' };
    const token = setTokenCookie(res, payload);
    res.json({ user: payload, token });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'Invalid Google credential' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('token', { sameSite: 'lax' });
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json({ user: { id: row.id, username: row.username, role: row.role || 'user' } });
});

// ── Comments routes ───────────────────────────────────────────────────────────

app.get('/api/comments', (req, res) => {
  const { videoKey } = req.query;
  if (!videoKey) return res.status(400).json({ error: 'Missing videoKey' });
  const comments = db
    .prepare('SELECT id, user_id, username, content, created_at FROM comments WHERE video_key = ? ORDER BY created_at DESC')
    .all(videoKey);
  res.json(comments);
});

app.post('/api/comments', requireAuth, (req, res) => {
  const { videoKey, content } = req.body || {};
  if (!videoKey || !content?.trim())
    return res.status(400).json({ error: 'videoKey and content are required' });
  if (content.trim().length > 1000)
    return res.status(400).json({ error: 'Comment too long (max 1000 characters)' });

  const result = db
    .prepare('INSERT INTO comments (video_key, user_id, username, content) VALUES (?, ?, ?, ?)')
    .run(videoKey, req.user.id, req.user.username, content.trim());

  res.json({
    id: result.lastInsertRowid,
    video_key: videoKey,
    user_id: req.user.id,
    username: req.user.username,
    content: content.trim(),
    created_at: new Date().toISOString(),
  });
});

app.delete('/api/comments/:id', requireAuth, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.user_id !== req.user.id)
    return res.status(403).json({ error: "Cannot delete someone else's comment" });
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Likes routes ─────────────────────────────────────────────────────────────

// Like count + whether current user liked (optional auth)
app.get('/api/likes/video', (req, res) => {
  const { videoKey } = req.query;
  if (!videoKey) return res.status(400).json({ error: 'Missing videoKey' });
  const { count } = db.prepare('SELECT COUNT(*) as count FROM likes WHERE video_key = ?').get(videoKey);
  let liked = false;
  const token = req.cookies?.token;
  if (token) {
    try {
      const u = jwt.verify(token, JWT_SECRET);
      liked = !!db.prepare('SELECT id FROM likes WHERE video_key = ? AND user_id = ?').get(videoKey, u.id);
    } catch {}
  }
  res.json({ count, liked });
});

// Get current user's liked video keys
app.get('/api/likes/my', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT video_key FROM likes WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows.map(r => r.video_key));
});

// Like a video
app.post('/api/likes', requireAuth, (req, res) => {
  const { videoKey } = req.body || {};
  if (!videoKey) return res.status(400).json({ error: 'Missing videoKey' });
  db.prepare('INSERT OR IGNORE INTO likes (video_key, user_id) VALUES (?, ?)').run(videoKey, req.user.id);
  const { count } = db.prepare('SELECT COUNT(*) as count FROM likes WHERE video_key = ?').get(videoKey);
  res.json({ liked: true, count });
});

// Unlike a video
app.delete('/api/likes', requireAuth, (req, res) => {
  const { videoKey } = req.query;
  if (!videoKey) return res.status(400).json({ error: 'Missing videoKey' });
  db.prepare('DELETE FROM likes WHERE video_key = ? AND user_id = ?').run(videoKey, req.user.id);
  const { count } = db.prepare('SELECT COUNT(*) as count FROM likes WHERE video_key = ?').get(videoKey);
  res.json({ liked: false, count });
});

// ── History routes ────────────────────────────────────────────────────────────

// Get user's watch history (most recent first)
app.get('/api/history', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT video_key, watched_at FROM history WHERE user_id = ? ORDER BY watched_at DESC')
    .all(req.user.id);
  res.json(rows);
});

// Record a video watch (upsert — updates watched_at if already watched)
app.post('/api/history', requireAuth, (req, res) => {
  const { videoKey } = req.body || {};
  if (!videoKey) return res.status(400).json({ error: 'Missing videoKey' });
  db.prepare(`
    INSERT INTO history (video_key, user_id, watched_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(video_key, user_id) DO UPDATE SET watched_at = CURRENT_TIMESTAMP
  `).run(videoKey, req.user.id);
  res.json({ ok: true });
});

// Remove a single entry
app.delete('/api/history/item', requireAuth, (req, res) => {
  const { videoKey } = req.query;
  if (!videoKey) return res.status(400).json({ error: 'Missing videoKey' });
  db.prepare('DELETE FROM history WHERE video_key = ? AND user_id = ?').run(videoKey, req.user.id);
  res.json({ ok: true });
});

// Clear all history
app.delete('/api/history', requireAuth, (req, res) => {
  db.prepare('DELETE FROM history WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

// ── Views routes ──────────────────────────────────────────────────────────────

// Record a view (no auth required)
app.post('/api/views', (req, res) => {
  const { videoKey } = req.body || {};
  if (!videoKey) return res.status(400).json({ error: 'Missing videoKey' });
  db.prepare(`
    INSERT INTO views (video_key, count) VALUES (?, 1)
    ON CONFLICT(video_key) DO UPDATE SET count = count + 1
  `).run(videoKey);
  const { count } = db.prepare('SELECT count FROM views WHERE video_key = ?').get(videoKey);
  res.json({ count });
});

// Get all view counts as { [videoKey]: count }
app.get('/api/views/all', (_req, res) => {
  const rows = db.prepare('SELECT video_key, count FROM views').all();
  const map = {};
  rows.forEach(r => { map[r.video_key] = r.count; });
  res.json(map);
});

// ── Thumbnail generation ──────────────────────────────────────────────────────

app.get('/api/videos/thumbnail', async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'Missing key' });

  // Return cached thumbnail if available
  const cached = db.prepare('SELECT thumbnail_key FROM thumbnails WHERE video_key = ?').get(key);
  if (cached) {
    try {
      const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: cached.thumbnail_key }), { expiresIn: 3600 });
      return res.json({ url });
    } catch {} // fall through to regenerate
  }

  const tmpThumb = path.join(os.tmpdir(), `thumb_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
  try {
    // Generate presigned URL for ffmpeg to read directly from R2
    const videoUrl = await getSignedUrl(r2, new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }), { expiresIn: 300 });

    // 1) Try embedded cover art (attached picture stream in MP4/MKV)
    let gotThumb = await new Promise(resolve => {
      execFile('ffmpeg', [
        '-i', videoUrl,
        '-map', '0:t', '-vframes', '1',
        '-vf', 'scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:black',
        '-q:v', '4', tmpThumb, '-y',
      ], { timeout: 15000 }, err => {
        const ok = !err && fs.existsSync(tmpThumb) && fs.statSync(tmpThumb).size > 0;
        resolve(ok);
      });
    });

    // 2) Fall back to frame at 3 seconds
    if (!gotThumb) {
      await new Promise((resolve, reject) => {
        execFile('ffmpeg', [
          '-ss', '3', '-i', videoUrl,
          '-vframes', '1',
          '-vf', 'scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:black',
          '-q:v', '4', tmpThumb, '-y',
        ], { timeout: 30000 }, err => err ? reject(err) : resolve());
      });
    }

    // Upload thumbnail to R2
    const thumbKey = `thumbnails/${key}.jpg`;
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: thumbKey,
      Body: fs.readFileSync(tmpThumb),
      ContentType: 'image/jpeg',
    }));

    // Cache and return
    db.prepare('INSERT OR REPLACE INTO thumbnails (video_key, thumbnail_key) VALUES (?, ?)').run(key, thumbKey);
    const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: thumbKey }), { expiresIn: 3600 });
    res.json({ url });
  } catch (err) {
    console.error('Thumbnail error:', err.message);
    res.status(500).json({ error: 'Failed to generate thumbnail' });
  } finally {
    try { fs.unlinkSync(tmpThumb); } catch {}
  }
});

// ── Custom thumbnail upload ───────────────────────────────────────────────────

app.post('/api/videos/thumbnail/upload', requireAuth, async (req, res) => {
  const videoKey = req.headers['x-video-key'] ? decodeURIComponent(req.headers['x-video-key']) : null;
  if (!videoKey) return res.status(400).json({ error: 'Missing X-Video-Key header' });

  const row = db.prepare('SELECT id FROM user_videos WHERE video_key = ? AND user_id = ?').get(videoKey, req.user.id);
  if (!row) return res.status(403).json({ error: 'Not found or not yours' });

  const contentType = req.headers['content-type'] || 'image/jpeg';
  if (!contentType.startsWith('image/')) return res.status(400).json({ error: 'Must be an image file' });

  const thumbKey = `thumbnails/${videoKey}.jpg`;
  try {
    const up = new Upload({
      client: r2,
      params: { Bucket: process.env.R2_BUCKET_NAME, Key: thumbKey, Body: req, ContentType: contentType },
    });
    await up.done();
    db.prepare('INSERT OR REPLACE INTO thumbnails (video_key, thumbnail_key) VALUES (?, ?)').run(videoKey, thumbKey);
    res.json({ ok: true });
  } catch (err) {
    console.error('Custom thumbnail upload error:', err);
    res.status(500).json({ error: 'Thumbnail upload failed' });
  }
});

// ── Library (user uploads) routes ─────────────────────────────────────────────

const MAX_UPLOAD_BYTES_USER  = 300 * 1024 * 1024;       // 300 MB
const MAX_UPLOAD_BYTES_ADMIN = 5  * 1024 * 1024 * 1024; // 5 GB
const MAX_VIDEOS_PER_USER = 1;

// Stream-upload a video file directly to R2
app.post('/api/videos/upload', requireAuth, async (req, res) => {
  const isAdmin = req.user.role === 'admin';

  // Enforce per-user video limit (admins are exempt)
  if (!isAdmin) {
    const { count } = db.prepare('SELECT COUNT(*) as count FROM user_videos WHERE user_id = ?').get(req.user.id);
    if (count >= MAX_VIDEOS_PER_USER)
      return res.status(403).json({ error: `You can only upload ${MAX_VIDEOS_PER_USER} video. Delete your existing video first.` });
  }

  // Enforce size limit via Content-Length header
  const maxBytes = isAdmin ? MAX_UPLOAD_BYTES_ADMIN : MAX_UPLOAD_BYTES_USER;
  const size = parseInt(req.headers['content-length']) || 0;
  if (size > maxBytes)
    return res.status(413).json({ error: `File too large. Maximum size is ${isAdmin ? '5 GB' : '300 MB'}.` });

  const filename = decodeURIComponent(req.headers['x-filename'] || 'video.mp4');
  const contentType = req.headers['content-type'] || 'video/mp4';
  const safe = path.basename(filename).replace(/[^\w.\-]/g, '_');
  const key = `uploads/${req.user.id}/${Date.now()}-${safe}`;
  const title = path.basename(filename, path.extname(filename));

  try {
    const up = new Upload({
      client: r2,
      params: { Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: req, ContentType: contentType },
    });
    await up.done();
    db.prepare('INSERT INTO user_videos (video_key, user_id, title, size) VALUES (?, ?, ?, ?)').run(key, req.user.id, title, size);
    res.json({ key, title });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get current user's uploaded videos
app.get('/api/videos/my', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT video_key, title, size, uploaded_at FROM user_videos WHERE user_id = ? ORDER BY uploaded_at DESC')
    .all(req.user.id);
  res.json(rows.map(r => ({ name: r.video_key, size: r.size, lastModified: r.uploaded_at, title: r.title })));
});

// Delete a user's own video (from R2 + DB)
app.delete('/api/videos/my', requireAuth, async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'Missing key' });
  const row = db.prepare('SELECT id FROM user_videos WHERE video_key = ? AND user_id = ?').get(key, req.user.id);
  if (!row) return res.status(403).json({ error: 'Not found or not yours' });
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
    db.prepare('DELETE FROM user_videos WHERE video_key = ?').run(key);
    db.prepare('DELETE FROM likes    WHERE video_key = ?').run(key);
    db.prepare('DELETE FROM comments WHERE video_key = ?').run(key);
    db.prepare('DELETE FROM history  WHERE video_key = ?').run(key);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ── Video routes ──────────────────────────────────────────────────────────────

app.get('/api/videos', async (req, res) => {
  try {
    const response = await r2.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME }));

    // Build a map of video_key → uploader username from the DB
    const uploaderRows = db.prepare(`
      SELECT uv.video_key, u.username
      FROM user_videos uv
      JOIN users u ON u.id = uv.user_id
    `).all();
    const uploaderMap = {};
    for (const row of uploaderRows) uploaderMap[row.video_key] = row.username;

    const videos = (response.Contents || [])
      .filter(v => !v.Key.startsWith('thumbnails/'))
      .map(v => ({
        name: v.Key,
        size: v.Size,
        lastModified: v.LastModified,
        uploaderUsername: uploaderMap[v.Key] || null,
      }));
    res.json(videos);
  } catch (error) {
    console.error("R2 Error:", error);
    res.status(500).json({ error: "Failed to fetch media from R2", details: error.message });
  }
});

app.get('/api/videos/url', async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: "Missing key parameter" });
  try {
    const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }), { expiresIn: 3600 });
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate video URL", details: error.message });
  }
});

app.get('/health', (_req, res) => res.send('Lustbuster API is Healthy'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Lustbuster API running on port ${PORT}`));
