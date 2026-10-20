// Threat Landscape — multi-source RSS aggregation, deduplication, and an
// honest composite "what matters most today" ranking.
//
// Design notes (approach adapted from a separate project's scoring pattern —
// weighted composite over several honest signals — reimplemented fresh here,
// no code ported):
//   - Severity/impact is inferred from headline+summary keyword signals plus
//     a REAL cross-check against CISA's Known Exploited Vulnerabilities (KEV)
//     catalog when a CVE ID appears in the text. The KEV match is the one
//     fully authoritative signal here; everything else is an honest heuristic
//     and is labelled as such in the API response, never presented as fact.
//   - Dedup groups near-identical headlines covering the same event across
//     outlets (title token overlap + published within ~48h of each other).
//   - The composite score blends: severity weight, source corroboration
//     (how many independent outlets ran it), recency decay, and impact-signal
//     hit count. It is a ranking heuristic over public RSS coverage, not an
//     authoritative threat ranking — the API says so explicitly.

const https = require('https');
const RSSParser = require('rss-parser');

const parser = new RSSParser({
  headers: { 'User-Agent': 'VineetVishesh-CyberPortfolio/1.0 (+https://vineedoesstuff.in)' },
  timeout: 10000
});

const RSS_SOURCES = [
  { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews' },
  { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
  { name: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml' },
  { name: 'CSO Online', url: 'https://www.csoonline.com/feed/' },
  { name: 'SANS Internet Storm Center', url: 'https://isc.sans.edu/rssfeed.xml' },
  { name: 'CISA Advisories', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml' }
  // BleepingComputer's feed is behind a Cloudflare bot challenge (403) and is
  // deliberately not included — bypassing that would mean circumventing
  // their anti-bot protection, which this project doesn't do (same stance
  // taken earlier when GoDaddy's UI blocked automation). NVD's old RSS feed
  // (nvd.nist.gov/feeds/xml/cve/misc/nvd-rss.xml) now 404s; CISA's KEV JSON
  // feed below covers the "real, authoritative exploited-CVE data" need
  // better anyway.
];

const KEV_FEED_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const KEV_CACHE_TTL_MS = 60 * 60 * 1000; // KEV catalog changes a few times a week at most
let kevCache = { cveIds: new Set(), recentCveIds: new Set(), fetchedAt: 0 };

function fetchJson(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs, headers: { 'User-Agent': 'VineetVisheshPortfolio/1.0' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (err) { reject(err); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('KEV fetch timed out')); });
    req.on('error', reject);
  });
}

async function getKevCveIds() {
  const now = Date.now();
  if (now - kevCache.fetchedAt < KEV_CACHE_TTL_MS && kevCache.cveIds.size) return kevCache;
  try {
    const data = await fetchJson(KEV_FEED_URL);
    const cveIds = new Set();
    const recentCveIds = new Set();
    const cutoff = now - 14 * 24 * 60 * 60 * 1000; // "recently added to KEV" window
    for (const v of data.vulnerabilities || []) {
      if (!v.cveID) continue;
      cveIds.add(v.cveID.toUpperCase());
      const added = Date.parse(v.dateAdded || '');
      if (!Number.isNaN(added) && added >= cutoff) recentCveIds.add(v.cveID.toUpperCase());
    }
    kevCache = { cveIds, recentCveIds, fetchedAt: now };
  } catch (err) {
    // Keep serving the old cache (even if stale) rather than failing the
    // whole feed over one slow/unreachable government endpoint.
    // eslint-disable-next-line no-console
    console.error('CISA KEV fetch failed:', err.message || err);
  }
  return kevCache;
}

// ---------------------------------------------------------------------
// Per-article parsing
// ---------------------------------------------------------------------
const CVE_RE = /CVE-\d{4}-\d{4,7}/gi;

function isSafeUrl(raw) {
  try { const u = new URL(raw); return u.protocol === 'https:' || u.protocol === 'http:'; }
  catch { return false; }
}

const IMPACT_SIGNALS = [
  { key: 'zeroDay', label: 'Zero-Day', re: /\bzero-day\b|\b0-day\b/i, weight: 3 },
  { key: 'activelyExploited', label: 'Actively Exploited', re: /\bactively exploit\w*\b|\bexploited in the wild\b/i, weight: 3 },
  { key: 'ransomware', label: 'Ransomware', re: /\bransomware\b/i, weight: 2 },
  { key: 'criticalRce', label: 'Remote Code Execution', re: /\bremote code execution\b|\bRCE\b/i, weight: 2 },
  { key: 'supplyChain', label: 'Supply Chain', re: /\bsupply chain\b/i, weight: 2 },
  { key: 'massVendor', label: 'Widely-Used Software', re: /\b(microsoft|windows|cisco|fortinet|ivanti|vmware|citrix|apache|linux kernel|google chrome|chrome browser|android|ios|openssl|oracle|sap|adobe)\b/i, weight: 1 },
  { key: 'dataBreach', label: 'Data Breach', re: /\bdata breach\b|\bdata leak\b|\bexposed database\b/i, weight: 1 },
  { key: 'ddos', label: 'DDoS', re: /\bddos\b|\bdenial[- ]of[- ]service\b/i, weight: 1 },
  { key: 'criticalInfra', label: 'Critical Infrastructure', re: /\bcritical infrastructure\b|\bindustrial control\b|\bscada\b|\bics\b/i, weight: 2 }
];

async function analyzeArticle(title, summary) {
  const text = `${title} ${summary}`;
  const signals = [];
  for (const sig of IMPACT_SIGNALS) {
    if (sig.re.test(text)) signals.push({ key: sig.key, label: sig.label, weight: sig.weight });
  }

  const cveMatches = Array.from(new Set((text.match(CVE_RE) || []).map((c) => c.toUpperCase())));
  const kev = await getKevCveIds();
  const knownExploitedCves = cveMatches.filter((c) => kev.cveIds.has(c));
  const recentlyAddedToKev = cveMatches.filter((c) => kev.recentCveIds.has(c));
  if (knownExploitedCves.length && !signals.some((s) => s.key === 'activelyExploited')) {
    // Real, authoritative confirmation (not a keyword guess) that this CVE is
    // in CISA's exploited catalog — weight it like the keyword-based signal.
    signals.push({ key: 'kevConfirmed', label: 'Confirmed in CISA KEV Catalog', weight: 3 });
  }

  const impactScore = signals.reduce((s, x) => s + x.weight, 0);
  return { signals, impactScore, cveMatches, knownExploitedCves, recentlyAddedToKev };
}

function inferSeverity(impactScore, signals) {
  const keys = signals.map((s) => s.key);
  if (keys.includes('zeroDay') || keys.includes('activelyExploited') || keys.includes('kevConfirmed') || impactScore >= 5) return 'Critical';
  if (impactScore >= 3) return 'High';
  if (impactScore >= 1) return 'Medium';
  return 'Low';
}

async function mapArticle(item, sourceName) {
  const title = (item.title || 'Untitled').toString().substring(0, 300);
  const summary = (item.contentSnippet || item.summary || item.content || '').toString().substring(0, 500);
  const date = item.isoDate || item.pubDate || new Date().toISOString();
  const url = isSafeUrl(item.link) ? item.link : '#';

  const { signals, impactScore, cveMatches, knownExploitedCves, recentlyAddedToKev } = await analyzeArticle(title, summary);
  const severity = inferSeverity(impactScore, signals);

  return {
    title,
    source: sourceName,
    date,
    summary,
    severity,
    tags: signals.map((s) => s.label).length ? signals.map((s) => s.label) : ['General'],
    url,
    impactScore,
    cveMatches,
    knownExploitedCves,
    recentlyAddedToKev
  };
}

// ---------------------------------------------------------------------
// Deduplication — group near-identical headlines about the same event
// ---------------------------------------------------------------------
const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'with', 'by',
  'new', 'after', 'as', 'at', 'from', 'its', 'this', 'that', 'how', 'why', 'what', 'has',
  'have', 'be', 'it', 'says', 'report', 'found', 'via'
]);

