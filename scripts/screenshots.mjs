/**
 * Captures screenshots of every route at 1440x900 and 390x844.
 * Requires a running dev server (defaults to http://localhost:8080).
 * Usage: node scripts/screenshots.mjs [baseUrl]
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || 'http://localhost:8080';
const OUT = join(__dirname, '..', 'screenshots');
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const ROUTES = [
  { path: '/', name: 'dashboard' },
  { path: '/projects', name: 'projects' },
  { path: '/projects?id=demo-proj-1', name: 'project-detail-1plate' },
  { path: '/projects?id=demo-proj-2', name: 'project-detail-4plate' },
  { path: '/kanban', name: 'kanban' },
  { path: '/calendar', name: 'calendar' },
  { path: '/expenses', name: 'expenses' },
  { path: '/filament', name: 'filament' },
  { path: '/customers', name: 'customers' },
  { path: '/import', name: 'import' },
  { path: '/settings', name: 'settings' },
  { path: '/public-quote', name: 'public-quote' },
  { path: '/track/demo-proj-1', name: 'track-order' },
  { path: '/about', name: 'landing' },
];

const THEMES = [
  { name: 'light', themeValue: 'light' },
  { name: 'dark', themeValue: 'dark' },
];

async function run() {
  const browser = await chromium.launch();

  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });

      // Set localStorage values before any navigation
      await context.addInitScript((themeValue) => {
        localStorage.setItem('pt_demo_mode', 'true');
        localStorage.setItem('pt_guest_mode', 'true');
        localStorage.setItem('pt_welcome_dismissed', 'true');
        localStorage.setItem('pt_checklist_dismissed', 'true');
        localStorage.setItem('theme', themeValue);
      }, theme.themeValue);

      const page = await context.newPage();

      // First navigate to root to seed localStorage, then proceed
      await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 }).catch(e => console.error('Root nav error:', e.message));
      // Wait extra time for auth to settle and theme to apply
      await page.waitForTimeout(4000);

      for (const route of ROUTES) {
        const url = `${BASE}${route.path}`;
        try {
          await page.goto(url, { waitUntil: 'load', timeout: 20000 });
          // Wait for spinner to clear and content to appear
          await page.waitForTimeout(3000);
          // Try to wait for visible content (body has children)
          await page.waitForFunction(() => document.body && document.body.children.length > 0, { timeout: 5000 }).catch(() => {});
          const fname = `${theme.name}_${vp.name}_${route.name}.png`;
          await page.screenshot({ path: join(OUT, fname), fullPage: true });
          console.log(`✓ ${fname}`);
        } catch (err) {
          console.error(`✗ ${route.path} @ ${vp.name} [${theme.name}]: ${err.message}`);
        }
      }

      await context.close();
    }
  }

  await browser.close();
  console.log(`\nDone. Screenshots in: ${OUT}`);
}

run().catch(err => { console.error(err); process.exit(1); });
