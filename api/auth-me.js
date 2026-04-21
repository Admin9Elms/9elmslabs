/**
 * GET /api/auth-me
 * Returns the authenticated client's data, or 401.
 * Used by dashboard.html to load real data.
 */
import { authenticateRequest, getMonitorHistory, getContent, getLatestMonitorCheck } from './_db.js';

export default async function handler(req, res) {
  // No wildcard CORS on authenticated endpoints — same-origin only
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const client = await authenticateRequest(req);
    if (!client) {
      return res.status(401).json({ error: 'Not authenticated', redirect: '/login.html' });
    }

    // Fetch all client data in parallel
    const [monitorHistory, content, latestCheck] = await Promise.all([
      getMonitorHistory(client.clientId, 90),
      getContent(client.clientId, 20),
      getLatestMonitorCheck(client.clientId),
    ]);

    // Calculate trends
    const currentScore = latestCheck?.aiScore || 0;
    const weekAgo = monitorHistory.find(c => {
      const d = new Date(c.date);
      return (Date.now() - d.getTime()) > 6 * 86400000;
    });
    const scoreTrend = weekAgo ? currentScore - (weekAgo.aiScore || 0) : 0;

    return res.status(200).json({
      success: true,
      client: {
        clientId: client.clientId,
        businessName: client.businessName,
        email: client.email,
        plan: client.plan,
        industry: client.industry,
        url: client.url,
        contactName: client.contactName,
        createdAt: client.createdAt,
      },
      scores: latestCheck ? {
        aiVisibility: latestCheck.aiScore || 0,
        seoHealth: latestCheck.seoScore || 0,
        conversion: latestCheck.convScore || 0,
        overall: Math.round(((latestCheck.aiScore || 0) * 0.4 + (latestCheck.seoScore || 0) * 0.3 + (latestCheck.convScore || 0) * 0.3)),
      } : null,
      scoreTrend,
      findings: latestCheck?.findings || [],
      competitors: latestCheck?.competitors || [],
      monitorHistory: monitorHistory.map(c => ({
        date: c.date,
        aiScore: c.aiScore,
        seoScore: c.seoScore,
        convScore: c.convScore,
      })),
      content,
      revenueImpact: latestCheck?.revenueImpact || null,
    });
  } catch (err) {
    console.error('Auth me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
