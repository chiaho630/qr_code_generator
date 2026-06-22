const crypto = require('crypto');

const BASE62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TOKEN_LENGTH = 7;
const MAX_RETRIES = 10;

function base62Encode(buffer) {
  let num = BigInt('0x' + buffer.toString('hex'));
  if (num === 0n) return BASE62[0];
  let result = '';
  while (num > 0n) {
    result = BASE62[Number(num % 62n)] + result;
    num = num / 62n;
  }
  return result;
}

function generateToken(url, db) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const nonce = `${Date.now()}_${attempt}`;
    const hash = crypto.createHash('sha256').update(url + nonce).digest();
    const token = base62Encode(hash).slice(0, TOKEN_LENGTH);

    const existing = db.prepare('SELECT id FROM url_mappings WHERE token = ?').get(token);
    if (!existing) return token;
  }
  throw new Error(`Failed to generate unique token after ${MAX_RETRIES} retries`);
}

module.exports = { generateToken };
