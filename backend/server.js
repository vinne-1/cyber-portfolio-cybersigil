// Lightweight backend to serve live cybersecurity news as JSON
// RSS aggregation for: The Hacker News, Krebs on Security, Dark Reading, CSO Online

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { generateHealthReport, SsrfBlockedError } = require('./healthReport');
const { buildThreatLandscape } = require('./threatLandscape');

const app = express();
const port = process.env.PORT || 4000;

// Security headers
app.use(helmet());

// Rate limiting
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use(limiter);

// Health report is far more expensive per-request (multiple outbound fetches
// plus a PageSpeed Insights run), so it gets its own tighter limit on top of
// the general one above.
const healthReportLimiter = rateLimit({ windowMs: 60 * 1000, max: 5 });

// Simple in-memory cache so we don’t hammer the feeds
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
let cachedNews = {
  articles: [],
  clusters: [],
  top3: [],
  lastUpdated: 0
};

// CORS – require ALLOWED_ORIGIN in production, default to localhost for dev
// ALLOWED_ORIGIN accepts a single origin or a comma-separated list of origins
const allowedOriginRaw = process.env.ALLOWED_ORIGIN || (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3000');
if (!allowedOriginRaw) {
  throw new Error('ALLOWED_ORIGIN environment variable must be set in production');
}
const allowedOrigins = allowedOriginRaw.split(',').map(function (o) { return o.trim(); }).filter(Boolean);
const allowedOrigin = allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins;
app.use(
  cors({
    origin: allowedOrigin,
    methods: ['GET'],
    allowedHeaders: ['Content-Type']
  })
);

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Cyber portfolio news API is running.',
    endpoints: ['/api/cyber-news', '/api/health-report?url=<site>']
  });
});

// Health report results are cached per-URL so repeat checks (and accidental
// double-clicks) don't re-trigger a full PageSpeed Insights run every time.
const HEALTH_REPORT_CACHE_TTL_MS = 15 * 60 * 1000;
const healthReportCache = new Map();

app.get('/api/health-report', healthReportLimiter, async (req, res) => {
  const rawUrl = (req.query.url || '').toString().trim();
  if (!rawUrl) {
    return res.status(400).json({ message: 'Query param "url" is required, e.g. ?url=example.com' });
  }
  if (rawUrl.length > 2048) {
    return res.status(400).json({ message: 'URL is too long.' });
  }

  const cacheKey = rawUrl.toLowerCase();
  const cached = healthReportCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < HEALTH_REPORT_CACHE_TTL_MS) {
    return res.json({ ...cached.report, fromCache: true });
  }

  try {
    const report = await generateHealthReport(rawUrl);
    healthReportCache.set(cacheKey, { report, timestamp: Date.now() });
    res.json({ ...report, fromCache: false });
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      return res.status(400).json({ message: 'That host resolves to a private/internal address and cannot be checked.' });
    }
    // eslint-disable-next-line no-console
    console.error('Error generating health report for', rawUrl, ':', error.message || error);
    res.status(502).json({ message: error.message || 'Failed to generate health report.' });
  }
});

app.get('/api/cyber-news', async (_req, res) => {
  try {
    const now = Date.now();

    // Serve from cache if still fresh
    if (cachedNews.articles.length && now - cachedNews.lastUpdated < CACHE_TTL_MS) {
      return res.json({
        articles: cachedNews.articles,
        clusters: cachedNews.clusters,
        top3: cachedNews.top3,
        rankingMethodology: cachedNews.rankingMethodology,
        lastUpdated: new Date(cachedNews.lastUpdated).toISOString(),
        fromCache: true
      });
    }

    const landscape = await buildThreatLandscape();

    cachedNews = {
      articles: landscape.articles,
      clusters: landscape.clusters,
      top3: landscape.top3,
      rankingMethodology: landscape.rankingMethodology,
      lastUpdated: now
    };

    res.json({
      articles: landscape.articles,
      clusters: landscape.clusters,
      top3: landscape.top3,
      rankingMethodology: landscape.rankingMethodology,
      lastUpdated: new Date(now).toISOString(),
      fromCache: false
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error aggregating cyber news:', error);
    res.status(500).json({
      message: 'Failed to fetch cyber news.'
    });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Cyber portfolio news API listening on http://localhost:${port}`);
});


