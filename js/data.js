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
const SPEED_INC=0.00025;
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
  {bg1:'#0a1e2e',bg2:'#123048',gnd:'#1e4a6f',gnd2:'#153858',line:'#2a8abf',ply:'#38bdf8',obs:'#fb923c',n:'\u30A2\u30A4\u30B9\u30D6\u30EB\u30FC'},
  {bg1:'#2e1a0a',bg2:'#482812',gnd:'#6f3e1e',gnd2:'#583015',line:'#bf6a2a',ply:'#fbbf24',obs:'#a855f7',n:'\u30B5\u30F3\u30BB\u30C3\u30C8'},
  {bg1:'#0a2e1a',bg2:'#124828',gnd:'#1e6f3e',gnd2:'#155830',line:'#2abf6a',ply:'#4ade80',obs:'#f43f5e',n:'\u30A8\u30E1\u30E9\u30EB\u30C9'},
  {bg1:'#1e0a2e',bg2:'#301248',gnd:'#4a1e6f',gnd2:'#381558',line:'#8a2abf',ply:'#c084fc',obs:'#22d3ee',n:'\u30C0\u30FC\u30AF\u30CD\u30D3\u30E5\u30E9'},
  {bg1:'#2e0a1a',bg2:'#481228',gnd:'#6f1e3e',gnd2:'#581530',line:'#bf2a6a',ply:'#fb7185',obs:'#34d399',n:'\u30D6\u30E9\u30C3\u30C9\u30E0\u30FC\u30F3'},
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

// --- Rich BGM Definitions (multi-track, 32-step sequencer) ---
// Title: catchy pop earworm, C-Am-F-G bouncy hook
const BGM_TITLE={tempo:138,
  melody:[659,784,659,523, 587,659,0,0, 659,784,659,880, 784,659,0,0,
          880,1047,880,784, 880,988,1047,0, 880,784,659,784, 659,587,523,0],
  harmony:[392,0,392,0, 440,0,440,0, 392,0,392,0, 523,0,440,0,
           523,0,523,0, 587,0,659,0, 523,0,440,0, 392,0,330,0],
  bass:[262,0,262,131, 220,0,220,110, 175,0,175,87, 196,0,196,98,
        262,0,262,131, 220,0,220,110, 175,0,175,87, 196,0,262,131],
  chords:[[523,659,784],[440,523,659],[349,440,523],[392,494,587],
          [523,659,784],[440,523,659],[349,440,523],[392,494,587]],
  melVol:0.28,harmVol:0.08,bassVol:0.18,chordVol:0.06,
  melWave:'triangle',harmWave:'sine',bassWave:'sine',
  drums:'pop'};
// Play1 (0-999): Starlight Stroll - dreamy, calm, C pentatonic, slow waltz feel
const BGM_PLAY1={tempo:100,
  melody:[523,0,0,659, 0,0,784,0, 0,880,0,784, 0,659,0,0,
          440,0,0,523, 0,659,0,0, 587,0,523,0, 0,0,0,0],
  harmony:[392,0,0,0, 440,0,0,0, 330,0,0,0, 349,0,0,0,
           262,0,0,0, 330,0,0,0, 294,0,0,0, 262,0,0,0],
  bass:[262,0,0,0, 0,0,0,0, 220,0,0,0, 0,0,0,0,
        175,0,0,0, 0,0,0,0, 196,0,0,0, 0,0,0,0],
  chords:[[262,330,392],[220,262,330],[175,220,262],[196,247,294],
          [262,330,392],[220,262,330],[175,220,262],[196,247,294]],
  melVol:0.16,harmVol:0.08,bassVol:0.12,chordVol:0.05,
  melWave:'sine',harmWave:'sine',bassWave:'sine',
  drums:'soft'};
// Play2 (1000-1999): Neon Streets - bouncy pop, G major, catchy hook
const BGM_PLAY2={tempo:108,
  melody:[784,0,880,784, 659,784,0,659, 523,587,659,0, 587,523,494,523,
          784,880,988,0, 880,784,659,784, 880,0,784,659, 587,0,523,0],
  harmony:[494,494,587,587, 440,440,494,494, 392,392,440,440, 370,370,392,392,
           494,494,587,587, 440,440,494,494, 392,392,440,440, 370,370,392,392],
  bass:[196,0,392,196, 165,0,330,165, 131,0,262,131, 147,0,294,147,
        196,0,392,196, 165,0,330,165, 131,0,262,131, 147,0,294,147],
  chords:[[392,494,587],[330,392,494],[262,330,392],[294,370,440],
          [392,494,587],[330,392,494],[262,330,392],[294,370,440]],
  melVol:0.20,harmVol:0.09,bassVol:0.18,chordVol:0.06,
  melWave:'triangle',harmWave:'sine',bassWave:'sine',
  drums:'pop'};
// Play3 (2000-2999): Cyberpunk Funk - Dm syncopated arpeggios, synth-funk
const BGM_PLAY3={tempo:116,
  melody:[587,0,698,784, 0,880,0,784, 698,0,587,698, 880,0,1047,0,
          880,784,0,698, 587,0,698,0, 523,587,659,0, 587,0,523,440],
  harmony:[440,0,440,523, 0,523,0,440, 392,0,392,440, 0,440,0,392,
           349,0,349,440, 0,440,0,349, 330,0,330,392, 0,392,0,330],
  bass:[294,0,147,294, 196,0,98,196, 233,0,117,233, 220,0,110,220,
        294,147,0,294, 196,98,0,196, 233,117,0,233, 220,110,0,220],
  chords:[[294,349,440],[196,233,294],[233,294,349],[220,277,330],
          [294,349,440],[196,233,294],[233,294,349],[220,277,330]],
  melVol:0.20,harmVol:0.10,bassVol:0.22,chordVol:0.06,
  melWave:'triangle',harmWave:'triangle',bassWave:'sawtooth',
  drums:'drive'};
