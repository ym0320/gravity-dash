'use strict';
const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
let W,H,safeTop=0,safeBot=0;
function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  // Use visualViewport if available and valid, else fallback to innerWidth/Height
  let vw=window.innerWidth,vh=window.innerHeight;
  if(window.visualViewport&&window.visualViewport.width>0&&window.visualViewport.height>0){
    vw=Math.round(window.visualViewport.width);
    vh=Math.round(window.visualViewport.height);
  }
  W=vw||window.innerWidth||390;
  H=vh||window.innerHeight||844;
  // Safe area insets for notch/home bar
  const cs=getComputedStyle(document.documentElement);
  safeTop=parseInt(cs.getPropertyValue('--sat'))||0;
  safeBot=parseInt(cs.getPropertyValue('--sab'))||0;
  if(!safeBot)safeBot=16; // fallback padding for bottom
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
resize();window.addEventListener('resize',resize);
if(window.visualViewport)window.visualViewport.addEventListener('resize',resize);

// ===== CONSTANTS =====
const GRAVITY=0.22;
const JUMP_POWER=8.0;
const PLAYER_R=14;
const GROUND_H=85;
const SPEED_INIT=1.5;
const SPEED_INC=0.0005;
const SPEED_MAX=5.0;
const HP_MAX=3;
const HURT_INVINCIBLE=90; // frames of invincibility after taking damage

// ===== THEMES =====
const THEMES=[
  {bg1:'#0a0a2e',bg2:'#12124a',gnd:'#1e3a5f',gnd2:'#152a45',line:'#2a6aaf',ply:'#00e5ff',obs:'#ff3860',n:'\u30CD\u30AA\u30F3\u30CA\u30A4\u30C8'},
  {bg1:'#1a0a2e',bg2:'#261248',gnd:'#3e1a5f',gnd2:'#2e1248',line:'#6a2aaf',ply:'#a855f7',obs:'#f97316',n:'\u30B3\u30BA\u30DF\u30C3\u30AF'},
  {bg1:'#081e12',bg2:'#12382a',gnd:'#1e5f3a',gnd2:'#154528',line:'#2aaf6a',ply:'#34d399',obs:'#f43f5e',n:'\u30DE\u30C8\u30EA\u30C3\u30AF\u30B9'},
  {bg1:'#2e0a0a',bg2:'#481218',gnd:'#5f1e1e',gnd2:'#451515',line:'#af2a2a',ply:'#fbbf24',obs:'#06b6d4',n:'\u30A4\u30F3\u30D5\u30A7\u30EB\u30CE'},
  {bg1:'#120a20',bg2:'#1e1838',gnd:'#2e2050',gnd2:'#221840',line:'#5a3aaf',ply:'#f472b6',obs:'#4ade80',n:'\u30B5\u30AF\u30E9'},
];
let curTheme=0,prevTheme=0,themeLerp=1;
function lerpColor(a,b,t){
  const p=parseInt,s=(c,i)=>p(c.slice(i,i+2),16);
  return`rgb(${Math.round(s(a,1)+(s(b,1)-s(a,1))*t)},${Math.round(s(a,3)+(s(b,3)-s(a,3))*t)},${Math.round(s(a,5)+(s(b,5)-s(a,5))*t)})`;
}
function tc(k){
  if(isPackMode&&STAGE_THEMES[currentPackIdx]){const st=STAGE_THEMES[currentPackIdx];if(st[k]!==undefined)return st[k];}
  return themeLerp>=1?THEMES[curTheme][k]:lerpColor(THEMES[prevTheme][k],THEMES[curTheme][k],themeLerp);
}
// tc() returns hex (#rrggbb) or rgb(...) during lerp; tca() adds alpha safely
function tca(k,a){const c=tc(k);if(c[0]==='#')return c+(a<16?'0':'')+Math.round(a).toString(16);const m=c.match(/\d+/g);return m?`rgba(${m[0]},${m[1]},${m[2]},${(a/255).toFixed(2)})`:`rgba(0,0,0,${(a/255).toFixed(2)})`;}

