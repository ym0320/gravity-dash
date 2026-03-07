'use strict';
// ===== TERRAIN (PLATFORM SYSTEM) =====
// Each platform: {x, w, h} where h is height from bottom (floor) or top (ceiling)
let platforms=[],ceilPlats=[];
// Flip zone: forces player to switch between floor and ceiling
let flipZone={active:false,type:0,len:0,cd:0,lastType:-1}; // type: 0=floor gap, 1=ceiling gap
// Abyss phase: score 6000+, temporarily spawns massive gaps
let abyssPhase={active:false,len:0,cd:0};
// Gravity rush phase: score 5000+, temporarily spawns many gravity zones
let gravRushPhase={active:false,len:0,cd:0};
// Terrain gimmick phase: score 8000+, temporarily spawns only falling floors or only moving floors
let terrainGimmickPhase={active:false,type:'',len:0,cd:0}; // type: 'falling' or 'moving'

function generatePlatform(arr,isCeil,forceGap){
  const last=arr.length>0?arr[arr.length-1]:null;
  const lastH=last?last.h:GROUND_H;
  const lastRight=last?last.x+last.w:0;
  // Boss phase or challenge mode: flat terrain (no gaps)
  if(bossPhase.active||bossPhase.prepare>0||isChallengeMode){
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
  // After 4000: more gaps; during abyssPhase: extreme gaps
  let gap=0;
  if(bossPhase.bossCount>=1&&score>100){
    let gc=Math.min(0.3,0.02+(score-100)*0.0015);
    let maxGap=Math.min(70,10+(score-100)*0.25);
    if(score>=4000){
      gc=Math.min(0.45,gc+0.08);
      maxGap=Math.min(100,maxGap+20);
    }
    if(abyssPhase.active){
      gc=0.7;maxGap=120;
    }
    if(Math.random()<gc){
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
let icicles=[]; // {x, y, w, h, vy, isFloor, state:'wait'|'fall'|'stuck'|'gone', timer}
let icicleCD=0;
let magmaFireballs=[]; // {x, y, vx, vy, originX, originY, isFloor, sz, phase, alive, returning}
// Deterministic terrain generation tracking (cumulative px generated, not affected by scrolling)
let packFloorGenX=0,packCeilGenX=0;

// ===== BOSS PHASE =====
// Boss appears periodically in endless mode
let bossPhase={active:false,prepare:0,alertT:0,enemies:[],defeated:0,total:0,reward:false,rewardT:0,nextAt:BOSS_INTERVAL,lastBossScore:0,lastBossRawDist:0,bossCount:0,bossType:'',bossType2:null,challStrength:1,challIsDual:false,noDamage:true};

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
    if(p.x>px)break; // platforms sorted by x: no point checking further
    if(px<=p.x+p.w) return H-p.h;
  }
  return H+200; // void (gap)
}
function ceilSurfaceY(px){
  for(let i=0;i<ceilPlats.length;i++){
    const p=ceilPlats[i];
    if(p.x>px)break;
    if(px<=p.x+p.w) return p.h;
  }
  return -200; // void
}

function reset(){
  player.x=W*0.2;player.gDir=1;player.vy=0;
  player.rot=0;player.rotTarget=0;_trailHead=0;_trailLen=0;player.faceTimer=0;player.alive=true;
  player.grounded=false;player.face='normal';player.canFlip=true;
  player._quakeStunned=false;player._quakeStunT=0;player._swordHitThisSwing=false;
  platforms=[];ceilPlats=[];
  // Initial safe start platform (shorter so difficulty kicks in sooner)
  platforms.push({x:-20,w:W*0.9,h:GROUND_H});
  ceilPlats.push({x:-20,w:W*0.9,h:GROUND_H});
  // Generate a few platforms ahead
  for(let i=0;i<5;i++){generatePlatform(platforms,false);generatePlatform(ceilPlats,true);}
  player.y=floorSurfaceY(player.x)-PLAYER_R;
  coins=[];items=[];parts=[];pops=[];enemies=[];bullets=[];floatPlats=[];floatCD=0;
  spikes=[];spikeCD=0;movingHills=[];hillCD=0;gravZones=[];gravZoneCD=0;gravZoneChain=0;
  fallingMtns=[];fallingMtnCD=0;coinSwitches=[];coinSwitchCD=0;
  icicles=[];icicleCD=0;magmaFireballs=[];magmaFireCD=0;magmaHurtT=0;
  score=0;dist=0;rawDist=0;speedOffset=0;speed=SPEED_INIT;frame=0;deadT=0;newHi=false;bgmTierOffset=0;
  combo=0;comboT=0;comboDsp=0;comboDspT=0;airCombo=0;stompCombo=0;
  shakeX=0;shakeY=0;shakeI=0;
  mileT=0;mileTxt='';lastMile=0;
  totalCoins=0;totalFlips=0;maxCombo=0;
  itemEff={invincible:0,magnet:0};bombCount=0;bombFlashT=0;invCount=0;
  djumpAvailable=!!ct().hasDjump;djumpUsed=false;ghostPhaseT=0;ghostInvis=false;
  coinCD=0;itemCD=0;enemyCD=0;birdCD=0;flipCount=0;flipTimer=999;lastCoinCourse='';
  flipZone={active:false,type:0,len:0,cd:0,lastType:-1};
  abyssPhase={active:false,len:0,cd:0};
  gravRushPhase={active:false,len:0,cd:0};
  terrainGimmickPhase={active:false,type:'',len:0,cd:0};
  bossPhase={active:false,prepare:0,alertT:0,enemies:[],defeated:0,total:0,reward:false,rewardT:0,nextAt:BOSS_INTERVAL,lastBossScore:0,lastBossRawDist:0,bossCount:0,bossType:'',bossType2:null,challStrength:1,challIsDual:false,noDamage:true};
  hp=HP_MAX+(ct().hpBonus||0);hurtT=0;
  curTheme=0;prevTheme=0;themeLerp=1;
  bossChests=0;runChests=0;deadChestsOpened=0;chestFall={active:false,x:0,y:0,vy:0,sparkT:0,gotT:0};chestOpen={phase:'none',t:0,charIdx:-1,parts:[],reward:null};
  usedContinue=false;
}

function resetPackStage(pi,si,fromCheckpoint){
  const pack=STAGE_PACKS[pi];if(!pack)return;
  const stage=pack.stages[si];if(!stage)return;
  isPackMode=true;currentPackIdx=pi;currentPackStageIdx=si;currentPackStage=stage;
  const cpStart=!!fromCheckpoint;
  // When starting from checkpoint, use offset seed so terrain is fresh but deterministic
  const seedOff=cpStart?5000:0;
  stageRng=mulberry32(stage.seed+seedOff);stageCeilRng=mulberry32(stage.seed+111+seedOff);stageSpawnRng=mulberry32(stage.seed+555+seedOff);gotNewStars=0;
  player.x=W*0.2;player.gDir=1;player.vy=0;
  player.rot=0;player.rotTarget=0;_trailHead=0;_trailLen=0;player.faceTimer=0;player.alive=true;
  player.grounded=false;player.face='normal';player.canFlip=true;
  player._quakeStunned=false;player._quakeStunT=0;player._swordHitThisSwing=false;
  // Generate deterministic terrain from seed (separate RNGs for floor/ceiling)
  platforms=[];ceilPlats=[];
  platforms.push({x:-20,w:W*0.9,h:GROUND_H});
  if(!stage.noCeiling) ceilPlats.push({x:-20,w:W*0.9,h:GROUND_H});
  // Initialize deterministic generation distance trackers
  packFloorGenX=W*0.9-20; // initial platform right edge
  packCeilGenX=W*0.9-20;
  for(let i=0;i<5;i++){generatePackPlatform(platforms,false,stage);if(!stage.noCeiling)generatePackPlatform(ceilPlats,true,stage);}
  player.y=floorSurfaceY(player.x)-PLAYER_R;
  coins=[];items=[];parts=[];pops=[];enemies=[];bullets=[];floatPlats=[];floatCD=0;
  spikes=[];spikeCD=0;movingHills=[];hillCD=0;gravZones=[];gravZoneCD=0;gravZoneChain=0;
  fallingMtns=[];fallingMtnCD=0;coinSwitches=[];coinSwitchCD=0;
  icicles=[];icicleCD=0;magmaFireballs=[];magmaFireCD=0;magmaHurtT=0;
  // Checkpoint state
  checkpointReached=cpStart; // already passed checkpoint if starting from it
  checkpointFlag={x:0,collected:cpStart};
  useCheckpoint=cpStart;
  // Starting distance: 0 or midpoint
  const startDist=cpStart?stage.dist*0.5:0;
  // Place 3 stars (big coins) using stage-specific positions or defaults
  const starRng=mulberry32(stage.seed+777);
  stageBigCoins=[];
  const coinDefs=stage.coins||[{pos:0.25,yOff:-50},{pos:0.5,yOff:-50},{pos:0.8,yOff:-50}];
  const prevStarCount=getPackStageStars(stage.id); // stars already collected in previous runs
  for(let si2=0;si2<coinDefs.length;si2++){
    const cd=coinDefs[si2];
    const starDist=stage.dist*cd.pos;
    // Skip stars already collected in previous runs
    if(si2<prevStarCount){
      stageBigCoins.push({x:-999,y:-999,yOff:0,sz:16,col:true,p:0,distMark:starDist});
      continue;
    }
    // Skip stars before checkpoint start point
    if(cpStart&&starDist<startDist){
      stageBigCoins.push({x:-999,y:-999,yOff:0,sz:16,col:true,p:0,distMark:starDist});
      continue;
    }
    const starX=W*0.2 + (starDist-startDist) / (SPEED_INIT * stage.spdMul * 0.08) * (SPEED_INIT * stage.spdMul);
    const yOff=cd.yOff||-50;
    stageBigCoins.push({x:starX,y:0,yOff:yOff,sz:16,col:false,p:0,distMark:starDist});
  }
  stageBigCollected=stageBigCoins.filter(bc=>bc.col).length;stageClearT=0;
  ambientParts=[];
  score=0;dist=startDist;rawDist=startDist;speedOffset=0;speed=SPEED_INIT*stage.spdMul;frame=0;deadT=0;newHi=false;
  combo=0;comboT=0;comboDsp=0;comboDspT=0;airCombo=0;stompCombo=0;
  shakeX=0;shakeY=0;shakeI=0;
  mileT=0;mileTxt='';lastMile=0;
  totalCoins=0;totalFlips=0;maxCombo=0;
  itemEff={invincible:0,magnet:0};bombCount=0;bombFlashT=0;invCount=0;
  djumpAvailable=!!ct().hasDjump;djumpUsed=false;ghostPhaseT=0;ghostInvis=false;
  coinCD=0;itemCD=0;enemyCD=0;birdCD=0;flipCount=0;flipTimer=999;lastCoinCourse='';
  flipZone={active:false,type:0,len:0,cd:0,lastType:-1};
  abyssPhase={active:false,len:0,cd:0};
  gravRushPhase={active:false,len:0,cd:0};
  terrainGimmickPhase={active:false,type:'',len:0,cd:0};
  bossPhase={active:false,prepare:0,alertT:0,enemies:[],defeated:0,total:0,reward:false,rewardT:0,nextAt:99999,lastBossScore:0,lastBossRawDist:0,bossCount:0,bossType:'',bossType2:null,challStrength:1,challIsDual:false};
  hp=1;hurtT=0; // Stage mode: always 1 HP (one-hit death)
  curTheme=0;prevTheme=0;themeLerp=1;
  bossChests=0;chestFall={active:false,x:0,y:0,vy:0,sparkT:0,gotT:0};chestOpen={phase:'none',t:0,charIdx:-1,parts:[],reward:null};
}
function generatePackPlatform(arr,isCeil,stage){
  const last=arr.length>0?arr[arr.length-1]:null;
  const lastH=last?last.h:GROUND_H;
  const lastRight=last?last.x+last.w:0;
  const rng=isCeil?(stageCeilRng||stageRng):stageRng;if(!rng)return;
  const sType=stage.stageType||'';
  // Deterministic distance estimate based on cumulative generation (not runtime dist)
  const genX=isCeil?packCeilGenX:packFloorGenX;
  const approxDist=Math.max(0,(genX-W*0.5)*0.08);
  let addedGap=0,addedW=0;
  // Boss phase: flat terrain for fighting
  if(bossPhase.active||bossPhase.prepare>0){
    addedW=150+rng()*100;
    arr.push({x:lastRight,w:addedW,h:GROUND_H});
  }
  // Post-goal area: flat runway → solid wall (dead end)
  else if(approxDist>=stage.dist){
    const pastGoalDist=approxDist-stage.dist;
    if(stage.flatGoal){
      // flatGoal: normal floor all the way (no protruding wall)
      addedW=100+rng()*60;
      arr.push({x:lastRight,w:addedW,h:GROUND_H});
    } else if(pastGoalDist<80){
      addedW=60+rng()*40;
      arr.push({x:lastRight,w:addedW,h:GROUND_H});
    } else {
      addedW=300;
      const wallH=(stage.noCeiling&&!isCeil)?H*0.80:H*0.48;
      arr.push({x:lastRight,w:addedW,h:wallH});
    }
  }
  // --- VOID stage: walls protrude, floor-level only ---
  else if(sType==='void'){
    const progress=approxDist/stage.dist;
    if(approxDist<30){
      addedW=120+rng()*60;
      arr.push({x:lastRight,w:addedW,h:GROUND_H});
    } else if(progress>=0.88){
      // Goal area: one continuous platform (no gaps)
      const goalH=H*0.45;
      addedGap=0;
      addedW=150+rng()*100;
      arr.push({x:lastRight,w:addedW,h:goalH});
    } else {
      const wallChance=0.6+progress*0.2;
      if(rng()<wallChance){
        const wallH=H*0.28+rng()*H*0.15;
        addedW=60+rng()*80;
        addedGap=20+rng()*40;
        arr.push({x:lastRight+addedGap,w:addedW,h:wallH});
      } else {
        addedGap=30+rng()*60;
        addedW=40+rng()*50;
        arr.push({x:lastRight+addedGap,w:addedW,h:GROUND_H});
      }
    }
  }
  // --- GRAVITY stage: all abyss with moving hills only → normal ground goal ---
  else if(sType==='gravity'){
    if(approxDist<8){
      addedW=60+rng()*40; // minimal start platform
      arr.push({x:lastRight,w:addedW,h:GROUND_H});
    } else if(approxDist>=stage.dist*0.92){
      // Normal ground-level goal (not protruding wall)
      addedGap=0;addedW=60+rng()*40;
      arr.push({x:lastRight,w:addedW,h:GROUND_H});
    } else {
      addedGap=400+rng()*600;addedW=1;
      arr.push({x:lastRight+addedGap,w:1,h:0});
    }
  }
  // --- ALTERNATING CHASM stage: floor/ceiling alternate having platforms ---
  else if(sType==='altChasm'){
    const zoneLen=150;
    const buffer=30; // both sides solid within buffer of zone boundary
    // Use floor generation position as shared reference so both sides stay in sync
    const refDist=Math.max(0,(packFloorGenX-W*0.5)*0.08);
    const zone=Math.floor(refDist/zoneLen);
    const posInZone=refDist-zone*zoneLen;
    // Near zone boundary: force both sides solid to prevent simultaneous chasms
    const inBuffer=posInZone<buffer||(zoneLen-posInZone)<buffer;
    // Even zones: floor solid + ceiling gap. Odd zones: floor gap + ceiling solid.
    const floorSolid=zone%2===0;
    const mySolid=inBuffer?true:(isCeil?!floorSolid:floorSolid);
    if(approxDist<20){
      // Safe start: both sides solid
      addedW=120+rng()*60;
      arr.push({x:lastRight,w:addedW,h:GROUND_H});
    } else if(mySolid){
      // Solid zone: big hills + occasional small gaps + enemies
      let h=lastH;
      if(rng()<0.65){
        const dh=(rng()<0.5?1:-1)*(20+rng()*50);
        h=Math.max(65+safeBot,Math.min(H*0.38,h+dh));
      }
      if(rng()<0.12){addedGap=20+rng()*40;} // small gap
      addedW=50+rng()*50;
      arr.push({x:lastRight+addedGap,w:addedW,h:h});
    } else {
      // Long gap (complete chasm — no moving hills)
      addedGap=200+rng()*120;
      addedW=1;
      arr.push({x:lastRight+addedGap,w:1,h:0});
    }
    // Place gravity zone at zone transitions (floor side only to avoid duplicates)
    if(!isCeil&&zone>0){
      const prevRefDist=Math.max(0,((packFloorGenX-addedGap-addedW)-W*0.5)*0.08);
      const prevZone=Math.floor(prevRefDist/zoneLen);
      if(zone!==prevZone){
        // Transition: place gravity zone just before the gap starts
        // Odd zone = player on floor needs to go UP (dir:-1)
        // Even zone = player on ceiling needs to go DOWN (dir:1)
        const gdir=(zone%2===1)?-1:1;
        const gx=lastRight-30;
        gravZones.push({x:gx,w:60,triggered:false,fadeT:0,dir:gdir});
      }
    }
  }
  // --- CHASM stage: deep gaps, floor-level only ---
  else if(sType==='chasm'){
    const doGap=rng()<0.55;
    addedGap=doGap?(100+rng()*180):0;
    addedW=45+rng()*70;
    arr.push({x:lastRight+addedGap,w:addedW,h:GROUND_H});
  }
  // --- Default terrain generation ---
  else {
    const gc=stage.gapChance||0.12;
    if(rng()<gc){addedGap=20+rng()*80;}
    // Magma gap sync: force gap when opposite side has a gap at this position
    if(stage.magma){
      const checkArr=isCeil?platforms:ceilPlats;
      if(checkArr.length>0){
        const oppLastRight=checkArr[checkArr.length-1].x+checkArr[checkArr.length-1].w;
        if(oppLastRight>lastRight){
          const myX=lastRight;
          let inGap=true;
          for(let gi=0;gi<checkArr.length;gi++){
            const gp=checkArr[gi];
            if(myX>=gp.x&&myX<=gp.x+gp.w){inGap=false;break;}
          }
          if(inGap){
            let gapEnd=oppLastRight;
            for(let gi=0;gi<checkArr.length;gi++){
              if(checkArr[gi].x>myX){gapEnd=checkArr[gi].x;break;}
            }
            const needGap=gapEnd-myX+5;
            addedGap=Math.max(addedGap,Math.min(needGap,150));
          }
        }
      }
    }
    let h=lastH;
    const hc=stage.hillChance||0.08;
    if(rng()<hc){
      const dh=(rng()<0.5?1:-1)*(10+rng()*50);
      h=Math.max(65+safeBot,Math.min(H*0.42,h+dh));
    }
    const wBase=gc>=0.40?40:70;
    const wRange=gc>=0.40?80:140;
    addedW=wBase+rng()*wRange;
    arr.push({x:lastRight+addedGap,w:addedW,h:h});
  }
  // Update deterministic generation tracker
  if(isCeil) packCeilGenX+=addedGap+addedW;
  else packFloorGenX+=addedGap+addedW;
}
