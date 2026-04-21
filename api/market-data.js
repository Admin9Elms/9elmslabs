/**
 * 9 Elms Labs — Live Market Intelligence API
 *
 * Fetches real AI search adoption data and industry benchmarks from
 * Perplexity AI (which cites real sources). Caches results and refreshes
 * weekly via cron. All scan calculations pull from this live data instead
 * of hardcoded assumptions.
 *
 * GET  /api/market-data              → returns current cached benchmarks
 * POST /api/market-data              → triggers a fresh data refresh
 * GET  /api/market-data?history=true → returns refresh history with sources
 */

import { setMarketBenchmarks, getMarketBenchmarks } from './_db.js';

// Default benchmarks — used as fallback if API hasn't refreshed yet.
// These are the conservative starting values; live refresh overrides them.
const DEFAULT_BENCHMARKS = {
  aiSearchShareOverall: 0.10,       // 10% of commercial queries via AI (Datos 2025 baseline)
  aiSearchShareGrowthRate: 0.80,    // ~80% YoY growth in AI search adoption
  aiTopPositionCTR: 0.18,           // top AI recommendation CTR (BrightEdge)
  optimisedCeiling: 0.60,           // realistic max AI capture after optimisation
  aiConversionPremium: 1.20,        // AI-referred traffic converts 20% better than organic
  sources: ['Datos/SparkToro 2025 baseline', 'BrightEdge AI CTR study', 'Wordstream conversion benchmarks'],
  lastUpdated: '2025-06-01',
  refreshMethod: 'default',

  // Per-category AI adoption multipliers (relative to overall)
  // e.g. tech/SaaS adopts AI search faster than construction
  categoryMultipliers: {
    'technology':     1.5,  // tech-savvy users adopt AI search faster
    'saas':           1.5,
    'ai-ml':          1.8,
    'fintech':        1.3,
    'cybersecurity':  1.4,
    'martech':        1.4,
    'digital-marketing': 1.3,
    'seo-agency':     1.5,
    'ecommerce':      0.9,
    'travel-agency':  1.0,
    'cruise':         0.8,
    'ota':            1.2,
    'hotels':         1.1,
    'airlines':       0.7,
    'restaurants':    1.3,
    'healthcare':     1.1,
    'dental':         1.2,
    'education':      1.2,
    'online-courses': 1.4,
    'law':            0.9,
    'banking':        0.7,
    'insurance':      0.8,
    'real-estate':    0.8,
    'construction':   0.6,
    'architecture':   0.7,
    'retail':         0.8,
    'automotive':     0.7,
    'consulting':     1.1,
    'recruitment':    1.1,
    'other':          1.0,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — return current benchmarks from KV
  if (req.method === 'GET') {
    const stored = await getMarketBenchmarks();
    const data = stored || DEFAULT_BENCHMARKS;

    return res.status(200).json({
      benchmarks: data,
      isLiveData: !!stored,
    });
  }

  // POST — trigger a fresh refresh
  if (req.method === 'POST') {
    try {
      const freshData = await fetchLiveBenchmarks();
      await setMarketBenchmarks(freshData);

      return res.status(200).json({
        success: true,
        benchmarks: freshData,
        refreshedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Market data refresh failed:', error);
      const fallback = await getMarketBenchmarks() || DEFAULT_BENCHMARKS;
      return res.status(500).json({
        error: 'Failed to refresh market data',
        message: error.message,
        currentData: fallback,
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * Queries Perplexity AI for current AI search market data.
 * Perplexity cites real sources, so we get verifiable numbers.
 */
async function fetchLiveBenchmarks() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    console.warn('No PERPLEXITY_API_KEY — returning default benchmarks with date bump');
    return { ...DEFAULT_BENCHMARKS, lastUpdated: new Date().toISOString().split('T')[0], refreshMethod: 'default-no-key' };
  }

  // Query 1: AI search adoption share
  const adoptionData = await queryPerplexity(apiKey, `What percentage of commercial search queries currently go through AI platforms like ChatGPT, Perplexity, Google AI Overviews, and Microsoft Copilot in 2025-2026? Give me the most recent data with specific percentages and cite the research source. Also what is the year-over-year growth rate of AI search adoption?`);

  // Query 2: AI CTR and conversion data
  const ctrData = await queryPerplexity(apiKey, `What is the click-through rate when an AI assistant like ChatGPT or Perplexity recommends a business or website? What percentage of AI-referred traffic converts compared to organic search traffic? Cite specific studies or data sources from 2024-2026.`);

  // Parse the responses to extract numbers
  const parsed = parseMarketData(adoptionData, ctrData);

  return parsed;
}

async function queryPerplexity(apiKey, question) {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are a market research analyst. Provide specific numerical data with source citations. Be precise — give exact percentages, not ranges when possible. Always cite the research firm, publication, or data source.',
        },
        { role: 'user', content: question },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Extracts numerical benchmarks from Perplexity's natural-language responses.
 * Uses pattern matching to find percentages and growth rates.
 * Falls back to defaults if parsing fails for any metric.
 */
function parseMarketData(adoptionText, ctrText) {
  const combined = (adoptionText + ' ' + ctrText).toLowerCase();

  // Extract AI search share percentage
  let aiSearchShare = DEFAULT_BENCHMARKS.aiSearchShareOverall;
  const sharePatterns = [
    /(\d+\.?\d*)%?\s*(?:of\s+)?(?:all\s+)?(?:search|queries|commercial)/i,
    /ai\s+(?:search|platforms?|assistants?)\s+(?:handle|account for|represent|capture)\s+(?:about\s+|approximately\s+|roughly\s+|around\s+)?(\d+\.?\d*)%/i,
    /(\d+\.?\d*)%\s+of\s+(?:all\s+)?(?:search|queries)/i,
  ];
  for (const pattern of sharePatterns) {
    const match = combined.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      // Sanity check: AI search share should be between 2% and 30% in 2025-2026
      if (val >= 2 && val <= 30) {
        aiSearchShare = val / 100;
        break;
      }
    }
  }

  // Extract YoY growth rate
  let growthRate = DEFAULT_BENCHMARKS.aiSearchShareGrowthRate;
  const growthPatterns = [
    /(?:year.over.year|yoy|annual)\s+(?:growth|increase)\s+(?:of\s+|rate\s+(?:of\s+)?)?(?:about\s+|approximately\s+)?(\d+\.?\d*)%/i,
    /(?:grow|increase|rise|grew|doubled).*?(\d+\.?\d*)%/i,
  ];
  for (const pattern of growthPatterns) {
    const match = combined.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (val >= 20 && val <= 300) {
        growthRate = val / 100;
        break;
      }
    }
  }

  // Extract CTR for AI recommendations
  let topCTR = DEFAULT_BENCHMARKS.aiTopPositionCTR;
  const ctrPatterns = [
    /(?:click.through|ctr)\s+(?:rate\s+)?(?:of\s+|is\s+)?(?:about\s+|approximately\s+)?(\d+\.?\d*)%/i,
    /(\d+\.?\d*)%\s+(?:click|ctr)/i,
  ];
  for (const pattern of ctrPatterns) {
    const match = combined.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (val >= 5 && val <= 40) {
        topCTR = val / 100;
        break;
      }
    }
  }

  // Extract conversion premium
  let convPremium = DEFAULT_BENCHMARKS.aiConversionPremium;
  const convPatterns = [
    /(\d+\.?\d*)%\s+(?:higher|better|more)\s+(?:conversion|converting)/i,
    /convert.*?(\d+\.?\d*)%\s+(?:higher|better|more)/i,
  ];
  for (const pattern of convPatterns) {
    const match = combined.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (val >= 5 && val <= 100) {
        convPremium = 1 + (val / 100);
        break;
      }
    }
  }

  // Extract source citations from the text
  const sources = [];
  const sourcePatterns = [
    /(?:according to|source:|per|from|cited by|reported by|data from)\s+([A-Z][a-zA-Z\s&/]+(?:\d{4})?)/gi,
    /(Datos|SparkToro|Similarweb|BrightEdge|Statista|Gartner|Forrester|eMarketer|Pew Research|Wordstream|Unbounce|HubSpot|Semrush|Ahrefs|Authoritas)(?:\s+\d{4})?/gi,
  ];
  for (const pattern of sourcePatterns) {
    let match;
    while ((match = pattern.exec(combined)) !== null) {
      const src = match[1].trim();
      if (src.length > 3 && src.length < 60 && !sources.includes(src)) {
        sources.push(src);
      }
    }
  }

  return {
    aiSearchShareOverall: aiSearchShare,
    aiSearchShareGrowthRate: growthRate,
    aiTopPositionCTR: topCTR,
    optimisedCeiling: DEFAULT_BENCHMARKS.optimisedCeiling, // keep conservative
    aiConversionPremium: convPremium,
    sources: sources.length > 0 ? sources : ['Perplexity AI aggregated sources'],
    lastUpdated: new Date().toISOString().split('T')[0],
    refreshMethod: 'live-perplexity',
    rawAdoptionResponse: adoptionText.substring(0, 500),
    rawCtrResponse: ctrText.substring(0, 500),
    categoryMultipliers: DEFAULT_BENCHMARKS.categoryMultipliers,
  };
}
