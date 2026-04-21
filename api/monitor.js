/**
 * 9 Elms Labs — AI Visibility Monitoring Engine
 *
 * POST /api/monitor — run a monitoring check for a client
 * GET  /api/monitor?clientId=xxx — retrieve monitoring history
 *
 * All data persisted in Vercel KV via _db.js
 */
import { Resend } from 'resend';
import { getClient, addMonitorCheck, getMonitorHistory, getLatestMonitorCheck } from './_db.js';

const resend = new Resend(process.env.RESEND_API_KEY);

const MONITOR_QUERIES_BY_INDUSTRY = {
  'travel-agency':     ['best travel agencies UK', 'recommended travel agents', 'top travel companies'],
  'cruise':            ['best cruise companies', 'cruise line recommendations', 'top cruise deals UK'],
  'ota':               ['best online travel booking sites', 'OTA platforms UK', 'travel booking recommendations'],
  'tour-operator':     ['best tour operators UK', 'recommended tour companies', 'top travel tours'],
  'hotels':            ['best hotels UK', 'hotel recommendations', 'top rated accommodation'],
  'saas':              ['best SaaS companies', 'top software platforms', 'recommended business software'],
  'fintech':           ['best fintech companies UK', 'top financial technology', 'recommended fintech platforms'],
  'digital-marketing': ['best digital marketing agencies', 'top marketing agencies UK', 'recommended marketing services'],
  'seo-agency':        ['best SEO agencies UK', 'top SEO companies', 'recommended SEO services'],
  'ecommerce':         ['best ecommerce platforms', 'top online stores', 'recommended ecommerce solutions'],
  'consulting':        ['best consulting firms UK', 'top management consultants', 'recommended business consultants'],
  'law':               ['best law firms UK', 'top solicitors', 'recommended legal services'],
  'dental':            ['best dentists UK', 'top dental practices', 'recommended dental clinics'],
  'healthcare':        ['best healthcare providers UK', 'top medical practices', 'recommended health services'],
  'realestate':        ['best estate agents UK', 'top property agencies', 'recommended real estate services'],
  'restaurant':        ['best restaurants UK', 'top dining recommendations', 'recommended restaurants'],
  'fitness':           ['best gyms UK', 'top fitness studios', 'recommended personal trainers'],
  'education':         ['best online courses', 'top education platforms UK', 'recommended learning providers'],
  'construction':      ['best construction companies UK', 'top builders', 'recommended building contractors'],
  'automotive':        ['best car dealerships UK', 'top automotive services', 'recommended car repair'],
  'agency':            ['best marketing agencies UK', 'top creative agencies', 'recommended agency services'],
  'finance':           ['best financial advisors UK', 'top accounting firms', 'recommended financial services'],
  'travel':            ['best travel companies UK', 'top travel agents', 'recommended holiday providers'],
  'default':           ['best companies in this industry', 'top service providers', 'recommended businesses UK'],
};

/* ---------- fuzzy match & competitor extraction ---------- */

function fuzzyMatch(businessName, text) {
  const textLower = text.toLowerCase();
  const nameLower = businessName.toLowerCase();
  if (textLower.includes(nameLower)) return { found: true, type: 'exact' };
  const words = nameLower.split(/\s+/).filter(w => w.length > 2 && !['and','the','for','ltd','inc','llc'].includes(w));
  if (words.length > 0 && words.every(w => textLower.includes(w))) return { found: true, type: 'words' };
  return { found: false, type: 'none' };
}