// ===== CHARACTERS =====
const CHARS=[
  {name:'\u30AD\u30E5\u30FC\u30D6',shape:'cube',col:'#00e5ff',col2:'#00b8d4',eye:'#fff',pupil:'#0a0a2e',
   trait:'\u30D0\u30E9\u30F3\u30B9\u578B',desc:'\u6A19\u6E96\u7684\u306A\u6027\u80FD',jumpMul:1,speedMul:1,sizeMul:1,gravMul:1,coinMul:1,coinMag:0,maxFlip:2,startShield:false,fastKill:false,price:0},
  {name:'\u30D0\u30A6\u30F3\u30B9',shape:'ball',col:'#ff6b6b',col2:'#e04040',eye:'#fff',pupil:'#2a0a0a',
   trait:'2\u6BB5\u30B8\u30E3\u30F3\u30D7\u578B',desc:'\u5E38\u66422\u6BB5\u30B8\u30E3\u30F3\u30D7',jumpMul:1.0,speedMul:0.95,sizeMul:1.05,gravMul:1,coinMul:1,coinMag:0,maxFlip:2,startShield:false,fastKill:false,hasDjump:true,price:50},
  {name:'\u30BF\u30A4\u30E4',shape:'tire',col:'#555555',col2:'#333333',eye:'#fff',pupil:'#111',
   trait:'\u8D70\u884C\u578B',desc:'\u6BB5\u5DEE\u4E57\u8D8A+\u5C0F\u6E9D\u901A\u904E',jumpMul:0.95,speedMul:1.05,sizeMul:1,gravMul:1,coinMul:1,coinMag:0,maxFlip:2,startShield:false,fastKill:false,price:80},
  {name:'\u30B4\u30FC\u30B9\u30C8',shape:'ghost',col:'#a855f7',col2:'#8b3fe0',eye:'#fff',pupil:'#1a0a30',
   trait:'\u56DE\u907F\u578B',desc:'\u5C0F\u5224\u5B9A+\u900F\u660E\u5316\u56DE\u907F',jumpMul:1,speedMul:1,sizeMul:0.75,gravMul:1,coinMul:1,coinMag:0,maxFlip:2,startShield:true,fastKill:false,price:120},
  {name:'\u30CB\u30F3\u30B8\u30E3',shape:'ninja',col:'#34d399',col2:'#20b878',eye:'#ff4444',pupil:'#000',
   trait:'\u6A5F\u52D5\u578B',desc:'\u9AD8\u901F+3\u56DE\u53CD\u8EE2',jumpMul:1,speedMul:1.12,sizeMul:1,gravMul:1,coinMul:1,coinMag:0,maxFlip:3,startShield:false,fastKill:false,price:150},
  {name:'\u30B9\u30C8\u30FC\u30F3',shape:'stone',col:'#8B8B8B',col2:'#6B6B6B',eye:'#fff',pupil:'#333',
   trait:'\u9632\u5FA1\u578B',desc:'HP+1\u3067\u8010\u4E45\u529B\u2191',jumpMul:0.9,speedMul:0.95,sizeMul:1.15,gravMul:1.1,coinMul:1,coinMag:0,maxFlip:2,startShield:false,fastKill:false,hpBonus:1,price:200},
];
function ct(){return CHARS[selChar];}
function maxHp(){return HP_MAX+(ct().hpBonus||0);}
let selChar=parseInt(localStorage.getItem('gd5char')||'0');
let walletCoins=parseInt(localStorage.getItem('gd5wallet')||'0');
let unlockedChars=JSON.parse(localStorage.getItem('gd5unlocked')||'[0]');
function isCharUnlocked(idx){return unlockedChars.includes(idx);}
// Character unlock celebration state
let unlockCelebT=0,unlockCelebChar=-1;

function buyChar(idx){
  const ch=CHARS[idx];
  if(walletCoins>=ch.price&&!isCharUnlocked(idx)){
    walletCoins-=ch.price;
    unlockedChars.push(idx);
    localStorage.setItem('gd5wallet',walletCoins.toString());
    localStorage.setItem('gd5unlocked',JSON.stringify(unlockedChars));
    selChar=idx;localStorage.setItem('gd5char',selChar.toString());
    // Celebration!
    unlockCelebT=120;unlockCelebChar=idx;
    sfxFanfare();
    vibrate([30,20,30,20,60]);
    return true;
  }
  return false;
}

function sfxFanfare(){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    [523,659,784,1047].forEach((f,i)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sine';
      o.frequency.setValueAtTime(f,t+i*0.1);
      g.gain.setValueAtTime(0.15,t+i*0.1);g.gain.exponentialRampToValueAtTime(0.001,t+i*0.1+0.3);
      o.start(t+i*0.1);o.stop(t+i*0.1+0.35);
    });
    [1047,1319,1568].forEach(f=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='triangle';
      o.frequency.setValueAtTime(f,t+0.45);
      g.gain.setValueAtTime(0.1,t+0.45);g.gain.exponentialRampToValueAtTime(0.001,t+1.0);
      o.start(t+0.45);o.stop(t+1.05);
    });
  }catch(e){}
}
function sfxBossAlert(){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    const drone=audioCtx.createOscillator(),dg=audioCtx.createGain();
    drone.connect(dg);dg.connect(sfxGain);drone.type='sawtooth';
    drone.frequency.setValueAtTime(55,t);drone.frequency.linearRampToValueAtTime(40,t+1.5);
    dg.gain.setValueAtTime(0.2,t);dg.gain.linearRampToValueAtTime(0.3,t+0.8);dg.gain.exponentialRampToValueAtTime(0.001,t+2.0);
    drone.start(t);drone.stop(t+2.1);
    [220,208,196,185,175].forEach((f,i)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='square';
      const st=t+i*0.3;
      o.frequency.setValueAtTime(f,st);
      g.gain.setValueAtTime(0.18,st);g.gain.exponentialRampToValueAtTime(0.001,st+0.25);
      o.start(st);o.stop(st+0.3);
    });
    const sir=audioCtx.createOscillator(),sg=audioCtx.createGain();
    sir.connect(sg);sg.connect(sfxGain);sir.type='sawtooth';
    sir.frequency.setValueAtTime(300,t+0.5);sir.frequency.exponentialRampToValueAtTime(900,t+1.8);
    sg.gain.setValueAtTime(0,t+0.5);sg.gain.linearRampToValueAtTime(0.15,t+0.8);sg.gain.exponentialRampToValueAtTime(0.001,t+2.0);
    sir.start(t+0.5);sir.stop(t+2.1);
    const imp=audioCtx.createOscillator(),ig=audioCtx.createGain();
    imp.connect(ig);ig.connect(sfxGain);imp.type='triangle';
    imp.frequency.setValueAtTime(80,t+1.8);imp.frequency.exponentialRampToValueAtTime(20,t+2.5);
    ig.gain.setValueAtTime(0.25,t+1.8);ig.gain.exponentialRampToValueAtTime(0.001,t+2.5);
    imp.start(t+1.8);imp.stop(t+2.6);
  }catch(e){}
}
// Ensure selChar is unlocked (reset to 0 if not)
if(!isCharUnlocked(selChar)){selChar=0;localStorage.setItem('gd5char','0');}

