'use strict';
// ===== SPAWNING (cooldown-based for reliable continuous generation) =====
let coinCD=0,itemCD=0,enemyCD=0,birdCD=0;

function findSpawnPlat(){
  // Find a platform that is ahead of screen (right side)
  let _fsp=null;
  for(let _i=0;_i<platforms.length;_i++){const p=platforms[_i];if(p.x>W*0.55&&p.x+p.w<W+250){_fsp=p;break;}}
  if(_fsp)return _fsp;
  for(let _i=0;_i<platforms.length;_i++){const p=platforms[_i];if(p.x+p.w>W*0.6&&p.x<W+200){_fsp=p;break;}}
  return _fsp;
}
function findEdgeSpawnPlat(){
  // Find a platform that extends past or starts at the right screen edge
  let _fesp=null;
  for(let _i=0;_i<platforms.length;_i++){const p=platforms[_i];if(p.x<W+40&&p.x+p.w>W){_fesp=p;break;}}
  if(_fesp)return _fesp;
  for(let _i=0;_i<platforms.length;_i++){const p=platforms[_i];if(p.x>=W&&p.x<W+100){_fesp=p;break;}}
  return _fesp;
}
function findEdgeMovingHill(){
  // Find a moving hill or falling floor near the right screen edge for enemy spawning
  let mh=null;
  for(let _i=0;_i<movingHills.length;_i++){const m=movingHills[_i];if(m.isFloor&&m.x<W+40&&m.x+m.w>W-30){mh=m;break;}}
  if(mh){const curH=mh.baseH+Math.sin(mh.phase)*mh.ampH;return{x:mh.x,w:mh.w,h:curH,isMH:true};}
  let fm=null;
  for(let _i=0;_i<fallingMtns.length;_i++){const f=fallingMtns[_i];if(f.isFloor&&f.state==='idle'&&f.x<W+40&&f.x+f.w>W-30){fm=f;break;}}
  if(fm)return{x:fm.x,w:fm.w,h:fm.curH,isFM:true};
  return null;
}
let lastCoinCourse=''; // track last coin placement: 'floor' or 'ceil'
function coinOverlaps(cx,cy){
  // Check if a proposed coin position overlaps with any existing coin (min 30px apart)
  for(let i=0;i<coins.length;i++){
    const c=coins[i];
    if(!c.col){
      const dx=cx-c.x,dy=cy-c.y;
      if(dx*dx+dy*dy<30*30)return true;
    }
  }
  return false;
}
function trySpawnCoins(){
  if(coinCD>0){coinCD--;return;}
  if(isPackMode)return; // no coins in stage mode
  if(isChallengeMode)return; // no coins in challenge mode
  if(bossPhase.active)return;
  const plat=findEdgeSpawnPlat();
  if(!plat)return;
  if(packRng()<0.18){ // reduced frequency (was 0.30)
    coinCD=50+Math.floor(packRng()*30); // longer cooldown (was 28+20)
    // Alternate between floor and ceiling to prevent overlap
    let onFloor;
    if(lastCoinCourse==='floor') {onFloor=false;lastCoinCourse='ceil';}
    else if(lastCoinCourse==='ceil') {onFloor=true;lastCoinCourse='floor';}
    else {onFloor=player.gDir===1||packRng()<0.5;lastCoinCourse=onFloor?'floor':'ceil';}
    let surfY;
    if(onFloor){surfY=H-plat.h;}else{let _cp=null;for(let _i=0;_i<ceilPlats.length;_i++){const p=ceilPlats[_i];if(plat.x+plat.w*0.3>=p.x&&plat.x+plat.w*0.3<=p.x+p.w){_cp=p;break;}}surfY=_cp?_cp.h:GROUND_H;}
    const pattern=packRng();
    const n=3+Math.floor(packRng()*2); // 3-4 coins per group (was 3-5)
    const startX=Math.max(W+9,plat.x); // spawn at right screen edge

    if(pattern<0.5){
      // Straight horizontal line: exactly on running height (PLAYER_R above surface)
      const lineY=onFloor?surfY-PLAYER_R:surfY+PLAYER_R;
      for(let i=0;i<n;i++){
        const cx=startX+i*28; // wider spacing (was 24)
        if(!coinOverlaps(cx,lineY))coins.push({x:cx,y:lineY,sz:9,col:false,p:0});
      }
    } else {
      // Perfect parabolic arc: matches actual jump physics exactly
      const jp=JUMP_POWER*ct().jumpMul;
      const gv=GRAVITY*ct().gravMul;
      const peakT=jp/gv;
      const totalT=peakT*2;
      for(let i=0;i<n;i++){
        const frac=(i+1)/(n+1);
        const t=frac*totalT;
        const arcH=jp*t-0.5*gv*t*t;
        const hOffset=speed*t;
        const cx=startX+hOffset;
        const cy=onFloor?surfY-PLAYER_R-arcH:surfY+PLAYER_R+arcH;
        if(!coinOverlaps(cx,cy))coins.push({x:cx,y:cy,sz:9,col:false,p:0});
      }
    }
  } else {
    coinCD=20+Math.floor(packRng()*15); // longer no-spawn cooldown (was 12+8)
  }
}
function trySpawnItem(){
  if(itemCD>0){itemCD--;return;}
  if(isPackMode)return; // no items in stage mode
  if(isChallengeMode)return; // no items in challenge mode
  if(score<5)return;
  if(bossPhase.active)return;
  const plat=findEdgeSpawnPlat();
  if(!plat)return;
  if(packRng()<0.12){
    itemCD=140+Math.floor(packRng()*80);
    const ix=Math.max(W+14,plat.x); // spawn at right screen edge
    // 50% chance floor, 50% ceiling
    const onFloor=packRng()<0.5;
    let iy;
    if(onFloor){
      const surfY=H-plat.h;
      iy=surfY-55-packRng()*25;
    } else {
      let cp=null;for(let _i=0;_i<ceilPlats.length;_i++){const p=ceilPlats[_i];if(ix>=p.x&&ix<=p.x+p.w){cp=p;break;}}
      const ceilH=cp?cp.h:GROUND_H;
      iy=ceilH+55+packRng()*25;
    }
    // Pick random item: 0=invincible, 1=magnet, 2=bomb, 3=heart
    let it;
    if(hp<maxHp()&&packRng()<0.3){it=3;} // higher chance for heart when damaged
    else{const r=packRng();if(r<0.01){it=0;}else if(r<0.02){it=2;}else if(r<0.03){it=1;}else{itemCD=60+Math.floor(packRng()*30);return;}}
    items.push({x:ix,y:iy,t:it,sz:14,p:packRng()*6.28,col:false,onCeil:!onFloor});
  } else {
    itemCD=20+Math.floor(packRng()*15);
  }
}