// Play4 (3000-3999): Danger Zone - Em aggressive rock, heavy riffs
const BGM_PLAY4={tempo:125,
  melody:[659,0,784,880, 988,880,784,0, 659,784,880,1047, 988,0,880,784,
          523,587,659,784, 0,880,988,0, 1047,988,880,784, 659,0,784,0],
  harmony:[494,494,0,587, 523,0,494,494, 440,440,0,523, 494,0,440,440,
           392,392,0,494, 440,0,392,392, 523,523,0,494, 440,0,392,0],
  bass:[165,165,330,165, 262,262,523,262, 196,196,392,196, 294,294,587,294,
        165,165,330,165, 262,262,523,262, 196,196,392,196, 294,294,587,294],
  chords:[[330,392,494],[262,330,392],[196,247,294],[294,370,440],
          [330,392,494],[262,330,392],[196,247,294],[294,370,440]],
  melVol:0.22,harmVol:0.10,bassVol:0.24,chordVol:0.07,
  melWave:'sawtooth',harmWave:'triangle',bassWave:'triangle',
  drums:'heavy'};
// Play5 (4000+): Maximum Overdrive - Am frantic arpeggios, breakneck EDM
const BGM_PLAY5={tempo:134,
  melody:[880,1047,1319,1568, 1760,1568,1319,1047, 698,880,1047,1319, 1047,880,698,587,
          1175,1319,1568,1760, 1568,1319,1175,1047, 880,1047,1175,1319, 1175,1047,880,1047],
  harmony:[659,0,659,784, 0,784,0,659, 523,0,523,659, 0,659,0,523,
           587,0,587,698, 0,698,0,587, 659,0,659,784, 0,784,0,659],
  bass:[220,220,440,220, 175,175,349,175, 147,147,294,147, 165,165,330,165,
        220,220,440,220, 175,175,349,175, 147,147,294,147, 165,165,330,165],
  chords:[[440,523,659],[349,440,523],[294,349,440],[330,392,494],
          [440,523,659],[349,440,523],[294,349,440],[330,392,494]],
  melVol:0.24,harmVol:0.10,bassVol:0.26,chordVol:0.07,
  melWave:'sawtooth',harmWave:'triangle',bassWave:'sawtooth',
  drums:'turbo'};
// Boss: Nightmare Awakens - Cm with tritones, ominous chromatic horror
const BGM_BOSS={tempo:110,
  melody:[523,0,622,0, 740,0,622,523, 466,0,523,0, 740,659,0,0,
          831,0,784,740, 0,622,0,523, 466,523,622,740, 784,0,622,0],
  harmony:[392,0,0,415, 0,0,370,0, 311,0,0,330, 0,0,392,0,
           415,0,0,392, 0,0,370,0, 330,0,0,311, 0,0,262,0],
  bass:[131,0,131,131, 185,0,185,93, 104,0,104,104, 98,0,131,98,
        131,131,0,131, 185,185,0,93, 104,104,0,104, 98,0,131,131],
  chords:[[262,311,370],[185,233,277],[208,262,311],[196,262,370],
          [262,311,370],[185,233,277],[208,262,311],[196,262,370]],
  melVol:0.20,harmVol:0.08,bassVol:0.28,chordVol:0.08,
  melWave:'sawtooth',harmWave:'triangle',bassWave:'sawtooth',
  drums:'horror'};
// Dead: Last Light - Bm very slow, sparse, melancholy piano-like
const BGM_DEAD={tempo:60,
  melody:[740,0,0,0, 659,0,0,0, 587,0,0,659, 0,0,587,0,
          494,0,0,0, 587,0,0,0, 554,0,0,494, 0,0,0,0],
  harmony:[370,0,0,0, 0,0,330,0, 0,0,0,0, 294,0,0,0,
           247,0,0,0, 0,0,294,0, 0,0,0,0, 247,0,0,0],
  bass:[247,0,0,0, 0,0,0,0, 196,0,0,0, 0,0,0,0,
        147,0,0,0, 0,0,0,0, 110,0,0,0, 0,0,0,0],
  chords:[[494,587,740],[392,494,587],[294,370,440],[220,277,330],
          [494,587,740],[392,494,587],[294,370,440],[220,277,330]],
  melVol:0.12,harmVol:0.06,bassVol:0.08,chordVol:0.04,
  melWave:'sine',harmWave:'sine',bassWave:'sine',
  drums:'none'};

// Fever: old-style simple oscillator BGM (reverted)
let feverBI=0,feverTimer=null;
const FEVER_NOTES=[784,988,1175,1319, 1175,988,784,988, 880,1175,1319,1568, 1319,1175,1047,880];
const FEVER_BASS=[196,196,247,247, 196,196,247,247, 220,220,262,262, 220,220,196,196];
function playFeverBGM(){
  if(bgmCurrent!=='fever')return;
  try{
    const now=audioCtx.currentTime,dur=0.11;
    bgmOsc('sawtooth',FEVER_NOTES[feverBI%16],now,dur*0.9,0.3);
    if(feverBI%2===0)bgmOsc('triangle',FEVER_BASS[feverBI%16],now,dur*1.2,0.25);
    bgmNoise(now,0.03,0.18);
    if(feverBI%2===0)bgmKick(now);
    feverBI++;
  }catch(e){}
  feverTimer=setTimeout(playFeverBGM,110);
}

