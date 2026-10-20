// Website Health Report — lightweight, dependency-free analysis engine.
//
// Deliberately avoids Puppeteer/Lighthouse (too heavy for a free-tier host):
// the expensive Lighthouse-equivalent work (performance, Core Web Vitals,
// accessibility, best-practices, on-page SEO audit) is delegated to Google's
// free PageSpeed Insights API, which runs real Lighthouse on Google's own
// infrastructure. Everything else here (security headers, SSL, DNS,
// robots/sitemap, meta tags) is done with plain Node core modules.
//
// SSRF hardening: this endpoint fetches a user-supplied URL server-side,
// which is a classic SSRF vector against cloud metadata endpoints and
// internal services. Every hostname (including redirect targets) is
// resolved and checked against private/reserved IP ranges before connecting.

const https = require('https');
const http = require('http');
const dns = require('dns').promises;
const tls = require('tls');
const { URL } = require('url');

const PRIVATE_V4_RANGES = [
  [/^0\./],
  [/^10\./],
  [/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./], // 100.64.0.0/10 (CGNAT)
  [/^127\./],
  [/^169\.254\./],
  [/^172\.(1[6-9]|2\d|3[01])\./],
  [/^192\.0\.0\./],
  [/^192\.168\./],
  [/^198\.1[89]\./],
  [/^224\./], // multicast
  [/^24[0-9]\./], // reserved
  [/^255\.255\.255\.255$/]
];

function isPrivateIpv4(ip) {
  return PRIVATE_V4_RANGES.some(([re]) => re.test(ip));
}

function isPrivateIpv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 — check the embedded v4 address
    const v4 = lower.split(':').pop();
    if (v4 && v4.includes('.')) return isPrivateIpv4(v4);
  }
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local fc00::/7
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local fe80::/10
  if (lower === '::') return true;
  return false;
}

function isPrivateIp(ip) {
  return ip.includes(':') ? isPrivateIpv6(ip) : isPrivateIpv4(ip);
}

class SsrfBlockedError extends Error {
  constructor(hostname) {
    super(`Refusing to connect to "${hostname}": resolves to a private/reserved address.`);
    this.name = 'SsrfBlockedError';
  }
}

async function assertPublicHostname(hostname) {
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (err) {
    throw new Error(`Could not resolve hostname "${hostname}": ${err.message}`);
  }
  if (!addresses.length) throw new Error(`No DNS records found for "${hostname}".`);
  for (const { address } of addresses) {
    if (isPrivateIp(address)) throw new SsrfBlockedError(hostname);
  }
  return addresses;
}

/**
 * Fetch a URL with SSRF guards, redirect-following (re-validated at each
 * hop), a response size cap, and a timeout. Returns { statusCode, headers,
 * body, finalUrl, timingMs }.
 */
function fetchGuarded(targetUrl, opts = {}) {
  const { timeoutMs = 15000, maxRedirects = 3, maxBytes = 3_000_000, method = 'GET' } = opts;

  return new Promise((resolve, reject) => {
    const start = Date.now();

    async function doRequest(currentUrl, redirectsLeft) {
      let parsed;
      try {
        parsed = new URL(currentUrl);
      } catch {
        return reject(new Error('Invalid URL.'));
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return reject(new Error('Only http:// and https:// URLs are supported.'));
      }

      try {
        await assertPublicHostname(parsed.hostname);
      } catch (err) {
        return reject(err);
      }

      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request(
        parsed,
        {
          method,
          timeout: timeoutMs,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; VineetVisheshHealthReport/1.0; +https://vineedoesstuff.in)',
            Accept: 'text/html,application/xhtml+xml'
          }
        },
        (res) => {
          const { statusCode, headers } = res;

          if (statusCode >= 300 && statusCode < 400 && headers.location && redirectsLeft > 0) {
            res.resume();
            const nextUrl = new URL(headers.location, parsed).toString();
            return doRequest(nextUrl, redirectsLeft - 1);
          }

          const chunks = [];
          let total = 0;
          res.on('data', (chunk) => {
            total += chunk.length;
            if (total > maxBytes) {
              req.destroy();
              return reject(new Error('Response too large.'));
            }
            chunks.push(chunk);
          });
          res.on('end', () => {
            resolve({
              statusCode,
              headers,
              body: Buffer.concat(chunks).toString('utf8'),
              finalUrl: currentUrl,
              timingMs: Date.now() - start
            });
          });
        }
      );
      req.on('timeout', () => req.destroy(new Error('Request timed out.')));
      req.on('error', reject);
      req.end();
    }

    doRequest(targetUrl, maxRedirects).catch(reject);
  });
}

