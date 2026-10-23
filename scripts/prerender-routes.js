// Generates a static, crawlable HTML file for every non-root SPA route, so
// GitHub Pages serves a real 200 with the correct <title>/meta/canonical/OG
// tags to any client that doesn't execute JS (search engine crawlers' initial
// fetch, link-unfurl bots for Slack/Discord/iMessage/etc). Without this, only
// "/" returns 200 -- every other sitemap.xml URL 404s at the HTTP level, and
// a non-JS client sees a bare GitHub Pages 404 page instead of the right
// title/description/OG tags, even though the SPA router already produces the
// correct in-browser experience once app.js loads.
//
// GitHub Pages resolves an extensionless path like "/about" to "about.html"
// automatically, so each route below becomes "<outDir>/<route>.html" (nested
// for "/tools/website-health"). The generated file is a copy of the real,
// already-hydrated index.html with only the <head> metadata swapped --
// app.js still boots normally and renders the matching template, so a JS
// client gets the identical SPA experience either way.
//
// Run as: node scripts/prerender-routes.js <path-to-built-index.html> <outDir>
//
// ROUTES below must stay in sync with ROUTES/ROUTE_TITLES/ROUTE_DESCRIPTIONS
// in app.js and with sitemap.xml -- "/" is intentionally excluded since
// index.html already serves it directly.
const fs = require('fs');
const path = require('path');

const SITE_ORIGIN = 'https://vineedoesstuff.in';

const ROUTES = {
  '/about': {
    title: 'About — Vineet Vishesh',
    description: 'About Vineet Vishesh — offensive security background, methodology, certifications, and skill proficiency.'
  },
  '/work': {
    title: 'Work & Capabilities — Vineet Vishesh',
    description: 'Selected offensive security work and capabilities — web/API VAPT, SIEM detection engineering, toolkit, and skill proficiency.'
  },
  '/products': {
    title: 'Products — Vineet Vishesh',
    description: 'Products built by Vineet Vishesh — independent apps, starting with TithiPath, plus free tools including a Website Health Report and a live Threat Landscape feed.'
  },
  '/tools/website-health': {
    title: 'Website Health Report — Vineet Vishesh',
    description: 'Free Website Health Report — security headers, SEO, performance, SSL/TLS, and DNS analysis for any URL.'
  },
  '/threat-landscape': {
    title: 'Threat Landscape — Vineet Vishesh',
    description: 'Live cybersecurity threat landscape — deduplicated coverage from 6 sources, ranked by severity, corroboration, and recency.'
  },
  '/credentials': {
    title: 'Credentials — Vineet Vishesh',
    description: 'Certifications and credentials — CompTIA Security+, Certified Red Team Analyst (CRTA), and professional endorsements.'
  },
  '/contact': {
    title: 'Contact — Vineet Vishesh',
    description: 'Get in touch with Vineet Vishesh for offensive security engagements, red team operations, and penetration testing.'
  },
  '/privacy': {
    title: 'Privacy Policy — Vineet Vishesh',
    description: 'How this site handles data — analytics, the free tools, local storage, and advertising disclosure.'
  }
};

function escapeHtmlAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function renderForRoute(sourceHtml, route, meta) {
  const canonicalUrl = SITE_ORIGIN + route;
  const title = meta.title;
  const description = escapeHtmlAttr(meta.description);

  let out = sourceHtml;
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  out = out.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${description}">`
  );
  out = out.replace(
    /<link rel="canonical" href="[^"]*">/,
    `<link rel="canonical" href="${canonicalUrl}">`
  );
  out = out.replace(
    /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${title}">`
  );
  out = out.replace(
    /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${description}">`
  );
  out = out.replace(
    /<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${canonicalUrl}">`
  );
  out = out.replace(
    /<meta name="twitter:title" content="[^"]*">/,
    `<meta name="twitter:title" content="${title}">`
  );
  out = out.replace(
    /<meta name="twitter:description" content="[^"]*">/,
    `<meta name="twitter:description" content="${description}">`
  );
  return out;
}

function main() {
  const [, , indexPath, outDir] = process.argv;
  if (!indexPath || !outDir) {
    console.error('Usage: node scripts/prerender-routes.js <path-to-index.html> <outDir>');
    process.exit(1);
  }

  const sourceHtml = fs.readFileSync(indexPath, 'utf8');
  let written = 0;

  Object.keys(ROUTES).forEach((route) => {
    const meta = ROUTES[route];
    const rendered = renderForRoute(sourceHtml, route, meta);

    // "/tools/website-health" -> <outDir>/tools/website-health.html
    const relPath = route.replace(/^\//, '') + '.html';
    const destPath = path.join(outDir, relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, rendered);
    written += 1;
  });

  console.log(`Prerendered ${written} route(s) into ${outDir}`);
}

main();
