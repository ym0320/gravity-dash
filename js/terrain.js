'use strict';
// ===== TERRAIN (PLATFORM SYSTEM) =====
// Each platform: {x, w, h} where h is height from bottom (floor) or top (ceiling)
let platforms=[],ceilPlats=[];
// Flip zone: forces player to switch between floor and ceiling
let flipZone={active:false,type:0,len:0,cd:0,lastType:-1}; // type: 0=floor gap, 1=ceiling gap

function generatePlatform(arr,isCeil,forceGap){
  const last=arr.length>0?arr[arr.length-1]:null;
  const lastH=last?last.h:GROUND_H;
  const lastRight=last?last.x+last.w:0;
  // Boss phase: flat terrain
  if(bossPhase.active||bossPhase.prepare>0){
    arr.push({x:lastRight,w:150+Math.random()*100,h:GROUND_H});
    return;
  }
  // Forced gap for flip zones: create a large gap to force gravity flip
  if(forceGap){
    const gapSize=120+Math.random()*80;
    arr.push({x:lastRight+gapSize,w:60+Math.random()*40,h:lastH});
    return;
  }
  // Gap (valleys): NONE until first boss defeated (bossCount>=1), then gradually increase
  let gap=0;
  if(bossPhase.bossCount>=1&&score>100){
    const gc=Math.min(0.3,0.02+(score-100)*0.0015);
    if(Math.random()<gc){
      const maxGap=Math.min(70,10+(score-100)*0.25);
      gap=15+Math.random()*maxGap;
    }
  }
  // Height change (step): very gradual, flat-focused early game
  let h=lastH;
  if(score<40){
    // Long flat section with very occasional tiny steps
    const stepC=Math.min(0.1,0.005+score*0.002);
    if(Math.random()<stepC){
      const maxDh=Math.min(8,2+score*0.15);
      const dh=(Math.random()<0.5?1:-1)*(2+Math.random()*maxDh);
      h=Math.max(65+safeBot,Math.min(H*0.3,h+dh));
    }
  } else if(score<100){
    // Gentle steps
    const stepC=Math.min(0.2,0.04+(score-40)*0.002);
    if(Math.random()<stepC){
      const maxDh=Math.min(18,5+(score-40)*0.2);
      const dh=(Math.random()<0.5?1:-1)*(3+Math.random()*maxDh);
      h=Math.max(65+safeBot,Math.min(H*0.33,h+dh));
    }
  } else if(score<200){
    // Moderate steps
    const stepC=Math.min(0.3,0.08+(score-100)*0.002);
    if(Math.random()<stepC){
      const maxDh=Math.min(30,8+(score-100)*0.15);
      const dh=(Math.random()<0.5?1:-1)*(4+Math.random()*maxDh);
      h=Math.max(65+safeBot,Math.min(H*0.35,h+dh));
    }
  } else {
    // Full difficulty
    const stepC=Math.min(0.4,0.12+(score-200)*0.002);
    if(Math.random()<stepC){
      const maxDh=Math.min(45,12+score*0.1);
      const dh=(Math.random()<0.5?1:-1)*(5+Math.random()*maxDh);
      h=Math.max(65+safeBot,Math.min(H*0.38,h+dh));
    }
  }
  // Width: wider early, very gradually narrower
  let w;
  if(score<25)w=220+Math.random()*280;
  else if(score<60)w=180+Math.random()*200;
  else if(score<120)w=130+Math.random()*160;
  else if(score<200)w=90+Math.random()*110;
  else w=55+Math.random()*75;
  arr.push({x:lastRight+gap,w:w,h:h});
}

let coins=[],items=[],parts=[],stars=[],mtns=[],enemies=[],bullets=[];
// Floating mid-air platforms (between floor and ceiling)
let floatPlats=[]; // {x, y, w, th} - y=top surface, th=thickness
let floatCD=0;
// Stage gimmicks
let spikes=[]; // {x, w, h, phase, timer, state} - ground spikes that emerge/retract
let spikeCD=0;
let movingHills=[]; // {x, w, baseH, ampH, phase, spd} - terrain that oscillates vertically
let hillCD=0;
let gravZones=[]; // {x, w, triggered} - forced gravity reversal zones (waterfall aura)
let gravZoneCD=0;