// ===== ENEMIES =====
// Types: 0=左右パトロール, 1=砲台(水平砲弾), 2=空中飛行
function trySpawnEnemy(){
  if(enemyCD>0){enemyCD--;return;}
  if(!isPackMode&&score<30)return; // enemies appear later (endless only)
  if(bossPhase.active)return; // no normal enemies during boss
  // Try normal platform first, then moving hills / falling floors
  let plat=findEdgeSpawnPlat();
  let useMH=false;
  if(!plat){
    const mhPlat=findEdgeMovingHill();
    if(mhPlat){plat=mhPlat;useMH=true;}
  } else if(packRng()<0.3){
    // 30% chance to spawn on moving hill/falling floor even if regular platform exists
    const mhPlat=findEdgeMovingHill();
    if(mhPlat){plat=mhPlat;useMH=true;}
  }
  if(!plat)return;
  const chance=isPackMode?0.5:Math.min(0.3,0.04+(score-30)*0.002);
  if(packRng()<chance){
    enemyCD=isPackMode?(25+Math.floor(packRng()*25)):(55+Math.floor(packRng()*50));
    const ex=Math.max(useMH?plat.x+plat.w*0.3:W+13,plat.x);
    const sz=13;
    // Choose enemy type
    let eType=0;
    const tr=packRng();
    if(isPackMode&&currentPackStage){
      if(currentPackStage.walkerOnly){eType=0;}
      else {
      const stageIdx=currentPackStageIdx; // 0-4
      const progress=dist/currentPackStage.dist;
      const sType2=currentPackStage.stageType||'';
      if(sType2==='swarm'){
        // Swarm stage: walkers and cannons only, very dense
        eType=tr<0.55?0:1; // 55% walker, 45% cannon
      } else if(sType2==='void'){
        // Void stage: all enemy types, heavier late-stage enemies
        if(progress>0.6&&tr<0.25) eType=6; // dasher
        else if(progress>0.4&&tr<0.30) eType=2; // flying
        else if(tr<0.35) eType=1; // cannon
        else eType=0; // walker
      } else if(sType2==='chasm'){
        // Chasm stage: flying and cannon enemies suited for vertical play
        if(tr<0.35) eType=2; // flying
        else if(tr<0.60) eType=1; // cannon
        else eType=0; // walker
      } else {
        // Normal/moving stages: progressive enemy types
        // bombWeight override: force bomber (type 3) at given probability
        const bw=currentPackStage.bombWeight||0;
        if(bw>0&&tr<bw) eType=3;
        else if(stageIdx>=4&&progress>0.5&&tr<0.20) eType=8;
        else if(stageIdx>=3&&progress>0.4&&tr<0.22) eType=3;
        else if(stageIdx>=3&&tr<0.20) eType=6;
        else if(stageIdx>=2&&progress>0.3&&tr<0.18) eType=5;
        else if(stageIdx>=2&&tr<0.22) eType=4;
        else if(stageIdx>=1&&tr<0.28) eType=2;
        else if(stageIdx>=1&&tr<0.35) eType=1;
        else if(stageIdx>=0&&tr<0.40) eType=1;
        else eType=0;
      }
      } // end walkerOnly else
    } else {
      // Endless mode: score-based enemy types
      if(score>=600&&bossPhase.bossCount>=3&&tr<0.10) eType=3;
      else if(score>=400&&bossPhase.bossCount>=2&&tr<0.15) eType=8;
      else if(score>=250&&bossPhase.bossCount>=1&&tr<0.18) eType=6;
      else if(score>=160&&tr<0.12) eType=5;
      else if(score>=140&&tr<0.15) eType=4;
      else if(score>=120&&tr<0.22) eType=2;
      else if(score>=80&&tr<0.35) eType=1;
      else eType=0;
    }

    if(eType===4){
      // Vertical mover: bounces between floor and ceiling
      const onCeil4=packRng()<0.4;
      const gd4=onCeil4?-1:1;
      const surfY=gd4===1?H-plat.h:ceilSurfaceY(ex);
      const sz=14;
      enemies.push({x:ex,y:gd4===1?surfY-sz:surfY+sz,vy:gd4===1?(-2.5-packRng()*1.5):(2.5+packRng()*1.5),gDir:gd4,walkSpd:0,sz:sz,alive:true,fr:packRng()*100,type:4,shootT:999,
        moveDir:gd4===1?-1:1,moveSpd:2.5+packRng()*1.5,pauseT:0});
    } else if(eType===5){
      // Phantom: floats in air, periodically becomes invisible
      const onCeil5=packRng()<0.4;
      const gd5=onCeil5?-1:1;
      const surfY=gd5===1?H-plat.h:ceilSurfaceY(ex);
      const flyY=gd5===1?surfY-50-packRng()*60:surfY+50+packRng()*60;
      const sz=13;
      enemies.push({x:ex,y:flyY,vy:0,gDir:gd5,walkSpd:0,sz:sz,alive:true,fr:packRng()*100,type:5,shootT:999,
        baseY:flyY,flyPhase:packRng()*6.28,flyAmp:15+packRng()*15,
        visTimer:0,visCycle:90+Math.floor(packRng()*60),visible:true,fadeT:0});
    } else if(eType===2){
      // Flying enemy: spawns in the air between floor and ceiling
      const onCeil2=packRng()<0.4;
      const gd2=onCeil2?-1:1;
      const surfY=gd2===1?H-plat.h:ceilSurfaceY(ex);
      const flyY=gd2===1?surfY-60-packRng()*80:surfY+60+packRng()*80;
      enemies.push({x:ex,y:flyY,vy:0,gDir:gd2,walkSpd:0,sz:sz,alive:true,fr:packRng()*100,type:2,shootT:999,
        baseY:flyY,flyPhase:packRng()*6.28,flyAmp:20+packRng()*25});
    } else if(eType===3){
      // Bomber (Hammer Bros style): stationary, throws bombs in an arc
      const surfY=H-plat.h;
      enemies.push({x:ex,y:surfY-sz,vy:0,gDir:1,walkSpd:0.1,sz:sz+2,alive:true,fr:packRng()*100,type:3,
        shootT:130+Math.floor(packRng()*50),bombCD:130+Math.floor(packRng()*50),
        patrolDir:1,patrolOriginX:ex,patrolRange:15+packRng()*20});
    } else if(eType===6){
      // Dasher: walks slowly, then charges at player when close
      const onCeil6=packRng()<0.4;
      const gd6=onCeil6?-1:1;
      const surfY=gd6===1?H-plat.h:ceilSurfaceY(ex);
      const sz=14;
      enemies.push({x:ex,y:gd6===1?surfY-sz:surfY+sz,vy:0,gDir:gd6,walkSpd:0.3,sz:sz,alive:true,fr:packRng()*100,type:6,shootT:999,
        patrolDir:-1,patrolOriginX:ex,patrolRange:25+packRng()*20,
        dashState:'patrol',dashTimer:0,dashSpd:6+packRng()*3,dashDir:-1,warnT:0});
    } else if(eType===8){
      // Splitter: medium enemy that splits into 2 small ones when killed
      const onCeil8=packRng()<0.4;
      const gd8=onCeil8?-1:1;
      const surfY=gd8===1?H-plat.h:ceilSurfaceY(ex);
      const sz=16;
      enemies.push({x:ex,y:gd8===1?surfY-sz:surfY+sz,vy:0,gDir:gd8,walkSpd:0.2+packRng()*0.3,sz:sz,alive:true,fr:packRng()*100,type:8,shootT:999,
        patrolDir:1,patrolOriginX:ex,patrolRange:25+packRng()*35,
        splitDone:false});
    } else {
      const onCeil=packRng()<0.4;
      const gd=onCeil?-1:1;
      const surfY=gd===1?H-plat.h:ceilSurfaceY(ex);
      if(eType===0){
        // Walker with left-right patrol
        enemies.push({x:ex,y:gd===1?surfY-sz:surfY+sz,vy:0,gDir:gd,walkSpd:0.3+packRng()*0.4,sz:sz,alive:true,fr:packRng()*100,type:0,shootT:999,
          patrolDir:1,patrolOriginX:ex,patrolRange:30+packRng()*40});
      } else {
        // Cannon (shooter) - stationary
        enemies.push({x:ex,y:gd===1?surfY-sz:surfY+sz,vy:0,gDir:gd,walkSpd:0.15+packRng()*0.2,sz:sz,alive:true,fr:packRng()*100,type:1,shootT:60+Math.floor(packRng()*60)});
      }
    }
  } else {
    enemyCD=15+Math.floor(packRng()*10);
  }
}

