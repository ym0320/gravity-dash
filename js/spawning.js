'use strict';
// ===== SPAWNING (cooldown-based for reliable continuous generation) =====
let coinCD=0,itemCD=0,enemyCD=0;

function findSpawnPlat(){
  // Find a platform that is ahead of screen (right side)
  return platforms.find(p=>p.x>W*0.55&&p.x+p.w<W+250)||platforms.find(p=>p.x+p.w>W*0.6&&p.x<W+200);
}
function findEdgeSpawnPlat(){
  // Find a platform that extends past or starts at the right screen edge
  return platforms.find(p=>p.x<W+40&&p.x+p.w>W)||platforms.find(p=>p.x>=W&&p.x<W+100);
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
  if(bossPhase.active)return;
  const plat=findEdgeSpawnPlat();
  if(!plat)return;
  if(Math.random()<0.18){ // reduced frequency (was 0.30)
    coinCD=50+Math.floor(Math.random()*30); // longer cooldown (was 28+20)
    // Alternate between floor and ceiling to prevent overlap
    let onFloor;
    if(lastCoinCourse==='floor') {onFloor=false;lastCoinCourse='ceil';}
    else if(lastCoinCourse==='ceil') {onFloor=true;lastCoinCourse='floor';}
    else {onFloor=player.gDir===1||Math.random()<0.5;lastCoinCourse=onFloor?'floor':'ceil';}
    const surfY=onFloor?H-plat.h:(()=>{const cp=ceilPlats.find(p=>plat.x+plat.w*0.3>=p.x&&plat.x+plat.w*0.3<=p.x+p.w);return cp?cp.h:GROUND_H;})();
    const pattern=Math.random();
    const n=3+Math.floor(Math.random()*2); // 3-4 coins per group (was 3-5)
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
    coinCD=20+Math.floor(Math.random()*15); // longer no-spawn cooldown (was 12+8)
  }
}
function trySpawnItem(){
  if(itemCD>0){itemCD--;return;}
  if(score<5)return;
  if(bossPhase.active)return;
  const plat=findEdgeSpawnPlat();
  if(!plat)return;
  if(Math.random()<0.12){
    itemCD=140+Math.floor(Math.random()*80);
    const ix=Math.max(W+14,plat.x); // spawn at right screen edge
    const surfY=H-plat.h;
    // Pick random item: 0=invincible, 1=magnet, 2=double jump, 3=heart, 4=slow
    let it;
    if(hp<maxHp()&&Math.random()<0.3){it=3;} // higher chance for heart when damaged
    else{const r=Math.random();if(r<0.05){it=0;}else if(r<0.13){it=2;}else{it=1;}}
    items.push({x:ix,y:surfY-55-Math.random()*25,t:it,sz:14,p:Math.random()*6.28,col:false});
  } else {
    itemCD=20+Math.floor(Math.random()*15);
  }
}

