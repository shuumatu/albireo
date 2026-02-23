import sharp from 'sharp'
import { readdirSync, statSync, renameSync, unlinkSync } from 'fs'
import { join, basename } from 'path'

const assetsDir = new URL('../src/assets', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const TARGET_HEIGHT = 2160
const JPEG_QUALITY = 82

const bgFiles = readdirSync(assetsDir)
  .filter(f => /^bg\d+\.(jpg|jpeg)$/i.test(f))
  .map(f => join(assetsDir, f))

for (const filePath of bgFiles) {
  const name = basename(filePath)
  const origSize = statSync(filePath).size
  const meta = await sharp(filePath).metadata()

  let pipeline = sharp(filePath).rotate()

  if (meta.height > TARGET_HEIGHT) {
    pipeline = pipeline.resize(null, TARGET_HEIGHT)
  }

  const tmpPath = filePath + '.tmp.jpg'
  await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toFile(tmpPath)

  const newMeta = await sharp(tmpPath).metadata()
  const newSize = statSync(tmpPath).size
  const savings = ((1 - newSize / origSize) * 100).toFixed(1)

  unlinkSync(filePath)
  renameSync(tmpPath, filePath)

  console.log(
    `${name}: ${meta.width}x${meta.height} (${(origSize / 1e6).toFixed(2)} MB)` +
    ` → ${newMeta.width}x${newMeta.height} (${(newSize / 1e6).toFixed(2)} MB)` +
    ` [${savings}% smaller]`
  )
}

console.log('\nDone!')
