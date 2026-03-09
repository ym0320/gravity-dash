'use strict';
const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
// Performance: disable shadowBlur (extremely expensive on Canvas)
// Only enable for high-end iOS devices; disable on Android and PC
const _isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent||'');
if(!_isIOS){Object.defineProperty(ctx,'shadowBlur',{set(){},get(){return 0;},configurable:true});}
const gameWrap=document.getElementById('gameWrap');
const MAX_W=430;
const MAX_H=844;
let W,H,safeTop=0,safeBot=0;
function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  // Use visualViewport if available and valid, else fallback to innerWidth/Height
  let vw=window.innerWidth,vh=window.innerHeight;
  if(window.visualViewport&&window.visualViewport.width>0&&window.visualViewport.height>0){
    vw=Math.round(window.visualViewport.width);
    vh=Math.round(window.visualViewport.height);
  }
  W=Math.min(vw||window.innerWidth||390,MAX_W);
  H=Math.min(vh||window.innerHeight||844,MAX_H);
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
// Lock to portrait orientation on mobile
try{if(screen.orientation&&screen.orientation.lock)screen.orientation.lock('portrait').catch(()=>{});}catch(e){}

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
const BOSS_INTERVAL=600; // rawDist interval between boss battles
const GAME_VERSION='2.22.189';

// ===== THEMES =====
const THEMES=[
  // 0-999: 深い青 — 静かな夜の海
  {bg1:'#060620',bg2:'#0c0c3a',gnd:'#162850',gnd2:'#101e3a',line:'#2060a8',ply:'#00e5ff',obs:'#ff3860',n:'ディープシー'},
  // 1000-1999: シアン — 目覚めの光
  {bg1:'#041820',bg2:'#0a2e3c',gnd:'#124858',gnd2:'#0e3845',line:'#1a90a8',ply:'#22d3ee',obs:'#f97316',n:'アクアドーン'},
  // 2000-2999: エメラルドグリーン — 生命の森
  {bg1:'#041a0e',bg2:'#0e3420',gnd:'#1a5430',gnd2:'#124024',line:'#20a858',ply:'#34d399',obs:'#f43f5e',n:'エメラルド'},
  // 3000-3999: ゴールド/アンバー — 黄昏の砂漠
  {bg1:'#1e1408',bg2:'#382810',gnd:'#584018',gnd2:'#463212',line:'#b8862a',ply:'#fbbf24',obs:'#8b5cf6',n:'サンセット'},
  // 4000-4999: オレンジレッド — 灼熱の火山
  {bg1:'#2a0c04',bg2:'#441808',gnd:'#6a2810',gnd2:'#52200c',line:'#c8501a',ply:'#fb923c',obs:'#06b6d4',n:'ヴォルケーノ'},
  // 5000-5999: クリムゾン — 深紅の戦場
  {bg1:'#2a0410',bg2:'#440818',gnd:'#681028',gnd2:'#520c1e',line:'#c8203a',ply:'#fb7185',obs:'#4ade80',n:'クリムゾン'},
  // 6000-6999: パープル — 妖しい魔界
  {bg1:'#180828',bg2:'#2a1244',gnd:'#401e68',gnd2:'#341852',line:'#8838c8',ply:'#c084fc',obs:'#fbbf24',n:'アビス'},
  // 7000-7999: ピンク/マゼンタ — 異界の花園
  {bg1:'#28041e',bg2:'#440a34',gnd:'#681450',gnd2:'#520e40',line:'#c82888',ply:'#f472b6',obs:'#22d3ee',n:'ネオンブルーム'},
  // 8000-8999: 白銀/モノクロ — 極限の氷界
  {bg1:'#141420',bg2:'#202038',gnd:'#3a3a58',gnd2:'#2c2c48',line:'#7878a8',ply:'#e2e8f0',obs:'#f43f5e',n:'フロストヘル'},
  // 9000+: 金×黒 — 最終ステージ
  {bg1:'#0e0a02',bg2:'#1c1608',gnd:'#302808',gnd2:'#261e06',line:'#a88020',ply:'#ffd700',obs:'#ff2060',n:'ゴールデンゾーン'},
];
let curTheme=0,prevTheme=0,themeLerp=1;
function lerpColor(a,b,t){
  const p=parseInt,s=(c,i)=>p(c.slice(i,i+2),16);
  return`rgb(${Math.round(s(a,1)+(s(b,1)-s(a,1))*t)},${Math.round(s(a,3)+(s(b,3)-s(a,3))*t)},${Math.round(s(a,5)+(s(b,5)-s(a,5))*t)})`;
}
// Per-frame theme color cache: avoids redundant lerpColor/parseInt calls
let _tcCache={},_tcFrame=-1;
function tcInvalidate(){_tcFrame=-1;}
function tc(k){
  if(isPackMode&&STAGE_THEMES[currentPackIdx]){const st=STAGE_THEMES[currentPackIdx];if(st[k]!==undefined)return st[k];}
  if(themeLerp>=1)return THEMES[curTheme][k];
  // Cache lerped colors per frame
  const fid=lastTime|0;
  if(fid!==_tcFrame){_tcCache={};_tcFrame=fid;}
  if(_tcCache[k]!==undefined)return _tcCache[k];
  return(_tcCache[k]=lerpColor(THEMES[prevTheme][k],THEMES[curTheme][k],themeLerp));
}
// tc() returns hex (#rrggbb) or rgb(...) during lerp; tca() adds alpha safely
function tca(k,a){const c=tc(k);if(c[0]==='#')return c+(a<16?'0':'')+Math.round(a).toString(16);const m=c.match(/\d+/g);return m?`rgba(${m[0]},${m[1]},${m[2]},${(a/255).toFixed(2)})`:`rgba(0,0,0,${(a/255).toFixed(2)})`;}

// ===== CHARACTERS =====
const CHARS=[
  {name:'\u30AD\u30E5\u30FC\u30D6',shape:'cube',col:'#00e5ff',col2:'#00b8d4',eye:'#fff',pupil:'#0a0a2e',
   trait:'\u30D0\u30E9\u30F3\u30B9\u578B',desc:'\u6A19\u6E96\u7684\u306A\u6027\u80FD',jumpMul:1,speedMul:1,sizeMul:1,gravMul:1,coinMul:1,coinMag:0,maxFlip:2,startShield:false,fastKill:false,price:0},
  {name:'\u30D0\u30A6\u30F3\u30B9',shape:'ball',col:'#ff6b6b',col2:'#e04040',eye:'#fff',pupil:'#2a0a0a',
   trait:'2\u6BB5\u30B8\u30E3\u30F3\u30D7\u578B',desc:'\u5E38\u66422\u6BB5\u30B8\u30E3\u30F3\u30D7',jumpMul:1.05,speedMul:0.95,sizeMul:1.05,gravMul:0.92,coinMul:1,coinMag:0,maxFlip:2,startShield:false,fastKill:false,hasDjump:true,price:50},
  {name:'\u30BF\u30A4\u30E4',shape:'tire',col:'#555555',col2:'#333333',eye:'#fff',pupil:'#111',
   trait:'\u8D70\u884C\u578B',desc:'\u6BB5\u5DEE\u4E57\u8D8A+\u5C0F\u6E9D\u901A\u904E',jumpMul:0.95,speedMul:1.12,sizeMul:1,gravMul:1,coinMul:1,coinMag:0,maxFlip:2,startShield:false,fastKill:false,price:80},
  {name:'\u30B4\u30FC\u30B9\u30C8',shape:'ghost',col:'#a855f7',col2:'#8b3fe0',eye:'#fff',pupil:'#1a0a30',
   trait:'\u56DE\u907F\u578B',desc:'\u900F\u660E\u5316\u56DE\u907F+\u30B7\u30FC\u30EB\u30C9',jumpMul:1,speedMul:1,sizeMul:1,gravMul:1,coinMul:1,coinMag:0,maxFlip:2,startShield:true,fastKill:false,price:120},
  {name:'\u30CB\u30F3\u30B8\u30E3',shape:'ninja',col:'#34d399',col2:'#20b878',eye:'#ff4444',pupil:'#000',
   trait:'\u6A5F\u52D5\u578B',desc:'\u30B8\u30E3\u30F3\u30D7\u529B\u2191+3\u56DE\u53CD\u8EE2',jumpMul:1.08,speedMul:1.05,sizeMul:1,gravMul:1,coinMul:1,coinMag:0,maxFlip:3,startShield:false,fastKill:false,price:150},
  {name:'\u30B9\u30C8\u30FC\u30F3',shape:'stone',col:'#8B8B8B',col2:'#6B6B6B',eye:'#fff',pupil:'#333',
   trait:'\u9632\u5FA1\u578B',desc:'HP+1\u3067\u8010\u4E45\u529B\u2191',jumpMul:0.9,speedMul:0.95,sizeMul:1.15,gravMul:1.15,coinMul:1,coinMag:0,maxFlip:2,startShield:false,fastKill:false,hpBonus:1,price:200},
];
function ct(){return CHARS[selChar];}
function maxHp(){return HP_MAX+(ct().hpBonus||0);}
let selChar=parseInt(localStorage.getItem('gd5char')||'0');
let walletCoins=parseInt(localStorage.getItem('gd5wallet')||'0');
let unlockedChars=JSON.parse(localStorage.getItem('gd5unlocked')||'[0]');
function isCharUnlocked(idx){return unlockedChars.includes(idx);}
// Character unlock celebration state
let unlockCelebT=0,unlockCelebChar=-1;

// Characters are unlocked exclusively via treasure chests
function unlockCharFromChest(idx){
  if(isCharUnlocked(idx))return false;
  unlockedChars.push(idx);
  localStorage.setItem('gd5unlocked',JSON.stringify(unlockedChars));
  unlockCelebT=120;unlockCelebChar=idx;
  // Notification badge for new character
  if(!notifNewChars.includes(idx)){notifNewChars.push(idx);localStorage.setItem('gd5notifChars',JSON.stringify(notifNewChars));}
  if(typeof fbSaveUserData==='function')fbSaveUserData();
  return true;
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
    dg.gain.setValueAtTime(0.08,t);dg.gain.linearRampToValueAtTime(0.12,t+0.8);dg.gain.exponentialRampToValueAtTime(0.001,t+2.0);
    drone.start(t);drone.stop(t+2.1);
    [220,208,196,185,175].forEach((f,i)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='square';
      const st=t+i*0.3;
      o.frequency.setValueAtTime(f,st);
      g.gain.setValueAtTime(0.07,st);g.gain.exponentialRampToValueAtTime(0.001,st+0.25);
      o.start(st);o.stop(st+0.3);
    });
    const sir=audioCtx.createOscillator(),sg=audioCtx.createGain();
    sir.connect(sg);sg.connect(sfxGain);sir.type='sawtooth';
    sir.frequency.setValueAtTime(300,t+0.5);sir.frequency.exponentialRampToValueAtTime(900,t+1.8);
    sg.gain.setValueAtTime(0,t+0.5);sg.gain.linearRampToValueAtTime(0.06,t+0.8);sg.gain.exponentialRampToValueAtTime(0.001,t+2.0);
    sir.start(t+0.5);sir.stop(t+2.1);
    const imp=audioCtx.createOscillator(),ig=audioCtx.createGain();
    imp.connect(ig);ig.connect(sfxGain);imp.type='triangle';
    imp.frequency.setValueAtTime(80,t+1.8);imp.frequency.exponentialRampToValueAtTime(20,t+2.5);
    ig.gain.setValueAtTime(0.10,t+1.8);ig.gain.exponentialRampToValueAtTime(0.001,t+2.5);
    imp.start(t+1.8);imp.stop(t+2.6);
  }catch(e){}
}
// Ensure selChar is unlocked (reset to 0 if not)
if(!isCharUnlocked(selChar)){selChar=0;localStorage.setItem('gd5char','0');}

