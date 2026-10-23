# vineedoesstuff.in

Source for [vineedoesstuff.in](https://vineedoesstuff.in) — Vineet Vishesh's offensive security portfolio: penetration testing and red team work, independent apps, and a set of free tools.

## Free tools

No signup required for any of these:

- **[Website Health Report](https://vineedoesstuff.in/tools/website-health)** — security headers, SSL/TLS, DNS, on-page SEO, and real Lighthouse performance scoring for any public URL, in one report.
- **[Threat Landscape](https://vineedoesstuff.in/threat-landscape)** — a live, deduplicated feed of current cybersecurity threats, aggregated from 6 public sources and cross-checked against CISA's Known Exploited Vulnerabilities (KEV) catalog.
- **[Text Humanizer](https://vineedoesstuff.in/tools/text-humanizer)** — rewrites stiff or AI-sounding drafts into plainer sentences, entirely in the browser; nothing is uploaded.

See the [Free Tools](https://vineedoesstuff.in/free-tools) section for all three together.

## Products

**[TithiPath: Panchang & Kundli](https://vineedoesstuff.in/products)** — an Android app for daily Hindu Panchang, Kundli (birth chart) generation, and Rashifal, covering 37 Indian cities and 9 languages. Currently in Google Play Closed Testing.

## Stack

A static single-page app — no framework, no build step for the app code itself:

- `index.html` / `app.js` / `style.css` — the SPA shell, client-side router, and all page templates.
- GSAP, Lenis, and Splitting.js (loaded from unpkg) for scroll/entrance animation.
- `backend/` — a small Node/Express service (hosted on Render) backing the Website Health Report tool's security-header, SSL, SEO, and DNS checks, and generating the Threat Landscape feed data.
- `scripts/prerender-routes.js` — generates a crawlable, correctly-titled static HTML file per route at deploy time, since GitHub Pages otherwise only serves `index.html` at `/`.
- `.github/workflows/deploy.yml` — builds and deploys to GitHub Pages on every push to `main`; `update-threat-feed.yml` refreshes the Threat Landscape data on a schedule.

## License

All rights reserved — this is a personal portfolio, not an open-source project accepting contributions.
