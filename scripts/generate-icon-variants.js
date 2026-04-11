/**
 * generate-icon-variants.js
 * キューブキャラのアイコン候補を4種類生成する（1024x1024）
 * node scripts/generate-icon-variants.js
 */
const fs = require('fs');
const path = require('path');

const SIZE = 1024;
const HALF = SIZE / 2;
const assetsDir = path.join(__dirname, '..', 'assets');

// ── PNG エンコーダ ────────────────────────────────────────────────
function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function makeChunk(type, data) {
  const typeB = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([typeB, data]); const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crcBuf]);
}
function adler32(buf) {
  let a = 1, b = 0;
  for (let i = 0; i < buf.length; i++) { a = (a + buf[i]) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}
function encodeZlib(raw) {
  const BLOCK = 65535; const blocks = [];
  for (let i = 0; i < raw.length; i += BLOCK) {
    const chunk = raw.slice(i, Math.min(i + BLOCK, raw.length));
    const isLast = i + BLOCK >= raw.length;
    const hdr = Buffer.alloc(5); hdr[0] = isLast ? 1 : 0;
    hdr.writeUInt16LE(chunk.length, 1); hdr.writeUInt16LE(~chunk.length & 0xffff, 3); blocks.push(hdr, chunk);
  }
  const adlerBuf = Buffer.alloc(4); adlerBuf.writeUInt32BE(adler32(raw));
  return Buffer.concat([Buffer.from([0x78, 0x01]), ...blocks, adlerBuf]);
}
function encodePng(width, height, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0); ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; ihdrData[9] = 2;
  const rowLen = width * 3;
  const rawData = Buffer.alloc((1 + rowLen) * height);
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + rowLen)] = 0;
    pixels.copy(rawData, y * (1 + rowLen) + 1, y * rowLen, (y + 1) * rowLen);
  }
  return Buffer.concat([sig, makeChunk('IHDR', ihdrData), makeChunk('IDAT', encodeZlib(rawData)), makeChunk('IEND', Buffer.alloc(0))]);
}

// ── ピクセル操作 ─────────────────────────────────────────────────
function setPixel(px, x, y, r, g, b) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const i = (y * SIZE + x) * 3; px[i] = r; px[i+1] = g; px[i+2] = b;
}
function blendPixel(px, x, y, r, g, b, a) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const i = (y * SIZE + x) * 3;
  px[i]   = Math.round(px[i]   * (1-a) + r * a);
  px[i+1] = Math.round(px[i+1] * (1-a) + g * a);
  px[i+2] = Math.round(px[i+2] * (1-a) + b * a);
}
function getPixel(px, x, y) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return [0,0,0];
  const i = (y * SIZE + x) * 3; return [px[i], px[i+1], px[i+2]];
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#',''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function lerpColor(c1, c2, t) { return [lerp(c1[0],c2[0],t), lerp(c1[1],c2[1],t), lerp(c1[2],c2[2],t)]; }

// ── 描画プリミティブ ──────────────────────────────────────────────
function fillRoundedRect(px, ox, oy, w, h, cr, col, alpha=1) {
  const [r,g,b] = col;
  const x2 = ox+w, y2 = oy+h;
  for (let py = Math.max(0, oy); py < Math.min(SIZE, y2); py++) {
    for (let qx = Math.max(0, ox); qx < Math.min(SIZE, x2); qx++) {
      const lx = qx-ox, ly = py-oy;
      let ok = true;
      if (lx < cr && ly < cr) ok = (lx-cr)**2+(ly-cr)**2 <= cr*cr;
      else if (lx > w-cr && ly < cr) ok = (lx-(w-cr))**2+(ly-cr)**2 <= cr*cr;
      else if (lx < cr && ly > h-cr) ok = (lx-cr)**2+(ly-(h-cr))**2 <= cr*cr;
      else if (lx > w-cr && ly > h-cr) ok = (lx-(w-cr))**2+(ly-(h-cr))**2 <= cr*cr;
      if (ok) blendPixel(px, qx, py, r, g, b, alpha);
    }
  }
}
function fillCircle(px, cx, cy, radius, col, alpha=1) {
  const [r,g,b] = col;
  const r2 = radius*radius, r2e = (radius+1.5)*(radius+1.5);
  for (let y = Math.max(0,cy-radius-2); y < Math.min(SIZE,cy+radius+3); y++) {
    for (let x = Math.max(0,cx-radius-2); x < Math.min(SIZE,cx+radius+3); x++) {
      const d2 = (x-cx)**2+(y-cy)**2;
      if (d2 <= r2) blendPixel(px, x, y, r, g, b, alpha);
      else if (d2 <= r2e) blendPixel(px, x, y, r, g, b, alpha*(1-(Math.sqrt(d2)-radius)/1.5));
    }
  }
}
function drawGlow(px, cx, cy, innerR, outerR, col, maxA) {
  const [r,g,b] = col;
  for (let y = Math.max(0,cy-outerR-1); y < Math.min(SIZE,cy+outerR+2); y++) {
    for (let x = Math.max(0,cx-outerR-1); x < Math.min(SIZE,cx+outerR+2); x++) {
      const dist = Math.sqrt((x-cx)**2+(y-cy)**2);
      if (dist > outerR) continue;
      const t = dist <= innerR ? 1 : 1-(dist-innerR)/(outerR-innerR);
      blendPixel(px, x, y, r, g, b, (maxA/255)*t);
    }
  }
}

