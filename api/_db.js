/**
 * _db.js — Persistent storage layer using Vercel KV (Redis)
 *
 * All API files import from here. Zero in-memory stores.
 *
 * Required env vars (auto-set when you add KV in Vercel dashboard):
 *   KV_REST_API_URL
 *   KV_REST_API_TOKEN
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

import { kv } from '@vercel/kv';

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
  await kv.set(`client:${clientId}`, client);
  await kv.set(`client:email:${client.email}`, clientId);
  return client;
}

export async function getClient(clientId) {
  return await kv.get(`client:${clientId}`);
}

export async function getClientByEmail(email) {
  const clientId = await kv.get(`client:email:${email.toLowerCase()}`);
  if (!clientId) return null;
  return await kv.get(`client:${clientId}`);
}

export async function updateClient(clientId, updates) {
  const client = await kv.get(`client:${clientId}`);
  if (!client) return null;
  const updated = { ...client, ...updates, updatedAt: new Date().toISOString() };
  await kv.set(`client:${clientId}`, updated);
  return updated;
}

export async function listClients() {
  // Scan for all client keys (not email index keys)
  const keys = [];
  let cursor = 0;
  do {
    const [nextCursor, batch] = await kv.scan(cursor, { match: 'client:9EL-*', count: 100 });
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== 0);

  const clients = [];
  for (const key of keys) {
    const client = await kv.get(key);
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
  await kv.set(`auth:${token}`, { clientId, email: email.toLowerCase(), expiresAt }, { ex: 3600 });
  // Also store a session reference
  await kv.set(`session:${clientId}`, { token, expiresAt }, { ex: 3600 });
  return token;
}

export async function invalidateAuthToken(token) {
  await kv.del(`auth:${token}`);
}

export async function verifyAuthToken(token) {
  const data = await kv.get(`auth:${token}`);
  if (!data) return null;
  if (Date.now() > data.expiresAt) {
    await kv.del(`auth:${token}`);
    return null;
  }
  return data; // { clientId, email }
}

export async function createSessionToken(clientId) {
  const crypto = await import('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  await kv.set(`sess:${token}`, { clientId, expiresAt }, { ex: 30 * 24 * 3600 });
  return token;
}

export async function verifySession(token) {
  if (!token) return null;
  const data = await kv.get(`sess:${token}`);
  if (!data) return null;
  if (Date.now() > data.expiresAt) {
    await kv.del(`sess:${token}`);
    return null;
  }
  return data; // { clientId }
}

// ——— Monitoring Data ———

export async function addMonitorCheck(clientId, check) {
  const key = `monitor:${clientId}`;
  let history = await kv.get(key) || [];
  history.unshift({
    ...check,
    date: new Date().toISOString(),
  });
  // Keep last 365 checks (1 year of daily)
  if (history.length > 365) history = history.slice(0, 365);
  await kv.set(key, history);
  return history;
}

export async function getMonitorHistory(clientId, limit = 90) {
  const history = await kv.get(`monitor:${clientId}`) || [];
  return history.slice(0, limit);
}

export async function getLatestMonitorCheck(clientId) {
  const history = await kv.get(`monitor:${clientId}`) || [];
  return history[0] || null;
}

// ——— Content Deliverables ———

export async function addContent(clientId, content) {
  const key = `content:${clientId}`;
  let items = await kv.get(key) || [];
  items.unshift({
    id: `content-${Date.now()}`,
    ...content,
    date: new Date().toISOString(),
    status: 'delivered',
  });
  // Keep last 100 pieces
  if (items.length > 100) items = items.slice(0, 100);
  await kv.set(key, items);
  return items;
}

export async function getContent(clientId, limit = 20) {
  const items = await kv.get(`content:${clientId}`) || [];
  return items.slice(0, limit);
}

// ——— Market Data ———

export async function setMarketBenchmarks(benchmarks) {
  await kv.set('market:benchmarks', {
    ...benchmarks,
    updatedAt: new Date().toISOString(),
  });
  // Add to history
  let history = await kv.get('market:history') || [];
  history.unshift({ date: new Date().toISOString(), benchmarks });
  if (history.length > 52) history = history.slice(0, 52); // 1 year of weekly
  await kv.set('market:history', history);
}

export async function getMarketBenchmarks() {
  return await kv.get('market:benchmarks');
}

// ——— Free Scan Rate Limiting ———

export async function recordFreeScan(email, results) {
  await kv.set(`scans:free:${email.toLowerCase()}`, {
    date: new Date().toISOString(),
    results,
  }, { ex: 86400 }); // expires in 24h
}

export async function getFreeScan(email) {
  return await kv.get(`scans:free:${email.toLowerCase()}`);
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
