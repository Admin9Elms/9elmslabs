/**
 * _db.js — Persistent storage layer using Redis (via ioredis)
 *
 * All API files import from here. Zero in-memory stores.
 *
 * Required env var:
 *   REDIS_URL  (auto-set when you add Redis in Vercel dashboard)
 *
 * Key schema:
 *   client:{clientId}            → { businessName, email, plan, industry, url, ... }
 *   client:email:{email}         → clientId  (email lookup index)
 *   auth:{token}                 → { clientId, email, expiresAt }
 *   session:{clientId}           → { token, expiresAt }
 *   monitor:{clientId}           → [{ date, aiScore, seoScore, convScore, competitors, findings, ... }]
 *   content:{clientId}           → [{ id, date, type, title, html, schema, status }]
 *   market:benchmarks            → { aiSearchShareOverall, aiTopPositionCTR, ... }
 *   market:history               → [{ date, benchmarks }]
 *   scans:free:{email}           → { date, results }  (rate limiting free scans)
 */

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, {
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Helper: all values stored as JSON strings
async function kvGet(key) {
  const val = await redis.get(key);
  if (val === null) return null;
  try { return JSON.parse(val); } catch { return val; }
}

async function kvSet(key, value, options) {
  const str = JSON.stringify(value);
  if (options?.ex) {
    await redis.set(key, str, 'EX', options.ex);
  } else {
    await redis.set(key, str);
  }
}

async function kvDel(key) {
  await redis.del(key);
}

// ——— Client Management ———

export async function createClient(data) {
  const clientId = `9EL-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const client = {
    clientId,
    businessName: data.businessName,
    email: data.email.toLowerCase(),
    plan: data.plan,
    industry: data.industry || 'other',
    url: data.url || data.websiteUrl || '',
    contactName: data.contactName || '',
    phone: data.phone || '',
    createdAt: new Date().toISOString(),
    status: 'active',
  };
  await kvSet(`client:${clientId}`, client);
  await kvSet(`client:email:${client.email}`, clientId);
  return client;
}

export async function getClient(clientId) {
  return await kvGet(`client:${clientId}`);
}

export async function getClientByEmail(email) {
  const clientId = await kvGet(`client:email:${email.toLowerCase()}`);
  if (!clientId) return null;
  return await kvGet(`client:${clientId}`);
}

export async function updateClient(clientId, updates) {
  const client = await kvGet(`client:${clientId}`);
  if (!client) return null;
  const updated = { ...client, ...updates, updatedAt: new Date().toISOString() };
  await kvSet(`client:${clientId}`, updated);
  return updated;
}

export async function listClients() {
  const keys = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', 'client:9EL-*', 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');

  const clients = [];
  for (const key of keys) {
    const client = await kvGet(key);
    if (client && client.status === 'active') {
      clients.push(client);
    }
  }
  return clients;
}

// ——— Auth (Magic Links) ———

export async function createAuthToken(clientId, email) {
  const crypto = await import('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
  await kvSet(`auth:${token}`, { clientId, email: email.toLowerCase(), expiresAt }, { ex: 3600 });
  await kvSet(`session:${clientId}`, { token, expiresAt }, { ex: 3600 });
  return token;
}

export async function invalidateAuthToken(token) {
  await kvDel(`auth:${token}`);
}

export async function verifyAuthToken(token) {
  const data = await kvGet(`auth:${token}`);
  if (!data) return null;
  if (Date.now() > data.expiresAt) {
    await kvDel(`auth:${token}`);
    return null;
  }
  return data;
}

export async function createSessionToken(clientId) {
  const crypto = await import('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  await kvSet(`sess:${token}`, { clientId, expiresAt }, { ex: 30 * 24 * 3600 });
  return token;
}

export async function verifySession(token) {
  if (!token) return null;
  const data = await kvGet(`sess:${token}`);
  if (!data) return null;
  if (Date.now() > data.expiresAt) {
    await kvDel(`sess:${token}`);
    return null;
  }
  return data;
}

// ——— Monitoring Data ———

export async function addMonitorCheck(clientId, check) {
  const key = `monitor:${clientId}`;
  let history = await kvGet(key) || [];
  history.unshift({
    ...check,
    date: new Date().toISOString(),
  });
  if (history.length > 365) history = history.slice(0, 365);
  await kvSet(key, history);
  return history;
}

export async function getMonitorHistory(clientId, limit = 90) {
  const history = await kvGet(`monitor:${clientId}`) || [];
  return history.slice(0, limit);
}

export async function getLatestMonitorCheck(clientId) {
  const history = await kvGet(`monitor:${clientId}`) || [];
  return history[0] || null;
}

// ——— Content Deliverables ———

export async function addContent(clientId, content) {
  const key = `content:${clientId}`;
  let items = await kvGet(key) || [];
  items.unshift({
    id: `content-${Date.now()}`,
    ...content,
    date: new Date().toISOString(),
    status: 'delivered',
  });
  if (items.length > 100) items = items.slice(0, 100);
  await kvSet(key, items);
  return items;
}

export async function getContent(clientId, limit = 20) {
  const items = await kvGet(`content:${clientId}`) || [];
  return items.slice(0, limit);
}

// ——— Market Data ———

export async function setMarketBenchmarks(benchmarks) {
  await kvSet('market:benchmarks', {
    ...benchmarks,
    updatedAt: new Date().toISOString(),
  });
  let history = await kvGet('market:history') || [];
  history.unshift({ date: new Date().toISOString(), benchmarks });
  if (history.length > 52) history = history.slice(0, 52);
  await kvSet('market:history', history);
}

export async function getMarketBenchmarks() {
  return await kvGet('market:benchmarks');
}

// ——— Free Scan Rate Limiting ———

export async function recordFreeScan(email, results) {
  await kvSet(`scans:free:${email.toLowerCase()}`, {
    date: new Date().toISOString(),
    results,
  }, { ex: 86400 });
}

export async function getFreeScan(email) {
  return await kvGet(`scans:free:${email.toLowerCase()}`);
}

// ——— Utility: Parse session cookie from request ———

export function getSessionFromRequest(req) {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(/9el_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}

export async function authenticateRequest(req) {
  const token = getSessionFromRequest(req);
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  return await getClient(session.clientId);
}