// ── キューブキャラ描画 ────────────────────────────────────────────
// ゲームのdrawCharacter('cube')を忠実に再現
function drawCube(px, cx, cy, r, alpha=1) {
  const outer  = hexToRgb('#00b8d4');
  const inner  = hexToRgb('#00e5ff');
  const eyeCol = [255, 255, 255];
  const pupCol = hexToRgb('#0a0a2e');

  // 外側 rounded square
  fillRoundedRect(px, cx-r, cy-r, r*2, r*2, r*0.3, outer, alpha);
  // 内側 rounded square
  fillRoundedRect(px, cx-r*0.6, cy-r*0.6, r*1.2, r*1.2, r*0.2, inner, alpha);
  // ハイライト (白半透明)
  fillRoundedRect(px, cx-r*0.75, cy-r*0.75, r*1.5, r*1.5, r*0.2, [255,255,255], alpha*0.10);

  // アウトライン (細い外枠)
  for (let width = 0; width < Math.max(3, r*0.04); width++) {
    const rw = r + width;
    // 外枠はrounded rectの外周のみblend
    fillRoundedRect(px, cx-rw-1, cy-rw-1, (rw+1)*2, (rw+1)*2, rw*0.3, [0,229,255], alpha*0.15);
  }

  // 目 (ゲームのデフォルト目)
  const eY = cy - r*0.15;
  const ex  = cx + r*0.2;
  const es  = r*0.28;
  fillCircle(px, Math.round(ex), Math.round(eY), Math.round(es), eyeCol, alpha);
  fillCircle(px, Math.round(ex + r*0.08), Math.round(eY), Math.round(es*0.5), pupCol, alpha);
  fillCircle(px, Math.round(ex + r*0.14), Math.round(eY - es*0.2), Math.round(es*0.15), eyeCol, alpha);
}

// ── バリアント生成 ────────────────────────────────────────────────

// A: Classic Space — ダークネイビー宇宙、星、シアングロー
function variantA() {
  console.log('  A: Classic Space...');
  const px = Buffer.alloc(SIZE*SIZE*3);
  const bg1 = hexToRgb('#0a0a2e'), bg2 = hexToRgb('#141450'), bg3 = hexToRgb('#0a0a2e');
  for (let y = 0; y < SIZE; y++) {
    const t = y/SIZE;
    const c = t<0.5 ? lerpColor(bg1,bg2,t*2) : lerpColor(bg2,bg3,(t-0.5)*2);
    for (let x = 0; x < SIZE; x++) setPixel(px, x, y, c[0], c[1], c[2]);
  }
  // 星
  const stars = [
    [80,60,220],[200,40,180],[350,90,240],[600,30,200],[800,70,190],[900,50,230],
    [150,150,160],[480,120,200],[720,100,210],[950,140,170],[50,280,190],[300,200,220],
    [700,180,160],[930,220,200],[120,400,180],[400,350,190],[850,300,210],[30,500,170],
    [650,450,220],[980,380,190],[250,550,160],[550,500,200],[820,520,180],[100,650,210],
    [450,620,170],[780,600,230],[350,750,190],[900,700,160],[200,800,220],[700,780,180],
    [500,880,200],[150,920,170],[820,860,210],[60,750,190],[950,820,160],
  ];
  for (const [sx,sy,br] of stars) {
    blendPixel(px,sx,sy,br,br,br,0.95);
    blendPixel(px,sx+1,sy,br,br,br,0.4);blendPixel(px,sx-1,sy,br,br,br,0.4);
    blendPixel(px,sx,sy+1,br,br,br,0.4);blendPixel(px,sx,sy-1,br,br,br,0.4);
  }
  // 背後グロー
  drawGlow(px, HALF, HALF+30, 0, 380, hexToRgb('#00e5ff'), 35);
  // キューブ
  drawCube(px, HALF, HALF+20, 300);
  return encodePng(SIZE, SIZE, px);
}