// ===== ENEMIES =====
// Types: 0=左右パトロール, 1=砲台(水平砲弾), 2=空中飛行
function trySpawnEnemy(){
  if(enemyCD>0){enemyCD--;return;}
  if(score<30)return; // enemies appear later
  if(bossPhase.active)return; // no normal enemies during boss
  const plat=findEdgeSpawnPlat();
  if(!plat)return;
  const chance=Math.min(0.3,0.04+(score-30)*0.002);
  if(Math.random()<chance){
    enemyCD=55+Math.floor(Math.random()*50);
    const ex=Math.max(W+13,plat.x);
    const sz=13;
    // Choose enemy type based on score - early game = walkers only
    let eType=0;
    const tr=Math.random();
    if(score>=200&&bossPhase.bossCount>=1&&tr<0.15) eType=3; // bomber (after boss)
    else if(score>=160&&tr<0.12) eType=5; // phantom (mid-late)
    else if(score>=140&&tr<0.15) eType=4; // vertical mover (mid-late)
    else if(score>=120&&tr<0.22) eType=2; // flyer (mid-late)
    else if(score>=80&&tr<0.35) eType=1; // cannon (mid)
    else eType=0; // walker/patrol (always available)

    if(eType===4){
      // Vertical mover: bounces between floor and ceiling
      const surfY=H-plat.h;
      const sz=14;
      enemies.push({x:ex,y:surfY-sz,vy:-2.5-Math.random()*1.5,gDir:1,walkSpd:0,sz:sz,alive:true,fr:Math.random()*100,type:4,shootT:999,
        moveDir:-1,moveSpd:2.5+Math.random()*1.5,pauseT:0});
    } else if(eType===5){
      // Phantom: floats in air, periodically becomes invisible
      const surfY=H-plat.h;
      const flyY=surfY-50-Math.random()*60;
      const sz=13;
      enemies.push({x:ex,y:flyY,vy:0,gDir:1,walkSpd:0,sz:sz,alive:true,fr:Math.random()*100,type:5,shootT:999,
        baseY:flyY,flyPhase:Math.random()*6.28,flyAmp:15+Math.random()*15,
        visTimer:0,visCycle:90+Math.floor(Math.random()*60),visible:true,fadeT:0});
    } else if(eType===2){
      // Flying enemy: spawns in the air between floor and ceiling
      const surfY=H-plat.h;
      const flyY=surfY-60-Math.random()*80;
      enemies.push({x:ex,y:flyY,vy:0,gDir:1,walkSpd:0,sz:sz,alive:true,fr:Math.random()*100,type:2,shootT:999,
        baseY:flyY,flyPhase:Math.random()*6.28,flyAmp:20+Math.random()*25});
    } else if(eType===3){
      // Bomber (Hammer Bros style): stationary, throws bombs in an arc
      const surfY=H-plat.h;
      enemies.push({x:ex,y:surfY-sz,vy:0,gDir:1,walkSpd:0.1,sz:sz+2,alive:true,fr:Math.random()*100,type:3,
        shootT:90+Math.floor(Math.random()*40),bombCD:90+Math.floor(Math.random()*40),
        patrolDir:1,patrolOriginX:ex,patrolRange:15+Math.random()*20});
    } else {
      const onCeil=Math.random()<0.3;
      const gd=onCeil?-1:1;
      const surfY=gd===1?H-plat.h:ceilSurfaceY(ex);
      if(eType===0){
        // Walker with left-right patrol
        enemies.push({x:ex,y:gd===1?surfY-sz:surfY+sz,vy:0,gDir:gd,walkSpd:0.3+Math.random()*0.4,sz:sz,alive:true,fr:Math.random()*100,type:0,shootT:999,
          patrolDir:1,patrolOriginX:ex,patrolRange:30+Math.random()*40});
      } else {
        // Cannon (shooter) - stationary
        enemies.push({x:ex,y:gd===1?surfY-sz:surfY+sz,vy:0,gDir:gd,walkSpd:0.15+Math.random()*0.2,sz:sz,alive:true,fr:Math.random()*100,type:1,shootT:60+Math.floor(Math.random()*60)});
      }
    }
  } else {
    enemyCD=15+Math.floor(Math.random()*10);
  }
}

