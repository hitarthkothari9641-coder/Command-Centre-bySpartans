#!/usr/bin/env node
/**
 * Brand + icon asset pipeline.
 *
 * Generates every logo/icon derivative the Command Center uses from one master
 * image (ImageMagick `convert` under the hood):
 *
 *   assets/brand/logo-mark.png     256²  crest           sidebar · banner · favicon
 *   assets/brand/logo-mark.jpg     512²  crest @2x        retina
 *   assets/brand/logo-wide.jpg     720×480   key art 1x   hero · splash
 *   assets/brand/logo-hero.jpg     1280×853  key art 2x   hero · splash
 *   assets/brand/logo-square.jpg   640²  centred square   apple-touch / share
 *   assets/brand/logo-source.jpg   full-res master        source of truth
 *
 *   assets/icons/favicon.ico       16/32/48 multi-size   browsers that ask for /favicon.ico
 *   assets/icons/favicon-48.png    48²
 *   assets/icons/icon-192.png      192²  PWA / android
 *   assets/icons/icon-512.png      512²  PWA / android
 *   assets/icons/icon-maskable-512.png  512² with safe-zone padding
 *   assets/icons/og-image.jpg      1200×630 social card (og:image / twitter)
 *
 * Usage:
 *   npm run brand:logo -- ~/Downloads/my-logo.jpg   # normalise + regenerate everything
 *   npm run brand:logo                              # rebuild from logo-source.jpg
 *
 * All crops are forced square with `-resize NxN^ -extent NxN`, so an unusual
 * master aspect ratio can never produce a squashed icon.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = path.join(ROOT, 'assets', 'brand');
const ICONS = path.join(ROOT, 'assets', 'icons');
const MASTER = path.join(BRAND, 'logo-source.jpg');

/* Focal area used for the crest mark (WxH+X+Y on the 1536×1024 master). */
const MARK_CROP = '560x560+440+120';
/* Wider crop (master is 1536×1024, so 1024² is the largest square available). */
const MARK_CROP_WIDE = '1024x1024+256+0';

const input = process.argv[2] ? path.resolve(process.argv[2]) : MASTER;

const run = (...args) => execFileSync('convert', args, { stdio: 'inherit' });

/** Square, stripped, progressive JPEG. */
const squareJpeg = (source, size, out, quality = 88, crop = null) => {
  const args = crop ? [source, '-crop', crop, '+repage'] : [source];
  run(...args, '-resize', `${size}x${size}^`, '-gravity', 'center', '-extent', `${size}x${size}`,
    '-strip', '-interlace', 'Plane', '-quality', String(quality), out);
};

/** Square PNG (lossless crest). */
const squarePng = (source, size, out, crop = null) => {
  const args = crop ? [source, '-crop', crop, '+repage'] : [source];
  run(...args, '-resize', `${size}x${size}^`, '-gravity', 'center', '-extent', `${size}x${size}`, '-strip', out);
};

if (!existsSync(input)) {
  console.error(`✗ Master image not found: ${input}`);
  console.error('  Usage: npm run brand:logo -- /path/to/logo.(png|jpg|jpeg|webp)');
  process.exit(1);
}

mkdirSync(ICONS, { recursive: true });

if (input !== MASTER) {
  // Accept any image format: normalise it into the committed JPEG master.
  run(input, '-quality', '90', MASTER);
  console.log(`• master normalised → assets/brand/logo-source.jpg (${(statSync(MASTER).size / 1024).toFixed(0)} KB)`);
}

console.log('• rendering brand art…');
run(MASTER, '-resize', '1280x', '-strip', '-interlace', 'Plane', '-quality', '78', path.join(BRAND, 'logo-hero.jpg'));
run(MASTER, '-resize', '720x', '-strip', '-interlace', 'Plane', '-quality', '82', path.join(BRAND, 'logo-wide.jpg'));
squareJpeg(MASTER, 640, path.join(BRAND, 'logo-square.jpg'), 82);
squarePng(MASTER, 256, path.join(BRAND, 'logo-mark.png'), MARK_CROP);
squareJpeg(MASTER, 512, path.join(BRAND, 'logo-mark.jpg'), 84, MARK_CROP_WIDE);

console.log('• rendering app icons…');
squareJpeg(MASTER, 512, path.join(ICONS, '__mark-512.png.tmp.jpg'), 92, MARK_CROP_WIDE);
const mark512 = path.join(ICONS, '__mark-512.png.tmp.jpg');
squarePng(mark512, 48, path.join(ICONS, 'favicon-48.png'));
squarePng(mark512, 192, path.join(ICONS, 'icon-192.png'));
squarePng(mark512, 512, path.join(ICONS, 'icon-512.png'));
// Maskable icons need a safe zone: shrink the art into a padded square.
run(mark512, '-resize', '400x400', '-background', '#05070d', '-gravity', 'center',
  '-extent', '512x512', '-strip', '-quality', '92', path.join(ICONS, 'icon-maskable-512.png'));
run(mark512, '-define', 'icon:auto-resize=48,32,16', path.join(ICONS, 'favicon.ico'));
// Social card: 1200×630 centre crop of the key art.
run(MASTER, '-resize', '1200x', '-gravity', 'center', '-crop', '1200x630+0+0', '+repage',
  '-strip', '-interlace', 'Plane', '-quality', '82', path.join(ICONS, 'og-image.jpg'));
execFileSync('rm', ['-f', mark512]);

const files = [
  ['assets/brand/logo-mark.png', 'crest 256²'],
  ['assets/brand/logo-mark.jpg', 'crest 512²'],
  ['assets/brand/logo-wide.jpg', 'key art 720×480'],
  ['assets/brand/logo-hero.jpg', 'key art 1280×853'],
  ['assets/brand/logo-square.jpg', 'square 640²'],
  ['assets/icons/favicon.ico', 'ico 16/32/48'],
  ['assets/icons/favicon-48.png', '48²'],
  ['assets/icons/icon-192.png', '192²'],
  ['assets/icons/icon-512.png', '512²'],
  ['assets/icons/icon-maskable-512.png', '512² maskable'],
  ['assets/icons/og-image.jpg', '1200×630'],
];
for (const [rel, label] of files) {
  const size = statSync(path.join(ROOT, rel)).size / 1024;
  console.log(`  ✓ ${rel.padEnd(38)} ${label.padEnd(18)} ${size.toFixed(0)} KB`);
}
console.log('✓ Brand + icons rebuilt. Hard-refresh (Ctrl/Cmd+Shift+R) to bust cached images.');