function extractCompetitors(text, businessName) {
  const competitors = [];
  const lines = text.split('\n').slice(0, 25);
  lines.forEach(line => {
    if (line.length < 10 || fuzzyMatch(businessName, line).found) return;
    const match = line.match(/^\s*[\d\.\-\*]*\s*\*?\*?([A-Z][A-Za-z0-9\s&\.\,\'-]{2,60})\*?\*?/);
    if (match) {
      const name = match[1].trim().replace(/[,\.:;]$/, '');
      if (name.length > 2 && name.length < 80 && !name.includes('http') && !name.match(/^(The|This|That|These|Here|There|Some|Many|Most|Best)/)) {
        competitors.push(name);
      }
    }
  });
  return [...new Set(competitors)].slice(0, 10);
}

/* ---------- website crawl & scoring (mirrors scan.js logic) ---------- */

function parseJsonLdSchema(pageText) {
  const schemaTypes = [];
  const jsonLdRegex = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = jsonLdRegex.exec(pageText)) !== null) {
    try { const s = JSON.parse(m[1]); if (s['@type']) schemaTypes.push(s['@type']); } catch (_) { /* skip */ }
  }
  return schemaTypes;
}

async function crawlWebsite(url) {
  const result = { ok: false, seo: {}, conv: {}, trust: {} };
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    clearTimeout(tid);
    if (!resp.ok) return result;
    const html = await resp.text();
    result.ok = true;
    result.contentLength = html.length;

    // SEO metrics
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    result.seo.titleLen = titleMatch ? titleMatch[1].length : 0;
    result.seo.hasMetaDesc = /<meta\s+name="description"\s+content="[^"]+"/i.test(html);
    result.seo.metaDescLen = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1]?.length || 0;
    const ogTitle = /<meta\s+property="og:title"/i.test(html);
    const ogDesc = /<meta\s+property="og:description"/i.test(html);
    const ogImage = /<meta\s+property="og:image"/i.test(html);
    result.seo.ogCount = [ogTitle, ogDesc, ogImage].filter(Boolean).length;
    result.seo.h1 = (html.match(/<h1[^>]*>/gi) || []).length;
    result.seo.h2 = (html.match(/<h2[^>]*>/gi) || []).length;
    result.seo.h3 = (html.match(/<h3[^>]*>/gi) || []).length;
    result.seo.schemaTypes = parseJsonLdSchema(html);
    result.seo.hasSchema = result.seo.schemaTypes.length > 0;
    result.seo.hasFaq = /faq|frequently\s+asked/i.test(html);
    result.seo.hasBreadcrumb = /breadcrumb/i.test(html);
    result.seo.viewport = /<meta\s+name="viewport"/i.test(html);
    result.seo.canonical = /<link\s+rel="canonical"/i.test(html);
    result.seo.https = url.startsWith('https://');
    result.seo.internalLinks = (html.match(/<a\s+href="\/[^"]*"/gi) || []).length;
    result.seo.externalLinks = (html.match(/<a\s+href="https?:\/\/[^"]*"/gi) || []).length;
    result.seo.imgsWithAlt = (html.match(/<img[^>]+alt="[^"]+"/gi) || []).length;
    result.seo.totalImgs = (html.match(/<img[^>]*>/gi) || []).length;

    // Conversion signals
    result.conv.buttons = (html.match(/<button[^>]*>/gi) || []).length;
    result.conv.ctaClasses = (html.match(/class="[^"]*(?:btn|cta|action)[^"]*"/gi) || []).length;
    result.conv.forms = (html.match(/<form[^>]*>/gi) || []).length;
    result.conv.inputs = (html.match(/<input[^>]*>/gi) || []).length;
    result.conv.phones = (html.match(/\+?[\d\s\-\(\)]{10,}/g) || []).length;
    result.conv.emails = (html.match(/[\w\.-]+@[\w\.-]+\.\w+/g) || []).length;
    result.conv.hasContact = /contact|get in touch|reach us|call us/i.test(html);

    // Trust signals
    result.trust.testimonials = (html.match(/testimonial/gi) || []).length;
    result.trust.reviews = (html.match(/review/gi) || []).length;
    result.trust.caseStudies = (html.match(/case\s?study|case\s?studies/gi) || []).length;
    result.trust.successStories = (html.match(/success\s?story|success\s?stories/gi) || []).length;

    // Social
    const socials = [/facebook\.com/i, /twitter\.com|x\.com/i, /linkedin\.com/i, /instagram\.com/i, /youtube\.com/i];
    result.conv.socialCount = socials.filter(r => r.test(html)).length;
  } catch (_) { /* fetch failed */ }
  return result;
}

function calcSeoScore(c) {
  if (!c.ok) return 0;
  let s = 0;
  if (c.seo.hasMetaDesc) s += 10;
  if (c.seo.titleLen >= 30 && c.seo.titleLen <= 60) s += 10;
  s += Math.min(c.seo.ogCount * 5, 15);
  if (c.seo.h1 > 0) s += 5;
  if (c.seo.h2 > 0) s += 5;
  if (c.seo.h3 > 0) s += 5;
  if (c.seo.hasSchema) s += 10;
  if (c.seo.hasFaq) s += 3;
  if (c.seo.hasBreadcrumb) s += 2;
  if (c.seo.viewport) s += 8;
  if (c.seo.canonical) s += 6;
  if (c.seo.https) s += 6;
  if (c.seo.internalLinks > 5) s += 5;
  if (c.seo.externalLinks > 0) s += 3;
  if (c.seo.totalImgs > 0) s += Math.min(Math.round((c.seo.imgsWithAlt / c.seo.totalImgs) * 7), 7);
  return Math.min(s, 100);
}

function calcConvScore(c) {
  if (!c.ok) return 0;
  let s = 0;
  const totalCtas = c.conv.buttons + Math.min(c.conv.ctaClasses, 5);
  if (totalCtas > 0) s += Math.min(totalCtas * 3, 25);
  if (c.conv.forms > 0) s += 15;
  if (c.conv.inputs > 3) s += 10;
  if (c.conv.hasContact) s += 8;
  s += Math.min(c.conv.phones, 1) * 4;
  s += Math.min(c.conv.emails, 1) * 3;
  const trustCount = c.trust.testimonials + c.trust.reviews + c.trust.caseStudies + c.trust.successStories;
  if (trustCount > 0) s += Math.min(trustCount * 2, 20);
  s += Math.min(c.conv.socialCount * 3, 15);
  return Math.min(s, 100);
}

/* ---------- multi-platform AI queries ---------- */

function buildPlatformQueries(businessName, industry) {
  const base = MONITOR_QUERIES_BY_INDUSTRY[industry] || MONITOR_QUERIES_BY_INDUSTRY['default'];
  // Perplexity gets the industry queries as before
  const perplexity = base;
  // Platform-specific queries that probe visibility on each AI platform
  const chatgpt = [
    `If I asked ChatGPT to recommend ${industry} companies in the UK, which ones would it suggest?`,
    `Which ${industry} businesses does OpenAI's ChatGPT commonly reference or recommend?`,
  ];
  const gemini = [
    `Which ${industry} companies appear in Google AI Overviews and Gemini recommendations in the UK?`,
    `What ${industry} providers does Google's Gemini AI typically suggest?`,
  ];
  const copilot = [
    `Which ${industry} businesses does Microsoft Copilot recommend in the UK?`,
    `What ${industry} companies would Microsoft Bing Copilot suggest to users?`,
  ];
  return { perplexity, chatgpt, gemini, copilot };
}

async function queryPerplexity(queries, businessName, perplexityKey) {
  let mentions = 0;
  let answered = 0;
  const competitors = new Map();

  for (const query of queries) {
    try {
      const resp = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${perplexityKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: query }], max_tokens: 1000, temperature: 0.7 }),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      const text = data.choices[0]?.message?.content || '';
      if (!text) continue;
      answered++;
      if (fuzzyMatch(businessName, text).found) mentions++;
      extractCompetitors(text, businessName).forEach(c => competitors.set(c, (competitors.get(c) || 0) + 1));
    } catch (err) {
      console.error(`Monitor query failed: ${query}`, err.message);
    }
  }
  return { mentions, answered, competitors };
}