// ===== AUDIO =====
let audioCtx=null,bgmGain=null,sfxGain=null,bgmCurrent='',bgmTimer=null;
function stopBGM(){bgmCurrent='';if(bgmTimer){clearTimeout(bgmTimer);bgmTimer=null;}if(feverTimer){clearTimeout(feverTimer);feverTimer=null;}if(bgmGain&&audioCtx&&audioCtx.state==='running'){bgmGain.gain.cancelScheduledValues(audioCtx.currentTime);bgmGain.gain.setValueAtTime(bgmGain.gain.value,audioCtx.currentTime);bgmGain.gain.linearRampToValueAtTime(0,audioCtx.currentTime+0.08);}}
let bgmVol=parseFloat(localStorage.getItem('gd5bgmVol')||'0.7');
let sfxVol=parseFloat(localStorage.getItem('gd5sfxVol')||'0.7');
let settingsOpen=false;
let resetConfirmStep=0; // 0=none, 1=first confirm, 2=second confirm
let nameEditMode=false; // true when editing username in settings
let nameEditBuf=''; // buffer for name being edited
let logoutConfirm=false; // true when logout confirm shown
let confirmModal=null; // {type:'reset'|'logout', step:0} - modal confirmation overlay
let helpOpen=false; // true when help/controls overlay is shown
let updateInfoOpen=false; // true when update info modal is shown
let updateInfoShown=false; // prevents auto-show more than once per session
let updateInfoPage=0; // current page index for back number browsing
const UPDATE_HISTORY=[
  {ver:'2026-02-22',notes:[
    {title:'\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u30D0\u30E9\u30F3\u30B9\u8ABF\u6574',items:[
      '\u30BF\u30A4\u30E4\u3068\u30CB\u30F3\u30B8\u30E3\u306E\u901F\u5EA6\u3092\u5165\u308C\u66FF\u3048',
      '\u30CB\u30F3\u30B8\u30E3\u3068\u30D0\u30A6\u30F3\u30B9\u306E\u30B8\u30E3\u30F3\u30D7\u529B\u3092\u5F37\u5316',
      '\u30B9\u30C8\u30FC\u30F3\u306E\u91CD\u529B\u5897\u52A0\u3001\u30D0\u30A6\u30F3\u30B9\u306E\u91CD\u529B\u8EFD\u6E1B',
      '\u30BF\u30A4\u30E4\u306E\u6BB5\u5DEE\u4E57\u8D8A\u3092\u5C11\u3057\u5F31\u4F53\u5316'
    ]},
    {title:'\u30B9\u30C6\u30FC\u30BF\u30B9\u8868\u793A\u306E\u6539\u5584',items:[
      '\u30B9\u30C6\u30FC\u30BF\u30B9\u30D0\u30FC\u3092\u6ED1\u3089\u304B\u306A1\u672C\u30D0\u30FC\u306B\u5909\u66F4',
      '\u5C0F\u6570\u70B9\u5358\u4F4D\u306E\u7D30\u304B\u3044\u5024\u3092\u8868\u793A',
      '\u30AD\u30E3\u30E9\u8AAC\u660E\u6587\u3092\u3088\u308A\u5177\u4F53\u7684\u306B\u6539\u5584'
    ]},
    {title:'\u5B9D\u7BB1\u958B\u5C01\u306E\u6539\u5584',items:[
      '\u4E00\u62EC\u958B\u5C01\u304C\u30861\u3064\u305A\u3064\u3086\u3063\u304F\u308A\u958B\u5C01\u3055\u308C\u308B\u3088\u3046\u306B',
      '\u30B9\u30FC\u30D1\u30FC\u30EC\u30A2\u306F\u91D1\u8272\u3001\u30EC\u30A2\u306F\u7D2B\u306E\u7279\u6B8A\u30AB\u30FC\u30C9\u30C7\u30B6\u30A4\u30F3'
    ]},
    {title:'\u30B7\u30E7\u30C3\u30D7\u306E\u6539\u5584',items:[
      '\u30A2\u30A4\u30C6\u30E0\u3092\u5B89\u3044\u9806\u306B\u4E26\u3073\u66FF\u3048',
      '\u30B7\u30FC\u30AF\u30EC\u30C3\u30C8\u30A2\u30A4\u30C6\u30E0\u306F\u4E0B\u306B\u914D\u7F6E'
    ]}
  ]},
  {ver:'2026-02-15',notes:[
    {title:'\u30B2\u30FC\u30E0\u30EA\u30EA\u30FC\u30B9',items:[
      '\u30B2\u30FC\u30E0\u521D\u56DE\u30EA\u30EA\u30FC\u30B9'
    ]}
  ]}
];
const UPDATE_VER=UPDATE_HISTORY[0].ver;
const UPDATE_NOTES=UPDATE_HISTORY[0].notes;
let rankingOpen=false;
let rankingScroll=0;
let rankingScrollTarget=0;
let rankingTab='endless'; // 'endless' | 'challenge'
// Dynamic ranking data (cloud only, no sample data)
let RANKING_DATA=[];
let CHALLENGE_RANKING_DATA=[];
function rebuildRankingData(){
  const data=[];
  if(typeof highScore!=='undefined'&&highScore>0){
    const pName=(typeof playerName!=='undefined'&&playerName)||'\u3042\u306A\u305F';
    const rc=rankChar>=0?rankChar:selChar||0;
    data.push({name:pName,charIdx:rc,score:highScore,eqSkin:rankSkin||'',eqEyes:rankEyes||'',eqFx:rankFx||'',isPlayer:true});
  }
  data.sort((a,b)=>b.score-a.score);
  RANKING_DATA=data.slice(0,100);
  RANKING_DATA.forEach((d,i)=>d.rank=i+1);
}
function rebuildChallengeRankingData(){
  const data=[];
  if(typeof challengeBestKills!=='undefined'&&challengeBestKills>0){
    const pName=(typeof playerName!=='undefined'&&playerName)||'\u3042\u306A\u305F';
    const rc=challRankChar>=0?challRankChar:selChar||0;
    data.push({name:pName,charIdx:rc,kills:challengeBestKills,eqSkin:challRankSkin||'',eqEyes:challRankEyes||'',eqFx:challRankFx||'',isPlayer:true});
  }
  data.sort((a,b)=>b.kills-a.kills);
  CHALLENGE_RANKING_DATA=data.slice(0,100);
  CHALLENGE_RANKING_DATA.forEach((d,i)=>d.rank=i+1);
}
function initAudio(){
  if(audioCtx){
    if(audioCtx.state==='suspended')audioCtx.resume();
    return;
  }
  try{audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended')audioCtx.resume();
    bgmGain=audioCtx.createGain();bgmGain.gain.value=0.15*bgmVol;bgmGain.connect(audioCtx.destination);
    sfxGain=audioCtx.createGain();sfxGain.gain.value=sfxVol;sfxGain.connect(audioCtx.destination);
    switchBGM('title');
  }catch(e){}
}
function setBgmVol(v){bgmVol=v;localStorage.setItem('gd5bgmVol',v.toString());if(bgmGain){bgmGain.gain.cancelScheduledValues(audioCtx.currentTime);bgmGain.gain.value=0.15*v;}}
function setSfxVol(v){sfxVol=v;localStorage.setItem('gd5sfxVol',v.toString());if(sfxGain)sfxGain.gain.value=v;}

// Helper: create oscillator routed through bgmGain (auto-disconnect on end to prevent leak)
function bgmOsc(type,freq,t,dur,vol){
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.connect(g);g.connect(bgmGain);o.type=type;
  o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur*0.92);
  o.onended=function(){try{g.disconnect();}catch(e){}};
  o.start(t);o.stop(t+dur);return o;
}
function bgmNoise(t,dur,vol){
  const n=audioCtx.createBufferSource();
  const buf=audioCtx.createBuffer(1,Math.max(1,Math.floor(audioCtx.sampleRate*dur)),audioCtx.sampleRate);
  const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
  n.buffer=buf;const g=audioCtx.createGain();n.connect(g);g.connect(bgmGain);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur*0.9);
  n.onended=function(){try{g.disconnect();}catch(e){}};
  n.start(t);n.stop(t+dur);
}
function bgmKick(t){
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.connect(g);g.connect(bgmGain);o.type='sine';
  o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(35,t+0.1);
  g.gain.setValueAtTime(0.4,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);
  o.onended=function(){try{g.disconnect();}catch(e){}};
  o.start(t);o.stop(t+0.14);
}
function bgmSnare(t){
  bgmNoise(t,0.06,0.18);
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.connect(g);g.connect(bgmGain);o.type='triangle';
  o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(100,t+0.04);
  g.gain.setValueAtTime(0.2,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.06);
  o.onended=function(){try{g.disconnect();}catch(e){}};
  o.start(t);o.stop(t+0.07);
}