// ===== FLOATING MID-AIR PLATFORMS =====
function trySpawnFloatPlat(){
  if(floatCD>0){floatCD--;return;}
  if(!isPackMode&&score<100)return; // appear after more progression (endless only)
  if(bossPhase.active)return;
  // Stage flag: disable floating platforms entirely
  if(isPackMode&&currentPackStage&&currentPackStage.noFloatPlat)return;
  const plat=findEdgeSpawnPlat();
  if(!plat)return;
  const isFloatStage=isPackMode&&currentPackStage&&(currentPackStage.stageType==='moving'||currentPackStage.stageType==='swarm'||currentPackStage.stageType==='chasm'||currentPackStage.stageType==='void');
  const chance=isPackMode?(isFloatStage?0.45:0.30):Math.min(0.18,0.04+(score-35)*0.002);
  if(packRng()<chance){
    floatCD=isPackMode?(isFloatStage?20+Math.floor(packRng()*20):40+Math.floor(packRng()*30)):(80+Math.floor(packRng()*60));
    const fx=Math.max(W+20,plat.x);
    const fw=50+packRng()*60; // width: 50-110px
    const floorY=H-plat.h;
    const ceilY=ceilSurfaceY(fx);
    const gap=floorY-ceilY;
    if(gap<120)return; // not enough room
    // Place at a height reachable by jumping from the floor
    // Max jump height ≈ JUMP_POWER^2 / (2*GRAVITY) ≈ 145px
    const maxJumpH=JUMP_POWER*JUMP_POWER/(2*GRAVITY)*0.75; // ~109px (comfortable reach)
    const fy=floorY-maxJumpH*(0.5+packRng()*0.5); // 50-100% of comfortable jump height
    floatPlats.push({x:fx,y:fy,w:fw,th:10});
    // Sometimes spawn an item or coins on the floating platform (not in stage mode, mutually exclusive)
    if(!isPackMode){
      const fpRoll=packRng();
      if(fpRoll<0.3){
        // Item on float plat
        const pool=[1,2]; // magnet or bomb
        if(hp<maxHp()&&packRng()<0.3) pool.push(3); // heart if damaged
        const it=pool[Math.floor(packRng()*pool.length)];
        items.push({x:fx+fw/2,y:fy-25,t:it,sz:14,p:packRng()*6.28,col:false});
      } else if(fpRoll<0.65){
        // Coins in a horizontal line above float plat
        for(let i=0;i<3;i++){
          coins.push({x:fx+10+i*(fw-20)/2,y:fy-20,sz:9,col:false,p:0});
        }
      }
    }
  } else {
    floatCD=20+Math.floor(packRng()*15);
  }
}