async function runMonitorCheck(businessName, industry, perplexityKey, websiteUrl) {
  const platformQueries = buildPlatformQueries(businessName, industry);
  const allQuerySets = [
    ...platformQueries.perplexity,
    ...platformQueries.chatgpt,
    ...platformQueries.gemini,
    ...platformQueries.copilot,
  ];

  // Run all queries through Perplexity (it has access to web data about all platforms)
  const { mentions: totalMentions, answered: totalQueries, competitors: competitorMap } =
    await queryPerplexity(allQuerySets, businessName, perplexityKey);

  const aiScore = totalQueries > 0 ? Math.round((totalMentions / totalQueries) * 100) : 0;

  // Real website crawl for SEO and conversion scores
  let seoScore = 0;
  let convScore = 0;
  if (websiteUrl) {
    let normalizedUrl = websiteUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = 'https://' + normalizedUrl;
    const crawl = await crawlWebsite(normalizedUrl);
    seoScore = calcSeoScore(crawl);
    convScore = calcConvScore(crawl);
  }

  const topCompetitors = Array.from(competitorMap.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, count]) => ({ name, mentions: count }));

  const findings = [];
  if (aiScore < 30) findings.push({ title: 'Low AI visibility', description: 'Your business is not being recommended by major AI platforms.', severity: 'critical', impact: 'AI-driven leads going to competitors' });
  if (aiScore < 60) findings.push({ title: 'AI presence needs improvement', description: 'You appear in some AI responses but not consistently.', severity: 'high', impact: 'Missing significant AI-referred traffic' });
  if (topCompetitors.length > 5) findings.push({ title: 'High competitor density', description: `${topCompetitors.length} competitors detected in AI recommendations.`, severity: 'medium', impact: 'Crowded AI recommendation space' });
  if (seoScore < 40) findings.push({ title: 'Poor SEO health', description: 'Website is missing critical SEO elements that affect AI discoverability.', severity: 'high', impact: 'Reduced organic and AI-referred traffic' });
  if (convScore < 30) findings.push({ title: 'Weak conversion signals', description: 'Website lacks effective CTAs, forms, or trust signals.', severity: 'high', impact: 'Visitors not converting into leads' });

  return {
    aiScore,
    seoScore,
    convScore,
    totalMentions,
    totalQueries,
    competitors: topCompetitors,
    findings,
    revenueImpact: {
      missed: Math.round(aiScore < 50 ? (100 - aiScore) * 150 : (100 - aiScore) * 80),
      current: Math.round(aiScore * 50),
      potential: Math.round(aiScore * 50 + (100 - aiScore) * 100),
    },
  };
}

