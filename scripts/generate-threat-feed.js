// Generates the static threat-feed JSON consumed directly by the frontend
// from GitHub Pages (same-origin, no backend, no CORS) — run on a schedule
// by .github/workflows/update-threat-feed.yml. Reuses the exact same
// aggregation/dedup/ranking logic as backend/threatLandscape.js; nothing is
// duplicated.

const fs = require('fs');
const path = require('path');
const { buildThreatLandscape } = require('../backend/threatLandscape');

(async () => {
  const landscape = await buildThreatLandscape();
  const output = {
    articles: landscape.articles,
    clusters: landscape.clusters,
    top3: landscape.top3,
    sourcesUsed: landscape.sourcesUsed,
    sourceErrors: landscape.sourceErrors,
    rankingMethodology: landscape.rankingMethodology,
    lastUpdated: new Date().toISOString()
  };

  const outDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'threat-feed.json'), JSON.stringify(output, null, 2));

  // eslint-disable-next-line no-console
  console.log(
    `Wrote data/threat-feed.json: ${output.articles.length} articles, ${output.clusters.length} clusters, ` +
    `${output.sourceErrors.length} source errors (${output.sourceErrors.join(', ') || 'none'})`
  );
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to generate threat feed:', err);
  process.exit(1);
});