// ===== STAGE GIMMICKS =====
function trySpawnSpike(){
  if(spikeCD>0){spikeCD--;return;}
  if(isPackMode&&currentPackStage&&currentPackStage.noHazards)return;
  if(!isPackMode&&(bossPhase.bossCount<3||bossPhase.active))return; // endless: only after 3rd boss
  if(isPackMode&&bossPhase.active)return;
  const plat=findEdgeSpawnPlat();
  if(!plat)return;
  const isDense=isPackMode&&currentPackStage&&currentPackStage.denseSpikes;
  const chance=isDense?0.50:(isPackMode?0.20:Math.min(0.15,0.03+(score-80)*0.001));
  if(packRng()<chance){
    const sx=Math.max(W+10,plat.x+packRng()*plat.w*0.5);
    // Only place spikes where both floor AND ceiling terrain exist
    let ceilHere=null;for(let _i=0;_i<ceilPlats.length;_i++){const p=ceilPlats[_i];if(sx>=p.x&&sx<=p.x+p.w){ceilHere=p;break;}}
    if(!ceilHere){spikeCD=25+Math.floor(packRng()*15);return;}
    spikeCD=isDense?(20+Math.floor(packRng()*20)):(80+Math.floor(packRng()*60));
    // Randomly choose floor or ceiling spike
    const isFloor=packRng()<0.5;
    // Clamp spike width to not exceed platform edges
    const maxW=isFloor?(plat.x+plat.w-sx):(ceilHere.x+ceilHere.w-sx);
    const sw=Math.min(30+packRng()*30,Math.max(10,maxW));
    if(sw<10){spikeCD=25;return;} // platform too narrow
    // Overlap check: skip if this spike would overlap any existing spike on the same surface
    let spikeOverlap=false;for(let _i=0;_i<spikes.length;_i++){const s=spikes[_i];if(s.isFloor===isFloor&&sx<s.x+s.w+10&&sx+sw>s.x-10){spikeOverlap=true;break;}}
    if(spikeOverlap){spikeCD=15+Math.floor(packRng()*10);return;}
    if(isFloor){
      spikes.push({x:sx,w:sw,h:H-plat.h,spikeH:22,phase:0,timer:0,state:'hidden',
        cycle:120+Math.floor(packRng()*80),upTime:60+Math.floor(packRng()*30),
        isFloor:true});
    } else {
      spikes.push({x:sx,w:sw,h:ceilHere.h,spikeH:22,phase:0,timer:0,state:'hidden',
        cycle:120+Math.floor(packRng()*80),upTime:60+Math.floor(packRng()*30),
        isFloor:false});
    }
  } else {
    spikeCD=25+Math.floor(packRng()*15);
  }
}

