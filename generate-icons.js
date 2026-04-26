// generate-icons.js — run once with: node generate-icons.js
const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const SOURCE = path.join(__dirname, 'icons', 'hydraa-logo-splash.png');

// Standard PWA icon sizes
const ICONS = [72, 96, 128, 144, 152, 192, 384, 512];

// iOS splash screen sizes (portrait)
// [width, height, device]
const SPLASH = [
  [640,  1136, 'iphone5'],
  [750,  1334, 'iphone6'],
  [828,  1792, 'iphonexr'],
  [1080, 1920, 'iphone6plus'],
  [1125, 2436, 'iphonex'],
  [1170, 2532, 'iphone12pro'],
  [1284, 2778, 'iphone12promax'],
  [2048, 2732, 'ipadpro'],
];

const BG_COLOR = '#0b1f3a'; // navy — matches manifest background_color

async function run() {
  // ── PNG icons ──
  const iconsDir = path.join(__dirname, 'icons');
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

  for (const size of ICONS) {
    const out = path.join(iconsDir, `icon-${size}.png`);
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 11, g: 31, b: 58, alpha: 1 } })
      .png()
      .toFile(out);
    console.log(`✅ icon-${size}.png`);
  }

  // ── Apple touch icon (180×180) ──
  await sharp(SOURCE)
    .resize(180, 180, { fit: 'contain', background: { r: 11, g: 31, b: 58, alpha: 1 } })
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('✅ apple-touch-icon.png (180×180)');

  // ── iOS splash screens ──
  const splashDir = path.join(__dirname, 'icons', 'splash');
  if (!fs.existsSync(splashDir)) fs.mkdirSync(splashDir);

  // Icon centered on navy background for splash
  const ICON_SIZE = 192; // icon size on splash

  for (const [w, h, name] of SPLASH) {
    // Compose: navy background + centered icon
    const iconPng = await sharp(SOURCE).resize(ICON_SIZE, ICON_SIZE, { fit: 'contain', background: { r: 11, g: 31, b: 58, alpha: 1 } }).png().toBuffer();

    const left = Math.round((w - ICON_SIZE) / 2);
    const top  = Math.round((h - ICON_SIZE) / 2);

    await sharp({
      create: { width: w, height: h, channels: 4,
        background: { r: 11, g: 31, b: 58, alpha: 1 } } // #0b1f3a
    })
    .composite([{ input: iconPng, left, top }])
    .png()
    .toFile(path.join(splashDir, `splash-${name}.png`));
    console.log(`✅ splash-${name}.png (${w}×${h})`);
  }

  console.log('\n🎉 All icons generated in /icons/');
}

run().catch(e => { console.error(e); process.exit(1); });
