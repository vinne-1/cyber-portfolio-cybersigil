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
  '/': {
    template: 'page-home',
    title: 'Vineet Vishesh — Offensive Security',
    description: 'Vineet Vishesh — Offensive Security Specialist. Penetration tester and red team analyst with 3+ years across web, API, network, and cloud security.'
  },
  '/about': {
    template: 'page-about',
    title: 'About — Vineet Vishesh',
    description: 'About Vineet Vishesh — offensive security background, methodology, certifications, and skill proficiency.'
  },
  '/work': {
    template: 'page-work',
    title: 'Work & Capabilities — Vineet Vishesh',
    description: 'Selected offensive security work and capabilities — web/API VAPT, SIEM detection engineering, toolkit, and skill proficiency.'
  },
  '/products': {
    template: 'page-products',
    title: 'TithiPath — Panchang & Kundli App | Vineet Vishesh',
    description: 'TithiPath: Hindu Panchang, Kundli (birth chart), Kundli Matching, and Rashifal for Android — 500+ Indian cities, 9 languages, on-device. Free, live now on Google Play.'
  },
  '/free-tools': {
    template: 'page-free-tools',
    title: 'Free Online Tools: Website Checker, PDF & Text | Vineet Vishesh',
    description: 'Free online tools by Vineet Vishesh — a website health checker, a live threat landscape feed, a browser-based text humanizer, and a file converter. No signup required.'
  },
  '/tools/website-health': {
    template: 'page-tool-website-health',
    title: 'Free Website Health Checker: Security & SEO | Vineet Vishesh',
    description: 'Free website health checker — security headers, SSL/TLS, DNS, on-page SEO, and real Lighthouse performance analysis for any public URL.'
  },
  '/tools/text-humanizer': {
    template: 'page-tool-text-humanizer',
    title: 'Free Text Humanizer - No Signup, Browser-Based | Vineet Vishesh',
    description: 'Free text humanizer — rewrite a stiff draft into plainer sentences in your browser. Rule-based, no signup, nothing is uploaded.'
  },
  '/tools/file-converter': {
    template: 'page-tool-file-converter',
    title: 'Free File Converter: PDFs & Images, No Upload | Vineet Vishesh',
    description: 'Free file converter — merge PDFs, convert images between PNG/JPEG/WEBP, turn a DOCX, TXT, or image into a PDF, and pull the text out of a PDF. Runs in your browser, nothing uploaded.'
  },
  '/tools/merge-pdf': {
    template: 'page-tool-merge-pdf',
    title: 'Merge PDFs Free - No Upload, No Signup | Vineet Vishesh',
    description: 'Merge two or more PDFs into one file in the order you choose — free, no signup, nothing uploaded. Runs entirely in your browser.'
  },
  '/tools/pdf-to-text': {
    template: 'page-tool-pdf-to-text',
    title: 'PDF to Text Converter Free - No Upload | Vineet Vishesh',
    description: 'Extract selectable text from a PDF right in your browser — free, no signup, nothing uploaded. Copy the text or download it as a .txt file.'
  },
  '/tools/webp-to-png': {
    template: 'page-tool-webp-to-png',
    title: 'WEBP to PNG Converter Free - No Upload | Vineet Vishesh',
    description: 'Convert a WEBP image to PNG — or between PNG, JPEG, and WEBP — on a canvas in your browser. Free, no signup, nothing uploaded.'
  },
  '/tools/docx-to-pdf': {
    template: 'page-tool-docx-to-pdf',
    title: 'DOCX to PDF Converter Free - No Signup | Vineet Vishesh',
    description: 'Turn a .docx document into a PDF using your browser\'s print-to-PDF dialog — free, no signup, nothing uploaded.'
  },
  '/guides/security-headers': {
    template: 'page-guide-security-headers',
    title: 'HTTP Security Headers Explained — Vineet Vishesh',
    description: 'What HTTP security headers do, why they matter, and how to check whether your site has them — free, with the Website Health Report tool.'
  },
  '/threat-landscape': {
    template: 'page-threat-landscape',
    title: 'Threat Landscape — Vineet Vishesh',
    description: 'Live cybersecurity threat landscape — deduplicated coverage from 6 sources, ranked by severity, corroboration, and recency.'
  },
  '/guides/cisa-kev': {
    template: 'page-guide-cisa-kev',
    title: 'What Is CISA KEV? — Vineet Vishesh',
    description: "What CISA's Known Exploited Vulnerabilities (KEV) catalog is, why it's the one authoritative severity signal in the Threat Landscape feed, and how it differs from CVSS."
  },
  '/guides/ai-writing-phrases': {
    template: 'page-guide-ai-writing-phrases',
    title: 'Phrases That Make Writing Sound Stiff — Vineet Vishesh',
    description: 'Common stock phrases and stiff sentence patterns that make writing sound formulaic — and how to fix them, free, with the Text Humanizer tool.'
  },
  '/guides/browser-file-conversion': {
    template: 'page-guide-browser-file-conversion',
    title: 'Why Convert Files In Your Browser — Vineet Vishesh',
    description: "What client-side file conversion actually means, why it's a real privacy difference, and what a browser-only tool genuinely can't do — free, with the File Converter tool."
  },
  '/credentials': {
    template: 'page-credentials',
    title: 'Credentials — Vineet Vishesh',
    description: 'Certifications and credentials — CompTIA Security+, Certified Red Team Analyst (CRTA), and professional endorsements.'
  },
  '/contact': {
    template: 'page-contact',
    title: 'Contact — Vineet Vishesh',
    description: 'Get in touch with Vineet Vishesh for offensive security engagements, red team operations, and penetration testing.'
  },
  '/privacy': {
    template: 'page-privacy',
    title: 'Privacy Policy — Vineet Vishesh',
    description: 'How this site handles data — analytics, the free tools, local storage, and advertising disclosure.'
  }
};

