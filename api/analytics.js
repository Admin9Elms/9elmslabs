/**
 * 9 Elms Labs - Analytics Endpoint
 * Version: 1.0.0
 *
 * Receives conversion optimization data from the client-side snippet
 * Validates, processes, and stores analytics data
 *
 * Usage: Deployed on Vercel as an API route
 * Endpoint: POST /api/analytics
 *
 * Expected payload:
 * {
 *   clientId: string,
 *   sessionId: string,
 *   timestamp: number,
 *   pageUrl: string,
 *   pageMetrics: { scrollDepth, timeOnPage, bounceRisk },
 *   events: Array<{ type, timestamp, data }>
 * }
 */

// Store for demo/development (in production, this would be a database)
const analyticsStore = new Map();

/**
 * Validate client ID
 */
function validateClientId(clientId) {
  if (!clientId || typeof clientId !== 'string') {
    return false;
  }

  // Accept demo mode or valid client IDs
  if (clientId === 'demo') {
    return true;
  }

  // Client IDs should be alphanumeric, hyphens, underscores
  return /^[a-zA-Z0-9_-]{6,50}$/.test(clientId);
}

/**
 * Validate payload structure
 */
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload format' };
  }

  if (!payload.clientId) {
    return { valid: false, error: 'Missing clientId' };
  }

  if (!validateClientId(payload.clientId)) {
    return { valid: false, error: 'Invalid clientId format' };
  }

  if (!payload.sessionId || typeof payload.sessionId !== 'string') {
    return { valid: false, error: 'Missing or invalid sessionId' };
  }

  if (!payload.timestamp || typeof payload.timestamp !== 'number') {
    return { valid: false, error: 'Missing or invalid timestamp' };
  }

  if (!payload.pageUrl || typeof payload.pageUrl !== 'string') {
    return { valid: false, error: 'Missing or invalid pageUrl' };
  }

  if (!Array.isArray(payload.events)) {
    return { valid: false, error: 'events must be an array' };
  }

  return { valid: true };
}

/**
 * Sanitize URL to prevent logging sensitive data
 */
function sanitizeUrl(url) {
  try {
    const parsed = new URL(url);
    // Remove query parameters that might contain sensitive data
    parsed.search = '';
    return parsed.toString();
  } catch (e) {
    return 'invalid-url';
  }
}

/**
 * Aggregate analytics data
 */
function aggregateAnalytics(clientId, payload) {
  if (!analyticsStore.has(clientId)) {
    analyticsStore.set(clientId, {
      clientId,
      sessions: new Map(),
      totalEvents: 0,
      eventTypes: {},
      pageMetricsAgg: {
        avgScrollDepth: 0,
        avgTimeOnPage: 0,
        bounceCount: 0,
        totalSessions: 0
      }
    });
  }

  const store = analyticsStore.get(clientId);
  const { sessionId, events, pageMetrics } = payload;

  // Track session
  if (!store.sessions.has(sessionId)) {
    store.sessions.set(sessionId, {
      sessionId,
      firstSeen: payload.timestamp,
      lastSeen: payload.timestamp,
      eventCount: 0,
      pageMetrics
    });
    store.pageMetricsAgg.totalSessions++;
  }

  const session = store.sessions.get(sessionId);
  session.lastSeen = payload.timestamp;
  session.eventCount += events.length;

  // Aggregate event types
  events.forEach(event => {
    store.totalEvents++;
    const eventType = event.type;
    store.eventTypes[eventType] = (store.eventTypes[eventType] || 0) + 1;
  });

  // Update page metrics
  if (pageMetrics) {
    if (typeof pageMetrics.scrollDepth === 'number') {
      store.pageMetricsAgg.avgScrollDepth =
        (store.pageMetricsAgg.avgScrollDepth * (store.pageMetricsAgg.totalSessions - 1) + pageMetrics.scrollDepth) /
        store.pageMetricsAgg.totalSessions;
    }

    if (typeof pageMetrics.timeOnPage === 'number') {
      store.pageMetricsAgg.avgTimeOnPage =
        (store.pageMetricsAgg.avgTimeOnPage * (store.pageMetricsAgg.totalSessions - 1) + pageMetrics.timeOnPage) /
        store.pageMetricsAgg.totalSessions;
    }

    if (pageMetrics.bounceRisk === true) {
      store.pageMetricsAgg.bounceCount++;
    }
  }

  return store;
}

/**
 * Format data for logging
 */
function formatLogData(clientId, payload, aggregated) {
  const urlSanitized = sanitizeUrl(payload.pageUrl);

  return {
    timestamp: new Date(payload.timestamp).toISOString(),
    clientId,
    sessionId: payload.sessionId,
    pageUrl: urlSanitized,
    eventsReceived: payload.events.length,
    pageMetrics: payload.pageMetrics,
    eventSummary: aggregated.eventTypes,
    clientStats: {
      totalSessions: aggregated.pageMetricsAgg.totalSessions,
      totalEvents: aggregated.totalEvents,
      avgScrollDepth: Math.round(aggregated.pageMetricsAgg.avgScrollDepth),
      avgTimeOnPage: Math.round(aggregated.pageMetricsAgg.avgTimeOnPage),
      bounceRate: aggregated.pageMetricsAgg.totalSessions > 0
        ? Math.round((aggregated.pageMetricsAgg.bounceCount / aggregated.pageMetricsAgg.totalSessions) * 100)
        : 0
    }
  };
}

/**
 * Main handler for Vercel
 */
export default function handler(req, res) {
  // Set CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let payload;

    // Parse body - handle both JSON and form data
    if (typeof req.body === 'string') {
      try {
        payload = JSON.parse(req.body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON in request body' });
      }
    } else if (typeof req.body === 'object') {
      payload = req.body;
    } else {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    // Validate payload
    const validation = validatePayload(payload);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Aggregate and store data
    const aggregated = aggregateAnalytics(payload.clientId, payload);

    // Format and log for visibility
    const logData = formatLogData(payload.clientId, payload, aggregated);
    console.log('[9 Elms Labs Analytics]', JSON.stringify(logData, null, 2));

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Analytics data received and processed',
      sessionId: payload.sessionId,
      eventsProcessed: payload.events.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // Log unexpected errors but don't expose internals
    console.error('[9 Elms Labs Analytics Error]', error);

    return res.status(500).json({
      error: 'Failed to process analytics data',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Optional: Statistics endpoint (GET /api/analytics?clientId=XXX)
 * Not included in main handler but could be useful for dashboards
 */
export function getStats(clientId) {
  if (!analyticsStore.has(clientId)) {
    return null;
  }

  const store = analyticsStore.get(clientId);
  const bounceRate = store.pageMetricsAgg.totalSessions > 0
    ? Math.round((store.pageMetricsAgg.bounceCount / store.pageMetricsAgg.totalSessions) * 100)
    : 0;

  return {
    clientId,
    stats: {
      totalSessions: store.pageMetricsAgg.totalSessions,
      totalEvents: store.totalEvents,
      averageScrollDepth: Math.round(store.pageMetricsAgg.avgScrollDepth),
      averageTimeOnPage: Math.round(store.pageMetricsAgg.avgTimeOnPage),
      bounceRate,
      uniqueEventTypes: Object.keys(store.eventTypes).length,
      eventTypeBreakdown: store.eventTypes
    },
    generatedAt: new Date().toISOString()
  };
}

/**
 * Health check endpoint
 */
export function health(req, res) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    status: 'healthy',
    service: '9 Elms Labs Analytics',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
}