// ---------------------------------------------------------------------
// Security headers (SecurityHeaders.com equivalent)
// ---------------------------------------------------------------------
const SECURITY_HEADER_CHECKS = [
  { key: 'strict-transport-security', label: 'Strict-Transport-Security', weight: 20,
    advice: 'Forces browsers to use HTTPS for this domain. Add e.g. "max-age=31536000; includeSubDomains".' },
  { key: 'content-security-policy', label: 'Content-Security-Policy', weight: 25,
    advice: 'Restricts which origins scripts/styles/frames can load from — the single biggest XSS mitigation.' },
  { key: 'x-content-type-options', label: 'X-Content-Type-Options', weight: 10,
    advice: 'Set to "nosniff" to stop browsers from MIME-sniffing responses away from the declared content type.' },
  { key: 'x-frame-options', label: 'X-Frame-Options', weight: 15,
    advice: 'Set to "DENY" or "SAMEORIGIN" to prevent clickjacking (or use CSP frame-ancestors).' },
  { key: 'referrer-policy', label: 'Referrer-Policy', weight: 10,
    advice: 'Set e.g. "strict-origin-when-cross-origin" to avoid leaking full URLs to third parties.' },
  { key: 'permissions-policy', label: 'Permissions-Policy', weight: 10,
    advice: 'Restricts which browser features (camera, geolocation, etc.) this page may use.' },
  { key: 'cross-origin-opener-policy', label: 'Cross-Origin-Opener-Policy', weight: 5,
    advice: 'Set e.g. "same-origin" to isolate this page from cross-origin popups/tabs.' },
  { key: 'cross-origin-resource-policy', label: 'Cross-Origin-Resource-Policy', weight: 5,
    advice: 'Set e.g. "same-origin" to stop other sites from embedding this site\'s resources.' }
];

function checkSecurityHeaders(headers) {
  let earned = 0;
  const total = SECURITY_HEADER_CHECKS.reduce((s, c) => s + c.weight, 0);
  const findings = SECURITY_HEADER_CHECKS.map((check) => {
    const value = headers[check.key];
    const present = Boolean(value);
    if (present) earned += check.weight;
    return {
      header: check.label,
      present,
      value: present ? String(value).substring(0, 200) : null,
      advice: present ? null : check.advice
    };
  });
  return { score: Math.round((earned / total) * 100), findings };
}

// ---------------------------------------------------------------------
// Lightweight HTML meta/SEO extraction (regex-based, no DOM dependency)
// ---------------------------------------------------------------------
// Source HTML attribute values routinely contain HTML entities (e.g. a
// meta description with a literal "&#39;" for an apostrophe) -- a real DOM
// parser decodes these automatically when reading .textContent/.content,
// but a regex extraction gets the raw encoded text verbatim. Left
// undecoded, the frontend would then correctly-but-uselessly HTML-escape
// that already-encoded text for safe display, and the user would see the
// literal characters "&#39;" instead of an apostrophe. Decode the common
// named and numeric entities here so what the user sees is the real text.
const HTML_NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  copy: '©', reg: '®', trade: '™'
};

function decodeHtmlEntities(str) {
  if (!str) return str;
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, ent) => {
    if (ent[0] === '#') {
      const code = ent[1].toLowerCase() === 'x' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return Object.prototype.hasOwnProperty.call(HTML_NAMED_ENTITIES, ent) ? HTML_NAMED_ENTITIES[ent] : match;
  });
}

function extractTag(html, re) {
  const m = html.match(re);
  return m ? decodeHtmlEntities(m[1].trim()) : null;
}

function extractMetaContent(html, nameOrProperty, attr = 'name') {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${nameOrProperty}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${nameOrProperty}["']`,
    'i'
  );
  const m = html.match(re);
  return m ? decodeHtmlEntities((m[1] || m[2] || '').trim()) : null;
}

