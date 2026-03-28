// Lightweight backend to serve live cybersecurity news as JSON
// RSS aggregation for: The Hacker News, Krebs on Security, Dark Reading, CSO Online

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const RSSParser = require('rss-parser');

const app = express();
const port = process.env.PORT || 4000;

// Security headers
app.use(helmet());

// Rate limiting
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use(limiter);

const parser = new RSSParser({
  headers: {
    'User-Agent': 'VineetVishesh-CyberPortfolio/1.0 (+https://example.com)'
  },
  timeout: 10000
});

// RSS sources aligned with live-threat-intelligence.js
const RSS_SOURCES = [
  {
    name: 'The Hacker News',
    url: 'https://feeds.feedburner.com/TheHackersNews'
  },
  {
    name: 'Krebs on Security',
    url: 'https://krebsonsecurity.com/feed/'
  },
  {
    name: 'Dark Reading',
    url: 'https://www.darkreading.com/rss.xml'
  },
  {
    name: 'CSO Online',
    url: 'https://www.csoonline.com/index.rss'
  }
];

// Simple in-memory cache so we don’t hammer the feeds
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
let cachedNews = {
  articles: [],
  lastUpdated: 0
};

// CORS – require ALLOWED_ORIGIN in production, default to localhost for dev
const allowedOrigin = process.env.ALLOWED_ORIGIN || (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3000');
if (!allowedOrigin) {
  throw new Error('ALLOWED_ORIGIN environment variable must be set in production');
}
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
    endpoints: ['/api/cyber-news']
  });
});

app.get('/api/cyber-news', async (_req, res) => {
  try {
    const now = Date.now();

    // Serve from cache if still fresh
    if (cachedNews.articles.length && now - cachedNews.lastUpdated < CACHE_TTL_MS) {
      return res.json({
        articles: cachedNews.articles,
        lastUpdated: new Date(cachedNews.lastUpdated).toISOString(),
        fromCache: true
      });
    }

    const allArticles = [];

    await Promise.all(
      RSS_SOURCES.map(async (source) => {
        try {
          const feed = await parser.parseURL(source.url);
          const mapped = (feed.items || []).slice(0, 10).map((item) => mapArticle(item, source.name));
          allArticles.push(...mapped);
        } catch (err) {
          // Log but don’t fail entire response if one feed is down
          // eslint-disable-next-line no-console
          console.error(`Error fetching RSS from ${source.name}:`, err.message || err);
        }
      })
    );

    // Sort newest first
    allArticles.sort((a, b) => {
      const da = new Date(a.date || 0).getTime();
      const db = new Date(b.date || 0).getTime();
      return db - da;
    });

    cachedNews = {
      articles: allArticles,
      lastUpdated: now
    };

    res.json({
      articles: allArticles,
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

/**
 * Normalize RSS item into the structure expected by live-threat-intelligence.js
 */
function isSafeUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function mapArticle(item, sourceName) {
  const title = (item.title || 'Untitled').substring(0, 300);
  const summary = (
    item.contentSnippet ||
    item.summary ||
    item.content ||
    ''
  ).substring(0, 500);

  const date = item.isoDate || item.pubDate || new Date().toISOString();
  const url = isSafeUrl(item.link) ? item.link : '#';

  const tags = inferTags(item, title);
  const severity = inferSeverity(title, summary, tags);

  return {
    title,
    source: sourceName,
    date,
    summary,
    severity,
    tags,
    url
  };
}

function inferTags(item, title) {
  const text = `${title} ${(item.categories || []).join(' ')}`.toLowerCase();
  const tags = [];

  if (text.includes('ransom')) tags.push('Ransomware');
  if (text.includes('vpn')) tags.push('VPN');
  if (text.includes('ddos')) tags.push('DDoS');
  if (text.includes('supply chain')) tags.push('Supply Chain');
  if (text.includes('financial') || text.includes('bank')) tags.push('Financial');
  if (text.includes('health') || text.includes('hospital')) tags.push('Healthcare');
  if (text.includes('zero-day') || text.includes('0-day')) tags.push('Zero-Day');

  if (!tags.length) tags.push('General');
  return tags;
}

function inferSeverity(title, summary, tags) {
  const text = `${title} ${summary}`.toLowerCase();

  if (text.includes('zero-day') || text.includes('0-day') || text.includes('critical')) {
    return 'Critical';
  }
  if (text.includes('ransomware') || text.includes('breach') || text.includes('data leak')) {
    return 'High';
  }
  if (tags.includes('DDoS') || tags.includes('Supply Chain')) {
    return 'High';
  }
  return 'Medium';
}

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Cyber portfolio news API listening on http://localhost:${port}`);
});