/* ---------- change detection & alerts ---------- */

function detectChanges(current, previous, plan) {
  if (!previous) return [{ type: 'initial', severity: 'info', message: 'First monitoring check completed' }];
  const changes = [];
  // Scale gets alerts at >=5pt, Growth at >=8pt, Starter at >=10pt
  const threshold = plan === 'scale' ? 5 : plan === 'growth' ? 8 : 10;
  const scoreDiff = current.aiScore - previous.aiScore;
  if (Math.abs(scoreDiff) >= threshold) {
    changes.push({ type: 'visibility_change', severity: scoreDiff > 0 ? 'positive' : 'critical', message: `AI visibility ${scoreDiff > 0 ? 'improved' : 'dropped'} by ${Math.abs(scoreDiff)} points (${previous.aiScore} → ${current.aiScore})` });
  }
  const seoDiff = current.seoScore - (previous.seoScore || 0);
  if (Math.abs(seoDiff) >= threshold) {
    changes.push({ type: 'seo_change', severity: seoDiff > 0 ? 'positive' : 'warning', message: `SEO score ${seoDiff > 0 ? 'improved' : 'dropped'} by ${Math.abs(seoDiff)} points (${previous.seoScore || 0} → ${current.seoScore})` });
  }
  const convDiff = current.convScore - (previous.convScore || 0);
  if (Math.abs(convDiff) >= threshold) {
    changes.push({ type: 'conv_change', severity: convDiff > 0 ? 'positive' : 'warning', message: `Conversion score ${convDiff > 0 ? 'improved' : 'dropped'} by ${Math.abs(convDiff)} points (${previous.convScore || 0} → ${current.convScore})` });
  }
  const prevNames = new Set((previous.competitors || []).map(c => c.name));
  const newComps = (current.competitors || []).filter(c => !prevNames.has(c.name));
  if (newComps.length > 0) changes.push({ type: 'new_competitors', severity: 'warning', message: `${newComps.length} new competitor(s): ${newComps.map(c => c.name).join(', ')}` });
  return changes;
}

