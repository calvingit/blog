import { Buffer } from 'node:buffer'
import sharp from 'sharp'

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#111827"/>
  <rect x="72" y="168" width="72" height="8" fill="#9ca3af"/>
  <text x="72" y="300" fill="#f9fafb" font-family="Georgia, 'Iowan Old Style', 'Palatino Linotype', Palatino, serif" font-size="92">Calvin</text>
  <text x="72" y="378" fill="#9ca3af" font-family="Georgia, 'Iowan Old Style', Palatino, serif" font-size="36">zhangwen.site</text>
</svg>`

await sharp(Buffer.from(svg)).png().toFile('public/og-image.png')
const meta = await sharp('public/og-image.png').metadata()
if (meta.format !== 'png' || meta.width !== 1200 || meta.height !== 630)
  throw new Error(`Unexpected og image ${meta.format} ${meta.width}x${meta.height}`)
console.log(`public/og-image.png ${meta.width}x${meta.height}`)