// ===== AUDIO =====
let audioCtx=null,bgmGain=null,sfxGain=null,bgmCurrent='',bgmTimer=null;
let bgmVol=parseFloat(localStorage.getItem('gd5bgmVol')||'0.7');
let sfxVol=parseFloat(localStorage.getItem('gd5sfxVol')||'0.7');
let settingsOpen=false;
function initAudio(){
  if(audioCtx)return;
  try{audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    bgmGain=audioCtx.createGain();bgmGain.gain.value=0.07*bgmVol;bgmGain.connect(audioCtx.destination);
    sfxGain=audioCtx.createGain();sfxGain.gain.value=sfxVol;sfxGain.connect(audioCtx.destination);
    switchBGM('title');
  }catch(e){}
}
function setBgmVol(v){bgmVol=v;localStorage.setItem('gd5bgmVol',v.toString());if(bgmGain)bgmGain.gain.value=0.07*v;}
function setSfxVol(v){sfxVol=v;localStorage.setItem('gd5sfxVol',v.toString());if(sfxGain)sfxGain.gain.value=v;}

// Helper: create oscillator routed through bgmGain
function bgmOsc(type,freq,t,dur,vol){
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.connect(g);g.connect(bgmGain);o.type=type;
  o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur*0.92);
  o.start(t);o.stop(t+dur);return o;
}
function bgmNoise(t,dur,vol){
  const n=audioCtx.createBufferSource();
  const buf=audioCtx.createBuffer(1,Math.max(1,Math.floor(audioCtx.sampleRate*dur)),audioCtx.sampleRate);
  const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
  n.buffer=buf;const g=audioCtx.createGain();n.connect(g);g.connect(bgmGain);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur*0.9);
  n.start(t);n.stop(t+dur);
}
function bgmKick(t){
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.connect(g);g.connect(bgmGain);o.type='sine';
  o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(35,t+0.1);
  g.gain.setValueAtTime(0.4,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);
  o.start(t);o.stop(t+0.14);
}
function bgmSnare(t){
  bgmNoise(t,0.06,0.18);
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.connect(g);g.connect(bgmGain);o.type='triangle';
  o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(100,t+0.04);
  g.gain.setValueAtTime(0.2,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.06);
  o.start(t);o.stop(t+0.07);
}

// --- Rich BGM Definitions ---
// Each BGM now uses multi-track scheduling per bar (16 steps per bar)
// Title: bright J-pop feel, C-G-Am-F, catchy melody with chord pads
const BGM_TITLE={tempo:155,
  melody:[523,587,659,784, 784,659,587,659, 880,784,659,523, 659,587,523,494,
          523,659,784,1047, 880,784,659,784, 880,1047,880,784, 659,587,523,587],
  harmony:[392,392,494,494, 523,523,494,494, 440,440,523,523, 440,440,392,392,
           392,392,494,494, 523,523,494,494, 440,440,523,523, 440,440,392,392],
  bass:[262,0,262,131, 196,0,196,98, 220,0,220,110, 175,0,175,87,
        262,0,262,131, 196,0,196,98, 220,0,220,110, 175,0,262,131],
  chords:[[523,659,784],[494,587,784],[440,523,659],[349,440,523],
          [523,659,784],[494,587,784],[440,523,659],[349,440,523]],
  melVol:0.25,harmVol:0.1,bassVol:0.2,chordVol:0.06,
  melWave:'triangle',harmWave:'sine',bassWave:'sine',
  drums:'pop'};