// --- Rich BGM Definitions (multi-track, 32-step sequencer) ---
// Title: catchy pop earworm, C-Am-F-G bouncy hook
const BGM_TITLE={tempo:108,
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
// Title2: upbeat synth-pop, E major, bright and bouncy
const BGM_TITLE2={tempo:120,
  melody:[659,784,988,784, 880,784,659,0, 784,880,988,1175, 988,880,784,0,
          1175,988,880,784, 880,988,1175,0, 988,880,784,659, 784,880,659,0],
  harmony:[494,0,494,0, 523,0,523,0, 587,0,587,0, 494,0,494,0,
           523,0,523,0, 587,0,587,0, 494,0,494,0, 440,0,440,0],
  bass:[330,0,165,330, 262,0,131,262, 294,0,147,294, 247,0,124,247,
        330,0,165,330, 262,0,131,262, 294,0,147,294, 247,0,330,165],
  chords:[[330,415,494],[262,330,392],[294,370,440],[247,311,370],
          [330,415,494],[262,330,392],[294,370,440],[247,311,370]],
  melVol:0.26,harmVol:0.09,bassVol:0.18,chordVol:0.06,
  melWave:'triangle',harmWave:'sine',bassWave:'sine',
  drums:'pop'};
// Title3: funky city-pop, Dm groove, disco-style with catchy bass
const BGM_TITLE3={tempo:112,
  melody:[587,698,880,0, 784,698,587,698, 880,0,1047,880, 784,698,587,0,
          523,587,698,784, 880,0,784,698, 587,0,698,784, 698,587,523,0],
  harmony:[440,0,440,523, 0,523,0,440, 349,0,349,440, 0,440,0,349,
           392,0,392,494, 0,494,0,440, 349,0,349,392, 0,440,0,349],
  bass:[294,0,294,147, 262,0,262,131, 233,0,233,117, 220,0,220,110,
        294,147,294,0, 262,131,262,0, 233,117,233,0, 220,110,294,147],
  chords:[[294,349,440],[262,330,392],[233,294,349],[220,262,330],
          [294,349,440],[262,330,392],[233,294,349],[220,262,330]],
  melVol:0.24,harmVol:0.10,bassVol:0.22,chordVol:0.06,
  melWave:'triangle',harmWave:'triangle',bassWave:'sine',
  drums:'drive'};
// Title4: bright kawaii-pop, F major, bubbly and playful
const BGM_TITLE4={tempo:126,
  melody:[698,880,1047,880, 784,698,784,0, 880,1047,1175,1047, 880,784,698,0,
          1047,1175,1397,1175, 1047,880,784,880, 1047,880,784,698, 784,880,698,0],
  harmony:[523,0,523,0, 587,0,587,0, 523,0,523,0, 440,0,440,0,
           523,0,587,0, 523,0,494,0, 440,0,494,0, 523,0,440,0],
  bass:[175,0,349,175, 196,0,392,196, 220,0,440,220, 175,0,349,175,
        175,0,349,175, 196,0,392,196, 220,0,440,220, 262,0,349,175],
  chords:[[349,440,523],[392,494,587],[440,523,659],[349,440,523],
          [349,440,523],[392,494,587],[440,523,659],[349,440,523]],
  melVol:0.24,harmVol:0.08,bassVol:0.16,chordVol:0.07,
  melWave:'triangle',harmWave:'sine',bassWave:'sine',
  drums:'pop'};
// Title5: retro chiptune-pop, A minor, fast arpeggios
const BGM_TITLE5={tempo:132,
  melody:[880,0,1047,1175, 1319,1175,1047,880, 784,880,1047,0, 880,784,659,0,
          523,659,784,880, 1047,880,784,659, 784,0,880,1047, 880,784,659,0],
  harmony:[523,0,523,587, 659,0,587,523, 440,0,440,0, 523,0,440,0,
           349,0,349,440, 523,0,440,349, 440,0,523,0, 440,0,392,0],
  bass:[220,0,110,220, 262,0,131,262, 175,0,87,175, 196,0,98,196,
        220,110,220,0, 262,131,262,0, 175,87,175,0, 196,0,220,110],
  chords:[[220,262,330],[262,330,392],[175,220,262],[196,247,294],
          [220,262,330],[262,330,392],[175,220,262],[196,247,294]],
  melVol:0.22,harmVol:0.10,bassVol:0.20,chordVol:0.06,
  melWave:'square',harmWave:'triangle',bassWave:'triangle',
  drums:'edm'};
// Title6: smooth jazz-pop, Bb major, laid-back groove
const BGM_TITLE6={tempo:100,
  melody:[932,0,1047,932, 784,0,698,784, 932,1047,1175,0, 1047,932,784,0,
          698,784,932,0, 784,698,587,698, 784,0,932,784, 698,587,466,0],
  harmony:[587,0,587,0, 523,0,523,0, 466,0,466,0, 587,0,523,0,
           466,0,466,0, 523,0,523,0, 587,0,587,0, 466,0,440,0],
  bass:[233,0,117,233, 262,0,131,262, 175,0,87,175, 233,0,117,233,
        233,117,0,233, 262,131,0,262, 175,87,0,175, 233,0,262,233],
  chords:[[466,587,698],[523,659,784],[349,440,523],[466,587,698],
          [466,587,698],[523,659,784],[349,440,523],[466,587,698]],
  melVol:0.22,harmVol:0.09,bassVol:0.18,chordVol:0.07,
  melWave:'triangle',harmWave:'sine',bassWave:'sine',
  drums:'soft'};
const BGM_TITLES=[BGM_TITLE,BGM_TITLE2,BGM_TITLE3,BGM_TITLE4,BGM_TITLE5,BGM_TITLE6];
// Play1 (0-999): Starlight Stroll - dreamy, calm, C pentatonic, slow waltz feel
// Play BGMs: 10 unique tracks, tempo gradually increases 100→134 over score 0→9000+
const BGM_PLAY1={tempo:100, // score 0-999: Dawn Patrol - C major, gentle intro
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
const BGM_PLAY2={tempo:104, // score 1000-1999: Neon Streets - G major, bouncy pop
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
const BGM_PLAY3={tempo:108, // score 2000-2999: Cyberpunk Funk - Dm synth-funk
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
const BGM_PLAY4={tempo:112, // score 3000-3999: Danger Zone - Em aggressive rock
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
const BGM_PLAY5={tempo:116, // score 4000-4999: Neon Horizon - Bb major, uplifting EDM
  melody:[466,0,587,698, 932,0,698,587, 466,587,698,0, 880,0,784,698,
          523,0,622,698, 784,0,698,622, 587,698,784,0, 932,0,880,0],
  harmony:[349,0,349,466, 0,466,0,349, 330,0,330,440, 0,440,0,330,
           311,0,311,392, 0,392,0,311, 349,0,349,466, 0,466,0,349],
  bass:[233,0,466,233, 175,0,349,175, 311,0,622,311, 349,0,698,349,
        233,466,0,233, 175,349,0,175, 311,622,0,311, 349,698,0,349],
  chords:[[466,587,698],[349,440,523],[311,392,466],[349,440,523],
          [466,587,698],[349,440,523],[311,392,466],[349,440,523]],
  melVol:0.22,harmVol:0.10,bassVol:0.22,chordVol:0.06,
  melWave:'triangle',harmWave:'sine',bassWave:'sine',
  drums:'edm'};
const BGM_PLAY6={tempo:120, // score 5000-5999: Dark Pulse - F#m, dark synth wave
  melody:[370,0,440,554, 0,659,0,554, 440,0,370,330, 440,0,554,0,
          494,0,587,659, 0,740,0,659, 587,0,494,440, 370,0,330,0],
  harmony:[277,0,277,330, 0,330,0,277, 294,0,294,370, 0,370,0,294,
           220,0,220,277, 0,277,0,220, 247,0,247,294, 0,294,0,247],
  bass:[185,0,370,185, 147,0,294,147, 220,0,440,220, 165,0,330,165,
        185,370,0,185, 147,294,0,147, 220,440,0,220, 165,330,0,165],
  chords:[[370,440,554],[294,370,440],[220,277,330],[330,392,494],
          [370,440,554],[294,370,440],[220,277,330],[330,392,494]],
  melVol:0.22,harmVol:0.10,bassVol:0.24,chordVol:0.06,
  melWave:'sawtooth',harmWave:'triangle',bassWave:'triangle',
  drums:'drive'};
const BGM_PLAY7={tempo:123, // score 6000-6999: Thunder March - D major, epic march
  melody:[587,0,740,880, 0,740,587,0, 494,587,659,740, 880,0,740,587,
          880,0,988,1047, 880,0,740,0, 587,659,740,880, 740,587,494,0],
  harmony:[440,0,440,587, 0,587,0,440, 370,0,370,494, 0,494,0,370,
           330,0,330,440, 0,440,0,330, 370,0,370,494, 0,494,0,370],
  bass:[294,0,587,294, 247,0,494,247, 196,0,392,196, 220,0,440,220,
        294,587,0,294, 247,494,0,247, 196,392,0,196, 220,440,0,220],
  chords:[[294,370,440],[247,294,370],[196,247,294],[220,277,330],
          [294,370,440],[247,294,370],[196,247,294],[220,277,330]],
  melVol:0.22,harmVol:0.10,bassVol:0.24,chordVol:0.07,
  melWave:'triangle',harmWave:'sine',bassWave:'sawtooth',
  drums:'heavy'};
const BGM_PLAY8={tempo:127, // score 7000-7999: Chaos Engine - Cm, intense industrial
  melody:[523,0,622,659, 784,0,932,784, 622,523,0,466, 523,622,784,0,
          880,0,784,622, 523,0,466,415, 523,0,622,784, 932,0,1047,0],
  harmony:[415,0,415,466, 0,523,0,415, 349,0,349,415, 0,466,0,349,
           466,0,466,523, 0,622,0,466, 392,0,392,466, 0,523,0,392],
  bass:[262,0,523,262, 208,0,415,208, 233,0,466,233, 196,0,392,196,
        262,523,0,262, 208,415,0,208, 233,466,0,233, 196,392,0,196],
  chords:[[262,311,392],[208,262,311],[233,294,349],[196,247,294],
          [262,311,392],[208,262,311],[233,294,349],[196,247,294]],
  melVol:0.24,harmVol:0.10,bassVol:0.26,chordVol:0.07,
  melWave:'sawtooth',harmWave:'triangle',bassWave:'sawtooth',
  drums:'nightmare'};
const BGM_PLAY9={tempo:130, // score 8000-8999: Inferno Rush - Am, frantic arpeggios
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
const BGM_PLAY10={tempo:134, // score 9000+: Final Overdrive - Em, maximum intensity
  melody:[659,784,988,1175, 1319,1175,988,784, 659,0,784,988, 1175,1319,1568,0,
          1319,1175,988,784, 659,784,988,1175, 1568,0,1319,1175, 988,784,659,0],
  harmony:[494,0,494,659, 0,659,0,494, 523,0,523,659, 0,784,0,523,
           440,0,440,587, 0,587,0,440, 494,0,494,659, 0,659,0,494],
  bass:[165,0,330,165, 262,0,523,262, 220,0,440,220, 247,0,494,247,
        165,330,165,0, 262,523,262,0, 220,440,220,0, 247,494,247,0],
  chords:[[330,392,494],[262,330,392],[220,262,330],[247,294,392],
          [330,392,494],[262,330,392],[220,262,330],[247,294,392]],
  melVol:0.26,harmVol:0.10,bassVol:0.28,chordVol:0.07,
  melWave:'sawtooth',harmWave:'triangle',bassWave:'sawtooth',
  drums:'rumble'};
// Boss: Nightmare Awakens - Cm with tritones, ominous chromatic horror
const BGM_BOSS={tempo:105,
  melody:[131,0,0,156, 0,175,0,0, 131,0,156,0, 185,0,0,0,
          208,0,0,233, 0,208,0,175, 156,0,175,185, 208,233,0,0,
          262,0,0,247, 0,233,0,262, 311,0,262,0, 233,0,208,0,
          175,0,0,156, 131,0,156,175, 185,208,175,156, 131,0,0,0,
          349,0,0,330, 0,311,0,0, 349,0,370,0, 392,0,0,0,
          415,0,0,392, 0,370,0,349, 330,0,311,294, 262,0,0,0,
          466,0,0,494, 0,523,0,466, 415,0,392,0, 370,0,349,0,
          311,0,0,262, 233,0,208,175, 156,185,208,233, 262,0,131,0],
  harmony:[0,0,104,0, 0,0,110,0, 0,0,0,104, 0,117,0,0,
           0,0,131,0, 0,0,139,0, 0,0,0,117, 0,131,0,0,
           0,0,156,0, 0,0,147,0, 0,0,0,156, 0,139,0,0,
           0,0,110,0, 0,0,104,0, 0,0,0,98, 0,104,0,0,
           0,0,175,0, 0,0,165,0, 0,0,0,185, 0,196,0,0,
           0,0,208,0, 0,0,196,0, 0,0,0,185, 0,175,0,0,
           0,0,233,0, 0,0,247,0, 0,0,0,233, 0,208,0,0,
           0,0,156,0, 0,0,147,0, 0,0,0,139, 0,131,0,0],
  bass:[65,65,0,65, 0,0,65,0, 65,0,65,65, 0,65,0,0,
        69,69,0,69, 0,0,69,0, 69,0,69,69, 0,69,0,0,
        78,78,0,78, 0,0,78,0, 78,0,78,78, 0,78,0,0,
        65,65,0,65, 0,0,65,0, 65,0,65,65, 0,65,0,0,
        87,87,0,87, 0,0,87,0, 87,0,87,87, 0,87,0,0,
        93,93,0,93, 0,0,93,0, 93,0,93,93, 0,93,0,0,
        104,104,0,104, 0,0,104,0, 104,0,104,104, 0,104,0,0,
        78,78,0,78, 65,0,65,0, 65,0,65,65, 65,65,65,65],
  chords:[[131,156,185,233],[139,175,208,262],[156,185,233,311],[131,175,208,262],
          [175,208,262,311],[185,233,277,349],[208,262,311,370],[156,196,233,311],
          [131,156,185,233],[139,175,208,262],[156,185,233,311],[131,175,208,262],
          [175,208,262,311],[185,233,277,349],[208,262,311,370],[156,196,233,311]],
  melVol:0.18,harmVol:0.10,bassVol:0.32,chordVol:0.06,
  melWave:'sawtooth',harmWave:'sawtooth',bassWave:'sawtooth',
  drums:'nightmare'};
// Challenge: "Descent into Madness" - Dm relentless descending arpeggios, intense battle theme
const BGM_CHALLENGE={tempo:140,
  melody:[587,0,523,0, 494,0,440,0, 392,0,349,0, 330,0,294,0,
          587,0,554,0, 523,0,494,0, 440,0,392,0, 370,0,349,0,
          698,0,659,0, 587,0,554,0, 523,0,494,0, 440,0,392,0,
          784,0,698,0, 659,0,587,0, 554,0,523,0, 494,440,392,349],
  harmony:[0,294,0,262, 0,247,0,220, 0,196,0,175, 0,165,0,147,
           0,294,0,277, 0,262,0,247, 0,220,0,196, 0,185,0,175,
           0,349,0,330, 0,294,0,277, 0,262,0,247, 0,220,0,196,
           0,392,0,349, 0,330,0,294, 0,277,0,262, 0,247,0,220],
  bass:[147,147,0,147, 0,0,147,0, 131,131,0,131, 0,0,131,0,
        147,147,0,147, 0,0,147,0, 110,110,0,110, 0,0,110,0,
        175,175,0,175, 0,0,175,0, 131,131,0,131, 0,0,131,0,
        196,196,0,196, 0,0,175,0, 165,165,0,147, 131,131,110,110],
  chords:[[294,349,440,523],[262,330,392,494],[247,294,370,440],[220,262,330,392],
          [294,349,440,523],[277,330,415,494],[262,330,392,494],[247,294,370,440],
          [349,440,523,659],[330,392,494,587],[294,349,440,523],[262,330,392,494],
          [392,494,587,698],[349,440,523,659],[330,392,494,587],[294,370,440,554]],
  melVol:0.20,harmVol:0.12,bassVol:0.30,chordVol:0.07,
  melWave:'sawtooth',harmWave:'triangle',bassWave:'sawtooth',
  drums:'nightmare'};
// Challenge Boss Defeat: "Floor Crumble" - deep rumbling drone for collapse transition
const BGM_COLLAPSE={tempo:70,
  melody:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
          0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
  harmony:[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
           0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
  bass:[55,0,55,52, 0,49,0,46, 55,0,52,0, 49,46,44,41,
        55,0,55,52, 0,49,0,46, 44,0,41,0, 39,37,35,33],
  chords:[[55,82,110],[52,78,104],[49,73,98],[46,69,93],
          [55,82,110],[52,78,104],[49,73,98],[46,69,93]],
  melVol:0,harmVol:0,bassVol:0.35,chordVol:0.10,
  melWave:'sine',harmWave:'sine',bassWave:'sawtooth',
  drums:'rumble'};
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

// Pause: Quiet Drift - C major, soft ambient pads, very slow and sparse
const BGM_PAUSE={tempo:50,
  melody:[262,0,0,0, 0,0,0,0, 330,0,0,0, 0,0,0,0,
          294,0,0,0, 0,0,0,0, 262,0,0,0, 0,0,0,0],
  harmony:[0,0,0,196, 0,0,0,0, 0,0,0,220, 0,0,0,0,
           0,0,0,175, 0,0,0,0, 0,0,0,196, 0,0,0,0],
  bass:[131,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
        110,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
  chords:[[131,196,262],[131,196,262],[165,220,330],[165,220,330],
          [110,165,220],[110,165,220],[131,196,262],[131,196,262]],
  melVol:0.06,harmVol:0.04,bassVol:0.05,chordVol:0.03,
  melWave:'sine',harmWave:'sine',bassWave:'sine',
  drums:'none'};

// Stage1 - Cosmic Playground: C Lydian, wide-leap melody with F# for spacey wonder
const BGM_STAGE1={tempo:118,
  melody:[523,0,0,880, 740,0,784,0, 659,0,0,1047, 988,0,784,0,
          880,0,0,659, 740,0,1047,0, 988,0,0,784, 880,0,659,0],
  harmony:[0,330,0,0, 0,587,0,0, 0,392,0,0, 0,659,0,0,
           0,523,0,0, 0,587,0,0, 0,392,0,0, 0,330,0,0],
  bass:[131,0,131,262, 147,0,147,294, 110,0,110,220, 98,0,98,196,
        131,131,262,0, 147,147,294,0, 110,110,220,0, 131,0,131,262],
  chords:[[262,330,392],[294,370,440],[440,523,659],[392,494,587],
          [262,330,392],[294,370,440],[330,392,494],[262,330,392]],
  melVol:0.22,harmVol:0.07,bassVol:0.16,chordVol:0.06,
  melWave:'triangle',harmWave:'sine',bassWave:'sine',
  drums:'drive'};
// Stage2 - Crystal Snow: Eb major, slow music-box, gentle falling snowflakes
const BGM_STAGE2={tempo:80,
  melody:[622,0,0,784, 0,0,932,0, 0,784,0,0, 698,0,622,0,
          523,0,0,622, 0,784,0,0, 698,0,0,622, 0,0,0,0],
  harmony:[0,0,466,0, 0,0,0,523, 0,466,0,0, 0,0,392,0,
           0,0,349,0, 0,0,0,466, 0,0,392,0, 0,0,311,0],
  bass:[156,0,0,0, 0,0,0,0, 131,0,0,0, 0,0,0,0,
        117,0,0,0, 0,0,0,0, 156,0,0,0, 0,0,0,0],
  chords:[[311,392,466],[208,262,311],[262,311,392],[233,294,349],
          [311,392,466],[208,262,311],[262,311,392],[311,392,466]],
  melVol:0.14,harmVol:0.06,bassVol:0.10,chordVol:0.05,
  melWave:'sine',harmWave:'sine',bassWave:'sine',
  drums:'soft'};
// Stage3 - Inferno March: A Phrygian, aggressive driving riffs, fiery magma
const BGM_STAGE3={tempo:130,
  melody:[880,0,932,1047, 932,0,880,0, 784,880,932,0, 1047,932,880,784,
          880,932,1047,1175, 1047,0,932,880, 784,0,880,932, 1047,0,880,0],
  harmony:[659,0,698,0, 659,0,587,0, 523,0,587,659, 0,659,0,523,
           659,698,0,784, 698,0,659,0, 523,0,587,0, 698,0,659,0],
  bass:[110,110,220,110, 117,117,233,117, 98,98,196,98, 110,110,220,110,
        110,110,220,110, 117,117,233,117, 87,87,175,87, 110,220,110,110],
  chords:[[220,262,330],[233,294,349],[196,233,294],[220,262,330],
          [220,262,330],[233,294,349],[175,220,262],[220,262,330]],
  melVol:0.24,harmVol:0.10,bassVol:0.26,chordVol:0.07,
  melWave:'sawtooth',harmWave:'triangle',bassWave:'sawtooth',
  drums:'heavy'};

// Fever: old-style simple oscillator BGM (look-ahead scheduling)
let feverBI=0,feverTimer=null,feverNextT=0,feverStarted=false;
const FEVER_NOTES=[784,988,1175,1319, 1175,988,784,988, 880,1175,1319,1568, 1319,1175,1047,880];
const FEVER_BASS=[196,196,247,247, 196,196,247,247, 220,220,262,262, 220,220,196,196];
function playFeverBGM(){
  if(bgmCurrent!=='fever')return;
  if(audioCtx.state!=='running'){feverTimer=setTimeout(playFeverBGM,50);return;}
  if(!feverStarted){feverNextT=audioCtx.currentTime+0.05;feverStarted=true;}
  const dur=0.11;
  try{
    while(feverNextT<audioCtx.currentTime+0.25){
      const t=feverNextT;
      bgmOsc('sawtooth',FEVER_NOTES[feverBI%16],t,dur*0.9,0.3);
      if(feverBI%2===0)bgmOsc('triangle',FEVER_BASS[feverBI%16],t,dur*1.2,0.25);
      bgmNoise(t,0.03,0.18);
      if(feverBI%2===0)bgmKick(t);
      feverBI++;
      feverNextT+=dur;
    }
  }catch(e){}
  feverTimer=setTimeout(playFeverBGM,80);
}

// Score-based play BGM selection (10 tiers, every 1000 score)
// bgmTierOffset: on coin continue, set to current tier so BGM restarts from play1
let bgmTierOffset=0;
function getPlayBGM(){
  const tier=Math.min(Math.max(Math.floor(score/1000)-bgmTierOffset,0),9);
  return[BGM_PLAY1,BGM_PLAY2,BGM_PLAY3,BGM_PLAY4,BGM_PLAY5,BGM_PLAY6,BGM_PLAY7,BGM_PLAY8,BGM_PLAY9,BGM_PLAY10][tier];
}
function getPlayBGMType(){
  const tier=Math.min(Math.max(Math.floor(score/1000)-bgmTierOffset,0),9);
  return'play'+(tier+1);
}

function switchBGM(type){
  if(!audioCtx)return;
  // 'play' resolves to stage BGM in pack mode, or score-based play BGM in endless
  if(type==='play'){
    if(isPackMode){type=currentPackIdx===0?'stage1':currentPackIdx===1?'stage2':currentPackIdx===2?'stage3':'stage1';}
    else{type=getPlayBGMType();}
  }
  // 'title' always picks a random variant (force restart for variety)
  if(type==='title'){
    bgmCurrent='';
    const idx=Math.floor(Math.random()*BGM_TITLES.length);
    type='title'+idx;
  }
  if(bgmCurrent===type)return;
  bgmCurrent=type;
  if(bgmTimer){clearTimeout(bgmTimer);bgmTimer=null;}
  if(feverTimer){clearTimeout(feverTimer);feverTimer=null;}
  // Fever uses old-style simple oscillator
  if(type==='fever'){feverBI=0;feverStarted=false;playFeverBGM();return;}
  const BGM_MAP={title0:BGM_TITLES[0],title1:BGM_TITLES[1],title2:BGM_TITLES[2],title3:BGM_TITLES[3],title4:BGM_TITLES[4],title5:BGM_TITLES[5],
    play1:BGM_PLAY1,play2:BGM_PLAY2,play3:BGM_PLAY3,play4:BGM_PLAY4,play5:BGM_PLAY5,play6:BGM_PLAY6,play7:BGM_PLAY7,play8:BGM_PLAY8,play9:BGM_PLAY9,play10:BGM_PLAY10,
    stage1:BGM_STAGE1,stage2:BGM_STAGE2,stage3:BGM_STAGE3,
    boss:BGM_BOSS,dead:BGM_DEAD,challenge:BGM_CHALLENGE,collapse:BGM_COLLAPSE,pause:BGM_PAUSE};
  const def=BGM_MAP[type]||BGM_PLAY1;
  const stepS=60/(def.tempo*4); // seconds per 16th note step
  const totalSteps=def.melody.length;
  let si=0;
  let nextT=0; // AudioContext time for next step
  let started=false;
  (function play(){
    if(bgmCurrent!==type)return;
    // Don't schedule notes while AudioContext is suspended
    if(audioCtx.state!=='running'){bgmTimer=setTimeout(play,50);return;}
    if(!started){
      nextT=audioCtx.currentTime+0.05;
      started=true;
      // Gentle fade-in to prevent initial loud burst
      if(bgmGain){
        bgmGain.gain.cancelScheduledValues(audioCtx.currentTime);
        bgmGain.gain.setValueAtTime(0.001,audioCtx.currentTime);
        bgmGain.gain.linearRampToValueAtTime(0.15*bgmVol,audioCtx.currentTime+0.35);
      }
    }
    try{
      // Look-ahead: schedule all steps within the next 250ms
      // AudioContext plays them at precise times even if JS timers are throttled
      while(nextT<audioCtx.currentTime+0.25){
        const t=nextT;
        const mi=si%totalSteps;
        const chordIdx=Math.floor(mi/4)%def.chords.length;
        // Melody
        if(def.melody[mi]>0)bgmOsc(def.melWave,def.melody[mi],t,stepS*0.85,def.melVol);
        // Harmony (sustained pad-like)
        if(def.harmony[mi]>0&&mi%2===0)bgmOsc(def.harmWave,def.harmony[mi],t,stepS*1.8,def.harmVol);
        // Bass
        if(def.bass[mi]>0)bgmOsc(def.bassWave,def.bass[mi],t,stepS*0.9,def.bassVol);
        // Chord pad (every 4 steps = quarter note)
        if(mi%4===0){
          def.chords[chordIdx].forEach(f=>{
            bgmOsc('sine',f,t,stepS*3.8,def.chordVol);
          });
        }
        // Drums
        if(def.drums==='pop'){
          if(mi%4===0)bgmKick(t);
          if(mi%8===4)bgmSnare(t);
          if(mi%2===0)bgmNoise(t,0.03,0.08);
          if(mi%4===2)bgmNoise(t,0.015,0.05);
        } else if(def.drums==='drive'){
          if(mi%4===0||mi%8===6)bgmKick(t);
          if(mi%8===4)bgmSnare(t);
          bgmNoise(t,0.02,0.06);
        } else if(def.drums==='soft'){
          if(mi%8===0)bgmKick(t);
          if(mi%4===0)bgmNoise(t,0.02,0.04);
        } else if(def.drums==='edm'){
          if(mi%4===0)bgmKick(t);
          if(mi%8===4)bgmSnare(t);
          bgmNoise(t,0.02,mi%2===0?0.1:0.05);
          if(mi%4===2)bgmKick(t);
        } else if(def.drums==='heavy'){
          if(mi%4===0)bgmKick(t);if(mi%4===2)bgmKick(t);
          if(mi%8===4)bgmSnare(t);if(mi%8===0&&mi>0)bgmSnare(t);
          bgmNoise(t,0.02,0.08);
          if(mi%16>=14)bgmSnare(t);
        } else if(def.drums==='turbo'){
          if(mi%2===0)bgmKick(t);
          if(mi%4===2)bgmSnare(t);if(mi%8===4)bgmSnare(t);
          bgmNoise(t,0.015,0.09);
          if(mi%16>=14){bgmSnare(t);bgmKick(t);}
        } else if(def.drums==='horror'){
          if(mi===0||mi===6||mi===11||mi===16||mi===22||mi===27)bgmKick(t);
          if(mi===4||mi===13||mi===20||mi===29)bgmSnare(t);
          if(mi%3===0)bgmNoise(t,0.04,0.1);
          if(mi===15||mi===31){bgmSnare(t);bgmKick(t);}
        } else if(def.drums==='nightmare'){
          const bar=Math.floor(mi/16)%4;
          if(mi%8<6&&mi%3===0)bgmKick(t);
          if(mi%8===6||mi%8===7)bgmKick(t);
          if(mi%16===3||mi%16===7||mi%16===10||mi%16===14)bgmSnare(t);
          if(mi%3===0)bgmNoise(t,0.05,0.12);
          if(mi%6===1||mi%6===4)bgmNoise(t,0.02,0.04);
          if(mi%16>=13){bgmSnare(t);if(mi%2===0)bgmKick(t);}
          if(bar===1||bar===3){
            if(mi%2===0)bgmKick(t);
            bgmNoise(t,0.015,0.06);
          }
          if(mi%32===0||mi%32===24)bgmNoise(t,0.12,0.15);
          bgmOsc('sine',32+Math.sin(si*0.1)*4,t,stepS*0.9,0.15);
        } else if(def.drums==='rumble'){
          if(mi%2===0)bgmKick(t);
          if(mi%4===0)bgmNoise(t,0.15,0.20);
          if(mi%8===3||mi%8===7)bgmSnare(t);
          if(mi%16===0)bgmNoise(t,0.25,0.18);
          bgmOsc('sine',25+Math.sin(si*0.05)*5,t,stepS*0.9,0.20);
        }
        nextT+=stepS;
        si++;
      }
    }catch(e){}
    bgmTimer=setTimeout(play,80); // Poll every 80ms (well within 250ms look-ahead)
  })();
}
function sfx(type){
  if(!audioCtx)return;try{
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.connect(g);g.connect(sfxGain);
    o.onended=function(){try{g.disconnect();}catch(e){}};
    const t=audioCtx.currentTime;
    switch(type){
      case'jump':o.type='sine';o.frequency.setValueAtTime(380,t);o.frequency.exponentialRampToValueAtTime(580,t+0.08);g.gain.setValueAtTime(0.08,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.1);o.start(t);o.stop(t+0.1);break;
      case'flip':o.type='sine';o.frequency.setValueAtTime(250,t);o.frequency.exponentialRampToValueAtTime(600,t+0.15);g.gain.setValueAtTime(0.1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.18);o.start(t);o.stop(t+0.18);break;
      case'coin':o.type='sine';o.frequency.setValueAtTime(880,t);o.frequency.exponentialRampToValueAtTime(1320,t+0.05);g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);o.start(t);o.stop(t+0.12);break;
      case'item':o.type='sine';o.frequency.setValueAtTime(400,t);o.frequency.exponentialRampToValueAtTime(1200,t+0.18);g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.25);o.start(t);o.stop(t+0.25);break;
      case'death':o.type='sawtooth';o.frequency.setValueAtTime(300,t);o.frequency.exponentialRampToValueAtTime(40,t+0.45);g.gain.setValueAtTime(0.18,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.5);o.start(t);o.stop(t+0.5);break;
      case'milestone':o.type='sine';o.frequency.setValueAtTime(523,t);g.gain.setValueAtTime(0.1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.4);o.start(t);o.stop(t+0.4);[659,784,1047].forEach((f,i)=>{const x=audioCtx.createOscillator(),y=audioCtx.createGain();x.connect(y);y.connect(sfxGain);x.type='sine';x.frequency.setValueAtTime(f,t+0.1*(i+1));y.gain.setValueAtTime(0.08,t+0.1*(i+1));y.gain.exponentialRampToValueAtTime(0.001,t+0.1*(i+1)+0.25);x.start(t+0.1*(i+1));x.stop(t+0.1*(i+1)+0.25);});break;
      case'bigcoin':
        // Sparkling ascending arpeggio: C-E-G-C with shimmer
        o.type='triangle';o.frequency.setValueAtTime(1047,t);o.frequency.exponentialRampToValueAtTime(2093,t+0.12);
        g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.5);o.start(t);o.stop(t+0.5);
        [1319,1568,2093,2637].forEach((f,i)=>{const x=audioCtx.createOscillator(),y=audioCtx.createGain();x.connect(y);y.connect(sfxGain);
        x.type='sine';x.frequency.setValueAtTime(f,t+0.08*(i+1));x.frequency.exponentialRampToValueAtTime(f*1.05,t+0.08*(i+1)+0.2);
        y.gain.setValueAtTime(0.1,t+0.08*(i+1));y.gain.exponentialRampToValueAtTime(0.001,t+0.08*(i+1)+0.35);
        x.start(t+0.08*(i+1));x.stop(t+0.08*(i+1)+0.4);});
        // Shimmer overtone
        {const sh=audioCtx.createOscillator(),shg=audioCtx.createGain();sh.connect(shg);shg.connect(sfxGain);
        sh.type='sine';sh.frequency.setValueAtTime(3520,t+0.15);sh.frequency.exponentialRampToValueAtTime(4186,t+0.5);
        shg.gain.setValueAtTime(0.04,t+0.15);shg.gain.exponentialRampToValueAtTime(0.001,t+0.6);sh.start(t+0.15);sh.stop(t+0.6);}
        break;
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
      case'earthquake':
        // Deep rumble: low sine + noise + sub-bass wobble
        o.type='sine';o.frequency.setValueAtTime(45,t);o.frequency.exponentialRampToValueAtTime(25,t+0.6);
        g.gain.setValueAtTime(0.2,t);g.gain.linearRampToValueAtTime(0.15,t+0.3);g.gain.exponentialRampToValueAtTime(0.001,t+0.7);
        o.start(t);o.stop(t+0.7);
        {const eq1=audioCtx.createOscillator(),eq1g=audioCtx.createGain();eq1.connect(eq1g);eq1g.connect(sfxGain);
        eq1.type='sawtooth';eq1.frequency.setValueAtTime(60,t);eq1.frequency.exponentialRampToValueAtTime(20,t+0.5);
        eq1g.gain.setValueAtTime(0.12,t);eq1g.gain.exponentialRampToValueAtTime(0.001,t+0.5);eq1.start(t);eq1.stop(t+0.55);}
        {const eqn=audioCtx.createBufferSource(),eqb=audioCtx.createBuffer(1,Math.max(1,Math.floor(audioCtx.sampleRate*0.5)),audioCtx.sampleRate),eqd=eqb.getChannelData(0);
        for(let i=0;i<eqd.length;i++)eqd[i]=(Math.random()*2-1)*0.5*Math.exp(-i/(audioCtx.sampleRate*0.15));
        eqn.buffer=eqb;const eqng=audioCtx.createGain();eqn.connect(eqng);eqng.connect(sfxGain);
        eqng.gain.setValueAtTime(0.18,t);eqng.gain.exponentialRampToValueAtTime(0.001,t+0.5);eqn.start(t);eqn.stop(t+0.55);}
        break;
      case'swordSlash':
        // Sharp metallic swoosh: high-pitched sine sweep + noise burst
        o.type='sawtooth';o.frequency.setValueAtTime(800,t);o.frequency.exponentialRampToValueAtTime(200,t+0.12);
        g.gain.setValueAtTime(0.15,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
        o.start(t);o.stop(t+0.2);
        {const sw1=audioCtx.createOscillator(),sw1g=audioCtx.createGain();sw1.connect(sw1g);sw1g.connect(sfxGain);
        sw1.type='sine';sw1.frequency.setValueAtTime(2000,t);sw1.frequency.exponentialRampToValueAtTime(600,t+0.08);
        sw1g.gain.setValueAtTime(0.08,t);sw1g.gain.exponentialRampToValueAtTime(0.001,t+0.1);sw1.start(t);sw1.stop(t+0.12);}
        {const swn=audioCtx.createBufferSource(),swb=audioCtx.createBuffer(1,Math.max(1,Math.floor(audioCtx.sampleRate*0.08)),audioCtx.sampleRate),swd=swb.getChannelData(0);
        for(let i=0;i<swd.length;i++)swd[i]=(Math.random()*2-1)*Math.exp(-i/(audioCtx.sampleRate*0.02));
        swn.buffer=swb;const swng=audioCtx.createGain();swn.connect(swng);swng.connect(sfxGain);
        swng.gain.setValueAtTime(0.1,t);swng.gain.exponentialRampToValueAtTime(0.001,t+0.08);swn.start(t);swn.stop(t+0.1);}
        break;
      case'dodgeWhoosh':
        // Fast whoosh: filtered noise + sine sweep
        o.type='sine';o.frequency.setValueAtTime(400,t);o.frequency.exponentialRampToValueAtTime(150,t+0.15);
        g.gain.setValueAtTime(0.08,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
        o.start(t);o.stop(t+0.2);
        {const dwn=audioCtx.createBufferSource(),dwb=audioCtx.createBuffer(1,Math.max(1,Math.floor(audioCtx.sampleRate*0.12)),audioCtx.sampleRate),dwd=dwb.getChannelData(0);
        for(let i=0;i<dwd.length;i++){const env=Math.sin(Math.PI*i/dwd.length);dwd[i]=(Math.random()*2-1)*0.3*env;}
        dwn.buffer=dwb;const dwng=audioCtx.createGain();dwn.connect(dwng);dwng.connect(sfxGain);
        dwng.gain.setValueAtTime(0.12,t);dwng.gain.exponentialRampToValueAtTime(0.001,t+0.12);dwn.start(t);dwn.stop(t+0.14);}
        break;
      case'spikeHit':
        // Soft rubbery bump: sine boop + gentle thud
        o.type='sine';o.frequency.setValueAtTime(220,t);o.frequency.exponentialRampToValueAtTime(80,t+0.12);
        g.gain.setValueAtTime(0.10,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
        o.start(t);o.stop(t+0.17);
        {const spn=audioCtx.createOscillator(),spng=audioCtx.createGain();spn.connect(spng);spng.connect(sfxGain);
        spn.type='triangle';spn.frequency.setValueAtTime(160,t);spn.frequency.exponentialRampToValueAtTime(60,t+0.1);
        spng.gain.setValueAtTime(0.06,t);spng.gain.exponentialRampToValueAtTime(0.001,t+0.12);spn.start(t);spn.stop(t+0.14);}
        break;
      case'bounce':
        // Bouncy repel: short rubbery boing sound
        o.type='sine';o.frequency.setValueAtTime(350,t);o.frequency.exponentialRampToValueAtTime(700,t+0.06);
        o.frequency.exponentialRampToValueAtTime(250,t+0.15);
        g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
        o.start(t);o.stop(t+0.2);
        {const bo1=audioCtx.createOscillator(),bo1g=audioCtx.createGain();bo1.connect(bo1g);bo1g.connect(sfxGain);
        bo1.type='triangle';bo1.frequency.setValueAtTime(500,t);bo1.frequency.exponentialRampToValueAtTime(900,t+0.04);
        bo1.frequency.exponentialRampToValueAtTime(300,t+0.12);
        bo1g.gain.setValueAtTime(0.08,t);bo1g.gain.exponentialRampToValueAtTime(0.001,t+0.14);bo1.start(t);bo1.stop(t+0.16);}
        break;
      case'icecrack':
        // Ice cracking: high crystalline crack + shattering noise + chime
        o.type='sine';o.frequency.setValueAtTime(2000,t);o.frequency.exponentialRampToValueAtTime(500,t+0.12);
        g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
        o.start(t);o.stop(t+0.2);
        {const icn=audioCtx.createBufferSource(),icb=audioCtx.createBuffer(1,Math.max(1,Math.floor(audioCtx.sampleRate*0.15)),audioCtx.sampleRate),icd=icb.getChannelData(0);
        for(let i=0;i<icd.length;i++)icd[i]=(Math.random()*2-1)*0.4*Math.exp(-i/(audioCtx.sampleRate*0.05));
        icn.buffer=icb;const icng=audioCtx.createGain();icn.connect(icng);icng.connect(sfxGain);
        icng.gain.setValueAtTime(0.1,t+0.02);icng.gain.exponentialRampToValueAtTime(0.001,t+0.15);icn.start(t+0.02);icn.stop(t+0.18);}
        {const ich=audioCtx.createOscillator(),ichg=audioCtx.createGain();ich.connect(ichg);ichg.connect(sfxGain);
        ich.type='sine';ich.frequency.setValueAtTime(3500,t);ich.frequency.exponentialRampToValueAtTime(2500,t+0.15);
        ichg.gain.setValueAtTime(0.06,t);ichg.gain.exponentialRampToValueAtTime(0.001,t+0.2);ich.start(t);ich.stop(t+0.22);}
        break;
      case'guardianJump':
        // Heavy launch: deep thud + rising tone
        o.type='sine';o.frequency.setValueAtTime(100,t);o.frequency.exponentialRampToValueAtTime(300,t+0.15);
        g.gain.setValueAtTime(0.15,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
        o.start(t);o.stop(t+0.27);
        {const gj1=audioCtx.createOscillator(),gj1g=audioCtx.createGain();gj1.connect(gj1g);gj1g.connect(sfxGain);
        gj1.type='square';gj1.frequency.setValueAtTime(60,t);gj1.frequency.exponentialRampToValueAtTime(40,t+0.1);
        gj1g.gain.setValueAtTime(0.12,t);gj1g.gain.exponentialRampToValueAtTime(0.001,t+0.12);gj1.start(t);gj1.stop(t+0.15);}
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
function sfxStompCombo(count){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    // Ascending major scale notes: C5→D5→E5→F5→G5→A5→B5→C6...
    const notes=[523,587,659,698,784,880,988,1047,1175,1319];
    const idx=Math.min(count-2,notes.length-1);
    const freq=notes[idx];
    // Bright triangle wave — main note
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.connect(g);g.connect(sfxGain);o.type='triangle';
    o.frequency.setValueAtTime(freq,t);
    o.frequency.exponentialRampToValueAtTime(freq*1.2,t+0.08);
    g.gain.setValueAtTime(0.15,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
    o.start(t);o.stop(t+0.2);
    // Sparkle octave overtone
    const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
    o2.connect(g2);g2.connect(sfxGain);o2.type='sine';
    o2.frequency.setValueAtTime(freq*2,t+0.02);
    o2.frequency.exponentialRampToValueAtTime(freq*2.4,t+0.1);
    g2.gain.setValueAtTime(0.08,t+0.02);g2.gain.exponentialRampToValueAtTime(0.001,t+0.15);
    o2.start(t+0.02);o2.stop(t+0.17);
    // Extra chime at high combos
    if(count>=4){
      const o3=audioCtx.createOscillator(),g3=audioCtx.createGain();
      o3.connect(g3);g3.connect(sfxGain);o3.type='sine';
      o3.frequency.setValueAtTime(freq*3,t+0.04);
      g3.gain.setValueAtTime(0.05,t+0.04);g3.gain.exponentialRampToValueAtTime(0.001,t+0.12);
      o3.start(t+0.04);o3.stop(t+0.14);
    }
  }catch(e){}
}
// Per-enemy-type death SE
function sfxEnemyDeath(type){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    // Helper: simple oscillator voice
    function _v(tp,f1,f2,f3,t1,t2,vol,dur,dl){
      const d0=dl||0;
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type=tp;
      o.frequency.setValueAtTime(f1,t+d0);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d0+t1);
      if(f3)o.frequency.exponentialRampToValueAtTime(f3,t+d0+t2);
      g.gain.setValueAtTime(vol,t+d0);g.gain.exponentialRampToValueAtTime(0.001,t+d0+dur);
      o.onended=function(){try{g.disconnect();}catch(e){}};
      o.start(t+d0);o.stop(t+d0+dur+0.02);
    }
    // Helper: noise burst
    function _noise(vol,dur,dl){
      const d0=dl||0;
      const n=audioCtx.createBufferSource(),buf=audioCtx.createBuffer(1,Math.max(1,Math.floor(audioCtx.sampleRate*dur)),audioCtx.sampleRate),d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
      n.buffer=buf;const ng=audioCtx.createGain();n.connect(ng);ng.connect(sfxGain);
      ng.gain.setValueAtTime(vol,t+d0);ng.gain.exponentialRampToValueAtTime(0.001,t+d0+dur);
      n.start(t+d0);n.stop(t+d0+dur+0.01);
    }
    // Helper: vibrato oscillator
    function _vib(tp,f1,f2,vol,dur,vibHz,vibAmt,dl){
      const d0=dl||0;
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      const lfo=audioCtx.createOscillator(),lfoG=audioCtx.createGain();
      lfo.connect(lfoG);lfoG.connect(o.frequency);
      o.connect(g);g.connect(sfxGain);o.type=tp;
      o.frequency.setValueAtTime(f1,t+d0);o.frequency.exponentialRampToValueAtTime(f2,t+d0+dur);
      lfo.frequency.setValueAtTime(vibHz,t+d0);lfoG.gain.setValueAtTime(vibAmt,t+d0);
      g.gain.setValueAtTime(vol,t+d0);g.gain.exponentialRampToValueAtTime(0.001,t+d0+dur);
      lfo.start(t+d0);o.start(t+d0);lfo.stop(t+d0+dur+0.02);o.stop(t+d0+dur+0.02);
    }
    if(type===0){
      // Walker: 「ぎゃっ」 cartoonish yelp — 2-note drop + body thud
      _v('square',420,220,0,0.06,0,0.12,0.1);
      _v('sine',550,280,0,0.05,0,0.06,0.08);
      _v('triangle',100,50,0,0.08,0,0.08,0.1,0.06); // thud
    } else if(type===1){
      // Cannon: 「ガキンッ」 metallic clang + ring — resonant metal impact
      _v('sawtooth',600,1200,300,0.02,0.08,0.1,0.12);
      _v('square',1500,500,0,0.05,0,0.06,0.08);
      _vib('sine',1800,900,0.05,0.2,25,120); // metallic ring with fast vibrato
      _noise(0.06,0.04); // impact noise
    } else if(type===2){
      // Flyer: 「ピィッ!」 insect buzz squeal — with flutter
      _vib('sine',1600,2600,0.09,0.14,30,200); // fluttery buzz
      _v('triangle',2200,3000,1400,0.03,0.1,0.05,0.12);
      _v('sine',800,1200,400,0.02,0.06,0.04,0.08,0.02); // wing flutter tail
    } else if(type===3){
      // Bomber: 「ドゴォン」 deep roar + explosion rumble + debris
      _v('sawtooth',200,80,30,0.12,0.3,0.14,0.35);
      _v('square',140,50,25,0.15,0.3,0.08,0.3);
      _noise(0.14,0.2); // explosion noise
      _noise(0.06,0.12,0.15); // secondary debris
      _v('sine',60,30,0,0.2,0,0.10,0.25,0.05); // sub rumble
    } else if(type===4){
      // Vertical: 「ビリビリ!」 electric zap — rapid crackle + arc
      _vib('sawtooth',700,2200,0.10,0.14,45,350); // electric crackle vibrato
      _v('square',1200,1800,200,0.03,0.1,0.06,0.12);
      _noise(0.05,0.06,0.02); // spark noise
      _v('sine',400,150,0,0.08,0,0.05,0.1,0.08); // arc fade
    } else if(type===5){
      // Phantom: 「ヒュ〜〜ン...」 ghostly wail — slow vibrato fade
      _vib('sine',1100,400,0.09,0.4,6,80); // slow eerie vibrato wail
      _vib('sine',1600,600,0.04,0.35,7,100,0.03); // harmonic
      _v('triangle',800,300,100,0.15,0.35,0.03,0.38,0.05); // breathy undertone
    } else if(type===6){
      // Dasher: 「ガハッ!」 heavy impact grunt — short + punchy
      _v('square',280,450,80,0.03,0.1,0.14,0.12);
      _v('sawtooth',200,320,60,0.03,0.08,0.08,0.1);
      _noise(0.08,0.05); // impact
      _v('sine',120,60,0,0.06,0,0.10,0.08,0.04); // body thud
    } else if(type===7){
      // Bird: 「ピヨピヨ!」 2-note chirp — bouncy + cute
      _v('sine',2200,2800,0,0.03,0,0.09,0.08);
      _v('sine',2600,3200,0,0.03,0,0.07,0.07,0.07); // 2nd chirp
      _v('triangle',1800,2400,0,0.03,0,0.04,0.06,0.04); // undertone
    } else if(type===8){
      // Splitter: 「プチュッ!」 wet pop + bubble burst
      _v('sine',500,900,150,0.04,0.12,0.11,0.16);
      _v('triangle',300,600,100,0.03,0.1,0.06,0.13);
      _noise(0.04,0.03,0.02); // pop noise
      _v('sine',800,400,0,0.05,0,0.04,0.08,0.08); // bubble tail
    } else {
      _v('square',280,120,0,0.1,0,0.12,0.13);
    }
  }catch(e){}
}
// Boss defeat cry SFX - unique per boss type
function sfxBossDefeat(bossType){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    function _b(tp,f1,f2,f3,t1,t2,vol,dur,delay){
      const d0=delay||0;
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type=tp;
      o.frequency.setValueAtTime(f1,t+d0);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d0+t1);
      if(f3)o.frequency.exponentialRampToValueAtTime(f3,t+d0+t2);
      g.gain.setValueAtTime(vol,t+d0);g.gain.exponentialRampToValueAtTime(0.001,t+d0+dur);
      o.onended=function(){try{g.disconnect();}catch(e){}};
      o.start(t+d0);o.stop(t+d0+dur+0.02);
    }
    if(bossType==='bruiser'){
      // Bruiser: 「グオォォォ!!」 deep roaring scream
      _b('sawtooth',200,120,50,0.15,0.4,0.18,0.5,0);
      _b('square',160,90,35,0.15,0.4,0.10,0.45,0.02);
      _b('sine',300,180,60,0.12,0.35,0.06,0.4,0.05);
    } else if(bossType==='dodge'){
      // Dodge: 「キャァァ!」 high-speed shriek
      _b('sine',800,1400,400,0.08,0.3,0.14,0.35,0);
      _b('triangle',1200,2000,600,0.06,0.25,0.07,0.3,0.03);
      _b('sine',600,1000,300,0.1,0.28,0.05,0.32,0.05);
    } else if(bossType==='wizard'){
      // Wizard: 「ヒィィ...ガハッ」 eerie wail then crack
      _b('sine',1000,500,200,0.15,0.35,0.12,0.4,0);
      _b('sine',1500,700,250,0.12,0.3,0.06,0.35,0.03);
      _b('sawtooth',300,500,80,0.04,0.12,0.1,0.15,0.3);
    } else if(bossType==='guardian'){
      // Guardian: 「ガガガッ...ドォン!」 armored crumble + heavy impact
      _b('square',400,600,150,0.05,0.2,0.12,0.25,0);
      _b('sawtooth',350,500,120,0.04,0.18,0.08,0.22,0.05);
      _b('square',100,50,30,0.1,0.25,0.16,0.3,0.2);
      _b('sawtooth',80,35,20,0.12,0.28,0.10,0.32,0.22);
    } else {
      // Default boss: heavy death
      _b('sawtooth',250,100,40,0.15,0.35,0.15,0.4,0);
      _b('square',180,70,30,0.12,0.3,0.08,0.35,0.03);
    }
  }catch(e){}
}
// Boss roar - unique terrifying sounds per boss type
function sfxBossRoar(bossType){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    if(bossType==='bruiser'){
      // Deep rumbling growl
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sawtooth';
      o.frequency.setValueAtTime(45,t);o.frequency.linearRampToValueAtTime(55,t+0.2);
      o.frequency.linearRampToValueAtTime(35,t+0.6);o.frequency.exponentialRampToValueAtTime(25,t+1.2);
      g.gain.setValueAtTime(0.11,t);g.gain.linearRampToValueAtTime(0.14,t+0.3);g.gain.exponentialRampToValueAtTime(0.001,t+1.3);
      o.start(t);o.stop(t+1.4);
      // Sub rumble
      const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
      o2.connect(g2);g2.connect(sfxGain);o2.type='sine';
      o2.frequency.setValueAtTime(30,t);o2.frequency.exponentialRampToValueAtTime(20,t+1.0);
      g2.gain.setValueAtTime(0.08,t);g2.gain.exponentialRampToValueAtTime(0.001,t+1.0);
      o2.start(t);o2.stop(t+1.1);
    } else if(bossType==='wizard'){
      // Eerie magical shriek
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sawtooth';
      o.frequency.setValueAtTime(200,t);o.frequency.exponentialRampToValueAtTime(600,t+0.3);
      o.frequency.exponentialRampToValueAtTime(150,t+0.8);
      g.gain.setValueAtTime(0.08,t);g.gain.linearRampToValueAtTime(0.10,t+0.2);g.gain.exponentialRampToValueAtTime(0.001,t+0.9);
      o.start(t);o.stop(t+1.0);
      // Ghostly harmonics
      const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
      o2.connect(g2);g2.connect(sfxGain);o2.type='sine';
      o2.frequency.setValueAtTime(500,t);o2.frequency.exponentialRampToValueAtTime(900,t+0.4);o2.frequency.exponentialRampToValueAtTime(300,t+0.8);
      g2.gain.setValueAtTime(0.04,t);g2.gain.exponentialRampToValueAtTime(0.001,t+0.8);
      o2.start(t);o2.stop(t+0.9);
    } else if(bossType==='dodge'){
      // Aggressive bark
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='square';
      o.frequency.setValueAtTime(100,t);o.frequency.exponentialRampToValueAtTime(180,t+0.1);
      o.frequency.exponentialRampToValueAtTime(60,t+0.5);
      g.gain.setValueAtTime(0.10,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.6);
      o.start(t);o.stop(t+0.7);
      const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
      o2.connect(g2);g2.connect(sfxGain);o2.type='sawtooth';
      o2.frequency.setValueAtTime(70,t+0.15);o2.frequency.exponentialRampToValueAtTime(40,t+0.5);
      g2.gain.setValueAtTime(0.06,t+0.15);g2.gain.exponentialRampToValueAtTime(0.001,t+0.55);
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

// Challenge mode SFX
function sfxFloorCrumble(){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    // Deep rumbling quake (sub-bass sweep)
    const r=audioCtx.createOscillator(),rg=audioCtx.createGain();
    r.connect(rg);rg.connect(sfxGain);r.type='sawtooth';
    r.frequency.setValueAtTime(60,t);r.frequency.linearRampToValueAtTime(25,t+1.5);
    rg.gain.setValueAtTime(0.06,t);rg.gain.linearRampToValueAtTime(0.08,t+0.5);rg.gain.linearRampToValueAtTime(0.001,t+2.0);
    r.start(t);r.stop(t+2.1);
    // Rock cracking impacts
    [0,0.15,0.35,0.5,0.7,0.9,1.1,1.3].forEach(d=>{
      const n=audioCtx.createBufferSource();
      const buf=audioCtx.createBuffer(1,Math.max(1,Math.floor(audioCtx.sampleRate*0.12)),audioCtx.sampleRate);
      const data=buf.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1);
      n.buffer=buf;const ng=audioCtx.createGain();n.connect(ng);ng.connect(sfxGain);
      ng.gain.setValueAtTime(0.04+Math.random()*0.03,t+d);ng.gain.exponentialRampToValueAtTime(0.001,t+d+0.1);
      n.start(t+d);n.stop(t+d+0.12);
    });
    // Sub-bass thud impacts
    [0.1,0.4,0.7,1.0].forEach(d=>{
      const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
      o2.connect(g2);g2.connect(sfxGain);o2.type='sine';
      o2.frequency.setValueAtTime(80,t+d);o2.frequency.exponentialRampToValueAtTime(25,t+d+0.15);
      g2.gain.setValueAtTime(0.07,t+d);g2.gain.exponentialRampToValueAtTime(0.001,t+d+0.2);
      o2.start(t+d);o2.stop(t+d+0.22);
    });
  }catch(e){}
}
// Gravity zone SE: ascending whoosh for UP (dir=-1)
function sfxGravUp(){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.connect(g);g.connect(sfxGain);o.type='sine';
    o.frequency.setValueAtTime(200,t);o.frequency.exponentialRampToValueAtTime(800,t+0.2);
    g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
    o.start(t);o.stop(t+0.3);
    // Shimmer overtone
    const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
    o2.connect(g2);g2.connect(sfxGain);o2.type='triangle';
    o2.frequency.setValueAtTime(400,t+0.05);o2.frequency.exponentialRampToValueAtTime(1200,t+0.2);
    g2.gain.setValueAtTime(0.06,t+0.05);g2.gain.exponentialRampToValueAtTime(0.001,t+0.25);
    o2.start(t+0.05);o2.stop(t+0.3);
  }catch(e){}
}
// Gravity zone SE: descending whoosh for DOWN (dir=1)
function sfxGravDown(){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.connect(g);g.connect(sfxGain);o.type='sine';
    o.frequency.setValueAtTime(800,t);o.frequency.exponentialRampToValueAtTime(200,t+0.2);
    g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
    o.start(t);o.stop(t+0.3);
    // Low thud
    const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
    o2.connect(g2);g2.connect(sfxGain);o2.type='triangle';
    o2.frequency.setValueAtTime(500,t+0.05);o2.frequency.exponentialRampToValueAtTime(120,t+0.2);
    g2.gain.setValueAtTime(0.06,t+0.05);g2.gain.exponentialRampToValueAtTime(0.001,t+0.25);
    o2.start(t+0.05);o2.stop(t+0.3);
  }catch(e){}
}
function sfxChallengeDefeat(){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    // Short triumphant stinger (different from normal fanfare)
    [392,494,587,784].forEach((f,i)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='triangle';
      o.frequency.setValueAtTime(f,t+i*0.08);
      g.gain.setValueAtTime(0.14,t+i*0.08);g.gain.exponentialRampToValueAtTime(0.001,t+i*0.08+0.2);
      o.start(t+i*0.08);o.stop(t+i*0.08+0.25);
    });
    // Power chord
    [784,988,1175].forEach(f=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sawtooth';
      o.frequency.setValueAtTime(f,t+0.35);
      g.gain.setValueAtTime(0.08,t+0.35);g.gain.exponentialRampToValueAtTime(0.001,t+0.7);
      o.start(t+0.35);o.stop(t+0.75);
    });
  }catch(e){}
}
function sfxChallengeBossAlert(){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    // Aggressive warning siren (different from normal boss alert)
    const s=audioCtx.createOscillator(),sg=audioCtx.createGain();
    s.connect(sg);sg.connect(sfxGain);s.type='sawtooth';
    s.frequency.setValueAtTime(200,t);s.frequency.linearRampToValueAtTime(400,t+0.3);
    s.frequency.linearRampToValueAtTime(200,t+0.6);s.frequency.linearRampToValueAtTime(500,t+0.9);
    sg.gain.setValueAtTime(0.10,t);sg.gain.exponentialRampToValueAtTime(0.001,t+1.2);
    s.start(t);s.stop(t+1.3);
    // Impact drum
    const k=audioCtx.createOscillator(),kg=audioCtx.createGain();
    k.connect(kg);kg.connect(sfxGain);k.type='sine';
    k.frequency.setValueAtTime(100,t+0.9);k.frequency.exponentialRampToValueAtTime(30,t+1.1);
    kg.gain.setValueAtTime(0.15,t+0.9);kg.gain.exponentialRampToValueAtTime(0.001,t+1.2);
    k.start(t+0.9);k.stop(t+1.3);
  }catch(e){}
}

// ===== ITEMS (5 types) =====
const ITEMS=[
  {name:'\u7121\u6575',desc:'10\u79D2\u9593\u7121\u6575',col:'#ff00ff',icon:'\u2B50\uFE0F',dur:600},
  {name:'\u30B3\u30A4\u30F3\u5438\u53CE',desc:'\u81EA\u52D5\u53CE\u96C6',col:'#f59e0b',icon:'\u{1F9F2}',dur:600},
  {name:'\u30DC\u30E0',desc:'\u753B\u9762\u4E0A\u306E\u6575\u3092\u4E00\u6383',col:'#ff4400',icon:'\u{1F4A3}',dur:0},
  {name:'\u30CF\u30FC\u30C8',desc:'HP\u56DE\u5FA9',col:'#ff3860',icon:'\u2764\uFE0F',dur:0},
  {name:'\u30B9\u30ED\u30FC',desc:'\u30B9\u30ED\u30FC\u30E2\u30FC\u30B7\u30E7\u30F3',col:'#a855f7',icon:'\u25F7',dur:600},
];


// ===== STAGE MODE =====
let gameMode='endless'; // 'endless' or 'stage'
let stageSelGuardT=0; // frames to ignore input after transitioning to stage select
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
    {id:'1-1',name:'1-1',dist:1000,spdMul:1.2,seed:1001,hillChance:0.80,gapChance:0,
      noFloatPlat:true,noHazards:true,noMovingHill:true,walkerOnly:true,enemyChance:0.15,
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.78,yOff:-50}]},
    {id:'1-2',name:'1-2',dist:1000,spdMul:1.35,seed:1002,enemyChance:0.35,
      stageType:'altChasm',noFloatPlat:true,noMovingHill:true,noHazards:true,
      coins:[{pos:0.28,yOff:-50},{pos:0.52,yOff:-50},{pos:0.76,yOff:-50}]},
    {id:'1-3',name:'1-3',dist:1000,spdMul:1.5,seed:1003,enemyChance:0.20,
      stageType:'altChasm',noFloatPlat:true,noMovingHill:true,
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.80,yOff:-50}]},
    {id:'1-4',name:'1-4',dist:1000,spdMul:1.65,seed:1004,hillChance:0.45,gapChance:0.42,enemyChance:0,
      stageType:'gravity',noFloatPlat:true,
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.78,yOff:-50}]},
    {id:'1-5',name:'1-5',dist:1000,spdMul:1.8,seed:1005,hillChance:0.50,gapChance:0.48,enemyChance:0.30,
      stageType:'void',noFloatPlat:true,noMovingHill:true,
      coins:[{pos:0.25,yOff:-50},{pos:0.58,yOff:-50},{pos:0.78,yOff:-50}]},
  ]},
  {name:'雪山',theme:1,unlock:12,starsPerStage:2,stages:[
    {id:'2-1',name:'2-1',dist:1000,spdMul:1.3,seed:2001,hillChance:0.35,gapChance:0.30,enemyChance:0.26,noFloatPlat:true,
      icicleChance:0.08,
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.78,yOff:-50}]},
    {id:'2-2',name:'2-2',dist:1000,spdMul:1.4,seed:2002,hillChance:0.40,gapChance:0.34,enemyChance:0.32,noFloatPlat:true,
      icicleChance:0.14,
      coins:[{pos:0.28,yOff:-50},{pos:0.52,yOff:-50},{pos:0.76,yOff:-50}]},
    {id:'2-3',name:'2-3',dist:1000,spdMul:1.5,seed:2003,hillChance:0.42,gapChance:0.38,enemyChance:0.36,noFloatPlat:true,
      stageType:'chasm',icicleChance:0.20,
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.80,yOff:-50}]},
    {id:'2-4',name:'2-4',dist:1000,spdMul:1.65,seed:2004,hillChance:0.45,gapChance:0.42,enemyChance:0,noFloatPlat:true,
      stageType:'gravity',icicleChance:0.26,
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.78,yOff:-50}]},
    {id:'2-5',name:'2-5',dist:1000,spdMul:1.8,seed:2005,hillChance:0.35,gapChance:0.30,enemyChance:0,boss:true,noFloatPlat:true,
      stageType:'spikeOnly',noMovingHill:true,denseSpikes:true,bossVariant:'snowman',
      coins:[{pos:0.25,yOff:-50},{pos:0.50,yOff:-50},{pos:0.75,yOff:-50}]},
  ]},
  {name:'マグマ',theme:2,unlock:24,starsPerStage:2,stages:[
    {id:'3-1',name:'3-1',dist:1000,spdMul:1.35,seed:3001,hillChance:0.40,gapChance:0.32,enemyChance:0.30,noFloatPlat:true,
      magma:true,
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.78,yOff:-50}]},
    {id:'3-2',name:'3-2',dist:1000,spdMul:1.45,seed:3002,hillChance:0.45,gapChance:0.38,enemyChance:0.36,noFloatPlat:true,
      magma:true,
      coins:[{pos:0.28,yOff:-50},{pos:0.52,yOff:-50},{pos:0.76,yOff:-50}]},
    {id:'3-3',name:'3-3',dist:1000,spdMul:1.55,seed:3003,hillChance:0.45,gapChance:0.40,enemyChance:0.40,noFloatPlat:true,
      magma:true,stageType:'chasm',
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.80,yOff:-50}]},
    {id:'3-4',name:'3-4',dist:1000,spdMul:1.7,seed:3004,hillChance:0.48,gapChance:0.44,enemyChance:0,noFloatPlat:true,
      magma:true,stageType:'gravity',
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.78,yOff:-50}]},
    {id:'3-5',name:'3-5',dist:1000,spdMul:1.85,seed:3005,hillChance:0.50,gapChance:0.46,enemyChance:0,boss:true,noFloatPlat:true,
      magma:true,stageType:'void',noMovingHill:true,
      coins:[{pos:0.25,yOff:-50},{pos:0.50,yOff:-50},{pos:0.75,yOff:-50}]},
  ]},
  {name:'海',theme:3,unlock:36,starsPerStage:2,stages:[
    {id:'4-1',name:'4-1',dist:1000,spdMul:1.4,seed:4001,hillChance:0.42,gapChance:0.35,enemyChance:0.34,noFloatPlat:true,
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.78,yOff:-50}]},
    {id:'4-2',name:'4-2',dist:1000,spdMul:1.5,seed:4002,hillChance:0.46,gapChance:0.40,enemyChance:0.40,noFloatPlat:true,
      coins:[{pos:0.28,yOff:-50},{pos:0.52,yOff:-50},{pos:0.76,yOff:-50}]},
    {id:'4-3',name:'4-3',dist:1000,spdMul:1.6,seed:4003,hillChance:0.48,gapChance:0.42,enemyChance:0.44,noFloatPlat:true,
      stageType:'chasm',
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.80,yOff:-50}]},
    {id:'4-4',name:'4-4',dist:1000,spdMul:1.75,seed:4004,hillChance:0.50,gapChance:0.46,enemyChance:0,noFloatPlat:true,
      stageType:'gravity',
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.78,yOff:-50}]},
    {id:'4-5',name:'4-5',dist:1000,spdMul:1.9,seed:4005,hillChance:0.52,gapChance:0.48,enemyChance:0,boss:true,noFloatPlat:true,
      stageType:'void',noMovingHill:true,
      coins:[{pos:0.25,yOff:-50},{pos:0.50,yOff:-50},{pos:0.75,yOff:-50}]},
  ]},
  {name:'桜幻',theme:4,unlock:48,starsPerStage:2,stages:[
    {id:'5-1',name:'5-1',dist:1000,spdMul:1.45,seed:5001,hillChance:0.44,gapChance:0.38,enemyChance:0.38,noFloatPlat:true,
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.78,yOff:-50}]},
    {id:'5-2',name:'5-2',dist:1000,spdMul:1.55,seed:5002,hillChance:0.48,gapChance:0.42,enemyChance:0.44,noFloatPlat:true,
      coins:[{pos:0.28,yOff:-50},{pos:0.52,yOff:-50},{pos:0.76,yOff:-50}]},
    {id:'5-3',name:'5-3',dist:1000,spdMul:1.65,seed:5003,hillChance:0.50,gapChance:0.44,enemyChance:0.48,noFloatPlat:true,
      stageType:'chasm',
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.80,yOff:-50}]},
    {id:'5-4',name:'5-4',dist:1000,spdMul:1.8,seed:5004,hillChance:0.52,gapChance:0.48,enemyChance:0,noFloatPlat:true,
      stageType:'gravity',
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.78,yOff:-50}]},
    {id:'5-5',name:'5-5',dist:1000,spdMul:1.95,seed:5005,hillChance:0.55,gapChance:0.52,enemyChance:0,boss:true,noFloatPlat:true,
      stageType:'void',noMovingHill:true,
      coins:[{pos:0.25,yOff:-50},{pos:0.50,yOff:-50},{pos:0.75,yOff:-50}]},
  ]},
];
// Stage pack progress: {stageId: {cleared:true, stars:N}} for cleared stages
let packProgress=JSON.parse(localStorage.getItem('gd5pp')||'{}');
// Migrate old format: {stageId: true} -> {stageId: {cleared:true, stars:0}}
(function(){for(const k in packProgress){if(packProgress[k]===true)packProgress[k]={cleared:true,stars:0};}})();
// Auto-unlock all stages with 0 stars (big coins reset)
(function(){STAGE_PACKS.forEach(p=>p.stages.forEach(s=>{packProgress[s.id]={cleared:true,stars:0};}));localStorage.setItem('gd5pp',JSON.stringify(packProgress));})();
function getPackStageStars(stageId){return (packProgress[stageId]&&packProgress[stageId].stars)||0;}
function getTotalStars(){let t=0;for(const k in packProgress)t+=(packProgress[k].stars||0);return t;}
let totalStars=getTotalStars();
let isPackMode=false,currentPackIdx=0,currentPackStageIdx=0,currentPackStage=null,stageRng=null;
var stageSpawnRng=null; // seeded RNG for enemy/gimmick spawning in stage mode
var stageCeilRng=null; // seeded RNG for ceiling platform generation (separate from floor)
function packRng(){return isPackMode&&stageSpawnRng?stageSpawnRng():Math.random();}
let stageSelScroll=0,stageSelTarget=0;
let gotNewStars=0; // how many new stars obtained this clear
// Death markers for stage mode: {stageId: {dist, gDir}} — records where player last died
let stageDeathMarks={};
// Checkpoint system: {stageId: true} for stages with checkpoint reached
let stageCheckpoints=JSON.parse(localStorage.getItem('gd5checkpoints')||'{}');
let stageResetConfirm=false; // true when showing reset confirmation modal
let checkpointReached=false; // true when player passed the checkpoint flag in current run
let checkpointFlag={x:0,collected:false}; // checkpoint flag position in current stage
let useCheckpoint=false; // true when starting from checkpoint
let stageStartChoice=''; // 'start'|'checkpoint' — selection before stage begins
let showStartChoice=false; // show start choice modal
let pendingPackPi=-1,pendingPackSi=-1; // pending stage to start after choice
// Ambient particles for stage themes
let ambientParts=[];
// Challenge mode (boss rush)
let isChallengeMode=false;
let challengeKills=0; // total bosses defeated
let challengePhase=0; // difficulty phase (increases every 3 kills)
let challengeRetired=false; // true if player retired (vs died)
let challengeNextBossT=0; // countdown timer between bosses
let challengeBestKills=parseInt(localStorage.getItem('gd5challBest')||'0');
// Challenge ranking cosmetics (captured at time of best kills)
let challRankChar=parseInt(localStorage.getItem('gd5challRankChar')||'-1');
let challRankSkin=localStorage.getItem('gd5challRankSkin')||'';
let challRankEyes=localStorage.getItem('gd5challRankEyes')||'';
let challRankFx=localStorage.getItem('gd5challRankFx')||'';
// Challenge boss queue (pre-generated wave order)
let challBossQueue=[]; // [{type,type2,strength,isDual}]
let challQueueIdx=0; // current position in queue
// Challenge transition state (blackout between waves)
let challTransition={
  active:false, timer:0, waveNum:0
};

