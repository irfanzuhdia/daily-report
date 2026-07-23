import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

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
  const squircleRadius = width * 0.44;

  for (let y = 0; y < height; y++) {
    const offset = y * scanlineLength;
    rawData[offset] = 0; // No filter
    
    for (let x = 0; x < width; x++) {
      const pxOffset = offset + 1 + x * 3;
      const nx = (x - cx) / squircleRadius;
      const ny = (y - cy) / squircleRadius;
      
      // Squircle shape |x|^4 + |y|^4 <= 1
      const squircleDist = Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(ny), 4);
      
      if (squircleDist <= 1.0) {
        // Base dark polished theme background
        let r = 15;
        let g = 23;
        let b = 42;

        // Draw stylized MDM geometric 'M' monogram in center
        // Normalized coordinates in [-1, 1] relative to squircle radius
        const mx = (x - cx) / (width * 0.32);
        const my = (y - cy) / (height * 0.32);

        // Left leg of M
        const isLeftLeg = mx >= -0.75 && mx <= -0.45 && my >= -0.55 && my <= 0.55;
        // Right leg of M
        const isRightLeg = mx >= 0.45 && mx <= 0.75 && my >= -0.55 && my <= 0.55;
        // Diagonal left-to-center
        const isLeftDiag = my - (mx + 0.6) * 1.6 >= -0.2 && my - (mx + 0.6) * 1.6 <= 0.2 && mx >= -0.6 && mx <= 0.0 && my <= 0.4;
        // Diagonal center-to-right
        const isRightDiag = my - (-mx + 0.6) * 1.6 >= -0.2 && my - (-mx + 0.6) * 1.6 <= 0.2 && mx >= 0.0 && mx <= 0.6 && my <= 0.4;
        // Middle accent bar (D / M connector)
        const isCenterBadge = (mx >= -0.25 && mx <= 0.25 && my >= 0.1 && my <= 0.5);

        if (isLeftLeg || isRightLeg || isLeftDiag || isRightDiag || isCenterBadge) {
          // Vibrant indigo to cyan gradient for MDM logo
          const gradientFactor = (mx + 1) / 2;
          r = Math.floor(99 + gradientFactor * (59 - 99));    // 99 -> 59
          g = Math.floor(102 + gradientFactor * (130 - 102)); // 102 -> 130
          b = Math.floor(241 + gradientFactor * (246 - 241)); // 241 -> 246
        }

        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
      } else {
        // Transparent / outer background matching theme dark
        rawData[pxOffset] = 9;
        rawData[pxOffset + 1] = 9;
        rawData[pxOffset + 2] = 11;
      }
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

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), createMDMPNG(192, 192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), createMDMPNG(512, 512));
fs.writeFileSync(path.join(iconsDir, 'icon-512-maskable.png'), createMDMPNG(512, 512));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), createMDMPNG(180, 180));

console.log('Successfully generated MDM Logo PNG icons!');
