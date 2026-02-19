const crypto = require('crypto');

// In-memory session store: token → expiry timestamp
const sessions = new Map();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
}

function validateSession(token) {
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || '';
  header.split(';').forEach(c => {
    const [key, ...val] = c.trim().split('=');
    if (key) cookies[key] = val.join('=');
  });
  return cookies;
}

function isAuthenticated(req) {
  const password = process.env.EDITOR_PASSWORD;
  if (!password) return true; // No password set = auth disabled
  const cookies = parseCookies(req);
  return validateSession(cookies.editor_session);
}

function handleLogin(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const { password } = JSON.parse(body);
      const expected = process.env.EDITOR_PASSWORD;

      if (!expected) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // Hash both to get fixed-length buffers for timing-safe comparison
      const a = crypto.createHash('sha256').update(password || '').digest();
      const b = crypto.createHash('sha256').update(expected).digest();

      if (!crypto.timingSafeEqual(a, b)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid password' }));
        return;
      }

      const token = createSession();
      const secure = req.headers['x-forwarded-proto'] === 'https';
      const cookie = `editor_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}${secure ? '; Secure' : ''}`;

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
      });
      res.end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request' }));
    }
  });
}

function sendUnauthorized(res) {
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Unauthorized' }));
}

module.exports = { isAuthenticated, handleLogin, sendUnauthorized };