// ===== FALLING FLOOR (over abysses, both floor and ceiling) =====
function trySpawnFallingMtn(){
  if(fallingMtnCD>0){fallingMtnCD--;return;}
  if(bossPhase.active)return;
  if(isPackMode&&currentPackStage&&currentPackStage.noHazards)return;
  if(isPackMode&&currentPackStage&&currentPackStage.stageType==='altChasm')return;
  if(!isPackMode&&bossPhase.bossCount<2)return; // endless: only after 2nd boss
  // During terrain gimmick phase (moving type), skip falling spawns
  if(terrainGimmickPhase.active&&terrainGimmickPhase.type==='moving')return;
  // Find a gap (abyss) in floor or ceiling platforms to place the falling floor over
  const isGimmickFalling=terrainGimmickPhase.active&&terrainGimmickPhase.type==='falling';
  let chance=isPackMode?0.15:(score>=6000?Math.min(0.12,0.04+(score-6000)*0.0002):Math.min(0.06,0.01+(score-4000)*0.0003));
  if(isGimmickFalling)chance=0.35; // high spawn rate during gimmick phase
  if(packRng()<chance){
    const isFloor=packRng()<0.5;
    const platArr=isFloor?platforms:ceilPlats;
    // Early-stage fix: allow spawning in the visible area if no falling mtn exists yet
    const isFallingStageType=isPackMode&&currentPackStage&&(currentPackStage.stageType==='moving'||currentPackStage.stageType==='normal');
    const earlyStage=(isFallingStageType||isGimmickFalling)&&fallingMtns.length===0&&rawDist<600;
    const gapMinX=earlyStage?(player.x+60):W;
    const gapMaxX=earlyStage?(W+400):(W+300);
    // Look for gaps between platforms in the upcoming area
    let gapX=-1,gapW=0;
    for(let i=0;i<platArr.length-1;i++){
      const p1=platArr[i],p2=platArr[i+1];
      const gStart=p1.x+p1.w;
      const gEnd=p2.x;
      const gap=gEnd-gStart;
      if(gap>=50&&gStart>gapMinX&&gStart<gapMaxX){
        gapX=gStart;gapW=gap;break;
      }
    }
    if(gapX<0){fallingMtnCD=30+Math.floor(packRng()*20);return;}
    // Check overlap: don't spawn where a movingHill or another fallingMtn already exists
    let hasHill=false;for(let _i=0;_i<movingHills.length;_i++){if(Math.abs(movingHills[_i].x-gapX)<gapW){hasHill=true;break;}}
    if(hasHill){fallingMtnCD=30+Math.floor(packRng()*15);return;}
    let hasFM=false;for(let _i=0;_i<fallingMtns.length;_i++){if(Math.abs(fallingMtns[_i].x-gapX)<gapW){hasFM=true;break;}}
    if(hasFM){fallingMtnCD=30+Math.floor(packRng()*15);return;}
    const isGimmickFalling2=terrainGimmickPhase.active&&terrainGimmickPhase.type==='falling';
    fallingMtnCD=isGimmickFalling2?(40+Math.floor(packRng()*30)):(180+Math.floor(packRng()*120));
    if(isGimmickFalling2){terrainGimmickPhase.len--;if(terrainGimmickPhase.len<=0){terrainGimmickPhase.active=false;terrainGimmickPhase.cd=800+Math.floor(packRng()*400);}}
    const fw=Math.min(gapW*0.85,140+packRng()*180); // wide: 140-320px (2-5x original)
    const fx=gapX+(gapW-fw)/2; // center in gap
    const fh=GROUND_H+10+packRng()*20;
    fallingMtns.push({x:fx,w:fw,baseH:fh,curH:fh,vy:0,state:'idle',shakeT:0,shakeAmt:0,triggerDist:80,isFloor:isFloor,alpha:1});
  } else {
    fallingMtnCD=30+Math.floor(packRng()*20);
  }
}

