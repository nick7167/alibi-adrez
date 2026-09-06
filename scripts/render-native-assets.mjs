import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyFileSync, readFileSync } from 'node:fs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'apps/web/package.json'));
const {chromium}=require('@playwright/test');
const catalog=resolve(root,'apps/mobile/ios/App/App/Assets.xcassets');
const browser=await chromium.launch();
try {
 for(const [source,size,destination] of [
  ['aha-app-icon.svg',1024,'AppIcon.appiconset/AppIcon-AHA-1024.png'],
  ['aha-launch.svg',2732,'Splash.imageset/aha-launch-2732.png'],
 ]) {
  const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
  await page.goto(pathToFileURL(resolve(root,'apps/mobile/assets',source)).href);
  const path=resolve(catalog,destination);
  await page.screenshot({path});
  const png=readFileSync(path);
  if(png.readUInt32BE(16)!==size||png.readUInt32BE(20)!==size||png[25]!==2)throw new Error('Native artwork must be correctly sized opaque RGB');
  await page.close();
 }
 for(const suffix of ['2x','3x'])copyFileSync(resolve(catalog,'Splash.imageset/aha-launch-2732.png'),resolve(catalog,`Splash.imageset/aha-launch-2732-${suffix}.png`));
} finally {await browser.close();}
console.log('Native icon and all launch assets rendered and validated.');