// Generate challenge boss queue: structured wave progression
function generateChallBossQueue(){
  const types=['wizard','bruiser','guardian','dodge'];
  function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  // All C(4,2)=6 unique pairs
  const pairs=[];
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)pairs.push([types[i],types[j]]);
  const q=[];
  // Wave 1-4: single, strength 1
  shuffle(types.slice()).forEach(t=>q.push({type:t,type2:null,strength:1,isDual:false}));
  // Wave 5-8: single, strength 2
  shuffle(types.slice()).forEach(t=>q.push({type:t,type2:null,strength:2,isDual:false}));
  // Wave 9-14: dual, strength 1
  shuffle(pairs.slice()).forEach(p=>q.push({type:p[0],type2:p[1],strength:1,isDual:true}));
  // Wave 15-20: dual, strength 2
  shuffle(pairs.slice()).forEach(p=>q.push({type:p[0],type2:p[1],strength:2,isDual:true}));
  // Wave 21-26: dual, strength 3
  shuffle(pairs.slice()).forEach(p=>q.push({type:p[0],type2:p[1],strength:3,isDual:true}));
  return q;
}
function extendChallBossQueue(){
  const types=['wizard','bruiser','guardian','dodge'];
  function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  const pairs=[];
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)pairs.push([types[i],types[j]]);
  // Extend with 6 more dual strength 3
  shuffle(pairs.slice()).forEach(p=>challBossQueue.push({type:p[0],type2:p[1],strength:3,isDual:true}));
}