// ===== COIN SWITCH =====
function trySpawnCoinSwitch(){
  if(coinSwitchCD>0){coinSwitchCD--;return;}
  if(isChallengeMode)return;
  if(bossPhase.active)return;
  if(score<60)return;
  const plat=findEdgeSpawnPlat();
  if(!plat)return;
  if(packRng()<0.05){
    coinSwitchCD=250+Math.floor(packRng()*150);
    const sx=Math.max(W+10,plat.x+packRng()*plat.w*0.5);
    const isFloor=packRng()<0.7;
    let sy;
    if(isFloor){
      sy=H-plat.h-COIN_SW_R;
    } else {
      let cp=null;for(let _i=0;_i<ceilPlats.length;_i++){const p=ceilPlats[_i];if(sx>=p.x&&sx<=p.x+p.w){cp=p;break;}}
      const ch=cp?cp.h:GROUND_H;
      sy=ch+COIN_SW_R;
    }
    coinSwitches.push({x:sx,y:sy,r:COIN_SW_R,isFloor:isFloor,activated:false,flashT:0});
  } else {
    coinSwitchCD=40+Math.floor(packRng()*25);
  }
}

function trySpawnMovingHill(){
  if(hillCD>0){hillCD--;return;}
  if(!isPackMode&&(bossPhase.bossCount<2||bossPhase.active))return; // endless: only after 2nd boss
  if(isPackMode&&bossPhase.active)return;
  // Stage flag: disable moving hills entirely
  if(isPackMode&&currentPackStage&&currentPackStage.noMovingHill)return;
  // During terrain gimmick phase (falling type), skip moving hill spawns
  if(terrainGimmickPhase.active&&terrainGimmickPhase.type==='falling')return;
  const isGimmickMoving=terrainGimmickPhase.active&&terrainGimmickPhase.type==='moving';
  const isMovingStage=isPackMode&&currentPackStage&&(currentPackStage.stageType==='moving'||currentPackStage.stageType==='void'||currentPackStage.stageType==='gravity');
  const isGravityStage=isPackMode&&currentPackStage&&currentPackStage.stageType==='gravity';
  let chance=isPackMode?(isGravityStage?0.55:isMovingStage?0.40:0.18):Math.min(0.1,0.02+(score-120)*0.001);
  if(isGimmickMoving)chance=0.35;
  if(packRng()<chance){
    const isFloor=isGravityStage?true:(packRng()<0.5); // gravity stage: floor hills only
    const platArr=isFloor?platforms:ceilPlats;
    // Early-stage fix: the stage can start with gaps already visible on screen
    // Normally we only spawn in W-200..W+200 (near the right edge) but that means
    // for gravity/moving stages, no hill exists until terrain scrolls ~half a screen in.
    // When few hills exist and we're still early, allow spawning in the visible area too.
    const earlyStage=(isGravityStage||isMovingStage||isGimmickMoving)&&movingHills.length<2&&rawDist<600;
    const gapMinX=earlyStage?(player.x+40):(W-200);
    const gapMaxX=earlyStage?(W+300):(W+200);
    // Find a gap (abyss) in platforms to place the moving hill over
    let gapX=-1,gapW=0;
    for(let i=0;i<platArr.length-1;i++){
      const p1=platArr[i],p2=platArr[i+1];
      const gStart=p1.x+p1.w;
      const gEnd=p2.x;
      const gap=gEnd-gStart;
      if(gap>=50&&gStart>gapMinX&&gStart<gapMaxX){
        gapX=gStart;gapW=gap;break;
      }
    }
    if(gapX<0){hillCD=30+Math.floor(packRng()*15);return;}
    // Compute hill dimensions first for accurate overlap check
    const hw=Math.min(gapW*0.85,150+packRng()*200); // wide: 150-350px
    const hx=gapX+(gapW-hw)/2; // center in gap
    // Check overlap: don't spawn where new hill overlaps existing movingHill or fallingMtn
    // Gravity stage uses larger buffer (80px) to ensure clear visual separation
    const buf=isGravityStage?200:20;
    let hasFalling=false;for(let _i=0;_i<fallingMtns.length;_i++){const fm=fallingMtns[_i];if(hx<fm.x+fm.w+buf&&hx+hw>fm.x-buf){hasFalling=true;break;}}
    if(hasFalling){hillCD=30+Math.floor(packRng()*15);return;}
    let hasMH=false;for(let _i=0;_i<movingHills.length;_i++){const mh=movingHills[_i];if(hx<mh.x+mh.w+buf&&hx+hw>mh.x-buf){hasMH=true;break;}}
    if(hasMH){hillCD=30+Math.floor(packRng()*15);return;}
    const isGimmickMoving2=terrainGimmickPhase.active&&terrainGimmickPhase.type==='moving';
    hillCD=isGimmickMoving2?(40+Math.floor(packRng()*30)):(120+Math.floor(packRng()*80));
    if(isGimmickMoving2){terrainGimmickPhase.len--;if(terrainGimmickPhase.len<=0){terrainGimmickPhase.active=false;terrainGimmickPhase.cd=800+Math.floor(packRng()*400);}}
    const baseH=GROUND_H;
    const ampH=40+packRng()*50;
    movingHills.push({x:hx,w:hw,baseH:baseH,ampH:ampH,phase:packRng()*6.28,spd:0.02+packRng()*0.015,isFloor:isFloor});
  } else {
    hillCD=30+Math.floor(packRng()*15);
  }
}