// B: Neon Burst — ほぼ黒背景、大きな発光バースト
function variantB() {
  console.log('  B: Neon Burst...');
  const px = Buffer.alloc(SIZE*SIZE*3);
  // ほぼ黒背景
  const bg = hexToRgb('#05050f');
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) setPixel(px, x, y, bg[0], bg[1], bg[2]);
  // 少ない星
  const stars2 = [
    [100,80,240],[300,50,200],[700,60,230],[900,100,210],[50,300,190],[950,250,220],
    [200,700,170],[800,650,200],[400,900,210],[600,850,180],[150,500,190],[850,450,220],
  ];
  for (const [sx,sy,br] of stars2) {
    blendPixel(px,sx,sy,br,br,br,0.9);
    blendPixel(px,sx+1,sy,br,br,br,0.3);blendPixel(px,sx-1,sy,br,br,br,0.3);
  }
  // 超大きなグロー (多層)
  drawGlow(px, HALF, HALF, 0, 500, [0,229,255], 20);
  drawGlow(px, HALF, HALF, 0, 350, [0,229,255], 40);
  drawGlow(px, HALF, HALF, 0, 200, [0,229,255], 60);
  drawGlow(px, HALF, HALF, 0, 100, [100,240,255], 80);
  // キューブ
  drawCube(px, HALF, HALF, 290);
  // 前面グロー (キューブの輝き)
  drawGlow(px, HALF+80, HALF-50, 0, 120, [200,255,255], 15);
  return encodePng(SIZE, SIZE, px);
}

// C: Platform View — ゲームのプラットフォーム（床・天井）が見える構図
function variantC() {
  console.log('  C: Platform View...');
  const px = Buffer.alloc(SIZE*SIZE*3);
  const bg1 = hexToRgb('#08082a'), bg2 = hexToRgb('#0d0d38');
  for (let y = 0; y < SIZE; y++) {
    const t = y/SIZE;
    const c = lerpColor(bg1, bg2, t);
    for (let x = 0; x < SIZE; x++) setPixel(px, x, y, c[0], c[1], c[2]);
  }
  // 星
  const stars3 = [
    [100,200,200],[250,180,180],[600,150,220],[850,200,190],[950,300,170],
    [50,400,200],[400,300,210],[750,350,180],[150,600,190],[700,550,200],
    [900,500,160],[300,700,220],[600,650,170],[850,700,200],[200,850,190],
  ];
  for (const [sx,sy,br] of stars3) {
    blendPixel(px,sx,sy,br,br,br,0.9);
    blendPixel(px,sx+1,sy,br,br,br,0.3);blendPixel(px,sx-1,sy,br,br,br,0.3);
  }
  // 天井プラットフォーム (y=220付近)
  const ceilY = 200, platThick = 28;
  const platCol = hexToRgb('#2a3a6a');
  const glowCol = hexToRgb('#00e5ff');
  for (let x = 0; x < SIZE; x++) {
    for (let t = 0; t < platThick; t++) setPixel(px, x, ceilY+t, platCol[0], platCol[1], platCol[2]);
    blendPixel(px, x, ceilY+platThick, glowCol[0], glowCol[1], glowCol[2], 0.6);
    blendPixel(px, x, ceilY+platThick+1, glowCol[0], glowCol[1], glowCol[2], 0.3);
    blendPixel(px, x, ceilY+platThick+2, glowCol[0], glowCol[1], glowCol[2], 0.1);
    // 天井内側のグロー
    blendPixel(px, x, ceilY-1, glowCol[0], glowCol[1], glowCol[2], 0.3);
    blendPixel(px, x, ceilY-2, glowCol[0], glowCol[1], glowCol[2], 0.1);
  }
  // 床プラットフォーム (y=820付近)
  const floorY = 800;
  for (let x = 0; x < SIZE; x++) {
    blendPixel(px, x, floorY-2, glowCol[0], glowCol[1], glowCol[2], 0.1);
    blendPixel(px, x, floorY-1, glowCol[0], glowCol[1], glowCol[2], 0.3);
    blendPixel(px, x, floorY, glowCol[0], glowCol[1], glowCol[2], 0.6);
    for (let t = 0; t < platThick; t++) setPixel(px, x, floorY+1+t, platCol[0], platCol[1], platCol[2]);
  }
  // キューブ後ろグロー
  const cy = (ceilY + platThick + floorY) / 2;
  drawGlow(px, HALF, cy, 0, 280, hexToRgb('#00e5ff'), 40);
  // モーショントレイル (左に3つのフェードコピー)
  const trailSpacing = 120;
  for (let t = 1; t <= 3; t++) {
    const alpha = 0.15 - t*0.04;
    const tx = HALF - t*trailSpacing;
    drawCube(px, tx, cy, 260 - t*10, alpha);
  }
  // メインキューブ
  drawCube(px, HALF, cy, 270);
  return encodePng(SIZE, SIZE, px);
}

