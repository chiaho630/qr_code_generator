const { URL } = require('url');

const MAX_URL_LENGTH = 2048;

const BLOCKED_DOMAINS = new Set([
  'evil.com',
  'malware.example.com',
  'phishing.example.com',
]);

function validateUrl(rawUrl) {
  if (rawUrl.length > MAX_URL_LENGTH) {
    throw new Error('URL exceeds max length');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Invalid scheme — only http/https allowed');
  }

  if (BLOCKED_DOMAINS.has(parsed.hostname.toLowerCase())) {
    throw new Error('URL is on blocklist');
  }

  // Normalize: lowercase, strip trailing slash, upgrade http → https
  let normalized = rawUrl.toLowerCase().replace(/\/+$/, '');
  if (parsed.protocol === 'http:') {
    normalized = 'https://' + normalized.slice('http://'.length);
  }

  return normalized;
}

module.exports = { validateUrl };
