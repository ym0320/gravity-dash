'use strict';
// Reusable array to avoid GC pressure from filter() in boss update loop
const _tmpBoss=[];
// ===== BOSS PHASE =====
function startBossPhase(){
  bossPhase.active=true;
  bossPhase.prepare=120;
  bossPhase.alertT=0;
  bossPhase.hintT=0;
  bossPhase.noDamage=true; // track if player takes no damage during boss
  bossPhase.bossType=''; // track boss type for victory check
  bossPhase.enemies=[];
  bossPhase.defeated=0;
  bossPhase.reward=false;
  bossPhase.rewardT=0;
  bossPhase.bruiser=null; // the multi-stomp boss
  bossPhase.wizard=null; // the teleporting wizard boss
  bossPhase.guardian=null; // the shockwave knight boss
  bossPhase.dodgeQueue=[]; // queue of dodge enemies
  bossPhase.dodgeIdx=0;
  bossPhase.dodgeKills=0;
  enemies=[];bullets=[];
  // Keep invincibility active during boss (don't cancel it)
  bossPhase.bossCount++;
  bossPhase.lastBossScore=score;
  bossPhase.lastBossRawDist=rawDist;
  bossPhase.nextAt=(Math.floor(rawDist/BOSS_INTERVAL)+1)*BOSS_INTERVAL;
  // Pre-determine boss type for display during warning screen
  const _allTypes=['wizard','bruiser','guardian','dodge'];
  const _pickType=()=>_allTypes[Math.floor(Math.random()*4)];
  if(isChallengeMode){
    // Queue-based boss selection
    if(challQueueIdx>=challBossQueue.length) extendChallBossQueue();
    const wave=challBossQueue[challQueueIdx];
    bossPhase.bossType=wave.type;
    bossPhase.bossType2=wave.type2;
    bossPhase.challStrength=wave.strength;
    bossPhase.challIsDual=wave.isDual;
    challQueueIdx++;
  } else if(isPackMode&&currentPackStage&&currentPackStage.boss){
    if(currentPackStage.bossVariant==='snowman') bossPhase.bossType='wizard';
    else bossPhase.bossType=Math.random()<0.5?'bruiser':'guardian';
  } else {
    bossPhase.bossType=_pickType();
  }
  shakeI=18;vibrate([50,30,50,30,80,40,100]);
  if(isChallengeMode){sfxChallengeBossAlert();switchBGM('challenge');}
  else{sfxBossAlert();switchBGM('boss');}
}
function spawnBossEnemies(){
  const bc=bossPhase.bossCount; // 1-based count of boss fights
  const floorY=H-GROUND_H;
  const ceilY=GROUND_H;
  bossPhase.bruiser=null;
  bossPhase.wizard=null;
  bossPhase.guardian=null;
  bossPhase.dodgeQueue=[];
  bossPhase.dodgeIdx=0;
  bossPhase.dodgeKills=0;
  // Scaling: each boss fight gets progressively stronger
  let effectiveBc=bc;
  let isDual=bc>=16; // dual bosses after 15 fights
  // Challenge mode: override from queue
  if(isChallengeMode){
    const str=bossPhase.challStrength||1;
    effectiveBc=str===1?1:str===2?6:11;
    isDual=!!bossPhase.challIsDual;
  }
  // Pre-calculate sizes for all boss types (needed for mixed dual)
  const bsz=(30+Math.min(effectiveBc-1,6)*2)*2;
  const gsz=(28+Math.min(effectiveBc-1,6)*2)*2;
  const wsz=24+Math.min(effectiveBc-1,8)*1.5;
  // Boss creation helpers
  function makeBruiser(bx,by,bgd,offsetFr){
    return {
      x:bx,y:by,vy:0,gDir:bgd,sz:bsz,alive:true,fr:offsetFr,
      type:11,shootT:999,boss:true,bossType:'bruiser',
      hp:3,maxHp:3,
      chargeVx:-(3.5+Math.min(effectiveBc-1,12)*0.3),retreatVx:2.5+Math.min(effectiveBc-1,10)*0.15,
      state:'enter',
      timer:0,stunT:0,hurtFlash:0,invT:0,feinted:false,
      flipEnabled:true,
      patrolDir:bgd,patrolOriginX:bgd===1?W*0.6:W*0.5,patrolRange:0
    };
  }
  function makeGuardian(gx,gy,gd,offsetFr){
    return {
      x:gx,y:gy,vy:0,gDir:gd,sz:gsz,alive:true,fr:offsetFr,
      type:13,shootT:999,boss:true,bossType:'guardian',
      hp:3,maxHp:3,
      chargeSpd:4.0+Math.min(effectiveBc-1,12)*0.3,
      retreatSpd:4+Math.min(effectiveBc-1,10)*0.25,
      state:'enter',
      timer:0,stunT:0,hurtFlash:0,invT:0,
      jumpVy:0,
      bigJumpBase:10+Math.min(effectiveBc-1,10)*0.6,
      bigJumpVariance:3+Math.min(effectiveBc-1,8)*0.4,
      jumpPrepBase:Math.max(2,12-Math.min(effectiveBc-1,8)*1.2),
      jumpPrepVariance:Math.max(2,10-Math.min(effectiveBc-1,8)*1.0),
      onCeiling:gd===-1,
      flipEnabled:true,
      quakeStunDuration:50+Math.min(effectiveBc-1,8)*6,
      quakeDuration:25+Math.min(effectiveBc-1,6)*2,
      quakeT:0,
      feintEnabled:false,feintCount:0,feintsDone:0,feintCooldown:0,
      swordSwingT:0,
      swordDuration:25+Math.min(effectiveBc-1,8)*2,
      swordReach:gsz*(1.2+Math.min(effectiveBc-1,8)*0.05),
      stunDuration:Math.max(25,55-Math.min(effectiveBc-1,8)*3.5),
      jumpCount:0
    };
  }
  function makeWizard(wx,wy,offsetFr){
    const isSnowman=isPackMode&&currentPackStage&&currentPackStage.bossVariant==='snowman';
    return {
      x:wx,y:wy,vy:0,gDir:1,sz:wsz,alive:true,fr:offsetFr,
      type:12,shootT:999,boss:true,bossType:'wizard',
      hp:1,maxHp:1,
      state:'enter',timer:0,hurtFlash:0,invT:0,
      castT:0,castType:0,
      teleportT:0,teleportTarget:{x:0,y:0},
      alpha:1,
      rushDir:1,rushT:0,rushReady:false,rushTargetX:0,rushTargetY:0,atkCount:0,
      homeX:W*0.65,homeY:H*0.35+Math.random()*(H*0.3),
      variant:isSnowman?'snowman':''
    };
  }
  function addDodgeQueue(delayOffset){
    const dodgeCount=10; // fixed at 10 for all levels
    const baseSpd=1.5+Math.min(bc-1,12)*0.3; // lv1=1.5, lv2=1.8, lv3=2.1...
    const baseInterval=Math.max(35,80-Math.min(bc-1,11)*5); // lv1=80, lv2=75, lv3=70...
    let lastFloor=Math.random()<0.5; // first one random, then strictly alternate
    for(let i=0;i<dodgeCount;i++){
      // All dodges in the same wave have identical speed
      const spd=baseSpd;
      // Strictly alternate floor/ceiling
      const onFloor=(i%2===0)?lastFloor:!lastFloor;
      const gDir=onFloor?1:-1;
      const sz=PLAYER_R*5;
      bossPhase.dodgeQueue.push({
        x:W+80,y:onFloor?floorY-sz:ceilY+sz,vy:0,gDir:gDir,sz:sz,alive:true,fr:Math.random()*100,
        type:10,shootT:999,boss:true,bossType:'dodge',
        chargeVx:-spd,diagStrength:0,chargeState:'wait',
        rushDelay:i===0?(delayOffset||0)+10:Math.round(baseInterval*(0.7+Math.random()*0.6)),
        timer:0,missCount:0
      });
    }
    return dodgeCount;
  }
  // Helper: spawn a boss of given type on given side
  function spawnBoss(type,gDir,xOff,frOff){
    if(type==='dodge'){
      return addDodgeQueue(frOff||0);
    } else if(type==='bruiser'){
      const b=makeBruiser(W+80+(xOff||0),gDir===1?floorY-bsz:ceilY+bsz,gDir,frOff||0);
      if(!bossPhase.bruiser)bossPhase.bruiser=b;
      bossPhase.enemies.push(b);
      return 1;
    } else if(type==='guardian'){
      const g=makeGuardian(W+90+(xOff||0),gDir===1?floorY-gsz:ceilY+gsz,gDir,frOff||0);
      if(!bossPhase.guardian)bossPhase.guardian=g;
      bossPhase.enemies.push(g);
      return 1;
    } else {
      const w=makeWizard(W+60+(xOff||0),gDir===1?(H*0.6+Math.random()*H*0.15):(H*0.25+Math.random()*H*0.15),frOff||0);
      if(!bossPhase.wizard)bossPhase.wizard=w;
      bossPhase.enemies.push(w);
      return 1;
    }
  }
  // Use pre-determined boss type from startBossPhase
  const bossType=bossPhase.bossType;
  // Spawn primary boss (floor side)
  bossPhase.total=spawnBoss(bossType,1,0,0);
  bossPhase.dodgeKills=0;
  // Dual boss spawning
  const packBoss=isPackMode&&currentPackStage&&currentPackStage.boss;
  if(isChallengeMode&&isDual){
    // Challenge mode: second boss from queue
    const type2=bossPhase.bossType2||bossType;
    bossPhase.total+=spawnBoss(type2,-1,40,50);
  } else if(isDual||packBoss){
    // Endless/Stage mode: second boss same type on ceiling
    if(bossType!=='dodge'){
      bossPhase.total+=spawnBoss(bossType,-1,40,50);
    }
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
      const bt=bossPhase.guardian?'guardian':bossPhase.bruiser?'bruiser':bossPhase.wizard?'wizard':'dodge';
      sfxBossRoar(bt);
      // Show boss instruction hint
      bossPhase.hintT=300; // display for ~5 seconds
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
    const rewardEnd=isChallengeMode?90:180;
    if(bossPhase.rewardT>=rewardEnd){
      bossPhase.active=false;bossPhase.reward=false;
      if(!isChallengeMode&&itemEff.invincible<=0)switchBGM('play');
    }
    return;
  }
  const floorY=H-GROUND_H;
  const ceilY=GROUND_H;
  const pr=PLAYER_R*ct().sizeMul;
  // Spawn dodge enemies (allow multiple per frame for tight intervals)
  while(bossPhase.dodgeIdx<bossPhase.dodgeQueue.length){
    const next=bossPhase.dodgeQueue[bossPhase.dodgeIdx];
    next.rushDelay--;
    if(next.rushDelay<=0){
      next.chargeState='rush';next.timer=0;
      enemies.push(next);
      bossPhase.enemies.push(next);
      bossPhase.dodgeIdx++;
      sfx('dodgeWhoosh');shakeI=4;
    } else break;
  }
  enemies.forEach(en=>{
    if(!en.alive||en.bossType!=='dodge')return;
    if(en.chargeState==='rush'){
      en.x+=en.chargeVx;
      en.timer++;
      // No homing - purely horizontal rush, speed only
      en.fr+=0.2;
      if(frame%2===0){
        if(parts.length<MAX_PARTS)parts.push({x:en.x+en.sz,y:en.y,vx:1+Math.random(),vy:(Math.random()-0.5)*2,life:12,ml:12,sz:Math.random()*4+2,col:'#ff8844'});
      }
      // Off-screen left: rush complete (dodged)
      if(en.x<-en.sz*2){
        en.alive=false;
        addPop(40,en.y,'回避!','#34d399');
        emitParts(10,en.y,6,'#34d399',3,2);
      }
      // Collision with player - ALL contact = damage (both sides have spikes)
      // Only way to clear is to dodge!
      // Use minimum hitbox radius of PLAYER_R so small characters still get hit
      const dodgePr=Math.max(pr,PLAYER_R);
      const dx=player.x-en.x,dy=player.y-en.y;
      if(dx*dx+dy*dy<(dodgePr+en.sz*BOSS_HITBOX_SCALE)*(dodgePr+en.sz*BOSS_HITBOX_SCALE)){
        if(itemEff.invincible>0){
          en.alive=false;bossPhase.dodgeKills++;
          emitParts(en.x,en.y,15,'#ff00ff',4,3);sfx('stomp');shakeI=4;
        } else {
          // Any contact = damage (spikes on both sides!)
          sfx('spikeHit');shakeI=6;vibrate([20,10,20]);
          hurt();
          emitParts(en.x,en.y,10,'#ff4444',4,2);
        }
      }
    }
  });
  // Decrement boss hint timer
  if(bossPhase.hintT>0)bossPhase.hintT--;
  // Phase B: bruiser logic (supports multiple bruisers)
  // Reuse static array to avoid GC pressure from filter() every frame
  _tmpBoss.length=0;
  for(let i=0;i<bossPhase.enemies.length;i++){const e=bossPhase.enemies[i];if(e.bossType==='bruiser'&&e.alive)_tmpBoss.push(e);}
  if(bossPhase.bruiser&&bossPhase.bruiser.alive&&_tmpBoss.indexOf(bossPhase.bruiser)<0){
    _tmpBoss.unshift(bossPhase.bruiser);
  }
  for(let bi=0;bi<_tmpBoss.length;bi++){const b=_tmpBoss[bi];
    const bc=bossPhase.bossCount;
    if(enemies.indexOf(b)<0){
      enemies.push(b);if(bossPhase.enemies.indexOf(b)<0)bossPhase.enemies.push(b);
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
      if(frame%2===0&&parts.length<MAX_PARTS)parts.push({x:b.x+b.sz,y:b.y,vx:2,vy:(Math.random()-0.5)*1.5,life:15,ml:15,sz:Math.random()*5+2,col:'#ff3860'});
      if(bc>=2&&b.timer>15&&b.timer<50&&!b.feinted&&Math.random()<0.003*Math.min(bc,12)){
        b.state='feint';b.feintT=25;b.timer=0;b.feinted=true;
      }
      if(b.x<W*0.15){b.state='retreat';b.timer=0;}
    } else if(b.state==='feint'){
      b.x+=b.retreatVx*1.8;
      b.feintT--;
      if(frame%3===0&&parts.length<MAX_PARTS)parts.push({x:b.x-b.sz*0.3,y:b.y,vx:-1,vy:(Math.random()-0.5),life:10,ml:10,sz:Math.random()*3+1,col:'#ffaa00'});
      if(b.feintT<=0){b.state='charge';b.timer=0;}
    } else if(b.state==='invincible'){
      b.x+=b.retreatVx*0.6;
      if(b.invT<=0){b.state='retreat';b.timer=0;}
    } else if(b.state==='retreat'){
      b.x+=b.retreatVx;
      if(b.x>=W*0.7){
        if(b.flipEnabled&&Math.random()<0.4){
          b.gDir*=-1;
        }
        b.state='charge';b.timer=0;b.feinted=false;
      }
    }
    // Collision check - AABB based (skip during bruiser invincibility)
    if(b.invT<=0){
      const hw=b.sz*0.65;
      const bL=b.x-hw,bR=b.x+hw;
      const headEdge=b.y-b.sz*0.75*b.gDir;
      const feetEdge=b.y+b.sz*0.9*b.gDir;
      const minY=Math.min(headEdge,feetEdge),maxY=Math.max(headEdge,feetEdge);
      const pL=player.x-pr,pR=player.x+pr;
      const pT=player.y-pr,pB=player.y+pr;
      if(pR>bL&&pL<bR&&pB>minY&&pT<maxY){
        if(itemEff.invincible>0){
          b.hp--;b.hurtFlash=20;b.invT=60;b.state='invincible';b.timer=0;
          shakeI=8;sfx('bossHit');
          emitParts(b.x,b.y,15,'#ff00ff',4,3);
          if(b.hp<=0){bossBruiserDefeat(b);}
        } else {
          const stompLine=b.gDir===1?(b.y-b.sz*0.3):(b.y+b.sz*0.3);
          const onHeadSide=b.gDir===1?(pB<stompLine):(pT>stompLine);
          const falling=b.gDir===1?(player.vy>=0):(player.vy<=0);
          if(onHeadSide&&falling){
            b.hp--;b.hurtFlash=20;
            b.state='invincible';b.invT=60;b.timer=0;
            player.vy=b.gDir===1?-JUMP_POWER*0.8:JUMP_POWER*0.8;player.grounded=false;
            flipCount=0;player.canFlip=true;djumpUsed=false;if(ct().hasDjump)djumpAvailable=true;
            shakeI=12;sfx('bossHit');sfx('gstompHeavy');vibrate([20,10,30]);
            addPop(b.x,b.y-b.sz*b.gDir-10,'HP '+b.hp+'/'+b.maxHp,'#ff3860');
            emitParts(b.x,b.y-b.sz*b.gDir,12,'#ff3860',5,3);
            if(b.hp<=0){bossBruiserDefeat(b);}
          } else if(hurtT<=0){
            hurt();
          }
        }
      }
    }
    // Keep on correct surface
    if(b.gDir===1){
      const sy=floorSurfaceY(b.x);
      if(sy<H+100)b.y=sy-b.sz;
    } else {
      const sy=ceilSurfaceY(b.x);
      if(sy>-100)b.y=sy+b.sz;
    }
  }
  // Phase C: guardian boss logic (jump → earthquake → charge → sword → retreat)
  // Supports multiple guardians
  _tmpBoss.length=0;
  for(let i=0;i<bossPhase.enemies.length;i++){const e=bossPhase.enemies[i];if(e.bossType==='guardian'&&e.alive)_tmpBoss.push(e);}
  if(bossPhase.guardian&&bossPhase.guardian.alive&&_tmpBoss.indexOf(bossPhase.guardian)<0){
    _tmpBoss.unshift(bossPhase.guardian);
  }
  for(let gi=0;gi<_tmpBoss.length;gi++){const g=_tmpBoss[gi];
    const bc=bossPhase.bossCount;
    if(enemies.indexOf(g)<0){
      enemies.push(g);if(bossPhase.enemies.indexOf(g)<0)bossPhase.enemies.push(g);
    }
    g.timer++;g.fr+=0.1;
    if(g.hurtFlash>0)g.hurtFlash--;
    if(g.invT>0)g.invT--;
    const floorY2=H-GROUND_H;
    const ceilY2=GROUND_H;
    // Helper: snap to current surface
    const snapToSurface=()=>{
      if(g.gDir===1){const sy=floorSurfaceY(g.x);if(sy<H+100)g.y=sy-g.sz;}
      else{const sy=ceilSurfaceY(g.x);if(sy>-100)g.y=sy+g.sz;}
    };
    // Helper: trigger earthquake on landing
    const triggerEarthquake=()=>{
      g.state='earthquake';g.timer=0;g.quakeT=g.quakeDuration;
      sfx('earthquake');shakeI=20;vibrate([40,20,60,30,40]);
      // Landing particles (from current surface)
      const landY=g.gDir===1?floorY2:ceilY2;
      const partDir=g.gDir===1?-1:1;
      for(let i=0;i<15;i++){
        const a=g.gDir===1?(Math.PI+Math.random()*Math.PI):(Math.random()*Math.PI);
        const s2=2+Math.random()*5;
        parts.push({x:g.x+(Math.random()-0.5)*g.sz,y:landY,vx:Math.cos(a)*s2,vy:Math.sin(a)*s2,
          life:25+Math.random()*20,ml:45,sz:Math.random()*5+2,col:['#8a7060','#a0906a','#c0b080'][i%3]});
      }
      // Dust clouds on both surfaces (no fire)
      for(let side=-1;side<=1;side+=2){
        for(let k=0;k<6;k++){
          const dx2=side*(20+k*30+Math.random()*20);
          parts.push({x:g.x+dx2,y:floorY2,vx:side*2+Math.random(),vy:-1-Math.random()*3,
            life:20+Math.random()*15,ml:35,sz:Math.random()*5+3,col:['#8a7060','#a09070','#c0b080'][k%3]});
          parts.push({x:g.x+dx2,y:ceilY2,vx:side*2+Math.random(),vy:1+Math.random()*3,
            life:20+Math.random()*15,ml:35,sz:Math.random()*5+3,col:['#8a7060','#a09070','#c0b080'][k%3]});
        }
      }
    };
    if(g.state==='enter'){
      g.x-=2;
      snapToSurface();
      if(g.x<=W*0.65){
        g.state='jumpPrep';g.timer=0;g.feintsDone=0;
        g.feintCount=0;g._jumpPrepTarget=0;
      }
    } else if(g.state==='jumpPrep'){
      // Brief crouch before jumping - irregular timing (shorter at higher phases)
      snapToSurface();
      g.x+=(Math.random()-0.5)*1.0; // shake telegraph
      // Random prep duration (set once when entering this state)
      // Prep gets shorter with each jump (faster attacks)
      if(!g._jumpPrepTarget){
        const prepScale=bc===1?1.0:Math.max(0.4,0.7+Math.random()*0.6);
        g._jumpPrepTarget=Math.max(2,Math.floor((g.jumpPrepBase+Math.floor(Math.random()*g.jumpPrepVariance))*prepScale));
      }
      if(g.timer>=g._jumpPrepTarget){
        g._jumpPrepTarget=0;
        // Always real big jump! Optionally flip to other surface
        const willFlip=g.flipEnabled&&Math.random()<0.45;
        g._jumpFlip=willFlip;
        g.state='bigJump';g.timer=0;
        // Phase 1 (bc=1): always same big jump; Phase 2+: random jump size
        const jumpScale=bc===1?1.0:(0.4+Math.random()*0.6);
        const jumpPow=(g.bigJumpBase+Math.random()*g.bigJumpVariance)*jumpScale;
        g.jumpVy=-jumpPow*g.gDir; // always jump away from current surface
        g.jumpCount++;
        sfx('guardianJump');shakeI=5;vibrate(10);
        const dustY=g.gDir===1?floorY2:ceilY2;
        emitParts(g.x,dustY,8,'#8a7060',4,2);
      }
    } else if(g.state==='feintJump'){
      // Small jump - lands on same surface without earthquake
      g.jumpVy+=GRAVITY*g.gDir;
      g.y+=g.jumpVy;
      if(g.gDir===1){
        const sy=floorSurfaceY(g.x);
        if(g.jumpVy>0&&g.y+g.sz>=sy){
          g.y=sy-g.sz;g.jumpVy=0;g.feintsDone++;
          shakeI=3;sfx('stomp');emitParts(g.x,sy,4,'#8a7060',2,1);
          g.state='jumpPrep';g.timer=0;
        }
        if(g.y<ceilY2+g.sz*0.3){g.y=ceilY2+g.sz*0.3;g.jumpVy=1;}
      } else {
        const sy=ceilSurfaceY(g.x);
        if(g.jumpVy<0&&g.y-g.sz<=sy){
          g.y=sy+g.sz;g.jumpVy=0;g.feintsDone++;
          shakeI=3;sfx('stomp');emitParts(g.x,sy,4,'#8a7060',2,1);
          g.state='jumpPrep';g.timer=0;
        }
        if(g.y+g.sz>floorY2-g.sz*0.3){g.y=floorY2-g.sz*1.3;g.jumpVy=-1;}
      }
    } else if(g.state==='bigJump'){
      // Fast jump - gravity accelerates quickly
      const gravMul=1.3+Math.min(bc-1,10)*0.08;
      g.jumpVy+=GRAVITY*g.gDir*gravMul;
      g.y+=g.jumpVy;
      // Flip: if going to other surface, change gDir mid-air
      if(g._jumpFlip){
        // Check if crossed midpoint
        const midY=H/2;
        if((g.gDir===1&&g.y<midY)||(g.gDir===-1&&g.y>midY)){
          g.gDir*=-1;
          g._jumpFlip=false;
          // Reverse velocity to fall toward new surface
          g.jumpVy=Math.abs(g.jumpVy)*g.gDir*-1;
        }
      }
      // Land on floor
      if(g.gDir===1){
        const sy=floorSurfaceY(g.x);
        if(g.jumpVy>0&&g.y+g.sz>=sy){
          g.y=sy-g.sz;g.jumpVy=0;g._jumpFlip=false;
          triggerEarthquake();
        }
        if(g.y<ceilY2){g.y=ceilY2;if(g.jumpVy<0)g.jumpVy=3;}
      }
      // Land on ceiling
      if(g.gDir===-1){
        const sy=ceilSurfaceY(g.x);
        if(g.jumpVy<0&&g.y-g.sz<=sy){
          g.y=sy+g.sz;g.jumpVy=0;g._jumpFlip=false;
          triggerEarthquake();
        }
        if(g.y+g.sz>floorY2){g.y=floorY2-g.sz;if(g.jumpVy>0)g.jumpVy=-3;}
      }
    } else if(g.state==='earthquake'){
      // Earthquake stuns grounded player (both floor AND ceiling)
      g.quakeT--;
      snapToSurface();
      if(g.quakeT>10)shakeI=Math.max(shakeI,5);
      // Stun check: if player is grounded = stunned! (unavoidable unless airborne)
      if(g.quakeT>5&&g.quakeT<g.quakeDuration-5&&player.grounded){
        if(!player._quakeStunned){
          player._quakeStunned=true;
          player._quakeStunT=g.quakeStunDuration;
          player.vy=0; // freeze in place
          sfx('hurt');vibrate([20,10,30]);shakeI=8;
          addPop(player.x,player.y-30,'スタン!','#ff6600');
          emitParts(player.x,player.y,8,'#ff6600',3,2);
        }
      }
      // Ground crack particles on both surfaces
      if(g.quakeT%3===0){
        const sx=g.x+(Math.random()-0.5)*W*0.5;
        parts.push({x:sx,y:floorY2,vx:(Math.random()-0.5)*2,vy:-1-Math.random()*3,
          life:15,ml:15,sz:Math.random()*3+1,col:'#8a7060'});
        parts.push({x:sx+(Math.random()-0.5)*W*0.3,y:ceilY2,vx:(Math.random()-0.5)*2,vy:1+Math.random()*3,
          life:15,ml:15,sz:Math.random()*3+1,col:'#8a7060'});
      }
      if(g.quakeT<=0){
        g.state='charge';g.timer=0;
        // Save target: charge to where the player IS right now
        g._chargeTargetX=player.x;
      }
    } else if(g.state==='charge'){
      // Charge to player's X position (VULNERABLE to stomping!)
      const targetX=g._chargeTargetX||player.x;
      const dx=targetX-g.x;
      g.x+=Math.sign(dx)*g.chargeSpd;
      g.fr+=0.15;
      snapToSurface();
      // Trail particles
      if(frame%2===0){
        const trailSide=g.x>targetX?g.sz*0.5:-g.sz*0.5;
        parts.push({x:g.x+trailSide,y:g.y+(g.gDir===1?g.sz*0.5:-g.sz*0.5),
          vx:(g.x>targetX?2:-2)+Math.random(),vy:(Math.random()-0.5)*2,
          life:12,ml:12,sz:Math.random()*4+2,col:'#4488cc'});
      }
      // Reached target X → sword attack!
      if(Math.abs(dx)<g.sz*0.4||g.timer>180){
        g.state='swordAttack';g.timer=0;g.swordSwingT=g.swordDuration;
        sfx('swordSlash');shakeI=6;vibrate([10,5,15]);
      }
    } else if(g.state==='swordAttack'){
      g.swordSwingT--;
      snapToSurface();
      // Sword hitbox active during swing
      if(g.swordSwingT>g.swordDuration*0.3&&g.swordSwingT<g.swordDuration*0.8){
        const sdx=player.x-g.x,sdy=player.y-(g.y+g.sz*0.3*g.gDir);
        const sd=Math.sqrt(sdx*sdx+sdy*sdy);
        if(sd<g.swordReach&&!player._swordHitThisSwing){
          player._swordHitThisSwing=true;
          hurt();
          sfx('hurt');shakeI=8;vibrate([15,10,20]);
        }
      }
      if(g.swordSwingT===Math.floor(g.swordDuration*0.5)){
        emitParts(g.x-g.sz*0.3,g.y+g.sz*0.3*g.gDir,6,'#c0d0e0',3,2);
      }
      if(g.swordSwingT<=0){
        player._swordHitThisSwing=false;
        g.state='retreat';g.timer=0;
      }
    } else if(g.state==='retreat'){
      g.x+=g.retreatSpd;
      g.fr+=0.08;
      snapToSurface();
      if(g.timer>=35||g.x>=W*0.65){
        g.state='jumpPrep';g.timer=0;g.feintsDone=0;
        g.feintCount=0;g._jumpPrepTarget=0;
      }
    } else if(g.state==='stunned'){
      g.stunT--;
      snapToSurface();
      if(g.stunT<=0){g.state='invincible';g.timer=0;}
    } else if(g.state==='invincible'){
      g.invT--;
      // Move toward original position (W*0.65)
      const homeX=W*0.65;
      const dx2=homeX-g.x;
      g.x+=Math.sign(dx2)*Math.min(Math.abs(dx2),g.retreatSpd);
      snapToSurface();
      if(g.invT<=0){g.state='jumpPrep';g.timer=0;g.feintsDone=0;g.feintCount=0;g._jumpPrepTarget=0;}
    }
    // Player quake stun countdown - complete freeze (no movement, no gravity change)
    if(player._quakeStunT>0){
      player._quakeStunT--;
      player.vy=0; // keep frozen every frame
      if(player._quakeStunT<=0){player._quakeStunned=false;}
    }
    // Collision check (skip during invincible)
    if(g.invT<=0){
      const dx=player.x-g.x,dy=player.y-(g.y+g.sz*0.5*g.gDir);
      const d=Math.sqrt(dx*dx+dy*dy);
      // Use larger hitbox during charge for easier stomping, smaller otherwise
      const hitScale=(g.state==='charge')?0.85:BOSS_HITBOX_SCALE*0.8;
      if(d<pr+g.sz*hitScale){
        if(itemEff.invincible>0){
          g.hp--;g.hurtFlash=20;g.invT=60;g.state='invincible';g.timer=0;
          shakeI=8;sfx('bossHit');
          emitParts(g.x,g.y,15,'#ff00ff',4,3);
          if(g.hp<=0){bossGuardianDefeat(g);}
        } else {
          // Stomp check: VERY generous - player center above guardian center = stomp
          // Works in ANY state - always deals damage!
          const guardianCenter=g.y+g.sz*0.5*g.gDir;
          const stomped=g.gDir===1
            ?(player.y<guardianCenter) // player center above guardian center
            :(player.y>guardianCenter); // player center below guardian center (ceiling)
          if(stomped){
            g.hp--;g.hurtFlash=20;g.invT=g.stunDuration+60;
            g.state='stunned';g.stunT=g.stunDuration;g.timer=0;g.jumpVy=0;
            player.vy=g.gDir===1?-JUMP_POWER*0.8:JUMP_POWER*0.8;player.grounded=false;
            flipCount=0;player.canFlip=true;djumpUsed=false;if(ct().hasDjump)djumpAvailable=true;
            // Clear stun on successful stomp
            player._quakeStunned=false;player._quakeStunT=0;
            shakeI=12;sfx('bossHit');sfx('gstompHeavy');vibrate([20,10,30]);
            addPop(g.x,g.y-g.sz*g.gDir-10,'HP '+g.hp+'/'+g.maxHp,'#ffaa00');
            emitParts(g.x,g.y-g.sz*g.gDir,12,'#ffaa00',5,3);
            if(g.hp<=0){bossGuardianDefeat(g);}
          } else {
            hurt();
          }
        }
      }
    }
  }
  // Phase D: wizard boss logic (supports multiple wizards)
  _tmpBoss.length=0;
  for(let i=0;i<bossPhase.enemies.length;i++){const e=bossPhase.enemies[i];if(e.bossType==='wizard'&&e.alive)_tmpBoss.push(e);}
  if(bossPhase.wizard&&bossPhase.wizard.alive&&_tmpBoss.indexOf(bossPhase.wizard)<0){
    _tmpBoss.unshift(bossPhase.wizard);
  }
  for(let wi=0;wi<_tmpBoss.length;wi++){const w=_tmpBoss[wi];
    const bc=bossPhase.bossCount;
    if(enemies.indexOf(w)<0){
      enemies.push(w);if(bossPhase.enemies.indexOf(w)<0)bossPhase.enemies.push(w);
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
        // First attack is always cast, then 50/50
        if(w.atkCount>0&&Math.random()<0.5){
          w.state='rush';w.timer=0;w.rushT=0;w.rushReady=false;
          w.rushTargetX=player.x;
          w.rushTargetY=player.y;
          w.rushDir=player.gDir;
        } else {
          w.state='cast';w.timer=0;w.castType=Math.floor(Math.random()*2);w.castT=0;
        }
        w.atkCount++;
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
        if(frame%3===0&&parts.length<MAX_PARTS)parts.push({x:w.x,y:w.y,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,
          life:10,ml:10,sz:Math.random()*3+2,col:'#ff8844'});
      } else if(w.rushT<=warnT+dashT){
        // Fast dash toward player's position
        w.rushReady=true;
        const t=(w.rushT-warnT)/dashT;
        w.x=w.homeX+(w.rushTargetX-w.homeX)*t;
        w.y=w.homeY+(w.rushTargetY-w.homeY)*t;
        // Dash trail
        if(frame%2===0&&parts.length<MAX_PARTS)parts.push({x:w.x+(Math.random()-0.5)*w.sz,y:w.y+(Math.random()-0.5)*w.sz,
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
        // Phase scaling: slightly more bullets as phases progress
        const _cStr=isChallengeMode?(bossPhase.challStrength||1):0;
        const spreadExtra=isChallengeMode?_cStr:Math.floor((bc-1)/2);
        const radialExtra=isChallengeMode?(_cStr-1):Math.floor((bc-1)/2);
        const extra=isChallengeMode?_cStr:Math.floor((bc-1)/2);
        if(w.variant==='snowman'){
          // Snowman: parallel icicle barrage from right to left
          const icicleCount=5+extra;
          const spacing=(H-GROUND_H*2)/(icicleCount+1);
          for(let i=0;i<icicleCount;i++){
            const iy=GROUND_H+spacing*(i+1);
            const spd=-(3.5+Math.random()*1.5);
            bullets.push({x:W+20,y:iy,vx:spd,vy:0,sz:9,life:999,wizBullet:true,icicle:true});
          }
        } else if(w.castType===0){
          // Spread shot: 3 + phase bonus, fan out from wizard toward player vicinity
          const shotCount=3+spreadExtra;
          const dx=player.x-w.x,dy=player.y-w.y;
          const baseAngle=Math.atan2(dy,dx);
          const baseSpd=3;
          const spreadAngle=0.35; // radians between each shot
          for(let i=0;i<shotCount;i++){
            const offset=(i-(shotCount-1)/2)*spreadAngle;
            const a=baseAngle+offset;
            const spd=baseSpd+Math.random()*0.8;
            bullets.push({x:w.x,y:w.y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,sz:7,life:999,wizBullet:true});
          }
        } else {
          // 360-degree radial burst: 8 + phase bonus
          const ringCount=8+radialExtra;
          for(let i=0;i<ringCount;i++){
            const a=i*Math.PI*2/ringCount;
            bullets.push({x:w.x,y:w.y,vx:Math.cos(a)*2.5,vy:Math.sin(a)*2.5,sz:7,life:999,wizBullet:true});
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
      if(d<pr+w.sz*BOSS_HITBOX_SCALE){
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
            flipCount=0;player.canFlip=true;djumpUsed=false;if(ct().hasDjump)djumpAvailable=true;
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
  let aliveBruiser=0,aliveWizard=0,aliveGuardian=0;
  for(let i=0;i<bossPhase.enemies.length;i++){
    const e=bossPhase.enemies[i];
    if(!e.alive)continue;
    if(e.bossType==='bruiser')aliveBruiser++;
    else if(e.bossType==='wizard')aliveWizard++;
    else if(e.bossType==='guardian')aliveGuardian++;
  }
  const bruiserDone=aliveBruiser===0;
  const wizardDone=aliveWizard===0;
  const guardianDone=aliveGuardian===0;
  const hasDodge=bossPhase.dodgeQueue.length>0;
  let aliveDodge=0;
  for(let i=0;i<enemies.length;i++){if(enemies[i].bossType==='dodge'&&enemies[i].alive)aliveDodge++;}
  const dodgeDone=!hasDodge||(bossPhase.dodgeIdx>=bossPhase.dodgeQueue.length&&
    aliveDodge===0);
  const allDone=dodgeDone&&bruiserDone&&wizardDone&&guardianDone;
  if(allDone&&bossPhase.enemies.length>0&&!bossPhase.reward){
    bossPhase.reward=true;bossPhase.rewardT=0;
    // Catch up score that accumulated during boss
    score=Math.floor(dist);
    if(isChallengeMode){sfxChallengeDefeat();} else {sfxFanfare();}
    shakeI=10;vibrate([30,20,30,20,60]);
    if(isChallengeMode){
      addPop(W/2,H*0.25,'BOSS DEFEATED!','#ffd700');
      addPop(W/2,H*0.35,'撃破 '+(challengeKills+1)+'体目','#00e5ff');
    } else {
      addPop(W/2,H*0.3,'BOSS DEFEATED!','#ffd700');
    }
    // No-damage bonus: earn stockable invincibility (not in challenge mode)
    if(bossPhase.noDamage&&!isChallengeMode){invCount++;addPop(W/2,H*0.55,'\u7121\u6575+1! (No Damage!)','#ff00ff');}
    if(hp<maxHp()){hp++;addPop(player.x,player.y-40,'HP +1','#ff3860');}
    const bonus=30+bossPhase.total*5;
    walletCoins+=bonus;localStorage.setItem('gd5wallet',walletCoins.toString());
    totalCoins+=bonus;fbSaveUserData();
    addPop(W/2,H*0.45,'+'+bonus+' COINS!','#ffd700');
    for(let i=0;i<40&&parts.length<MAX_PARTS;i++)parts.push({x:W*Math.random(),y:-10,vx:(Math.random()-0.5)*4,vy:1+Math.random()*4,life:80+Math.random()*40,ml:120,sz:Math.random()*5+3,col:['#ffd700','#ffaa00','#fff4b0'][i%3]});
    // Spawn treasure chest falling from above (50%, not in challenge mode)
    if(!isChallengeMode&&Math.random()<0.5){
      bossChests++;
      chestFall={active:true,x:player.x,y:-40,vy:0,sparkT:0,gotT:0};
    }
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
  sfxBossDefeat('bruiser');
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
  sfxBossDefeat('wizard');
}
function bossGuardianDefeat(g){
  g.alive=false;
  shakeI=22;vibrate([40,20,60,30,100]);
  // Armor shatter explosion
  const cols=['#4488cc','#336699','#88bbee','#c0d0e0','#ffaa00','#ffd700'];
  for(let i=0;i<40;i++){
    const a=(6.28/40)*i,s=3+Math.random()*7;
    parts.push({x:g.x+(Math.random()-0.5)*g.sz,y:g.y+(Math.random()-0.5)*g.sz,
      vx:Math.cos(a)*s,vy:Math.sin(a)*s-3,life:60+Math.random()*40,ml:100,
      sz:Math.random()*8+3,col:cols[i%cols.length]});
  }
  // Shield fragment burst
  for(let i=0;i<15;i++){
    const a=Math.random()*6.28,s=2+Math.random()*5;
    parts.push({x:g.x-g.sz*0.4,y:g.y-g.sz*0.3,vx:Math.cos(a)*s-2,vy:Math.sin(a)*s,
      life:40+Math.random()*30,ml:70,sz:Math.random()*6+3,col:'#88ccff'});
  }
  // Upward gold sparks
  for(let i=0;i<15;i++){
    parts.push({x:g.x+(Math.random()-0.5)*g.sz*0.8,y:g.y-g.sz*0.5,
      vx:(Math.random()-0.5)*2,vy:-3-Math.random()*5,life:40+Math.random()*30,ml:70,
      sz:Math.random()*4+1,col:'#ffd700'});
  }
  addPop(g.x,g.y-g.sz-20,'\u6483\u7834\uFF01','#ffd700');
  sfxBossDefeat('guardian');
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
    const beamLen=Math.sqrt(dx*dx+dy*dy)||1;
    ctx.save();
    ctx.rotate(Math.atan2(dy,dx));
    ctx.fillStyle='rgba(255,140,40,'+rushAlpha+')';
    ctx.fillRect(-beamLen*0.5,-s*0.12,beamLen,s*0.24);
    ctx.fillStyle='rgba(255,200,80,'+rushAlpha*0.5+')';
    ctx.fillRect(-beamLen*0.5,-s*0.25,beamLen,s*0.5);
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
// === Boss enemy draw: snowman wizard variant ===
function drawBossSnowman(en){
  const s=en.sz,t=en.fr;
  const dmg=en.maxHp-en.hp;
  ctx.save();ctx.translate(en.x,en.y);
  ctx.globalAlpha=en.alpha||1;
  if(en.invT>0&&en.invT%6<3)ctx.globalAlpha*=0.25;
  if(en.hurtFlash>0&&en.hurtFlash%4<2)ctx.globalAlpha*=0.5;
  // Rush telegraph
  if(en.state==='rush'){
    const rushAlpha=en.rushReady?(.3+Math.sin(t*3)*.15):(.1+Math.sin(t*3)*.05);
    ctx.save();
    const dx=en.rushTargetX-en.homeX,dy=en.rushTargetY-en.homeY;
    ctx.rotate(Math.atan2(dy,dx));
    const beamLen=Math.sqrt(dx*dx+dy*dy)||1;
    ctx.fillStyle='rgba(100,180,255,'+rushAlpha+')';
    ctx.fillRect(-beamLen*0.5,-s*0.12,beamLen,s*0.24);
    ctx.restore();
  }
  // Shadow
  ctx.fillStyle='rgba(0,0,0,0.2)';ctx.beginPath();ctx.ellipse(0,s*1.1,s*0.6,s*0.12,0,0,6.28);ctx.fill();
  // Bottom body (large snowball)
  const bodyGr=ctx.createRadialGradient(-s*0.1,-s*0.1,0,0,0,s*0.85);
  bodyGr.addColorStop(0,'#fff');bodyGr.addColorStop(0.6,'#e8f0ff');bodyGr.addColorStop(1,'#c0d8f0');
  ctx.fillStyle=bodyGr;
  ctx.beginPath();ctx.arc(0,s*0.15,s*0.75,0,6.28);ctx.fill();
  ctx.strokeStyle='rgba(160,200,240,0.4)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(0,s*0.15,s*0.75,0,6.28);ctx.stroke();
  // Head (smaller snowball on top)
  const headGr=ctx.createRadialGradient(-s*0.05,-s*0.6,0,0,-s*0.55,s*0.5);
  headGr.addColorStop(0,'#fff');headGr.addColorStop(0.6,'#e8f0ff');headGr.addColorStop(1,'#c0d8f0');
  ctx.fillStyle=headGr;
  ctx.beginPath();ctx.arc(0,-s*0.55,s*0.5,0,6.28);ctx.fill();
  ctx.strokeStyle='rgba(160,200,240,0.4)';ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(0,-s*0.55,s*0.5,0,6.28);ctx.stroke();
  // Top hat
  ctx.fillStyle='#1a1a3a';
  ctx.fillRect(-s*0.3,-s*1.15,s*0.6,s*0.35);
  ctx.fillRect(-s*0.4,-s*0.82,s*0.8,s*0.08);
  // Hat band
  ctx.fillStyle='#88ccff';ctx.shadowColor='#88ccff';ctx.shadowBlur=4;
  ctx.fillRect(-s*0.3,-s*0.82,s*0.6,s*0.06);ctx.shadowBlur=0;
  // Eyes (glowing ice blue)
  ctx.fillStyle='#44aaff';ctx.shadowColor='#44aaff';ctx.shadowBlur=8;
  ctx.beginPath();ctx.arc(-s*0.18,-s*0.6,s*0.09,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.18,-s*0.6,s*0.09,0,6.28);ctx.fill();
  ctx.shadowBlur=0;
  // Carrot nose
  ctx.fillStyle='#ff8800';
  ctx.beginPath();ctx.moveTo(0,-s*0.5);ctx.lineTo(s*0.3,-s*0.45);ctx.lineTo(0,-s*0.4);ctx.closePath();ctx.fill();
  // Coal mouth
  ctx.fillStyle='#333';
  for(let i=0;i<5;i++){
    const ma=-0.3+i*0.15;
    ctx.beginPath();ctx.arc(Math.cos(ma)*s*0.22,-s*0.32+Math.sin(ma)*s*0.05,s*0.03,0,6.28);ctx.fill();
  }
  // Coal buttons
  ctx.fillStyle='#333';
  ctx.beginPath();ctx.arc(0,-s*0.05,s*0.05,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(0,s*0.2,s*0.05,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(0,s*0.45,s*0.05,0,6.28);ctx.fill();
  // Stick arms
  ctx.strokeStyle='#5a3a1a';ctx.lineWidth=s*0.06;ctx.lineCap='round';
  // Left arm
  ctx.beginPath();ctx.moveTo(-s*0.6,0);ctx.lineTo(-s*1.0,-s*0.3);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-s*0.85,-s*0.2);ctx.lineTo(-s*0.9,-s*0.45);ctx.stroke();
  // Right arm (holds icicle staff)
  ctx.beginPath();ctx.moveTo(s*0.6,0);ctx.lineTo(s*0.9,-s*0.25);ctx.stroke();
  // Icicle staff
  const staffGlow=en.state==='cast'?0.9:0.4;
  ctx.strokeStyle='rgba(140,200,255,'+staffGlow+')';ctx.lineWidth=s*0.05;
  ctx.beginPath();ctx.moveTo(s*0.85,-s*0.3);ctx.lineTo(s*1.0,-s*0.8);ctx.stroke();
  ctx.fillStyle='rgba(180,230,255,'+staffGlow+')';ctx.shadowColor='#88ccff';ctx.shadowBlur=en.state==='cast'?12:4;
  ctx.beginPath();
  ctx.moveTo(s*0.92,-s*0.8);ctx.lineTo(s*1.0,-s*1.1);ctx.lineTo(s*1.08,-s*0.8);
  ctx.closePath();ctx.fill();ctx.shadowBlur=0;
  // Rush indicator
  if(en.state==='rush'){
    const pulse=0.6+Math.sin(t*4)*0.4;
    ctx.strokeStyle='rgba(100,200,255,'+pulse*0.6+')';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(0,0,s*1.3+Math.sin(t*3)*s*0.15,0,6.28);ctx.stroke();
    if(en.rushReady){
      ctx.fillStyle='#88ccff';ctx.shadowColor='#88ccff';ctx.shadowBlur=12;
      ctx.font='bold '+(s*0.8)+'px monospace';ctx.textAlign='center';
      ctx.fillText('!',0,-s*1.6-Math.sin(t*4)*3);ctx.shadowBlur=0;
    }
  }
  // Casting: snowflake circle
  if(en.state==='cast'){
    ctx.strokeStyle='rgba(136,204,255,'+0.5*Math.abs(Math.sin(t))+')';
    ctx.lineWidth=1.5;
    const cr=s*1.5+Math.sin(t*2)*s*0.2;
    ctx.beginPath();ctx.arc(0,0,cr,0,6.28);ctx.stroke();
    for(let i=0;i<6;i++){
      const ra=t*0.4+i*Math.PI/3;
      ctx.fillStyle='rgba(200,240,255,0.6)';ctx.font=(s*0.25)+'px monospace';
      ctx.fillText('\u2744',Math.cos(ra)*cr,Math.sin(ra)*cr);
    }
  }
  // Frost particles
  if(frame%5===0){
    const px2=(Math.random()-0.5)*s*1.2,py2=-s*0.5+Math.random()*s*1.5;
    if(parts.length<MAX_PARTS)parts.push({x:en.x+px2,y:en.y+py2,vx:(Math.random()-0.5)*0.5,vy:-0.3-Math.random()*0.5,
      life:15+Math.random()*10,ml:25,sz:Math.random()*2+1,col:'#cceeff'});
  }
  // Damage cracks (ice cracks)
  if(dmg>=1){
    ctx.strokeStyle='rgba(100,180,255,0.5)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(-s*0.2,s*0.1);ctx.lineTo(s*0.1,s*0.4);ctx.stroke();
    ctx.beginPath();ctx.moveTo(s*0.1,-s*0.4);ctx.lineTo(-s*0.05,-s*0.1);ctx.stroke();
  }
  ctx.globalAlpha=1;ctx.restore();
}

// === Boss enemy draw: guardian type (armored knight with shield) ===
function drawBossGuardian(en){
  const s=en.sz,t=en.fr;
  const dmg=en.maxHp-en.hp;
  ctx.save();ctx.translate(en.x,en.y);
  if(en.gDir===-1)ctx.scale(1,-1); // flip when on ceiling
  // Hurt flash / invincible blink
  if(en.invT>0&&en.invT%6<3){ctx.globalAlpha=0.25;}
  else if(en.hurtFlash>0&&en.hurtFlash%4<2){ctx.globalAlpha=0.5;}
  // Shadow
  ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse(0,s*0.85,s*0.7,s*0.12,0,0,6.28);ctx.fill();
  // Legs (animated walk)
  const legSpd=en.state==='charge'?1.5:en.state==='stunned'?0:en.state==='retreat'?1.0:en.state==='jumpPrep'?0.3:0.6;
  const legPhase=Math.sin(t*legSpd)*s*0.1;
  ctx.fillStyle=dmg>=3?'#1a2030':'#2a3040';
  ctx.fillRect(-s*0.4+legPhase,s*0.25,s*0.22,s*0.55);
  ctx.fillRect(s*0.18-legPhase,s*0.25,s*0.22,s*0.55);
  // Armored boots
  ctx.fillStyle=dmg>=2?'#3a4050':'#4a5565';
  ctx.fillRect(-s*0.45+legPhase,s*0.6,s*0.32,s*0.2);
  ctx.fillRect(s*0.13-legPhase,s*0.6,s*0.32,s*0.2);
  // Main body (heavy armored torso - steel blue)
  const bodyGr=ctx.createRadialGradient(0,-s*0.1,s*0.1,0,-s*0.1,s*0.85);
  if(dmg>=3){bodyGr.addColorStop(0,'#2a3545');bodyGr.addColorStop(0.5,'#1a2535');bodyGr.addColorStop(1,'#0a1525');}
  else if(dmg>=2){bodyGr.addColorStop(0,'#3a4a5a');bodyGr.addColorStop(0.5,'#2a3a4a');bodyGr.addColorStop(1,'#1a2a3a');}
  else if(dmg>=1){bodyGr.addColorStop(0,'#4a5a6a');bodyGr.addColorStop(0.5,'#3a4a5a');bodyGr.addColorStop(1,'#2a3a4a');}
  else{bodyGr.addColorStop(0,'#5a6a7a');bodyGr.addColorStop(0.5,'#4a5a6a');bodyGr.addColorStop(1,'#3a4a5a');}
  ctx.fillStyle=bodyGr;
  ctx.beginPath();
  ctx.moveTo(-s*0.6,-s*0.55);ctx.quadraticCurveTo(-s*0.75,-s*0.1,-s*0.6,s*0.35);
  ctx.lineTo(s*0.6,s*0.35);ctx.quadraticCurveTo(s*0.75,-s*0.1,s*0.6,-s*0.55);
  ctx.quadraticCurveTo(0,-s*0.7,-s*0.6,-s*0.55);
  ctx.closePath();ctx.fill();
  // Damage cracks
  if(dmg>=1){
    ctx.strokeStyle='rgba(100,180,255,0.5)';ctx.lineWidth=1.5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(s*0.2,-s*0.4);ctx.lineTo(s*0.35,-s*0.1);ctx.lineTo(s*0.2,s*0.15);ctx.stroke();
  }
  if(dmg>=2){
    ctx.strokeStyle='rgba(255,170,0,0.6)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-s*0.3,-s*0.35);ctx.lineTo(-s*0.1,0);ctx.lineTo(-s*0.3,s*0.25);ctx.stroke();
    ctx.beginPath();ctx.moveTo(s*0.1,-s*0.5);ctx.lineTo(s*0.4,-s*0.15);ctx.stroke();
  }
  if(dmg>=3){
    ctx.fillStyle='rgba(255,170,0,0.15)';
    ctx.beginPath();ctx.arc(0,-s*0.1,s*0.2,0,6.28);ctx.fill();
    if(Math.random()<0.3){
      const spx=(Math.random()-0.5)*s*0.6,spy=-s*0.3+Math.random()*s*0.5;
      ctx.fillStyle='#ffaa00';ctx.beginPath();ctx.arc(spx,spy,s*0.04,0,6.28);ctx.fill();
    }
  }
  // Chest plate
  if(dmg<3){
    ctx.fillStyle=dmg>=1?'#3a4a55':'#5a6a75';
    ctx.beginPath();
    ctx.moveTo(-s*0.35,-s*0.45);ctx.lineTo(0,-s*0.55);ctx.lineTo(s*0.35,-s*0.45);
    ctx.lineTo(s*0.3,s*0.1);ctx.lineTo(0,s*0.2);ctx.lineTo(-s*0.3,s*0.1);
    ctx.closePath();ctx.fill();
  }
  // Left arm (armored gauntlet)
  ctx.fillStyle=dmg>=2?'#3a4a55':'#5a6a75';
  ctx.fillRect(-s*0.7,-s*0.3,s*0.2,s*0.5);
  // Sword arm (right side)
  const swordAngle=en.state==='swordAttack'?-1.2+Math.sin(en.swordSwingT*0.3)*0.8:
    en.state==='charge'?0.3:en.state==='stunned'?0.5:
    en.state==='jumpPrep'?-0.3:en.state==='bigJump'||en.state==='feintJump'?-0.8:0;
  ctx.save();ctx.translate(s*0.5,-s*0.2);ctx.rotate(swordAngle);
  ctx.fillStyle='#c0d0e0';
  ctx.fillRect(-s*0.04,-s*0.8,s*0.08,s*0.9); // blade
  ctx.fillStyle='#8090a0';
  ctx.fillRect(-s*0.1,s*0.05,s*0.2,s*0.12); // guard
  ctx.fillStyle='#5a4030';
  ctx.fillRect(-s*0.05,s*0.12,s*0.1,s*0.18); // grip
  ctx.restore();
  // Helmet (visored)
  const headGr=ctx.createRadialGradient(0,-s*0.65,s*0.05,0,-s*0.65,s*0.3);
  if(dmg>=3){headGr.addColorStop(0,'#2a3545');headGr.addColorStop(1,'#1a2030');}
  else{headGr.addColorStop(0,'#5a6a7a');headGr.addColorStop(1,'#3a4a5a');}
  ctx.fillStyle=headGr;
  ctx.beginPath();ctx.arc(0,-s*0.65,s*0.28,0,6.28);ctx.fill();
  // Helmet crest
  ctx.fillStyle=dmg>=2?'#3a4050':'#6a7a8a';
  ctx.beginPath();ctx.moveTo(0,-s*0.95);ctx.lineTo(-s*0.06,-s*0.7);ctx.lineTo(s*0.06,-s*0.7);ctx.closePath();ctx.fill();
  // Visor slit (glowing eyes behind)
  const eyeCol=en.state==='earthquake'||en.state==='swordAttack'?'#ff0000':en.state==='charge'?'#ff4400':en.state==='bigJump'?'#ff6600':'#ffaa00';
  ctx.fillStyle=eyeCol;ctx.shadowColor=eyeCol;ctx.shadowBlur=6;
  ctx.fillRect(-s*0.18,-s*0.7,s*0.36,s*0.06);ctx.shadowBlur=0;
  // HP bar
  const baseAlpha=en.invT>0&&en.invT%6<3?0.25:en.hurtFlash>0&&en.hurtFlash%4<2?0.5:1;
  ctx.globalAlpha=baseAlpha;
  const hpW=s*1.2,hpH=5,hpX=-hpW/2,hpY=-s-15;
  ctx.fillStyle='#333';ctx.fillRect(hpX,hpY,hpW,hpH);
  const hpRatio=en.hp/en.maxHp;
  const hpCol=hpRatio>0.5?'#4488cc':hpRatio>0.25?'#ffaa00':'#ff4400';
  ctx.fillStyle=hpCol;ctx.fillRect(hpX,hpY,hpW*hpRatio,hpH);
  ctx.strokeStyle='#fff4';ctx.lineWidth=1;ctx.strokeRect(hpX,hpY,hpW,hpH);
  // Stunned stars
  if(en.state==='stunned'){
    for(let i=0;i<3;i++){
      const a=t*2+i*2.09;
      const sx=Math.cos(a)*s*0.4,sy2=-s*0.95+Math.sin(a*1.3)*s*0.08;
      ctx.fillStyle='#ffdd00';ctx.font='bold 10px monospace';ctx.textAlign='center';
      ctx.fillText('\u2605',sx,sy2);
    }
  }
  // Jump prep telegraph (crouch + "!" above head)
  if(en.state==='jumpPrep'){
    const wa=0.5+Math.sin(t*3)*0.3;
    ctx.globalAlpha=wa;ctx.fillStyle='#ff6600';ctx.font='bold 16px monospace';ctx.textAlign='center';
    ctx.fillText('!',0,-s*1.15);ctx.globalAlpha=1;
  }
  // Big jump indicator (upward arrow)
  if(en.state==='bigJump'||en.state==='feintJump'){
    const ja=0.6+Math.sin(t*4)*0.4;
    ctx.globalAlpha=ja;ctx.fillStyle='#ff4400';ctx.font='bold 14px monospace';ctx.textAlign='center';
    ctx.fillText('\u25B2',0,-s*1.2);ctx.globalAlpha=1;
  }
  // Earthquake indicator (ground ripples)
  if(en.state==='earthquake'){
    const qa=0.4+Math.sin(t*6)*0.4;
    ctx.globalAlpha=qa;ctx.strokeStyle='#ff6600';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(0,s*0.8,s*1.0+Math.sin(t*3)*s*0.2,0,Math.PI);ctx.stroke();
    ctx.beginPath();ctx.arc(0,s*0.8,s*1.5+Math.sin(t*3+1)*s*0.2,0,Math.PI);ctx.stroke();
    ctx.globalAlpha=1;
  }
  // Charge indicator (dust trail only, no text)
  if(en.state==='charge'){
    const ca=0.3+Math.sin(t*3)*0.2;
    ctx.globalAlpha=ca;ctx.strokeStyle='#4488cc';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(0,-s*0.3,s*0.9+Math.sin(t*2)*s*0.1,0,6.28);ctx.stroke();
    ctx.globalAlpha=1;
  }
  // Sword attack indicator (slash arc)
  if(en.state==='swordAttack'){
    const sa=0.5+Math.sin(t*5)*0.3;
    ctx.globalAlpha=sa;ctx.strokeStyle='#ff3333';ctx.lineWidth=3;
    const slashAng=-1.5+Math.sin(en.swordSwingT*0.3)*1.2;
    ctx.beginPath();ctx.arc(s*0.3,-s*0.2,s*1.0,slashAng-0.5,slashAng+0.5);ctx.stroke();
    ctx.globalAlpha=1;
  }
  ctx.restore();
}
// === Boss enemy draw: dodge type (sea urchin) ===
function drawBossDodge(en){
  const s=en.sz,t=en.fr;
  const pulse=0.7+Math.sin(t*3)*0.3;
  const breathe=1+Math.sin(t*2)*0.05; // subtle body pulsation
  ctx.save();ctx.translate(en.x,en.y);
  // Danger aura glow
  ctx.shadowColor='#ff0000';ctx.shadowBlur=15*pulse;
  // Spikes radiating in ALL directions (urchin style)
  const spikeCount=14;
  const spikeLen=s*0.7;
  const spikeBase=s*0.12;
  for(let i=0;i<spikeCount;i++){
    const ang=(6.28/spikeCount)*i+Math.sin(t*1.5+i)*0.1; // slight wobble
    const len=spikeLen*(0.85+Math.sin(t*2.5+i*1.7)*0.15);
    const cx2=Math.cos(ang),sy2=Math.sin(ang);
    // Spike gradient: dark base → red tip
    const tipX=cx2*(s*0.55*breathe+len),tipY=sy2*(s*0.55*breathe+len);
    const baseX=cx2*s*0.45*breathe,baseY=sy2*s*0.45*breathe;
    const sgr=ctx.createLinearGradient(baseX,baseY,tipX,tipY);
    sgr.addColorStop(0,'#444');sgr.addColorStop(0.3,'#666');sgr.addColorStop(0.7,'#cc2222');sgr.addColorStop(1,'#ff0000');
    ctx.fillStyle=sgr;
    // Triangular spike
    const perpX=-sy2*spikeBase*0.5,perpY=cx2*spikeBase*0.5;
    ctx.beginPath();
    ctx.moveTo(baseX+perpX,baseY+perpY);
    ctx.lineTo(tipX,tipY);
    ctx.lineTo(baseX-perpX,baseY-perpY);
    ctx.closePath();ctx.fill();
    // White glint on tip
    ctx.fillStyle='rgba(255,255,255,'+pulse*0.7+')';
    ctx.beginPath();ctx.arc(tipX,tipY,1.5,0,6.28);ctx.fill();
  }
  // Secondary shorter spikes (between main ones)
  for(let i=0;i<spikeCount;i++){
    const ang=(6.28/spikeCount)*i+(3.14/spikeCount)+Math.sin(t*1.2+i*2)*0.08;
    const len=spikeLen*0.5*(0.8+Math.sin(t*3+i*2.3)*0.2);
    const cx2=Math.cos(ang),sy2=Math.sin(ang);
    const tipX=cx2*(s*0.5*breathe+len),tipY=sy2*(s*0.5*breathe+len);
    const baseX=cx2*s*0.4*breathe,baseY=sy2*s*0.4*breathe;
    ctx.fillStyle='#883333';
    ctx.beginPath();
    const perpX=-sy2*spikeBase*0.3,perpY=cx2*spikeBase*0.3;
    ctx.moveTo(baseX+perpX,baseY+perpY);
    ctx.lineTo(tipX,tipY);
    ctx.lineTo(baseX-perpX,baseY-perpY);
    ctx.closePath();ctx.fill();
  }
  ctx.shadowBlur=0;
  // Main body: dark spherical core
  const bgr=ctx.createRadialGradient(-s*0.1,-s*0.1,s*0.05,0,0,s*0.55*breathe);
  bgr.addColorStop(0,'#3a2020');bgr.addColorStop(0.4,'#2a1515');bgr.addColorStop(0.8,'#1a0a0a');bgr.addColorStop(1,'#100505');
  ctx.fillStyle=bgr;
  ctx.beginPath();ctx.arc(0,0,s*0.55*breathe,0,6.28);ctx.fill();
  // Textured surface bumps
  ctx.fillStyle='#2a1818';
  for(let i=0;i<8;i++){
    const ba=(6.28/8)*i+t*0.3,br2=s*0.35;
    ctx.beginPath();ctx.arc(Math.cos(ba)*br2,Math.sin(ba)*br2,s*0.08,0,6.28);ctx.fill();
  }
  // Angry red eyes (two, slightly asymmetric)
  const eyeGlow=pulse;
  // Left eye
  ctx.fillStyle='#ff0000';ctx.shadowColor='#ff0000';ctx.shadowBlur=10*eyeGlow;
  ctx.beginPath();ctx.ellipse(-s*0.18,-s*0.08,s*0.13,s*0.09,0.15,0,6.28);ctx.fill();
  // Right eye
  ctx.beginPath();ctx.ellipse(s*0.12,-s*0.1,s*0.11,s*0.08,-0.15,0,6.28);ctx.fill();
  // Dark angry pupils (slit-like)
  ctx.shadowBlur=0;
  ctx.fillStyle='#330000';
  ctx.beginPath();ctx.ellipse(-s*0.18,-s*0.08,s*0.05,s*0.08,0.15,0,6.28);ctx.fill();
  ctx.beginPath();ctx.ellipse(s*0.12,-s*0.1,s*0.04,s*0.07,-0.15,0,6.28);ctx.fill();
  // White highlight dots in eyes
  ctx.fillStyle='#ffaaaa';
  ctx.beginPath();ctx.arc(-s*0.22,-s*0.12,s*0.03,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.08,-s*0.14,s*0.025,0,6.28);ctx.fill();
  // Menacing mouth (jagged)
  ctx.strokeStyle='#ff2222';ctx.lineWidth=Math.max(1.5,s*0.03);
  ctx.beginPath();
  ctx.moveTo(-s*0.2,s*0.1);ctx.lineTo(-s*0.1,s*0.16);ctx.lineTo(0,s*0.08);
  ctx.lineTo(s*0.08,s*0.15);ctx.lineTo(s*0.15,s*0.1);
  ctx.stroke();
  // Danger pulse ring
  const ringAlpha=0.15+Math.sin(t*4)*0.1;
  ctx.strokeStyle='rgba(255,0,0,'+ringAlpha+')';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(0,0,s*1.1+Math.sin(t*3)*s*0.1,0,6.28);ctx.stroke();
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

