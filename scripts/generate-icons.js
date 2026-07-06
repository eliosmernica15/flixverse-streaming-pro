/**
 * Generate PWA PNG icons from the SVG favicon.
 * Run: node scripts/generate-icons.js
 * Requires: sharp (npm install sharp)
 */

const fs = require("fs");
const path = require("path");

const SIZES = [
  { size: 192, maskable: false },
  { size: 192, maskable: true },
  { size: 512, maskable: false },
  { size: 512, maskable: true },
];

const SVG_PATH = path.join(__dirname, "../public/favicon.svg");
const OUT_DIR = path.join(__dirname, "../public/icons");

async function generate() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.log("sharp not installed. Run: npm install sharp");
    console.log("Falling back to copying SVG as-is...");
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.copyFileSync(SVG_PATH, path.join(OUT_DIR, "icon.svg"));
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const svgBuffer = fs.readFileSync(SVG_PATH);

  for (const { size, maskable } of SIZES) {
    const padding = maskable ? Math.round(size * 0.1) : 0;
    const filename = maskable
      ? `icon-${size}-maskable.png`
      : `icon-${size}.png`;

    await sharp(svgBuffer)
      .resize(size, size)
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      })
      .png()
      .toFile(path.join(OUT_DIR, filename));

    console.log(`Generated ${filename}`);
  }

  console.log("All icons generated!");
}

generate().catch(console.error);
