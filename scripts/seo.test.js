const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const SITEMAP = path.join(ROOT, 'sitemap.xml');
const GENERATOR = path.join(ROOT, 'scripts', 'prerender-routes.js');
const prerender = require(GENERATOR);

const sourceHtml = fs.readFileSync(INDEX, 'utf8');
const sitemapXml = fs.readFileSync(SITEMAP, 'utf8');
const sitemapRoutes = [...sitemapXml.matchAll(/<loc>https:\/\/vineedoesstuff\.in(\/[^<]*)<\/loc>/g)]
  .map((m) => m[1]);

function buildSite() {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-prerender-'));
  execFileSync(process.execPath, [GENERATOR, INDEX, outDir], { stdio: 'pipe' });
  return outDir;
}

const outDir = buildSite();

function generatedHtml(route) {
  return fs.readFileSync(path.join(outDir, prerender.routeToFile(route)), 'utf8');
}

function activeMain(html) {
  const m = /<main id="app"[^>]*>([\s\S]*?)<\/main>/.exec(html);
  assert.ok(m, 'generated document must contain <main id="app">');
  return m[1];
}

function metaContent(html, selector) {
  const m = new RegExp(`<meta ${selector} content="([^"]*)"`).exec(html);
  assert.ok(m, `missing meta ${selector}`);
  return m[1];
}

test('generator routes cover exactly the sitemap URLs', () => {
  assert.deepEqual(Object.keys(prerender.ROUTES).sort(), sitemapRoutes.slice().sort());
});

test('every sitemap route renders a substantive main with exactly one H1', () => {
  for (const route of sitemapRoutes) {
    const html = generatedHtml(route);
    assert.match(html, /<html data-prerendered\b/, `${route}: missing data-prerendered`);
    const main = activeMain(html);
    const h1s = main.match(/<h1\b/g) || [];
    assert.equal(h1s.length, 1, `${route}: expected exactly one <h1> in active main, got ${h1s.length}`);
    const text = main.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    assert.ok(text.length > 200, `${route}: active main text too thin (${text.length} chars)`);
  }
});

test('metadata matches expected escaped values per route', () => {
  for (const route of sitemapRoutes) {
    const meta = prerender.ROUTES[route];
    const html = generatedHtml(route);
    const canonicalUrl = prerender.SITE_ORIGIN + route;
    assert.ok(html.includes(`<title>${prerender.escapeHtmlText(meta.title)}</title>`), `${route}: <title>`);
    assert.equal(metaContent(html, 'name="description"'), prerender.escapeHtmlAttr(meta.description), `${route}: description`);
    const canon = /<link rel="canonical" href="([^"]*)"/.exec(html);
    assert.equal(canon && canon[1], canonicalUrl, `${route}: canonical`);
    assert.equal(metaContent(html, 'property="og:title"'), prerender.escapeHtmlAttr(meta.title), `${route}: og:title`);
    assert.equal(metaContent(html, 'property="og:description"'), prerender.escapeHtmlAttr(meta.description), `${route}: og:description`);
    assert.equal(metaContent(html, 'property="og:url"'), canonicalUrl, `${route}: og:url`);
    assert.equal(metaContent(html, 'name="twitter:title"'), prerender.escapeHtmlAttr(meta.title), `${route}: twitter:title`);
    assert.equal(metaContent(html, 'name="twitter:description"'), prerender.escapeHtmlAttr(meta.description), `${route}: twitter:description`);
    assert.match(html, /<meta name="robots" content="index, follow">/, `${route}: robots`);
  }
});

