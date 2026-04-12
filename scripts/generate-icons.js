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
// ゲーム内キューブキャラクター(CHARS[0])と同じ描画ロジックをピクセル化

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

  // 角丸矩形の内部判定（ゲーム内 rr() と同じロジック）
  function inRR(x, y, rx, ry, rw, rh, rad) {
    const lx = x - rx, ly = y - ry;
    if (lx < 0 || lx >= rw || ly < 0 || ly >= rh) return false;
    const r2 = Math.min(rad, rw/2, rh/2);
    if (lx < r2 && ly < r2) { const dx=lx-r2,dy=ly-r2; return dx*dx+dy*dy<=r2*r2; }
    if (lx > rw-r2 && ly < r2) { const dx=lx-(rw-r2),dy=ly-r2; return dx*dx+dy*dy<=r2*r2; }
    if (lx < r2 && ly > rh-r2) { const dx=lx-r2,dy=ly-(rh-r2); return dx*dx+dy*dy<=r2*r2; }
    if (lx > rw-r2 && ly > rh-r2) { const dx=lx-(rw-r2),dy=ly-(rh-r2); return dx*dx+dy*dy<=r2*r2; }
    return true;
  }

  function fillRR(rx, ry, rw, rh, rad, r, g, b, a=1) {
    for (let y = Math.floor(ry); y <= Math.ceil(ry+rh); y++) {
      for (let x = Math.floor(rx); x <= Math.ceil(rx+rw); x++) {
        if (inRR(x, y, rx, ry, rw, rh, rad)) {
          if (a >= 1) setPixel(x, y, r, g, b);
          else blendPixel(x, y, r, g, b, a);
        }
      }
    }
  }

  function fillCircle(cx, cy, rad, r, g, b, a=1) {
    for (let y = Math.floor(cy-rad); y <= Math.ceil(cy+rad); y++) {
      for (let x = Math.floor(cx-rad); x <= Math.ceil(cx+rad); x++) {
        const dx=x-cx, dy=y-cy;
        if (dx*dx+dy*dy <= rad*rad) {
          if (a >= 1) setPixel(x, y, r, g, b);
          else blendPixel(x, y, r, g, b, a);
        }
      }
    }
  }

  // ── キャラクターパラメータ ──
  // 背景なし: キューブ外枠(col2)で全面を埋める
  // ゲーム内: drawCharacter(x, y, 0, r, 0, 1, 'normal', 0, false)
  // CHARS[0]: col='#00e5ff', col2='#00b8d4', eye='#fff', pupil='#0a0a2e'
  const r = size / 2; // キャラクターの半径 = アイコン半分いっぱい
  const cx = size / 2;
  const cy = size / 2;

  // ── キューブ本体（ゲームコードそのまま）──
  // 外枠: rr(-r,-r,r*2,r*2,r*0.3) col2 — マージンなしで全面
  const col2 = hexToRgb('#00b8d4');
  // まず全面をcol2で塗る（角なしの正方形アイコンなので縁まで全部キャラクターカラー）
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      setPixel(x, y, col2[0], col2[1], col2[2]);
  // rr の描画（同じだが角丸なので全面と同等）

  // 内側: rr(-r*0.6,-r*0.6,r*1.2,r*1.2,r*0.2) col
  const col = hexToRgb('#00e5ff');
  fillRR(cx-r*0.6, cy-r*0.6, r*1.2, r*1.2, r*0.2, col[0], col[1], col[2]);

  // ハイライト: rr(-r*0.75,-r*0.75,r*1.5,r*1.5,r*0.2) rgba(255,255,255,0.12)
  fillRR(cx-r*0.75, cy-r*0.75, r*1.5, r*1.5, r*0.2, 255, 255, 255, 0.12);

  // ── 目（ゲームコードそのまま: showCosmetics=false, デフォルト目）──
  // eY = face==='normal' → -r*0.15
  // 白目: arc(r*0.2, eY, r*0.28)
  // 瞳: arc(r*0.28, eY, r*0.14)
  // ハイライト: arc(r*0.33, eY-r*0.1, r*0.06)
  const eY = cy + (-r * 0.15);
  const ex = cx + r * 0.2;
  const eyeR = r * 0.28;
  const pupilR = r * 0.14;

  // 白目
  const eyeCol = hexToRgb('#ffffff');
  fillCircle(ex, eY, eyeR, eyeCol[0], eyeCol[1], eyeCol[2]);

  // 瞳
  const pupilCol = hexToRgb('#0a0a2e');
  fillCircle(cx + r*0.28, eY, pupilR, pupilCol[0], pupilCol[1], pupilCol[2]);

  // ハイライト
  fillCircle(cx + r*0.33, eY - r*0.1, r*0.06, 255, 255, 255);

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
