const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');

const COOKIE_NAME = 'cwc_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Hand-rolled signed cookie (HMAC-SHA256), not a full JWT library -- this
// app has one claim shape and one signing algorithm, so a tiny homemade
// implementation keeps the dependency list minimal per the rest of this
// codebase's style. Format: base64url(payload) + '.' + base64url(hmac).
function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

function sign(payloadObj) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set on the server.');
  const payload = base64url(JSON.stringify(payloadObj));
  const sig = base64url(crypto.createHmac('sha256', secret).update(payload).digest());
  return payload + '.' + sig;
}

function verifyToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = base64url(crypto.createHmac('sha256', secret).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try { data = JSON.parse(base64urlDecode(payload)); } catch (e) { return null; }
  if (!data.exp || Date.now() / 1000 > data.exp) return null;
  return data;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return cookies;
}

function getSession(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token);
}

function setSessionCookie(res, sessionData) {
  const token = sign(Object.assign({}, sessionData, { exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }));
  const secure = process.env.VERCEL ? '; Secure' : ''; // omit Secure for local http:// dev
  res.setHeader('Set-Cookie', COOKIE_NAME + '=' + encodeURIComponent(token) + '; HttpOnly; Path=/; Max-Age=' + SESSION_TTL_SECONDS + '; SameSite=Lax' + secure);
}

function clearSessionCookie(res) {
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', COOKIE_NAME + '=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax' + secure);
}

// --- Supabase-backed user lookups ---
function requireClient() {
  const client = db.getClient();
  if (!client) throw new Error('Supabase is not configured — login needs it. See SUPABASE-SETUP.md.');
  return client;
}

async function findUserByEmail(email) {
  const client = requireClient();
  const { data, error } = await client.from('users').select('*').eq('email', email.toLowerCase().trim()).maybeSingle();
  if (error) throw new Error('User lookup failed: ' + error.message);
  return data;
}

async function updateUserPassword(userId, newPasswordHash) {
  const client = requireClient();
  const { error } = await client.from('users').update({ password_hash: newPasswordHash, must_change_password: false }).eq('id', userId);
  if (error) throw new Error('Could not update password: ' + error.message);
}

async function verifyLogin(email, password) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return user;
}

function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

// --- Express middleware ---
// Page routes (index.html): redirect to the login/change-password pages
// instead of returning JSON, since a browser navigation is what's failing.
function requireAuthPage(req, res, next) {
  const session = getSession(req);
  if (!session) return res.redirect('/login.html');
  if (session.mustChangePassword) return res.redirect('/change-password.html');
  req.session = session;
  next();
}

module.exports = {
  COOKIE_NAME,
  getSession,
  setSessionCookie,
  clearSessionCookie,
  findUserByEmail,
  updateUserPassword,
  verifyLogin,
  hashPassword,
  requireAuthPage
};