// Play: driving electro-pop, Am-F-C-G, pulsing energy
const BGM_PLAY={tempo:140,
  melody:[440,0,523,587, 659,523,440,0, 349,440,523,440, 392,440,523,392,
          440,523,659,784, 659,523,440,523, 587,523,440,349, 440,392,349,392],
  harmony:[330,330,392,392, 349,349,330,330, 262,262,330,330, 247,247,262,262,
           330,330,392,392, 349,349,330,330, 262,262,330,330, 247,247,262,262],
  bass:[220,0,220,110, 175,0,175,87, 262,0,262,131, 196,0,196,98,
        220,0,220,110, 175,0,175,87, 262,0,262,131, 196,0,196,98],
  chords:[[440,523,659],[349,440,523],[523,659,784],[392,494,587],
          [440,523,659],[349,440,523],[523,659,784],[392,494,587]],
  melVol:0.18,harmVol:0.08,bassVol:0.18,chordVol:0.05,
  melWave:'triangle',harmWave:'sine',bassWave:'sine',
  drums:'drive'};
// Dead: emotional ballad, Dm-Bb-Gm-A, slow with reverb feel
const BGM_DEAD={tempo:320,
  melody:[294,330,349,294, 262,294,262,220, 247,262,294,262, 220,247,277,220,
          294,349,330,294, 262,294,220,247, 262,220,196,220, 247,220,196,175],
  harmony:[220,220,262,262, 233,233,220,220, 196,196,220,220, 175,175,220,220,
           220,220,262,262, 233,233,220,220, 196,196,220,220, 175,175,220,220],
  bass:[147,0,147,73, 117,0,117,58, 131,0,131,65, 110,0,110,55,
        147,0,147,73, 117,0,117,58, 131,0,131,65, 110,0,110,55],
  chords:[[294,349,440],[233,294,349],[196,247,294],[220,277,330],
          [294,349,440],[233,294,349],[196,247,294],[220,277,330]],
  melVol:0.16,harmVol:0.08,bassVol:0.12,chordVol:0.05,
  melWave:'sine',harmWave:'sine',bassWave:'sine',
  drums:'none'};
// Fever: intense EDM, high energy, sawtooth lead, heavy drums
const BGM_FEVER={tempo:105,
  melody:[784,880,1047,1175, 1319,1175,1047,880, 988,1047,1175,1319, 1568,1319,1175,1047,
          784,988,1175,1319, 1175,1047,880,1047, 1175,1319,1568,1319, 1175,1047,880,784],
  harmony:[587,587,659,659, 784,784,659,659, 659,659,784,784, 880,880,784,784,
           587,587,659,659, 784,784,659,659, 659,659,784,784, 880,880,784,784],
  bass:[196,0,196,196, 196,0,247,247, 220,0,220,220, 220,0,262,262,
        196,0,196,196, 196,0,247,247, 220,0,220,220, 220,0,196,196],
  chords:[[784,988,1175],[784,988,1175],[880,1047,1319],[880,1047,1319],
          [784,988,1175],[784,988,1175],[880,1047,1319],[880,1047,1319]],
  melVol:0.22,harmVol:0.1,bassVol:0.22,chordVol:0.07,
  melWave:'sawtooth',harmWave:'triangle',bassWave:'triangle',
  drums:'edm'};

