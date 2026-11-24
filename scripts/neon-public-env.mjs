import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

const path = new URL('../.env.local', import.meta.url);
const original = await readFile(path, 'utf8');
const env = parseEnv(original);
const aliases = {
  EXPO_PUBLIC_NEON_API_URL: env.NEON_FUNCTION_API_BASE_URL,
  EXPO_PUBLIC_NEON_AUTH_URL: env.NEON_AUTH_BASE_URL,
};

for (const [key, value] of Object.entries(aliases)) {
  if (!value) throw new Error(`Pull the Neon environment before generating ${key}.`);
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search) {
    throw new Error(`Refusing to expose a URL containing credentials in ${key}.`);
  }
}

let updated = original;
for (const [key, value] of Object.entries(aliases)) {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${value}`;
  updated = pattern.test(updated) ? updated.replace(pattern, line) : `${updated.trimEnd()}\n${line}\n`;
}
await writeFile(path, updated);
console.log('Updated the two public Expo service URL aliases; secret values were preserved and not printed.');