function parseSeo(html) {
  const title = extractTag(html, /<title[^>]*>([^<]*)<\/title>/i);
  const description = extractMetaContent(html, 'description');
  const viewport = extractMetaContent(html, 'viewport');
  const robotsMeta = extractMetaContent(html, 'robots');
  const canonical = extractTag(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
  const ogTitle = extractMetaContent(html, 'og:title', 'property');
  const ogDescription = extractMetaContent(html, 'og:description', 'property');
  const ogImage = extractMetaContent(html, 'og:image', 'property');
  const twitterCard = extractMetaContent(html, 'twitter:card');
  const hasJsonLd = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const imagesMissingAlt = imgTags.filter((tag) => !/\balt=/i.test(tag)).length;

  const checks = [
    { label: 'Title tag', pass: Boolean(title && title.length > 0 && title.length <= 60), detail: title || 'Missing' },
    { label: 'Meta description', pass: Boolean(description && description.length > 0 && description.length <= 160), detail: description || 'Missing' },
    { label: 'Viewport meta (mobile-friendly)', pass: Boolean(viewport), detail: viewport || 'Missing' },
    { label: 'Canonical URL', pass: Boolean(canonical), detail: canonical || 'Missing' },
    { label: 'Open Graph tags', pass: Boolean(ogTitle && ogDescription && ogImage), detail: ogTitle ? 'Present' : 'Missing' },
    { label: 'Twitter Card tag', pass: Boolean(twitterCard), detail: twitterCard || 'Missing' },
    { label: 'Structured data (JSON-LD)', pass: hasJsonLd, detail: hasJsonLd ? 'Present' : 'Missing' },
    { label: 'Exactly one <h1>', pass: h1Count === 1, detail: `${h1Count} found` },
    { label: 'Images have alt text', pass: imagesMissingAlt === 0, detail: imgTags.length ? `${imagesMissingAlt}/${imgTags.length} missing alt` : 'No images' },
    { label: 'robots meta not blocking indexing', pass: !robotsMeta || !/noindex/i.test(robotsMeta), detail: robotsMeta || 'Not set (defaults to index)' }
  ];

  const score = Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);
  return { score, title, description, checks };
}

// ---------------------------------------------------------------------
// robots.txt / sitemap.xml presence
// ---------------------------------------------------------------------
async function checkRobotsAndSitemap(origin) {
  const result = { robotsTxt: { present: false }, sitemapXml: { present: false } };
  try {
    const r = await fetchGuarded(new URL('/robots.txt', origin).toString(), { timeoutMs: 8000 });
    result.robotsTxt.present = r.statusCode === 200;
    if (result.robotsTxt.present) {
      const m = r.body.match(/sitemap:\s*(\S+)/i);
      if (m) result.robotsTxt.declaresSitemap = m[1];
    }
  } catch {
    /* treated as absent */
  }
  try {
    const s = await fetchGuarded(new URL('/sitemap.xml', origin).toString(), { timeoutMs: 8000 });
    result.sitemapXml.present = s.statusCode === 200;
  } catch {
    /* treated as absent */
  }
  return result;
}

// ---------------------------------------------------------------------
// SSL/TLS certificate check
// ---------------------------------------------------------------------
function checkSsl(hostname, port = 443) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, port, servername: hostname, timeout: 8000, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        const protocol = socket.getProtocol();
        const authorized = socket.authorized;
        const authError = socket.authorizationError;
        socket.end();

        if (!cert || !cert.valid_to) {
          return resolve({ ok: false, error: 'No certificate presented.' });
        }
        const validTo = new Date(cert.valid_to);
        const daysRemaining = Math.round((validTo.getTime() - Date.now()) / 86400000);
        resolve({
          ok: true,
          protocol,
          authorized,
          authorizationError: authorized ? null : authError,
          issuer: cert.issuer && cert.issuer.O,
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          daysRemaining
        });
      }
    );
    socket.on('timeout', () => { socket.destroy(); resolve({ ok: false, error: 'TLS handshake timed out.' }); });
    socket.on('error', (err) => resolve({ ok: false, error: err.message }));
  });
}

// ---------------------------------------------------------------------
// DNS records
// ---------------------------------------------------------------------
async function checkDns(hostname) {
  const result = {};
  const lookups = {
    a: () => dns.resolve4(hostname),
    aaaa: () => dns.resolve6(hostname),
    mx: () => dns.resolveMx(hostname),
    txt: () => dns.resolveTxt(hostname),
    ns: () => dns.resolveNs(hostname)
  };
  await Promise.all(
    Object.entries(lookups).map(async ([key, fn]) => {
      try {
        result[key] = await fn();
      } catch {
        result[key] = [];
      }
    })
  );
  result.hasSpf = (result.txt || []).some((rec) => rec.join('').toLowerCase().startsWith('v=spf1'));
  result.hasDmarc = await dns
    .resolveTxt(`_dmarc.${hostname}`)
    .then((recs) => recs.some((rec) => rec.join('').toLowerCase().startsWith('v=dmarc1')))
    .catch(() => false);
  return result;
}

