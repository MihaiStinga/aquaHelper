// Post-processes `expo export --platform web` output for GitHub Pages:
// 1. coi-serviceworker makes the page cross-origin isolated (GitHub Pages
//    cannot send COOP/COEP headers), which expo-sqlite's wasm build needs.
// 2. 404.html = index.html, so deep links like /aquaHelper/parameters work.
// 3. .nojekyll keeps Pages from dropping folders that start with "_".
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
const base = app.experiments?.baseUrl ?? '';
const dist = 'dist';

copyFileSync(require.resolve('coi-serviceworker/coi-serviceworker.min.js'), join(dist, 'coi-serviceworker.js'));

const indexPath = join(dist, 'index.html');
let html = readFileSync(indexPath, 'utf8');
if (!html.includes('coi-serviceworker.js')) {
  html = html.replace('<head>', `<head><script src="${base}/coi-serviceworker.js"></script>`);
}
writeFileSync(indexPath, html);
writeFileSync(join(dist, '404.html'), html);
writeFileSync(join(dist, '.nojekyll'), '');
console.log(`web build ready in ${dist}/ (base ${base || '/'})`);
