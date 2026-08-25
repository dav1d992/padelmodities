// Generates web-sized WebP portraits from the multi-megabyte source PNGs.
// Runs automatically before every build (see the "prebuild" npm script).
import { mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE_DIR = path.join('src', 'app', 'assets');
const OUTPUT_DIR = path.join(SOURCE_DIR, 'optimized');
const QUALITY = 78;

/** Full-size hero portrait, and a thumbnail for the small round avatars. */
const VARIANTS = [
  { suffix: '', width: 1080 },
  { suffix: '-thumb', width: 200 },
];

const files = (await readdir(SOURCE_DIR)).filter((f) => f.endsWith('-padel.png'));
await mkdir(OUTPUT_DIR, { recursive: true });

let converted = 0;
let skipped = 0;
let savedBytes = 0;

for (const file of files) {
  const from = path.join(SOURCE_DIR, file);
  const source = await stat(from);

  for (const { suffix, width } of VARIANTS) {
    const to = path.join(OUTPUT_DIR, file.replace(/\.png$/, `${suffix}.webp`));

    // Skip work when the existing output is already newer than its source.
    if (existsSync(to) && (await stat(to)).mtimeMs >= source.mtimeMs) {
      skipped++;
      continue;
    }

    await sharp(from)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(to);

    savedBytes += source.size - (await stat(to)).size;
    converted++;
  }
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
console.log(
  `[images] ${converted} converted, ${skipped} up to date` +
    (converted ? ` — saved ${mb(savedBytes)}` : ''),
);
