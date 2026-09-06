import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(root, '../../apps/web/package.json'));
const { chromium } = require('@playwright/test');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1600 }, deviceScaleFactor: 1 });
  for (const lang of ['da', 'en']) {
    for (const device of ['iphone', 'ipad']) {
      for (let i = 1; i <= 6; i++) {
        const file = resolve(root, 'final', lang, device, `${String(i).padStart(2, '0')}.png`);
        const png = readFileSync(file);
        const [width, height] = device === 'iphone' ? [1320, 2868] : [2064, 2752];
        if (png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height || png[25] !== 2) {
          throw new Error(`Wrong dimensions or non-RGB PNG: ${file}`);
        }
      }
    }
    await page.goto(`${pathToFileURL(resolve(root, 'gallery.html'))}?lang=${lang}`);
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
    await page.screenshot({ path: resolve(root, `overview-${lang}.png`), fullPage: true });
  }
  console.log('Validated 24 RGB PNGs and refreshed both overview images.');
} finally {
  await browser.close();
}
