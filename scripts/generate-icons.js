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
// キューブキャラクターがアイコン全体を占める「顔アップ」デザイン

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 3);

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

  // ── 背景（ダークネイビー）──
  const bgColor = hexToRgb('#06061a');
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      setPixel(x, y, bgColor[0], bgColor[1], bgColor[2]);

  // ── キューブ本体（角丸正方形、アイコンの96%） ──
  const pad = Math.round(size * 0.02);
  const cubeSize = size - pad * 2;
  const cubeX = pad, cubeY = pad;
  const radius = Math.round(size * 0.13); // 角丸半径

  // キューブ本体カラー（上：明るいシアン → 下：深ブルー）
  const cubeTop = hexToRgb('#00d4f0');
  const cubeMid = hexToRgb('#0077cc');
  const cubeBot = hexToRgb('#002266');

  function inRoundedRect(x, y) {
    const lx = x - cubeX, ly = y - cubeY;
    if (lx < 0 || lx >= cubeSize || ly < 0 || ly >= cubeSize) return false;
    // Corner checks
    if (lx < radius && ly < radius) {
      const dx = lx - radius, dy = ly - radius;
      return dx*dx + dy*dy <= radius*radius;
    }
    if (lx > cubeSize - radius && ly < radius) {
      const dx = lx - (cubeSize - radius), dy = ly - radius;
      return dx*dx + dy*dy <= radius*radius;
    }
    if (lx < radius && ly > cubeSize - radius) {
      const dx = lx - radius, dy = ly - (cubeSize - radius);
      return dx*dx + dy*dy <= radius*radius;
    }
    if (lx > cubeSize - radius && ly > cubeSize - radius) {
      const dx = lx - (cubeSize - radius), dy = ly - (cubeSize - radius);
      return dx*dx + dy*dy <= radius*radius;
    }
    return true;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRoundedRect(x, y)) continue;
      const ly = y - cubeY;
      const t = ly / cubeSize;
      // 上部明るめ、中間ミッドブルー、下部暗め
      const c = t < 0.45
        ? lerpColor(cubeTop, cubeMid, t / 0.45)
        : lerpColor(cubeMid, cubeBot, (t - 0.45) / 0.55);
      // 左右端を少し暗くして立体感
      const lx = x - cubeX;
      const edgeFade = Math.min(lx, cubeSize - lx) / (cubeSize * 0.25);
      const fade = Math.max(0.6, Math.min(1.0, edgeFade));
      setPixel(x, y, Math.round(c[0]*fade), Math.round(c[1]*fade), Math.round(c[2]*fade));
    }
  }

  // ── 上端ハイライト（明るいエッジ）──
  const hlColor = hexToRgb('#80f0ff');
  const hlThick = Math.round(size * 0.018);
  for (let y = cubeY; y < cubeY + hlThick; y++) {
    for (let x = cubeX; x < cubeX + cubeSize; x++) {
      if (!inRoundedRect(x, y)) continue;
      const alpha = 1 - (y - cubeY) / hlThick;
      blendPixel(x, y, hlColor[0], hlColor[1], hlColor[2], alpha * 0.55);
    }
  }

  // ── 右端シャドウ（影で立体感）──
  const shadowThick = Math.round(size * 0.035);
  for (let x = cubeX + cubeSize - shadowThick; x < cubeX + cubeSize; x++) {
    for (let y = cubeY; y < cubeY + cubeSize; y++) {
      if (!inRoundedRect(x, y)) continue;
      const alpha = (x - (cubeX + cubeSize - shadowThick)) / shadowThick;
      blendPixel(x, y, 0, 0, 0, alpha * 0.4);
    }
  }

  // ── 内側グロー（キューブ中央を少し明るく）──
  const cx = Math.round(size / 2), cy = Math.round(size * 0.45);
  const glowR = Math.round(size * 0.35);
  for (let y = cy - glowR; y <= cy + glowR; y++) {
    for (let x = cx - glowR; x <= cx + glowR; x++) {
      if (!inRoundedRect(x, y)) continue;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < glowR) {
        const a = (1 - dist / glowR) * 0.18;
        blendPixel(x, y, 200, 240, 255, a);
      }
    }
  }

  // ── 目（白目 + 青い瞳） ──
  const eyeOffsetX = Math.round(size * 0.175);
  const eyeOffsetY = Math.round(size * -0.05);
  const eyeWhiteR  = Math.round(size * 0.125);
  const pupilR     = Math.round(size * 0.07);
  const pupilShift = Math.round(size * 0.025);

  const eyeCenters = [
    [cx - eyeOffsetX, cy + eyeOffsetY],
    [cx + eyeOffsetX, cy + eyeOffsetY],
  ];

  for (const [ex, ey] of eyeCenters) {
    // 白目
    for (let dy = -eyeWhiteR; dy <= eyeWhiteR; dy++) {
      for (let dx = -eyeWhiteR; dx <= eyeWhiteR; dx++) {
        if (dx*dx + dy*dy <= eyeWhiteR*eyeWhiteR) {
          if (inRoundedRect(ex+dx, ey+dy))
            setPixel(ex+dx, ey+dy, 245, 248, 255);
        }
      }
    }
    // 瞳（ダークブルー）
    const px = ex + pupilShift, py = ey + pupilShift;
    for (let dy = -pupilR; dy <= pupilR; dy++) {
      for (let dx = -pupilR; dx <= pupilR; dx++) {
        if (dx*dx + dy*dy <= pupilR*pupilR) {
          if (inRoundedRect(px+dx, py+dy))
            setPixel(px+dx, py+dy, 10, 30, 80);
        }
      }
    }
    // ハイライト（白い小点）
    const hlR = Math.round(eyeWhiteR * 0.22);
    const hlX = ex - Math.round(eyeWhiteR * 0.3);
    const hlY = ey - Math.round(eyeWhiteR * 0.3);
    for (let dy = -hlR; dy <= hlR; dy++) {
      for (let dx = -hlR; dx <= hlR; dx++) {
        if (dx*dx + dy*dy <= hlR*hlR) {
          if (inRoundedRect(hlX+dx, hlY+dy))
            setPixel(hlX+dx, hlY+dy, 255, 255, 255);
        }
      }
    }
  }

  // ── 口（小さい弧）──
  const mouthY = cy + Math.round(size * 0.18);
  const mouthW = Math.round(size * 0.18);
  const mouthH = Math.round(size * 0.07);
  const mouthThick = Math.max(2, Math.round(size * 0.022));
  for (let t = 0; t <= 100; t++) {
    const angle = Math.PI * t / 100; // 0 to PI (bottom arc)
    const mx = Math.round(cx + Math.cos(angle) * mouthW * -1); // mirror for smile
    const my = Math.round(mouthY - Math.sin(angle) * mouthH);
    for (let tt = -mouthThick; tt <= mouthThick; tt++) {
      for (let tw = -mouthThick; tw <= mouthThick; tw++) {
        if (tt*tt + tw*tw <= mouthThick*mouthThick)
          if (inRoundedRect(mx+tw, my+tt))
            setPixel(mx+tw, my+tt, 20, 50, 120);
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