// ===== STATE =====
const ST={TITLE:0,PLAY:1,DEAD:2,PAUSE:3,STAGE_CLEAR:4,STAGE_SEL:5,COUNTDOWN:6,LOGIN:7,TUTORIAL:8};
// Login & tutorial
let playerName=localStorage.getItem('gd5username')||'';
let tutorialDone=localStorage.getItem('gd5tutorialDone')==='1';
let state=playerName?ST.TITLE:ST.LOGIN;
// Login UI (HTML overlay)
let loginT=0;
const loginOverlay=document.getElementById('loginOverlay');
const nameInput=document.getElementById('nameInput');
const loginBtn=document.getElementById('loginBtn');
if(!playerName)loginOverlay.classList.add('active');
// Stars for login overlay
(function(){const sc=loginOverlay.querySelector('.stars');
  for(let i=0;i<30;i++){const s=document.createElement('div');s.className='star';
    s.style.cssText='left:'+Math.random()*100+'%;top:'+Math.random()*100+'%;width:'+(1+Math.random()*2)+'px;height:'+(1+Math.random()*2)+'px;animation-delay:'+(Math.random()*3)+'s;animation-duration:'+(1.5+Math.random()*2)+'s';
    sc.appendChild(s);}
})();
// Tutorial state
let tutStep=0; // current checkpoint index
let tutStepT=0; // frames at current checkpoint
let tutDone=false; // current step action completed
let tutEnemySpawned=false;
let tutScrollX=0; // camera scroll offset
let tutSpeed=0; // current scroll speed
let tutWaiting=false; // stopped at checkpoint
let tutPhase='scroll'; // 'scroll','wait','action','success','transition'
let tutSuccessT=0;
let tutFlipCount=0; // for double-flip step
let tutCoursePlats=[]; // generated floor platforms for tutorial
let tutCourseCeil=[]; // generated ceiling platforms
let tutCourseSpikes=[]; // spike obstacles
let tutWarpT=0; // warp transition timer (0=inactive, >0=animating)
let tutWarpPhase=''; // 'welcome','warp' - welcome screen then warp animation
let tutIsIntro=false; // true when showing intro before tutorial gameplay
let tutFreezePlayer=false; // freeze player mid-air during double-flip
let screenFadeIn=0; // white overlay fade-in timer for screen transitions
let countdownT=0; // countdown timer (frames, counts down from 180 = 3 seconds)
let score=0,highScore=parseInt(localStorage.getItem('gd5hi')||'0');
// Ranking cosmetics: captured at time of high score
let rankChar=parseInt(localStorage.getItem('gd5rankChar')||'-1');
let rankSkin=localStorage.getItem('gd5rankSkin')||'';
let rankEyes=localStorage.getItem('gd5rankEyes')||'';
let rankFx=localStorage.getItem('gd5rankFx')||'';
let newHi=false,speed=SPEED_INIT,frame=0,deadT=0,titleT=0;
let combo=0,comboT=0,comboDsp=0,comboDspT=0;
let airCombo=0; // aerial enemy kill combo (resets on grounded)
let stompCombo=0; // consecutive stomp combo (resets on grounded)
let shakeX=0,shakeY=0,shakeI=0;
let mileT=0,mileTxt='',lastMile=0;
let pops=[],totalCoins=0,totalFlips=0,maxCombo=0,flipCount=0,flipTimer=999;
let played=parseInt(localStorage.getItem('gd5plays')||'0');
let freeRevivesUsed=parseInt(localStorage.getItem('gd5freeRevives')||'0'); // new users get 5 free revives
let dist=0;
let rawDist=0; // pure traversal distance (no bonuses) - used for boss timing
let speedOffset=0; // distance offset for speed calculation (reset on continue)
let hp=HP_MAX,hurtT=0; // hit points and hurt invincibility timer

