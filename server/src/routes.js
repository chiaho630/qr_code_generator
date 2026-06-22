const express = require('express');
const qrcode = require('qrcode');
const db = require('./database');
const { generateToken } = require('./tokenGen');
const { validateUrl } = require('./urlValidator');

const router = express.Router();

const BASE_URL = 'http://localhost:8000';

// In-memory redirect cache (simulates Redis for prototype)
const redirectCache = new Map();

// ── Create ────────────────────────────────────────────────────────────────────

router.post('/api/qr/create', (req, res) => {
  const { url, expires_at } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  let normalized;
  try {
    normalized = validateUrl(url);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  let token;
  try {
    token = generateToken(normalized, db);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  db.prepare(`
    INSERT INTO url_mappings (token, original_url, expires_at)
    VALUES (?, ?, ?)
  `).run(token, normalized, expires_at ?? null);

  redirectCache.set(token, normalized);

  return res.json({
    token,
    short_url: `${BASE_URL}/r/${token}`,
    qr_code_url: `${BASE_URL}/api/qr/${token}/image`,
    original_url: normalized,
  });
});

// ── Redirect ──────────────────────────────────────────────────────────────────

router.get('/r/:token', (req, res) => {
  const { token } = req.params;

  if (redirectCache.has(token)) {
    recordScan(token, req);
    return res.redirect(302, redirectCache.get(token));
  }

  const mapping = db.prepare('SELECT * FROM url_mappings WHERE token = ?').get(token);

  if (!mapping) return res.status(404).json({ error: 'Not Found' });

  if (mapping.is_deleted) return res.status(410).json({ error: 'Gone — this link has been deleted' });

  if (mapping.expires_at && new Date(mapping.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Gone — this link has expired' });
  }

  redirectCache.set(token, mapping.original_url);
  recordScan(token, req);
  return res.redirect(302, mapping.original_url);
});

// ── Get info ──────────────────────────────────────────────────────────────────

router.get('/api/qr/:token', (req, res) => {
  const mapping = getMappingOr404(req.params.token, res);
  if (!mapping) return;
  return res.json(mapping);
});

// ── Update ────────────────────────────────────────────────────────────────────

router.patch('/api/qr/:token', (req, res) => {
  const { token } = req.params;
  const mapping = getMappingOr404(token, res);
  if (!mapping) return;

  const { url, expires_at } = req.body;

  let newUrl = mapping.original_url;
  if (url !== undefined) {
    try {
      newUrl = validateUrl(url);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    redirectCache.delete(token);
  }

  const newExpiry = expires_at !== undefined ? expires_at : mapping.expires_at;

  db.prepare(`
    UPDATE url_mappings
    SET original_url = ?, expires_at = ?, updated_at = datetime('now')
    WHERE token = ?
  `).run(newUrl, newExpiry, token);

  const updated = db.prepare('SELECT * FROM url_mappings WHERE token = ?').get(token);
  return res.json(updated);
});

// ── Delete (soft) ─────────────────────────────────────────────────────────────

router.delete('/api/qr/:token', (req, res) => {
  const { token } = req.params;
  const mapping = getMappingOr404(token, res);
  if (!mapping) return;

  db.prepare(`UPDATE url_mappings SET is_deleted = 1 WHERE token = ?`).run(token);
  redirectCache.delete(token);

  return res.json({ detail: 'Deleted' });
});

// ── QR image ──────────────────────────────────────────────────────────────────

router.get('/api/qr/:token/image', async (req, res) => {
  const { token } = req.params;
  const mapping = getMappingOr404(token, res);
  if (!mapping) return;

  try {
    const buffer = await qrcode.toBuffer(`${BASE_URL}/r/${token}`, { type: 'png' });
    res.set('Content-Type', 'image/png');
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// ── Analytics ─────────────────────────────────────────────────────────────────

router.get('/api/qr/:token/analytics', (req, res) => {
  const { token } = req.params;
  const mapping = getMappingOr404(token, res);
  if (!mapping) return;

  const total = db.prepare(
    'SELECT COUNT(*) as count FROM scan_events WHERE token = ?'
  ).get(token).count;

  const byDay = db.prepare(`
    SELECT date(scanned_at) as date, COUNT(*) as count
    FROM scan_events
    WHERE token = ?
    GROUP BY date(scanned_at)
    ORDER BY date ASC
  `).all(token);

  return res.json({ token, total_scans: total, scans_by_day: byDay });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMappingOr404(token, res) {
  const mapping = db.prepare('SELECT * FROM url_mappings WHERE token = ?').get(token);
  if (!mapping || mapping.is_deleted) {
    res.status(404).json({ error: 'Not Found' });
    return null;
  }
  return mapping;
}

function recordScan(token, req) {
  db.prepare(`
    INSERT INTO scan_events (token, user_agent, ip_address)
    VALUES (?, ?, ?)
  `).run(
    token,
    req.headers['user-agent'] ?? null,
    req.ip ?? null,
  );
}

module.exports = router;