test('active JSON-LD parses and self-references the route', () => {
  for (const route of sitemapRoutes) {
    const main = activeMain(generatedHtml(route));
    const blocks = [...main.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    const canonicalUrl = prerender.SITE_ORIGIN + route;
    for (const b of blocks) {
      const data = JSON.parse(b[1]);
      if (data['@type'] === 'BreadcrumbList') {
        const last = data.itemListElement[data.itemListElement.length - 1];
        assert.equal(last.item, canonicalUrl, `${route}: BreadcrumbList last item`);
      }
      if (data['@type'] === 'SoftwareApplication' || data['@type'] === 'TechArticle') {
        assert.equal(data.url, canonicalUrl, `${route}: ${data['@type']} url`);
      }
    }
  }
});

test('tool routes carry BreadcrumbList and SoftwareApplication JSON-LD', () => {
  const toolRoutes = ['/tools/file-converter', '/tools/merge-pdf', '/tools/pdf-to-text', '/tools/webp-to-png', '/tools/docx-to-pdf', '/tools/website-health', '/tools/text-humanizer'];
  for (const route of toolRoutes) {
    const main = activeMain(generatedHtml(route));
    const types = [...main.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((b) => JSON.parse(b[1])['@type']);
    assert.ok(types.includes('BreadcrumbList'), `${route}: missing BreadcrumbList`);
    assert.ok(types.includes('SoftwareApplication'), `${route}: missing SoftwareApplication`);
  }
});

test('app.js route maps stay in sync with generator and templates', () => {
  const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const pairRe = /'(\/[^']*)':\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g;
  const section = (a, b) => appSrc.slice(appSrc.indexOf(a), appSrc.indexOf(b));
  const parseMap = (src) => {
    const map = {};
    for (const m of src.matchAll(pairRe)) {
      map[m[1]] = m[2].slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
    }
    return map;
  };
  const appTemplates = parseMap(section('var ROUTES = {', 'var ROUTE_TITLES'));
  const appTitles = parseMap(section('var ROUTE_TITLES = {', 'var ROUTE_DESCRIPTIONS'));
  const appDescriptions = parseMap(section('var ROUTE_DESCRIPTIONS = {', 'var app ='));

  assert.equal(appTemplates['/404'], 'page-404');
  delete appTemplates['/404']; delete appTitles['/404']; delete appDescriptions['/404'];

  assert.deepEqual(Object.keys(appTemplates).sort(), Object.keys(prerender.ROUTES).sort());
  for (const [route, meta] of Object.entries(prerender.ROUTES)) {
    assert.equal(appTemplates[route], meta.template, `${route}: ROUTES template mismatch`);
    assert.equal(appTitles[route], meta.title, `${route}: ROUTE_TITLES mismatch`);
    assert.equal(appDescriptions[route], meta.description, `${route}: ROUTE_DESCRIPTIONS mismatch`);
  }

  const templates = prerender.extractTemplates(sourceHtml);
  for (const meta of Object.values(prerender.ROUTES)) {
    assert.ok(templates[meta.template] !== undefined, `missing <template id="${meta.template}">`);
  }
  assert.ok(templates['tool-file-converter-controls'] !== undefined, 'missing shared controls template');
});

