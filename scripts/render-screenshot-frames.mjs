import assert from 'node:assert/strict'
import { copyFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Decorative ImageGen backgrounds are separate from the native screenshots.
// Sharp is already installed with the website's Next.js image pipeline.
const root = new URL('../', import.meta.url)
const asset = (path) => fileURLToPath(new URL(path, root))
const width = 3456
const height = 2304
const screenshotWidth = 3024
const screenshotHeight = 1898
const left = (width - screenshotWidth) / 2
const top = (height - screenshotHeight) / 2
const radius = 20
const rim = 8
const views = ['home', 'sourcecode', 'darkmode', 'ai']
const svg = (body, w = width, h = height) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`)

const mask = svg(
  `<rect width="100%" height="100%" rx="${radius}" fill="white"/>`,
  screenshotWidth,
  screenshotHeight,
)

for (const view of views) {
  const dark = view === 'darkmode'
  const original = asset(`public/screenshot-frames/originals/${view}.png`)
  const background = asset(`public/screenshot-frames/backgrounds/${dark ? 'dark' : 'light'}.png`)
  const output = asset(`apps/web/public/screenshots/${view}.png`)
  const metadata = await sharp(original).metadata()
  assert.equal(metadata.width, screenshotWidth, `${view}: unexpected capture width`)
  assert.equal(metadata.height, screenshotHeight, `${view}: unexpected capture height`)

  const rect = `x="${left - rim}" y="${top - rim}" width="${screenshotWidth + rim * 2}" height="${screenshotHeight + rim * 2}" rx="${radius + rim}"`
  const frame = svg(`
    <defs>
      <filter id="far" x="-20%" y="-20%" width="140%" height="150%">
        <feGaussianBlur stdDeviation="42"/>
      </filter>
      <filter id="near" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="12"/>
      </filter>
    </defs>
    <rect ${rect} transform="translate(0 45)" fill="${dark ? '#020914' : '#112d50'}" opacity="${dark ? 0.5 : 0.22}" filter="url(#far)"/>
    <rect ${rect} transform="translate(0 10)" fill="${dark ? '#020914' : '#112d50'}" opacity="${dark ? 0.3 : 0.13}" filter="url(#near)"/>
    <rect ${rect} fill="${dark ? '#c7ddff' : '#ffffff'}" fill-opacity="${dark ? 0.1 : 0.52}" stroke="${dark ? '#deecff' : '#112d50'}" stroke-opacity="${dark ? 0.24 : 0.13}"/>
  `)
  const screenshot = await sharp(original)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
  await sharp(background)
    .resize(width, height, { fit: 'fill' })
    .composite([{ input: frame }, { input: screenshot, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(output)

  // The document and UI pixels must survive without resampling or repainting.
  const inset = radius + 1
  const crop = {
    left: inset,
    top: inset,
    width: screenshotWidth - inset * 2,
    height: screenshotHeight - inset * 2,
  }
  const originalPixels = await sharp(original).extract(crop).removeAlpha().raw().toBuffer()
  const framedPixels = await sharp(output)
    .extract({ ...crop, left: left + inset, top: top + inset })
    .removeAlpha()
    .raw()
    .toBuffer()
  assert.ok(originalPixels.equals(framedPixels), `${view}: screenshot pixels changed`)
  console.log(`${view}: ${width} × ${height}; original screenshot pixels verified`)
}

await copyFile(asset('apps/web/public/screenshots/home.png'), asset('public/home.png'))
await copyFile(asset('apps/web/public/screenshots/ai.png'), asset('public/copilot.png'))
assert.ok(
  (await readFile(asset('public/home.png'))).equals(
    await readFile(asset('apps/web/public/screenshots/home.png')),
  ),
)