// Score-based play BGM selection
function getPlayBGM(){
  if(score>=4000)return BGM_PLAY5;
  if(score>=3000)return BGM_PLAY4;
  if(score>=2000)return BGM_PLAY3;
  if(score>=1000)return BGM_PLAY2;
  return BGM_PLAY1;
}
function getPlayBGMType(){
  if(score>=4000)return'play5';
  if(score>=3000)return'play4';
  if(score>=2000)return'play3';
  if(score>=1000)return'play2';
  return'play1';
}

function switchBGM(type){
  if(!audioCtx)return;
  // 'play' resolves to score-based play BGM
  if(type==='play')type=getPlayBGMType();
  if(bgmCurrent===type)return;
  bgmCurrent=type;
  if(bgmTimer){clearTimeout(bgmTimer);bgmTimer=null;}
  if(feverTimer){clearTimeout(feverTimer);feverTimer=null;}
  // Fever uses old-style simple oscillator
  if(type==='fever'){feverBI=0;playFeverBGM();return;}
  const BGM_MAP={title:BGM_TITLE,play1:BGM_PLAY1,play2:BGM_PLAY2,play3:BGM_PLAY3,play4:BGM_PLAY4,play5:BGM_PLAY5,boss:BGM_BOSS,dead:BGM_DEAD};
  const def=BGM_MAP[type]||BGM_PLAY1;
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
      } else if(def.drums==='soft'){
        if(mi%8===0)bgmKick(now); // kick only on beat 1
        if(mi%4===0)bgmNoise(now,0.02,0.04); // gentle hi-hat quarters
      } else if(def.drums==='edm'){
        if(mi%4===0)bgmKick(now);
        if(mi%8===4)bgmSnare(now);
        bgmNoise(now,0.02,mi%2===0?0.1:0.05);
        if(mi%4===2)bgmKick(now);
      } else if(def.drums==='heavy'){
        if(mi%4===0)bgmKick(now);if(mi%4===2)bgmKick(now); // double kick
        if(mi%8===4)bgmSnare(now);if(mi%8===0&&mi>0)bgmSnare(now);
        bgmNoise(now,0.02,0.08); // constant 16th hi-hats
        if(mi%16>=14)bgmSnare(now); // fill
      } else if(def.drums==='turbo'){
        if(mi%2===0)bgmKick(now); // kick every 8th
        if(mi%4===2)bgmSnare(now);if(mi%8===4)bgmSnare(now);
        bgmNoise(now,0.015,0.09);
        if(mi%16>=14){bgmSnare(now);bgmKick(now);} // crash fill
      } else if(def.drums==='horror'){
        // Irregular, unpredictable rhythm
        if(mi===0||mi===6||mi===11||mi===16||mi===22||mi===27)bgmKick(now);
        if(mi===4||mi===13||mi===20||mi===29)bgmSnare(now);
        if(mi%3===0)bgmNoise(now,0.04,0.1); // triplet hi-hats
        if(mi===15||mi===31){bgmSnare(now);bgmKick(now);} // tension builds
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
      case'bossHit':o.type='square';o.frequency.setValueAtTime(200,t);o.frequency.exponentialRampToValueAtTime(80,t+0.15);g.gain.setValueAtTime(0.18,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.2);o.start(t);o.stop(t+0.22);
        {const n2=audioCtx.createBufferSource(),b2=audioCtx.createBuffer(1,Math.max(1,Math.floor(audioCtx.sampleRate*0.1)),audioCtx.sampleRate),d2=b2.getChannelData(0);for(let i=0;i<d2.length;i++)d2[i]=(Math.random()*2-1)*Math.exp(-i/(audioCtx.sampleRate*0.03));n2.buffer=b2;const g2=audioCtx.createGain();n2.connect(g2);g2.connect(sfxGain);g2.gain.setValueAtTime(0.15,t);g2.gain.exponentialRampToValueAtTime(0.001,t+0.1);n2.start(t);n2.stop(t+0.1);}
        break;
      case'gstompHeavy':o.type='sine';o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(40,t+0.2);g.gain.setValueAtTime(0.2,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.35);o.start(t);o.stop(t+0.37);
        {const h1=audioCtx.createOscillator(),hg1=audioCtx.createGain();h1.connect(hg1);hg1.connect(sfxGain);h1.type='sawtooth';h1.frequency.setValueAtTime(120,t);h1.frequency.exponentialRampToValueAtTime(30,t+0.3);hg1.gain.setValueAtTime(0.12,t);hg1.gain.exponentialRampToValueAtTime(0.001,t+0.3);h1.start(t);h1.stop(t+0.32);}
        {const n3=audioCtx.createBufferSource(),b3=audioCtx.createBuffer(1,Math.max(1,Math.floor(audioCtx.sampleRate*0.15)),audioCtx.sampleRate),d3=b3.getChannelData(0);for(let i=0;i<d3.length;i++)d3[i]=(Math.random()*2-1)*Math.exp(-i/(audioCtx.sampleRate*0.05));n3.buffer=b3;const g3=audioCtx.createGain();n3.connect(g3);g3.connect(sfxGain);g3.gain.setValueAtTime(0.18,t);g3.gain.exponentialRampToValueAtTime(0.001,t+0.15);n3.start(t);n3.stop(t+0.15);}
        break;
    }
  }catch(e){}
}
// Aerial combo SE - pitch rises with combo count
function sfxAirCombo(count){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    const base=400+Math.min(count,10)*80; // 400→1200Hz as combo grows
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.connect(g);g.connect(sfxGain);o.type='triangle';
    o.frequency.setValueAtTime(base,t);o.frequency.exponentialRampToValueAtTime(base*1.5,t+0.06);
    g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.1);
    o.start(t);o.stop(t+0.12);
    // Harmonic sparkle at high combos
    if(count>=3){
      const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
      o2.connect(g2);g2.connect(sfxGain);o2.type='sine';
      o2.frequency.setValueAtTime(base*2,t+0.03);
      g2.gain.setValueAtTime(0.06,t+0.03);g2.gain.exponentialRampToValueAtTime(0.001,t+0.1);
      o2.start(t+0.03);o2.stop(t+0.12);
    }
  }catch(e){}
}
// Per-enemy-type death SE
function sfxEnemyDeath(type){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    if(type===0){
      // Walker: splat
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='square';
      o.frequency.setValueAtTime(250,t);o.frequency.exponentialRampToValueAtTime(80,t+0.1);
      g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.13);
      o.start(t);o.stop(t+0.15);
    } else if(type===1){
      // Cannon: metallic clang
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='square';
      o.frequency.setValueAtTime(600,t);o.frequency.exponentialRampToValueAtTime(200,t+0.08);
      g.gain.setValueAtTime(0.1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);
      o.start(t);o.stop(t+0.14);
      const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
      o2.connect(g2);g2.connect(sfxGain);o2.type='sine';
      o2.frequency.setValueAtTime(1200,t);o2.frequency.exponentialRampToValueAtTime(400,t+0.1);
      g2.gain.setValueAtTime(0.06,t);g2.gain.exponentialRampToValueAtTime(0.001,t+0.12);
      o2.start(t);o2.stop(t+0.14);
    } else if(type===2){
      // Flyer: pop burst
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sine';
      o.frequency.setValueAtTime(800,t);o.frequency.exponentialRampToValueAtTime(1600,t+0.04);
      o.frequency.exponentialRampToValueAtTime(200,t+0.1);
      g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);
      o.start(t);o.stop(t+0.14);
    } else if(type===3){
      // Bomber: explosion
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sawtooth';
      o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(40,t+0.2);
      g.gain.setValueAtTime(0.15,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
      o.start(t);o.stop(t+0.27);
      const n=audioCtx.createBufferSource(),buf=audioCtx.createBuffer(1,Math.max(1,Math.floor(audioCtx.sampleRate*0.12)),audioCtx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*0.4;
      n.buffer=buf;const ng=audioCtx.createGain();n.connect(ng);ng.connect(sfxGain);ng.gain.setValueAtTime(0.12,t);ng.gain.exponentialRampToValueAtTime(0.001,t+0.12);n.start(t);n.stop(t+0.12);
    } else if(type===4){
      // Vertical mover: zap
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sawtooth';
      o.frequency.setValueAtTime(400,t);o.frequency.exponentialRampToValueAtTime(1200,t+0.05);
      o.frequency.exponentialRampToValueAtTime(100,t+0.12);
      g.gain.setValueAtTime(0.1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
      o.start(t);o.stop(t+0.17);
    } else if(type===5){
      // Phantom: eerie vanish
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sine';
      o.frequency.setValueAtTime(1000,t);o.frequency.exponentialRampToValueAtTime(300,t+0.2);
      g.gain.setValueAtTime(0.08,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
      o.start(t);o.stop(t+0.27);
      const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
      o2.connect(g2);g2.connect(sfxGain);o2.type='sine';
      o2.frequency.setValueAtTime(1500,t);o2.frequency.exponentialRampToValueAtTime(500,t+0.2);
      g2.gain.setValueAtTime(0.04,t+0.05);g2.gain.exponentialRampToValueAtTime(0.001,t+0.25);
      o2.start(t+0.05);o2.stop(t+0.27);
    } else {
      // Default stomp
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='square';
      o.frequency.setValueAtTime(200,t);o.frequency.exponentialRampToValueAtTime(80,t+0.12);
      g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
      o.start(t);o.stop(t+0.15);
    }
  }catch(e){}
}
// Boss roar - unique terrifying sounds per boss type
function sfxBossRoar(bossType){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    if(bossType==='charge'){
      // Metallic charge horn
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sawtooth';
      o.frequency.setValueAtTime(60,t);o.frequency.exponentialRampToValueAtTime(120,t+0.3);
      o.frequency.exponentialRampToValueAtTime(50,t+0.8);
      g.gain.setValueAtTime(0.2,t);g.gain.linearRampToValueAtTime(0.25,t+0.3);g.gain.exponentialRampToValueAtTime(0.001,t+0.9);
      o.start(t);o.stop(t+1.0);
      const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
      o2.connect(g2);g2.connect(sfxGain);o2.type='square';
      o2.frequency.setValueAtTime(90,t+0.1);o2.frequency.exponentialRampToValueAtTime(45,t+0.7);
      g2.gain.setValueAtTime(0.1,t+0.1);g2.gain.exponentialRampToValueAtTime(0.001,t+0.7);
      o2.start(t+0.1);o2.stop(t+0.8);
    } else if(bossType==='bruiser'){
      // Deep rumbling growl
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sawtooth';
      o.frequency.setValueAtTime(45,t);o.frequency.linearRampToValueAtTime(55,t+0.2);
      o.frequency.linearRampToValueAtTime(35,t+0.6);o.frequency.exponentialRampToValueAtTime(25,t+1.2);
      g.gain.setValueAtTime(0.22,t);g.gain.linearRampToValueAtTime(0.28,t+0.3);g.gain.exponentialRampToValueAtTime(0.001,t+1.3);
      o.start(t);o.stop(t+1.4);
      // Sub rumble
      const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
      o2.connect(g2);g2.connect(sfxGain);o2.type='sine';
      o2.frequency.setValueAtTime(30,t);o2.frequency.exponentialRampToValueAtTime(20,t+1.0);
      g2.gain.setValueAtTime(0.15,t);g2.gain.exponentialRampToValueAtTime(0.001,t+1.0);
      o2.start(t);o2.stop(t+1.1);
    } else if(bossType==='wizard'){
      // Eerie magical shriek
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sawtooth';
      o.frequency.setValueAtTime(200,t);o.frequency.exponentialRampToValueAtTime(600,t+0.3);
      o.frequency.exponentialRampToValueAtTime(150,t+0.8);
      g.gain.setValueAtTime(0.15,t);g.gain.linearRampToValueAtTime(0.2,t+0.2);g.gain.exponentialRampToValueAtTime(0.001,t+0.9);
      o.start(t);o.stop(t+1.0);
      // Ghostly harmonics
      const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
      o2.connect(g2);g2.connect(sfxGain);o2.type='sine';
      o2.frequency.setValueAtTime(500,t);o2.frequency.exponentialRampToValueAtTime(900,t+0.4);o2.frequency.exponentialRampToValueAtTime(300,t+0.8);
      g2.gain.setValueAtTime(0.08,t);g2.gain.exponentialRampToValueAtTime(0.001,t+0.8);
      o2.start(t);o2.stop(t+0.9);
    } else if(bossType==='dodge'){
      // Aggressive bark
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='square';
      o.frequency.setValueAtTime(100,t);o.frequency.exponentialRampToValueAtTime(180,t+0.1);
      o.frequency.exponentialRampToValueAtTime(60,t+0.5);
      g.gain.setValueAtTime(0.2,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.6);
      o.start(t);o.stop(t+0.7);
      const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
      o2.connect(g2);g2.connect(sfxGain);o2.type='sawtooth';
      o2.frequency.setValueAtTime(70,t+0.15);o2.frequency.exponentialRampToValueAtTime(40,t+0.5);
      g2.gain.setValueAtTime(0.12,t+0.15);g2.gain.exponentialRampToValueAtTime(0.001,t+0.55);
      o2.start(t+0.15);o2.stop(t+0.6);
    }
  }catch(e){}
}
function vibrate(ms){try{if(navigator.vibrate)navigator.vibrate(ms);}catch(e){}}
function sfxCharVoice(idx){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    if(idx===0){
      // Cube: digital chirp - two quick square beeps
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='square';
      o.frequency.setValueAtTime(800,t);o.frequency.setValueAtTime(1200,t+0.06);
      g.gain.setValueAtTime(0.1,t);g.gain.setValueAtTime(0.1,t+0.06);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.12);
      o.start(t);o.stop(t+0.14);
    } else if(idx===1){
      // Bounce: springy boing - rapid pitch bounce
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sine';
      o.frequency.setValueAtTime(300,t);o.frequency.exponentialRampToValueAtTime(900,t+0.05);
      o.frequency.exponentialRampToValueAtTime(400,t+0.1);o.frequency.exponentialRampToValueAtTime(800,t+0.15);
      g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.2);
      o.start(t);o.stop(t+0.22);
    } else if(idx===2){
      // Tire: engine rev - low sawtooth rumble with noise
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sawtooth';
      o.frequency.setValueAtTime(80,t);o.frequency.exponentialRampToValueAtTime(200,t+0.1);
      o.frequency.exponentialRampToValueAtTime(120,t+0.2);
      g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
      o.start(t);o.stop(t+0.27);
      const n=audioCtx.createBufferSource(),buf=audioCtx.createBuffer(1,Math.max(1,Math.floor(audioCtx.sampleRate*0.15)),audioCtx.sampleRate);
      const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*0.3;
      n.buffer=buf;const ng=audioCtx.createGain();n.connect(ng);ng.connect(sfxGain);
      ng.gain.setValueAtTime(0.06,t);ng.gain.exponentialRampToValueAtTime(0.001,t+0.15);
      n.start(t);n.stop(t+0.15);
    } else if(idx===3){
      // Ghost: ethereal whisper - high sine with vibrato
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sine';
      o.frequency.setValueAtTime(1200,t);o.frequency.exponentialRampToValueAtTime(800,t+0.3);
      const lfo=audioCtx.createOscillator(),lfoG=audioCtx.createGain();
      lfo.connect(lfoG);lfoG.connect(o.frequency);lfo.frequency.value=8;lfoG.gain.value=60;
      lfo.start(t);lfo.stop(t+0.35);
      g.gain.setValueAtTime(0.08,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.35);
      o.start(t);o.stop(t+0.37);
      const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
      o2.connect(g2);g2.connect(sfxGain);o2.type='sine';
      o2.frequency.setValueAtTime(1800,t);o2.frequency.exponentialRampToValueAtTime(1200,t+0.3);
      g2.gain.setValueAtTime(0.04,t);g2.gain.exponentialRampToValueAtTime(0.001,t+0.3);
      o2.start(t);o2.stop(t+0.32);
    } else if(idx===4){
      // Ninja: sharp slash - rapid high sweep with metallic noise
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sawtooth';
      o.frequency.setValueAtTime(2000,t);o.frequency.exponentialRampToValueAtTime(400,t+0.08);
      g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.1);
      o.start(t);o.stop(t+0.12);
      const n=audioCtx.createBufferSource(),buf=audioCtx.createBuffer(1,Math.max(1,Math.floor(audioCtx.sampleRate*0.08)),audioCtx.sampleRate);
      const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
      n.buffer=buf;const ng=audioCtx.createGain();n.connect(ng);ng.connect(sfxGain);
      ng.gain.setValueAtTime(0.1,t);ng.gain.exponentialRampToValueAtTime(0.001,t+0.06);
      n.start(t);n.stop(t+0.08);
    } else if(idx===5){
      // Stone: heavy thud - low triangle with impact noise
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='triangle';
      o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(60,t+0.15);
      g.gain.setValueAtTime(0.15,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
      o.start(t);o.stop(t+0.27);
      const n=audioCtx.createBufferSource(),buf=audioCtx.createBuffer(1,Math.max(1,Math.floor(audioCtx.sampleRate*0.1)),audioCtx.sampleRate);
      const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(audioCtx.sampleRate*0.03));
      n.buffer=buf;const ng=audioCtx.createGain();n.connect(ng);ng.connect(sfxGain);
      ng.gain.setValueAtTime(0.12,t);ng.gain.exponentialRampToValueAtTime(0.001,t+0.1);
      n.start(t);n.stop(t+0.1);
      const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
      o2.connect(g2);g2.connect(sfxGain);o2.type='sine';
      o2.frequency.setValueAtTime(50,t);o2.frequency.exponentialRampToValueAtTime(30,t+0.2);
      g2.gain.setValueAtTime(0.1,t);g2.gain.exponentialRampToValueAtTime(0.001,t+0.2);
      o2.start(t);o2.stop(t+0.22);
    }
  }catch(e){}
}

