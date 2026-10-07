import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Uses the Sharp/Pango renderer already installed with Next.js. No browser,
// network requests, generated app code, or new packages are needed.
const root = new URL('../', import.meta.url)
const path = (value) => fileURLToPath(new URL(value, root))
const width = 1200
const height = 630
const ink = '#0a2540'
const muted = '#425466'
const blue = '#1f6ae2'
const fontfile = path('apps/web/public/fonts/InterVariable.woff2')
// Match the website's Chinese system-font stack. Set this to the installed
// equivalent when regenerating on Linux or Windows; see public/social/README.md.
const chineseFont = process.env.MF_SOCIAL_CJK_FONT || 'PingFang SC'
const outputDirectory = path('apps/web/public/social')
const svg = (body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`)
const escape = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

// Keep the exact hand-drawn logo and ribbon geometry in their original source.
const wordmark = await readFile(path('apps/web/components/site/BrandWordmark.tsx'), 'utf8')
const strokes = [...wordmark.matchAll(/d: '([^']+)',\s*width: ([\d.]+)/g)]
assert.equal(strokes.length, 6, 'Update the card renderer for the changed brand wordmark')
const ribbon = await readFile(path('apps/web/components/site/Ribbon.tsx'), 'utf8')
const waves = [...ribbon.matchAll(/d='([^']+)'/g)].map((match) => match[1])
assert.equal(waves.length, 2, 'Update the card renderer for the changed ribbon geometry')

const background = svg(`
  <defs>
    <linearGradient id="silk" x1="0" y1="0" x2="1" y2=".8">
      <stop stop-color="#ccf5ff"/><stop offset=".3" stop-color="${blue}"/>
      <stop offset=".7" stop-color="#ab91f5"/><stop offset="1" stop-color="#ccf5ff"/>
    </linearGradient>
    <linearGradient id="mist" x1="1" y1="0" x2="0" y2="1">
      <stop stop-color="#ab91f5"/><stop offset=".5" stop-color="#ccf5ff"/>
      <stop offset="1" stop-color="#6bb5ff"/>
    </linearGradient>
    <linearGradient id="fade">
      <stop offset="0" stop-color="black"/><stop offset=".48" stop-color="black"/>
      <stop offset=".72" stop-color="white"/><stop offset="1" stop-color="white"/>
    </linearGradient>
    <mask id="ribbon-mask"><rect width="1200" height="630" fill="url(#fade)"/></mask>
  </defs>
  <rect width="1200" height="630" fill="white"/>
  <g mask="url(#ribbon-mask)">
    <g transform="translate(410 -36) scale(.77)">
      <path d="${waves[0]}" fill="url(#mist)"/>
      <path d="${waves[1]}" fill="url(#silk)"/>
    </g>
  </g>
  <path d="M72 514 H1128" stroke="#e3e9ef"/>
`)

async function text(text, size, left, top, { color = ink, chinese = false, weight = '' } = {}) {
  const input = await sharp({
    text: {
      text: `<span foreground="${color}">${escape(text)}</span>`,
      font: `${chinese ? chineseFont : 'Inter Variable'} ${weight} ${size}`,
      ...(chinese ? {} : { fontfile }),
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer()
  const metadata = await sharp(input).metadata()
  assert.ok(left + metadata.width <= width - 64, `Text overflows the card: ${text}`)
  return { input, left, top, width: metadata.width }
}

await mkdir(outputDirectory, { recursive: true })
for (const locale of ['en', 'zh']) {
  const chinese = locale === 'zh'
  const brand = await text('Mark', 42, 72, 72, { weight: 'Medium' })
  const logo = svg(`<g transform="translate(${72 + brand.width - 2} 58) scale(.81)"
    fill="none" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round">
    ${strokes.map(([, d, weight]) => `<path d="${d}" stroke-width="${Number(weight) * 1.3}"/>`).join('')}
  </g>`)
  const layers = [
    brand,
    { input: logo, left: 0, top: 0 },
    await text(chinese ? '本地优先，让灵感自由生长' : 'LOCAL FIRST. IDEAS FORWARD.', 16, 72, 179, {
      color: blue,
      chinese,
      weight: 'Medium',
    }),
    await text(chinese ? '让想法流动，' : 'Your ideas,', chinese ? 60 : 76, 68, 232, { chinese }),
    await text(chinese ? '专注每一次写作。' : 'in full flow.', chinese ? 60 : 76, 68, 317, { chinese }),
    await text(chinese ? '本地优先的 Markdown 编辑器。' : 'A local-first Markdown editor.', 26, 72, 423, {
      color: muted,
      chinese,
    }),
    await text('macOS  ·  Windows  ·  Linux', 18, 72, 551, { color: muted }),
    await text('markflowy.cc', 18, 996, 551, { color: ink, weight: 'Medium' }),
  ]
  const destination = path(`apps/web/public/social/markflowy-${locale}.png`)
  const result = await sharp(background)
    .composite(layers.map(({ input, left, top }) => ({ input, left, top })))
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(destination)
  assert.equal(result.width, width)
  assert.equal(result.height, height)
  assert.ok(result.size < 300_000, 'Keep social cards under 300 KB')
  console.log(`${destination}: ${width} × ${height}, ${result.size} bytes`)
}
