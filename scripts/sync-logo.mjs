#!/usr/bin/env node
/**
 * Brand asset pipeline.
 *
 * Generates every logo derivative the Command Center uses from one master
 * image (ImageMagick `convert` under the hood):
 *
 *   assets/brand/logo-mark.png    128×128 crest      — sidebar, banner, favicon
 *   assets/brand/logo-mark.jpg    512×512 crest @2x  — retina
 *   assets/brand/logo-wide.jpg    720×480 artwork    — hero / splash (1x)
 *   assets/brand/logo-hero.jpg    1280×853 artwork   — hero / splash (2x)
 *   assets/brand/logo-square.jpg  640×640 crop       — apple-touch-icon
 *   assets/brand/logo-source.jpg  the committed master (full-res JPEG)
 *
 * Usage:
 *   npm run brand:logo -- ~/Downloads/my-logo.jpg   # use your own artwork
 *   npm run brand:logo                              # rebuild from logo-source.png
 *
 * The 512×512 mark crop is centred on the eye/crest area — tweak `MARK_CROP`
 * if your artwork puts the focal point elsewhere (WxH+X+Y).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = path.join(ROOT, 'assets', 'brand');
const MASTER = path.join(BRAND, 'logo-source.jpg');
const MARK_CROP = '560x560+440+120'; // focal area used for the crest mark
const MARK_CROP_2X = '1100x1100+880+240';

const input = process.argv[2] ? path.resolve(process.argv[2]) : MASTER;

function convert(...args) {
  execFileSync('convert', args, { stdio: 'inherit' });
}

if (!existsSync(input)) {
  console.error(`✗ Master image not found: ${input}`);
  console.error('  Usage: npm run brand:logo -- /path/to/logo.(png|jpg|jpeg|webp)');
  process.exit(1);
}

if (input !== MASTER) {
  // Accept any image format: normalise it into the committed JPEG master.
  convert(input, '-quality', '90', MASTER);
  console.log(`• master normalised → assets/brand/logo-source.jpg (${(statSync(MASTER).size / 1024).toFixed(0)} KB)`);
}

console.log('• rendering brand derivatives…');
// Progressive JPEGs keep the perceived load fast; the crest also ships as PNG.
convert(MASTER, '-resize', '1280x', '-interlace', 'Plane', '-quality', '78', path.join(BRAND, 'logo-hero.jpg'));
convert(MASTER, '-resize', '720x', '-interlace', 'Plane', '-quality', '82', path.join(BRAND, 'logo-wide.jpg'));
convert(MASTER, '-crop', MARK_CROP, '+repage', '-resize', '256x256', '-strip', path.join(BRAND, 'logo-mark.png'));
convert(MASTER, '-crop', MARK_CROP_2X, '+repage', '-resize', '512x512', '-interlace', 'Plane', '-quality', '84', path.join(BRAND, 'logo-mark.jpg'));
convert(MASTER, '-resize', '640x640^', '-gravity', 'center', '-extent', '640x640', '-interlace', 'Plane', '-quality', '82', path.join(BRAND, 'logo-square.jpg'));

for (const file of ['logo-mark.png', 'logo-mark.jpg', 'logo-wide.jpg', 'logo-hero.jpg', 'logo-square.jpg']) {
  const size = statSync(path.join(BRAND, file)).size / 1024;
  console.log(`  ✓ ${file.padEnd(18)} ${size.toFixed(0)} KB`);
}
console.log('✓ Brand assets rebuilt. Hard-refresh the preview (Ctrl/Cmd+Shift+R) to bust cached images.');
