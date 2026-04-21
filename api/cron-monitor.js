/**
 * GET /api/cron-monitor
 * Triggered daily at 6 AM UTC by Vercel Cron.
 *
 * Reads all clients from KV, runs monitoring per plan schedule:
 *   Growth:     Mondays only
 *   Scale:      Every day
 *   Enterprise: Every day
 *
 * Also triggers weekly/monthly reports and content generation.
 */
import { listClients } from './_db.js';

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://9elmslabs.co.uk';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const baseUrl = getBaseUrl();
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const dayOfMonth = now.getUTCDate();
  const isMonday = dayOfWeek === 1;
  const isFirstOfMonth = dayOfMonth === 1;

  const results = { monitored: 0, weeklyReports: 0, monthlyReports: 0, contentGenerated: 0, errors: [] };

  try {
    const clients = await listClients();
    console.log(`[CRON] ${clients.length} active clients`);

    for (const client of clients) {
      const plan = client.plan || 'growth';
      const shouldMonitor = (plan === 'growth' && isMonday) || plan === 'scale' || plan === 'enterprise';

      if (shouldMonitor) {
        try {
          await fetch(`${baseUrl}/api/monitor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: client.clientId, businessName: client.businessName, email: client.email, industry: client.industry, plan: client.plan, url: client.url }),
          });
          results.monitored++;
        } catch (e) { results.errors.push(`Monitor: ${client.businessName}: ${e.message}`); }
      }

      if (isMonday) {
        try {
          await fetch(`${baseUrl}/api/weekly-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: client.clientId, businessName: client.businessName, email: client.email, industry: client.industry, period: 'Weekly' }),
          });
          results.weeklyReports++;
        } catch (e) { results.errors.push(`Weekly: ${client.businessName}: ${e.message}`); }
      }

      if (isFirstOfMonth) {
        try {
          await fetch(`${baseUrl}/api/weekly-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: client.clientId, businessName: client.businessName, email: client.email, industry: client.industry, period: 'Monthly' }),
          });
          results.monthlyReports++;
        } catch (e) { results.errors.push(`Monthly: ${client.businessName}: ${e.message}`); }

        if (plan === 'scale' || plan === 'enterprise') {
          try {
            await fetch(`${baseUrl}/api/content-generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId: client.clientId, businessName: client.businessName, industry: client.industry, count: plan === 'enterprise' ? 8 : 4 }),
            });
            results.contentGenerated++;
          } catch (e) { results.errors.push(`Content: ${client.businessName}: ${e.message}`); }
        }
      }
    }

    if (isMonday) {
      try { await fetch(`${baseUrl}/api/market-data`, { method: 'POST' }); } catch (e) {}
    }

    console.log('[CRON] Done:', JSON.stringify(results));
    return res.status(200).json({ success: true, ...results, clientCount: clients.length });
  } catch (err) {
    console.error('[CRON] Fatal:', err);
    return res.status(500).json({ error: 'Cron failed', message: err.message });
  }
}
