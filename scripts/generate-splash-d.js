/**
 * generate-splash-d.js
 * Variant D (Cosmic Purple) のスプラッシュ画像を生成 (1284x2778)
 */
const fs = require('fs');
const path = require('path');

const W = 1284, H = 2778;
const assetsDir = path.join(__dirname, '..', 'assets');

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
function encodePng(w, h, pixels) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w,0); ihdrData.writeUInt32BE(h,4); ihdrData[8]=8; ihdrData[9]=2;
  const rowLen = w*3;
  const rawData = Buffer.alloc((1+rowLen)*h);
  for (let y = 0; y < h; y++) {
    rawData[y*(1+rowLen)] = 0;
    pixels.copy(rawData, y*(1+rowLen)+1, y*rowLen, (y+1)*rowLen);
  }
  return Buffer.concat([sig, makeChunk('IHDR',ihdrData), makeChunk('IDAT',encodeZlib(rawData)), makeChunk('IEND',Buffer.alloc(0))]);
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#',''),16);
  return [(n>>16)&0xff,(n>>8)&0xff,n&0xff];
}
function lerp(a,b,t){return Math.round(a+(b-a)*t);}
function lerpColor(c1,c2,t){return[lerp(c1[0],c2[0],t),lerp(c1[1],c2[1],t),lerp(c1[2],c2[2],t)];}

function setPixel(px,x,y,r,g,b){
  if(x<0||x>=W||y<0||y>=H)return;
  const i=(y*W+x)*3; px[i]=r;px[i+1]=g;px[i+2]=b;
}
function blendPixel(px,x,y,r,g,b,a){
  if(x<0||x>=W||y<0||y>=H)return;
  const i=(y*W+x)*3;
  px[i]=Math.round(px[i]*(1-a)+r*a);
  px[i+1]=Math.round(px[i+1]*(1-a)+g*a);
  px[i+2]=Math.round(px[i+2]*(1-a)+b*a);
}
function fillRoundedRect(px,ox,oy,w,h,cr,col,alpha=1){
  const[r,g,b]=col; const x2=ox+w,y2=oy+h;
  for(let py=Math.max(0,oy);py<Math.min(H,y2);py++){
    for(let qx=Math.max(0,ox);qx<Math.min(W,x2);qx++){
      const lx=qx-ox,ly=py-oy; let ok=true;
      if(lx<cr&&ly<cr) ok=(lx-cr)**2+(ly-cr)**2<=cr*cr;
      else if(lx>w-cr&&ly<cr) ok=(lx-(w-cr))**2+(ly-cr)**2<=cr*cr;
      else if(lx<cr&&ly>h-cr) ok=(lx-cr)**2+(ly-(h-cr))**2<=cr*cr;
      else if(lx>w-cr&&ly>h-cr) ok=(lx-(w-cr))**2+(ly-(h-cr))**2<=cr*cr;
      if(ok) blendPixel(px,qx,py,r,g,b,alpha);
    }
  }
}
function fillCircle(px,cx,cy,radius,col,alpha=1){
  const[r,g,b]=col;
  for(let y=Math.max(0,cy-radius-2);y<Math.min(H,cy+radius+3);y++){
    for(let x=Math.max(0,cx-radius-2);x<Math.min(W,cx+radius+3);x++){
      const d2=(x-cx)**2+(y-cy)**2;
      if(d2<=radius*radius) blendPixel(px,x,y,r,g,b,alpha);
      else if(d2<=(radius+1.5)**2) blendPixel(px,x,y,r,g,b,alpha*(1-(Math.sqrt(d2)-radius)/1.5));
    }
  }
}
function drawGlow(px,cx,cy,innerR,outerR,col,maxA){
  const[r,g,b]=col;
  for(let y=Math.max(0,cy-outerR-1);y<Math.min(H,cy+outerR+2);y++){
    for(let x=Math.max(0,cx-outerR-1);x<Math.min(W,cx+outerR+2);x++){
      const dist=Math.sqrt((x-cx)**2+(y-cy)**2);
      if(dist>outerR)continue;
      const t=dist<=innerR?1:1-(dist-innerR)/(outerR-innerR);
      blendPixel(px,x,y,r,g,b,(maxA/255)*t);
    }
  }
}
function drawCube(px,cx,cy,r,alpha=1){
  const outer=hexToRgb('#00b8d4'), inner=hexToRgb('#00e5ff');
  fillRoundedRect(px,cx-r,cy-r,r*2,r*2,r*0.3,outer,alpha);
  fillRoundedRect(px,cx-r*0.6,cy-r*0.6,r*1.2,r*1.2,r*0.2,inner,alpha);
  fillRoundedRect(px,cx-r*0.75,cy-r*0.75,r*1.5,r*1.5,r*0.2,[255,255,255],alpha*0.10);
  const eY=cy-r*0.15, ex=cx+r*0.2, es=r*0.28;
  fillCircle(px,Math.round(ex),Math.round(eY),Math.round(es),[255,255,255],alpha);
  fillCircle(px,Math.round(ex+r*0.08),Math.round(eY),Math.round(es*0.5),hexToRgb('#0a0a2e'),alpha);
  fillCircle(px,Math.round(ex+r*0.14),Math.round(eY-es*0.2),Math.round(es*0.15),[255,255,255],alpha);
}

