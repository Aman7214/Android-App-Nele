import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = resolve(process.argv[2] ?? 'dist');
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

const paths = await files(root);
const bundles = new Map();
let fontBytes = 0, fonts = 0;
for (const path of paths) {
  if (path.endsWith('.js') && path.includes('/static/js/web/')) {
    const data = await readFile(path);
    bundles.set(relative(root, path), { rawBytes: data.length, gzipBytes: gzipSync(data).length });
  }
  if (/\.(ttf|woff2?)$/.test(path)) {
    fonts += 1;
    fontBytes += (await readFile(path)).length;
  }
}
const totals = (sizes) => sizes.reduce((total, size) => ({
  rawBytes: total.rawBytes + size.rawBytes, gzipBytes: total.gzipBytes + size.gzipBytes,
}), { rawBytes: 0, gzipBytes: 0 });
const routes = {};
for (const path of paths.filter((path) => path.endsWith('.html'))) {
  const html = await readFile(path, 'utf8');
  const sources = new Set([...html.matchAll(/(?:src|href)=["']([^"']+\.js)["']/g)]
    .map((match) => new URL(match[1], 'https://export.example.invalid/').pathname.slice(1)));
  const sizes = [...sources].map((source) => bundles.get(source)).filter(Boolean);
  routes[relative(root, path)] = { chunks: sizes.length, ...totals(sizes) };
}
console.log(JSON.stringify({
  output: root, chunks: bundles.size, ...totals([...bundles.values()]), fonts, fontBytes, routes,
}, null, 2));
