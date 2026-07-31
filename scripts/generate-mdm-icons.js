import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * Creates an app icon PNG with dark theme background (#09090b)
 * and a 75%-scale centered graphic with generous 15-20% margin/padding safe area around it.
 */
function createMDMPNG(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type (RGB)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  
  const ihdrChunk = createChunk('IHDR', ihdr);
  const scanlineLength = 1 + width * 3;
  const rawData = Buffer.alloc(height * scanlineLength);
  
  const cx = width / 2;
  const cy = height / 2;

  // Graphic scale factor: 75% size (0.75 * 0.4 = 0.30 radius relative to tile width)
  // This leaves a clean 20% margin padding all around the icon graphic inside the app tile!
  const iconSize = width * 0.65; // Total grid block width/height = 65% of tile
  const gridStartX = cx - iconSize / 2;
  const gridStartY = cy - iconSize / 2;
  const cellSize = iconSize / 3;
  const gap = cellSize * 0.18;
  const actualCellSize = cellSize - gap;
  const cellRadius = actualCellSize * 0.3;

  // Colors for the 3x3 grid tiles matching MDM branding
  // Row 0: Yellow, Yellow, Green
  // Row 1: Blue, Yellow, Green
  // Row 2: Blue, Blue, Green
  const tileColors = [
    [ {r: 245, g: 158, b: 11}, {r: 245, g: 158, b: 11}, {r: 34, g: 197, b: 94} ],
    [ {r: 59, g: 130, b: 246}, {r: 245, g: 158, b: 11}, {r: 34, g: 197, b: 94} ],
    [ {r: 59, g: 130, b: 246}, {r: 59, g: 130, b: 246}, {r: 132, g: 204, b: 22} ],
  ];

  for (let y = 0; y < height; y++) {
    const offset = y * scanlineLength;
    rawData[offset] = 0; // Filter type 0
    
    for (let x = 0; x < width; x++) {
      const pxOffset = offset + 1 + x * 3;
      
      // Default app tile background: #09090b (Dark theme matching Vercel & PWA manifest)
      let r = 9;
      let g = 9;
      let b = 11;

      // Check if point (x, y) falls inside any of the 3x3 rounded grid cells
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const cellX = gridStartX + col * cellSize + gap / 2;
          const cellY = gridStartY + row * cellSize + gap / 2;

          if (
            x >= cellX &&
            x <= cellX + actualCellSize &&
            y >= cellY &&
            y <= cellY + actualCellSize
          ) {
            // Check rounded corner distance for smooth rounded square
            const localX = x - cellX;
            const localY = y - cellY;
            
            // Corner centers
            const cornerX = localX < cellRadius ? cellRadius : (localX > actualCellSize - cellRadius ? actualCellSize - cellRadius : localX);
            const cornerY = localY < cellRadius ? cellRadius : (localY > actualCellSize - cellRadius ? actualCellSize - cellRadius : localY);
            
            const dx = localX - cornerX;
            const dy = localY - cornerY;
            
            if (dx * dx + dy * dy <= cellRadius * cellRadius) {
              const color = tileColors[row][col];
              r = color.r;
              g = color.g;
              b = color.b;
            }
          }
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crcBuf]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const iconsDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

// Write all PWA PNG icons with 75% scale factor & 20% safe-area margin
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), createMDMPNG(192, 192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), createMDMPNG(512, 512));
fs.writeFileSync(path.join(iconsDir, 'icon-512-maskable.png'), createMDMPNG(512, 512));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), createMDMPNG(180, 180));
fs.writeFileSync(path.join(iconsDir, 'logo-mdm.png'), createMDMPNG(180, 180));

console.log('Successfully generated PWA icon PNGs with 75% scale and 20% padding!');