console.log('スプラッシュ画像 (Variant D) を生成中...');
const px = Buffer.alloc(W*H*3);
const CX = W/2, CY = H/2;

// 放射状グラデーション背景
for(let y=0;y<H;y++){
  for(let x=0;x<W;x++){
    const dist=Math.sqrt((x-CX)**2+(y-CY)**2)/Math.max(W,H);
    const t=Math.min(1,dist*1.5);
    const c=lerpColor(hexToRgb('#0d0521'),hexToRgb('#050518'),t);
    setPixel(px,x,y,c[0],c[1],c[2]);
  }
}

// 星
const stars=[
  [80,150,240],[250,100,220],[500,80,250],[900,120,230],[1150,160,210],[1220,300,240],
  [40,400,200],[350,350,230],[700,300,210],[1050,380,240],[1250,500,200],[1100,600,220],
  [60,700,240],[300,650,200],[650,600,230],[1000,700,210],[1200,750,240],
  [150,900,200],[450,850,220],[800,820,210],[1100,900,200],[1250,1000,230],
  [80,1100,240],[350,1050,200],[700,1000,220],[950,1100,210],[1180,1150,240],
  [200,1300,200],[500,1250,230],[850,1200,210],[1100,1300,220],[1250,1400,200],
  [50,1500,240],[300,1450,210],[650,1400,230],[950,1500,200],[1200,1550,220],
  [150,1700,200],[450,1650,240],[800,1600,210],[1050,1700,230],[1230,1800,200],
  [80,1900,220],[350,1850,240],[700,1800,200],[1000,1900,210],[1200,1950,230],
  [200,2100,200],[500,2050,220],[850,2000,240],[1100,2100,210],[1250,2200,200],
  [80,2300,230],[350,2250,200],[700,2200,220],[950,2300,240],[1180,2350,210],
  [200,2500,200],[500,2450,230],[800,2400,220],[1050,2500,200],[1220,2600,240],
  [100,2650,220],[400,2620,200],[750,2600,240],[1000,2680,210],[1200,2720,230],
];
for(const[sx,sy,br]of stars){
  const big=(sx*sy)%5===0;
  blendPixel(px,sx,sy,br,br,255,0.95);
  if(big){
    blendPixel(px,sx+1,sy,br,br,255,0.6);blendPixel(px,sx-1,sy,br,br,255,0.6);
    blendPixel(px,sx,sy+1,br,br,255,0.6);blendPixel(px,sx,sy-1,br,br,255,0.6);
  } else {
    blendPixel(px,sx+1,sy,br,br,255,0.3);blendPixel(px,sx-1,sy,br,br,255,0.3);
  }
}

// ネビュラグロー
drawGlow(px,CX-120,CY+100,0,800,hexToRgb('#6b21a8'),18);
drawGlow(px,CX+150,CY-120,0,600,hexToRgb('#1d4ed8'),22);

// キューブ中心グロー
drawGlow(px,CX,CY,0,500,hexToRgb('#00e5ff'),45);

// メインキューブ (スプラッシュは大きめ)
drawCube(px,CX,CY,350);

const buf=encodePng(W,H,px);
fs.writeFileSync(path.join(assetsDir,'splash.png'),buf);
console.log(`完了: assets/splash.png (${(buf.length/1024/1024).toFixed(1)}MB)`);
