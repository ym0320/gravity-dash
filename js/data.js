'use strict';
const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
// Performance: shadowBlur is extremely expensive on Canvas 2D.
// Disable it on ALL platforms. Use glow-simulation techniques instead.
Object.defineProperty(ctx,'shadowBlur',{set(){},get(){return 0;},configurable:true});
const MAX_W=430;
const MAX_H=844;
let W,H,safeTop=0,safeBot=0;
// _appDpr: canvas DPR used by resize() and draw(). Both must match to avoid zoom bugs.
let _appDpr=1;
function resize(){
  // Cap DPR: WebView uses 1.5 (lighter), browser uses 2
  // Higher DPR means more pixels to draw per frame — a major FPS cost
  const _maxDpr=window.ReactNativeWebView?1.5:2;
  _appDpr=Math.min(window.devicePixelRatio||1,_maxDpr);
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
  canvas.width=W*_appDpr;canvas.height=H*_appDpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  ctx.setTransform(_appDpr,0,0,_appDpr,0,0);
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
const BOSS_INTERVAL=600; // rawDist interval between boss battles
const GAME_VERSION='2.22.190';

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
  // 10000-10999: 深紫 — ダークマター次元
  {bg1:'#0e0420',bg2:'#1a0838',gnd:'#2c1058',gnd2:'#220c48',line:'#7820d0',ply:'#d946ef',obs:'#22d3ee',n:'ダークマター'},
  // 11000-11999: ブラッドレッド — 血の魔城
  {bg1:'#200004',bg2:'#380008',gnd:'#560010',gnd2:'#44000c',line:'#c80020',ply:'#ff6080',obs:'#a3e635',n:'ブラッドキャッスル'},
  // 12000-12999: コバルト — 電磁嵐
  {bg1:'#020c22',bg2:'#04183c',gnd:'#082c60',gnd2:'#062050',line:'#1050e0',ply:'#60a8ff',obs:'#fb923c',n:'エレクトリック'},
  // 13000-13999: 白銀 — 天空神殿
  {bg1:'#101028',bg2:'#1c1c40',gnd:'#2c2c60',gnd2:'#24244e',line:'#9898c8',ply:'#e8f0ff',obs:'#f43f5e',n:'ヘブンズゲート'},
  // 14000+: 金×白 — 伝説の頂点
  {bg1:'#0c0a00',bg2:'#1a1600',gnd:'#2a2000',gnd2:'#201800',line:'#d8a820',ply:'#ffe880',obs:'#ff2060',n:'レジェンド'},
  // 15000-15999: ティールネオン — 深海電脳都市
  {bg1:'#02161a',bg2:'#05303a',gnd:'#0c4a56',gnd2:'#083742',line:'#1dd3b0',ply:'#7df9ff',obs:'#ff5a5f',n:'ネオンアビス'},
  // 16000-16999: ローズゴールド — 灼けた宮殿
  {bg1:'#24100e',bg2:'#3f1e1b',gnd:'#6a3429',gnd2:'#54271f',line:'#ff9b71',ply:'#ffd166',obs:'#7c4dff',n:'ローズパレス'},
  // 17000-17999: ライムストーム — 酸性雷域
  {bg1:'#121a02',bg2:'#223506',gnd:'#36560d',gnd2:'#294309',line:'#b8f12f',ply:'#f4ff7a',obs:'#00c2ff',n:'ライムストーム'},
  // 18000-18999: サファイアノワール — 冷たい最終夜
  {bg1:'#040814',bg2:'#0b1430',gnd:'#13244f',gnd2:'#0f1c3c',line:'#6ea8fe',ply:'#c7e0ff',obs:'#ff7bcb',n:'サファイアノワール'},
  // 19000+: 白熱スペクトラム — 超高密度の終着点
  {bg1:'#12040e',bg2:'#24081b',gnd:'#401033',gnd2:'#32102a',line:'#ff4fd8',ply:'#fff08a',obs:'#00f0ff',n:'スペクトラム'},
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
   trait:'\u30D0\u30E9\u30F3\u30B9\u578B',desc:'\u901F\u5EA6\u30FB\u30B8\u30E3\u30F3\u30D7\u30FB\u30B3\u30A4\u30F3\u5C11\u3057UP',jumpMul:1.03,speedMul:1.03,sizeMul:1,gravMul:1,coinMul:1.05,coinMag:0,maxFlip:2,startShield:false,fastKill:false,price:0},
  {name:'\u30D0\u30A6\u30F3\u30B9',shape:'ball',col:'#ff6b6b',col2:'#e04040',eye:'#fff',pupil:'#2a0a0a',
   trait:'2\u6BB5\u30B8\u30E3\u30F3\u30D7\u578B',desc:'\u5E38\u66422\u6BB5\u30B8\u30E3\u30F3\u30D7',jumpMul:1.05,speedMul:0.95,sizeMul:1.05,gravMul:0.92,coinMul:1,coinMag:0,maxFlip:2,startShield:false,fastKill:false,hasDjump:true,price:50},
  {name:'\u30BF\u30A4\u30E4',shape:'tire',col:'#555555',col2:'#333333',eye:'#fff',pupil:'#111',
   trait:'\u8D70\u884C\u578B',desc:'\u6BB5\u5DEE\u4E57\u8D8A+\u5C0F\u6E9D\u901A\u904E',jumpMul:0.95,speedMul:1.12,sizeMul:1,gravMul:1,coinMul:1,coinMag:0,maxFlip:2,startShield:false,fastKill:false,price:80},
  {name:'\u30B4\u30FC\u30B9\u30C8',shape:'ghost',col:'#a855f7',col2:'#8b3fe0',eye:'#fff',pupil:'#1a0a30',
   trait:'\u56DE\u907F\u578B',desc:'\u900F\u660E\u5316\u56DE\u907F+\u30B7\u30FC\u30EB\u30C9',jumpMul:1,speedMul:1,sizeMul:0.88,gravMul:1,coinMul:1,coinMag:0,maxFlip:2,startShield:true,fastKill:false,price:120},
  {name:'\u30CB\u30F3\u30B8\u30E3',shape:'ninja',col:'#34d399',col2:'#20b878',eye:'#ff4444',pupil:'#000',
   trait:'\u6A5F\u52D5\u578B',desc:'\u30B8\u30E3\u30F3\u30D7\u529B\u2191+3\u56DE\u53CD\u8EE2',jumpMul:1.08,speedMul:1.05,sizeMul:1,gravMul:1,coinMul:1,coinMag:0,maxFlip:3,startShield:false,fastKill:false,price:150},
  {name:'\u30B9\u30C8\u30FC\u30F3',shape:'stone',col:'#8B8B8B',col2:'#6B6B6B',eye:'#fff',pupil:'#333',
   trait:'\u9632\u5FA1\u578B',desc:'HP+1\u3067\u8010\u4E45\u529B\u2191',jumpMul:0.9,speedMul:0.95,sizeMul:1.15,gravMul:1.15,coinMul:1,coinMag:0,maxFlip:2,startShield:false,fastKill:false,hpBonus:1,price:200},
];
function ct(){return CHARS[selChar];}
function maxHp(){return HP_MAX+(ct().hpBonus||0);}
const ITEM_INVINCIBLE_DURATION=600;
const ITEM_MAGNET_DURATION=600;
const SPECIAL_GAUGE_MAX=100;
const SPECIAL_DURATION=ITEM_MAGNET_DURATION;
const SPECIAL_TIME_GAIN=0.006;
const SPECIAL_DISTANCE_GAIN=0.018;
const SPECIAL_COIN_GAIN=0.35;
const SPECIAL_COIN_TIER_FACTOR=0.25;
const SPECIAL_ITEM_GAIN=1.2;
const SPECIAL_COMBO_GAIN=0.04;
const SPECIAL_KILL_GAIN=2.5;
const SPECIAL_STOMP_GAIN=4;
const SPECIAL_GHOST_MAGNET_RADIUS=90;
const SPECIAL_GHOST_MAGNET_STRENGTH=0.08;
const GHOST_PASSIVE_COIN_RADIUS=80; // slightly wider passive pull
const GHOST_PASSIVE_COIN_STRENGTH=0.07;
const SPECIAL_TIRE_MAGNET_RADIUS=270;
const SPECIAL_TIRE_MAGNET_STRENGTH=0.07;
const GHOST_PHASE_DURATION=120;
let specialModeEnabled=true;
function createSpecialState(){
  return {
    gauge:0,
    active:false,
    type:'',
    t:0,
    requested:false,
    requestSource:'',
    forced:false,
    bonusHpGranted:0,
    bonusHpCurrent:0,
    visualCharIdx:0,
    lastGainAt:0,
    hintT:0
  };
}
let specialState=createSpecialState();
function saveSpecialModeEnabled(){
  specialModeEnabled=true;
}
function setSpecialModeEnabled(v){
  specialModeEnabled=true;
  saveSpecialModeEnabled();
}
function isSpecialModeEnabled(){
  return true;
}
function resetSpecialState(){
  const wasActive=specialState&&specialState.active;
  specialState=createSpecialState();
  if(wasActive){
    ghostInvis=false;
  }
}
function canChargeSpecial(){
  return isSpecialModeEnabled()&&state===ST.PLAY&&player&&player.alive&&!specialState.active&&!bossPhase.active&&!bossPhase.reward;
}
function canActivateSpecial(forced){
  return isSpecialModeEnabled()&&state===ST.PLAY&&player&&player.alive&&!specialState.active&&!bossPhase.active&&!bossPhase.reward&&((!!forced)||specialState.gauge>=SPECIAL_GAUGE_MAX);
}
function getSpecialType(){
  const shape=ct().shape||'cube';
  return shape==='ball'?'bounce':shape;
}
function isSpecialActive(type){
  return !!specialState.active&&(!type||specialState.type===type);
}
function queueSpecialActivation(source){
  specialState.requested=true;
  specialState.requestSource=source||'manual';
  return canActivateSpecial();
}
function clearSpecialActivationRequest(){
  specialState.requested=false;
  specialState.requestSource='';
}
function addSpecialGauge(amount){
  if(!canChargeSpecial()||!(amount>0))return false;
  const prev=specialState.gauge;
  specialState.gauge=Math.min(SPECIAL_GAUGE_MAX,specialState.gauge+amount);
  if(specialState.gauge>prev)specialState.lastGainAt=frame||0;
  return specialState.gauge>prev;
}
function addSpecialGaugeReward(amount){
  if(!isSpecialModeEnabled()||state!==ST.PLAY||!player||!player.alive||specialState.active||!(amount>0))return false;
  const prev=specialState.gauge;
  specialState.gauge=Math.min(SPECIAL_GAUGE_MAX,specialState.gauge+amount);
  if(specialState.gauge>prev)specialState.lastGainAt=frame||0;
  return specialState.gauge>prev;
}
function playerSizeMul(){
  return ct().sizeMul*(isSpecialActive('stone')?2:1);
}
function playerRadius(){
  return PLAYER_R*playerSizeMul();
}
function specialDamageImmune(){
  return isSpecialActive('cube');
}
function cubeSpecialActive(){
  return isSpecialActive('cube');
}
function cubeSpecialCoinMul(){
  return cubeSpecialActive()?2:1;
}
function cubeSpecialKillBonus(baseBonus){
  return cubeSpecialActive()?100:baseBonus;
}
function playerDamageImmune(){
  return itemEff.invincible>0||specialDamageImmune();
}
function specialGhostActive(){
  return isSpecialActive('ghost');
}
function playerCoinMagnetRadius(){
  if(isSpecialActive('tire'))return SPECIAL_TIRE_MAGNET_RADIUS;
  if(itemEff.magnet>0)return 180;
  if(isSpecialActive('ghost'))return SPECIAL_GHOST_MAGNET_RADIUS;
  if(ct().shape==='ghost')return GHOST_PASSIVE_COIN_RADIUS; // passive: coins only
  if(equippedPet==='pet_comet')return 50; // comet pet: gentle coin pull
  return ct().coinMag||0;
}
function playerCoinMagnetStrength(){
  if(isSpecialActive('tire'))return SPECIAL_TIRE_MAGNET_STRENGTH;
  if(itemEff.magnet>0)return 0.12;
  if(isSpecialActive('ghost'))return SPECIAL_GHOST_MAGNET_STRENGTH;
  if(ct().shape==='ghost')return GHOST_PASSIVE_COIN_STRENGTH; // passive
  if(equippedPet==='pet_comet')return 0.03; // 1/4 of magnet strength
  return ct().coinMag>0?0.06:0;
}
function playerItemMagnetRadius(){
  if(isSpecialActive('tire'))return SPECIAL_TIRE_MAGNET_RADIUS;
  if(isSpecialActive('ghost'))return SPECIAL_GHOST_MAGNET_RADIUS;
  return 0;
}
function playerItemMagnetStrength(){
  if(isSpecialActive('tire'))return SPECIAL_TIRE_MAGNET_STRENGTH;
  if(isSpecialActive('ghost'))return SPECIAL_GHOST_MAGNET_STRENGTH;
  return 0;
}
function currentGameplayBGM(){
  if(state!==ST.PLAY)return bgmCurrent||'play';
  if(itemEff.invincible>0||specialState.active)return 'fever';
  if(isChallengeMode)return 'challenge';
  if(bossPhase&&bossPhase.active)return 'boss';
  return 'play';
}
function syncGameplayBGM(force){
  const target=currentGameplayBGM();
  if(force||bgmCurrent!==target)switchBGM(target);
  return target;
}
function rescuePlayerFromForcedSpecial(){
  if(!player)return;
  const pr=playerRadius();
  const dir=player.gDir===-1?-1:1;
  const scanXs=[player.x,player.x-24,player.x+24,player.x-48,player.x+48,player.x-84,player.x+84];
  let surf=dir===1?H+200:-200;
  let found=false;
  for(let i=0;i<scanXs.length;i++){
    const sx=Math.max(pr+8,Math.min(W-pr-8,scanXs[i]));
    const sy=dir===1?floorSupportY(sx):ceilSupportY(sx);
    if(dir===1){
      if(sy<H+100&&(!found||Math.abs(sx-player.x)<Math.abs((player._rescueX||player.x)-player.x))){
        surf=sy;player._rescueX=sx;found=true;
      }
    } else if(sy>-100&&(!found||Math.abs(sx-player.x)<Math.abs((player._rescueX||player.x)-player.x))){
      surf=sy;player._rescueX=sx;found=true;
    }
  }
  player.x=found?player._rescueX:Math.max(pr+8,Math.min(W-pr-8,player.x));
  delete player._rescueX;
  if(found){
    player.y=dir===1?surf-pr:surf+pr;
    player.grounded=true;
  } else {
    player.y=dir===1?(H-GROUND_H-pr):(GROUND_H+pr);
    player.grounded=false;
  }
  player.vy=0;
  if(typeof resetFlipState==='function')resetFlipState();
  else refreshAirActionState(true);
}
function refreshAirActionState(resetJumpUsed){
  if(resetJumpUsed)djumpUsed=false;
  if(isSpecialActive('bounce')){
    djumpAvailable=true;
    if(resetJumpUsed)djumpUsed=false;
  } else {
    djumpAvailable=!!ct().hasDjump;
  }
  if(isSpecialActive('ninja'))player.canFlip=true;
}
function activateSpecialSkill(source,forced){
  if(!canActivateSpecial(forced))return false;
  specialState.active=true;
  specialState.type=getSpecialType();
  specialState.t=Math.round(SPECIAL_DURATION*(specialState.type==='cube'?1.5:1));
  specialState.gauge=0;
  specialState.hintT=240;
  specialState.forced=!!forced;
  specialState.visualCharIdx=selChar;
  specialState.bonusHpGranted=0;
  specialState.bonusHpCurrent=0;
  clearSpecialActivationRequest();
  if(forced){
    hurtT=Math.max(hurtT,HURT_INVINCIBLE);
    rescuePlayerFromForcedSpecial();
  }
  if(specialState.type==='stone'){
    specialState.bonusHpGranted=3;
    hp+=specialState.bonusHpGranted;
    specialState.bonusHpCurrent=3;
  }
  if(specialState.type==='ghost'){
    ghostInvis=true;
    ghostPhaseT=0;
  }
  if(typeof triggerPetReaction==='function')triggerPetReaction('special',Math.min(120,specialState.t));
  refreshAirActionState(true);
  if(state===ST.PLAY)syncGameplayBGM(true);
  return true;
}
function endSpecialSkill(silent){
  if(!specialState.active)return;
  const endingType=specialState.type;
  if(endingType==='stone'){
    hp=Math.max(0,hp-specialState.bonusHpCurrent);
    specialState.bonusHpCurrent=0;
    specialState.bonusHpGranted=0;
  }
  specialState.active=false;
  specialState.type='';
  specialState.t=0;
  specialState.forced=false;
  clearSpecialActivationRequest();
  if(endingType==='ghost'&&(!ct()||ct().shape!=='ghost')){
    ghostInvis=false;
  }
  refreshAirActionState(true);
  if(state===ST.PLAY)syncGameplayBGM(true);
  if(!silent&&hp<=0)hp=1;
}
function tryActivateSpecialSkill(source,forced){
  return activateSpecialSkill(source||'manual',forced);
}
let selChar=Math.max(0,Math.min(5,parseInt(localStorage.getItem('gd5char')||'0')||0));
let walletCoins=Math.max(0,Math.min(9999999,parseInt(localStorage.getItem('gd5wallet')||'0')||0));
let unlockedChars=(function(){try{const a=JSON.parse(localStorage.getItem('gd5unlocked')||'[0]');if(!Array.isArray(a))return[0];return a.filter(v=>typeof v==='number'&&v>=0&&v<=5);}catch(e){return[0];}})();
if(!unlockedChars.includes(0))unlockedChars.unshift(0);
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
let bgmVol=Math.max(0,Math.min(1,parseFloat(localStorage.getItem('gd5bgmVol')||'0.7')||0.7));
let sfxVol=Math.max(0,Math.min(1,parseFloat(localStorage.getItem('gd5sfxVol')||'0.7')||0.7));
let hapticEnabled=localStorage.getItem('gd5haptic')!=='0';
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
function _uh(){return[
  {ver:'2026-02-22',notes:[
    {title:t('uhCharBalance'),items:[
      t('uhTireNinjaSpeed'),t('uhNinjaBounceJump'),t('uhStoneGravity'),t('uhTireStep')
    ]},
    {title:t('uhStatusDisplay'),items:[
      t('uhSmoothBar'),t('uhDecimalValues'),t('uhCharDesc')
    ]},
    {title:t('uhChestImprove'),items:[
      t('uhBatchOpen'),t('uhRareDesign')
    ]},
    {title:t('uhShopImprove'),items:[
      t('uhSortCheap'),t('uhSecretBottom')
    ]}
  ]},
  {ver:'2026-02-15',notes:[
    {title:t('uhGameRelease'),items:[
      t('uhFirstRelease')
    ]}
  ]}
];}
const UPDATE_HISTORY=_uh();
const UPDATE_VER=UPDATE_HISTORY[0].ver;
const UPDATE_NOTES=UPDATE_HISTORY[0].notes;
let rankingOpen=false;
let rankingScroll=0;
let rankingScrollTarget=0;
let rankingTab='endless'; // 'endless' | 'challenge'
// Dynamic ranking data (cloud only, no sample data)
let RANKING_DATA=[];
let CHALLENGE_RANKING_DATA=[];
// DEBUG: サンプルランキングデータ（スクリーンショット用・リリース前に削除）
const _DEBUG_SAMPLE_RANKING=false;
const _SAMPLE_NAMES_EN=['xStarDust','MoonWalker','NightOwl','SakuraRin','ThunderBolt','GhostHunter','PixelKing','CosmicAce','TurboNinja','BounceQueen','ShadowFox','RollerX','IceBreaker','NovaFlash','HappyPanda','DarkMatter','CubeRookie','SpeedDemon','LuckyClover','StoneWall'];
const _SAMPLE_NAMES_JA=['ほしくず','ムーンウォーク','ヨルノフクロウ','さくらりん','カミナリ','ゴーストハンター','ドット王','コスモエース','しのび','バウンス姫','シャドウ狐','ローラーX','こおり丸','ノヴァ','ハッピーパンダ','ダークマター','キューブ初心者','スピードマン','クローバー','いしかべ'];
function _sampleName(i){return gameLang==='ja'?_SAMPLE_NAMES_JA[i]:_SAMPLE_NAMES_EN[i];}
const _SAMPLE_BASE=[
  {charIdx:0,score:48720,kills:156,eqSkin:'skin_rainbow',eqEyes:'eye_star',eqFx:'fx_celestial'},
  {charIdx:1,score:42150,kills:142,eqSkin:'skin_gold',eqEyes:'eye_fire',eqFx:'fx_fire_aura'},
  {charIdx:3,score:38900,kills:131,eqSkin:'skin_galaxy',eqEyes:'eye_void',eqFx:'fx_shadow'},
  {charIdx:0,score:35600,kills:125,eqSkin:'skin_pink',eqEyes:'eye_smile',eqFx:'fx_sakura'},
  {charIdx:4,score:33200,kills:118,eqSkin:'skin_emerald',eqEyes:'eye_cyber',eqFx:'fx_electric'},
  {charIdx:3,score:30800,kills:110,eqSkin:'skin_shadow',eqEyes:'eye_galaxy',eqFx:'fx_void_aura'},
  {charIdx:5,score:28500,kills:103,eqSkin:'skin_chrome',eqEyes:'eye_diamond',eqFx:'fx_star_trail'},
  {charIdx:0,score:26100,kills:97,eqSkin:'skin_ice',eqEyes:'eye_blink',eqFx:'fx_sparkle'},
  {charIdx:4,score:24800,kills:90,eqSkin:'skin_sunset',eqEyes:'eye_angry',eqFx:'fx_plasma_trail'},
  {charIdx:1,score:22400,kills:84,eqSkin:'skin_red',eqEyes:'eye_heart',eqFx:'fx_hearts'},
  {charIdx:4,score:20100,kills:78,eqSkin:'skin_void',eqEyes:'eye_cat',eqFx:'fx_shadow'},
  {charIdx:2,score:18700,kills:72,eqSkin:'skin_plasma',eqEyes:'eye_glitch',eqFx:'fx_rainbow'},
  {charIdx:5,score:17200,kills:66,eqSkin:'skin_ice',eqEyes:'eye_spiral',eqFx:'fx_ice_aura'},
  {charIdx:0,score:15800,kills:60,eqSkin:'skin_aurora',eqEyes:'eye_pulse',eqFx:'fx_supernova'},
  {charIdx:1,score:14500,kills:55,eqSkin:'',eqEyes:'eye_smile',eqFx:'fx_sparkle'},
  {charIdx:3,score:13100,kills:49,eqSkin:'skin_skeleton',eqEyes:'eye_hypno',eqFx:'fx_void_aura'},
  {charIdx:0,score:11800,kills:43,eqSkin:'',eqEyes:'',eqFx:''},
  {charIdx:2,score:10400,kills:38,eqSkin:'skin_inferno',eqEyes:'eye_fire',eqFx:'fx_fire_aura'},
  {charIdx:0,score:9200,kills:32,eqSkin:'skin_emerald',eqEyes:'eye_cat',eqFx:'fx_sakura'},
  {charIdx:5,score:8000,kills:27,eqSkin:'',eqEyes:'eye_angry',eqFx:''},
];
function rebuildRankingData(){
  const data=[];
  if(typeof highScore!=='undefined'&&highScore>0){
    const pName=(typeof playerName!=='undefined'&&playerName)||t('youDefault');
    const live=currentRankingAppearance();
    data.push({name:pName,charIdx:live.charIdx,score:highScore,eqSkin:live.eqSkin,eqEyes:live.eqEyes,eqFx:live.eqFx,eqPet:live.eqPet,eqAcc:live.eqAcc,titleId:live.titleId,isPlayer:true});
  }
  if(_DEBUG_SAMPLE_RANKING)for(let i=0;i<_SAMPLE_BASE.length;i++)data.push({name:_sampleName(i),charIdx:_SAMPLE_BASE[i].charIdx,score:_SAMPLE_BASE[i].score,eqSkin:_SAMPLE_BASE[i].eqSkin,eqEyes:_SAMPLE_BASE[i].eqEyes,eqFx:_SAMPLE_BASE[i].eqFx,isPlayer:false});
  data.sort((a,b)=>b.score-a.score);
  RANKING_DATA=data.slice(0,100);
  RANKING_DATA.forEach((d,i)=>d.rank=i+1);
}
function rebuildChallengeRankingData(){
  const data=[];
  if(typeof challengeBestKills!=='undefined'&&challengeBestKills>0){
    const pName=(typeof playerName!=='undefined'&&playerName)||t('youDefault');
    const live=currentRankingAppearance();
    data.push({name:pName,charIdx:live.charIdx,kills:challengeBestKills,eqSkin:live.eqSkin,eqEyes:live.eqEyes,eqFx:live.eqFx,eqPet:live.eqPet,eqAcc:live.eqAcc,titleId:live.titleId,isPlayer:true});
  }
  if(_DEBUG_SAMPLE_RANKING)for(let i=0;i<_SAMPLE_BASE.length;i++)data.push({name:_sampleName(i),charIdx:_SAMPLE_BASE[i].charIdx,kills:_SAMPLE_BASE[i].kills,eqSkin:_SAMPLE_BASE[i].eqSkin,eqEyes:_SAMPLE_BASE[i].eqEyes,eqFx:_SAMPLE_BASE[i].eqFx,isPlayer:false});
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
    _prewarmNoiseBuffers();
    switchBGM('title');
  }catch(e){}
}
let _bgmPaused=false;
function setBgmVol(v){
  bgmVol=v;localStorage.setItem('gd5bgmVol',v.toString());
  if(bgmGain){bgmGain.gain.cancelScheduledValues(audioCtx.currentTime);bgmGain.gain.value=0.15*v;}
  if(v===0&&!_bgmPaused){
    // BGM volume off: stop the scheduler entirely (not just mute) to eliminate AudioNode generation overhead
    _bgmPaused=true;
    if(bgmTimer){clearTimeout(bgmTimer);bgmTimer=null;}
    if(feverTimer){clearTimeout(feverTimer);feverTimer=null;}
  } else if(v>0&&_bgmPaused){
    _bgmPaused=false;
    if(bgmCurrent){const cur=bgmCurrent;bgmCurrent='';switchBGM(cur);}
  }
}
function setSfxVol(v){sfxVol=v;localStorage.setItem('gd5sfxVol',v.toString());if(sfxGain)sfxGain.gain.value=v;}
function setHapticEnabled(v){hapticEnabled=v;localStorage.setItem('gd5haptic',v?'1':'0');}