function switchBGM(type){
  if(!audioCtx||bgmCurrent===type)return;
  bgmCurrent=type;
  if(bgmTimer){clearTimeout(bgmTimer);bgmTimer=null;}
  const def=type==='title'?BGM_TITLE:type==='play'?BGM_PLAY:type==='fever'?BGM_FEVER:BGM_DEAD;
  const stepMs=60000/(def.tempo*4); // ms per 16th note step
  const stepS=stepMs/1000;
  const totalSteps=def.melody.length;
  let si=0;
  (function play(){
    if(bgmCurrent!==type)return;
    try{
      const now=audioCtx.currentTime;
      const mi=si%totalSteps;
      const chordIdx=Math.floor(mi/4)%def.chords.length;
      // Melody
      if(def.melody[mi]>0)bgmOsc(def.melWave,def.melody[mi],now,stepS*0.85,def.melVol);
      // Harmony (sustained pad-like)
      if(def.harmony[mi]>0&&mi%2===0)bgmOsc(def.harmWave,def.harmony[mi],now,stepS*1.8,def.harmVol);
      // Bass
      if(def.bass[mi]>0)bgmOsc(def.bassWave,def.bass[mi],now,stepS*0.9,def.bassVol);
      // Chord pad (every 4 steps = quarter note)
      if(mi%4===0){
        def.chords[chordIdx].forEach(f=>{
          bgmOsc('sine',f,now,stepS*3.8,def.chordVol);
        });
      }
      // Drums
      if(def.drums==='pop'){
        if(mi%4===0)bgmKick(now); // kick on 1
        if(mi%8===4)bgmSnare(now); // snare on 3
        if(mi%2===0)bgmNoise(now,0.03,0.08); // hi-hat 8ths
        if(mi%4===2)bgmNoise(now,0.015,0.05); // ghost hi-hat
      } else if(def.drums==='drive'){
        if(mi%4===0||mi%8===6)bgmKick(now); // kick on 1 and "and of 3"
        if(mi%8===4)bgmSnare(now);
        bgmNoise(now,0.02,0.06); // 16th hi-hats
      } else if(def.drums==='edm'){
        if(mi%4===0)bgmKick(now);
        if(mi%8===4)bgmSnare(now);
        bgmNoise(now,0.02,mi%2===0?0.1:0.05); // driving 16ths
        if(mi%4===2)bgmKick(now); // double kick
      }
      si++;
    }catch(e){}
    bgmTimer=setTimeout(play,stepMs);
  })();
}
function sfx(type){
  if(!audioCtx)return;try{
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.connect(g);g.connect(sfxGain);const t=audioCtx.currentTime;
    switch(type){
      case'jump':o.type='sine';o.frequency.setValueAtTime(380,t);o.frequency.exponentialRampToValueAtTime(580,t+0.08);g.gain.setValueAtTime(0.08,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.1);o.start(t);o.stop(t+0.1);break;
      case'flip':o.type='sine';o.frequency.setValueAtTime(250,t);o.frequency.exponentialRampToValueAtTime(600,t+0.15);g.gain.setValueAtTime(0.1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.18);o.start(t);o.stop(t+0.18);break;
      case'coin':o.type='sine';o.frequency.setValueAtTime(880,t);o.frequency.exponentialRampToValueAtTime(1320,t+0.05);g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);o.start(t);o.stop(t+0.12);break;
      case'item':o.type='sine';o.frequency.setValueAtTime(400,t);o.frequency.exponentialRampToValueAtTime(1200,t+0.18);g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.25);o.start(t);o.stop(t+0.25);break;
      case'death':o.type='sawtooth';o.frequency.setValueAtTime(300,t);o.frequency.exponentialRampToValueAtTime(40,t+0.45);g.gain.setValueAtTime(0.18,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.5);o.start(t);o.stop(t+0.5);break;
      case'milestone':o.type='sine';o.frequency.setValueAtTime(523,t);g.gain.setValueAtTime(0.1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.4);o.start(t);o.stop(t+0.4);[659,784,1047].forEach((f,i)=>{const x=audioCtx.createOscillator(),y=audioCtx.createGain();x.connect(y);y.connect(sfxGain);x.type='sine';x.frequency.setValueAtTime(f,t+0.1*(i+1));y.gain.setValueAtTime(0.08,t+0.1*(i+1));y.gain.exponentialRampToValueAtTime(0.001,t+0.1*(i+1)+0.25);x.start(t+0.1*(i+1));x.stop(t+0.1*(i+1)+0.25);});break;
      case'combo':o.type='sine';{const cf=Math.min(1200,600+combo*80);o.frequency.setValueAtTime(cf,t);o.frequency.exponentialRampToValueAtTime(cf*1.5,t+0.07);g.gain.setValueAtTime(0.08,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.1);o.start(t);o.stop(t+0.1);}break;
      case'stomp':o.type='square';o.frequency.setValueAtTime(200,t);o.frequency.exponentialRampToValueAtTime(80,t+0.12);g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.15);o.start(t);o.stop(t+0.15);break;
      case'shoot':o.type='sawtooth';o.frequency.setValueAtTime(600,t);o.frequency.exponentialRampToValueAtTime(200,t+0.15);g.gain.setValueAtTime(0.1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.18);o.start(t);o.stop(t+0.18);break;
      case'gstomp':o.type='sine';o.frequency.setValueAtTime(300,t);o.frequency.exponentialRampToValueAtTime(900,t+0.2);g.gain.setValueAtTime(0.15,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.25);o.start(t);o.stop(t+0.25);break;
      case'hurt':o.type='square';o.frequency.setValueAtTime(250,t);o.frequency.exponentialRampToValueAtTime(100,t+0.2);g.gain.setValueAtTime(0.15,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.25);o.start(t);o.stop(t+0.25);break;
      case'heal':o.type='sine';o.frequency.setValueAtTime(523,t);o.frequency.exponentialRampToValueAtTime(1047,t+0.15);g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.35);o.start(t);o.stop(t+0.35);
        [659,784].forEach((f,i)=>{const h=audioCtx.createOscillator(),hg=audioCtx.createGain();h.connect(hg);hg.connect(sfxGain);h.type='triangle';h.frequency.setValueAtTime(f,t+0.05*(i+1));h.frequency.exponentialRampToValueAtTime(f*2,t+0.05*(i+1)+0.2);hg.gain.setValueAtTime(0.06,t+0.05*(i+1));hg.gain.exponentialRampToValueAtTime(0.001,t+0.05*(i+1)+0.3);h.start(t+0.05*(i+1));h.stop(t+0.05*(i+1)+0.35);});
        {const hc=audioCtx.createOscillator(),hcg=audioCtx.createGain();hc.connect(hcg);hcg.connect(sfxGain);hc.type='sine';hc.frequency.setValueAtTime(2093,t+0.2);hcg.gain.setValueAtTime(0.05,t+0.2);hcg.gain.exponentialRampToValueAtTime(0.001,t+0.5);hc.start(t+0.2);hc.stop(t+0.5);}
        break;
      case'bomb':o.type='sawtooth';o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(40,t+0.3);g.gain.setValueAtTime(0.2,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.4);o.start(t);o.stop(t+0.4);
        {const bn=audioCtx.createBufferSource(),bbuf=audioCtx.createBuffer(1,audioCtx.sampleRate*0.3,audioCtx.sampleRate),bd=bbuf.getChannelData(0);for(let i=0;i<bd.length;i++)bd[i]=(Math.random()*2-1)*0.3*Math.exp(-i/(audioCtx.sampleRate*0.1));bn.buffer=bbuf;const bng=audioCtx.createGain();bn.connect(bng);bng.connect(sfxGain);bng.gain.setValueAtTime(0.15,t);bng.gain.exponentialRampToValueAtTime(0.001,t+0.35);bn.start(t);bn.stop(t+0.35);}
        break;
      case'newhi':o.type='sine';o.frequency.setValueAtTime(880,t);o.frequency.exponentialRampToValueAtTime(1760,t+0.15);g.gain.setValueAtTime(0.1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.4);o.start(t);o.stop(t+0.4);
        [1047,1319,1568].forEach((f,i)=>{const x=audioCtx.createOscillator(),y=audioCtx.createGain();x.connect(y);y.connect(sfxGain);x.type='triangle';x.frequency.setValueAtTime(f,t+0.08*(i+1));y.gain.setValueAtTime(0.07,t+0.08*(i+1));y.gain.exponentialRampToValueAtTime(0.001,t+0.08*(i+1)+0.3);x.start(t+0.08*(i+1));x.stop(t+0.08*(i+1)+0.35);});
        break;
      case'select':o.type='sine';o.frequency.setValueAtTime(660,t);o.frequency.exponentialRampToValueAtTime(880,t+0.06);g.gain.setValueAtTime(0.1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.1);o.start(t);o.stop(t+0.1);break;
      case'click':o.type='sine';o.frequency.setValueAtTime(500,t);g.gain.setValueAtTime(0.08,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.06);o.start(t);o.stop(t+0.06);break;
      case'cancel':o.type='sine';o.frequency.setValueAtTime(400,t);o.frequency.exponentialRampToValueAtTime(250,t+0.1);g.gain.setValueAtTime(0.08,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);o.start(t);o.stop(t+0.12);break;
      case'countdown':o.type='sine';o.frequency.setValueAtTime(523,t);g.gain.setValueAtTime(0.15,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.3);o.start(t);o.stop(t+0.3);break;
      case'countgo':o.type='sine';o.frequency.setValueAtTime(1047,t);g.gain.setValueAtTime(0.18,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.4);o.start(t);o.stop(t+0.4);
        [1319,1568].forEach((f,i)=>{const x=audioCtx.createOscillator(),y=audioCtx.createGain();x.connect(y);y.connect(sfxGain);x.type='triangle';x.frequency.setValueAtTime(f,t+0.05*(i+1));y.gain.setValueAtTime(0.1,t+0.05*(i+1));y.gain.exponentialRampToValueAtTime(0.001,t+0.05*(i+1)+0.3);x.start(t+0.05*(i+1));x.stop(t+0.05*(i+1)+0.35);});
        break;
      case'pause':o.type='triangle';o.frequency.setValueAtTime(440,t);o.frequency.exponentialRampToValueAtTime(330,t+0.1);g.gain.setValueAtTime(0.08,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);o.start(t);o.stop(t+0.12);break;
    }
  }catch(e){}
}
function vibrate(ms){try{if(navigator.vibrate)navigator.vibrate(ms);}catch(e){}}
function sfxCharVoice(idx){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    const bases=[520,440,280,600,700,350];
    const waves=['sine','triangle','sine','sine','square','triangle'];
    const f=bases[idx%bases.length];
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.connect(g);g.connect(sfxGain);o.type=waves[idx%waves.length];
    o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*1.4,t+0.08);
    o.frequency.exponentialRampToValueAtTime(f*0.9,t+0.15);
    g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.2);
    o.start(t);o.stop(t+0.22);
    const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
    o2.connect(g2);g2.connect(sfxGain);o2.type='sine';
    o2.frequency.setValueAtTime(f*1.5,t+0.03);o2.frequency.exponentialRampToValueAtTime(f*1.2,t+0.12);
    g2.gain.setValueAtTime(0.06,t+0.03);g2.gain.exponentialRampToValueAtTime(0.001,t+0.18);
    o2.start(t+0.03);o2.stop(t+0.2);
  }catch(e){}
}