// Chest GET jingle - magical ascending arpeggio with shimmer
function sfxChestGet(){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    // Rising sparkle arpeggio
    [523,659,784,1047,1319,1568].forEach((f,i)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sine';
      o.frequency.setValueAtTime(f,t+i*0.06);
      g.gain.setValueAtTime(0.12,t+i*0.06);g.gain.exponentialRampToValueAtTime(0.001,t+i*0.06+0.4);
      o.start(t+i*0.06);o.stop(t+i*0.06+0.45);
    });
    // Shimmery high tone
    const s=audioCtx.createOscillator(),sg2=audioCtx.createGain();
    s.connect(sg2);sg2.connect(sfxGain);s.type='triangle';
    s.frequency.setValueAtTime(2093,t+0.3);s.frequency.exponentialRampToValueAtTime(1568,t+0.8);
    sg2.gain.setValueAtTime(0.06,t+0.3);sg2.gain.exponentialRampToValueAtTime(0.001,t+0.9);
    s.start(t+0.3);s.stop(t+0.95);
  }catch(e){}
}
// Chest open jingle - dramatic reveal with bass impact + fanfare
function sfxChestOpen(){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    // Bass impact
    const b=audioCtx.createOscillator(),bg2=audioCtx.createGain();
    b.connect(bg2);bg2.connect(sfxGain);b.type='sine';
    b.frequency.setValueAtTime(80,t);b.frequency.exponentialRampToValueAtTime(30,t+0.3);
    bg2.gain.setValueAtTime(0.25,t);bg2.gain.exponentialRampToValueAtTime(0.001,t+0.4);
    b.start(t);b.stop(t+0.45);
    // Dramatic ascending chord
    [523,659,784].forEach((f,i)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='triangle';
      o.frequency.setValueAtTime(f,t+0.15+i*0.08);
      g.gain.setValueAtTime(0.15,t+0.15+i*0.08);g.gain.exponentialRampToValueAtTime(0.001,t+0.15+i*0.08+0.6);
      o.start(t+0.15+i*0.08);o.stop(t+0.15+i*0.08+0.65);
    });
    // Final triumphant notes
    [1047,1319,1568,2093].forEach((f,i)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sine';
      o.frequency.setValueAtTime(f,t+0.5+i*0.1);
      g.gain.setValueAtTime(0.1,t+0.5+i*0.1);g.gain.exponentialRampToValueAtTime(0.001,t+0.5+i*0.1+0.5);
      o.start(t+0.5+i*0.1);o.stop(t+0.5+i*0.1+0.55);
    });
  }catch(e){}
}