// Helper: create oscillator routed through bgmGain (auto-disconnect on end to prevent leak)
function bgmOsc(type,freq,t,dur,vol){
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.connect(g);g.connect(bgmGain);o.type=type;
  o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur*0.92);
  o.onended=function(){try{g.disconnect();}catch(e){}};
  o.start(t);o.stop(t+dur);return o;
}
const _noiseBufCache={};
const _noiseCommonDur=[0.015,0.02,0.03,0.04,0.05,0.06,0.08,0.12,0.15,0.25];
function _noiseBuffersFor(dur){
  const len=Math.max(1,Math.floor(audioCtx.sampleRate*dur));
  const key=audioCtx.sampleRate+'|'+len;
  let entry=_noiseBufCache[key];
  if(entry)return entry;
  const bufs=[];
  for(let v=0;v<4;v++){
    const buf=audioCtx.createBuffer(1,len,audioCtx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
    bufs.push(buf);
  }
  entry=_noiseBufCache[key]={bufs:bufs,idx:0};
  return entry;
}
function _prewarmNoiseBuffers(){
  if(!audioCtx)return;
  for(let i=0;i<_noiseCommonDur.length;i++)_noiseBuffersFor(_noiseCommonDur[i]);
}
function bgmNoise(t,dur,vol){
  const n=audioCtx.createBufferSource();
  const entry=_noiseBuffersFor(dur);
  n.buffer=entry.bufs[entry.idx++&3];const g=audioCtx.createGain();n.connect(g);g.connect(bgmGain);
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
// Title7: moonlit ambient, D minor, sparse floating intro
const BGM_TITLE7={tempo:84,
  melody:[587,0,0,698, 0,0,784,0, 880,0,0,784, 0,698,0,0,
          523,0,0,587, 0,698,0,0, 784,0,698,0, 587,0,0,0],
  harmony:[0,0,440,0, 0,0,0,392, 0,0,523,0, 0,0,0,440,
           0,0,392,0, 0,0,0,349, 0,0,440,0, 0,0,0,392],
  bass:[147,0,0,0, 0,0,0,0, 131,0,0,0, 0,0,0,0,
        110,0,0,0, 0,0,0,0, 131,0,0,0, 0,0,0,0],
  chords:[[294,349,440],[262,330,392],[220,262,330],[262,330,392],
          [294,349,440],[220,262,330],[262,330,392],[294,349,440]],
  melVol:0.16,harmVol:0.07,bassVol:0.10,chordVol:0.07,
  melWave:'sine',harmWave:'sine',bassWave:'sine',
  drums:'none'};
// Title8: brass-like march, C major, heroic and game-start ready
const BGM_TITLE8={tempo:118,
  melody:[523,659,784,0, 784,659,523,0, 659,784,880,0, 784,659,523,0,
          880,988,1047,0, 988,880,784,0, 659,784,880,659, 523,0,0,0],
  harmony:[392,0,392,0, 330,0,330,0, 440,0,440,0, 392,0,392,0,
           494,0,494,0, 440,0,440,0, 392,0,440,0, 330,0,330,0],
  bass:[131,0,262,131, 110,0,220,110, 147,0,294,147, 131,0,262,131,
        165,0,330,165, 147,0,294,147, 131,262,0,131, 110,0,220,0],
  chords:[[262,330,392],[220,262,330],[294,370,440],[262,330,392],
          [330,392,494],[294,370,440],[262,330,392],[220,262,330]],
  melVol:0.23,harmVol:0.09,bassVol:0.19,chordVol:0.06,
  melWave:'triangle',harmWave:'triangle',bassWave:'sine',
  drums:'drive'};
// Title9: tropical bounce, A major, sunny syncopation
const BGM_TITLE9={tempo:124,
  melody:[880,988,1047,988, 880,740,659,0, 740,880,988,880, 740,659,587,0,
          988,1047,1175,1047, 988,880,740,0, 880,988,1047,880, 740,659,587,0],
  harmony:[659,0,659,0, 554,0,554,0, 587,0,587,0, 494,0,494,0,
           740,0,740,0, 659,0,659,0, 587,0,587,0, 494,0,554,0],
  bass:[220,0,440,0, 185,0,370,0, 196,0,392,0, 165,0,330,0,
        247,0,494,0, 220,0,440,0, 196,0,392,0, 165,0,330,0],
  chords:[[440,554,659],[370,466,554],[392,494,587],[330,415,494],
          [494,622,740],[440,554,659],[392,494,587],[330,415,494]],
  melVol:0.22,harmVol:0.08,bassVol:0.18,chordVol:0.06,
  melWave:'triangle',harmWave:'sine',bassWave:'triangle',
  drums:'pop'};
// Title10: arcade rave, E minor, punchy square lead
const BGM_TITLE10={tempo:136,
  melody:[659,784,988,784, 659,784,988,1175, 1319,1175,988,784, 659,0,784,0,
          784,988,1175,988, 784,659,784,0, 988,1175,1319,1175, 988,784,659,0],
  harmony:[494,0,494,587, 0,659,0,587, 523,0,523,659, 0,494,0,440,
           587,0,587,698, 0,784,0,698, 659,0,659,784, 0,587,0,494],
  bass:[165,0,330,165, 196,0,392,196, 220,0,440,220, 165,0,330,165,
        196,0,392,196, 165,330,0,165, 220,0,440,220, 196,392,0,196],
  chords:[[330,392,494],[392,494,587],[440,523,659],[330,392,494],
          [392,494,587],[330,392,494],[440,523,659],[392,494,587]],
  melVol:0.24,harmVol:0.09,bassVol:0.21,chordVol:0.06,
  melWave:'square',harmWave:'triangle',bassWave:'sawtooth',
  drums:'edm'};
// Title11: night drive, F# minor, cool electronic glide
const BGM_TITLE11={tempo:96,
  melody:[740,0,831,740, 659,0,554,659, 740,831,988,0, 831,740,659,0,
          554,659,740,0, 659,554,494,554, 659,0,740,659, 554,494,415,0],
  harmony:[494,0,494,0, 440,0,440,0, 370,0,370,0, 494,0,440,0,
           415,0,415,0, 440,0,440,0, 494,0,494,0, 415,0,370,0],
  bass:[185,0,92,185, 220,0,110,220, 139,0,69,139, 185,0,92,185,
        185,92,0,185, 220,110,0,220, 139,69,0,139, 185,0,220,185],
  chords:[[370,494,587],[440,554,659],[277,370,440],[370,494,587],
          [330,415,494],[370,466,554],[277,370,440],[330,415,494]],
  melVol:0.22,harmVol:0.09,bassVol:0.19,chordVol:0.07,
  melWave:'triangle',harmWave:'sine',bassWave:'sine',
  drums:'soft'};
const BGM_TITLES=[BGM_TITLE,BGM_TITLE2,BGM_TITLE3,BGM_TITLE4,BGM_TITLE5,BGM_TITLE6,BGM_TITLE7,BGM_TITLE8,BGM_TITLE9,BGM_TITLE10,BGM_TITLE11];
// Play BGMs: 20 unique tracks, tempo gradually increases as score rises.
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
const BGM_PLAY11={tempo:136, // score 10000-10999: Dark Ascent - Am, intense minor run
  melody:[440,0,523,659, 784,659,523,440, 523,659,784,880, 0,784,659,0,
          880,0,784,659, 523,440,523,0, 659,784,880,0, 784,659,440,0],
  harmony:[330,0,330,440, 0,440,0,330, 392,0,392,494, 0,494,0,392,
           330,0,330,440, 0,440,0,330, 392,0,440,523, 0,494,0,330],
  bass:[110,0,220,110, 175,0,349,175, 131,0,262,131, 165,0,330,165,
        110,220,0,110, 175,349,0,175, 131,262,0,131, 165,330,0,165],
  chords:[[220,262,330],[196,247,294],[175,220,262],[131,165,196],
          [220,262,330],[196,247,294],[175,220,262],[131,165,196]],
  melVol:0.27,harmVol:0.10,bassVol:0.28,chordVol:0.07,
  melWave:'sawtooth',harmWave:'triangle',bassWave:'sawtooth',
  drums:'nightmare'};
const BGM_PLAY12={tempo:138, // score 11000-11999: Crimson Gate - Dm, heavy synth
  melody:[587,0,698,880, 1047,880,784,0, 698,587,0,523, 587,698,880,0,
          880,0,784,698, 587,0,698,784, 880,1047,0,880, 784,698,587,0],
  harmony:[440,0,440,523, 0,587,0,440, 392,0,392,466, 0,523,0,392,
           466,0,466,587, 0,698,0,523, 440,0,440,523, 0,587,0,440],
  bass:[147,0,294,147, 220,0,440,220, 175,0,349,175, 131,0,262,131,
        147,294,0,147, 220,440,0,220, 175,349,0,175, 131,262,0,131],
  chords:[[294,349,440],[220,277,330],[175,220,262],[131,165,196],
          [294,349,440],[220,277,330],[175,220,262],[131,165,196]],
  melVol:0.28,harmVol:0.10,bassVol:0.29,chordVol:0.07,
  melWave:'sawtooth',harmWave:'triangle',bassWave:'sawtooth',
  drums:'nightmare'};
const BGM_PLAY13={tempo:140, // score 12000-12999: Storm Rush - Em, frantic intensity
  melody:[659,0,784,988, 1175,988,784,659, 784,988,1175,1319, 0,1175,988,0,
          1319,1175,988,784, 659,784,988,0, 1175,0,1319,1175, 988,784,659,0],
  harmony:[494,0,494,659, 0,784,0,659, 587,0,587,784, 0,784,0,659,
           523,0,523,659, 0,784,0,659, 587,0,659,784, 0,880,0,659],
  bass:[165,0,330,165, 247,0,494,247, 196,0,392,196, 294,0,587,294,
        165,330,0,165, 247,494,0,247, 196,392,0,196, 294,587,0,294],
  chords:[[330,392,494],[247,294,392],[196,247,294],[294,370,440],
          [330,392,494],[247,294,392],[196,247,294],[294,370,440]],
  melVol:0.29,harmVol:0.10,bassVol:0.30,chordVol:0.07,
  melWave:'square',harmWave:'triangle',bassWave:'sawtooth',
  drums:'rumble'};
const BGM_PLAY14={tempo:142, // score 13000-13999: Void March - Cm, epic apocalypse
  melody:[523,0,622,784, 932,0,784,622, 523,622,784,880, 0,932,1047,0,
          1047,932,784,622, 523,0,622,784, 932,1047,0,932, 784,622,523,0],
  harmony:[415,0,415,523, 0,622,0,523, 466,0,466,587, 0,784,0,622,
           466,0,466,587, 0,698,0,587, 523,0,523,622, 0,784,0,622],
  bass:[131,0,262,131, 196,0,392,196, 165,0,330,165, 233,0,466,233,
        131,262,0,131, 196,392,0,196, 165,330,0,165, 233,466,0,233],
  chords:[[262,311,392],[196,233,294],[165,196,247],[233,277,349],
          [262,311,392],[196,233,294],[165,196,247],[233,277,349]],
  melVol:0.30,harmVol:0.10,bassVol:0.30,chordVol:0.07,
  melWave:'sawtooth',harmWave:'triangle',bassWave:'sawtooth',
  drums:'nightmare'};
const BGM_PLAY15={tempo:144, // score 14000+: Absolute Zero - Am high, transcendent max
  melody:[880,1047,1319,1568, 1760,1568,1319,1047, 880,1047,1319,1568, 0,1319,1047,0,
          1047,1319,1568,1760, 1568,1319,1047,880, 1047,1319,1568,0, 1319,1175,1047,880],
  harmony:[659,0,659,880, 0,880,0,784, 784,0,784,1047, 0,1047,0,880,
           784,0,784,1047, 0,1047,0,880, 659,0,659,880, 0,880,0,784],
  bass:[220,0,440,220, 175,0,349,175, 220,440,0,220, 175,349,0,175,
        262,0,523,262, 220,0,440,220, 196,0,392,196, 220,440,0,220],
  chords:[[440,523,659],[349,440,523],[294,349,440],[330,392,494],
          [440,523,659],[349,440,523],[294,349,440],[330,392,494]],
  melVol:0.30,harmVol:0.10,bassVol:0.30,chordVol:0.07,
  melWave:'sawtooth',harmWave:'sawtooth',bassWave:'sawtooth',
  drums:'rumble'};
const BGM_PLAY16={tempo:146, // score 15000-15999: Neon Abyss - airy teal trance
  melody:[740,0,880,987, 1175,0,987,880, 740,0,659,740, 880,0,987,0,
          1175,0,1319,1175, 987,0,880,740, 659,740,880,0, 987,1175,1319,0],
  harmony:[554,0,554,659, 0,740,0,659, 494,0,494,554, 0,659,0,554,
           659,0,659,740, 0,880,0,740, 554,0,554,659, 0,740,0,659],
  bass:[185,0,370,185, 220,0,440,220, 165,0,330,165, 185,0,370,185,
        220,440,0,220, 247,494,0,247, 185,370,0,185, 220,440,0,220],
  chords:[[370,466,554],[440,554,659],[330,415,494],[370,466,554],
          [440,554,659],[494,622,740],[370,466,554],[440,554,659]],
  melVol:0.24,harmVol:0.11,bassVol:0.24,chordVol:0.06,
  melWave:'sine',harmWave:'triangle',bassWave:'sine',
  drums:'edm'};
const BGM_PLAY17={tempo:148, // score 16000-16999: Rose Palace - theatrical syncopation
  melody:[698,0,784,932, 784,698,587,0, 523,587,698,784, 932,0,784,698,
          1047,0,932,784, 698,587,523,0, 587,698,784,932, 1175,0,1047,0],
  harmony:[523,0,523,587, 0,523,0,466, 440,0,440,523, 0,587,0,523,
           587,0,587,698, 0,587,0,523, 466,0,466,587, 0,698,0,587],
  bass:[175,0,349,175, 175,0,262,0, 131,0,262,131, 175,0,349,175,
        196,0,392,196, 175,0,262,0, 147,0,294,147, 196,392,0,196],
  chords:[[349,440,523],[294,370,466],[262,330,392],[349,440,523],
          [392,494,587],[349,440,523],[294,370,466],[392,494,587]],
  melVol:0.25,harmVol:0.10,bassVol:0.26,chordVol:0.07,
  melWave:'triangle',harmWave:'sine',bassWave:'triangle',
  drums:'pop'};
const BGM_PLAY18={tempo:150, // score 17000-17999: Lime Storm - acidic chase
  melody:[784,0,880,0, 988,1047,988,880, 784,0,880,988, 1175,0,988,0,
          1319,0,1175,1047, 988,880,784,0, 880,988,1047,1175, 1319,1175,1047,0],
  harmony:[587,0,587,698, 0,784,0,698, 523,0,523,659, 0,698,0,659,
           659,0,659,784, 0,880,0,784, 587,0,587,698, 0,784,0,698],
  bass:[196,0,392,196, 196,392,0,196, 165,0,330,165, 196,0,392,196,
        220,0,440,220, 196,392,0,196, 175,0,349,175, 220,440,0,220],
  chords:[[392,494,587],[392,523,659],[330,415,523],[392,494,587],
          [440,554,659],[392,494,587],[349,440,523],[440,554,659]],
  melVol:0.27,harmVol:0.10,bassVol:0.28,chordVol:0.06,
  melWave:'square',harmWave:'triangle',bassWave:'sawtooth',
  drums:'turbo'};
const BGM_PLAY19={tempo:152, // score 18000-18999: Sapphire Noir - cold mechanical run
  melody:[659,0,740,659, 587,0,659,784, 880,784,659,0, 587,0,523,0,
          659,0,740,880, 988,880,740,659, 587,659,784,0, 880,988,1047,0],
  harmony:[494,0,494,587, 0,659,0,587, 440,0,440,523, 0,587,0,523,
           523,0,523,659, 0,740,0,659, 494,0,494,587, 0,659,0,587],
  bass:[165,0,330,165, 147,0,294,147, 131,0,262,131, 147,0,294,147,
        165,330,0,165, 185,370,0,185, 165,0,330,165, 196,392,0,196],
  chords:[[330,392,494],[294,349,440],[262,330,392],[294,349,440],
          [330,415,523],[370,466,587],[330,392,494],[392,494,622]],
  melVol:0.26,harmVol:0.11,bassVol:0.27,chordVol:0.07,
  melWave:'triangle',harmWave:'triangle',bassWave:'sine',
  drums:'drive'};
const BGM_PLAY20={tempo:156, // score 19000+: Spectrum Break - bright final sprint
  melody:[1047,1175,1319,1568, 1760,1568,1319,1175, 1047,1175,1319,1568, 1760,0,1568,0,
          1319,1568,1760,2093, 1760,1568,1319,1175, 1047,1319,1568,1760, 2093,1760,1568,0],
  harmony:[784,0,784,988, 0,1047,0,988, 659,0,659,880, 0,988,0,880,
           880,0,880,1047, 0,1175,0,1047, 784,0,784,988, 0,1319,0,1047],
  bass:[262,0,523,262, 220,0,440,220, 196,0,392,196, 220,0,440,220,
        262,523,0,262, 247,494,0,247, 220,440,0,220, 262,523,0,262],
  chords:[[523,659,784],[440,554,659],[392,494,587],[440,554,659],
          [523,659,784],[494,622,740],[440,554,659],[523,659,880]],
  melVol:0.30,harmVol:0.11,bassVol:0.30,chordVol:0.07,
  melWave:'square',harmWave:'sine',bassWave:'sawtooth',
  drums:'edm'};
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

// Score-based play BGM selection (20 tiers, every 1000 score)
// bgmTierOffset: on coin continue, set to current tier so BGM restarts from play1
let bgmTierOffset=0;
function getPlayBGM(){
  const tier=Math.min(Math.max(Math.floor(score/1000)-bgmTierOffset,0),19);
  return[BGM_PLAY1,BGM_PLAY2,BGM_PLAY3,BGM_PLAY4,BGM_PLAY5,BGM_PLAY6,BGM_PLAY7,BGM_PLAY8,BGM_PLAY9,BGM_PLAY10,
         BGM_PLAY11,BGM_PLAY12,BGM_PLAY13,BGM_PLAY14,BGM_PLAY15,BGM_PLAY16,BGM_PLAY17,BGM_PLAY18,BGM_PLAY19,BGM_PLAY20][tier];
}
function getPlayBGMType(){
  const tier=Math.min(Math.max(Math.floor(score/1000)-bgmTierOffset,0),19);
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
    title6:BGM_TITLES[6],title7:BGM_TITLES[7],title8:BGM_TITLES[8],title9:BGM_TITLES[9],title10:BGM_TITLES[10],
    play1:BGM_PLAY1,play2:BGM_PLAY2,play3:BGM_PLAY3,play4:BGM_PLAY4,play5:BGM_PLAY5,play6:BGM_PLAY6,play7:BGM_PLAY7,play8:BGM_PLAY8,play9:BGM_PLAY9,play10:BGM_PLAY10,
    play11:BGM_PLAY11,play12:BGM_PLAY12,play13:BGM_PLAY13,play14:BGM_PLAY14,play15:BGM_PLAY15,play16:BGM_PLAY16,play17:BGM_PLAY17,play18:BGM_PLAY18,play19:BGM_PLAY19,play20:BGM_PLAY20,
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
const _isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent);
let _hapticLastStyle='',_hapticLastAt=0;
let _hapticGlobalLastAt=0;
function vibrate(ms){
  try{
    if(!hapticEnabled)return;
    if(window.ReactNativeWebView){
      if(typeof ms==='string'){
        const now=Date.now();
        // Wider per-style gaps to reduce Taptic Engine call rate
        const minGap=ms==='coin'?60:(ms==='jump'||ms==='flip'?40:30);
        if(ms===_hapticLastStyle&&now-_hapticLastAt<minGap)return;
        // iOS global cross-style cooldown: hard cap on total haptic rate
        if(_isIOS&&now-_hapticGlobalLastAt<40)return;
        _hapticLastStyle=ms;_hapticLastAt=now;_hapticGlobalLastAt=now;
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'haptic',style:ms}));
      } else {
        // Legacy numeric/array: apply iOS global cooldown here too
        if(_isIOS){const now=Date.now();if(now-_hapticGlobalLastAt<40)return;_hapticGlobalLastAt=now;}
        if(navigator.vibrate)navigator.vibrate(ms);
      }
    } else if(navigator.vibrate){
      navigator.vibrate(ms);
    }
  }catch(e){}
}
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