// Active item effects
let itemEff={invincible:0,magnet:0,slowmo:0};
let djumpAvailable=false; // double jump (Bounce trait or item)
let djumpUsed=false; // track if the double jump was used
let bombCount=0; // bombs in inventory
let bombFlashT=0; // bomb explosion flash timer
let magmaHurtT=0; // magma damage red flash timer
let invCount=0; // stockable invincibility items in inventory
let bossRetry=null; // {score,bossCount} saved when quitting during boss
let isRetryGame=false; // true if current game is a boss retry (only 1 retry allowed)
let usedContinue=false; // true after using coin continue (only 1 allowed per run)
// Treasure chest system
let bossChests=0; // number of chests earned this run (before death transfer)
let runChests=0; // chests earned this run (preserved for dead screen)
let chestFall={active:false,x:0,y:0,vy:0,sparkT:0,gotT:0}; // falling chest during boss reward
let chestOpen={phase:'none',t:0,charIdx:-1,parts:[],reward:null}; // chest opening modal
let totalChestsOpened=parseInt(localStorage.getItem('gd5chestTotal')||'0'); // lifetime chest count
let storedChests=parseInt(localStorage.getItem('gd5storedChests')||'0'); // inventory chest count
let inventoryOpen=false; // inventory modal on title screen
let deadChestOpen=false; // chest opening from game over screen
let deadChestsOpened=0; // how many chests opened on dead screen so far
let chestBatchMode=false; // batch opening all chests
let chestBatchResults=[]; // collected results for batch summary
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
  d.charIdx=selChar;
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
  // Reinit when selected character changes
  if(d.charIdx!==selChar){initDemo();return;}
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
    const dx=d.px-e.x,dy=d.py-e.y,dsq=dx*dx+dy*dy,dist=Math.sqrt(dsq);
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
    const cthr=pr+c.sz+8;if(dx*dx+dy*dy<cthr*cthr){c.x=-999;d.score++;}
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
// Coin tiers: color and multiplier change based on score
const COIN_TIERS=[
  {min:0,    col:'#ffd700',glow:'#ffd70055',sparkCol:'#ffd700',mul:1,   name:'gold'},
  {min:5000, col:'#ff8c00',glow:'#ff8c0055',sparkCol:'#ff8c00',mul:1.5, name:'orange'},
  {min:10000,col:'#ff69b4',glow:'#ff69b455',sparkCol:'#ff69b4',mul:2,   name:'pink'},
  {min:15000,col:'#ff2020',glow:'#ff202055',sparkCol:'#ff2020',mul:2.5, name:'red'}
];
let _coinTierCache=null,_coinTierScore=-1;
function getCoinTier(){if(score===_coinTierScore&&_coinTierCache)return _coinTierCache;_coinTierScore=score;for(let i=COIN_TIERS.length-1;i>=0;i--)if(score>=COIN_TIERS[i].min){_coinTierCache=COIN_TIERS[i];return _coinTierCache;}_coinTierCache=COIN_TIERS[0];return _coinTierCache;}
let coinSwitches=[],coinSwitchCD=0;
const COIN_SW_R=12,COIN_SW_COL='#4488ff';