test('embedded converter controls produce no duplicate ids in active main', () => {
  const routes = ['/tools/file-converter', '/tools/merge-pdf', '/tools/pdf-to-text', '/tools/webp-to-png', '/tools/docx-to-pdf'];
  for (const route of routes) {
    const main = activeMain(generatedHtml(route));
    assert.ok(!/data-tool-embed/.test(main), `${route}: unexpanded embed slot`);
    const ids = [...main.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(dupes, [], `${route}: duplicate ids ${dupes.join(', ')}`);
    assert.equal((main.match(/id="fcRoot"/g) || []).length, 1, `${route}: expected one #fcRoot`);
    assert.ok(main.includes('JavaScript is required to convert files.'), `${route}: missing noscript converter notice`);
  }
});

test('task pages link the browser-conversion guide and sibling tasks', () => {
  const routes = ['/tools/merge-pdf', '/tools/pdf-to-text', '/tools/webp-to-png', '/tools/docx-to-pdf'];
  for (const route of routes) {
    const main = activeMain(generatedHtml(route));
    assert.ok(main.includes('href="/guides/browser-file-conversion"'), `${route}: missing guide link`);
    assert.ok(main.includes('href="/free-tools"'), `${route}: missing hub link`);
    for (const sibling of routes.filter((r) => r !== route)) {
      assert.ok(main.includes(`href="${sibling}"`), `${route}: missing sibling link ${sibling}`);
    }
  }
});

test('task pages pre-select the right converter tab before JS', () => {
  const expected = {
    '/tools/file-converter': 'image',
    '/tools/merge-pdf': 'merge',
    '/tools/pdf-to-text': 'extract',
    '/tools/webp-to-png': 'image',
    '/tools/docx-to-pdf': 'pdf'
  };
  for (const [route, tab] of Object.entries(expected)) {
    const main = activeMain(generatedHtml(route));
    for (const name of ['image', 'pdf', 'extract', 'merge']) {
      const btn = new RegExp(`<button[^>]*data-fc-tab="${name}"[^>]*>`).exec(main);
      assert.ok(btn, `${route}: missing tab ${name}`);
      const on = name === tab;
      assert.match(btn[0], new RegExp(`aria-selected="${on ? 'true' : 'false'}"`), `${route}: tab ${name} aria-selected`);
      assert.equal(/is-active/.test(btn[0]), on, `${route}: tab ${name} is-active`);
      const panel = new RegExp(`<div[^>]*data-fc-panel="${name}"[^>]*>`).exec(main);
      assert.ok(panel, `${route}: missing panel ${name}`);
      assert.equal(/\shidden/.test(panel[0]), !on, `${route}: panel ${name} hidden`);
    }
  }
});

test('missing templates fail loudly, no homepage fallback', () => {
  const templates = prerender.extractTemplates(sourceHtml);
  assert.throws(
    () => prerender.renderMainHtml(templates, 'page-does-not-exist'),
    /No <template id="page-does-not-exist">/
  );
  assert.throws(
    () => prerender.renderForRoute('<main id="app"></main><main id="app"></main>', '/', prerender.ROUTES['/'], templates),
    /exactly one/
  );
  const broken = { ...templates };
  delete broken['tool-file-converter-controls'];
  assert.throws(
    () => prerender.renderMainHtml(broken, 'page-tool-file-converter'),
    /data-tool-embed="file-converter"/
  );
});

test('404 page is a real noindex not-found page without redirect', () => {
  const html404 = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
  assert.match(html404, /noindex/);
  assert.match(html404, /<title>404/);
  assert.ok(!/location\.(replace|href|assign)/.test(html404), '404.html must not redirect');
  assert.match(html404, /\/free-tools/);
  const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert.match(appSrc, /noindex, follow/);
});

test('noscript and prerendered CSS keep content visible without JS', () => {
  assert.match(sourceHtml, /<noscript><style>[^<]*#siteShell\{opacity:1!important\}[^<]*\.preloader\{display:none!important\}/);
  const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  assert.match(css, /html\[data-prerendered\] #siteShell\s*\{[^}]*opacity:\s*1/);
  assert.match(css, /html\[data-prerendered\] \.preloader\s*\{[^}]*display:\s*none/);
});

function loadServiceWorker(store, fetchImpl) {
  const listeners = {};
  const sandbox = {
    caches: {
      open: async () => ({
        put: async (req, res) => { store.set(typeof req === 'string' ? req : req.url, res); },
        addAll: async () => {}
      }),
      match: async (req) => store.get(typeof req === 'string' ? req : req.url),
      keys: async () => [store.get('__cacheName__')],
      delete: async () => true
    },
    fetch: fetchImpl,
    registration: { scope: 'https://vineedoesstuff.in/' },
    clients: { claim() {} },
    skipWaiting() { return Promise.resolve(); },
    console
  };
  sandbox.self = sandbox;
  sandbox.addEventListener = (type, fn) => { listeners[type] = fn; };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), sandbox);
  return listeners;
}

function navEvent(url) {
  const e = { request: { mode: 'navigate', url } };
  e.respondWith = (p) => { e.result = p; };
  e.waitUntil = () => {};
  return e;
}

function fakeResponse(status) {
  const res = { ok: status >= 200 && status < 300, status };
  res.clone = () => ({ ok: res.ok, status: res.status, __clone: true });
  return res;
}

test('sw: navigation is network-first on the exact URL and caches successes', async () => {
  const store = new Map();
  const seen = [];
  const listeners = loadServiceWorker(store, async (req) => {
    seen.push(req.url);
    return fakeResponse(200);
  });
  const e = navEvent('https://vineedoesstuff.in/tools/merge-pdf');
  listeners.fetch(e);
  const res = await e.result;
  assert.equal(res.status, 200);
  assert.deepEqual(seen, ['https://vineedoesstuff.in/tools/merge-pdf']);
  await new Promise((r) => setImmediate(r));
  assert.ok(store.get('https://vineedoesstuff.in/tools/merge-pdf'), 'route response must be cached by exact request');
});

test('sw: non-OK navigation responses are returned but never cached', async () => {
  const store = new Map();
  const listeners = loadServiceWorker(store, async () => fakeResponse(404));
  const e = navEvent('https://vineedoesstuff.in/bogus');
  listeners.fetch(e);
  const res = await e.result;
  assert.equal(res.status, 404);
  await new Promise((r) => setImmediate(r));
  assert.equal(store.get('https://vineedoesstuff.in/bogus'), undefined);
});

test('sw: offline serves exact cached route, else root shell', async () => {
  const store = new Map();
  const cachedRoute = fakeResponse(200);
  const rootShell = fakeResponse(200);
  store.set('https://vineedoesstuff.in/tools/pdf-to-text', cachedRoute);
  store.set('./index.html', rootShell);
  const listeners = loadServiceWorker(store, async () => { throw new Error('offline'); });

  const e1 = navEvent('https://vineedoesstuff.in/tools/pdf-to-text');
  listeners.fetch(e1);
  assert.equal(await e1.result, cachedRoute, 'exact cached route should win');

  const e2 = navEvent('https://vineedoesstuff.in/tools/docx-to-pdf');
  listeners.fetch(e2);
  assert.equal(await e2.result, rootShell, 'uncached route should fall back to root shell');
});