// ===== ITEMS (5 types) =====
const ITEMS=[
  {name:'\u7121\u6575',desc:'10\u79D2\u9593\u7121\u6575',col:'#ff00ff',icon:'\u2731',dur:600},
  {name:'\u30B3\u30A4\u30F3\u5438\u53CE',desc:'\u81EA\u52D5\u53CE\u96C6',col:'#f59e0b',icon:'\u25CE',dur:600},
  {name:'\u30DC\u30E0',desc:'\u753B\u9762\u4E0A\u306E\u6575\u3092\u4E00\u6383',col:'#ff4400',icon:'\u{1F4A3}',dur:0},
  {name:'\u30CF\u30FC\u30C8',desc:'HP\u56DE\u5FA9',col:'#ff3860',icon:'\u2665',dur:0},
  {name:'\u30B9\u30ED\u30FC',desc:'\u30B9\u30ED\u30FC\u30E2\u30FC\u30B7\u30E7\u30F3',col:'#a855f7',icon:'\u25F7',dur:600},
];

// ===== STAGE MODE =====
let gameMode='endless'; // 'endless' or 'stage'
let stageBigCoins=[]; // {x,y,sz,col:false} - 3 per stage (stars)
let stageClearT=0;
let stageBigCollected=0; // stars collected this run

