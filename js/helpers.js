'use strict';
// In-place array filter to avoid GC pressure from creating new arrays every frame
function fip(arr,fn){let j=0;for(let i=0;i<arr.length;i++){if(fn(arr[i]))arr[j++]=arr[i];}arr.length=j;}
const MAX_PARTS=150;
const MAX_AMBIENT=50;

// === Adaptive quality: auto-detect low FPS and reduce rendering cost ===
// In React Native WebView, start in low quality mode immediately
let _lowQ=!!(window.ReactNativeWebView); // true = low quality mode (shadows off, fewer particles)
let _fpsHistory=[];
let _fpsCheckInterval=0;
function _updateQuality(dt){
  if(dt<=0||dt>500)return;
  const fps=1000/dt;
  _fpsHistory.push(fps);
  if(_fpsHistory.length>60)_fpsHistory.shift();
  _fpsCheckInterval++;
  if(_fpsCheckInterval>=30){ // check every 30 frames (~0.5s)
    _fpsCheckInterval=0;
    if(_fpsHistory.length>=20){
      const avg=_fpsHistory.reduce((a,b)=>a+b,0)/_fpsHistory.length;
      if(!_lowQ&&avg<42) _lowQ=true;   // drop to low quality
      else if(_lowQ&&avg>55) _lowQ=false; // recover to normal quality
    }
  }
}
// Shadow helper: skip shadowBlur in low quality mode
function _shadow(blur,color){
  if(_lowQ){ctx.shadowBlur=0;return;}
  if(color)ctx.shadowColor=color;
  ctx.shadowBlur=blur;
}
function emitParts(x,y,n,col,szMax,spdMax){
  const count=_lowQ?Math.ceil(n/2):n;
  for(let i=0;i<count;i++){
    const a=(6.28/count)*i;
    if(parts.length>=MAX_PARTS)break;
    parts.push({x,y,vx:Math.cos(a)*(1+Math.random()*spdMax),vy:Math.sin(a)*(1+Math.random()*spdMax),life:15+Math.random()*15,ml:30,sz:Math.random()*szMax+1,col});
  }
}

// ===== INPUT =====