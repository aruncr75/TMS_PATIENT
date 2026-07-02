import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'

// Pure TS PNG Generator for 192x192 and 512x512 PWA icons
function calcCrc(buf: Buffer): number {
  let c = 0xffffffff
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let curr = n
    for (let k = 0; k < 8; k++) {
      curr = curr & 1 ? 0xedb88320 ^ (curr >>> 1) : curr >>> 1
    }
    table[n] = curr
  }
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function makeChunk(type: string, data: Buffer): Buffer {
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcInput = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(calcCrc(crcInput), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

function generateIconPng(size: number, primaryColor: [number, number, number], iconColor: [number, number, number]): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  // IHDR: 13 bytes
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(size, 0)
  ihdrData.writeUInt32BE(size, 4)
  ihdrData[8] = 8 // bit depth 8
  ihdrData[9] = 2 // Truecolor (RGB)
  ihdrData[10] = 0 // compression method 0
  ihdrData[11] = 0 // filter method 0
  ihdrData[12] = 0 // interlace method 0
  const ihdrChunk = makeChunk('IHDR', ihdrData)

  // Generate pixels (RGB 3 bytes per pixel) + 1 filter byte per scanline
  const rowSize = 1 + size * 3
  const rawData = Buffer.alloc(size * rowSize)

  const center = size / 2
  const borderRadius = size * 0.22

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize
    rawData[rowOffset] = 0 // filter type 0 (None)

    for (let x = 0; x < size; x++) {
      const pixelOffset = rowOffset + 1 + x * 3
      // Check rounded card background vs token symbol
      const dx = Math.abs(x - center)
      const dy = Math.abs(y - center)

      // Rounded rectangle bounds
      const inCorner = dx > center - borderRadius && dy > center - borderRadius
      const cornerDist = Math.hypot(dx - (center - borderRadius), dy - (center - borderRadius))
      const isCard = !inCorner || cornerDist <= borderRadius

      // Token Symbol: "T" shape in center
      const inStem = dx <= size * 0.06 && dy <= size * 0.22 && y >= center - size * 0.1
      const inBar = dx <= size * 0.22 && dy <= size * 0.18 && y <= center - size * 0.1 && y >= center - size * 0.22

      let color = primaryColor
      if (isCard && (inStem || inBar)) {
        color = iconColor
      } else if (!isCard) {
        color = [255, 255, 255] // background outer
      }

      rawData[pixelOffset] = color[0]
      rawData[pixelOffset + 1] = color[1]
      rawData[pixelOffset + 2] = color[2]
    }
  }

  const compressedData = zlib.deflateSync(rawData)
  const idatChunk = makeChunk('IDAT', compressedData)
  const iendChunk = makeChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

const outDir = path.resolve(__dirname, '../public/icons')
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

// Brand blue: #1d4ed8 -> RGB [29, 78, 216]
// Icon white: #ffffff -> RGB [255, 255, 255]
const brandBlue: [number, number, number] = [29, 78, 216]
const white: [number, number, number] = [255, 255, 255]

const png192 = generateIconPng(192, brandBlue, white)
fs.writeFileSync(path.join(outDir, 'icon-192.png'), png192)
console.log(`Generated 192x192 PNG icon (${png192.length} bytes)`)

const png512 = generateIconPng(512, brandBlue, white)
fs.writeFileSync(path.join(outDir, 'icon-512.png'), png512)
console.log(`Generated 512x512 PNG icon (${png512.length} bytes)`)

const png512maskable = generateIconPng(512, brandBlue, white)
fs.writeFileSync(path.join(outDir, 'icon-512-maskable.png'), png512maskable)
console.log(`Generated 512x512 Maskable PNG icon (${png512maskable.length} bytes)`)
