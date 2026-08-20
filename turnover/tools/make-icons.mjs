/* Generates the PWA icon set from an inline SVG so the whole visual identity
 * lives in source rather than in an opaque binary. Run: npm run icons */
import sharp from 'sharp';

const mark = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#020617"/>
  <g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)">
    <rect x="64" y="64" width="384" height="384" rx="76" fill="#0f172a" stroke="#1e293b" stroke-width="8"/>
    <path d="M150 262l68 68 146-146" fill="none" stroke="#4ade80" stroke-width="46"
          stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'icon-180.png', size: 180, pad: 0 },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.22 }, // safe zone for masking
];

for (const { file, size, pad } of targets) {
  await sharp(Buffer.from(mark(pad))).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
  console.log('  icon →', file, `${size}×${size}`);
}