// ===== STAGE PACK SYSTEM =====
// 5 themed packs × 5 stages each = 25 stages
const STAGE_THEMES=[
  {bg1:'#05051e',bg2:'#0a0a3a',gnd:'#1a2a5f',gnd2:'#10184a',line:'#2266cc',ply:'#00e5ff',obs:'#ff3860',n:'宇宙',partType:'twinkle',partCol:'#6688ff'},
  {bg1:'#b8ccdd',bg2:'#7899bb',gnd:'#dde8f2',gnd2:'#c0d0e4',line:'#88aacc',ply:'#00b4d8',obs:'#e63946',n:'雪山',partType:'snow',partCol:'#ffffff'},
  {bg1:'#1a0500',bg2:'#3a0800',gnd:'#5a1a00',gnd2:'#3a1000',line:'#ff4400',ply:'#ffaa00',obs:'#ff0044',n:'マグマ',partType:'ember',partCol:'#ff6600'},
  {bg1:'#001830',bg2:'#003060',gnd:'#004488',gnd2:'#003366',line:'#00aaff',ply:'#00ffc8',obs:'#ff6b9d',n:'海',partType:'bubble',partCol:'#66ccff'},
  {bg1:'#1a0a1e',bg2:'#2a1030',gnd:'#3a1840',gnd2:'#2a1030',line:'#ff69b4',ply:'#ffb7d5',obs:'#cc00ff',n:'桜幻',partType:'petal',partCol:'#ffaacc'},
];
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
const STAGE_PACKS=[
  {name:'宇宙',theme:0,unlock:0,starsPerStage:2,stages:[
    {id:'1-1',name:'1-1',dist:120,spdMul:1.0,seed:1001,hillChance:0.04,gapChance:0.05,enemyChance:0.05},
    {id:'1-2',name:'1-2',dist:160,spdMul:1.0,seed:1002,hillChance:0.06,gapChance:0.06,enemyChance:0.08},
    {id:'1-3',name:'1-3',dist:200,spdMul:1.0,seed:1003,hillChance:0.08,gapChance:0.08,enemyChance:0.10},
    {id:'1-4',name:'1-4',dist:250,spdMul:1.0,seed:1004,hillChance:0.10,gapChance:0.10,enemyChance:0.13},
    {id:'1-5',name:'1-5',dist:300,spdMul:1.0,seed:1005,hillChance:0.12,gapChance:0.12,enemyChance:0.16},
  ]},
  {name:'雪山',theme:1,unlock:12,starsPerStage:2,stages:[
    {id:'2-1',name:'2-1',dist:150,spdMul:1.0,seed:2001,hillChance:0.06,gapChance:0.07,enemyChance:0.08},
    {id:'2-2',name:'2-2',dist:200,spdMul:1.0,seed:2002,hillChance:0.08,gapChance:0.09,enemyChance:0.11},
    {id:'2-3',name:'2-3',dist:250,spdMul:1.0,seed:2003,hillChance:0.10,gapChance:0.11,enemyChance:0.14},
    {id:'2-4',name:'2-4',dist:300,spdMul:1.0,seed:2004,hillChance:0.12,gapChance:0.13,enemyChance:0.17},
    {id:'2-5',name:'2-5',dist:350,spdMul:1.0,seed:2005,hillChance:0.14,gapChance:0.15,enemyChance:0.20},
  ]},
  {name:'マグマ',theme:2,unlock:24,starsPerStage:2,stages:[
    {id:'3-1',name:'3-1',dist:180,spdMul:1.0,seed:3001,hillChance:0.08,gapChance:0.08,enemyChance:0.10},
    {id:'3-2',name:'3-2',dist:230,spdMul:1.0,seed:3002,hillChance:0.10,gapChance:0.10,enemyChance:0.14},
    {id:'3-3',name:'3-3',dist:280,spdMul:1.0,seed:3003,hillChance:0.12,gapChance:0.12,enemyChance:0.17},
    {id:'3-4',name:'3-4',dist:350,spdMul:1.0,seed:3004,hillChance:0.14,gapChance:0.14,enemyChance:0.20},
    {id:'3-5',name:'3-5',dist:400,spdMul:1.0,seed:3005,hillChance:0.16,gapChance:0.16,enemyChance:0.23},
  ]},
  {name:'海',theme:3,unlock:36,starsPerStage:2,stages:[
    {id:'4-1',name:'4-1',dist:200,spdMul:1.0,seed:4001,hillChance:0.08,gapChance:0.09,enemyChance:0.12},
    {id:'4-2',name:'4-2',dist:260,spdMul:1.0,seed:4002,hillChance:0.10,gapChance:0.11,enemyChance:0.16},
    {id:'4-3',name:'4-3',dist:320,spdMul:1.0,seed:4003,hillChance:0.12,gapChance:0.13,enemyChance:0.19},
    {id:'4-4',name:'4-4',dist:380,spdMul:1.0,seed:4004,hillChance:0.14,gapChance:0.15,enemyChance:0.22},
    {id:'4-5',name:'4-5',dist:440,spdMul:1.0,seed:4005,hillChance:0.16,gapChance:0.17,enemyChance:0.25},
  ]},
  {name:'桜幻',theme:4,unlock:48,starsPerStage:2,stages:[
    {id:'5-1',name:'5-1',dist:250,spdMul:1.0,seed:5001,hillChance:0.10,gapChance:0.10,enemyChance:0.14},
    {id:'5-2',name:'5-2',dist:320,spdMul:1.0,seed:5002,hillChance:0.12,gapChance:0.13,enemyChance:0.18},
    {id:'5-3',name:'5-3',dist:380,spdMul:1.0,seed:5003,hillChance:0.14,gapChance:0.15,enemyChance:0.22},
    {id:'5-4',name:'5-4',dist:440,spdMul:1.0,seed:5004,hillChance:0.16,gapChance:0.17,enemyChance:0.25},
    {id:'5-5',name:'5-5',dist:500,spdMul:1.0,seed:5005,hillChance:0.18,gapChance:0.18,enemyChance:0.28},
  ]},
];
// Stage pack progress: {stageId: {cleared:true, stars:N}} for cleared stages
let packProgress=JSON.parse(localStorage.getItem('gd5pp')||'{}');
// Migrate old format: {stageId: true} -> {stageId: {cleared:true, stars:0}}
(function(){for(const k in packProgress){if(packProgress[k]===true)packProgress[k]={cleared:true,stars:0};}})();
function getPackStageStars(stageId){return (packProgress[stageId]&&packProgress[stageId].stars)||0;}
function getTotalStars(){let t=0;for(const k in packProgress)t+=(packProgress[k].stars||0);return t;}
let totalStars=getTotalStars();
let isPackMode=false,currentPackIdx=0,currentPackStageIdx=0,currentPackStage=null,stageRng=null;
let stageSelScroll=0,stageSelTarget=0;
let gotNewStars=0; // how many new stars obtained this clear
// Ambient particles for stage themes
let ambientParts=[];