function sfxChestNormal(){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    [784,988,1175].forEach((f,i)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sine';
      o.frequency.setValueAtTime(f,t+i*0.055);
      g.gain.setValueAtTime(0.075,t+i*0.055);
      g.gain.exponentialRampToValueAtTime(0.001,t+i*0.055+0.28);
      o.start(t+i*0.055);o.stop(t+i*0.055+0.32);
    });
    const shimmer=audioCtx.createOscillator(),sg=audioCtx.createGain();
    shimmer.connect(sg);sg.connect(sfxGain);shimmer.type='triangle';
    shimmer.frequency.setValueAtTime(1568,t+0.16);
    shimmer.frequency.exponentialRampToValueAtTime(2093,t+0.35);
    sg.gain.setValueAtTime(0.035,t+0.16);
    sg.gain.exponentialRampToValueAtTime(0.001,t+0.42);
    shimmer.start(t+0.16);shimmer.stop(t+0.46);
  }catch(e){}
}

function sfxRare(){
  if(!audioCtx)return;try{
    const t=audioCtx.currentTime;
    const hit=audioCtx.createOscillator(),hg=audioCtx.createGain();
    hit.connect(hg);hg.connect(sfxGain);hit.type='triangle';
    hit.frequency.setValueAtTime(180,t);hit.frequency.exponentialRampToValueAtTime(80,t+0.18);
    hg.gain.setValueAtTime(0.16,t);hg.gain.exponentialRampToValueAtTime(0.001,t+0.24);
    hit.start(t);hit.stop(t+0.28);
    [392,523,659,988,1319].forEach((f,i)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type=i<2?'triangle':'sine';
      o.frequency.setValueAtTime(f,t+0.08+i*0.075);
      g.gain.setValueAtTime(0.11,t+0.08+i*0.075);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.08+i*0.075+0.42);
      o.start(t+0.08+i*0.075);o.stop(t+0.08+i*0.075+0.48);
    });
    [1480,1760].forEach((f,i)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(sfxGain);o.type='sine';
      o.frequency.setValueAtTime(f,t+0.45+i*0.04);
      g.gain.setValueAtTime(0.055,t+0.45+i*0.04);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.95+i*0.04);
      o.start(t+0.45+i*0.04);o.stop(t+1.0+i*0.04);
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
function _buildItems(){return[
  {name:t('itemInvincible'),desc:t('itemDescInvincible'),col:'#ff00ff',icon:'\u2B50\uFE0F',dur:600},
  {name:t('itemMagnet'),desc:t('itemDescMagnet'),col:'#f59e0b',icon:'\u{1F9F2}',dur:600},
  {name:t('itemBomb'),desc:t('itemDescBomb'),col:'#ff4400',icon:'\u{1F4A3}',dur:0},
  {name:t('itemHeart'),desc:t('itemDescHeart'),col:'#ff3860',icon:'\u2764\uFE0F',dur:0},
  {name:t('itemSlow'),desc:t('itemDescSlow'),col:'#a855f7',icon:'\u25F7',dur:600},
];}
let ITEMS=_buildItems();


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
    // Pack1 全ステージ spdMul:1.1 固定（進行ごとに速くならない）
    // 1-1: お試し — ウォーカーまばら、ハザードなし
    {id:'1-1',name:'1-1',dist:1000,spdMul:1.1,seed:1001,hillChance:0.80,gapChance:0,
      noFloatPlat:true,noHazards:true,noMovingHill:true,walkerOnly:true,enemyChance:0.10,
      coins:[{pos:0.25,yOff:-70},{pos:0.55,yOff:-100},{pos:0.80,yOff:-140}]},
    // 1-2: クリボー大群 + 上下交互チャズム — 境界にgravZoneで反転必須
    {id:'1-2',name:'1-2',dist:1000,spdMul:1.1,seed:1002,enemyChance:0.85,
      stageType:'altChasm',walkerOnly:true,noFloatPlat:true,noMovingHill:true,noHazards:true,
      altChasmZoneLen:80,altChasmBuffer:25, // 小バッファで安全な反転領域を確保
      coins:[{pos:0.25,yOff:-50},{pos:0.55,yOff:-80},{pos:0.80,yOff:-150}]},
    // 1-3: 白い鳥の大群 — 鳥だけ(超高密度)、起伏ありギャップ多様
    {id:'1-3',name:'1-3',dist:1000,spdMul:1.1,seed:1003,enemyChance:0,gapChance:0.30,hillChance:0.40,
      birdSwarm:true,noFloatPlat:true,noMovingHill:true,noHazards:true,
      coins:[{pos:0.28,yOff:-60},{pos:0.55,yOff:-200},{pos:0.78,yOff:-80}]},
    // 1-4: 上下床の連続(gravity) — 重ならないよう間隔強化
    {id:'1-4',name:'1-4',dist:1000,spdMul:1.1,seed:1004,hillChance:0.45,gapChance:0.42,enemyChance:0,
      stageType:'gravity',noFloatPlat:true,
      coins:[{pos:0.30,yOff:-50},{pos:0.55,yOff:-50},{pos:0.78,yOff:-50}]},
    // 1-5: スパイク地獄 — 赤スパイクだらけ、敵なし
    {id:'1-5',name:'1-5',dist:1000,spdMul:1.1,seed:1005,enemyChance:0,
      stageType:'spikeOnly',denseSpikes:true,noMovingHill:true,noFloatPlat:true,
      coins:[{pos:0.25,yOff:-80},{pos:0.55,yOff:-180},{pos:0.80,yOff:-60}]},
  ]},
  {name:'雪山',theme:1,unlock:12,starsPerStage:2,stages:[
    // 2-1: つらら雨 — 頭上からつららが降ってくる、敵はクリボーのみ
    {id:'2-1',name:'2-1',dist:1000,spdMul:1.3,seed:2001,hillChance:0.30,gapChance:0.25,
      enemyChance:0.85,forceEnemyType:0,icicleChance:0.4,noFloatPlat:true,noMovingHill:true,
      coins:[{pos:0.25,yOff:-90},{pos:0.55,yOff:-180},{pos:0.80,yOff:-70}]},
    // 2-2: ダッシャー追走 — 高速ダッシャーに追われる
    {id:'2-2',name:'2-2',dist:1000,spdMul:1.35,seed:2002,hillChance:0.30,gapChance:0.30,
      enemyChance:0.90,forceEnemyType:6,noFloatPlat:true,noMovingHill:true,noHazards:true,
      coins:[{pos:0.25,yOff:-100},{pos:0.55,yOff:-220},{pos:0.80,yOff:-80}]},
    // 2-3: 浮遊足場ゾーン — 飛行敵 + 浮遊プラットフォームでの空中移動
    {id:'2-3',name:'2-3',dist:1000,spdMul:1.4,seed:2003,hillChance:0.25,gapChance:0.55,
      enemyChance:0.85,forceEnemyType:2,stageType:'chasm',noMovingHill:true,noHazards:true,
      coins:[{pos:0.25,yOff:-160},{pos:0.55,yOff:-250},{pos:0.80,yOff:-180}]},
    // 2-4: 見え隠れするファントム — 消える敵だけの心理戦
    {id:'2-4',name:'2-4',dist:1000,spdMul:1.4,seed:2004,hillChance:0.35,gapChance:0.28,
      enemyChance:0.90,forceEnemyType:5,noFloatPlat:true,noMovingHill:true,noHazards:true,
      coins:[{pos:0.25,yOff:-130},{pos:0.55,yOff:-200},{pos:0.80,yOff:-100}]},
    // 2-5: 雪だるまボス戦 — void地形で立ち回る
    {id:'2-5',name:'2-5',dist:1000,spdMul:1.5,seed:2005,hillChance:0.50,gapChance:0.48,enemyChance:0.30,boss:true,noFloatPlat:true,
      stageType:'void',noMovingHill:true,bossVariant:'snowman',
      coins:[{pos:0.25,yOff:-50},{pos:0.58,yOff:-50},{pos:0.78,yOff:-50}]},
  ]},
  {name:'マグマ',theme:2,unlock:24,starsPerStage:2,stages:[
    // 3-1: 火球豪雨 — マグマ地面に火球、敵なし、反射神経勝負
    {id:'3-1',name:'3-1',dist:1000,spdMul:1.35,seed:3001,hillChance:0.35,gapChance:0.35,enemyChance:0,
      magma:true,noFloatPlat:true,noMovingHill:true,noHazards:true,
      coins:[{pos:0.25,yOff:-100},{pos:0.55,yOff:-200},{pos:0.80,yOff:-80}]},
    // 3-2: 爆弾兵団 — ボンバー敵で溢れる
    {id:'3-2',name:'3-2',dist:1000,spdMul:1.4,seed:3002,hillChance:0.35,gapChance:0.30,
      enemyChance:0.85,forceEnemyType:3,magma:true,noFloatPlat:true,noMovingHill:true,noHazards:true,
      coins:[{pos:0.25,yOff:-90},{pos:0.55,yOff:-200},{pos:0.80,yOff:-70}]},
    // 3-3: マグマのヒビ割れ — altChasmで交互に地面が無くなる
    {id:'3-3',name:'3-3',dist:1000,spdMul:1.45,seed:3003,enemyChance:0.85,forceEnemyType:0,
      magma:true,stageType:'altChasm',altChasmZoneLen:110,altChasmBuffer:25,
      noFloatPlat:true,noMovingHill:true,noHazards:true,
      coins:[{pos:0.25,yOff:-80},{pos:0.55,yOff:-120},{pos:0.80,yOff:-160}]},
    // 3-4: 射手の谷 — キャノン（射撃敵）のみ、たくさん弾が飛ぶ
    {id:'3-4',name:'3-4',dist:1000,spdMul:1.5,seed:3004,hillChance:0.40,gapChance:0.30,
      enemyChance:0.90,forceEnemyType:1,magma:true,noFloatPlat:true,noMovingHill:true,noHazards:true,
      coins:[{pos:0.25,yOff:-100},{pos:0.55,yOff:-220},{pos:0.80,yOff:-80}]},
    // 3-5: マグマボス — ガーディアン戦 + 火球ハザード
    {id:'3-5',name:'3-5',dist:1000,spdMul:1.55,seed:3005,hillChance:0.45,gapChance:0.40,enemyChance:0.25,boss:true,
      magma:true,stageType:'void',noMovingHill:true,noFloatPlat:true,bossVariant:'guardian',
      coins:[{pos:0.25,yOff:-50},{pos:0.55,yOff:-50},{pos:0.80,yOff:-50}]},
  ]},
  {name:'海',theme:3,unlock:36,starsPerStage:2,stages:[
    // 4-1: 飛行敵の群れ — 空から襲い来る
    {id:'4-1',name:'4-1',dist:1000,spdMul:1.4,seed:4001,hillChance:0.35,gapChance:0.30,
      enemyChance:0.90,forceEnemyType:2,noFloatPlat:true,noMovingHill:true,noHazards:true,
      coins:[{pos:0.25,yOff:-120},{pos:0.55,yOff:-220},{pos:0.80,yOff:-80}]},
    // 4-2: バウンド敵 — 垂直移動敵、予測が鍵
    {id:'4-2',name:'4-2',dist:1000,spdMul:1.45,seed:4002,hillChance:0.35,gapChance:0.30,
      enemyChance:0.85,forceEnemyType:4,noFloatPlat:true,noMovingHill:true,noHazards:true,
      coins:[{pos:0.25,yOff:-100},{pos:0.55,yOff:-180},{pos:0.80,yOff:-90}]},
    // 4-3: 分裂スライム — 倒すと子分裂、数の波
    {id:'4-3',name:'4-3',dist:1000,spdMul:1.5,seed:4003,hillChance:0.35,gapChance:0.25,
      enemyChance:0.75,forceEnemyType:8,noFloatPlat:true,noMovingHill:true,noHazards:true,
      coins:[{pos:0.25,yOff:-110},{pos:0.55,yOff:-200},{pos:0.80,yOff:-90}]},
    // 4-4: 落ちる床サバイバル — fallingMtn密集、敵なし、他ハザードなし
    {id:'4-4',name:'4-4',dist:1000,spdMul:1.5,seed:4004,hillChance:0.30,gapChance:0.55,enemyChance:0,
      noFloatPlat:true,noMovingHill:true,noHazards:true,fallingMtnBoost:true,
      coins:[{pos:0.25,yOff:-90},{pos:0.55,yOff:-140},{pos:0.80,yOff:-80}]},
    // 4-5: 海ボス — ドッジ型ボス戦
    {id:'4-5',name:'4-5',dist:1000,spdMul:1.6,seed:4005,hillChance:0.45,gapChance:0.40,enemyChance:0,boss:true,
      noFloatPlat:true,noMovingHill:true,bossVariant:'dodge',
      coins:[{pos:0.25,yOff:-50},{pos:0.55,yOff:-50},{pos:0.80,yOff:-50}]},
  ]},
  {name:'桜幻',theme:4,unlock:48,starsPerStage:2,stages:[
    // 5-1: 重力反転の連鎖 — gravZoneで常に上下切替
    {id:'5-1',name:'5-1',dist:1000,spdMul:1.5,seed:5001,hillChance:0.30,gapChance:0.30,enemyChance:0,
      stageType:'void',gravZoneBoost:true,noFloatPlat:true,noMovingHill:true,noHazards:true,
      coins:[{pos:0.25,yOff:-250},{pos:0.55,yOff:-180},{pos:0.80,yOff:-300}]},
    // 5-2: 動く床+敵 — movingステージで敵が加わる難関
    {id:'5-2',name:'5-2',dist:1000,spdMul:1.55,seed:5002,enemyChance:0.75,forceEnemyType:0,
      stageType:'moving',noHazards:true,
      coins:[{pos:0.25,yOff:-140},{pos:0.55,yOff:-220},{pos:0.80,yOff:-160}]},
    // 5-3: スパイク＋敵 — spikeOnly地獄に敵も加わる
    {id:'5-3',name:'5-3',dist:1000,spdMul:1.5,seed:5003,hillChance:0.35,gapChance:0.25,
      enemyChance:0.70,forceEnemyType:0,stageType:'spikeOnly',denseSpikes:true,
      noMovingHill:true,noFloatPlat:true,
      coins:[{pos:0.25,yOff:-100},{pos:0.55,yOff:-180},{pos:0.80,yOff:-90}]},
    // 5-4: 混合敵カオス — 全敵タイプ混在
    {id:'5-4',name:'5-4',dist:1000,spdMul:1.6,seed:5004,hillChance:0.40,gapChance:0.35,enemyChance:0.42,
      noFloatPlat:true,noMovingHill:true,noHazards:true,
      coins:[{pos:0.25,yOff:-120},{pos:0.55,yOff:-240},{pos:0.80,yOff:-100}]},
    // 5-5: 最終ボス（ブルーザー） — 最難関
    {id:'5-5',name:'5-5',dist:1000,spdMul:1.7,seed:5005,hillChance:0.55,gapChance:0.48,enemyChance:0.30,boss:true,
      noFloatPlat:true,stageType:'void',noMovingHill:true,bossVariant:'bruiser',
      coins:[{pos:0.25,yOff:-50},{pos:0.50,yOff:-50},{pos:0.75,yOff:-50}]},
  ]},
];
// Stage pack progress: {stageId: {cleared:true, stars:N}} for cleared stages
let packProgress=(function(){try{const o=JSON.parse(localStorage.getItem('gd5pp')||'{}');if(typeof o!=='object'||o===null||Array.isArray(o))return{};return o;}catch(e){return{};}})();
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
// 他プレイヤーの死亡マーカー（ステージ開始時にFirestoreから読み込む）
let otherDeathMarks=[];
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
// _sanitizeLsCosmId: sanitize cosmetic ID strings read from localStorage (alphanumeric+_- only, max 64 chars)
function _sanitizeLsCosmId(v){if(!v||typeof v!=='string')return'';return v.replace(/[^a-zA-Z0-9_\-]/g,'').substring(0,64);}
let challengeBestKills=Math.max(0,Math.min(9999,parseInt(localStorage.getItem('gd5challBest')||'0')||0));
// Challenge ranking cosmetics (captured at time of best kills)
let challRankChar=Math.max(-1,Math.min(5,parseInt(localStorage.getItem('gd5challRankChar')||'-1')||0));
let challRankSkin=_sanitizeLsCosmId(localStorage.getItem('gd5challRankSkin')||'');
let challRankEyes=_sanitizeLsCosmId(localStorage.getItem('gd5challRankEyes')||'');
let challRankFx=_sanitizeLsCosmId(localStorage.getItem('gd5challRankFx')||'');
let challRankPet=_sanitizeLsCosmId(localStorage.getItem('gd5challRankPet')||'');
let challRankAcc=_sanitizeLsCosmId(localStorage.getItem('gd5challRankAcc')||'');
// Challenge boss queue (pre-generated wave order)
let challBossQueue=[]; // [{type,type2,strength,isDual}]
let challQueueIdx=0; // current position in queue
// Challenge transition state (blackout between waves)
let challTransition={
  active:false, timer:0, waveNum:0
};

