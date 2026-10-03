import sharp from 'sharp'
import { mkdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Generate height-based variants: a wide panorama displayed with object-fit:
// cover needs enough vertical pixels, even on a narrow viewport.
// The source photographs are deliberately kept unchanged.
const assets = new URL('../src/assets/', import.meta.url)
const output = new URL('hero/', assets)
const photographs = ['bg4.JPG', 'bg2.JPG', 'bg5.jpg', 'bg1.JPG', 'bg3.JPG']
const heights = [960, 1440, 1920]
const quality = 86

await mkdir(output, { recursive: true })

// Process one variant at a time to bound peak memory for the largest panorama.
for (const [index, photograph] of photographs.entries()) {
  const sourcePath = fileURLToPath(new URL(photograph, assets))
  const source = await sharp(sourcePath).metadata()
  const sourceBytes = (await stat(sourcePath)).size

  for (const height of heights) {
    const name = `panorama-${index + 1}-${height}h.webp`
    const destination = fileURLToPath(new URL(name, output))
    const result = await sharp(sourcePath)
      .rotate()
      .resize({ height, withoutEnlargement: true })
      .webp({ quality, effort: 5 })
      .toFile(destination)

    const rgbaMiB = (result.width * result.height * 4) / 1024 ** 2
    const saved = ((1 - result.size / sourceBytes) * 100).toFixed(1)
    console.log(
      `${name}: ${result.width}x${result.height}, ` +
        `${(result.size / 1024).toFixed(0)} KiB, ` +
        `${rgbaMiB.toFixed(1)} MiB decoded RGBA, ${saved}% fewer bytes ` +
        `than ${photograph} (${source.width}x${source.height})`
    )
  }
}