// ===== BOSS PHASE =====
// Boss appears periodically in endless mode
let bossPhase={active:false,prepare:0,alertT:0,enemies:[],defeated:0,total:0,reward:false,rewardT:0,nextAt:800,lastBossScore:0,bossCount:0};

function initBG(){
  stars=[];
  for(let i=0;i<80;i++) stars.push({x:Math.random()*2000,y:Math.random()*H,sz:Math.random()*2+0.3,sp:Math.random()*0.4+0.1,a:Math.random()*0.5+0.2,tw:Math.random()*6.28,ts:Math.random()*0.04+0.02});
  mtns=[];
  for(let l=0;l<3;l++){
    const pts=[];
    for(let i=0;i<=14;i++) pts.push({x:(i/14)*(W+500),h:25+Math.random()*(35+l*18)});
    mtns.push({pts,sp:0.25+l*0.25,a:0.04+l*0.025,off:0});
  }
}
initBG();
// Initial demo platforms for title screen
platforms=[{x:-20,w:W+40,h:GROUND_H}];
ceilPlats=[{x:-20,w:W+40,h:GROUND_H}];

function floorSurfaceY(px){
  for(let i=0;i<platforms.length;i++){
    const p=platforms[i];
    if(px>=p.x&&px<=p.x+p.w) return H-p.h;
  }
  return H+200; // void (gap)
}
function ceilSurfaceY(px){
  for(let i=0;i<ceilPlats.length;i++){
    const p=ceilPlats[i];
    if(px>=p.x&&px<=p.x+p.w) return p.h;
  }
  return -200; // void
}

function reset(){
  player.x=W*0.2;player.gDir=1;player.vy=0;
  player.rot=0;player.rotTarget=0;player.trail=[];player.alive=true;
  player.grounded=false;player.face='normal';player.canFlip=true;
  platforms=[];ceilPlats=[];
  // Initial safe start platform (shorter so difficulty kicks in sooner)
  platforms.push({x:-20,w:W*0.9,h:GROUND_H});
  ceilPlats.push({x:-20,w:W*0.9,h:GROUND_H});
  // Generate a few platforms ahead
  for(let i=0;i<5;i++){generatePlatform(platforms,false);generatePlatform(ceilPlats,true);}
  player.y=floorSurfaceY(player.x)-PLAYER_R;
  coins=[];items=[];parts=[];pops=[];enemies=[];bullets=[];floatPlats=[];floatCD=0;
  spikes=[];spikeCD=0;movingHills=[];hillCD=0;gravZones=[];gravZoneCD=0;
  score=0;dist=0;speedOffset=0;speed=SPEED_INIT;frame=0;deadT=0;newHi=false;
  combo=0;comboT=0;comboDsp=0;comboDspT=0;airCombo=0;
  shakeX=0;shakeY=0;shakeI=0;
  mileT=0;mileTxt='';lastMile=0;
  totalCoins=0;totalFlips=0;maxCombo=0;
  itemEff={invincible:0,magnet:0};bombCount=0;bombFlashT=0;
  djumpAvailable=!!ct().hasDjump;djumpUsed=false;ghostPhaseT=0;ghostInvis=false;
  coinCD=0;itemCD=0;enemyCD=0;flipCount=0;flipTimer=999;lastCoinCourse='';
  flipZone={active:false,type:0,len:0,cd:0,lastType:-1};
  bossPhase={active:false,prepare:0,alertT:0,enemies:[],defeated:0,total:0,reward:false,rewardT:0,nextAt:800,lastBossScore:0,bossCount:0};
  hp=HP_MAX+(ct().hpBonus||0);hurtT=0;
  curTheme=0;prevTheme=0;themeLerp=1;
}

