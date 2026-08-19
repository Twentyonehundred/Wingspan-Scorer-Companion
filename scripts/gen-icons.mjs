// Renders the app icon set from a single inline SVG source.
// Run with `npm run icons` after changing the artwork.
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// Warm charcoal tile, terracotta bird — the dark-mode surface and series-3
// step from src/index.css, so the icon and the app agree.
const BG = '#1b1915'
const BODY = '#d2600d'
const WING = '#9c4708'

/** @param {{ bleed: boolean }} opts */
const svg = ({ bleed }) => {
  // Maskable icons get a full-bleed background and a smaller bird so the
  // artwork survives Android's circular crop (safe zone = middle 80%).
  const scale = bleed ? 0.72 : 1
  const radius = bleed ? 0 : 112
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="${radius}" fill="${BG}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="M196 344 L56 408 L68 288 Z" fill="${BODY}"/>
    <ellipse cx="244" cy="302" rx="116" ry="92" transform="rotate(-18 244 302)" fill="${BODY}"/>
    <circle cx="334" cy="206" r="66" fill="${BODY}"/>
    <path d="M392 196 L462 226 L392 250 Z" fill="${BODY}"/>
    <ellipse cx="238" cy="300" rx="80" ry="48" transform="rotate(-28 238 300)" fill="${WING}"/>
    <circle cx="358" cy="192" r="11" fill="${BG}"/>
    <rect x="96" y="418" width="320" height="22" rx="11" fill="${WING}"/>
    <rect x="240" y="380" width="18" height="44" rx="9" fill="${WING}"/>
  </g>
</svg>`
}

await mkdir(publicDir, { recursive: true })

const standard = Buffer.from(svg({ bleed: false }))
const maskable = Buffer.from(svg({ bleed: true }))

await writeFile(join(publicDir, 'favicon.svg'), standard)

const targets = [
  [standard, 'icon-192.png', 192],
  [standard, 'icon-512.png', 512],
  [standard, 'apple-touch-icon.png', 180],
  [maskable, 'icon-maskable-512.png', 512],
]

for (const [src, name, size] of targets) {
  await sharp(src).resize(size, size).png().toFile(join(publicDir, name))
  console.log(`wrote public/${name}`)
}