// ===== GRAVITY REVERSAL ZONES =====
let gravZoneChain=0; // tracks how many zones spawned in current chain
let gravZoneChainTarget=0; // how many to spawn in this chain
function trySpawnGravZone(){
  if(gravZoneCD>0){gravZoneCD--;return;}
  if(isPackMode&&currentPackStage&&currentPackStage.noHazards)return;
  if(isPackMode&&currentPackStage&&currentPackStage.stageType==='altChasm')return;
  if(!isPackMode&&(bossPhase.bossCount<1||bossPhase.active))return;
  if(isPackMode&&bossPhase.active)return;
  if(!isPackMode&&score<150)return;
  // Void boss stage (1-5 etc): no gravity zones (walls are the main mechanic)
  if(isPackMode&&currentPackStage&&currentPackStage.stageType==='void'&&currentPackStage.boss)return;
  const plat=findEdgeSpawnPlat();
  if(!plat)return;
  let doSpawn=false;
  if(gravRushPhase.active){
    // Gravity rush phase: very high spawn rate, rapid zones
    doSpawn=true;
  } else if(gravZoneChain>0&&gravZoneChain<gravZoneChainTarget){
    doSpawn=true;
  } else {
    const chance=isPackMode?0.08:Math.min(0.04,0.008+(score-150)*0.0003);
    doSpawn=packRng()<chance;
  }
  if(doSpawn){
    const gx=Math.max(W+20,plat.x+plat.w*0.3);
    const gw=60+packRng()*50;
    // dir: 1=force down (blue), -1=force up (pink)
    const gdir=packRng()<0.5?1:-1;
    gravZones.push({x:gx,w:gw,triggered:false,fadeT:0,dir:gdir});
    if(gravRushPhase.active){
      // Gravity rush: rapid short gaps, count down
      gravRushPhase.len--;
      if(gravRushPhase.len<=0){gravRushPhase.active=false;gravRushPhase.cd=600+Math.floor(packRng()*400);}
      gravZoneCD=15+Math.floor(packRng()*25); // very tight spacing
    } else if(gravZoneChain===0){
      // Start new chain: determine count based on score
      let maxCount=1;
      if(bossPhase.bossCount>=5)maxCount=3;
      else if(bossPhase.bossCount>=4)maxCount=2;
      gravZoneChainTarget=1+Math.floor(packRng()*maxCount);
      gravZoneChain=1;
      if(gravZoneChainTarget>1){
        // Random uneven gap before next zone in chain
        gravZoneCD=30+Math.floor(packRng()*80); // 30-110 frames gap (uneven)
      } else {
        gravZoneChain=0;gravZoneChainTarget=0;
        gravZoneCD=300+Math.floor(packRng()*150);
      }
    } else {
      gravZoneChain++;
      if(gravZoneChain>=gravZoneChainTarget){
        gravZoneChain=0;gravZoneChainTarget=0;
        gravZoneCD=300+Math.floor(packRng()*150);
      } else {
        // Random uneven spacing: sometimes close, sometimes far apart
        gravZoneCD=20+Math.floor(packRng()*100); // 20-120 frames (very uneven)
      }
    }
  } else {
    gravZoneChain=0;gravZoneChainTarget=0;
    gravZoneCD=40+Math.floor(packRng()*20);
  }
}