// D: Cosmic Purple — 深い紫・青の宇宙、神秘的な雰囲気
function variantD() {
  console.log('  D: Cosmic Purple...');
  const px = Buffer.alloc(SIZE*SIZE*3);
  // 深い紫→ダークブルーグラデーション (放射状)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dist = Math.sqrt((x-HALF)**2+(y-HALF)**2)/SIZE;
      const t = Math.min(1, dist*1.5);
      const center = hexToRgb('#0d0521');
      const edge   = hexToRgb('#050518');
      const c = lerpColor(center, edge, t);
      setPixel(px, x, y, c[0], c[1], c[2]);
    }
  }
  // 星 (明るめ)
  const stars4 = [
    [70,80,240],[180,50,220],[400,40,250],[650,60,230],[880,80,210],[950,150,240],
    [30,250,200],[300,200,230],[500,180,210],[750,220,240],[980,300,200],
    [60,450,220],[280,400,200],[680,380,230],[930,420,210],[150,600,240],
    [450,580,200],[780,560,220],[950,650,200],[200,750,230],[600,720,210],
    [880,780,240],[100,880,200],[400,850,220],[750,900,210],[300,960,230],
    [700,950,200],[900,940,220],[550,300,215],[820,700,190],[120,700,225],
  ];
  for (const [sx,sy,br] of stars4) {
    const size = (sx*sy)%3===0 ? 2 : 1;
    blendPixel(px,sx,sy,br,br,255,0.95);
    if (size === 2) {
      blendPixel(px,sx+1,sy,br,br,255,0.6);blendPixel(px,sx-1,sy,br,br,255,0.6);
      blendPixel(px,sx,sy+1,br,br,255,0.6);blendPixel(px,sx,sy-1,br,br,255,0.6);
    }
    blendPixel(px,sx+1,sy+1,br,br,255,0.2);blendPixel(px,sx-1,sy-1,br,br,255,0.2);
  }
  // 紫のネビュラ的グロー (大)
  drawGlow(px, HALF-80, HALF+60, 0, 500, hexToRgb('#6b21a8'), 20);
  drawGlow(px, HALF+100, HALF-80, 0, 350, hexToRgb('#1d4ed8'), 25);
  // シアングロー (キューブ中心)
  drawGlow(px, HALF, HALF, 0, 300, hexToRgb('#00e5ff'), 50);
  // キューブ
  drawCube(px, HALF, HALF, 300);
  return encodePng(SIZE, SIZE, px);
}

// ── メイン ───────────────────────────────────────────────────────
console.log('アイコン候補を生成中...');
const variants = [
  { name: 'icon_A_ClassicSpace.png', fn: variantA },
  { name: 'icon_B_NeonBurst.png',    fn: variantB },
  { name: 'icon_C_Platform.png',     fn: variantC },
  { name: 'icon_D_CosmicPurple.png', fn: variantD },
];
for (const { name, fn } of variants) {
  const buf = fn();
  fs.writeFileSync(path.join(assetsDir, name), buf);
  console.log(`  → assets/${name} (${(buf.length/1024).toFixed(0)}KB)`);
}
console.log('\n完了。assets/ フォルダで4種類を確認してください。');
console.log('選んだら: node scripts/apply-icon.js [A|B|C|D]');