// ===== SHOP SYSTEM =====
const SHOP_ITEMS={
  skins:[
    {id:'skin_red',name:'\u30ec\u30c3\u30c9',col:'#ff4444',col2:'#cc2222',price:3000,desc:'\u60c5\u71b1\u306e\u8d64'},
    {id:'skin_gold',name:'\u30b4\u30fc\u30eb\u30c9',col:'#ffd700',col2:'#cc9900',price:10000,desc:'\u8f1d\u304f\u9ec4\u91d1'},
    {id:'skin_pink',name:'\u30d4\u30f3\u30af',col:'#ff69b4',col2:'#cc4488',price:5000,desc:'\u304b\u308f\u3044\u3044\u30d4\u30f3\u30af'},
    {id:'skin_emerald',name:'\u30a8\u30e1\u30e9\u30eb\u30c9',col:'#50c878',col2:'#2a9d5c',price:6000,desc:'\u5b9d\u77f3\u306e\u7dd1'},
    {id:'skin_ice',name:'\u30a2\u30a4\u30b9',col:'#88ddff',col2:'#55aadd',price:4000,desc:'\u6c37\u306e\u30d6\u30eb\u30fc'},
    {id:'skin_shadow',name:'\u30b7\u30e3\u30c9\u30a6',col:'#2a2a3e',col2:'#111122',price:16000,desc:'\u6f06\u9ed2\u306e\u95c7'},
    {id:'skin_sunset',name:'\u30b5\u30f3\u30bb\u30c3\u30c8',col:'#ff6b35',col2:'#cc4411',price:8000,desc:'\u5915\u713c\u3051\u306e\u30aa\u30ec\u30f3\u30b8'},
    {id:'skin_galaxy',name:'\u30ae\u30e3\u30e9\u30af\u30b7\u30fc',col:'#7b2fbe',col2:'#4a1a7a',price:20000,desc:'\u5b87\u5b99\u306e\u7d2b',rarity:'rare'},
    {id:'skin_chrome',name:'\u30af\u30ed\u30e0',col:'#c0c0c0',col2:'#888888',price:12000,desc:'\u30e1\u30bf\u30ea\u30c3\u30af\u30b7\u30eb\u30d0\u30fc'},
    {id:'skin_rainbow',name:'\u30ec\u30a4\u30f3\u30dc\u30fc',col:'rainbow',col2:'rainbow',price:30000,desc:'\u8679\u8272\u306b\u5149\u308b\uff01',rarity:'super_rare'},
    {id:'skin_plasma',name:'\u30d7\u30e9\u30ba\u30de',col:'#ff00ff',col2:'#aa00aa',price:24000,desc:'\u30d7\u30e9\u30ba\u30de\u30a8\u30cd\u30eb\u30ae\u30fc',rarity:'rare'},
    {id:'skin_void',name:'\u30f4\u30a9\u30a4\u30c9',col:'#0a0a1a',col2:'#000005',price:40000,desc:'\u865a\u7121\u306e\u6f06\u9ed2',rarity:'rare'},
    {id:'skin_skeleton',name:'\u30b9\u30b1\u30eb\u30c8\u30f3',col:'skeleton',col2:'skeleton',price:50000,desc:'\u900f\u304d\u901a\u308b\u5e7b\u5f71',rarity:'super_rare'},
    {id:'skin_aurora',name:'\u30aa\u30fc\u30ed\u30e9',col:'aurora',col2:'aurora',price:28000,desc:'\u6975\u5149\u304c\u63fa\u3089\u3081\u304f',rarity:'rare',gachaOnly:true,newItem:true},
    {id:'skin_inferno',name:'\u30a4\u30f3\u30d5\u30a7\u30eb\u30ce',col:'#ff2200',col2:'#880000',price:26000,desc:'\u707c\u71b1\u306e\u696d\u706b',rarity:'rare',gachaOnly:true,newItem:true},
    {id:'skin_hologram',name:'\u30db\u30ed\u30b0\u30e9\u30e0',col:'hologram',col2:'hologram',price:60000,desc:'\u6b21\u5143\u3092\u8d85\u3048\u308b\u5149\u4f53',rarity:'super_rare',gachaOnly:true,newItem:true},
  ],
  eyes:[
    {id:'eye_smile',name:'\u30b9\u30de\u30a4\u30eb\u30a2\u30a4',type:'smile',price:3000,desc:'\u306b\u3063\u3053\u308a\u7b11\u9854'},
    {id:'eye_angry',name:'\u30a2\u30f3\u30b0\u30ea\u30fc\u30a2\u30a4',type:'angry',price:12000,desc:'\ud83d\udca2 \u304b\u308f\u3044\u3044\u6012\u308a\u9854',rarity:'rare'},
    {id:'eye_star',name:'\u30b9\u30bf\u30fc\u30a2\u30a4',type:'star',price:7000,desc:'\u661f\u5f62\u306e\u77b3'},
    {id:'eye_heart',name:'\u30cf\u30fc\u30c8\u30a2\u30a4',type:'heart',price:6000,desc:'\u30cf\u30fc\u30c8\u578b\u306e\u77b3'},
    {id:'eye_fire',name:'\u30d5\u30a1\u30a4\u30a2\u30a2\u30a4',type:'fire',price:10000,desc:'\u71c3\u3048\u308b\u8d64\u3044\u76ee'},
    {id:'eye_cat',name:'\u30ad\u30e3\u30c3\u30c8\u30a2\u30a4',type:'cat',price:4000,desc:'\u7e26\u9577\u306e\u732b\u76ee'},
    {id:'eye_spiral',name:'\u30b0\u30eb\u30b0\u30eb\u30a2\u30a4',type:'spiral',price:8000,desc:'\u6e26\u5dfb\u304d\u306e\u76ee'},
    {id:'eye_cyber',name:'\u30b5\u30a4\u30d0\u30fc\u30a2\u30a4',type:'cyber',price:12000,desc:'\u96fb\u5b50\u306e\u77b3'},
    {id:'eye_diamond',name:'\u30c0\u30a4\u30a2\u30a2\u30a4',type:'diamond',price:16000,desc:'\u30c0\u30a4\u30e4\u306e\u8f1d\u304d',rarity:'rare'},
    {id:'eye_void',name:'\u30f4\u30a9\u30a4\u30c9\u30a2\u30a4',type:'void',price:24000,desc:'\u865a\u7121\u306e\u6f06\u9ed2',rarity:'rare'},
    {id:'eye_galaxy',name:'\u30ae\u30e3\u30e9\u30af\u30b7\u30fc\u30a2\u30a4',type:'galaxy',price:30000,desc:'\u661f\u96f2\u306e\u77b3',rarity:'rare'},
    {id:'eye_glitch',name:'\u30b0\u30ea\u30c3\u30c1\u30a2\u30a4',type:'glitch',price:36000,desc:'\u30d0\u30b0\u3063\u305f\u77b3',rarity:'rare'},
    {id:'eye_blink',name:'\u30d6\u30ea\u30f3\u30af\u30a2\u30a4',type:'blink',price:50000,desc:'\u77ac\u304d\u3059\u308b\u751f\u304d\u305f\u77b3',rarity:'super_rare',newItem:true},
    {id:'eye_pulse',name:'\u30d1\u30eb\u30b9\u30a2\u30a4',type:'pulse',price:22000,desc:'\u8108\u6253\u3064\u3088\u3046\u306b\u5149\u308b\u77b3',rarity:'rare',gachaOnly:true,newItem:true},
    {id:'eye_cross',name:'\u30af\u30ed\u30b9\u30a2\u30a4',type:'cross',price:20000,desc:'\u5341\u5b57\u306b\u5149\u308b\u795e\u79d8\u306e\u77b3',rarity:'rare',gachaOnly:true,newItem:true},
    {id:'eye_hypno',name:'\u30d2\u30d7\u30ce\u30a2\u30a4',type:'hypno',price:55000,desc:'\u5e7b\u60d1\u306e\u6e26\u5dfb\u304d\u30a2\u30cb\u30e1\u77b3',rarity:'super_rare',gachaOnly:true,newItem:true},
  ],
  effects:[
    {id:'fx_sparkle',name:'\u30ad\u30e9\u30ad\u30e9',type:'sparkle',price:8000,desc:'\u5149\u306e\u7c92\u5b50\u304c\u821e\u3046'},
    {id:'fx_fire_aura',name:'\u708e\u30aa\u30fc\u30e9',type:'fire_aura',price:14000,desc:'\u8d64\u3044\u708e\u306e\u30aa\u30fc\u30e9'},
    {id:'fx_ice_aura',name:'\u6c37\u30aa\u30fc\u30e9',type:'ice_aura',price:14000,desc:'\u9752\u3044\u6c37\u306e\u30aa\u30fc\u30e9'},
    {id:'fx_electric',name:'\u96fb\u6483',type:'electric',price:18000,desc:'\u96fb\u6c17\u304c\u8d70\u308b'},
    {id:'fx_hearts',name:'\u30cf\u30fc\u30c8',type:'hearts',price:6000,desc:'\u30cf\u30fc\u30c8\u304c\u6d6e\u304b\u3076'},
    {id:'fx_shadow',name:'\u30c0\u30fc\u30af\u30aa\u30fc\u30e9',type:'shadow',price:20000,desc:'\u95c7\u306e\u30aa\u30fc\u30e9',rarity:'rare'},
    {id:'fx_rainbow',name:'\u30ec\u30a4\u30f3\u30dc\u30fc\u30aa\u30fc\u30e9',type:'rainbow',price:30000,desc:'\u8679\u8272\u306b\u5149\u308b\u30aa\u30fc\u30e9',rarity:'rare'},
    {id:'fx_sakura',name:'\u685c\u5439\u96ea',type:'sakura',price:10000,desc:'\u685c\u306e\u82b1\u3073\u3089\u304c\u821e\u3046'},
    {id:'fx_star_trail',name:'\u661f\u306e\u8ecc\u8de1',type:'star_trail',price:24000,desc:'\u661f\u304c\u6d41\u308c\u308b\u8ecc\u8de1',rarity:'rare'},
    {id:'fx_plasma_trail',name:'\u30d7\u30e9\u30ba\u30de\u30c8\u30ec\u30a4\u30eb',type:'plasma_trail',price:32000,desc:'\u30d7\u30e9\u30ba\u30de\u306e\u8ecc\u8de1',rarity:'rare'},
    {id:'fx_void_aura',name:'\u30f4\u30a9\u30a4\u30c9\u30aa\u30fc\u30e9',type:'void_aura',price:40000,desc:'\u865a\u7121\u306e\u30aa\u30fc\u30e9',rarity:'rare'},
    {id:'fx_celestial',name:'\u30bb\u30ec\u30b9\u30c6\u30a3\u30a2\u30eb',type:'celestial',price:60000,desc:'\u5929\u754c\u306e\u795e\u8056\u306a\u30aa\u30fc\u30e9',rarity:'super_rare'},
    {id:'fx_phoenix',name:'\u30d5\u30a7\u30cb\u30c3\u30af\u30b9',type:'phoenix',price:28000,desc:'\u4e0d\u6b7b\u9ce5\u306e\u7fbd\u304c\u821e\u3046',rarity:'rare',gachaOnly:true,newItem:true},
    {id:'fx_glitch_trail',name:'\u30b0\u30ea\u30c3\u30c1\u30c8\u30ec\u30a4\u30eb',type:'glitch_trail',price:26000,desc:'\u30ce\u30a4\u30ba\u304c\u8d70\u308b\u8ecc\u8de1',rarity:'rare',gachaOnly:true,newItem:true},
    {id:'fx_supernova',name:'\u30b9\u30fc\u30d1\u30fc\u30ce\u30f4\u30a1',type:'supernova',price:65000,desc:'\u8d85\u65b0\u661f\u7206\u767a\u306e\u30aa\u30fc\u30e9',rarity:'super_rare',gachaOnly:true,newItem:true},
  ]
};
// Shop state
let shopOpen=false;
let shopTab=0; // 0=skins, 1=eyes, 2=effects
let shopScroll=0;
// Owned items & equipped cosmetics (saved to localStorage)
let ownedItems=JSON.parse(localStorage.getItem('gd5owned')||'[]');
let equippedSkin=localStorage.getItem('gd5eqSkin')||'';
let equippedEyes=localStorage.getItem('gd5eqEyes')||'';
let equippedEffect=localStorage.getItem('gd5eqFx')||'';
let cosmeticMenuOpen=false; // cosmetic equip menu
let cosmeticTab=0; // 0=skins, 1=eyes, 2=effects
let cosmeticScroll=0;
// --- Notification badges ---
let notifNewCosmetic=localStorage.getItem('gd5notifCosm')==='1'; // new cosmetic obtained
let newCosmeticIds=new Set(JSON.parse(localStorage.getItem('gd5newCosm')||'[]')); // individual new cosmetic IDs
let notifNewChars=JSON.parse(localStorage.getItem('gd5notifChars')||'[]'); // newly unlocked char indices
let notifNewHighScore=localStorage.getItem('gd5notifHi')==='1'; // new high score achieved
// Shop purchase confirmation & gacha animation
let shopConfirm=null; // {item, tab} when confirm dialog shown
let shopPurchaseAnim=null; // {item, tab, t, parts} when purchase animation playing
let shopEquipPrompt=null; // {item, tab} shown after purchase to ask equip now or not
// Cosmetic equip confirmation
let cosmeticConfirm=null; // {item, tab} when equip confirm dialog shown
// Pending item tap (deferred to touchend to avoid scroll-tap conflict)
let shopPendingTap=null; // {idx} set on touchstart, confirmed on touchend
let cosmeticPendingTap=null; // {idx} set on touchstart, confirmed on touchend
function ownsItem(id){return ownedItems.includes(id);}
function buyItem(id,price){
  if(ownsItem(id)||walletCoins<price)return false;
  walletCoins-=price;localStorage.setItem('gd5wallet',walletCoins.toString());
  ownedItems.push(id);localStorage.setItem('gd5owned',JSON.stringify(ownedItems));
  // Notification badge for new cosmetic
  notifNewCosmetic=true;localStorage.setItem('gd5notifCosm','1');
  newCosmeticIds.add(id);localStorage.setItem('gd5newCosm',JSON.stringify([...newCosmeticIds]));
  if(typeof fbSaveUserData==='function')fbSaveUserData();
  return true;
}
function captureRankCosmetics(){
  rankChar=selChar||0;rankSkin=equippedSkin||'';rankEyes=equippedEyes||'';rankFx=equippedEffect||'';
  localStorage.setItem('gd5rankChar',rankChar.toString());localStorage.setItem('gd5rankSkin',rankSkin);
  localStorage.setItem('gd5rankEyes',rankEyes);localStorage.setItem('gd5rankFx',rankFx);
}
function equipSkin(id){equippedSkin=id;localStorage.setItem('gd5eqSkin',id);if(typeof fbSaveUserData==='function')fbSaveUserData();}
function equipEyes(id){equippedEyes=id;localStorage.setItem('gd5eqEyes',id);if(typeof fbSaveUserData==='function')fbSaveUserData();}
function equipEffect(id){equippedEffect=id;localStorage.setItem('gd5eqFx',id);if(typeof fbSaveUserData==='function')fbSaveUserData();}
function unequipSkin(){equippedSkin='';localStorage.setItem('gd5eqSkin','');if(typeof fbSaveUserData==='function')fbSaveUserData();}
function unequipEyes(){equippedEyes='';localStorage.setItem('gd5eqEyes','');if(typeof fbSaveUserData==='function')fbSaveUserData();}
function unequipEffect(){equippedEffect='';localStorage.setItem('gd5eqFx','');if(typeof fbSaveUserData==='function')fbSaveUserData();}
let _eqSkinCache=null,_eqSkinId='',_eqEyesCache=null,_eqEyesId='',_eqFxCache=null,_eqFxId='';
function getEquippedSkinData(){if(!equippedSkin)return null;if(_eqSkinId===equippedSkin)return _eqSkinCache;_eqSkinId=equippedSkin;for(let i=0;i<SHOP_ITEMS.skins.length;i++){if(SHOP_ITEMS.skins[i].id===equippedSkin){_eqSkinCache=SHOP_ITEMS.skins[i];return _eqSkinCache;}}_eqSkinCache=null;return null;}
function getEquippedEyesData(){if(!equippedEyes)return null;if(_eqEyesId===equippedEyes)return _eqEyesCache;_eqEyesId=equippedEyes;for(let i=0;i<SHOP_ITEMS.eyes.length;i++){if(SHOP_ITEMS.eyes[i].id===equippedEyes){_eqEyesCache=SHOP_ITEMS.eyes[i];return _eqEyesCache;}}_eqEyesCache=null;return null;}
function getEquippedEffectData(){if(!equippedEffect)return null;if(_eqFxId===equippedEffect)return _eqFxCache;_eqFxId=equippedEffect;for(let i=0;i<SHOP_ITEMS.effects.length;i++){if(SHOP_ITEMS.effects[i].id===equippedEffect){_eqFxCache=SHOP_ITEMS.effects[i];return _eqFxCache;}}_eqFxCache=null;return null;}
// Sort shop items: cheap→expensive (normal), then rare by price, then super_rare at bottom
function shopSorted(arr,includeGacha){const rVal=r=>r==='super_rare'?2:r==='rare'?1:0;const filtered=includeGacha?arr.slice():arr.filter(it=>!it.gachaOnly);return filtered.sort((a,b)=>{const ra=rVal(a.rarity),rb=rVal(b.rarity);if(ra!==rb)return ra-rb;return(a.price||0)-(b.price||0);});}