// ===== FLOATING MID-AIR PLATFORMS =====
function trySpawnFloatPlat(){
  if(floatCD>0){floatCD--;return;}
  if(score<100)return; // appear after more progression
  if(bossPhase.active)return;
  const plat=findEdgeSpawnPlat();
  if(!plat)return;
  const chance=Math.min(0.18,0.04+(score-35)*0.002);
  if(Math.random()<chance){
    floatCD=80+Math.floor(Math.random()*60);
    const fx=Math.max(W+20,plat.x);
    const fw=50+Math.random()*60; // width: 50-110px
    const floorY=H-plat.h;
    const ceilY=ceilSurfaceY(fx);
    const gap=floorY-ceilY;
    if(gap<120)return; // not enough room
    // Place at a height reachable by jumping from the floor
    // Max jump height ≈ JUMP_POWER^2 / (2*GRAVITY) ≈ 145px
    const maxJumpH=JUMP_POWER*JUMP_POWER/(2*GRAVITY)*0.75; // ~109px (comfortable reach)
    const fy=floorY-maxJumpH*(0.5+Math.random()*0.5); // 50-100% of comfortable jump height
    floatPlats.push({x:fx,y:fy,w:fw,th:10});
    // Sometimes spawn an item on the floating platform
    if(Math.random()<0.4){
      const pool=[1,2]; // magnet or double jump
      if(hp<maxHp()&&Math.random()<0.3) pool.push(3); // heart if damaged
      const it=pool[Math.floor(Math.random()*pool.length)];
      items.push({x:fx+fw/2,y:fy-25,t:it,sz:14,p:Math.random()*6.28,col:false});
    }
    // Sometimes spawn coins in an arc above
    if(Math.random()<0.5){
      for(let i=0;i<3;i++){
        coins.push({x:fx+10+i*(fw-20)/2,y:fy-30-Math.sin(i/2*Math.PI)*15,sz:9,col:false,p:0});
      }
    }
  } else {
    floatCD=20+Math.floor(Math.random()*15);
  }
}

// ===== STAGE GIMMICKS =====
function trySpawnSpike(){
  if(spikeCD>0){spikeCD--;return;}
  if(bossPhase.bossCount<3||bossPhase.active)return; // only after 3rd boss defeated
  const plat=findEdgeSpawnPlat();
  if(!plat)return;
  const chance=Math.min(0.15,0.03+(score-80)*0.001);
  if(Math.random()<chance){
    spikeCD=80+Math.floor(Math.random()*60);
    const sx=Math.max(W+10,plat.x+Math.random()*plat.w*0.5);
    const sw=30+Math.random()*30;
    // state: 'hidden','warning','up','retracting'
    spikes.push({x:sx,w:sw,h:H-plat.h,spikeH:22,phase:0,timer:0,state:'hidden',
      cycle:120+Math.floor(Math.random()*80),upTime:60+Math.floor(Math.random()*30),
      isFloor:true});
  } else {
    spikeCD=25+Math.floor(Math.random()*15);
  }
}

function trySpawnMovingHill(){
  if(hillCD>0){hillCD--;return;}
  if(bossPhase.bossCount<2||bossPhase.active)return; // only after 2nd boss defeated
  const plat=findEdgeSpawnPlat();
  if(!plat)return;
  const chance=Math.min(0.1,0.02+(score-120)*0.001);
  if(Math.random()<chance){
    hillCD=120+Math.floor(Math.random()*80);
    const hx=Math.max(W+10,plat.x);
    const hw=60+Math.random()*50;
    const baseH=plat.h;
    const ampH=25+Math.random()*30;
    movingHills.push({x:hx,w:hw,baseH:baseH,ampH:ampH,phase:Math.random()*6.28,spd:0.03+Math.random()*0.02});
  } else {
    hillCD=30+Math.floor(Math.random()*15);
  }
}

// ===== GRAVITY REVERSAL ZONES =====
function trySpawnGravZone(){
  if(gravZoneCD>0){gravZoneCD--;return;}
  if(bossPhase.bossCount<1||bossPhase.active)return; // only after 1st boss defeated
  if(score<150)return;
  const plat=findEdgeSpawnPlat();
  if(!plat)return;
  const chance=Math.min(0.08,0.015+(score-150)*0.0005);
  if(Math.random()<chance){
    gravZoneCD=200+Math.floor(Math.random()*120);
    const gx=Math.max(W+20,plat.x+plat.w*0.3);
    const gw=60+Math.random()*50; // width of the zone (waterfall)
    gravZones.push({x:gx,w:gw,triggered:false,fadeT:0});
  } else {
    gravZoneCD=40+Math.floor(Math.random()*20);
  }
}
