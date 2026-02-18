'use strict';
// ===== BOSS PHASE =====
function startBossPhase(){
  bossPhase.active=true;
  bossPhase.prepare=120;
  bossPhase.alertT=0;
  bossPhase.noDamage=true; // track if player takes no damage during boss
  bossPhase.bossType=''; // track boss type for victory check
  bossPhase.enemies=[];
  bossPhase.defeated=0;
  bossPhase.reward=false;
  bossPhase.rewardT=0;
  bossPhase.chargeQueue=[]; // queue of charge enemies to spawn
  bossPhase.chargeIdx=0;
  bossPhase.bruiser=null; // the multi-stomp boss
  bossPhase.wizard=null; // the teleporting wizard boss
  bossPhase.dodgeQueue=[]; // queue of dodge enemies
  bossPhase.dodgeIdx=0;
  bossPhase.dodgeKills=0;
  enemies=[];bullets=[];floatPlats=[];spikes=[];movingHills=[];gravZones=[];
  bossPhase.bossCount++;
  bossPhase.lastBossScore=score;
  bossPhase.nextAt=score+800+bossPhase.bossCount*100;
  shakeI=18;sfxBossAlert();vibrate([50,30,50,30,80,40,100]);
  switchBGM('boss');
}
function spawnBossEnemies(){
  const bc=bossPhase.bossCount; // 1-based count of boss fights
  const floorY=H-GROUND_H;
  const ceilY=GROUND_H;
  bossPhase.chargeQueue=[];
  bossPhase.chargeIdx=0;
  bossPhase.bruiser=null;
  bossPhase.wizard=null;
  bossPhase.dodgeQueue=[];
  bossPhase.dodgeIdx=0;
  bossPhase.dodgeKills=0;
  // Randomly choose boss type: all 4 types equally likely (25% each)
  const roll=Math.random();
  let bossType;
  if(roll<0.25) bossType='wizard';
  else if(roll<0.50) bossType='bruiser';
  else if(roll<0.75) bossType='charge';
  else bossType='dodge';
  bossPhase.bossType=bossType;
  if(bossType==='charge'){
    // Charge type: vertical movement from 1st encounter, progressive mechanics
    const chargeCount=5;
    const baseSpd=3+Math.min(bc-1,5)*0.4;
    const spdVariance=Math.min(bc,5)*0.6;
    for(let i=0;i<chargeCount;i++){
      const fromCeil=Math.random()<0.5;
      const gDir=fromCeil?-1:1;
      const sy=gDir===1?floorY:ceilY;
      const sz=PLAYER_R*5;
      const ey=gDir===1?sy-sz:sy+sz;
      const fromLeft=Math.random()<0.5;
      const spd=baseSpd+Math.random()*(1.5+spdVariance);
      // Vertical movement from 1st encounter (60%+ chance, increases with bc)
      const diagProb=0.6+Math.min(bc-1,4)*0.08;
      const diagMag=1.5+Math.min(bc-1,4)*0.5;
      const diagVy=Math.random()<diagProb?(gDir===1?-diagMag-Math.random()*1.5:diagMag+Math.random()*1.5):0;
      // Feint from 1st encounter (20%→60% with bc)
      const feintProb=0.2+Math.min(bc-1,4)*0.1;
      const hasFeint=Math.random()<feintProb;
      // Multiple feints at higher bc
      const feintCount=bc>=3?1+Math.floor(Math.random()*Math.min(bc-1,3)):hasFeint?1:0;
      // Speed changes from 2nd encounter (30%→60%)
      const accelProb=bc>=2?0.3+Math.min(bc-2,3)*0.1:0;
      const hasAccel=Math.random()<accelProb;
      // Ranged attack from 3rd encounter
      const hasShot=bc>=3&&Math.random()<0.4+Math.min(bc-3,3)*0.1;
      // Random direction changes at high bc
      const hasDirChange=bc>=4&&Math.random()<0.3;
      bossPhase.chargeQueue.push({
        x:fromLeft?-80-i*10:W+80+i*10,y:ey,vy:0,gDir:gDir,sz:sz,alive:true,fr:Math.random()*100,
        type:10,shootT:999,boss:true,bossType:'charge',
        chargeVx:fromLeft?(spd):(-spd),
        diagVy:diagVy,
        chargeState:'wait',
        rushDelay:30+Math.floor(Math.random()*90),
        timer:0,
        feintPause:feintCount>0?30+Math.floor(Math.random()*20):0,
        feintTriggered:false,feintCount:feintCount,feintsDone:0,
        chargeAccel:hasAccel?(Math.random()<0.5?0.04:-0.02):0,
        shootOnce:hasShot,shotFired:false,
        dirChange:hasDirChange
      });
    }
    bossPhase.total=chargeCount;
  } else if(bossType==='dodge'){
    // Dodge type: 5 enemies, ALL must be killed (loopback if missed)
    const dodgeCount=5;
    const baseSpd=3+Math.min(bc-1,4)*0.3;
    for(let i=0;i<dodgeCount;i++){
      const fromCeil=Math.random()<0.5;
      const gDir=fromCeil?-1:1;
      const sy=gDir===1?floorY:ceilY;
      const sz=PLAYER_R*5;
      const ey=gDir===1?sy-sz:sy+sz;
      // 2nd encounter: varied speeds, cross movement
      const spdRange=bc>=2?2.5:0.5;
      const spd=baseSpd-spdRange/2+Math.random()*spdRange;
      const diagVy=bc>=2&&Math.random()<0.5?(gDir===1?-1.5-Math.random()*1.5:1.5+Math.random()*1.5):0;
      // 3rd encounter: feint (sudden direction change)
      const hasFeint=bc>=3&&Math.random()<0.4;
      bossPhase.dodgeQueue.push({
        x:W+80+i*10,y:ey,vy:0,gDir:gDir,sz:sz,alive:true,fr:Math.random()*100,
        type:10,shootT:999,boss:true,bossType:'dodge',
        chargeVx:-spd,
        diagVy:diagVy,
        chargeState:'wait',
        rushDelay:30+Math.floor(Math.random()*90),
        timer:0,
        missCount:0,
        feintDiag:hasFeint,feintTriggered:false
      });
    }
    bossPhase.total=dodgeCount;
    bossPhase.dodgeKills=0;
  } else if(bossType==='bruiser'){
    // Bruiser type: 2x previous size, always 3 stomps, from 2nd encounter moves between floor/ceiling
    const bsz=(30+Math.min(bc-1,3)*3)*2;
    const bruiser={
      x:W+80,y:floorY-bsz,vy:0,gDir:1,sz:bsz,alive:true,fr:0,
      type:11,shootT:999,boss:true,bossType:'bruiser',
      hp:3, maxHp:3,
      chargeVx:-(3.5+Math.min(bc-1,6)*0.4), retreatVx:2.5+Math.min(bc-1,4)*0.2,
      state:'enter',
      timer:0, stunT:0, hurtFlash:0, invT:0, feinted:false,
      flipEnabled:bc>=2, // from 2nd encounter: can move between floor and ceiling
      patrolDir:1,patrolOriginX:W*0.6,patrolRange:0
    };
    bossPhase.bruiser=bruiser;
    bossPhase.total=1;
  } else {
    // Wizard type: floats in air, dashes toward player then returns, shoots patterns
    const wsz=24+Math.min(bc-1,3)*2;
    const wizard={
      x:W+60,y:H/2,vy:0,gDir:1,sz:wsz,alive:true,fr:0,
      type:12,shootT:999,boss:true,bossType:'wizard',
      hp:1,maxHp:1, // 1-hit kill
      state:'enter',timer:0,hurtFlash:0,invT:0,
      castT:0,castType:0, // 0=ring, 1=wave
      teleportT:0,teleportTarget:{x:0,y:0},
      alpha:1,
      rushDir:1,rushT:0,rushReady:false,rushTargetX:0,rushTargetY:0,
      homeX:W*0.65,homeY:H*0.35+Math.random()*(H*0.3) // floating home position
    };
    bossPhase.wizard=wizard;
    bossPhase.total=1;
  }
}
function updateBossPhase(){
  if(!bossPhase.active)return;
  bossPhase.alertT++;
  if(bossPhase.prepare>0){
    bossPhase.prepare--;
    if(bossPhase.prepare%4===0){
      for(let i=0;i<3;i++){
        const side=Math.random()<0.5?-10:W+10;
        parts.push({x:side,y:Math.random()*H,vx:side<0?3:-3,vy:(Math.random()-0.5)*2,life:40,ml:40,sz:Math.random()*4+2,col:['#ff3860','#ff0040','#cc0030'][i%3]});
      }
    }
    if(bossPhase.prepare===0){spawnBossEnemies();
      // Boss roar after spawning
      const bt=bossPhase.bruiser?'bruiser':bossPhase.wizard?'wizard':bossPhase.dodgeQueue.length>0?'dodge':'charge';
      sfxBossRoar(bt);
    }
    return;
  }
  if(bossPhase.reward){
    bossPhase.rewardT++;
    // Update chest fall physics
    if(chestFall.active&&chestFall.gotT===0){
      chestFall.vy+=0.15;
      chestFall.y+=chestFall.vy;
      chestFall.sparkT++;
      // Sparkle trail while falling
      if(chestFall.sparkT%3===0){
        parts.push({x:chestFall.x+(Math.random()-0.5)*30,y:chestFall.y+(Math.random()-0.5)*10,
          vx:(Math.random()-0.5)*2,vy:-1-Math.random()*2,life:20+Math.random()*15,ml:35,
          sz:Math.random()*4+2,col:['#ffd700','#ffaa00','#fff4b0','#ffffff'][Math.floor(Math.random()*4)]});
      }
      // Land on player
      if(chestFall.y>=player.y-20){
        chestFall.y=player.y-20;chestFall.vy=0;chestFall.gotT=1;
        sfxChestGet();shakeI=12;vibrate([20,10,40,20,60]);
        // Big burst of sparkles
        for(let i=0;i<30;i++){
          const a=(6.28/30)*i,s=2+Math.random()*5;
          parts.push({x:chestFall.x,y:chestFall.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,
            life:40+Math.random()*30,ml:70,sz:Math.random()*6+2,
            col:['#ffd700','#ffaa00','#ff88cc','#88ffff','#ffffff'][i%5]});
        }
        addPop(chestFall.x,chestFall.y-30,'宝箱 GET!','#ffd700');
      }
    } else if(chestFall.gotT>0){
      chestFall.gotT++;
      // Chest shrinks into player after collection
      if(chestFall.gotT>40)chestFall.active=false;
    }
    if(bossPhase.rewardT>=180){bossPhase.active=false;bossPhase.reward=false;if(itemEff.invincible<=0)switchBGM('play');}
    return;
  }
  const floorY=H-GROUND_H;
  const ceilY=GROUND_H;
  const pr=PLAYER_R*ct().sizeMul;
  // Phase A: spawn charge enemies from queue
  if(bossPhase.chargeIdx<bossPhase.chargeQueue.length){
    const next=bossPhase.chargeQueue[bossPhase.chargeIdx];
    next.rushDelay--;
    if(next.rushDelay<=0){
      next.chargeState='rush';
      enemies.push(next);
      bossPhase.enemies.push(next);
      bossPhase.chargeIdx++;
      sfx('shoot');shakeI=4;
    }
  }
  // Update charge enemies
  enemies.forEach(en=>{
    if(!en.alive||en.bossType!=='charge')return;
    if(en.chargeState==='rush'){
      // Feint pauses: stop briefly mid-rush then resume (supports multiple feints)
      if(en.feintPause>0&&en.feintsDone<en.feintCount&&en.timer>15+en.feintsDone*25&&en.timer<80){
        if(!en._feinting){
          en._feinting=true;en._savedVx=en.chargeVx;en._savedDiag=en.diagVy;
          en.chargeVx=0;en.diagVy=0;
          const dur=en.feintPause;
          setTimeout(()=>{if(en.alive){en.chargeVx=en._savedVx;en.diagVy=en._savedDiag;en._feinting=false;en.feintsDone++;}},dur*16);
        }
      }
      // Acceleration
      if(en.chargeAccel&&!en._feinting){en.chargeVx+=en.chargeAccel*(en.chargeVx>0?1:-1);}
      en.x+=en.chargeVx;
      en.timer++;
      // Vertical movement (from 1st encounter)
      if(en.diagVy){
        en.y+=en.diagVy;
        // Random direction change at high encounters
        if(en.dirChange&&!en._dirChanged&&en.timer>30&&en.timer<70&&Math.random()<0.015){
          en.diagVy*=-1;en._dirChanged=true;
        }
        if(en.y-en.sz<ceilY){en.y=ceilY+en.sz;en.diagVy=Math.abs(en.diagVy);}
        if(en.y+en.sz>floorY){en.y=floorY-en.sz;en.diagVy=-Math.abs(en.diagVy);}
      }
      // Single ranged attack (3rd encounter+)
      if(en.shootOnce&&!en.shotFired&&en.timer>15&&Math.abs(en.x-player.x)<W*0.6){
        en.shotFired=true;
        const dx2=player.x-en.x,dy2=player.y-en.y;
        const d2=Math.sqrt(dx2*dx2+dy2*dy2)||1;
        bullets.push({x:en.x,y:en.y,vx:dx2/d2*4,vy:dy2/d2*4,sz:6,life:100});
        sfx('shoot');
      }
      en.fr+=0.2;
      if(frame%2===0){
        const tc2=en.gDir===1?'#ff4444':'#4444ff';
        const trailX=en.chargeVx>0?en.x-en.sz:en.x+en.sz;
        parts.push({x:trailX,y:en.y,vx:(en.chargeVx>0?-1:1)+Math.random(),vy:(Math.random()-0.5)*2,life:12,ml:12,sz:Math.random()*4+2,col:tc2});
      }
      // Off-screen: charge dodged = defeated
      if(en.x<-en.sz*2||en.x>W+en.sz*2){
        en.alive=false;
        addPop(en.x<0?40:W-40,en.y,'回避!','#34d399');
        emitParts(en.x<0?10:W-10,en.y,8,'#34d399',3,2);
      }
      // Collision with player
      const dx=player.x-en.x,dy=player.y-en.y;
      if(Math.sqrt(dx*dx+dy*dy)<pr+en.sz){
        if(itemEff.invincible>0){
          en.alive=false;
          emitParts(en.x,en.y,15,'#ff00ff',4,3);sfx('stomp');shakeI=4;
        } else {
          const stomped=en.gDir===1
            ?(player.y+pr<en.y-en.sz*0.15&&player.vy>=0)
            :(player.y-pr>en.y+en.sz*0.15&&player.vy<=0);
          if(stomped){
            en.alive=false;
            player.vy=en.gDir===1?-JUMP_POWER*0.8:JUMP_POWER*0.8;
            player.grounded=false;flipCount=0;player.canFlip=true;djumpUsed=false;djumpAvailable=true;
            shakeI=8;sfx('bossHit');sfx('gstomp');vibrate([15,10,20]);
            addPop(en.x,en.y-en.sz*en.gDir,'撃破!','#ffd700');
            emitParts(en.x,en.y,15,'#ffd700',6,3);
          } else {
            hurt();
            en.alive=false;
          }
        }
      }
    }
  });
  // Spawn and update dodge enemies
  if(bossPhase.dodgeIdx<bossPhase.dodgeQueue.length){
    const next=bossPhase.dodgeQueue[bossPhase.dodgeIdx];
    next.rushDelay--;
    if(next.rushDelay<=0){
      next.chargeState='rush';next.timer=0;
      enemies.push(next);
      bossPhase.enemies.push(next);
      bossPhase.dodgeIdx++;
      sfx('shoot');shakeI=4;
    }
  }
  enemies.forEach(en=>{
    if(!en.alive||en.bossType!=='dodge')return;
    if(en.chargeState==='rush'){
      en.x+=en.chargeVx;
      en.timer++;
      if(en.diagVy){
        en.y+=en.diagVy;
        // 3rd encounter feint: sudden direction change
        if(en.feintDiag&&!en.feintTriggered&&en.timer>20&&en.timer<50&&Math.random()<0.02){
          en.diagVy*=-1;en.feintTriggered=true;
        }
        if(en.y-en.sz<ceilY)en.y=ceilY+en.sz;
        if(en.y+en.sz>floorY)en.y=floorY-en.sz;
      }
      en.fr+=0.2;
      if(frame%2===0){
        const tc2='#ff8844';
        parts.push({x:en.x+en.sz,y:en.y,vx:1+Math.random(),vy:(Math.random()-0.5)*2,life:12,ml:12,sz:Math.random()*4+2,col:tc2});
      }
      // Off-screen: NOT defeated, loop back from right (both sides)
      if(en.x<-en.sz*2||en.x>W+en.sz*2){
        en.chargeState='wait';
        en.x=W+80;
        en.rushDelay=30+Math.floor(Math.random()*60);
        en.timer=0;en.feintTriggered=false;
        en.missCount++;
        // Speed up slightly on each loop
        en.chargeVx*=1.1;
        // Re-queue for spawning
        bossPhase.dodgeQueue.push(en);
        addPop(40,en.y,'逃した!','#ff8844');
        emitParts(10,en.y,6,'#ff8844',3,2);
        // Remove from enemies array (will be re-added when spawned)
        en._requeued=true;
      }
      // Collision with player
      const dx=player.x-en.x,dy=player.y-en.y;
      if(Math.sqrt(dx*dx+dy*dy)<pr+en.sz){
        if(itemEff.invincible>0){
          en.alive=false;bossPhase.dodgeKills++;
          emitParts(en.x,en.y,15,'#ff00ff',4,3);sfx('stomp');shakeI=4;
        } else {
          const stomped=en.gDir===1
            ?(player.y+pr<en.y-en.sz*0.15&&player.vy>=0)
            :(player.y-pr>en.y+en.sz*0.15&&player.vy<=0);
          if(stomped){
            en.alive=false;bossPhase.dodgeKills++;
            player.vy=en.gDir===1?-JUMP_POWER*0.8:JUMP_POWER*0.8;
            player.grounded=false;flipCount=0;player.canFlip=true;djumpUsed=false;djumpAvailable=true;
            shakeI=8;sfx('bossHit');sfx('gstomp');vibrate([15,10,20]);
            addPop(en.x,en.y-en.sz*en.gDir,'撃破!','#ffd700');
            emitParts(en.x,en.y,15,'#ffd700',6,3);
          } else {
            hurt();
          }
        }
      }
    }
  });
  // Remove requeued dodge enemies from active enemies list, keep in dodgeQueue for respawn
  const requeuedSet=new Set();
  enemies.forEach(en=>{if(en._requeued){requeuedSet.add(en);delete en._requeued;}});
  if(requeuedSet.size>0){
    enemies=enemies.filter(en=>!requeuedSet.has(en));
    bossPhase.enemies=bossPhase.enemies.filter(en=>!requeuedSet.has(en));
  }
  // Phase B: bruiser logic (enters immediately if no charges, or after charges cleared)
  const chargesCleared=bossPhase.chargeQueue.length===0||(bossPhase.chargeIdx>=bossPhase.chargeQueue.length&&
    bossPhase.enemies.filter(e=>e.bossType==='charge'&&e.alive).length===0);
  if(chargesCleared&&bossPhase.bruiser&&bossPhase.bruiser.alive){
    const b=bossPhase.bruiser;
    const bc=bossPhase.bossCount;
    if(!enemies.includes(b)){
      enemies.push(b);bossPhase.enemies.push(b);
    }
    b.timer++;b.fr+=0.1;
    if(b.hurtFlash>0)b.hurtFlash--;
    if(b.invT>0)b.invT--;
    if(b.state==='enter'){
      b.x+=b.chargeVx*0.5;
      if(b.x<=W*0.7){b.state='charge';b.timer=0;b.feinted=false;}
    } else if(b.state==='charge'){
      b.x+=b.chargeVx;
      b.fr+=0.15;
      if(frame%2===0)parts.push({x:b.x+b.sz,y:b.y,vx:2,vy:(Math.random()-0.5)*1.5,life:15,ml:15,sz:Math.random()*5+2,col:'#ff3860'});
      // Feint: at higher boss counts, sometimes fake charge then retreat
      if(bc>=2&&b.timer>15&&b.timer<50&&!b.feinted&&Math.random()<0.004*bc){
        b.state='feint';b.feintT=25;b.timer=0;b.feinted=true;
      }
      if(b.x<W*0.15){b.state='retreat';b.timer=0;}
    } else if(b.state==='feint'){
      // Quick retreat (fake-out)
      b.x+=b.retreatVx*1.8;
      b.feintT--;
      if(frame%3===0)parts.push({x:b.x-b.sz*0.3,y:b.y,vx:-1,vy:(Math.random()-0.5),life:10,ml:10,sz:Math.random()*3+1,col:'#ffaa00'});
      if(b.feintT<=0){b.state='charge';b.timer=0;}
    } else if(b.state==='invincible'){
      // Blinking invincible after being stomped, slowly retreating
      b.invT--;
      b.x+=b.retreatVx*0.6;
      if(b.invT<=0){b.state='retreat';b.timer=0;}
    } else if(b.state==='retreat'){
      b.x+=b.retreatVx;
      if(b.x>=W*0.7){
        // From 2nd encounter: sometimes flip to other surface when re-engaging
        if(b.flipEnabled&&Math.random()<0.4){
          b.gDir*=-1;
        }
        b.state='charge';b.timer=0;b.feinted=false;
      }
    }
    // Collision check (skip during invincible state)
    if(b.invT<=0){
      const dx=player.x-b.x,dy=player.y-b.y;
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<pr+b.sz){
        if(itemEff.invincible>0){
          b.hp--;b.hurtFlash=20;b.invT=60;b.state='invincible';b.timer=0;
          shakeI=8;sfx('bossHit');
          emitParts(b.x,b.y,15,'#ff00ff',4,3);
          if(b.hp<=0){bossBruiserDefeat(b);}
        } else {
          // Stomp check: stricter - player must be well above bruiser top (gDir-aware)
          const stomped=b.gDir===1
            ?(player.y+pr<b.y-b.sz*0.15&&player.vy>=0&&player.gDir===1)
            :(player.y-pr>b.y+b.sz*0.15&&player.vy<=0&&player.gDir===-1);
          if(stomped){
            b.hp--;b.hurtFlash=20;
            b.state='invincible';b.invT=60;b.timer=0;
            player.vy=b.gDir===1?-JUMP_POWER*0.8:JUMP_POWER*0.8;player.grounded=false;
            flipCount=0;player.canFlip=true;djumpUsed=false;djumpAvailable=true;
            shakeI=12;sfx('bossHit');sfx('gstompHeavy');vibrate([20,10,30]);
            addPop(b.x,b.y-b.sz*b.gDir-10,'HP '+b.hp+'/'+b.maxHp,'#ff3860');
            emitParts(b.x,b.y-b.sz*b.gDir,12,'#ff3860',5,3);
            if(b.hp<=0){bossBruiserDefeat(b);}
          } else {
            hurt();
          }
        }
      }
    }
    // Keep on correct surface (floor or ceiling based on gDir)
    if(b.gDir===1){
      const sy=floorSurfaceY(b.x);
      if(sy<H+100)b.y=sy-b.sz;
    } else {
      const sy=ceilSurfaceY(b.x);
      if(sy>-100)b.y=sy+b.sz;
    }
  }
  // Phase C: wizard boss logic
  const wizardActive=bossPhase.wizard&&bossPhase.wizard.alive;
  if(chargesCleared&&wizardActive){
    const w=bossPhase.wizard;
    if(!enemies.includes(w)){
      enemies.push(w);bossPhase.enemies.push(w);
    }
    w.timer++;w.fr+=0.1;
    if(w.hurtFlash>0)w.hurtFlash--;
    if(w.invT>0)w.invT--;
    if(w.state==='enter'){
      w.x-=2;w.alpha=Math.min(1,w.alpha+0.02);
      if(w.x<=w.homeX){w.x=w.homeX;w.y=w.homeY;w.state='idle';w.timer=0;}
    } else if(w.state==='idle'){
      // Float gently at home position
      w.x+=(w.homeX-w.x)*0.05;
      w.y=w.homeY+Math.sin(w.fr*0.4)*8;
      if(w.timer>=70){
        // 55% rush (dash at player), 45% cast (shoot)
        if(Math.random()<0.55){
          w.state='rush';w.timer=0;w.rushT=0;w.rushReady=false;
          // Save home and target player's current position
          w.rushTargetX=player.x;
          w.rushTargetY=player.y;
          w.rushDir=player.gDir;
        } else {
          w.state='cast';w.timer=0;w.castType=Math.floor(Math.random()*2);w.castT=0;
        }
      }
    } else if(w.state==='rush'){
      // Dash from home toward player position, then return
      w.rushT++;
      const warnT=12;  // brief telegraph
      const dashT=10;   // fast dash to player position
      const stayT=30;   // pause at target (vulnerable)
      const retT=20;    // return to home
      if(w.rushT<=warnT){
        // Telegraph: shake and glow, stay at home
        w.x=w.homeX+(Math.random()-0.5)*3;
        w.y=w.homeY+Math.sin(w.fr*0.4)*8+(Math.random()-0.5)*2;
        if(frame%3===0)parts.push({x:w.x,y:w.y,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,
          life:10,ml:10,sz:Math.random()*3+2,col:'#ff8844'});
      } else if(w.rushT<=warnT+dashT){
        // Fast dash toward player's position
        w.rushReady=true;
        const t=(w.rushT-warnT)/dashT;
        w.x=w.homeX+(w.rushTargetX-w.homeX)*t;
        w.y=w.homeY+(w.rushTargetY-w.homeY)*t;
        // Dash trail
        if(frame%2===0)parts.push({x:w.x+(Math.random()-0.5)*w.sz,y:w.y+(Math.random()-0.5)*w.sz,
          vx:(w.homeX-w.rushTargetX)*0.03,vy:(w.homeY-w.rushTargetY)*0.03,
          life:12,ml:12,sz:Math.random()*4+2,col:'#ff8844'});
      } else if(w.rushT<=warnT+dashT+stayT){
        // Hovering at target position - VULNERABLE to stomping
        w.rushReady=true;
        w.x=w.rushTargetX+Math.sin(w.fr*2)*2;
        w.y=w.rushTargetY+Math.sin(w.fr*1.5)*2;
      } else if(w.rushT<=warnT+dashT+stayT+retT){
        // Return to home
        w.rushReady=false;
        const t=(w.rushT-warnT-dashT-stayT)/retT;
        w.x=w.rushTargetX+(w.homeX-w.rushTargetX)*t;
        w.y=w.rushTargetY+(w.homeY-w.rushTargetY)*t;
      } else {
        // Back at home, switch to idle
        w.rushReady=false;
        w.x=w.homeX;w.y=w.homeY;
        w.state='idle';w.timer=0;
      }
    } else if(w.state==='cast'){
      // Casting animation - NOT stompable (only rush is)
      w.castT++;
      w.y+=Math.sin(w.fr)*0.3;
      if(w.castT===30){
        if(w.castType===0){
          for(let i=0;i<8;i++){
            const a=i*Math.PI/4;
            bullets.push({x:w.x,y:w.y,vx:Math.cos(a)*3,vy:Math.sin(a)*3,sz:5,life:999,wizBullet:true});
          }
        } else {
          for(let i=-1;i<=1;i++){
            const dx=player.x-w.x,dy=player.y-w.y;
            const d=Math.sqrt(dx*dx+dy*dy)||1;
            const spd=3.5;
            const spread=i*0.3;
            bullets.push({x:w.x,y:w.y,vx:dx/d*spd+Math.cos(Math.atan2(dy,dx)+Math.PI/2)*spread*spd,
              vy:dy/d*spd+Math.sin(Math.atan2(dy,dx)+Math.PI/2)*spread*spd,sz:6,life:999,wizBullet:true});
          }
        }
        sfx('shoot');
      }
      if(w.castT>=50){w.state='teleport';w.timer=0;w.teleportT=0;
        // Return to home area (with slight variation)
        w.homeX=W*0.4+Math.random()*W*0.35;
        w.homeY=GROUND_H+50+Math.random()*(H-GROUND_H*2-100);
        w.teleportTarget={x:w.homeX,y:w.homeY};
      }
    } else if(w.state==='teleport'){
      w.teleportT++;
      w.alpha=Math.max(0,1-w.teleportT/15);
      if(w.teleportT>=15){
        w.x=w.teleportTarget.x;w.y=w.teleportTarget.y;
        w.state='appear';w.timer=0;w.teleportT=0;
      }
    } else if(w.state==='appear'){
      w.teleportT++;
      w.alpha=Math.min(1,w.teleportT/15);
      if(w.teleportT>=15){w.state='idle';w.timer=0;}
    }
    // Collision (skip during invincible or teleporting)
    if(w.invT<=0&&w.alpha>0.5){
      const dx=player.x-w.x,dy=player.y-w.y;
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<pr+w.sz){
        if(itemEff.invincible>0){
          w.hp--;w.hurtFlash=20;
          shakeI=8;sfx('bossHit');emitParts(w.x,w.y,15,'#ff00ff',4,3);
          if(w.hp<=0){bossWizardDefeat(w);}
          else{w.invT=60;w.state='teleport';w.timer=0;w.teleportT=0;
            w.homeX=W*0.4+Math.random()*W*0.35;w.homeY=GROUND_H+50+Math.random()*(H-GROUND_H*2-100);
            w.teleportTarget={x:w.homeX,y:w.homeY};}
        } else {
          // Stomp: during rush state when rushReady (at or near target), player above/below wizard
          const stomped=w.state==='rush'&&w.rushReady&&(
            (player.y+pr<w.y-w.sz*0.15&&player.vy>=0)||
            (player.y-pr>w.y+w.sz*0.15&&player.vy<=0)
          );
          if(stomped){
            w.hp--;w.hurtFlash=20;
            player.vy=-JUMP_POWER*0.8*player.gDir;player.grounded=false;
            flipCount=0;player.canFlip=true;djumpUsed=false;djumpAvailable=true;
            shakeI=12;sfx('gstomp');vibrate([20,10,30]);
            addPop(w.x,w.y-20,'撃破!','#ffd700');
            emitParts(w.x,w.y,12,'#aa44ff',5,3);
            if(w.hp<=0){bossWizardDefeat(w);}
            else{w.invT=60;w.state='teleport';w.timer=0;w.teleportT=0;
              w.homeX=W*0.4+Math.random()*W*0.35;w.homeY=GROUND_H+50+Math.random()*(H-GROUND_H*2-100);
              w.teleportTarget={x:w.homeX,y:w.homeY};}
          } else {
            hurt();
          }
        }
      }
    }
  }

  // Check victory
  bossPhase.defeated=0;
  for(let i=0;i<bossPhase.enemies.length;i++){
    if(!bossPhase.enemies[i].alive)bossPhase.defeated++;
  }
  const bruiserDone=!bossPhase.bruiser||!bossPhase.bruiser.alive;
  const wizardDone=!bossPhase.wizard||!bossPhase.wizard.alive;
  // Dodge done: all enemies must be KILLED (dodgeKills>=total), not just dodged
  const dodgeDone=bossPhase.bossType!=='dodge'||(bossPhase.dodgeKills>=bossPhase.total&&
    enemies.filter(e=>e.bossType==='dodge'&&e.alive).length===0);
  const allDone=chargesCleared&&dodgeDone&&bruiserDone&&wizardDone;
  if(allDone&&bossPhase.enemies.length>0&&!bossPhase.reward){
    bossPhase.reward=true;bossPhase.rewardT=0;
    // Catch up score that accumulated during boss
    score=Math.floor(dist);lastMile=Math.floor(score/1000)*1000;
    sfxFanfare();shakeI=10;vibrate([30,20,30,20,60]);
    addPop(W/2,H*0.3,'BOSS DEFEATED!','#ffd700');
    // No-damage bonus: earn stockable invincibility
    if(bossPhase.noDamage){invCount++;addPop(W/2,H*0.55,'\u7121\u6575+1! (No Damage!)','#ff00ff');}
    if(hp<maxHp()){hp++;addPop(player.x,player.y-40,'HP +1','#ff3860');}
    const bonus=30+bossPhase.total*5;
    walletCoins+=bonus;localStorage.setItem('gd5wallet',walletCoins.toString());
    totalCoins+=bonus;
    addPop(W/2,H*0.45,'+'+bonus+' COINS!','#ffd700');
    for(let i=0;i<40;i++)parts.push({x:W*Math.random(),y:-10,vx:(Math.random()-0.5)*4,vy:1+Math.random()*4,life:80+Math.random()*40,ml:120,sz:Math.random()*5+3,col:['#ffd700','#ffaa00','#fff4b0'][i%3]});
    // Spawn treasure chest falling from above
    bossChests++;
    chestFall={active:true,x:player.x,y:-40,vy:0,sparkT:0,gotT:0};
  }
}
// Rich bruiser defeat animation
function bossBruiserDefeat(b){
  b.alive=false;
  shakeI=22;vibrate([40,20,60,30,100]);
  // Armor pieces explosion
  const cols=['#7a3a8a','#5a2a6a','#8a4a9a','#c0d0e0','#ff0040','#ff00ff'];
  for(let i=0;i<35;i++){
    const a=(6.28/35)*i,s=3+Math.random()*7;
    parts.push({x:b.x+(Math.random()-0.5)*b.sz,y:b.y+(Math.random()-0.5)*b.sz,
      vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,life:60+Math.random()*40,ml:100,
      sz:Math.random()*8+3,col:cols[i%cols.length]});
  }
  // Core energy burst
  for(let i=0;i<20;i++){
    const a=Math.random()*6.28,s=1+Math.random()*5;
    parts.push({x:b.x,y:b.y-b.sz*0.15,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
      life:35+Math.random()*25,ml:60,sz:Math.random()*6+2,col:'#ff00ff'});
  }
  // Upward sparks
  for(let i=0;i<15;i++){
    parts.push({x:b.x+(Math.random()-0.5)*b.sz*0.8,y:b.y-b.sz*0.5,
      vx:(Math.random()-0.5)*2,vy:-3-Math.random()*5,life:40+Math.random()*30,ml:70,
      sz:Math.random()*4+1,col:'#ffd700'});
  }
  addPop(b.x,b.y-b.sz-20,'\u6483\u7834\uFF01','#ffd700');
  sfx('death');
}
function bossWizardDefeat(w){
  w.alive=false;
  shakeI=18;vibrate([40,20,60,30,100]);
  const cols=['#aa44ff','#6622cc','#ff44ff','#4488ff','#ffd700'];
  for(let i=0;i<30;i++){
    const a=(6.28/30)*i,s=2+Math.random()*6;
    parts.push({x:w.x+(Math.random()-0.5)*w.sz,y:w.y+(Math.random()-0.5)*w.sz,
      vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,life:50+Math.random()*40,ml:90,
      sz:Math.random()*7+2,col:cols[i%cols.length]});
  }
  for(let i=0;i<12;i++){
    parts.push({x:w.x,y:w.y,vx:(Math.random()-0.5)*3,vy:-2-Math.random()*4,
      life:35+Math.random()*25,ml:60,sz:Math.random()*5+2,col:'#ffd700'});
  }
  addPop(w.x,w.y-w.sz-20,'\u6483\u7834\uFF01','#ffd700');
  sfx('death');
}
// === Boss enemy draw: wizard type ===
function drawBossWizard(en){
  const s=en.sz,t=en.fr;
  const dmg=en.maxHp-en.hp;
  ctx.save();ctx.translate(en.x,en.y);
  ctx.globalAlpha=en.alpha||1;
  if(en.invT>0&&en.invT%6<3)ctx.globalAlpha*=0.25;
  if(en.hurtFlash>0&&en.hurtFlash%4<2)ctx.globalAlpha*=0.5;
  // Rush state: directional trail effect toward target
  if(en.state==='rush'){
    const rushAlpha=en.rushReady?(.3+Math.sin(t*3)*.15):(.1+Math.sin(t*3)*.05);
    // Draw beam from wizard toward rush target
    const dx=en.rushTargetX-en.homeX,dy=en.rushTargetY-en.homeY;
    const dist=Math.sqrt(dx*dx+dy*dy)||1;
    ctx.save();
    ctx.rotate(Math.atan2(dy,dx));
    ctx.fillStyle='rgba(255,140,40,'+rushAlpha+')';
    ctx.fillRect(-dist*0.5,-s*0.12,dist,s*0.24);
    ctx.fillStyle='rgba(255,200,80,'+rushAlpha*0.5+')';
    ctx.fillRect(-dist*0.5,-s*0.25,dist,s*0.5);
    ctx.restore();
  }
  // Floating shadow
  ctx.fillStyle='rgba(0,0,0,0.2)';
  ctx.beginPath();ctx.ellipse(0,s*1.2,s*0.6,s*0.12,0,0,6.28);ctx.fill();
  // Robe body (dark purple with flowing bottom, orange during rush)
  const robeGr=ctx.createLinearGradient(0,-s,0,s);
  if(en.state==='rush'){
    robeGr.addColorStop(0,'#8a4a1a');robeGr.addColorStop(1,'#5a2a0a');
  } else {
    robeGr.addColorStop(0,dmg>=2?'#2a0a3a':'#4a1a6a');
    robeGr.addColorStop(1,dmg>=2?'#1a0520':'#2a0a40');
  }
  ctx.fillStyle=robeGr;
  ctx.beginPath();
  ctx.moveTo(-s*0.6,-s*0.3);
  ctx.quadraticCurveTo(-s*0.8,-s*0.8,0,-s);
  ctx.quadraticCurveTo(s*0.8,-s*0.8,s*0.6,-s*0.3);
  ctx.lineTo(s*0.7+Math.sin(t*0.5)*s*0.1,s*0.8);
  ctx.quadraticCurveTo(s*0.3,s*0.6+Math.sin(t*0.7)*s*0.1,0,s*0.9+Math.sin(t*0.6)*s*0.08);
  ctx.quadraticCurveTo(-s*0.3,s*0.6-Math.sin(t*0.7)*s*0.1,-s*0.7-Math.sin(t*0.5)*s*0.1,s*0.8);
  ctx.closePath();ctx.fill();
  // Hat/hood point
  ctx.fillStyle=dmg>=2?'#3a1050':'#5a2a8a';
  ctx.beginPath();
  ctx.moveTo(-s*0.3,-s*0.85);ctx.lineTo(0,-s*1.5-Math.sin(t*0.4)*s*0.1);ctx.lineTo(s*0.3,-s*0.85);
  ctx.closePath();ctx.fill();
  // Star on hat
  ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd700';ctx.shadowBlur=6;
  ctx.font=(s*0.3)+'px monospace';ctx.textAlign='center';
  ctx.fillText('\u2605',0,-s*1.1);ctx.shadowBlur=0;
  // Glowing eyes
  ctx.fillStyle='#ff44ff';ctx.shadowColor='#ff44ff';ctx.shadowBlur=8;
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.45,s*0.12,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.2,-s*0.45,s*0.12,0,6.28);ctx.fill();
  ctx.shadowBlur=0;
  // Staff/wand (glows during cast)
  ctx.strokeStyle=en.state==='cast'?'#ffd700':'#8844aa';
  ctx.lineWidth=s*0.08;
  ctx.beginPath();ctx.moveTo(s*0.5,-s*0.2);ctx.lineTo(s*0.8,s*0.7);ctx.stroke();
  // Staff orb
  const orbGlow=en.state==='cast'?0.8+Math.sin(t*2)*0.2:0.3;
  ctx.fillStyle=`rgba(170,68,255,${orbGlow})`;ctx.shadowColor='#aa44ff';ctx.shadowBlur=en.state==='cast'?15:5;
  ctx.beginPath();ctx.arc(s*0.5,-s*0.25,s*0.12,0,6.28);ctx.fill();ctx.shadowBlur=0;
  // Rush indicator: "!" mark and orange glow ring when vulnerable
  if(en.state==='rush'){
    const pulse=0.6+Math.sin(t*4)*0.4;
    ctx.strokeStyle='rgba(255,180,60,'+pulse*0.6+')';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(0,0,s*1.3+Math.sin(t*3)*s*0.15,0,6.28);ctx.stroke();
    if(en.rushReady){
      ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd700';ctx.shadowBlur=12;
      ctx.font='bold '+(s*0.8)+'px monospace';ctx.textAlign='center';
      ctx.fillText('!',0,-s*1.6-Math.sin(t*4)*3);
      ctx.shadowBlur=0;
    }
    // Arrow pointing toward dash target
    const adx=en.rushTargetX-en.homeX,ady=en.rushTargetY-en.homeY;
    const aAng=Math.atan2(ady,adx);
    ctx.save();ctx.rotate(aAng);
    ctx.fillStyle='rgba(255,140,40,'+pulse+')';
    ctx.beginPath();
    ctx.moveTo(s*0.8,-s*0.3);ctx.lineTo(s*1.4,0);ctx.lineTo(s*0.8,s*0.3);
    ctx.closePath();ctx.fill();
    ctx.restore();
  }
  // Casting circle (only during cast state)
  if(en.state==='cast'){
    ctx.strokeStyle='rgba(170,68,255,'+0.4*Math.abs(Math.sin(t))+')';
    ctx.lineWidth=1.5;
    const cr=s*1.5+Math.sin(t*2)*s*0.2;
    ctx.beginPath();ctx.arc(0,0,cr,0,6.28);ctx.stroke();
    // Rotating runes
    for(let i=0;i<4;i++){
      const ra=t*0.5+i*Math.PI/2;
      ctx.fillStyle='rgba(255,200,255,0.5)';ctx.font=(s*0.2)+'px monospace';
      ctx.fillText('\u2726',Math.cos(ra)*cr,Math.sin(ra)*cr);
    }
  }
  // Damage cracks
  if(dmg>=1){
    ctx.strokeStyle='rgba(255,100,255,0.4)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(-s*0.2,0);ctx.lineTo(s*0.1,s*0.3);ctx.stroke();
  }
  if(dmg>=2){
    ctx.strokeStyle='rgba(255,100,100,0.5)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(s*0.1,-s*0.3);ctx.lineTo(-s*0.1,s*0.1);ctx.lineTo(s*0.2,s*0.4);ctx.stroke();
  }
  ctx.globalAlpha=1;
  ctx.restore();
}
// === Boss enemy draw: charge type (also used for dodge type) ===
function drawBossCharge(en){
  const s=en.sz,flip=en.gDir;
  const isDodge=en.bossType==='dodge';
  ctx.save();ctx.translate(en.x,en.y);
  if(flip===-1)ctx.scale(1,-1);
  // Armored rhino shape - dark metallic (dodge: orange tint)
  const gr=ctx.createRadialGradient(-s*0.1,0,s*0.1,-s*0.1,0,s);
  if(isDodge){
    gr.addColorStop(0,'#8a6a4a');gr.addColorStop(0.6,'#5a4a3a');gr.addColorStop(1,'#3a2a1a');
  } else {
    gr.addColorStop(0,'#6a7a8a');gr.addColorStop(0.6,'#3a4a5a');gr.addColorStop(1,'#1a2a3a');
  }
  ctx.fillStyle=gr;
  // Main body (angular armored shape)
  ctx.beginPath();
  ctx.moveTo(-s*0.9,-s*0.5);ctx.lineTo(-s*0.3,-s*0.8);ctx.lineTo(s*0.4,-s*0.7);
  ctx.lineTo(s*0.8,-s*0.3);ctx.lineTo(s*0.9,s*0.1);ctx.lineTo(s*0.6,s*0.6);
  ctx.lineTo(-s*0.2,s*0.7);ctx.lineTo(-s*0.8,s*0.5);ctx.lineTo(-s*1.0,0);
  ctx.closePath();ctx.fill();
  // Horn/spike
  ctx.fillStyle='#c0d0e0';
  ctx.beginPath();ctx.moveTo(-s*1.0,-s*0.1);ctx.lineTo(-s*1.5,0);ctx.lineTo(-s*1.0,s*0.1);ctx.closePath();ctx.fill();
  // Armor plates (chevron lines)
  ctx.strokeStyle='#8090a0';ctx.lineWidth=Math.max(1.5,s*0.04);
  ctx.beginPath();ctx.moveTo(-s*0.2,-s*0.6);ctx.lineTo(s*0.1,-s*0.2);ctx.lineTo(-s*0.2,s*0.2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(s*0.2,-s*0.5);ctx.lineTo(s*0.5,-s*0.1);ctx.lineTo(s*0.2,s*0.3);ctx.stroke();
  // Second armor layer (visible at larger sizes)
  if(s>40){
    ctx.strokeStyle='#6a7a8a';ctx.lineWidth=s*0.02;
    ctx.beginPath();ctx.moveTo(-s*0.5,-s*0.4);ctx.lineTo(-s*0.1,0);ctx.lineTo(-s*0.5,s*0.4);ctx.stroke();
    ctx.beginPath();ctx.moveTo(s*0.5,-s*0.35);ctx.lineTo(s*0.7,0);ctx.lineTo(s*0.5,s*0.35);ctx.stroke();
    // Extra spikes
    ctx.fillStyle='#c0d0e0';
    ctx.beginPath();ctx.moveTo(-s*0.3,-s*0.8);ctx.lineTo(-s*0.4,-s*1.0);ctx.lineTo(-s*0.2,-s*0.75);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(s*0.4,-s*0.7);ctx.lineTo(s*0.5,-s*0.95);ctx.lineTo(s*0.3,-s*0.65);ctx.closePath();ctx.fill();
  }
  // Glowing red eye
  ctx.fillStyle='#ff0000';ctx.shadowColor='#ff0000';ctx.shadowBlur=Math.max(8,s*0.15);
  ctx.beginPath();ctx.arc(-s*0.5,-s*0.2,s*0.12,0,6.28);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-s*0.52,-s*0.22,s*0.04,0,6.28);ctx.fill();
  ctx.shadowBlur=0;
  // Speed lines when rushing
  ctx.strokeStyle='rgba(255,100,100,0.4)';ctx.lineWidth=Math.max(1,s*0.03);
  const lineCount=s>40?5:3;
  for(let i=0;i<lineCount;i++){
    const ly=-s*0.4+i*s*0.8/lineCount;
    ctx.beginPath();ctx.moveTo(s*0.5,ly);ctx.lineTo(s*1.2+Math.random()*s*0.5,ly);ctx.stroke();
  }
  // Exhaust particles from back
  ctx.fillStyle='rgba(255,80,40,0.3)';
  const exhaustCount=s>40?4:2;
  for(let i=0;i<exhaustCount;i++){
    const px=s*0.7+Math.random()*s*0.4,py=(Math.random()-0.5)*s*0.5;
    ctx.beginPath();ctx.arc(px,py,s*0.1+Math.random()*s*0.1,0,6.28);ctx.fill();
  }
  ctx.restore();
}
// === Boss enemy draw: bruiser type (multi-stomp) ===
function drawBossBruiser(en){
  const s=en.sz,t=en.fr;
  const dmg=en.maxHp-en.hp; // damage level: 0=fresh, 1=cracked, 2+=broken
  ctx.save();ctx.translate(en.x,en.y);
  if(en.gDir===-1)ctx.scale(1,-1);
  // Hurt flash / invincible blink
  if(en.invT>0&&en.invT%6<3){ctx.globalAlpha=0.25;}
  else if(en.hurtFlash>0&&en.hurtFlash%4<2){ctx.globalAlpha=0.5;}
  // Shadow on ground
  ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse(0,s*0.9,s*0.8,s*0.15,0,0,6.28);ctx.fill();
  // Legs (animated) - limp when damaged
  const legSpeed=dmg>=2?0.8:1.5;
  const legPhase=Math.sin(t*legSpeed)*s*0.12;
  ctx.fillStyle=dmg>=2?'#1a1020':'#2a1a3a';
  ctx.fillRect(-s*0.5+legPhase,s*0.3,s*0.25,s*0.6);
  ctx.fillRect(s*0.25-legPhase,s*0.3,s*0.25,s*0.6);
  // Armored boots (cracked when damaged)
  ctx.fillStyle=dmg>=1?'#3a2040':'#5a3a6a';
  ctx.fillRect(-s*0.55+legPhase,s*0.7,s*0.35,s*0.2);
  ctx.fillRect(s*0.2-legPhase,s*0.7,s*0.35,s*0.2);
  // Main body (large armored torso)
  const bodyGr=ctx.createRadialGradient(0,-s*0.1,s*0.1,0,-s*0.1,s*0.9);
  if(dmg>=2){bodyGr.addColorStop(0,'#4a1a3a');bodyGr.addColorStop(0.5,'#2a0a2a');bodyGr.addColorStop(1,'#1a0518');}
  else if(dmg>=1){bodyGr.addColorStop(0,'#5a2a5a');bodyGr.addColorStop(0.5,'#3a1040');bodyGr.addColorStop(1,'#200828');}
  else{bodyGr.addColorStop(0,'#7a3a8a');bodyGr.addColorStop(0.5,'#4a1a5a');bodyGr.addColorStop(1,'#2a0a3a');}
  ctx.fillStyle=bodyGr;
  ctx.beginPath();
  ctx.moveTo(-s*0.7,-s*0.6);ctx.quadraticCurveTo(-s*0.9,-s*0.1,-s*0.7,s*0.4);
  ctx.lineTo(s*0.7,s*0.4);ctx.quadraticCurveTo(s*0.9,-s*0.1,s*0.7,-s*0.6);
  ctx.quadraticCurveTo(0,-s*0.8,-s*0.7,-s*0.6);
  ctx.closePath();ctx.fill();
  // Cracks overlay based on damage
  if(dmg>=1){
    ctx.strokeStyle='rgba(200,100,255,0.5)';ctx.lineWidth=1.5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-s*0.3,-s*0.5);ctx.lineTo(-s*0.1,-s*0.2);ctx.lineTo(-s*0.25,s*0.1);ctx.stroke();
    ctx.beginPath();ctx.moveTo(s*0.2,-s*0.4);ctx.lineTo(s*0.35,-s*0.1);ctx.stroke();
  }
  if(dmg>=2){
    ctx.strokeStyle='rgba(255,50,100,0.6)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-s*0.5,-s*0.3);ctx.lineTo(-s*0.2,0);ctx.lineTo(-s*0.4,s*0.3);ctx.stroke();
    ctx.beginPath();ctx.moveTo(s*0.1,-s*0.55);ctx.lineTo(s*0.3,-s*0.2);ctx.lineTo(s*0.5,s*0.1);ctx.stroke();
    // Exposed inner glow through cracks
    ctx.fillStyle='rgba(255,0,128,0.15)';
    ctx.beginPath();ctx.arc(-s*0.2,-s*0.1,s*0.15,0,6.28);ctx.fill();
    ctx.beginPath();ctx.arc(s*0.3,-s*0.2,s*0.1,0,6.28);ctx.fill();
    // Sparks from damage
    if(Math.random()<0.3){
      const spx=(Math.random()-0.5)*s*0.8,spy=-s*0.3+Math.random()*s*0.5;
      ctx.fillStyle='#ff00ff';ctx.beginPath();ctx.arc(spx,spy,s*0.04+Math.random()*s*0.03,0,6.28);ctx.fill();
    }
  }
  // Chest armor plate (breaks progressively)
  if(dmg<2){
    ctx.fillStyle=dmg>=1?'#4a1a4a':'#6a2a7a';
    ctx.beginPath();
    ctx.moveTo(-s*0.4,-s*0.5);ctx.lineTo(0,-s*0.65);ctx.lineTo(s*0.4,-s*0.5);
    ctx.lineTo(s*0.35,s*0.15);ctx.lineTo(0,s*0.25);ctx.lineTo(-s*0.35,s*0.15);
    ctx.closePath();ctx.fill();
  } else {
    // Broken chest plate - only fragments remain
    ctx.fillStyle='#3a1030';
    ctx.beginPath();ctx.moveTo(-s*0.3,-s*0.45);ctx.lineTo(-s*0.1,-s*0.55);ctx.lineTo(s*0.1,-s*0.4);ctx.lineTo(-s*0.2,s*0.05);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(s*0.15,-s*0.45);ctx.lineTo(s*0.35,-s*0.35);ctx.lineTo(s*0.25,s*0.1);ctx.lineTo(s*0.05,-s*0.1);ctx.closePath();ctx.fill();
  }
  // Glowing core (shows HP, flickers more when damaged)
  const hpRatio=en.hp/en.maxHp;
  const coreCol=hpRatio>0.6?'#ff00ff':hpRatio>0.3?'#ff6600':'#ff0000';
  const coreFlicker=dmg>=2?0.5+Math.sin(t*3)*0.5:1;
  const baseAlpha=en.invT>0&&en.invT%6<3?0.25:en.hurtFlash>0&&en.hurtFlash%4<2?0.5:1;
  ctx.globalAlpha=coreFlicker*baseAlpha;
  ctx.fillStyle=coreCol;ctx.shadowColor=coreCol;ctx.shadowBlur=dmg>=2?25:15;
  ctx.beginPath();ctx.arc(0,-s*0.15,s*(dmg>=2?0.22:0.18),0,6.28);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-s*0.05,-s*0.18,s*0.06,0,6.28);ctx.fill();
  ctx.shadowBlur=0;
  ctx.globalAlpha=baseAlpha;
  // Shoulder pauldrons (one breaks off at dmg>=2)
  ctx.fillStyle=dmg>=1?'#5a2a5a':'#8a4a9a';
  ctx.beginPath();ctx.arc(-s*0.65,-s*0.35,s*0.22,0,6.28);ctx.fill();
  if(dmg<2){
    ctx.beginPath();ctx.arc(s*0.65,-s*0.35,s*0.22,0,6.28);ctx.fill();
  } else {
    // Broken right pauldron - small remnant
    ctx.fillStyle='#3a1530';
    ctx.beginPath();ctx.arc(s*0.65,-s*0.35,s*0.12,0,6.28);ctx.fill();
  }
  // Spikes on pauldrons (break with damage)
  ctx.fillStyle='#c0d0e0';
  if(dmg<1){
    [-1,1].forEach(side=>{
      const sx=side*s*0.65;
      ctx.beginPath();ctx.moveTo(sx,-s*0.55);ctx.lineTo(sx+side*s*0.15,-s*0.8);ctx.lineTo(sx+side*s*0.05,-s*0.5);ctx.closePath();ctx.fill();
    });
  } else {
    // Left spike only (right broken)
    const sx=-s*0.65;
    ctx.beginPath();ctx.moveTo(sx,-s*0.55);ctx.lineTo(sx-s*0.1,-s*0.7);ctx.lineTo(sx-s*0.05,-s*0.5);ctx.closePath();ctx.fill();
  }
  // Head (helmet) - cracks when damaged
  const headGr=ctx.createRadialGradient(0,-s*0.7,s*0.05,0,-s*0.7,s*0.3);
  if(dmg>=2){headGr.addColorStop(0,'#3a1030');headGr.addColorStop(1,'#200518');}
  else{headGr.addColorStop(0,'#5a2a6a');headGr.addColorStop(1,'#3a0a4a');}
  ctx.fillStyle=headGr;
  ctx.beginPath();ctx.arc(0,-s*0.7,s*0.28,0,6.28);ctx.fill();
  // Helmet crest (breaks at dmg>=2)
  if(dmg<2){
    ctx.fillStyle='#9a5aaa';
    ctx.beginPath();ctx.moveTo(0,-s*1.05);ctx.lineTo(-s*0.08,-s*0.75);ctx.lineTo(s*0.08,-s*0.75);ctx.closePath();ctx.fill();
  } else {
    ctx.fillStyle='#5a2a4a';
    ctx.beginPath();ctx.moveTo(0,-s*0.92);ctx.lineTo(-s*0.06,-s*0.78);ctx.lineTo(s*0.04,-s*0.78);ctx.closePath();ctx.fill();
  }
  // Helmet cracks
  if(dmg>=1){
    ctx.strokeStyle='rgba(200,80,150,0.5)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(-s*0.15,-s*0.85);ctx.lineTo(s*0.05,-s*0.65);ctx.stroke();
  }
  // Eyes (glowing slits) - one eye out at high damage
  ctx.fillStyle='#ff0040';ctx.shadowColor='#ff0040';ctx.shadowBlur=6;
  ctx.fillRect(-s*0.2,-s*0.75,s*0.14,s*0.06);
  if(dmg<2){
    ctx.fillRect(s*0.06,-s*0.75,s*0.14,s*0.06);
  } else {
    // Right eye flickering/out
    ctx.globalAlpha=baseAlpha*0.3;
    ctx.fillRect(s*0.06,-s*0.75,s*0.14,s*0.06);
    ctx.globalAlpha=baseAlpha;
  }
  ctx.shadowBlur=0;
  // Invincible shield effect
  if(en.invT>0){
    ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.globalAlpha=0.3+Math.sin(en.fr*2)*0.2;
    ctx.beginPath();ctx.arc(0,-s*0.2,s*0.9,0,6.28);ctx.stroke();
    ctx.globalAlpha=baseAlpha;
  }
  // Stunned stars
  if(en.state==='invincible'||en.state==='stunned'){
    for(let i=0;i<3;i++){
      const sa=t*2+i*2.09;
      const sx=Math.cos(sa)*s*0.5,sy=-s*1.1+Math.sin(sa*1.5)*s*0.1;
      ctx.fillStyle='#ffd700';ctx.font=`${s*0.3}px monospace`;ctx.textAlign='center';
      ctx.fillText('\u2605',sx,sy);
    }
  }
  // HP bar above head
  const barW=s*1.2,barH=5,barX=-barW/2,barY2=-s*1.2;
  ctx.fillStyle='#333';ctx.fillRect(barX,barY2,barW,barH);
  ctx.fillStyle=coreCol;ctx.fillRect(barX,barY2,barW*hpRatio,barH);
  ctx.strokeStyle='#fff4';ctx.lineWidth=1;ctx.strokeRect(barX,barY2,barW,barH);
  // Damage indicator text
  if(dmg>0){
    ctx.fillStyle='#ff6666';ctx.font=`bold ${s*0.25}px monospace`;ctx.textAlign='center';
    ctx.fillText('\u00D7'+dmg,barW/2+s*0.2,barY2+4);
  }
  ctx.globalAlpha=1;
  ctx.restore();
}

function addPop(x,y,txt,col){pops.push({x,y,txt,col,life:45,ml:45});}