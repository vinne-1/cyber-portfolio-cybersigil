# Design Philosophy - Vineet Vishesh Personal Website

## Design Philosophy

### Color Palette
- **Primary**: Deep Navy (#1a1a2e) - Trust, security, professionalism
- **Secondary**: Electric Blue (#00d4ff) - Technology, innovation, cybersecurity
- **Accent**: Warm Copper (#c7702b) - Premium, expertise, warmth
- **Neutral**: Soft Gray (#f8f9fa) - Clean, modern, readable

### Typography
- **Display Font**: "Canela" - Bold serif for headings, conveying authority and sophistication
- **Body Font**: "Suisse Int'l" - Clean sans-serif for readability and modern feel
- **Code Font**: "JetBrains Mono" - Technical elements and code snippets

### Visual Language
- **Cybersecurity Aesthetic**: Clean, professional, tech-forward design
- **Minimalist Approach**: Focus on content with strategic use of negative space
- **Geometric Elements**: Subtle grid patterns and angular shapes suggesting network topology
- **Depth & Dimension**: Subtle shadows and layering for visual hierarchy

## Visual Effects & Styling

### Used Libraries
- **Anime.js**: Smooth animations for UI elements and transitions
- **p5.js**: Interactive background with network visualization
- **ECharts.js**: Professional data visualization for skills and certifications
- **Splide.js**: Smooth carousels for project showcases
- **Pixi.js**: Advanced visual effects for hero section

### Animation & Effects
- **Hero Background**: Animated network nodes with connecting lines
- **Text Animations**: Typewriter effect for key phrases, color cycling emphasis
- **Interactive Elements**: 3D hover transforms, smooth state transitions
- **Scroll Animations**: Progressive disclosure of content with staggered timing
- **Loading States**: Professional loading animations with security-themed graphics

### Header Effect
- **Network Visualization**: Subtle animated background showing interconnected nodes
- **Gradient Overlay**: Deep navy to electric blue gradient with transparency
- **Particle System**: Floating particles suggesting data flow and security monitoring

### Layout Principles
- **Grid-Based**: Consistent 12-column grid system for alignment
- **Responsive Design**: Mobile-first approach with breakpoints at 768px, 1024px, 1440px
- **Content Hierarchy**: Clear visual hierarchy using size, color, and spacing
- **Accessibility**: WCAG 2.1 AA compliance with proper contrast ratios

### Interactive Styling
- **Hover States**: Subtle lift effects with shadow expansion
- **Focus States**: Clear keyboard navigation indicators
- **Active States**: Immediate visual feedback for user interactions
- **Loading States**: Professional skeleton screens and progress indicators

### Professional Elements
- **Security Icons**: Custom iconography for cybersecurity concepts
- **Data Visualization**: Clean charts and graphs with consistent color usage
- **Certificate Displays**: Professional presentation of certifications and credentials
- **Contact Forms**: Secure-themed form design with validation feedback

## Live Cyber News Backend

- Small Node.js + Express service in `backend/server.js`
- Aggregates RSS feeds from:
  - The Hacker News
  - Krebs on Security
  - Dark Reading
  - CSO Online
- Normalizes items into:
  - `title`, `source`, `date`, `summary`, `severity`, `tags`, `url`
- Caches aggregated results in memory for 15 minutes to avoid rate limits
- Exposes `GET /api/cyber-news` used by the front-end

### Running the backend locally

- `cd backend`
- `npm install`
- `npm start` (defaults to `http://localhost:4000`)

Optional environment variables:

- `PORT` – override default port
- `ALLOWED_ORIGIN` – restrict CORS to a specific origin (e.g. `http://localhost:5500`)

## Live Threat Intelligence Front-end Integration

- Home page `index.html` configures:

  ```html
  <script>
      window.LIVE_NEWS_API_URL = 'http://localhost:4000/api/cyber-news';
  </script>
  ```

- `live-threat-intelligence.js`:
  - Always loads simulated data as a safe fallback
  - Calls the backend for live news via `fetchLiveNewsFromBackend()`
  - Updates:
    - Latest cyber news list
    - Search box and per-source filters
    - “Read Original” links to the source article
    - `Last API Check` timestamp using backend `lastUpdated`

If the backend is unreachable, the UI remains functional and clearly shows that simulated data is being used.

## Accessibility & Performance Notes

- Red/dark theme centralized in `red-theme.css`
- Dark mode toggle via `dark-mode.js` (persists with `localStorage`)
- Key UI components:
  - ARIA labels on primary nav
  - Lazy-loaded hero/project images
  - Respect `prefers-reduced-motion` in theme CSS
