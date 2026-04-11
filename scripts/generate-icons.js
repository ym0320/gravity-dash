/**
 * generate-icons.js
 * App Store用アイコン (1024x1024) とスプラッシュ画像 (1284x2778) を生成する
 * 外部依存なし・Node.js標準のみで動作
 */
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

// ── PNG エンコーダ ────────────────────────────────────────────────

function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeB = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([typeB, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crcBuf]);
}

function adler32(buf) {
  let a = 1, b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function encodeZlib(raw) {
  const BLOCK = 65535;
  const blocks = [];
  for (let i = 0; i < raw.length; i += BLOCK) {
    const chunk = raw.slice(i, Math.min(i + BLOCK, raw.length));
    const isLast = i + BLOCK >= raw.length;
    const hdr = Buffer.alloc(5);
    hdr[0] = isLast ? 1 : 0;
    hdr.writeUInt16LE(chunk.length, 1);
    hdr.writeUInt16LE(~chunk.length & 0xffff, 3);
    blocks.push(hdr, chunk);
  }
  const adlerBuf = Buffer.alloc(4);
  adlerBuf.writeUInt32BE(adler32(raw));
  return Buffer.concat([Buffer.from([0x78, 0x01]), ...blocks, adlerBuf]);
}

/**
 * pixels: Uint8Array or Buffer of length width*height*3 (RGB)
 */
function encodePng(width, height, pixels) {
  const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // RGB
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;

  const rowLen = width * 3;
  const rawData = Buffer.alloc((1 + rowLen) * height);
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + rowLen)] = 0; // filter=None
    pixels.copy(rawData, y * (1 + rowLen) + 1, y * rowLen, (y + 1) * rowLen);
  }

  const IHDR = makeChunk('IHDR', ihdrData);
  const IDAT = makeChunk('IDAT', encodeZlib(rawData));
  const IEND = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([SIGNATURE, IHDR, IDAT, IEND]);
}

// ── 色ユーティリティ ─────────────────────────────────────────────

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// ── アイコン描画 ─────────────────────────────────────────────────
// 背景グラデーション + プレイヤー(円) + プラットフォーム + 星

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 3);

  const top    = hexToRgb('#0a0a2e');
  const mid    = hexToRgb('#1a1a4e');
  const bot    = hexToRgb('#0f0f23');

  function setPixel(x, y, r, g, b) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 3;
    pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b;
  }

  function blendPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 3;
    pixels[i]   = Math.round(pixels[i]   * (1-a) + r * a);
    pixels[i+1] = Math.round(pixels[i+1] * (1-a) + g * a);
    pixels[i+2] = Math.round(pixels[i+2] * (1-a) + b * a);
  }

  // 背景グラデーション
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const c = t < 0.5 ? lerpColor(top, mid, t * 2) : lerpColor(mid, bot, (t - 0.5) * 2);
    for (let x = 0; x < size; x++) setPixel(x, y, c[0], c[1], c[2]);
  }

  const S = size / 256; // スケール係数

  // 星をランダムに配置 (seedベース)
  const stars = [
    [30,20], [80,15], [120,35], [200,10], [230,40], [50,60],
    [170,25], [210,55], [140,45], [90,70], [250,30], [20,80],
    [190,65], [60,90], [240,75], [110,85],
  ];
  for (const [sx, sy] of stars) {
    const x = Math.round(sx * S);
    const y = Math.round(sy * S);
    const br = 180 + Math.floor((sx * 7 + sy * 13) % 75);
    blendPixel(x, y, br, br, br, 0.9);
  }

  // プラットフォーム (床と天井)
  const platColor = hexToRgb('#2a3a6a');
  const platGlow  = hexToRgb('#00e5ff');
  const floorY = Math.round(185 * S);
  const ceilY  = Math.round(70  * S);
  const thick  = Math.max(2, Math.round(6 * S));

  for (let x = 0; x < size; x++) {
    for (let t = 0; t < thick; t++) {
      setPixel(x, floorY + t, platColor[0], platColor[1], platColor[2]);
      setPixel(x, ceilY  + t, platColor[0], platColor[1], platColor[2]);
    }
    // グロー
    blendPixel(x, floorY - 1, platGlow[0], platGlow[1], platGlow[2], 0.4);
    blendPixel(x, ceilY  - 1, platGlow[0], platGlow[1], platGlow[2], 0.4);
  }

  // プレイヤー (グラデーション円)
  const cx = Math.round(128 * S);
  const cy = Math.round(128 * S);
  const R  = Math.round(40  * S);

  const pInner = hexToRgb('#00e5ff');
  const pOuter = hexToRgb('#0066aa');
  const glow   = hexToRgb('#00e5ff');

  for (let y = cy - R - 3; y <= cy + R + 3; y++) {
    for (let x = cx - R - 3; x <= cx + R + 3; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= R) {
        const t = dist / R;
        const c = lerpColor(pInner, pOuter, t);
        setPixel(x, y, c[0], c[1], c[2]);
      } else if (dist <= R + 3) {
        const a = 1 - (dist - R) / 3;
        blendPixel(x, y, glow[0], glow[1], glow[2], a * 0.6);
      }
    }
  }

  // 目 (白い点)
  const eyeR = Math.max(1, Math.round(5 * S));
  for (const [ex, ey] of [[-12, -8], [12, -8]].map(([dx, dy]) => [cx + Math.round(dx*S), cy + Math.round(dy*S)])) {
    for (let dy = -eyeR; dy <= eyeR; dy++) {
      for (let dx = -eyeR; dx <= eyeR; dx++) {
        if (dx*dx + dy*dy <= eyeR*eyeR) setPixel(ex+dx, ey+dy, 240, 240, 255);
      }
    }
  }

  // コイン (黄色い小円)
  const coinPositions = [[175, 128], [195, 118], [215, 128]];
  for (const [ccx, ccy] of coinPositions) {
    const cr = Math.max(1, Math.round(8 * S));
    const ccX = Math.round(ccx * S), ccY = Math.round(ccy * S);
    for (let dy = -cr; dy <= cr; dy++) {
      for (let dx = -cr; dx <= cr; dx++) {
        if (dx*dx + dy*dy <= cr*cr) setPixel(ccX+dx, ccY+dy, 255, 200, 0);
      }
    }
  }

  return pixels;
}