// ===== STATE =====
const ST={TITLE:0,PLAY:1,DEAD:2,PAUSE:3,STAGE_CLEAR:4,STAGE_SEL:5,COUNTDOWN:6};
let state=ST.TITLE;
let countdownT=0; // countdown timer (frames, counts down from 180 = 3 seconds)
let score=0,highScore=parseInt(localStorage.getItem('gd5hi')||'0');
let newHi=false,speed=SPEED_INIT,frame=0,deadT=0,titleT=0;
let combo=0,comboT=0,comboDsp=0,comboDspT=0;
let shakeX=0,shakeY=0,shakeI=0;
let mileT=0,mileTxt='',lastMile=0;
let pops=[],totalCoins=0,totalFlips=0,maxCombo=0,flipCount=0,flipTimer=999;
let played=parseInt(localStorage.getItem('gd5plays')||'0');
let dist=0;
let hp=HP_MAX,hurtT=0; // hit points and hurt invincibility timer

// Active item effects
let itemEff={invincible:0,magnet:0,slowmo:0};
let djumpAvailable=false; // double jump (Bounce trait or item)
let djumpUsed=false; // track if the double jump was used
let bombCount=0; // bombs in inventory
let bombFlashT=0; // bomb explosion flash timer
const PANEL_H=56; // bottom action panel height
// Ghost character periodic transparency
let ghostPhaseT=0; // timer for ghost transparency cycle
let ghostInvis=false; // whether ghost is currently transparent

// ===== PLAYER =====
// gDir: 1=on floor (gravity down), -1=on ceiling (gravity up)
let player={x:0,y:0,vy:0,gDir:1,rot:0,rotTarget:0,trail:[],alive:true,grounded:false,face:'normal',canFlip:true};