function sfxSuperRare(){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    // Dramatic bass drop
    const b=audioCtx.createOscillator(),bg2=audioCtx.createGain();
    b.connect(bg2);bg2.connect(sfxGain);b.type='sine';
    b.frequency.setValueAtTime(100,t);b.frequency.exponentialRampToValueAtTime(25,t+0.5);
    bg2.gain.setValueAtTime(0.3,t);bg2.gain.exponentialRampToValueAtTime(0.001,t+0.6);
    b.start(t);b.stop(t+0.65);
    // Rising rainbow arpeggio
    [262,330,392,523,659,784,1047,1319,1568,2093].forEach((f,i)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type=i<5?'triangle':'sine';
      o.frequency.setValueAtTime(f,t+0.2+i*0.07);
      g.gain.setValueAtTime(0.13,t+0.2+i*0.07);g.gain.exponentialRampToValueAtTime(0.001,t+0.2+i*0.07+0.5);
      o.start(t+0.2+i*0.07);o.stop(t+0.2+i*0.07+0.55);
    });
    // Sustained shimmer chord
    [1047,1319,1568].forEach((f,i)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sine';
      o.frequency.setValueAtTime(f,t+1.0);
      o.frequency.setValueAtTime(f*1.003,t+1.2); // slight detune for shimmer
      g.gain.setValueAtTime(0.08,t+1.0);g.gain.exponentialRampToValueAtTime(0.001,t+2.0);
      o.start(t+1.0);o.stop(t+2.1);
    });
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
let airCombo=0; // aerial enemy kill combo (resets on grounded)
let shakeX=0,shakeY=0,shakeI=0;
let mileT=0,mileTxt='',lastMile=0;
let pops=[],totalCoins=0,totalFlips=0,maxCombo=0,flipCount=0,flipTimer=999;
let played=parseInt(localStorage.getItem('gd5plays')||'0');
let dist=0;
let speedOffset=0; // distance offset for speed calculation (reset on continue)
let hp=HP_MAX,hurtT=0; // hit points and hurt invincibility timer