// Shared helpers for challenge boss queue generation
const _CHALL_BOSS_TYPES=['wizard','bruiser','guardian','dodge'];
function _challShuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function _challBossPairs(){const p=[];for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)p.push([_CHALL_BOSS_TYPES[i],_CHALL_BOSS_TYPES[j]]);return p;}

// Generate challenge boss queue: structured wave progression
function generateChallBossQueue(){
  const types=_CHALL_BOSS_TYPES;
  const pairs=_challBossPairs();
  const q=[];
  // Wave 1-4: single, strength 1
  _challShuffle(types.slice()).forEach(t=>q.push({type:t,type2:null,strength:1,isDual:false}));
  // Wave 5-8: single, strength 2
  _challShuffle(types.slice()).forEach(t=>q.push({type:t,type2:null,strength:2,isDual:false}));
  // Wave 9-14: dual, strength 1
  _challShuffle(pairs.slice()).forEach(p=>q.push({type:p[0],type2:p[1],strength:1,isDual:true}));
  // Wave 15-20: dual, strength 2
  _challShuffle(pairs.slice()).forEach(p=>q.push({type:p[0],type2:p[1],strength:2,isDual:true}));
  // Wave 21-26: dual, strength 3
  _challShuffle(pairs.slice()).forEach(p=>q.push({type:p[0],type2:p[1],strength:3,isDual:true}));
  return q;
}
function extendChallBossQueue(){
  // Extend with 6 more dual strength 3
  _challShuffle(_challBossPairs()).forEach(p=>challBossQueue.push({type:p[0],type2:p[1],strength:3,isDual:true}));
}