// ===== ICICLES (snow stage gimmick) =====
// Icicles hang from ceiling, already visible. When player approaches, they shake and fall straight down.
function trySpawnIcicle(){
  if(icicleCD>0){icicleCD--;return;}
  if(bossPhase.active)return;
  if(!isPackMode||!currentPackStage||!currentPackStage.icicleChance)return;
  const chance=currentPackStage.icicleChance;
  if(packRng()<chance){
    icicleCD=20+Math.floor(packRng()*25);
    const ix=W+20+packRng()*80;
    const iw=16+packRng()*20; // width 16-36
    const ih=50+packRng()*70; // height 50-120 (big obstacle)
    // Ceiling only: find ceiling platform at spawn position
    let cp=null;for(let _i=0;_i<ceilPlats.length;_i++){const p=ceilPlats[_i];if(ix>=p.x&&ix<=p.x+p.w){cp=p;break;}}
    if(!cp){icicleCD=10;return;}
    const baseY=cp.h; // ceiling surface Y
    // Spawn already hanging (tip = baseY + ih)
    icicles.push({x:ix,w:iw,h:ih,baseY:baseY,tipY:baseY+ih,vy:0,isFloor:false,state:'hang',warnT:0,alpha:1});
  } else {
    icicleCD=12+Math.floor(packRng()*12);
  }
}

// ===== MAGMA FIREBALLS (magma stage gimmick) =====
// Cute little fire creatures that leap out of magma gaps in a parabolic arc
let magmaFireCD=0;
function trySpawnMagmaFire(){
  if(magmaFireCD>0){magmaFireCD--;return;}
  if(!isPackMode||currentPackIdx!==2)return; // magma pack only
  if(bossPhase.active)return;
  // Look for floor gaps (magma) slightly ahead of player
  for(let i=0;i<platforms.length-1;i++){
    const p1=platforms[i],p2=platforms[i+1];
    const gStart=p1.x+p1.w;
    const gEnd=p2.x;
    const gapW=gEnd-gStart;
    if(gapW<40)continue;
    const gapMid=gStart+gapW/2;
    // Trigger when gap is ahead of player and within range
    if(gapMid>player.x+30&&gapMid<player.x+250){
      // Don't spawn if there's already a fireball near this gap
      let _hasFB1=false;for(let _j=0;_j<magmaFireballs.length;_j++){if(Math.abs(magmaFireballs[_j].originX-gapMid)<gapW){_hasFB1=true;break;}}
      if(_hasFB1)continue;
      if(packRng()<0.35){
        magmaFireCD=40+Math.floor(packRng()*30);
        const fx=gapMid;
        const fy=H+10; // start from below screen (magma)
        const isFloorGap=true;
        // Parabolic arc: jump up then fall back
        const jumpVy=-(3+packRng()*2); // upward velocity (lowered to avoid reaching platform level)
        const jumpVx=(packRng()-0.5)*1.5; // slight horizontal drift
        magmaFireballs.push({x:fx,y:fy,vx:jumpVx,vy:jumpVy,originX:fx,originY:fy,
          isFloor:isFloorGap,sz:10+packRng()*4,phase:packRng()*6.28,alive:true,
          returning:false});
        return;
      }
    }
  }
  // Also check ceiling gaps
  for(let i=0;i<ceilPlats.length-1;i++){
    const p1=ceilPlats[i],p2=ceilPlats[i+1];
    const gStart=p1.x+p1.w;
    const gEnd=p2.x;
    const gapW=gEnd-gStart;
    if(gapW<40)continue;
    const gapMid=gStart+gapW/2;
    if(gapMid>player.x+30&&gapMid<player.x+250){
      let _hasFB2=false;for(let _j=0;_j<magmaFireballs.length;_j++){if(Math.abs(magmaFireballs[_j].originX-gapMid)<gapW){_hasFB2=true;break;}}
      if(_hasFB2)continue;
      if(packRng()<0.25){
        magmaFireCD=45+Math.floor(packRng()*35);
        const fx=gapMid;
        const fy=-10; // start from above screen (ceiling magma)
        const jumpVy=2.5+packRng()*1.5; // downward (lowered)
        const jumpVx=(packRng()-0.5)*1.5;
        magmaFireballs.push({x:fx,y:fy,vx:jumpVx,vy:jumpVy,originX:fx,originY:fy,
          isFloor:false,sz:10+packRng()*4,phase:packRng()*6.28,alive:true,
          returning:false});
        return;
      }
    }
  }
  magmaFireCD=10+Math.floor(packRng()*8);
}

// ===== BIRD ENEMY =====
function trySpawnBird(){
  if(birdCD>0){birdCD--;return;}
  if(bossPhase.active)return;
  if(isPackMode&&currentPackStage&&currentPackStage.noHazards)return;
  if(!isPackMode&&score<30)return;
  // Spawn chance
  const chance=isPackMode?0.018:0.014;
  if(packRng()<chance){
    birdCD=160+Math.floor(packRng()*100); // cooldown after spawn
    const gd=player.gDir;
    const sz=11;
    // Spawn at player's Y level, fly horizontally toward player
    const fy=player.y;
    const flySpd=1.0+packRng()*0.5; // slow horizontal speed
    enemies.push({x:W+30,y:fy,vy:0,gDir:gd,walkSpd:0,sz:sz,alive:true,fr:packRng()*100,
      type:7,shootT:999,flySpd:flySpd});
  } else {
    birdCD=30+Math.floor(packRng()*20);
  }
}