function resetPackStage(pi,si){
  const pack=STAGE_PACKS[pi];if(!pack)return;
  const stage=pack.stages[si];if(!stage)return;
  isPackMode=true;currentPackIdx=pi;currentPackStageIdx=si;currentPackStage=stage;
  stageRng=mulberry32(stage.seed);gotNewStars=0;
  player.x=W*0.2;player.gDir=1;player.vy=0;
  player.rot=0;player.rotTarget=0;player.trail=[];player.alive=true;
  player.grounded=false;player.face='normal';player.canFlip=true;
  // Generate deterministic terrain from seed
  platforms=[];ceilPlats=[];
  platforms.push({x:-20,w:W*0.9,h:GROUND_H});
  ceilPlats.push({x:-20,w:W*0.9,h:GROUND_H});
  for(let i=0;i<5;i++){generatePackPlatform(platforms,false,stage);generatePackPlatform(ceilPlats,true,stage);}
  player.y=floorSurfaceY(player.x)-PLAYER_R;
  coins=[];items=[];parts=[];pops=[];enemies=[];bullets=[];floatPlats=[];floatCD=0;
  spikes=[];spikeCD=0;movingHills=[];hillCD=0;gravZones=[];gravZoneCD=0;
  // Place 3 stars at 25%, 50%, 80% of stage distance
  const starRng=mulberry32(stage.seed+777);
  stageBigCoins=[];
  const starPositions=[0.25,0.5,0.8];
  for(let si2=0;si2<3;si2++){
    const starDist=stage.dist*starPositions[si2];
    // Convert distance to approximate x position (speed * frames * 0.08 = dist)
    // x offset from player start = starDist / 0.08 * speed_approx_frames... simplified: use dist directly as scroll units
    const starX=W*0.2 + starDist / (SPEED_INIT * stage.spdMul * 0.08) * (SPEED_INIT * stage.spdMul);
    const yOff=-40-starRng()*40; // 40-80px above floor
    stageBigCoins.push({x:starX,y:0,yOff:yOff,sz:16,col:false,p:0,distMark:starDist});
  }
  stageBigCollected=0;stageClearT=0;
  ambientParts=[];
  score=0;dist=0;speedOffset=0;speed=SPEED_INIT*stage.spdMul;frame=0;deadT=0;newHi=false;
  combo=0;comboT=0;comboDsp=0;comboDspT=0;airCombo=0;
  shakeX=0;shakeY=0;shakeI=0;
  mileT=0;mileTxt='';lastMile=0;
  totalCoins=0;totalFlips=0;maxCombo=0;
  itemEff={invincible:0,magnet:0};bombCount=0;bombFlashT=0;
  djumpAvailable=!!ct().hasDjump;djumpUsed=false;ghostPhaseT=0;ghostInvis=false;
  coinCD=0;itemCD=0;enemyCD=0;flipCount=0;flipTimer=999;lastCoinCourse='';
  flipZone={active:false,type:0,len:0,cd:0,lastType:-1};
  bossPhase={active:false,prepare:0,alertT:0,enemies:[],defeated:0,total:0,reward:false,rewardT:0,nextAt:99999,lastBossScore:0,bossCount:0};
  hp=HP_MAX+(ct().hpBonus||0);hurtT=0;
  curTheme=0;prevTheme=0;themeLerp=1;
}
function generatePackPlatform(arr,isCeil,stage){
  const last=arr.length>0?arr[arr.length-1]:null;
  const lastH=last?last.h:GROUND_H;
  const lastRight=last?last.x+last.w:0;
  const rng=stageRng;if(!rng)return;
  let gap=0;
  const gc=stage.gapChance||0.12;
  if(rng()<gc){gap=10+rng()*40;}
  let h=lastH;
  const hc=stage.hillChance||0.08;
  if(rng()<hc){
    const dh=(rng()<0.5?1:-1)*(3+rng()*20);
    h=Math.max(65+safeBot,Math.min(H*0.32,h+dh));
  }
  const w=100+rng()*180;
  arr.push({x:lastRight+gap,w:w,h:h});
}