// ===== STATE =====
const ST={TITLE:0,PLAY:1,DEAD:2,PAUSE:3,STAGE_CLEAR:4,STAGE_SEL:5,COUNTDOWN:6,LOGIN:7,TUTORIAL:8};
// Login & tutorial
let playerName=(localStorage.getItem('gd5username')||'').replace(/[<>&"']/g,'').substring(0,12);
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
let score=0,highScore=Math.max(0,Math.min(99999,parseInt(localStorage.getItem('gd5hi')||'0')||0));
// Ranking cosmetics: captured at time of high score
let rankChar=Math.max(-1,Math.min(5,parseInt(localStorage.getItem('gd5rankChar')||'-1')||0));
let rankSkin=_sanitizeLsCosmId(localStorage.getItem('gd5rankSkin')||'');
let rankEyes=_sanitizeLsCosmId(localStorage.getItem('gd5rankEyes')||'');
let rankFx=_sanitizeLsCosmId(localStorage.getItem('gd5rankFx')||'');
let rankPet=_sanitizeLsCosmId(localStorage.getItem('gd5rankPet')||'');
let rankAcc=_sanitizeLsCosmId(localStorage.getItem('gd5rankAcc')||'');
let newHi=false,speed=SPEED_INIT,frame=0,deadT=0,titleT=0;
let combo=0,comboT=0,comboDsp=0,comboDspT=0;
let airCombo=0; // aerial enemy kill combo (resets on grounded)
let stompCombo=0; // consecutive stomp combo (resets on grounded)
let shakeX=0,shakeY=0,shakeI=0;
let mileT=0,mileTxt='',lastMile=0;
let pops=[],totalCoins=0,totalFlips=0,maxCombo=0,flipCount=0,flipTimer=999;
let played=Math.max(0,parseInt(localStorage.getItem('gd5plays')||'0')||0);
let freeRevivesUsed=Math.max(0,Math.min(5,parseInt(localStorage.getItem('gd5freeRevives')||'0')||0));
let dist=0;
let rawDist=0; // pure traversal distance (no bonuses) - used for boss timing
let speedOffset=0; // distance offset for speed calculation (reset on continue)
let hp=HP_MAX,hurtT=0; // hit points and hurt invincibility timer

// Active item effects
let itemEff={invincible:0,magnet:0,slowmo:0};
let djumpAvailable=false; // double jump (Bounce trait or item)
let djumpUsed=false; // track if the double jump was used
let magnetCount=0; // manual magnet charges available in the current endless run
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
let totalChestsOpened=Math.max(0,parseInt(localStorage.getItem('gd5chestTotal')||'0')||0);
let storedChests=Math.max(0,Math.min(999,parseInt(localStorage.getItem('gd5storedChests')||'0')||0));
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
    // Aggressively target enemies: wide range, prioritize ground enemies
    for(const e of d.enemies){
      if(e.alive&&e.x>d.px-25&&e.x<d.px+240&&e.type!==2&&e.type!==7){doJump=true;break;}
    }
    if(!doJump&&Math.random()<0.01)doJump=true;
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
    e.bob+=0.05;e.fr=(e.fr||0)+0.12;
    if(e.type===2||e.type===4||e.type===7){
      // Flyer/bird: animated float
      e.flyPhase=(e.flyPhase||0)+(e.type===7?0.07:0.04);
      const _baseY=e.type===7?Math.max(H*0.22,Math.min(H*0.55,d.py+(d.gDir===1?-55:55))):H*0.38;
      e.y=_baseY+Math.sin(e.flyPhase)*32;e.gDir=1;
    } else {
      for(const p of d.plats){
        if(e.x>=p.x&&e.x<=p.x+p.w){e.y=H-p.h-e.sz;e.gDir=1;break;}
      }
      // Patrol movement
      e._pat=(e._pat||0)+0.022;
      if(e.type!==1)e.x+=Math.cos(e._pat)*0.75;
      e.patrolDir=Math.cos(e._pat)>0?1:-1;
      // Cannon: cycle shootT for aiming animation
      if(e.type===1){e.shootT=Math.max(0,(e.shootT||80)-1);if(e.shootT<=0)e.shootT=60+Math.floor(Math.random()*50);}
      // Dasher: warn state when player is near
      if(e.type===6){const _dw=Math.abs(d.px-e.x);e.dashState=_dw<180?'warn':'patrol';e.warnT=_dw<180?Math.min(40,(e.warnT||0)+3):0;}
      // Leaper: notice state when player is near
      if(e.type===14){const _dl=Math.hypot(d.px-e.x,d.py-e.y);e._state=_dl<180?'notice':'patrol';e._noticeT=10;}
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
  while(d.enemies.length<3){
    const _dTypes=[0,1,2,6,7,8,14];
    const _dType=_dTypes[Math.floor(Math.random()*_dTypes.length)];
    d.enemies.push({x:W+40+Math.random()*200,y:0,sz:11+Math.random()*4,
      alive:true,gDir:1,bob:Math.random()*6.28,
      type:_dType,fr:Math.random()*100,shootT:999,
      patrolDir:1,dashState:'patrol',flyPhase:Math.random()*6.28,warnT:0,_state:'patrol'});
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
// Enemy action speed multiplier (endless): 10000→1.3x, 20000→1.5x, 30000→2.0x, 40000→2.5x(cap)
function enemySpeedMul(){
  if(score>=40000)return 2.5;
  if(score>=30000)return 2.0;
  if(score>=20000)return 1.5;
  if(score>=10000)return 1.3;
  return 1.0;
}
const BOSS_HITBOX_SCALE=0.65;
let fallingMtns=[],fallingMtnCD=0;
// Coin tiers: smooth warm progression yellow → amber → orange → deep orange → red-orange → red → dark red
const COIN_TIERS=[
  {min:0,    col:'#ffd700',glow:'#ffd70055',sparkCol:'#ffd700',mul:1,   name:'gold'},
  {min:5000, col:'#ffb300',glow:'#ffb30055',sparkCol:'#ffb300',mul:1.5, name:'amber'},
  {min:10000,col:'#ff8000',glow:'#ff800055',sparkCol:'#ff8000',mul:2,   name:'orange'},
  {min:15000,col:'#ff4500',glow:'#ff450055',sparkCol:'#ff4500',mul:2.5, name:'deeporange'},
  {min:20000,col:'#ff2000',glow:'#ff200055',sparkCol:'#ff2000',mul:3,   name:'redorange'},
  {min:25000,col:'#cc0000',glow:'#cc000055',sparkCol:'#cc0000',mul:4,   name:'red'},
  {min:30000,col:'#7a0000',glow:'#7a000066',sparkCol:'#aa2200',mul:5,   name:'darkred'}
];
let _coinTierCache=null,_coinTierScore=-1;
function getCoinTier(){if(score===_coinTierScore&&_coinTierCache)return _coinTierCache;_coinTierScore=score;for(let i=COIN_TIERS.length-1;i>=0;i--)if(score>=COIN_TIERS[i].min){_coinTierCache=COIN_TIERS[i];return _coinTierCache;}_coinTierCache=COIN_TIERS[0];return _coinTierCache;}
let coinSwitches=[],coinSwitchCD=0;
const COIN_SW_R=12,COIN_SW_COL='#4488ff';

// ===== SHOP SYSTEM =====
const SHOP_ITEMS={
  skins:[
    {id:'skin_red',name:'\u30ec\u30c3\u30c9',col:'#ff4444',col2:'#cc2222',price:3000,desc:'\u60c5\u71b1\u306e\u8d64'},
    {id:'skin_gold',name:'\u30b4\u30fc\u30eb\u30c9',col:'#ffd700',col2:'#cc9900',price:10000,desc:'\u8f1d\u304f\u9ec4\u91d1',rarity:'rare'},
    {id:'skin_pink',name:'\u30d4\u30f3\u30af',col:'#ff69b4',col2:'#cc4488',price:5000,desc:'\u304b\u308f\u3044\u3044\u30d4\u30f3\u30af'},
    {id:'skin_emerald',name:'\u30a8\u30e1\u30e9\u30eb\u30c9',col:'#50c878',col2:'#2a9d5c',price:6000,desc:'\u5b9d\u77f3\u306e\u7dd1'},
    {id:'skin_ice',name:'\u30a2\u30a4\u30b9',col:'#88ddff',col2:'#55aadd',price:4000,desc:'\u6c37\u306e\u30d6\u30eb\u30fc'},
    {id:'skin_shadow',name:'\u30b7\u30e3\u30c9\u30a6',col:'#2a2a3e',col2:'#111122',price:16000,desc:'\u6f06\u9ed2\u306e\u95c7'},
    {id:'skin_sunset',name:'\u30b5\u30f3\u30bb\u30c3\u30c8',col:'#ff6b35',col2:'#cc4411',price:8000,desc:'\u5915\u713c\u3051\u306e\u30aa\u30ec\u30f3\u30b8'},
    {id:'skin_galaxy',name:'\u30ae\u30e3\u30e9\u30af\u30b7\u30fc',col:'#7b2fbe',col2:'#4a1a7a',price:20000,desc:'\u5b87\u5b99\u306e\u7d2b',rarity:'rare'},
    {id:'skin_chrome',name:'\u30af\u30ed\u30e0',col:'#c0c0c0',col2:'#888888',price:12000,desc:'\u30e1\u30bf\u30ea\u30c3\u30af\u30b7\u30eb\u30d0\u30fc',rarity:'rare'},
    {id:'skin_rainbow',name:'\u30ec\u30a4\u30f3\u30dc\u30fc',col:'rainbow',col2:'rainbow',price:30000,desc:'\u8679\u8272\u306b\u5149\u308b\uff01',rarity:'super_rare'},
    {id:'skin_plasma',name:'\u30d7\u30e9\u30ba\u30de',col:'#ff00ff',col2:'#aa00aa',price:24000,desc:'\u30d7\u30e9\u30ba\u30de\u30a8\u30cd\u30eb\u30ae\u30fc',rarity:'rare'},
    {id:'skin_void',name:'\u30f4\u30a9\u30a4\u30c9',col:'#0a0a1a',col2:'#000005',price:40000,desc:'\u865a\u7121\u306e\u6f06\u9ed2',rarity:'rare'},
    {id:'skin_skeleton',name:'\u30b9\u30b1\u30eb\u30c8\u30f3',col:'skeleton',col2:'skeleton',price:50000,desc:'\u900f\u304d\u901a\u308b\u5e7b\u5f71',rarity:'super_rare'},
    {id:'skin_aurora',name:'\u30aa\u30fc\u30ed\u30e9',col:'aurora',col2:'aurora',price:42000,desc:'\u6975\u5149\u304c\u63fa\u3089\u3081\u304f',rarity:'super_rare',gachaOnly:true,newItem:true},
    {id:'skin_inferno',name:'\u30a4\u30f3\u30d5\u30a7\u30eb\u30ce',col:'#ff2200',col2:'#880000',price:26000,desc:'\u707c\u71b1\u306e\u696d\u706b',rarity:'rare',gachaOnly:true,newItem:true},
    {id:'skin_hologram',name:'\u30db\u30ed\u30b0\u30e9\u30e0',col:'hologram',col2:'hologram',price:60000,desc:'\u6b21\u5143\u3092\u8d85\u3048\u308b\u5149\u4f53',rarity:'super_rare',gachaOnly:true,newItem:true},
    {id:'skin_midnight',name:'\u30df\u30c3\u30c9\u30ca\u30a4\u30c8',col:'#101827',col2:'#38bdf8',price:14000,desc:'\u591c\u7a7a\u3068\u9752\u3044\u5149',rarity:'rare',newItem:true},
    {id:'skin_lime',name:'\u30e9\u30a4\u30e0',col:'#a3e635',col2:'#3f6212',price:7000,desc:'\u9bae\u3084\u304b\u306a\u30e9\u30a4\u30e0',newItem:true},
    {id:'skin_candy',name:'\u30ad\u30e3\u30f3\u30c7\u30a3',col:'#fb7185',col2:'#67e8f9',price:9000,desc:'\u7518\u3044\u30c4\u30fc\u30c8\u30fc\u30f3',newItem:true},
    {id:'skin_lava_lamp',name:'\u30e9\u30d0\u30e9\u30f3\u30d7',col:'#f97316',col2:'#7c2d12',price:18000,desc:'\u3068\u308d\u3051\u308b\u71b1\u5149',rarity:'rare',newItem:true},
    {id:'skin_deep_sea',name:'\u30c7\u30a3\u30fc\u30d7\u30b7\u30fc',col:'#0f766e',col2:'#042f2e',price:11000,desc:'\u6df1\u6d77\u306e\u7dd1\u9752',newItem:true},
    {id:'skin_mono',name:'\u30e2\u30ce\u30af\u30ed',col:'#f8fafc',col2:'#0f172a',price:13000,desc:'\u767d\u9ed2\u306e\u30b3\u30f3\u30c8\u30e9\u30b9\u30c8',rarity:'rare',newItem:true},
    {id:'skin_royal',name:'\u30ed\u30a4\u30e4\u30eb',col:'#4c1d95',col2:'#facc15',price:22000,desc:'\u738b\u51a0\u306e\u7d2b\u3068\u91d1',rarity:'rare',newItem:true},
    {id:'skin_pearl',name:'\u30d1\u30fc\u30eb',col:'#fff7ed',col2:'#f9a8d4',price:26000,desc:'\u771f\u73e0\u306e\u3084\u308f\u3089\u304b\u3044\u5149',rarity:'rare',newItem:true},
    {id:'skin_nebula',name:'\u30cd\u30d3\u30e5\u30e9',col:'#312e81',col2:'#ec4899',price:36000,desc:'\u661f\u96f2\u306e\u6df7\u3056\u308b\u5149',rarity:'super_rare',gachaOnly:true,newItem:true},
    {id:'skin_quantum',name:'\u30af\u30a9\u30f3\u30bf\u30e0',col:'#22d3ee',col2:'#a855f7',price:52000,desc:'\u91cf\u5b50\u306e\u3086\u3089\u304e',rarity:'super_rare',gachaOnly:true,newItem:true},
    {id:'skin_obsidian_gold',name:'\u9ed2\u91d1',col:'#080808',col2:'#fbbf24',price:56000,desc:'\u9ed2\u66dc\u77f3\u3068\u91d1\u306e\u8f1d\u304d',rarity:'super_rare',gachaOnly:true,newItem:true},
    {id:'skin_crystal',name:'\u30af\u30ea\u30b9\u30bf\u30eb',col:'#bfdbfe',col2:'#7dd3fc',price:48000,desc:'\u900f\u660e\u611f\u306e\u3042\u308b\u7d50\u6676',rarity:'super_rare',gachaOnly:true,newItem:true},
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
    {id:'eye_galaxy',name:'\u30ae\u30e3\u30e9\u30af\u30b7\u30fc\u30a2\u30a4',type:'galaxy',price:42000,desc:'\u661f\u96f2\u306e\u77b3',rarity:'super_rare'},
    {id:'eye_glitch',name:'\u30b0\u30ea\u30c3\u30c1\u30a2\u30a4',type:'glitch',price:36000,desc:'\u30d0\u30b0\u3063\u305f\u77b3',rarity:'rare'},
    {id:'eye_blink',name:'\u30d6\u30ea\u30f3\u30af\u30a2\u30a4',type:'blink',price:18000,desc:'\u77ac\u304d\u3059\u308b\u751f\u304d\u305f\u77b3',rarity:'rare',newItem:true},
    {id:'eye_pulse',name:'\u30d1\u30eb\u30b9\u30a2\u30a4',type:'pulse',price:22000,desc:'\u8108\u6253\u3064\u3088\u3046\u306b\u5149\u308b\u77b3',rarity:'rare',gachaOnly:true,newItem:true},
    {id:'eye_cross',name:'\u30af\u30ed\u30b9\u30a2\u30a4',type:'cross',price:20000,desc:'\u5341\u5b57\u306b\u5149\u308b\u795e\u79d8\u306e\u77b3',rarity:'rare',gachaOnly:true,newItem:true},
    {id:'eye_hypno',name:'\u30d2\u30d7\u30ce\u30a2\u30a4',type:'hypno',price:55000,desc:'\u5e7b\u60d1\u306e\u6e26\u5dfb\u304d\u30a2\u30cb\u30e1\u77b3',rarity:'super_rare',gachaOnly:true,newItem:true},
    {id:'eye_sleepy',name:'\u30b9\u30ea\u30fc\u30d4\u30fc\u30a2\u30a4',type:'sleepy',price:5000,desc:'\u306d\u3080\u305d\u3046\u306a\u534a\u76ee',newItem:true},
    {id:'eye_coin',name:'\u30b3\u30a4\u30f3\u30a2\u30a4',type:'coin',price:9000,desc:'\u30b3\u30a4\u30f3\u307f\u305f\u3044\u306a\u77b3',newItem:true},
    {id:'eye_moon',name:'\u30e0\u30fc\u30f3\u30a2\u30a4',type:'moon',price:11000,desc:'\u4e09\u65e5\u6708\u306e\u77b3',newItem:true},
    {id:'eye_target',name:'\u30bf\u30fc\u30b2\u30c3\u30c8\u30a2\u30a4',type:'target',price:14000,desc:'\u72d9\u3044\u3092\u5b9a\u3081\u308b\u77b3',rarity:'rare',newItem:true},
    {id:'eye_prism',name:'\u30d7\u30ea\u30ba\u30e0\u30a2\u30a4',type:'prism',price:26000,desc:'\u5149\u3092\u5206\u3051\u308b\u4e09\u89d2\u306e\u77b3',rarity:'rare',newItem:true},
    {id:'eye_laser',name:'\u30ec\u30fc\u30b6\u30fc\u30a2\u30a4',type:'laser',price:28000,desc:'\u6a2a\u4e00\u7dda\u306b\u8f1d\u304f\u77b3',rarity:'rare',newItem:true},
    {id:'eye_tears',name:'\u30c6\u30a3\u30a2\u30fc\u30a2\u30a4',type:'tears',price:15000,desc:'\u6d99\u306e\u5149\u304c\u843d\u3061\u308b\u77b3',rarity:'rare',newItem:true},
    {id:'eye_crown',name:'\u30af\u30e9\u30a6\u30f3\u30a2\u30a4',type:'crown',price:44000,desc:'\u738b\u51a0\u3092\u5bbf\u3059\u77b3',rarity:'super_rare',gachaOnly:true,newItem:true},
    {id:'eye_eclipse',name:'\u30a8\u30af\u30ea\u30d7\u30b9\u30a2\u30a4',type:'eclipse',price:50000,desc:'\u65e5\u98df\u306e\u5149\u8f2a',rarity:'super_rare',gachaOnly:true,newItem:true},
    {id:'eye_constellation',name:'\u661f\u5ea7\u30a2\u30a4',type:'constellation',price:54000,desc:'\u661f\u3092\u7e4b\u3050\u77b3',rarity:'super_rare',gachaOnly:true,newItem:true},
  ],
  effects:[
    {id:'fx_sparkle',name:'\u30ad\u30e9\u30ad\u30e9',type:'sparkle',price:8000,desc:'\u5149\u306e\u7c92\u5b50\u304c\u821e\u3046'},
    {id:'fx_fire_aura',name:'\u708e\u30aa\u30fc\u30e9',type:'fire_aura',price:14000,desc:'\u8d64\u3044\u708e\u306e\u30aa\u30fc\u30e9'},
    {id:'fx_ice_aura',name:'\u6c37\u30aa\u30fc\u30e9',type:'ice_aura',price:14000,desc:'\u9752\u3044\u6c37\u306e\u30aa\u30fc\u30e9'},
    {id:'fx_electric',name:'\u96fb\u6483',type:'electric',price:18000,desc:'\u96fb\u6c17\u304c\u8d70\u308b'},
    {id:'fx_hearts',name:'\u30cf\u30fc\u30c8',type:'hearts',price:6000,desc:'\u30cf\u30fc\u30c8\u304c\u6d6e\u304b\u3076'},
    {id:'fx_shadow',name:'\u30c0\u30fc\u30af\u30aa\u30fc\u30e9',type:'shadow',price:20000,desc:'\u95c7\u306e\u30aa\u30fc\u30e9',rarity:'rare'},
    {id:'fx_rainbow',name:'\u30ec\u30a4\u30f3\u30dc\u30fc\u30aa\u30fc\u30e9',type:'rainbow',price:46000,desc:'\u8679\u8272\u306b\u5149\u308b\u30aa\u30fc\u30e9',rarity:'super_rare'},
    {id:'fx_sakura',name:'\u685c\u5439\u96ea',type:'sakura',price:10000,desc:'\u685c\u306e\u82b1\u3073\u3089\u304c\u821e\u3046'},
    {id:'fx_star_trail',name:'\u661f\u306e\u8ecc\u8de1',type:'star_trail',price:24000,desc:'\u661f\u304c\u6d41\u308c\u308b\u8ecc\u8de1',rarity:'rare'},
    {id:'fx_plasma_trail',name:'\u30d7\u30e9\u30ba\u30de\u30c8\u30ec\u30a4\u30eb',type:'plasma_trail',price:32000,desc:'\u30d7\u30e9\u30ba\u30de\u306e\u8ecc\u8de1',rarity:'rare'},
    {id:'fx_void_aura',name:'\u30f4\u30a9\u30a4\u30c9\u30aa\u30fc\u30e9',type:'void_aura',price:40000,desc:'\u865a\u7121\u306e\u30aa\u30fc\u30e9',rarity:'rare'},
    {id:'fx_celestial',name:'\u30bb\u30ec\u30b9\u30c6\u30a3\u30a2\u30eb',type:'celestial',price:60000,desc:'\u5929\u754c\u306e\u795e\u8056\u306a\u30aa\u30fc\u30e9',rarity:'super_rare'},
    {id:'fx_phoenix',name:'\u30d5\u30a7\u30cb\u30c3\u30af\u30b9',type:'phoenix',price:28000,desc:'\u4e0d\u6b7b\u9ce5\u306e\u7fbd\u304c\u821e\u3046',rarity:'rare',gachaOnly:true,newItem:true},
    {id:'fx_glitch_trail',name:'\u30b0\u30ea\u30c3\u30c1\u30c8\u30ec\u30a4\u30eb',type:'glitch_trail',price:26000,desc:'\u30ce\u30a4\u30ba\u304c\u8d70\u308b\u8ecc\u8de1',rarity:'rare',gachaOnly:true,newItem:true},
    {id:'fx_supernova',name:'\u30b9\u30fc\u30d1\u30fc\u30ce\u30f4\u30a1',type:'supernova',price:65000,desc:'\u8d85\u65b0\u661f\u7206\u767a\u306e\u30aa\u30fc\u30e9',rarity:'super_rare',gachaOnly:true,newItem:true},
    {id:'fx_bubbles',name:'\u30d0\u30d6\u30eb',type:'bubbles',price:7000,desc:'\u6ce1\u304c\u3075\u308f\u3075\u308f\u6d6e\u304b\u3076',newItem:true},
    {id:'fx_confetti',name:'\u30b3\u30f3\u30d5\u30a7\u30c3\u30c6\u30a3',type:'confetti',price:12000,desc:'\u5c0f\u3055\u306a\u7d19\u5439\u96ea',newItem:true},
    {id:'fx_music',name:'\u30df\u30e5\u30fc\u30b8\u30c3\u30af',type:'music',price:13000,desc:'\u97f3\u7b26\u304c\u30ea\u30ba\u30e0\u306b\u821e\u3046',newItem:true},
    {id:'fx_pixel',name:'\u30d4\u30af\u30bb\u30eb',type:'pixel',price:16000,desc:'\u30c9\u30c3\u30c8\u304c\u5f3e\u3051\u308b',rarity:'rare',newItem:true},
    {id:'fx_snowflake',name:'\u30b9\u30ce\u30fc\u30d5\u30ec\u30fc\u30af',type:'snowflake',price:18000,desc:'\u96ea\u306e\u7d50\u6676\u304c\u56de\u308b',rarity:'rare',newItem:true},
    {id:'fx_meteor',name:'\u30e1\u30c6\u30aa',type:'meteor',price:30000,desc:'\u5c0f\u3055\u306a\u6d41\u661f\u304c\u843d\u3061\u308b',rarity:'rare',newItem:true},
    {id:'fx_rune',name:'\u30eb\u30fc\u30f3',type:'rune',price:34000,desc:'\u9b54\u6cd5\u9663\u306e\u5149',rarity:'rare',newItem:true},
    {id:'fx_comet_crown',name:'\u30b3\u30e1\u30c3\u30c8\u30af\u30e9\u30a6\u30f3',type:'comet_crown',price:52000,desc:'\u982d\u4e0a\u3092\u5de1\u308b\u5f57\u661f\u306e\u51a0',rarity:'super_rare',gachaOnly:true,newItem:true},
    {id:'fx_matrix',name:'\u30de\u30c8\u30ea\u30af\u30b9',type:'matrix',price:56000,desc:'\u7dd1\u306e\u30b3\u30fc\u30c9\u304c\u6d41\u308c\u308b',rarity:'super_rare',gachaOnly:true,newItem:true},
    {id:'fx_timewarp',name:'\u30bf\u30a4\u30e0\u30ef\u30fc\u30d7',type:'timewarp',price:62000,desc:'\u6642\u8a08\u306e\u8f2a\u304c\u6b6a\u3080',rarity:'super_rare',gachaOnly:true,newItem:true},
  ],
  pets:[
    {id:'pet_comet',type:'comet',price:50000,desc:'\u30ad\u30e9\u30ea\u3068\u5f8c\u308d\u3092\u98db\u3076\u661f\u5c18\u306e\u76f8\u68d2',ability:'\u2b50 \u30b3\u30a4\u30f3\u3092\u5f31\u304f\u5f15\u304d\u5bc4\u305b\u308b\uff08\u5e38\u6642\uff09'},
    {id:'pet_puff',type:'puff',price:50000,desc:'\u3077\u304b\u3077\u304b\u8ffd\u3044\u304b\u3051\u308b\u5c0f\u3055\u306a\u304a\u3070\u3051',ability:'\u2728 \u5b9a\u671f\u7684\u306b\u900f\u660e\u5316\u3057\u6575\u306e\u653b\u6483\u3092\u56de\u907f'},
    {id:'pet_drone',type:'drone',price:60000,desc:'\u30d6\u30fc\u30b9\u30c8\u5674\u5c04\u3067\u8ffd\u5f93\u3059\u308b\u30df\u30cb\u30c9\u30ed\u30fc\u30f3',ability:'\ud83d\ude81 \u843d\u3061\u305d\u3046\u306a\u6642\u306b\u52a9\u3051\u3066\u304f\u308c\u308b\u304b\u3082\u2026'},
  ],
  accessories:[
    {id:'acc_halo',type:'halo',price:25000,desc:'\u5149\u306e\u7c92\u304c\u821e\u3046\u5929\u4f7f\u306e\u8f2a'},
    {id:'acc_crown',type:'crown',price:30000,desc:'\u91d1\u8272\u306e\u706b\u82b1\u3092\u6563\u3089\u3059\u738b\u51a0'},
    {id:'acc_starpin',type:'ribbon',price:27500,desc:'\u3075\u308f\u308a\u3068\u3072\u3089\u3081\u304f\u30c9\u30ec\u30b9\u30ea\u30dc\u30f3'},
  ],
  items:[
    {id:'item_magnet',type:'magnet',price:1000,desc:'\u624b\u52d5\u767a\u52d5\u3067\u30b3\u30a4\u30f3\u3092\u5f37\u529b\u5438\u53ce',stackMax:99},
    {id:'item_bomb',type:'bomb',price:500,desc:'\u624b\u52d5\u767a\u52d5\u3067\u753b\u9762\u5185\u306e\u5371\u967a\u3092\u5439\u304d\u98db\u3070\u3059',stackMax:99},
  ],
};
const SHOP_TAB_DEFS=[
  {key:'skins',labelKey:'skinTab',color:'#ff69b4',isCosmetic:true,equipSlot:'skin'},
  {key:'eyes',labelKey:'eyeTab',color:'#00e5ff',isCosmetic:true,equipSlot:'eyes'},
  {key:'effects',labelKey:'effectTab',color:'#ffd700',isCosmetic:true,equipSlot:'effect'},
  {key:'pets',labelKey:'petTab',color:'#34d399',isCosmetic:true,equipSlot:'pet'},
  {key:'accessories',labelKey:'accessoryTab',color:'#fb923c',isCosmetic:true,equipSlot:'accessory'},
  {key:'items',labelKey:'itemTab',color:'#60a5fa',isCosmetic:false,equipSlot:''},
];
const COSMETIC_TAB_DEFS=SHOP_TAB_DEFS.filter(def=>def.isCosmetic);
function shopTabDef(tab){return SHOP_TAB_DEFS[Math.max(0,Math.min(SHOP_TAB_DEFS.length-1,tab))];}
function cosmeticTabDef(tab){return COSMETIC_TAB_DEFS[Math.max(0,Math.min(COSMETIC_TAB_DEFS.length-1,tab))];}
function shopItemsForTab(tab){const def=shopTabDef(tab);return SHOP_ITEMS[def.key]||[];}
function cosmeticItemsForTab(tab){const def=cosmeticTabDef(tab);return SHOP_ITEMS[def.key]||[];}
const TITLE_GROUP_ORDER=['plays','coins','score','challenge','chests','collection','characters'];
const TITLE_GROUP_LABEL_KEYS={plays:'titleCategoryPlays',coins:'titleCategoryCoins',score:'titleCategoryScore',challenge:'titleCategoryChallenge',chests:'titleCategoryChests',collection:'titleCategoryCollection',characters:'titleCategoryCharacters'};
const TITLE_DEFS=[
  {id:'plays_100',group:'plays',kind:'plays',value:100,nameJa:'ファーストフリップ',nameEn:'First Flip'},
  {id:'plays_500',group:'plays',kind:'plays',value:500,nameJa:'常連グライダー',nameEn:'Regular Glider'},
  {id:'plays_1000',group:'plays',kind:'plays',value:1000,nameJa:'重力ランナー',nameEn:'Gravity Runner'},
  {id:'plays_5000',group:'plays',kind:'plays',value:5000,nameJa:'無重力ジャンキー',nameEn:'Zero-G Junkie'},
  {id:'plays_10000',group:'plays',kind:'plays',value:10000,nameJa:'次元住民',nameEn:'Dimension Dweller'},
  {id:'coins_10000',group:'coins',kind:'coins',value:10000,nameJa:'小金の星',nameEn:'Gold Spark'},
  {id:'coins_50000',group:'coins',kind:'coins',value:50000,nameJa:'ゴールドラッシュ',nameEn:'Gold Rush'},
  {id:'coins_100000',group:'coins',kind:'coins',value:100000,nameJa:'財宝ハンター',nameEn:'Treasure Hunter'},
  {id:'coins_500000',group:'coins',kind:'coins',value:500000,nameJa:'ミダスタッチ',nameEn:'Midas Touch'},
  {id:'coins_1000000',group:'coins',kind:'coins',value:1000000,nameJa:'ミリオンノヴァ',nameEn:'Million Nova'},
  {id:'score_10000',group:'score',kind:'score',value:10000,nameJa:'一万光年',nameEn:'Ten-K Lightyear'},
  {id:'score_20000',group:'score',kind:'score',value:20000,nameJa:'成層圏ダッシャー',nameEn:'Stratos Dasher'},
  {id:'score_30000',group:'score',kind:'score',value:30000,nameJa:'天井知らず',nameEn:'Skybreaker'},
  {id:'score_40000',group:'score',kind:'score',value:40000,nameJa:'限界突破線',nameEn:'Limit Breaker'},
  {id:'score_50000',group:'score',kind:'score',value:50000,nameJa:'重力神話',nameEn:'Gravity Myth'},
  {id:'challenge_5',group:'challenge',kind:'challenge',value:5,nameJa:'試練の火花',nameEn:'Spark of Trials'},
  {id:'challenge_10',group:'challenge',kind:'challenge',value:10,nameJa:'連戦の牙',nameEn:'Fang of Trials'},
  {id:'challenge_15',group:'challenge',kind:'challenge',value:15,nameJa:'修羅テンポ',nameEn:'Warpath Tempo'},
  {id:'challenge_30',group:'challenge',kind:'challenge',value:30,nameJa:'殲滅オペラ',nameEn:'Annihilation Opera'},
  {id:'chests_100',group:'chests',kind:'chests',value:100,nameJa:'宝箱ソムリエ',nameEn:'Chest Sommelier'},
  {id:'chests_500',group:'chests',kind:'chests',value:500,nameJa:'秘宝コレクター',nameEn:'Relic Collector'},
  {id:'chests_1000',group:'chests',kind:'chests',value:1000,nameJa:'遺宝考古学者',nameEn:'Treasure Archaeologist'},
  {id:'collect_eyes',group:'collection',kind:'collection',collection:'eyes',nameJa:'千のまなざし',nameEn:'Thousand Gazes'},
  {id:'collect_skins',group:'collection',kind:'collection',collection:'skins',nameJa:'クローゼット覇者',nameEn:'Closet Conqueror'},
  {id:'collect_effects',group:'collection',kind:'collection',collection:'effects',nameJa:'演出支配者',nameEn:'Effect Emperor'},
  {id:'collect_pets',group:'collection',kind:'collection',collection:'pets',nameJa:'相棒マスター',nameEn:'Companion Master'},
  {id:'collect_accessories',group:'collection',kind:'collection',collection:'accessories',nameJa:'飾り職人',nameEn:'Adornment Artisan'},
  {id:'collect_all',group:'collection',kind:'collection_all',nameJa:'銀河スタイリスト',nameEn:'Galaxy Stylist'},
  {id:'chars_all',group:'characters',kind:'characters_all',nameJa:'フルキャスト',nameEn:'Full Cast'},
];
function _sanitizeTitleId(v){if(!v||typeof v!=='string')return'';return v.replace(/[^a-z0-9_]/gi,'').substring(0,32);}
function getTitleDef(id){const safe=_sanitizeTitleId(id);for(let i=0;i<TITLE_DEFS.length;i++)if(TITLE_DEFS[i].id===safe)return TITLE_DEFS[i];return null;}
function tTitleName(id){const def=typeof id==='string'?getTitleDef(id):id;if(!def)return'';return gameLang==='ja'?def.nameJa:def.nameEn;}
function getTitleCollectionLabel(category){
  if(gameLang==='ja'){
    if(category==='eyes')return'目';
    if(category==='skins')return'スキン';
    if(category==='effects')return'エフェクト';
    if(category==='pets')return'ペット';
    if(category==='accessories')return'アクセサリー';
    return'コレクション';
  }
  if(category==='eyes')return'Eyes';
  if(category==='skins')return'Skins';
  if(category==='effects')return'Effects';
  if(category==='pets')return'Pets';
  if(category==='accessories')return'Accessories';
  return'Collection';
}
function getTitleConditionText(title){
  const def=typeof title==='string'?getTitleDef(title):title;
  if(!def)return'';
  switch(def.kind){
    case'plays':return gameLang==='ja'?('プレイ回数 '+def.value.toLocaleString()+'回'):('Play '+def.value.toLocaleString()+' times');
    case'coins':return gameLang==='ja'?('コイン獲得累計 '+def.value.toLocaleString()):('Earn '+def.value.toLocaleString()+' coins total');
    case'score':return gameLang==='ja'?('最高スコア '+def.value.toLocaleString()):('Reach score '+def.value.toLocaleString());
    case'challenge':return gameLang==='ja'?('チャレンジ最高スコア '+def.value.toLocaleString()):('Reach Challenge score '+def.value.toLocaleString());
    case'chests':return gameLang==='ja'?('宝箱を '+def.value.toLocaleString()+'個開封'):('Open '+def.value.toLocaleString()+' chests');
    case'collection':return gameLang==='ja'?(getTitleCollectionLabel(def.collection)+'をすべて獲得'):('Collect every '+getTitleCollectionLabel(def.collection));
    case'collection_all':return gameLang==='ja'?'すべての着せ替えアイテムを獲得':'Collect every cosmetic item';
    case'characters_all':return gameLang==='ja'?'全キャラクターを解放':'Unlock every character';
  }
  return'';
}
function hasCollectedAllCategory(category){
  const items=SHOP_ITEMS[category]||[];
  if(items.length===0)return false;
  for(let i=0;i<items.length;i++)if(!ownsItem(items[i].id))return false;
  return true;
}
function isTitleUnlocked(title){
  const def=typeof title==='string'?getTitleDef(title):title;
  if(!def)return false;
  switch(def.kind){
    case'plays':return (played||0)>=def.value;
    case'coins':return (lifetimeCoinsEarned||0)>=def.value;
    case'score':return (highScore||0)>=def.value;
    case'challenge':return (challengeBestKills||0)>=def.value;
    case'chests':return (totalChestsOpened||0)>=def.value;
    case'collection':return hasCollectedAllCategory(def.collection);
    case'collection_all':return hasCollectedAllCategory('skins')&&hasCollectedAllCategory('eyes')&&hasCollectedAllCategory('effects')&&hasCollectedAllCategory('pets')&&hasCollectedAllCategory('accessories');
    case'characters_all':return unlockedChars&&unlockedChars.length>=CHARS.length;
  }
  return false;
}
function getUnlockedTitleDefs(){const arr=[];for(let i=0;i<TITLE_DEFS.length;i++)if(isTitleUnlocked(TITLE_DEFS[i]))arr.push(TITLE_DEFS[i]);return arr;}
function getTitleMenuEntries(){
  const entries=[];
  for(let gi=0;gi<TITLE_GROUP_ORDER.length;gi++){
    const group=TITLE_GROUP_ORDER[gi];
    entries.push({type:'header',group,label:t(TITLE_GROUP_LABEL_KEYS[group])});
    for(let i=0;i<TITLE_DEFS.length;i++)if(TITLE_DEFS[i].group===group)entries.push({type:'title',def:TITLE_DEFS[i]});
  }
  return entries;
}
function titleMenuEntryHeight(entry){return entry.type==='header'?24:60;}
function titleMenuLayout(){
  const mW=Math.min(336,W-16),topPad=safeTop+8;
  const mH=H-topPad-10,mX=(W-mW)/2,mY=topPad;
  const hdrH=108,listY=mY+hdrH,listH=mH-hdrH-48;
  return{mW,mH,mX,mY,hdrH,listY,listH,footerY:mY+mH-40};
}
function titleMenuContentHeight(entries){let h=0;for(let i=0;i<entries.length;i++)h+=titleMenuEntryHeight(entries[i]);return h;}
// Shop state
let shopOpen=false;
let shopTab=0; // 0=skins, 1=eyes, 2=effects, 3=pets, 4=accessories, 5=items
let shopScroll=0;
// Owned items & equipped cosmetics (saved to localStorage)
let ownedItems=(function(){try{const a=JSON.parse(localStorage.getItem('gd5owned')||'[]');if(!Array.isArray(a))return[];return a.filter(v=>typeof v==='string').map(_sanitizeLsCosmId).filter(v=>v.length>0);}catch(e){return[];}})();
let equippedSkin=_sanitizeLsCosmId(localStorage.getItem('gd5eqSkin')||'');
let equippedEyes=_sanitizeLsCosmId(localStorage.getItem('gd5eqEyes')||'');
let equippedEffect=_sanitizeLsCosmId(localStorage.getItem('gd5eqFx')||'');
let equippedPet=_sanitizeLsCosmId(localStorage.getItem('gd5eqPet')||'');
let equippedAccessory=_sanitizeLsCosmId(localStorage.getItem('gd5eqAcc')||'');
let lifetimeCoinsEarned=Math.max(Math.max(0,parseInt(localStorage.getItem('gd5coinTotal')||'0')||0),walletCoins||0);
localStorage.setItem('gd5coinTotal',lifetimeCoinsEarned.toString());
let equippedTitleId=_sanitizeTitleId(localStorage.getItem('gd5titleId')||'');
let cosmeticMenuOpen=false; // cosmetic equip menu
let cosmeticTab=0; // 0=skins, 1=eyes, 2=effects, 3=pets, 4=accessories
let cosmeticScroll=0;
let titleMenuOpen=false;
let titleMenuScroll=0;
let titlePendingTap=null;
let titleConfirmPending=null; // {def, nextId} - pending title equip confirmation
let itemStocks=(function(){
  try{
    const raw=JSON.parse(localStorage.getItem('gd5itemStocks')||'{}')||{};
    return{
      item_magnet:Math.max(0,Math.min(99,parseInt(raw.item_magnet||'0')||0)),
      item_bomb:Math.max(0,Math.min(99,parseInt(raw.item_bomb||'0')||0)),
    };
  }catch(e){
    return{item_magnet:0,item_bomb:0};
  }
})();
// --- Notification badges ---
let notifNewCosmetic=localStorage.getItem('gd5notifCosm')==='1'; // new cosmetic obtained
let newCosmeticIds=new Set(JSON.parse(localStorage.getItem('gd5newCosm')||'[]')); // individual new cosmetic IDs
let notifNewChars=JSON.parse(localStorage.getItem('gd5notifChars')||'[]'); // newly unlocked char indices
let notifNewHighScore=localStorage.getItem('gd5notifHi')==='1'; // new high score achieved
let notifShopPetNew=localStorage.getItem('gd5shopPetNew')!=='0'; // pet/accessory tab is new
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
function addLifetimeCoins(amount){
  const gain=Math.max(0,Math.floor(amount||0));
  if(gain<=0)return lifetimeCoinsEarned||0;
  lifetimeCoinsEarned=(lifetimeCoinsEarned||0)+gain;
  localStorage.setItem('gd5coinTotal',lifetimeCoinsEarned.toString());
  return lifetimeCoinsEarned;
}
function getEquippedTitleDef(){return equippedTitleId?getTitleDef(equippedTitleId):null;}
function ensureEquippedTitleValid(){
  if(equippedTitleId&&!isTitleUnlocked(equippedTitleId)){
    equippedTitleId='';
    localStorage.setItem('gd5titleId','');
  }
  return equippedTitleId;
}
function setEquippedTitle(id){
  const safe=_sanitizeTitleId(id);
  if(safe&&!isTitleUnlocked(safe))return false;
  equippedTitleId=safe;
  localStorage.setItem('gd5titleId',equippedTitleId);
  rebuildRankingData();
  rebuildChallengeRankingData();
  if(typeof fbSaveUserData==='function')fbSaveUserData();
  return true;
}
ensureEquippedTitleValid();
function saveItemStocks(){localStorage.setItem('gd5itemStocks',JSON.stringify(itemStocks));if(typeof fbSaveUserData==='function')fbSaveUserData();}
function itemStock(id){return Math.max(0,Math.min(99,parseInt(itemStocks[id]||'0')||0));}
function setItemStock(id,count){itemStocks[id]=Math.max(0,Math.min(99,count|0));saveItemStocks();}
function addItemStock(id,delta){setItemStock(id,itemStock(id)+(delta|0));}
function isConsumableItem(item){return !!item&&item.type&&(item.id==='item_magnet'||item.id==='item_bomb');}
function consumeStoredRunItem(id){
  const stock=itemStock(id);
  if(stock>0){setItemStock(id,stock-1);return true;}
  return false;
}
function prepareConsumableLoadout(){
  const endlessMode=gameMode==='endless'&&!isPackMode&&!isChallengeMode;
  magnetCount=endlessMode?Math.min(3,itemStock('item_magnet')):0;
  bombCount=endlessMode?Math.min(3,itemStock('item_bomb')):0;
}
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
function buyConsumable(item){
  if(!item||walletCoins<(item.price||0))return false;
  const cur=itemStock(item.id),max=item.stackMax||99;
  if(cur>=max)return false;
  walletCoins-=item.price||0;
  localStorage.setItem('gd5wallet',walletCoins.toString());
  setItemStock(item.id,cur+1);
  return true;
}
function maxPurchasableConsumable(item){
  if(!item||!isConsumableItem(item))return 0;
  const max=item.stackMax||99;
  const remaining=Math.max(0,max-itemStock(item.id));
  const affordable=item.price>0?Math.floor(walletCoins/item.price):remaining;
  return Math.max(0,Math.min(remaining,affordable));
}
function buyConsumableQuantity(item,qty){
  const maxQty=maxPurchasableConsumable(item);
  const count=Math.max(0,Math.min(maxQty,qty|0));
  if(count<=0)return 0;
  walletCoins-=count*(item.price||0);
  localStorage.setItem('gd5wallet',walletCoins.toString());
  setItemStock(item.id,itemStock(item.id)+count);
  return count;
}
function currentRankingAppearance(){
  return{
    charIdx:selChar||0,
    eqSkin:equippedSkin||'',
    eqEyes:equippedEyes||'',
    eqFx:equippedEffect||'',
    eqPet:equippedPet||'',
    eqAcc:equippedAccessory||'',
    titleId:equippedTitleId||'',
  };
}
function syncLiveRankingAppearanceLocally(){
  const live=currentRankingAppearance();
  rankChar=live.charIdx;rankSkin=live.eqSkin;rankEyes=live.eqEyes;rankFx=live.eqFx;rankPet=live.eqPet;rankAcc=live.eqAcc;
  challRankChar=live.charIdx;challRankSkin=live.eqSkin;challRankEyes=live.eqEyes;challRankFx=live.eqFx;challRankPet=live.eqPet;challRankAcc=live.eqAcc;
  localStorage.setItem('gd5rankChar',rankChar.toString());localStorage.setItem('gd5rankSkin',rankSkin);
  localStorage.setItem('gd5rankEyes',rankEyes);localStorage.setItem('gd5rankFx',rankFx);
  localStorage.setItem('gd5rankPet',rankPet);localStorage.setItem('gd5rankAcc',rankAcc);
  localStorage.setItem('gd5challRankChar',challRankChar.toString());localStorage.setItem('gd5challRankSkin',challRankSkin);
  localStorage.setItem('gd5challRankEyes',challRankEyes);localStorage.setItem('gd5challRankFx',challRankFx);
  localStorage.setItem('gd5challRankPet',challRankPet);localStorage.setItem('gd5challRankAcc',challRankAcc);
  return live;
}
function captureRankCosmetics(){
  return syncLiveRankingAppearanceLocally();
}
function equipSkin(id){equippedSkin=id;localStorage.setItem('gd5eqSkin',id);syncLiveRankingAppearanceLocally();if(typeof fbSaveUserData==='function')fbSaveUserData();}
function equipEyes(id){equippedEyes=id;localStorage.setItem('gd5eqEyes',id);syncLiveRankingAppearanceLocally();if(typeof fbSaveUserData==='function')fbSaveUserData();}
function equipEffect(id){equippedEffect=id;localStorage.setItem('gd5eqFx',id);syncLiveRankingAppearanceLocally();if(typeof fbSaveUserData==='function')fbSaveUserData();}
function equipPet(id){equippedPet=id;localStorage.setItem('gd5eqPet',id);petState.ready=false;syncLiveRankingAppearanceLocally();if(typeof fbSaveUserData==='function')fbSaveUserData();}
function equipAccessory(id){equippedAccessory=id;localStorage.setItem('gd5eqAcc',id);syncLiveRankingAppearanceLocally();if(typeof fbSaveUserData==='function')fbSaveUserData();}
function unequipSkin(){equippedSkin='';localStorage.setItem('gd5eqSkin','');syncLiveRankingAppearanceLocally();if(typeof fbSaveUserData==='function')fbSaveUserData();}
function unequipEyes(){equippedEyes='';localStorage.setItem('gd5eqEyes','');syncLiveRankingAppearanceLocally();if(typeof fbSaveUserData==='function')fbSaveUserData();}
function unequipEffect(){equippedEffect='';localStorage.setItem('gd5eqFx','');syncLiveRankingAppearanceLocally();if(typeof fbSaveUserData==='function')fbSaveUserData();}
function unequipPet(){equippedPet='';localStorage.setItem('gd5eqPet','');petState.ready=false;syncLiveRankingAppearanceLocally();if(typeof fbSaveUserData==='function')fbSaveUserData();}
function unequipAccessory(){equippedAccessory='';localStorage.setItem('gd5eqAcc','');syncLiveRankingAppearanceLocally();if(typeof fbSaveUserData==='function')fbSaveUserData();}
let _eqSkinCache=null,_eqSkinId='',_eqEyesCache=null,_eqEyesId='',_eqFxCache=null,_eqFxId='',_eqPetCache=null,_eqPetId='',_eqAccCache=null,_eqAccId='';
function getEquippedSkinData(){if(!equippedSkin)return null;if(_eqSkinId===equippedSkin)return _eqSkinCache;_eqSkinId=equippedSkin;for(let i=0;i<SHOP_ITEMS.skins.length;i++){if(SHOP_ITEMS.skins[i].id===equippedSkin){_eqSkinCache=SHOP_ITEMS.skins[i];return _eqSkinCache;}}_eqSkinCache=null;return null;}
function getEquippedEyesData(){if(!equippedEyes)return null;if(_eqEyesId===equippedEyes)return _eqEyesCache;_eqEyesId=equippedEyes;for(let i=0;i<SHOP_ITEMS.eyes.length;i++){if(SHOP_ITEMS.eyes[i].id===equippedEyes){_eqEyesCache=SHOP_ITEMS.eyes[i];return _eqEyesCache;}}_eqEyesCache=null;return null;}
function getEquippedEffectData(){if(!equippedEffect)return null;if(_eqFxId===equippedEffect)return _eqFxCache;_eqFxId=equippedEffect;for(let i=0;i<SHOP_ITEMS.effects.length;i++){if(SHOP_ITEMS.effects[i].id===equippedEffect){_eqFxCache=SHOP_ITEMS.effects[i];return _eqFxCache;}}_eqFxCache=null;return null;}
function getEquippedPetData(){if(!equippedPet)return null;if(_eqPetId===equippedPet)return _eqPetCache;_eqPetId=equippedPet;for(let i=0;i<SHOP_ITEMS.pets.length;i++){if(SHOP_ITEMS.pets[i].id===equippedPet){_eqPetCache=SHOP_ITEMS.pets[i];return _eqPetCache;}}_eqPetCache=null;return null;}
function getEquippedAccessoryData(){if(!equippedAccessory)return null;if(_eqAccId===equippedAccessory)return _eqAccCache;_eqAccId=equippedAccessory;for(let i=0;i<SHOP_ITEMS.accessories.length;i++){if(SHOP_ITEMS.accessories[i].id===equippedAccessory){_eqAccCache=SHOP_ITEMS.accessories[i];return _eqAccCache;}}_eqAccCache=null;return null;}
function equippedIdForSlot(slot){
  switch(slot){
    case'skin':return equippedSkin;
    case'eyes':return equippedEyes;
    case'effect':return equippedEffect;
    case'pet':return equippedPet;
    case'accessory':return equippedAccessory;
    default:return'';
  }
}
function equipItemForSlot(slot,id){
  switch(slot){
    case'skin':return id?equipSkin(id):unequipSkin();
    case'eyes':return id?equipEyes(id):unequipEyes();
    case'effect':return id?equipEffect(id):unequipEffect();
    case'pet':return id?equipPet(id):unequipPet();
    case'accessory':return id?equipAccessory(id):unequipAccessory();
  }
}
// Sort shop items: cheap→expensive (normal), then rare by price, then super_rare at bottom
function shopSorted(arr,includeGacha){const rVal=r=>r==='super_rare'?2:r==='rare'?1:0;const filtered=includeGacha?arr.slice():arr.filter(it=>!it.gachaOnly);return filtered.sort((a,b)=>{const ra=rVal(a.rarity),rb=rVal(b.rarity);if(ra!==rb)return ra-rb;return(a.price||0)-(b.price||0);});}
function cosmeticListForTab(tab){
  const allItems=cosmeticItemsForTab(tab);
  return[{id:'',name:t('none'),desc:t('default')}].concat(shopSorted(allItems,true));
}
function shopModalLayout(){
  const mW=Math.min(320,W-16),mH=Math.min(500,H-30);
  const mX=(W-mW)/2,mY=(H-mH)/2;
  const cols=3,tabH=26,rowGap=8,tabW=(mW-20)/cols,tabY=mY+56;
  const rows=Math.ceil(SHOP_TAB_DEFS.length/cols);
  const listY=tabY+rows*(tabH+rowGap)+4;
  const listH=mH-(listY-mY)-50;
  return{mW,mH,mX,mY,cols,tabH,rowGap,tabW,tabY,rows,listY,listH,rowH:54};
}
function shopTabRect(tab){
  const l=shopModalLayout(),col=tab%l.cols,row=Math.floor(tab/l.cols);
  return{x:l.mX+10+col*l.tabW,y:l.tabY+row*(l.tabH+l.rowGap),w:l.tabW-4,h:l.tabH};
}
function cosmeticModalLayout(){
  const mW=Math.min(320,W-16),mH=Math.min(500,H-30);
  const mX=(W-mW)/2,mY=(H-mH)/2;
  const cols=3,tabH=26,rowGap=12,tabW=(mW-20)/cols,tabY=mY+116;
  const rows=Math.ceil(COSMETIC_TAB_DEFS.length/cols);
  const listY=tabY+rows*(tabH+rowGap)+14;
  const listH=mH-(listY-mY)-50;
  return{mW,mH,mX,mY,cols,tabH,rowGap,tabW,tabY,rows,listY,listH,rowH:48};
}
function cosmeticTabRect(tab){
  const l=cosmeticModalLayout(),col=tab%l.cols,row=Math.floor(tab/l.cols);
  return{x:l.mX+10+col*l.tabW,y:l.tabY+row*(l.tabH+l.rowGap),w:l.tabW-4,h:l.tabH};
}
function shopConfirmLayout(item){
  const isBulk=isConsumableItem(item);
  const dlgW=Math.min(isBulk?286:270,W-24),dlgH=isBulk?304:260;
  const dlgX=W/2-dlgW/2,dlgY=H/2-dlgH/2;
  const btnW=100,btnH=36;
  const layout={
    dlgW,dlgH,dlgX,dlgY,
    buyBtn:{x:W/2-btnW-6,y:dlgY+dlgH-52,w:btnW,h:btnH},
    cancelBtn:{x:W/2+6,y:dlgY+dlgH-52,w:btnW,h:btnH},
  };
  if(isBulk){
    const ctrlY=dlgY+132;
    layout.minusBtn={x:dlgX+24,y:ctrlY,w:56,h:32};
    layout.qtyBox={x:W/2-40,y:ctrlY-1,w:80,h:34};
    layout.plusBtn={x:dlgX+dlgW-24-56,y:ctrlY,w:56,h:32};
    layout.plusTenBtn={x:W/2-82,y:ctrlY+42,w:76,h:30};
    layout.maxBtn={x:W/2+6,y:ctrlY+42,w:76,h:30};
    layout.qtyCenterX=W/2;
    layout.qtyY=ctrlY+22;
    layout.priceY=ctrlY+92;
    layout.balanceY=ctrlY+112;
  }
  return layout;
}
function titleModeLayout(){
  const endlessW=Math.min(250,W-36),endlessH=46;
  const lowerGap=12,lowerW=Math.min(150,(W-36-lowerGap)/2),lowerH=38;
  const topY=H*0.79;
  const lowerY=topY+endlessH+8;
  const lowerX=W/2-(lowerW*2+lowerGap)/2;
  return{
    endless:{x:W/2-endlessW/2,y:topY,w:endlessW,h:endlessH},
    challenge:{x:lowerX,y:lowerY,w:lowerW,h:lowerH},
    stage:{x:lowerX+lowerW+lowerGap,y:lowerY,w:lowerW,h:lowerH},
  };
}
let petState={x:0,y:0,vx:0,vy:0,mode:'idle',t:0,phase:0,ready:false};
let petPuffPhaseT=0;      // puff invis cycle timer (0-299)
let petPuffInvis=false;   // true while puff is in transparent phase
let petDroneAssist=false; // true while drone is actively reducing gravity
let petDroneCharges=3;    // uses remaining before drone breaks
let petDroneBroken=false; // true once charges exhausted (drone gone for session)
let _prevDroneAssist=false; // tracks previous frame assist state for edge detection
function resetPetState(){petState={x:0,y:0,vx:0,vy:0,mode:'idle',t:0,phase:0,ready:false};petPuffPhaseT=0;petPuffInvis=false;petDroneAssist=false;petDroneCharges=3;petDroneBroken=false;_prevDroneAssist=false;}
function triggerPetReaction(mode,duration){
  if(!getEquippedPetData())return;
  petState.mode=mode||'idle';
  petState.t=Math.max(0,duration|0);
  petState.phase=0;
}
function updatePetCompanion(){
  const pet=getEquippedPetData();
  if(!pet||!player){petState.ready=false;return;}
  if(state!==ST.PLAY&&state!==ST.COUNTDOWN&&state!==ST.DEAD&&state!==ST.PAUSE){petState.ready=false;return;}
  if(petDroneBroken&&pet.type==='drone'){petState.ready=false;return;}
  const pr=Math.max(10,playerRadius());
  const petType=pet.type||'comet';
  petState.phase+=0.12;
  if(petState.t>0)petState.t--;
  if(petState.t<=0&&petState.mode!=='idle')petState.mode='idle';
  const gd=player.gDir===-1?-1:1;
  let ox=-pr*1.9-12;
  let oy=gd===1?-pr*0.18:pr*0.18;
  let sway=0;
  let hover=0;
  let followAccel=0.12;
  let followDamp=0.76;
  if(petType==='puff'){
    hover=Math.sin(frame*0.06+petState.phase*0.4)*7;
    oy+=gd===1?-pr*0.12:pr*0.12;
    followAccel=0.1;
    followDamp=0.8;
  } else if(petType==='drone'){
    sway=Math.sin(frame*0.1+petState.phase*0.9)*11;
    hover=Math.sin(frame*0.04+petState.phase*0.25)*2;
    oy+=gd===1?-pr*0.06:pr*0.06;
    followAccel=0.14;
    followDamp=0.72;
  }
  if(state===ST.COUNTDOWN||petState.mode==='countdown'){
    ox=petType==='drone'?-pr*1.55:-pr*1.35;
    oy=-gd*pr*1.05;
    if(petType==='puff'){
      hover=-Math.abs(Math.sin(frame*0.12))*12;
    } else if(petType==='drone'){
      sway=Math.sin(frame*0.2)*14;
      hover=Math.cos(frame*0.08)*3;
    } else {
      hover=-Math.abs(Math.sin(frame*0.14))*8;
    }
  } else if(petState.mode==='hurt'){
    ox=-pr*2.4-10;
    if(petType==='puff'){
      hover=Math.sin(frame*0.18)*10;
    } else if(petType==='drone'){
      sway=Math.sin(frame*0.28)*12;
      hover=Math.cos(frame*0.16)*4;
    } else {
      hover=Math.cos(frame*0.22)*7;
    }
  } else if(petState.mode==='special'){
    if(petType==='puff'){
      ox=-pr*0.8;
      oy=-gd*(pr*1.05);
      hover=Math.sin(frame*0.12)*12;
    } else if(petType==='drone'){
      ox=-pr*0.9;
      oy=-gd*(pr*0.85);
      sway=Math.sin(frame*0.22)*16;
      hover=Math.cos(frame*0.08)*3;
    } else {
      ox=-pr*0.9;
      oy=-gd*(pr*0.95);
      hover=Math.cos(frame*0.14)*4;
    }
  } else if(petState.mode==='gameover'){
    ox=-pr*0.9;
    oy=-gd*(pr*1.2);
    if(petType==='puff'){
      hover=Math.sin(frame*0.08)*8;
    } else if(petType==='drone'){
      sway=Math.sin(frame*0.12)*10;
    } else {
      hover=Math.sin(frame*0.06)*3;
    }
  } else if(petState.mode==='magnet'){
    ox=-pr*1.25;
    if(petType==='puff'){
      hover=Math.sin(frame*0.1)*9;
    } else if(petType==='drone'){
      sway=Math.sin(frame*0.2)*13;
      hover=Math.cos(frame*0.06)*2;
    } else {
      hover=Math.sin(frame*0.12)*4;
    }
  } else if(petState.mode==='bomb'){
    ox=-pr*2.35;
    if(petType==='puff'){
      hover=Math.sin(frame*0.16)*7;
    } else if(petType==='drone'){
      sway=Math.sin(frame*0.22)*15;
      hover=Math.cos(frame*0.12)*3;
    } else {
      hover=Math.cos(frame*0.16)*4;
    }
  } else if(petState.mode==='comet_spark'){
    // Comet orbits player briefly when pulling coins
    const orbitT=petState.t/15;
    const orbitAngle=orbitT*Math.PI*2-Math.PI*0.25;
    ox=(Math.cos(orbitAngle)*pr*2.1)-pr*1.9-12;
    oy=Math.sin(orbitAngle)*pr*1.2+(gd===1?-pr*0.18:pr*0.18);
    hover=0;
  } else if(petState.mode==='puff_touch'){
    // Puff touches player briefly when invis activates
    const prog=petState.t/18;
    ox=(-pr*1.9-12)*(1-prog*0.7); // move closer
    oy=(gd===1?-pr*0.18:pr*0.18)+(gd===1?-pr*0.25:pr*0.25)*(1-prog);
    hover=Math.sin(Math.PI*(1-prog))*6;
  } else if(petState.mode==='drone_lift'){
    // Drone moves above player and strains upward to lift
    ox=-pr*0.05+Math.sin(frame*0.3)*3;
    oy=gd*(-pr*1.6-8); // directly above player (against gravity)
    hover=-Math.abs(Math.sin(frame*0.35))*4; // strain upward
    sway=Math.sin(frame*0.28)*8; // wobble from effort
  } else if(petState.mode==='drone_broken'){
    // Drone spins and falls away as it breaks
    const bp=petState.t/80; // 1→0 as animation plays
    ox=(-pr*1.9-12)+(1-bp)*Math.sin(frame*0.8)*40;
    oy=(gd===1?-pr*0.18:pr*0.18)+(1-bp)*gd*(-pr*3);
    sway=Math.sin(frame*0.6)*18*(1-bp*0.3);
    hover=-(1-bp)*30*gd; // falls away
  }
  // Puff: periodic invisibility cycle (20% invis, 80% visible = 60 invis / 240 visible per 300 frame cycle)
  if(petType==='puff'&&state===ST.PLAY){
    petPuffPhaseT=(petPuffPhaseT+1)%300;
    const wasInvis=petPuffInvis;
    petPuffInvis=petPuffPhaseT<60;
    // Trigger puff nudge motion when invis activates or ends
    if(!wasInvis&&petPuffInvis)triggerPetReaction('puff_touch',18);
  } else {petPuffInvis=false;}
  // Drone: detect new activation (false→true edge), consume charge
  if(petType==='drone'){
    if(petDroneAssist&&!_prevDroneAssist&&!petDroneBroken){
      petDroneCharges--;
      if(petDroneCharges<=0){
        petDroneCharges=0;
        triggerPetReaction('drone_broken',80);
        // After animation, mark as broken
        setTimeout(()=>{petDroneBroken=true;},80*(1000/60));
      } else if(petState.mode!=='drone_lift'){
        triggerPetReaction('drone_lift',35);
      }
    } else if(petDroneAssist&&!petDroneBroken&&petState.mode!=='drone_lift'&&petState.mode!=='drone_broken'){
      triggerPetReaction('drone_lift',35);
    }
    _prevDroneAssist=petDroneAssist;
  }
  const targetX=player.x+ox+sway;
  const targetY=player.y+oy+hover;
  if(!petState.ready){
    petState.x=targetX;petState.y=targetY;petState.vx=0;petState.vy=0;petState.ready=true;return;
  }
  petState.vx+=(targetX-petState.x)*followAccel;
  petState.vy+=(targetY-petState.y)*followAccel;
  petState.vx*=followDamp;petState.vy*=followDamp;
  petState.x+=petState.vx;
  petState.y+=petState.vy;
}