async function sendAlertEmail(email, businessName, changes, check) {
  if (!process.env.RESEND_API_KEY || !email) return;
  const critical = changes.filter(c => c.severity === 'critical' || c.severity === 'warning');
  if (critical.length === 0) return;

  try {
    await resend.emails.send({
      from: '9 Elms Labs <reports@9elmslabs.co.uk>',
      replyTo: 'hello@9elmslabs.co.uk',
      to: email,
      subject: `[Alert] AI Visibility Change — ${businessName}`,
      html: `<!DOCTYPE html><html><body style="font-family:'Segoe UI',sans-serif;color:#333;max-width:600px;margin:0 auto;">
        <div style="background:#0a0e27;color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
          <div style="font-size:28px;font-weight:bold;color:#00d4ff;">9 Elms Labs</div>
          <div style="font-size:14px;color:#8888a0;">AI Visibility Alert</div>
        </div>
        <div style="background:#f9f9f9;padding:30px;border-radius:0 0 8px 8px;">
          <h2>Alert for ${businessName}</h2>
          ${changes.map(c => `<div style="background:white;border-left:4px solid ${c.severity === 'critical' ? '#ef4444' : '#f59e0b'};padding:15px;margin:15px 0;border-radius:0 8px 8px 0;"><strong style="font-size:11px;color:${c.severity === 'critical' ? '#ef4444' : '#f59e0b'};">${c.severity.toUpperCase()}</strong><p style="margin:8px 0 0;">${c.message}</p></div>`).join('')}
          <div style="background:white;padding:20px;border-radius:8px;margin-top:20px;">
            <p><strong>AI Score:</strong> ${check.aiScore}/100</p>
            <p><strong>SEO Score:</strong> ${check.seoScore}/100</p>
            <p><strong>Conversion Score:</strong> ${check.convScore}/100</p>
            <p><strong>Competitors:</strong> ${check.competitors.slice(0, 3).map(c => c.name).join(', ') || 'None'}</p>
          </div>
          <p style="margin-top:20px;"><a href="https://9elmslabs.co.uk/login.html" style="color:#00d4ff;">View Dashboard</a></p>
        </div></body></html>`,
    });
  } catch (err) { console.error('Alert email failed:', err); }
}

/* ---------- handler ---------- */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — retrieve history from KV
  if (req.method === 'GET') {
    const clientId = req.query.clientId;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    try {
      const history = await getMonitorHistory(clientId, 90);
      const latest = history[0] || null;
      return res.status(200).json({
        success: true, clientId,
        totalChecks: history.length,
        latestCheck: latest,
        visibilityTrend: history.slice(0, 30).map(c => ({ date: c.date, score: c.aiScore })),
        topCompetitors: latest?.competitors || [],
      });
    } catch (err) {
      console.error('Monitor GET error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { clientId, businessName, email, industry, plan, url } = req.body;
  if (!clientId || !businessName) return res.status(400).json({ error: 'clientId and businessName required' });

  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  if (!perplexityKey) return res.status(500).json({ error: 'Perplexity API key not configured' });

  try {
    const currentCheck = await runMonitorCheck(businessName, industry || 'default', perplexityKey, url || '');
    const previousCheck = await getLatestMonitorCheck(clientId);
    const changes = detectChanges(currentCheck, previousCheck, plan);
    currentCheck.changes = changes;

    // Store in KV
    await addMonitorCheck(clientId, currentCheck);

    // Send alert if significant changes
    if (email && changes.some(c => c.severity === 'critical' || c.severity === 'warning')) {
      await sendAlertEmail(email, businessName, changes, currentCheck);
    }

    return res.status(200).json({
      success: true,
      clientId,
      check: {
        aiScore: currentCheck.aiScore,
        seoScore: currentCheck.seoScore,
        convScore: currentCheck.convScore,
        competitors: currentCheck.competitors.slice(0, 5),
        changes,
      },
    });
  } catch (err) {
    console.error('Monitor POST error:', err);
    return res.status(500).json({ error: 'Monitoring check failed', message: err.message });
  }
}