function titleTokens(title) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}

const DEDUPE_SIMILARITY_THRESHOLD = 0.45;
const DEDUPE_WINDOW_MS = 48 * 60 * 60 * 1000;

function dedupeArticles(articles) {
  const withTokens = articles.map((a) => ({ article: a, tokens: titleTokens(a.title), time: Date.parse(a.date) || 0 }));
  const clusters = [];

  for (const item of withTokens) {
    let placed = false;
    for (const cluster of clusters) {
      const within = Math.abs(cluster.time - item.time) <= DEDUPE_WINDOW_MS;
      if (within && jaccard(cluster.tokens, item.tokens) >= DEDUPE_SIMILARITY_THRESHOLD) {
        cluster.articles.push(item.article);
        cluster.sources.add(item.article.source);
        // Keep the most detailed (longest summary) article as the representative
        if ((item.article.summary || '').length > (cluster.representative.summary || '').length) {
          cluster.representative = item.article;
        }
        cluster.time = Math.max(cluster.time, item.time);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({
        representative: item.article,
        articles: [item.article],
        sources: new Set([item.article.source]),
        tokens: item.tokens,
        time: item.time
      });
    }
  }

  return clusters.map((c) => {
    const maxImpact = Math.max(...c.articles.map((a) => a.impactScore));
    const severities = c.articles.map((a) => a.severity);
    const severityRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    const bestSeverity = severities.reduce((best, s) => (severityRank[s] > severityRank[best] ? s : best), 'Low');
    return {
      title: c.representative.title,
      summary: c.representative.summary,
      url: c.representative.url,
      date: new Date(c.time).toISOString(),
      severity: bestSeverity,
      tags: Array.from(new Set(c.articles.flatMap((a) => a.tags))),
      sources: Array.from(c.sources),
      sourceCount: c.sources.size,
      impactScore: maxImpact,
      cveMatches: Array.from(new Set(c.articles.flatMap((a) => a.cveMatches))),
      knownExploitedCves: Array.from(new Set(c.articles.flatMap((a) => a.knownExploitedCves))),
      articleCount: c.articles.length
    };
  });
}

// ---------------------------------------------------------------------
// Composite "what matters most today" ranking
// ---------------------------------------------------------------------
const SEVERITY_WEIGHT = { Critical: 1, High: 0.7, Medium: 0.4, Low: 0.15 };

function compositeScore(cluster) {
  const severity = SEVERITY_WEIGHT[cluster.severity] || 0.15;
  const breadth = Math.min(cluster.sourceCount, 4) / 4; // corroboration across outlets
  const hoursAgo = Math.max(0, (Date.now() - Date.parse(cluster.date)) / 3600000);
  const freshness = Math.exp(-hoursAgo / 30); // ~half-life around 20 hours
  const impact = Math.min(cluster.impactScore, 8) / 8;
  const kevBoost = cluster.knownExploitedCves.length ? 1 : 0;

  const raw = 0.32 * severity + 0.2 * breadth + 0.2 * freshness + 0.18 * impact + 0.1 * kevBoost;
  return Math.round(raw * 100);
}

function rankClusters(clusters) {
  return clusters
    .map((c) => ({ ...c, score: compositeScore(c) }))
    .sort((a, b) => b.score - a.score);
}

function getTop3(rankedClusters, windowHours = 36) {
  const cutoff = Date.now() - windowHours * 3600000;
  const recent = rankedClusters.filter((c) => Date.parse(c.date) >= cutoff);
  const pool = recent.length >= 3 ? recent : rankedClusters; // fall back to all if coverage is thin
  return pool.slice(0, 3);
}

// ---------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------
async function buildThreatLandscape() {
  const rawArticles = [];
  const sourceErrors = [];

  await Promise.all(
    RSS_SOURCES.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.url);
        const items = (feed.items || []).slice(0, 12);
        const mapped = await Promise.all(items.map((item) => mapArticle(item, source.name)));
        rawArticles.push(...mapped);
      } catch (err) {
        sourceErrors.push(source.name);
        // eslint-disable-next-line no-console
        console.error(`Error fetching RSS from ${source.name}:`, err.message || err);
      }
    })
  );

  rawArticles.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));

  const clusters = dedupeArticles(rawArticles);
  const ranked = rankClusters(clusters);
  ranked.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)); // default list order: newest first
  const top3 = getTop3(ranked.slice().sort((a, b) => b.score - a.score));

  return {
    articles: rawArticles, // kept for backward compatibility with the existing homepage ticker
    clusters: ranked,
    top3,
    sourcesUsed: RSS_SOURCES.map((s) => s.name),
    sourceErrors,
    rankingMethodology:
      'Automated heuristic ranking over public RSS coverage: severity signal (keyword-based, boosted only by a real match against CISA\'s Known Exploited Vulnerabilities catalog), how many independent outlets covered the same deduplicated story, and recency. Not an official or authoritative threat ranking.'
  };
}

module.exports = { buildThreatLandscape, RSS_SOURCES };
