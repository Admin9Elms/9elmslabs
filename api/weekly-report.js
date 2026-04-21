/**
 * POST /api/weekly-report
 * Generates and emails a weekly/monthly performance report.
 * Body: { clientId, businessName, email, industry, period }
 * Reads monitoring history from KV.
 */
import { Resend } from 'resend';
import { getMonitorHistory, getLatestMonitorCheck } from './_db.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { clientId, businessName, email, industry, period } = req.body || {};
  if (!clientId || !email) return res.status(400).json({ error: 'clientId and email required' });

  try {
    const history = await getMonitorHistory(clientId, 30);
    const latest = history[0] || null;

    if (!latest) {
      return res.status(200).json({ success: true, skipped: true, reason: 'No monitoring data yet' });
    }

    // Find comparison point
    const daysBack = period === 'Monthly' ? 30 : 7;
    const cutoff = Date.now() - daysBack * 86400000;
    const comparison = history.find(c => new Date(c.date).getTime() < cutoff) || null;

    const scoreDiff = comparison ? latest.aiScore - comparison.aiScore : 0;
    const periodLabel = period || 'Weekly';

    const reportHtml = buildReportEmail({
      businessName: businessName || 'Your Business',
      periodLabel,
      latest,
      comparison,
      scoreDiff,
      history: history.slice(0, 10),
      industry: industry || 'other',
    });

    const emailResp = await resend.emails.send({
      from: '9 Elms Labs <reports@9elmslabs.co.uk>',
      replyTo: 'hello@9elmslabs.co.uk',
      to: email,
      subject: `${periodLabel} AI Visibility Report — ${businessName || 'Your Business'}`,
      html: reportHtml,
    });

    if (emailResp.error) {
      console.error('Weekly report email error:', emailResp.error);
      return res.status(500).json({ error: 'Failed to send report', details: emailResp.error });
    }

    return res.status(200).json({ success: true, emailId: emailResp.data?.id, period: periodLabel });
  } catch (err) {
    console.error('Weekly report error:', err);
    return res.status(500).json({ error: 'Report generation failed' });
  }
}

function buildReportEmail({ businessName, periodLabel, latest, comparison, scoreDiff, history, industry }) {
  const trendArrow = scoreDiff > 0 ? '↑' : scoreDiff < 0 ? '↓' : '→';
  const trendColor = scoreDiff > 0 ? '#2ecc71' : scoreDiff < 0 ? '#e74c3c' : '#f39c12';

  const competitors = (latest.competitors || []).slice(0, 5);
  const findings = (latest.findings || []).slice(0, 4);

  // Content recommendations based on industry
  const contentRecs = {
    dental: ['Write FAQ: "Is Invisalign right for me?"', 'Create blog: "5 Signs You Need a Dental Check-Up"', 'Add patient testimonial page with schema markup'],
    saas: ['Create comparison page: "Your Product vs Competitors"', 'Write case study with real metrics', 'Build API documentation with structured data'],
    restaurant: ['Add menu with structured data', 'Create "About the Chef" story page', 'Build FAQ: common dietary requirements'],
    ecommerce: ['Create buying guide for top products', 'Add product FAQ schema to top 10 items', 'Write "Why choose us" trust page'],
    default: ['Create FAQ page with structured data', 'Write 2 blog posts targeting AI-friendly queries', 'Add testimonials page with review schema'],
  };
  const recs = contentRecs[industry] || contentRecs.default;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Tahoma,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#0a0e27;color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
    <div style="font-size:28px;font-weight:bold;">9EL</div>
    <div style="font-size:14px;color:#00d4ff;">9 Elms Labs</div>
    <p style="margin-top:15px;font-size:16px;">${periodLabel} Performance Report</p>
  </div>
  <div style="background:#f9f9f9;padding:30px;border-radius:0 0 8px 8px;">
    <h2 style="margin-top:0;">${businessName}</h2>
    <p style="color:#666;font-size:14px;">${periodLabel} report — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

    <!-- Score Summary -->
    <div style="display:flex;gap:12px;margin:24px 0;">
      <div style="flex:1;background:white;padding:20px;border-radius:8px;text-align:center;">
        <div style="font-size:12px;color:#666;text-transform:uppercase;">AI Visibility</div>
        <div style="font-size:36px;font-weight:700;color:#00d4ff;margin:8px 0;">${latest.aiScore}</div>
        <div style="font-size:14px;color:${trendColor};">${trendArrow} ${scoreDiff > 0 ? '+' : ''}${scoreDiff} pts</div>
      </div>
      <div style="flex:1;background:white;padding:20px;border-radius:8px;text-align:center;">
        <div style="font-size:12px;color:#666;text-transform:uppercase;">SEO Health</div>
        <div style="font-size:36px;font-weight:700;color:#9d4edd;margin:8px 0;">${latest.seoScore || '—'}</div>
      </div>
      <div style="flex:1;background:white;padding:20px;border-radius:8px;text-align:center;">
        <div style="font-size:12px;color:#666;text-transform:uppercase;">Conversion</div>
        <div style="font-size:36px;font-weight:700;color:#2ecc71;margin:8px 0;">${latest.convScore || '—'}</div>
      </div>
    </div>

    ${competitors.length > 0 ? `
    <!-- Competitors -->
    <div style="background:white;padding:20px;border-radius:8px;margin:16px 0;">
      <h3 style="margin:0 0 12px;">Competitors in AI Results</h3>
      ${competitors.map(c => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:14px;"><span>${c.name}</span><span style="color:#00d4ff;">${c.mentions} mentions</span></div>`).join('')}
    </div>` : ''}

    ${findings.length > 0 ? `
    <!-- Findings -->
    <div style="background:white;padding:20px;border-radius:8px;margin:16px 0;">
      <h3 style="margin:0 0 12px;">Key Findings</h3>
      ${findings.map(f => `<div style="padding:8px 0;border-bottom:1px solid #eee;"><strong style="font-size:11px;color:${f.severity === 'critical' ? '#e74c3c' : '#f39c12'};">${(f.severity || '').toUpperCase()}</strong><p style="margin:4px 0 0;font-size:14px;">${f.title || f.description || ''}</p></div>`).join('')}
    </div>` : ''}

    <!-- Recommendations -->
    <div style="background:white;padding:20px;border-radius:8px;margin:16px 0;">
      <h3 style="margin:0 0 12px;">This ${periodLabel === 'Monthly' ? 'Month' : 'Week'}'s Action Items</h3>
      ${recs.map((r, i) => `<div style="padding:8px 0;font-size:14px;"><strong style="color:#00d4ff;">${i + 1}.</strong> ${r}</div>`).join('')}
    </div>

    <div style="text-align:center;margin:24px 0;">
      <a href="https://9elmslabs.co.uk/login.html" style="display:inline-block;background:#00d4ff;color:#0a0e27;padding:14px 36px;text-decoration:none;border-radius:6px;font-weight:bold;">View Full Dashboard</a>
    </div>

    <p style="font-size:12px;color:#999;text-align:center;margin-top:24px;border-top:1px solid #ddd;padding-top:16px;">
      &copy; ${new Date().getFullYear()} 9 Elms Labs Ltd. | <a href="mailto:hello@9elmslabs.co.uk" style="color:#999;">hello@9elmslabs.co.uk</a>
    </p>
  </div>
</body>
</html>`;
}