// Active item effects
let itemEff={invincible:0,magnet:0,slowmo:0};
let djumpAvailable=false; // double jump (Bounce trait or item)
let djumpUsed=false; // track if the double jump was used
let bombCount=0; // bombs in inventory
let bombFlashT=0; // bomb explosion flash timer
let invCount=0; // stockable invincibility items in inventory
let bossRetry=null; // {score,bossCount} saved when quitting during boss
let isRetryGame=false; // true if current game is a boss retry (only 1 retry allowed)
// Treasure chest system
let bossChests=0; // number of chests earned this run
let chestFall={active:false,x:0,y:0,vy:0,sparkT:0,gotT:0}; // falling chest during boss reward
let chestOpen={phase:'none',t:0,charIdx:-1,parts:[],reward:null}; // chest opening on death screen
let totalChestsOpened=parseInt(localStorage.getItem('gd5chestTotal')||'0'); // lifetime chest count
const PANEL_H=56; // bottom action panel height
// Ghost character periodic transparency
let ghostPhaseT=0; // timer for ghost transparency cycle
let ghostInvis=false; // whether ghost is currently transparent

// ===== TITLE SCREEN DEMO =====
const demo={active:false,charIdx:0,themeIdx:0,px:0,py:0,vy:0,gDir:1,rot:0,
  grounded:false,plats:[],ceilPlats:[],enemies:[],coins:[],trail:[],
  speed:2,frame:0,timer:0,score:0,alive:true,jumpCD:0,flipCD:0,face:'normal',
  killParts:[],comboT:0,comboN:0};
