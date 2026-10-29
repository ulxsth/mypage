import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const hashes = new Set();
async function inspect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, item.name);
    if (item.isDirectory()) await inspect(file);
    else if (item.name.endsWith('.html')) {
      const html = await readFile(file, 'utf8');
      for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (!/\bsrc\s*=/i.test(match[1]) && match[2].trim()) {
          hashes.add(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
        }
      }
    }
  }
}
await inspect('dist');
const policy = [
  "default-src 'self'",
  `script-src 'self' https://challenges.cloudflare.com ${[...hashes].sort().join(' ')}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "media-src 'self' https://i.imgur.com",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');
await writeFile('dist/_headers', `/*\n  Content-Security-Policy: ${policy}\n  Strict-Transport-Security: max-age=15552000\n  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`);
console.log(`Security headers generated; ${hashes.size} inline script hashes.`);
