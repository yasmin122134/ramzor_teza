import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

function crc32(buffer) {
  let crc = ~0
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index]
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function createPng(size, pixelAt) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixelAt(x, y, size)
      const offset = row + 1 + x * 4
      raw[offset] = r
      raw[offset + 1] = g
      raw[offset + 2] = b
      raw[offset + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function blend(base, tint, amount) {
  return [
    Math.round(base[0] + (tint[0] - base[0]) * amount),
    Math.round(base[1] + (tint[1] - base[1]) * amount),
    Math.round(base[2] + (tint[2] - base[2]) * amount),
    255,
  ]
}

function insideRoundRect(x, y, left, top, width, height, radius) {
  const right = left + width
  const bottom = top + height
  if (x < left || y < top || x >= right || y >= bottom) return false
  const limit = Math.min(radius, width / 2, height / 2)
  const centerX = x < left + limit ? left + limit : x > right - limit ? right - limit : x
  const centerY = y < top + limit ? top + limit : y > bottom - limit ? bottom - limit : y
  if (centerX === x && centerY === y) return true
  const dx = x - centerX
  const dy = y - centerY
  return dx * dx + dy * dy <= limit * limit
}

function paint(x, y, size, maskable) {
  const background = [15, 118, 110, 255]
  const scale = maskable ? 0.72 : 0.86
  const width = size * 0.36 * scale
  const height = size * 0.68 * scale
  const left = (size - width) / 2
  const top = (size - height) / 2
  if (!insideRoundRect(x, y, left, top, width, height, width * 0.28)) return background

  const housing = [15, 23, 42, 255]
  const lights = [
    [251, 113, 133],
    [251, 191, 36],
    [52, 211, 153],
  ]
  const centerX = size / 2
  const lampRadius = width * 0.26
  for (let index = 0; index < lights.length; index += 1) {
    const centerY = top + (height * (index + 1)) / 4
    const dx = x - centerX
    const dy = y - centerY
    const distance = Math.hypot(dx, dy)
    if (distance <= lampRadius) {
      const light = lights[index]
      const highlightDistance = Math.hypot(x - (centerX - lampRadius * 0.32), y - (centerY - lampRadius * 0.34))
      if (highlightDistance <= lampRadius * 0.22) return blend(light, [255, 255, 255], 0.75)
      const edge = distance / lampRadius
      if (edge > 0.82) return blend(light, housing, ((edge - 0.82) / 0.18) * 0.35)
      return [...light, 255]
    }
  }
  return housing
}

function sample(x, y, size, maskable) {
  let red = 0
  let green = 0
  let blue = 0
  let alpha = 0
  for (const offsetY of [0.25, 0.75]) {
    for (const offsetX of [0.25, 0.75]) {
      const pixel = paint(x + offsetX, y + offsetY, size, maskable)
      red += pixel[0]
      green += pixel[1]
      blue += pixel[2]
      alpha += pixel[3]
    }
  }
  return [Math.round(red / 4), Math.round(green / 4), Math.round(blue / 4), Math.round(alpha / 4)]
}

const directory = path.resolve('public/icons')
fs.mkdirSync(directory, { recursive: true })
fs.writeFileSync(path.join(directory, 'icon-192.png'), createPng(192, (x, y, size) => sample(x, y, size, false)))
fs.writeFileSync(path.join(directory, 'icon-512.png'), createPng(512, (x, y, size) => sample(x, y, size, false)))
fs.writeFileSync(
  path.join(directory, 'icon-maskable-512.png'),
  createPng(512, (x, y, size) => sample(x, y, size, true)),
)
console.log('icons written')