// ── スプラッシュ描画 ─────────────────────────────────────────────

function drawSplash(width, height) {
  const pixels = Buffer.alloc(width * height * 3);

  const top = hexToRgb('#0a0a2e');
  const bot = hexToRgb('#1a1a4e');

  function setPixel(x, y, r, g, b) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = (y * width + x) * 3;
    pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b;
  }

  function blendPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = (y * width + x) * 3;
    pixels[i]   = Math.round(pixels[i]   * (1-a) + r * a);
    pixels[i+1] = Math.round(pixels[i+1] * (1-a) + g * a);
    pixels[i+2] = Math.round(pixels[i+2] * (1-a) + b * a);
  }

  // 背景
  for (let y = 0; y < height; y++) {
    const c = lerpColor(top, bot, y / (height - 1));
    for (let x = 0; x < width; x++) setPixel(x, y, c[0], c[1], c[2]);
  }

  // 中央にプレイヤー円
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const R  = Math.round(Math.min(width, height) * 0.12);

  const pInner = hexToRgb('#00e5ff');
  const pOuter = hexToRgb('#0066aa');
  const glow   = hexToRgb('#00e5ff');

  for (let y = cy - R - 4; y <= cy + R + 4; y++) {
    for (let x = cx - R - 4; x <= cx + R + 4; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= R) {
        const t = dist / R;
        const c = lerpColor(pInner, pOuter, t);
        setPixel(x, y, c[0], c[1], c[2]);
      } else if (dist <= R + 4) {
        const a = 1 - (dist - R) / 4;
        blendPixel(x, y, glow[0], glow[1], glow[2], a * 0.5);
      }
    }
  }

  // 目
  const eyeR = Math.max(1, Math.round(R * 0.12));
  for (const [ex, ey] of [
    [cx - Math.round(R * 0.3), cy - Math.round(R * 0.2)],
    [cx + Math.round(R * 0.3), cy - Math.round(R * 0.2)],
  ]) {
    for (let dy = -eyeR; dy <= eyeR; dy++) {
      for (let dx = -eyeR; dx <= eyeR; dx++) {
        if (dx*dx + dy*dy <= eyeR*eyeR) setPixel(ex+dx, ey+dy, 240, 240, 255);
      }
    }
  }

  return pixels;
}

// ── 出力 ─────────────────────────────────────────────────────────

// App Store用アイコン 1024x1024
{
  const size = 1024;
  const pixels = drawIcon(size);
  const png = encodePng(size, size, pixels);
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), png);
  console.log(`✓ icon.png (${size}x${size})`);
}

// スプラッシュ 1284x2778 (iPhone 14 Pro Max相当)
{
  const w = 1284, h = 2778;
  const pixels = drawSplash(w, h);
  const png = encodePng(w, h, pixels);
  fs.writeFileSync(path.join(assetsDir, 'splash.png'), png);
  console.log(`✓ splash.png (${w}x${h})`);
}

// Androidアダプティブアイコン 1024x1024
{
  const size = 1024;
  const pixels = drawIcon(size);
  const png = encodePng(size, size, pixels);
  fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), png);
  console.log(`✓ adaptive-icon.png (${size}x${size})`);
}

console.log('\n✅ アセット生成完了');