function initDemo(){
  const d=demo;d.active=true;d.alive=true;d.frame=0;d.timer=0;d.face='normal';
  d.charIdx=Math.floor(Math.random()*CHARS.length);
  d.themeIdx=Math.floor(Math.random()*THEMES.length);
  d.speed=1.8+Math.random()*1.5;d.gDir=1;d.rot=0;d.vy=0;
  d.score=Math.floor(Math.random()*5000);d.jumpCD=0;d.flipCD=0;
  d.comboT=0;d.comboN=0;d.trail=[];d.killParts=[];
  const pr=PLAYER_R*CHARS[d.charIdx].sizeMul;
  d.px=W*0.22;
  // Generate floor and ceiling platforms
  d.plats=[];d.ceilPlats=[];
  let px=-40;
  while(px<W*3){
    const w=100+Math.random()*180;
    const h=GROUND_H+(Math.random()-0.5)*30;
    d.plats.push({x:px,w:w,h:h});
    d.ceilPlats.push({x:px,w:w,h:GROUND_H+(Math.random()-0.5)*20});
    const gap=Math.random()<0.12?35+Math.random()*30:0;
    px+=w+gap;
  }
  d.py=H-d.plats[0].h-pr;d.grounded=true;
  // Spawn enemies and coins
  d.enemies=[];d.coins=[];
  for(let i=0;i<6;i++){
    d.enemies.push({x:W*0.6+i*180+Math.random()*80,y:0,type:Math.floor(Math.random()*6),
      sz:10+Math.random()*5,alive:true,gDir:1,bob:Math.random()*6.28});
  }
  for(let i=0;i<8;i++){
    d.coins.push({x:W*0.4+i*140+Math.random()*60,y:H*0.3+Math.random()*H*0.3,sz:5,t:Math.random()*6.28});
  }
}
function updateDemo(){
  const d=demo;if(!d.active){initDemo();return;}
  d.frame++;d.timer++;
  if(!d.alive||d.timer>700){initDemo();return;}
  const ch=CHARS[d.charIdx];
  const pr=PLAYER_R*ch.sizeMul;
  // Scroll
  d.plats.forEach(p=>{p.x-=d.speed;});
  d.ceilPlats.forEach(p=>{p.x-=d.speed;});
  d.enemies.forEach(e=>{e.x-=d.speed;});
  d.coins.forEach(c=>{c.x-=d.speed;});
  // Remove off-screen, replenish
  d.plats=d.plats.filter(p=>p.x+p.w>-60);
  d.ceilPlats=d.ceilPlats.filter(p=>p.x+p.w>-60);
  if(d.plats.length>0){
    const last=d.plats[d.plats.length-1];
    if(last.x+last.w<W*2){
      const w=100+Math.random()*180,h=GROUND_H+(Math.random()-0.5)*30;
      const gap=Math.random()<0.12?35+Math.random()*30:0;
      d.plats.push({x:last.x+last.w+gap,w:w,h:h});
    }
  }
  if(d.ceilPlats.length>0){
    const last=d.ceilPlats[d.ceilPlats.length-1];
    if(last.x+last.w<W*2){
      const w=100+Math.random()*180,h=GROUND_H+(Math.random()-0.5)*20;
      d.ceilPlats.push({x:last.x+last.w,w:w,h:h});
    }
  }
  // Physics
  const grav=GRAVITY*(ch.gravMul||1)*d.gDir;
  d.vy+=grav;d.py+=d.vy;d.grounded=false;
  if(d.gDir===1){
    for(const p of d.plats){
      if(d.px+pr>p.x&&d.px-pr<p.x+p.w){
        const sY=H-p.h;
        if(d.py+pr>sY&&d.vy>=0){d.py=sY-pr;d.vy=0;d.grounded=true;break;}
      }
    }
  } else {
    for(const p of d.ceilPlats){
      if(d.px+pr>p.x&&d.px-pr<p.x+p.w){
        const sY=p.h;
        if(d.py-pr<sY&&d.vy<=0){d.py=sY+pr;d.vy=0;d.grounded=true;break;}
      }
    }
  }
  if(d.py>H+60||d.py<-60){d.alive=false;return;}
  // Trail
  if(d.frame%2===0)d.trail.push({x:d.px,y:d.py,life:12});
  d.trail=d.trail.filter(t=>{t.life--;return t.life>0;});
  // Kill particles
  d.killParts=d.killParts.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.life--;return p.life>0;});
  if(d.comboT>0)d.comboT--;
  // AI: jump
  d.jumpCD--;
  if(d.grounded&&d.jumpCD<=0){
    let doJump=false;
    for(const e of d.enemies){
      if(e.alive&&e.x>d.px-10&&e.x<d.px+140){doJump=true;break;}
    }
    if(!doJump&&Math.random()<0.025)doJump=true;
    // Jump over gaps
    if(!doJump){
      let hasFloor=false;
      for(const p of d.plats){if(d.px+pr*3>p.x&&d.px+pr<p.x+p.w){hasFloor=true;break;}}
      if(!hasFloor)doJump=true;
    }
    if(doJump){
      d.vy=-JUMP_POWER*(ch.jumpMul||1)*d.gDir;
      d.jumpCD=15+Math.floor(Math.random()*10);
    }
  }
  // AI: flip gravity occasionally
  d.flipCD--;
  if(d.flipCD<=0&&Math.random()<0.006){
    d.gDir*=-1;d.vy=-JUMP_POWER*0.6*d.gDir;d.flipCD=90+Math.floor(Math.random()*60);
  }
  // Rotation
  const tr=d.gDir===1?0:Math.PI;
  d.rot+=(tr-d.rot)*0.12;
  // Enemy ground position + stomp check
  d.enemies.forEach(e=>{
    if(!e.alive)return;
    e.bob+=0.05;
    // Place on ground
    if(e.type===2||e.type===4){
      // Flyer/vertical: float
      e.y=H*0.35+Math.sin(e.bob)*40;e.gDir=1;
    } else {
      for(const p of d.plats){
        if(e.x>=p.x&&e.x<=p.x+p.w){e.y=H-p.h-e.sz;e.gDir=1;break;}
      }
    }
    // Stomp check
    const dx=d.px-e.x,dy=d.py-e.y,dist=Math.sqrt(dx*dx+dy*dy);
    if(dist<pr+e.sz){
      const stomped=(e.gDir===1&&d.py<e.y-e.sz*0.2&&d.vy>=0)||(e.gDir===-1&&d.py>e.y+e.sz*0.2&&d.vy<=0);
      if(stomped){
        e.alive=false;d.vy=-JUMP_POWER*0.7*d.gDir;d.score+=10;
        d.face='happy';d.comboT=30;d.comboN++;
        for(let i=0;i<8;i++){const a=Math.random()*6.28;d.killParts.push({x:e.x,y:e.y,vx:Math.cos(a)*2,vy:Math.sin(a)*2,life:18,col:THEMES[d.themeIdx].obs});}
      }
    }
  });
  if(d.comboT<=0)d.comboN=0;
  if(d.comboT<=0&&d.face==='happy')d.face='normal';
  // Replenish
  d.enemies=d.enemies.filter(e=>e.x>-60);
  while(d.enemies.length<4){
    d.enemies.push({x:W+40+Math.random()*200,y:0,type:Math.floor(Math.random()*6),
      sz:10+Math.random()*5,alive:true,gDir:1,bob:Math.random()*6.28});
  }
  d.coins=d.coins.filter(c=>c.x>-30);
  while(d.coins.length<5){
    d.coins.push({x:W+Math.random()*250,y:H*0.25+Math.random()*H*0.35,sz:5,t:Math.random()*6.28});
  }
  // Collect coins
  d.coins.forEach(c=>{
    c.t+=0.06;
    const dx=d.px-c.x,dy=d.py-c.y;
    if(Math.sqrt(dx*dx+dy*dy)<pr+c.sz+8){c.x=-999;d.score++;}
  });
}

// ===== PLAYER =====
// gDir: 1=on floor (gravity down), -1=on ceiling (gravity up)
let player={x:0,y:0,vy:0,gDir:1,rot:0,rotTarget:0,trail:[],alive:true,grounded:false,face:'normal',canFlip:true};

// ===== NEW GIMMICK CONSTANTS =====
// Enemy action speed multiplier: scales up every 5000 score, 2x at 10000
function enemySpeedMul(){return Math.min(2,1+score/10000);}
const BOSS_HITBOX_SCALE=0.65;
let fallingMtns=[],fallingMtnCD=0;
const PINK_COIN_SCORE=5000,PINK_COIN_COLOR='#ff69b4',PINK_COIN_MUL=2;
let coinSwitches=[],coinSwitchCD=0;
const COIN_SW_R=12,COIN_SW_COL='#4488ff';
