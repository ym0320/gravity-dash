'use strict';
// In-place array filter to avoid GC pressure from creating new arrays every frame
function fip(arr,fn){let j=0;for(let i=0;i<arr.length;i++){if(fn(arr[i]))arr[j++]=arr[i];}arr.length=j;}
const MAX_PARTS=150;
const MAX_AMBIENT=50;

// === Adaptive quality: auto-detect low FPS and reduce rendering cost ===
// Mobile Safari/WKWebView is prone to multi-second stalls after upgrading quality,
// so keep iOS low. Android/mobile starts low and can promote if it stays healthy.
const _isRNWebView=!!(window.ReactNativeWebView);
const _isIOSLike=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const _isMobileLike=_isIOSLike||/Android|Mobi/i.test(navigator.userAgent);
let _lowQ=_isRNWebView||_isMobileLike; // true = low quality mode (shadows off, fewer particles)
const _FPS_SAMPLE_N=60;
let _fpsHistory=new Array(_FPS_SAMPLE_N);
let _fpsHistoryPos=0,_fpsHistoryLen=0,_fpsHistorySum=0,_fpsCheckInterval=0,_qualityCooldown=0,_lowQGoodStreak=0,_lowQBadStreak=0,_jankBadStreak=0,_jankIntervalCount=0;
function _updateQuality(dt){
  if(_isIOSLike){_lowQ=true;return;}
  if(dt<=0||dt>500)return;
  const fps=1000/dt;
  const janky=dt>34; // UX hitch: average FPS can stay high while one frame visibly stalls.
  if(janky)_jankIntervalCount++;
  if(_fpsHistoryLen<_FPS_SAMPLE_N){_fpsHistory[_fpsHistoryPos]=fps;_fpsHistorySum+=fps;_fpsHistoryLen++;}
  else{_fpsHistorySum+=fps-_fpsHistory[_fpsHistoryPos];_fpsHistory[_fpsHistoryPos]=fps;}
  _fpsHistoryPos=(_fpsHistoryPos+1)%_FPS_SAMPLE_N;
  if(_qualityCooldown>0)_qualityCooldown--;
  _fpsCheckInterval++;
  if(_fpsCheckInterval>=30){ // check every 30 frames (~0.5s)
    _fpsCheckInterval=0;
    if(_fpsHistoryLen>=20){
      const avg=_fpsHistorySum/_fpsHistoryLen;
      const hadJank=_jankIntervalCount>0;
      _jankIntervalCount=0;
      if(_lowQ){
        _lowQGoodStreak=avg>57&&!hadJank?_lowQGoodStreak+1:0;
        if(_qualityCooldown<=0&&_lowQGoodStreak>=8){_lowQ=false;_qualityCooldown=240;_lowQGoodStreak=0;}
      } else {
        _lowQBadStreak=avg<45?_lowQBadStreak+1:0;
        _jankBadStreak=hadJank?_jankBadStreak+1:0;
        if(_qualityCooldown<=0&&(_lowQBadStreak>=2||_jankBadStreak>=2)){_lowQ=true;_qualityCooldown=240;_lowQBadStreak=0;_jankBadStreak=0;}
      }
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
