import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ico from 'png-to-ico';

const svgPath = fileURLToPath(new URL('../src/app/icon.svg', import.meta.url));
const svg = sharp(svgPath);

// 512x512 icon.png
await svg.clone().resize(512, 512).png().toFile('src/app/icon.png');
// 180x180 apple-icon.png
await svg.clone().resize(180, 180).png().toFile('src/app/apple-icon.png');
// favicon.ico — bundle 16/32/48 as multi-size ICO
const frames = await Promise.all(
  [16, 32, 48].map((size) => svg.clone().resize(size, size).png().toBuffer()),
);
const icoBuffer = await ico(frames);
await writeFile('src/app/favicon.ico', icoBuffer);

console.log('Icons generated: icon.png (512), apple-icon.png (180), favicon.ico (16/32/48)');