function escapeHtmlText(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtmlAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function extractTemplates(sourceHtml) {
  const templates = {};
  const re = /<template id="([^"]+)">([\s\S]*?)<\/template>/g;
  let m;
  while ((m = re.exec(sourceHtml))) {
    if (templates[m[1]] !== undefined) {
      throw new Error(`Duplicate <template id="${m[1]}"> in source document`);
    }
    templates[m[1]] = m[2];
  }
  return templates;
}

function expandToolEmbeds(html, templates) {
  return html.replace(/<div data-tool-embed="([^"]+)"><\/div>/g, (match, name) => {
    const tplId = 'tool-' + name + '-controls';
    const inner = templates[tplId];
    if (inner === undefined) {
      throw new Error(`data-tool-embed="${name}" has no <template id="${tplId}">`);
    }
    return inner;
  });
}

function applyFcDefault(html, defaultTab) {
  let out = html.replace(/<button\b[^>]*data-fc-tab="[^"]+"[^>]*>/g, (tag) => {
    const name = /data-fc-tab="([^"]+)"/.exec(tag)[1];
    const on = name === defaultTab;
    let t = tag.replace(/aria-selected="[^"]*"/, `aria-selected="${on ? 'true' : 'false'}"`);
    t = t.replace(/ class="([^"]*)"/, (mm, cls) => {
      const kept = cls.split(/\s+/).filter((c) => c && c !== 'is-active');
      if (on) kept.push('is-active');
      return ` class="${kept.join(' ')}"`;
    });
    return t;
  });
  out = out.replace(/<div\b[^>]*data-fc-panel="[^"]+"[^>]*>/g, (tag) => {
    const name = /data-fc-panel="([^"]+)"/.exec(tag)[1];
    if (name === defaultTab) return tag.replace(/\shidden(?=[\s>])/, '');
    return /\shidden(?=[\s>])/.test(tag) ? tag : tag.replace(/>$/, ' hidden>');
  });
  return out;
}

function renderMainHtml(templates, templateId) {
  let inner = templates[templateId];
  if (inner === undefined) {
    throw new Error(`No <template id="${templateId}"> in source document`);
  }
  inner = expandToolEmbeds(inner, templates);
  const defMatch = /data-fc-default="([^"]+)"/.exec(inner);
  if (defMatch) inner = applyFcDefault(inner, defMatch[1]);
  return inner;
}

function renderForRoute(sourceHtml, route, meta, templates) {
  templates = templates || extractTemplates(sourceHtml);

  const mainMatches = sourceHtml.match(/<main id="app"[^>]*><\/main>/g) || [];
  if (mainMatches.length !== 1) {
    throw new Error(`Expected exactly one empty <main id="app"> in source, found ${mainMatches.length}`);
  }

  const canonicalUrl = SITE_ORIGIN + route;
  const title = escapeHtmlText(meta.title);
  const description = escapeHtmlAttr(meta.description);

  let out = sourceHtml;
  out = out.replace(/<html\b/, () => '<html data-prerendered');
  out = out.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${title}</title>`);
  out = out.replace(
    /<meta name="description" content="[^"]*">/,
    () => `<meta name="description" content="${description}">`
  );
  out = out.replace(
    /<link rel="canonical" href="[^"]*">/,
    () => `<link rel="canonical" href="${canonicalUrl}">`
  );
  out = out.replace(
    /<meta property="og:title" content="[^"]*">/,
    () => `<meta property="og:title" content="${escapeHtmlAttr(meta.title)}">`
  );
  out = out.replace(
    /<meta property="og:description" content="[^"]*">/,
    () => `<meta property="og:description" content="${description}">`
  );
  out = out.replace(
    /<meta property="og:url" content="[^"]*">/,
    () => `<meta property="og:url" content="${canonicalUrl}">`
  );
  out = out.replace(
    /<meta name="twitter:title" content="[^"]*">/,
    () => `<meta name="twitter:title" content="${escapeHtmlAttr(meta.title)}">`
  );
  out = out.replace(
    /<meta name="twitter:description" content="[^"]*">/,
    () => `<meta name="twitter:description" content="${description}">`
  );

  const mainHtml = renderMainHtml(templates, meta.template);
  out = out.replace(/(<main id="app"[^>]*>)<\/main>/, (whole, openTag) => openTag + mainHtml + '</main>');
  return out;
}

function routeToFile(route) {
  return route === '/' ? 'index.html' : route.replace(/^\//, '') + '.html';
}

function main() {
  const [, , indexPath, outDir] = process.argv;
  if (!indexPath || !outDir) {
    console.error('Usage: node scripts/prerender-routes.js <path-to-index.html> <outDir>');
    process.exit(1);
  }

  const sourceHtml = fs.readFileSync(indexPath, 'utf8');
  const templates = extractTemplates(sourceHtml);
  let written = 0;

  Object.keys(ROUTES).forEach((route) => {
    const rendered = renderForRoute(sourceHtml, route, ROUTES[route], templates);

    // "/tools/website-health" -> <outDir>/tools/website-health.html
    const destPath = path.join(outDir, routeToFile(route));
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, rendered);
    written += 1;
  });

  console.log(`Prerendered ${written} route(s) into ${outDir}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  SITE_ORIGIN,
  ROUTES,
  escapeHtmlText,
  escapeHtmlAttr,
  extractTemplates,
  expandToolEmbeds,
  applyFcDefault,
  renderMainHtml,
  renderForRoute,
  routeToFile
};