// ---------------------------------------------------------------------
// Google PageSpeed Insights (real Lighthouse, runs on Google's infra)
// ---------------------------------------------------------------------
function runPageSpeedInsights(targetUrl, strategy = 'mobile') {
  return new Promise((resolve) => {
    const categories = ['performance', 'seo', 'accessibility', 'best-practices']
      .map((c) => `category=${c}`)
      .join('&');
    // Keyless requests share one tiny global quota across every anonymous
    // caller of this API on the internet and get exhausted almost
    // immediately in practice. PAGESPEED_API_KEY (free, from Google Cloud
    // Console — enable "PageSpeed Insights API", no billing required for
    // this quota tier) gives this service its own dedicated quota instead.
    const keyParam = process.env.PAGESPEED_API_KEY ? `&key=${process.env.PAGESPEED_API_KEY}` : '';
    const apiUrl =
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}` +
      `&strategy=${strategy}&${categories}${keyParam}`;

    const req = https.get(apiUrl, { timeout: 45000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (json.error) return resolve({ ok: false, error: json.error.message || 'PageSpeed Insights error.' });

          const lr = json.lighthouseResult;
          const categoryScore = (id) =>
            lr.categories && lr.categories[id] ? Math.round(lr.categories[id].score * 100) : null;
          const auditValue = (id) => (lr.audits && lr.audits[id] ? lr.audits[id].displayValue : null);

          resolve({
            ok: true,
            strategy,
            scores: {
              performance: categoryScore('performance'),
              seo: categoryScore('seo'),
              accessibility: categoryScore('accessibility'),
              bestPractices: categoryScore('best-practices')
            },
            coreWebVitals: {
              lcp: auditValue('largest-contentful-paint'),
              cls: auditValue('cumulative-layout-shift'),
              tbt: auditValue('total-blocking-time'),
              fcp: auditValue('first-contentful-paint'),
              speedIndex: auditValue('speed-index')
            },
            topOpportunities: Object.values(lr.audits || {})
              .filter((a) => a.details && a.details.type === 'opportunity' && a.score !== null && a.score < 0.9)
              .sort((a, b) => (b.details.overallSavingsMs || 0) - (a.details.overallSavingsMs || 0))
              .slice(0, 5)
              .map((a) => ({ title: a.title, savingsMs: a.details.overallSavingsMs || 0 }))
          });
        } catch (err) {
          resolve({ ok: false, error: 'Could not parse PageSpeed Insights response: ' + err.message });
        }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'PageSpeed Insights timed out.' }); });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
  });
}

// ---------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------
function overallGrade(scores) {
  const values = scores.filter((s) => typeof s === 'number');
  if (!values.length) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (avg >= 90) return 'A';
  if (avg >= 80) return 'B';
  if (avg >= 70) return 'C';
  if (avg >= 60) return 'D';
  return 'F';
}

async function generateHealthReport(rawUrl) {
  let target;
  try {
    target = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    throw new Error('Please enter a valid URL.');
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are supported.');
  }

  await assertPublicHostname(target.hostname); // fail fast before any work

  const origin = target.origin;
  const started = Date.now();

  const [pageRes, robotsSitemap, ssl, dnsInfo, psi] = await Promise.allSettled([
    fetchGuarded(target.toString(), { timeoutMs: 15000 }),
    checkRobotsAndSitemap(origin),
    checkSsl(target.hostname),
    checkDns(target.hostname),
    runPageSpeedInsights(target.toString())
  ]);

  if (pageRes.status === 'rejected') {
    throw new Error(`Could not fetch ${target.toString()}: ${pageRes.reason.message}`);
  }

  const page = pageRes.value;
  const security = checkSecurityHeaders(page.headers);
  const seo = parseSeo(page.body);

  const psiResult = psi.status === 'fulfilled' ? psi.value : { ok: false, error: psi.reason.message };

  const grade = overallGrade([
    security.score,
    seo.score,
    psiResult.ok ? psiResult.scores.performance : null,
    psiResult.ok ? psiResult.scores.accessibility : null,
    psiResult.ok ? psiResult.scores.bestPractices : null
  ]);

  return {
    url: target.toString(),
    checkedAt: new Date().toISOString(),
    totalTimeMs: Date.now() - started,
    overallGrade: grade,
    http: {
      statusCode: page.statusCode,
      responseTimeMs: page.timingMs,
      server: page.headers.server || null,
      poweredBy: page.headers['x-powered-by'] || null
    },
    security,
    seo,
    performance: psiResult,
    ssl: ssl.status === 'fulfilled' ? ssl.value : { ok: false, error: ssl.reason.message },
    dns: dnsInfo.status === 'fulfilled' ? dnsInfo.value : null,
    robotsAndSitemap: robotsSitemap.status === 'fulfilled' ? robotsSitemap.value : null
  };
}

module.exports = { generateHealthReport, SsrfBlockedError };
