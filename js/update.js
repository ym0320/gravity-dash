'use strict';
// ===== UPDATE =====
let lastTime=0;
function update(dt){
  frame++;
  if(themeLerp<1)themeLerp=Math.min(1,themeLerp+0.015);
  if(shakeI>0){shakeX=(Math.random()-0.5)*shakeI;shakeY=(Math.random()-0.5)*shakeI;shakeI*=0.88;if(shakeI<0.3){shakeI=0;shakeX=0;shakeY=0;}}
  // combo only resets when a coin is missed (goes off-screen)
  if(comboDspT>0)comboDspT--;
  if(mileT>0)mileT--;
  if(bombFlashT>0)bombFlashT--;
  if(newHiEffT>0)newHiEffT--;
  pops=pops.filter(p=>{p.y-=1.2;p.life--;return p.life>0;});

  if(state===ST.PAUSE)return; // freeze everything while paused

  if(state===ST.STAGE_SEL){frame++;return;}
  if(state===ST.TITLE){
    titleT+=0.03;
    if(unlockCelebT>0)unlockCelebT--;
    if(charModal.show)charModal.animT++;
    stars.forEach(s=>{s.x-=s.sp*0.5;s.tw+=s.ts;if(s.x<-5)s.x=W+5;});
    mtns.forEach(m=>{m.off-=m.sp*0.3;if(m.off<-500)m.off+=500;});
    return;
  }
  if(state===ST.DEAD){
    deadT++;
    parts=parts.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.07;p.vx*=0.99;p.life--;return p.life>0;});
    stars.forEach(s=>{s.x-=s.sp*0.15;s.tw+=s.ts;if(s.x<-5)s.x=W+5;});
    return;
  }
  if(state===ST.STAGE_CLEAR){
    stageClearT++;
    parts=parts.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.05;p.vx*=0.99;p.life--;return p.life>0;});
    // Spawn celebration particles
    if(stageClearT<60&&stageClearT%3===0){
      for(let i=0;i<3;i++)parts.push({x:W*Math.random(),y:-10,vx:(Math.random()-0.5)*2,vy:1+Math.random()*2,life:50+Math.random()*30,ml:80,sz:Math.random()*5+2,col:['#ffd700','#00e5ff','#ff3860','#34d399'][i%4]});
    }
    return;
  }

  // === PLAYING ===
  // Ghost character periodic transparency (immune to enemy attacks while transparent)
  if(ct().shape==='ghost'){
    ghostPhaseT++;
    if(ghostInvis&&ghostPhaseT>=90){
      ghostInvis=false;ghostPhaseT=0;
      // Reappear particles
      emitParts(player.x,player.y,6,'#a855f7',2,1);
    } else if(!ghostInvis&&ghostPhaseT>=90){
      ghostInvis=true;ghostPhaseT=0;
      // Vanish particles
      emitParts(player.x,player.y,8,'#a855f7',3,2);
    }
    // Shimmer particles while invisible
    if(ghostInvis&&frame%6===0){
      parts.push({x:player.x+(Math.random()-0.5)*20,y:player.y+(Math.random()-0.5)*20,
        vx:(Math.random()-0.5)*0.5,vy:(Math.random()-0.5)*0.5,
        life:10,ml:10,sz:Math.random()*2+1,col:'#a855f766'});
    }
  } else {ghostInvis=false;ghostPhaseT=0;}
  // Hurt invincibility timer
  if(hurtT>0)hurtT--;
  // Item timers
  const wasInvincible=itemEff.invincible>0;
  const prevInvT=itemEff.invincible;
  for(const k in itemEff)if(itemEff[k]>0)itemEff[k]--;
  if(wasInvincible&&itemEff.invincible<=0&&state===ST.PLAY)switchBGM('play');
  // Invincibility ending warning: slow down BGM and flash at 90 frames remaining
  if(wasInvincible&&prevInvT===90&&state===ST.PLAY)switchBGM('play');

  if(isPackMode&&currentPackStage){
    speed=SPEED_INIT*currentPackStage.spdMul*ct().speedMul;
  } else {
    speed=Math.min(SPEED_MAX,(SPEED_INIT+dist*SPEED_INC))*ct().speedMul;
  }

  // Distance scoring
  dist+=speed*0.08;
  const ns=Math.floor(dist);
  if(ns>score){score=ns;checkMile();}

  // Platform scrolling
  platforms.forEach(p=>p.x-=speed);
  ceilPlats.forEach(p=>p.x-=speed);
  floatPlats.forEach(p=>p.x-=speed);
  spikes.forEach(s=>s.x-=speed);
  movingHills.forEach(h=>{h.x-=speed;h.phase+=h.spd;});
  // Remove off-screen platforms
  platforms=platforms.filter(p=>p.x+p.w>-50);
  ceilPlats=ceilPlats.filter(p=>p.x+p.w>-50);
  floatPlats=floatPlats.filter(p=>p.x+p.w>-50);
  spikes=spikes.filter(s=>s.x+s.w>-50);
  movingHills=movingHills.filter(h=>h.x+h.w>-50);
  // Generate new platforms ahead (pack mode: seeded terrain)
  if(isPackMode&&currentPackStage){
    if(platforms.length===0)platforms.push({x:player.x-30,w:200,h:GROUND_H});
    if(ceilPlats.length===0)ceilPlats.push({x:player.x-30,w:200,h:GROUND_H});
    while(platforms.length>0&&platforms[platforms.length-1].x+platforms[platforms.length-1].w<W+300){
      generatePackPlatform(platforms,false,currentPackStage);
    }
    while(ceilPlats.length>0&&ceilPlats[ceilPlats.length-1].x+ceilPlats[ceilPlats.length-1].w<W+300){
      generatePackPlatform(ceilPlats,true,currentPackStage);
    }
    // Pack mode clear check
    if(dist>=currentPackStage.dist){
      state=ST.STAGE_CLEAR;stageClearT=0;gotNewStars=0;
      sfxFanfare();vibrate([30,20,30,20,60]);shakeI=8;
      // Count stars collected this run
      const starsThisRun=stageBigCoins.filter(bc=>bc.col).length;
      const sid=currentPackStage.id;
      const prev=packProgress[sid];
      const prevStars=prev?prev.stars:0;
      const newStars=Math.max(prevStars,starsThisRun);
      gotNewStars=Math.max(0,newStars-prevStars);
      packProgress[sid]={cleared:true,stars:newStars};
      localStorage.setItem('gd5pp',JSON.stringify(packProgress));
      totalStars=getTotalStars();
      const reward=10+starsThisRun*5+(gotNewStars>0?10:0);
      walletCoins+=reward;localStorage.setItem('gd5wallet',walletCoins.toString());
      switchBGM('title');
      for(let i=0;i<30;i++)parts.push({x:W*Math.random(),y:-10,vx:(Math.random()-0.5)*3,vy:1+Math.random()*3,life:60+Math.random()*40,ml:100,sz:Math.random()*5+2,col:['#ffd700','#00e5ff','#ff3860','#34d399','#a855f7'][i%5]});
    }
    // Star scrolling and collection
    const pr2=PLAYER_R*ct().sizeMul;
    stageBigCoins.forEach(bc=>{
      bc.x-=speed;bc.p+=0.06;
      // Compute Y from floor surface + offset
      const fsy=floorSurfaceY(bc.x);
      if(fsy<H+100) bc.y=fsy+bc.yOff;
      else bc.y=H*0.4; // fallback if in gap
    });
    stageBigCoins.forEach(bc=>{
      if(bc.col)return;
      const dx=player.x-bc.x,dy=player.y-bc.y;
      if(Math.sqrt(dx*dx+dy*dy)<pr2+bc.sz){
        bc.col=true;stageBigCollected++;
        sfx('milestone');vibrate([20,10,40]);shakeI=6;
        addPop(bc.x,bc.y-20,'\u2605 STAR!','#ffd700');
        emitParts(bc.x,bc.y,15,'#ffd700',5,3);
      }
    });
    // Enemy spawning in pack mode (based on stage enemyChance)
    if(currentPackStage.enemyChance&&Math.random()<currentPackStage.enemyChance*0.3){
      trySpawnEnemy();
    }
    // Ambient particles for theme
    updateAmbient();
  }
  // Generate new platforms ahead (endless mode only)
  if(gameMode==='endless'&&!isPackMode){
    if(platforms.length===0)platforms.push({x:player.x-30,w:200,h:GROUND_H});
    if(ceilPlats.length===0)ceilPlats.push({x:player.x-30,w:200,h:GROUND_H});

    // Flip zone logic: after first boss and score>100, periodically force floor/ceiling gaps
    // Creates long stretches where one side disappears, forcing gravity switching
    if(flipZone.cd>0)flipZone.cd--;
    if(!flipZone.active&&flipZone.cd<=0&&score>100&&bossPhase.bossCount>=1&&!bossPhase.active){
      const flipChance=Math.min(0.08,0.02+(score-100)*0.001);
      if(Math.random()<flipChance){
        flipZone.active=true;
        // Alternate: if last was floor gap, do ceiling gap (and vice versa)
        if(flipZone.lastType===0) flipZone.type=1;
        else if(flipZone.lastType===1) flipZone.type=0;
        else flipZone.type=Math.random()<0.5?0:1;
        flipZone.lastType=flipZone.type;
        // Long zones: 6-12 forced-gap platforms (much longer than before)
        flipZone.len=6+Math.floor(Math.random()*7);
      }
    }

    let lastF=platforms[platforms.length-1];
    let lastC=ceilPlats[ceilPlats.length-1];
    while(lastF.x+lastF.w<W+300){
      const forceFloorGap=flipZone.active&&flipZone.type===0&&flipZone.len>0;
      generatePlatform(platforms,false,forceFloorGap);
      if(forceFloorGap){flipZone.len--;if(flipZone.len<=0){flipZone.active=false;flipZone.cd=120+Math.floor(Math.random()*100);}}
      lastF=platforms[platforms.length-1];
    }
    while(lastC.x+lastC.w<W+300){
      const forceCeilGap=flipZone.active&&flipZone.type===1&&flipZone.len>0;
      generatePlatform(ceilPlats,true,forceCeilGap);
      if(forceCeilGap){flipZone.len--;if(flipZone.len<=0){flipZone.active=false;flipZone.cd=120+Math.floor(Math.random()*100);}}
      lastC=ceilPlats[ceilPlats.length-1];
    }
    trySpawnCoins();
    trySpawnItem();
    trySpawnEnemy();
    trySpawnFloatPlat();
    trySpawnSpike();
    trySpawnMovingHill();
    // Boss phase trigger
    if(!bossPhase.active&&score>=bossPhase.nextAt){
      startBossPhase();
    }
    updateBossPhase();
    // During boss prepare/active, cancel flip zones
    if(bossPhase.active){flipZone.active=false;flipZone.cd=200;}
  }

  // Physics
  flipTimer++;
  const pr=PLAYER_R*ct().sizeMul;
  const grav=GRAVITY*player.gDir*ct().gravMul;
  player.vy+=grav;
  player.vy=Math.max(-14,Math.min(14,player.vy));

  player.y+=player.vy;

  // Ground collision
  player.grounded=false;
  const isTire=ct().shape==='tire';
  if(player.gDir===1){
    let surfY=floorSurfaceY(player.x);
    // Tire gap bridging: if over a void, check if tire edges are still on ground
    if(surfY>H+100&&isTire){
      const lS=floorSurfaceY(player.x-pr),rS=floorSurfaceY(player.x+pr);
      if(lS<H+100||rS<H+100) surfY=lS<H+100&&rS<H+100?Math.max(lS,rS):lS<H+100?lS:rS;
    }
    if(player.y+pr>=surfY&&surfY<H+100){
      player.y=surfY-pr;player.vy=0;player.grounded=true;player.canFlip=true;flipCount=0;djumpUsed=false;if(ct().hasDjump)djumpAvailable=true;
    }
  } else {
    let surfY=ceilSurfaceY(player.x);
    // Tire gap bridging for ceiling
    if(surfY<-100&&isTire){
      const lS=ceilSurfaceY(player.x-pr),rS=ceilSurfaceY(player.x+pr);
      if(lS>-100||rS>-100) surfY=lS>-100&&rS>-100?Math.min(lS,rS):lS>-100?lS:rS;
    }
    if(player.y-pr<=surfY&&surfY>-100){
      player.y=surfY+pr;player.vy=0;player.grounded=true;player.canFlip=true;flipCount=0;djumpUsed=false;if(ct().hasDjump)djumpAvailable=true;
    }
  }

  // Floating platform collision (mid-air landing)
  if(!player.grounded){
    for(let fi=0;fi<floatPlats.length;fi++){
      const fp=floatPlats[fi];
      if(player.x>=fp.x-pr*0.5&&player.x<=fp.x+fp.w+pr*0.5){
        if(player.gDir===1&&player.vy>=0){
          // Falling onto top of float plat
          if(player.y+pr>=fp.y&&player.y+pr<fp.y+fp.th+8){
            player.y=fp.y-pr;player.vy=0;player.grounded=true;player.canFlip=true;flipCount=0;djumpUsed=false;if(ct().hasDjump)djumpAvailable=true;
            break;
          }
        } else if(player.gDir===-1&&player.vy<=0){
          // Rising into bottom of float plat
          if(player.y-pr<=fp.y+fp.th&&player.y-pr>fp.y-8){
            player.y=fp.y+fp.th+pr;player.vy=0;player.grounded=true;player.canFlip=true;flipCount=0;djumpUsed=false;if(ct().hasDjump)djumpAvailable=true;
            break;
          }
        }
      }
    }
  }

  // Spike gimmick update & collision
  spikes.forEach(sp=>{
    sp.timer++;
    if(sp.state==='hidden'&&sp.timer>=sp.cycle){
      sp.state='warning';sp.timer=0;
    } else if(sp.state==='warning'&&sp.timer>=30){
      sp.state='up';sp.timer=0;
    } else if(sp.state==='up'&&sp.timer>=sp.upTime){
      sp.state='retracting';sp.timer=0;
    } else if(sp.state==='retracting'&&sp.timer>=15){
      sp.state='hidden';sp.timer=0;
    }
    // Collision when spikes are up
    if(sp.state==='up'&&itemEff.invincible<=0&&hurtT<=0){
      const spY=sp.h; // floor surface Y = H - sp.h... actually sp.h is stored as H-plat.h
      const spTopY=sp.h-sp.spikeH; // top of spike
      if(player.x+pr>sp.x&&player.x-pr<sp.x+sp.w){
        if(player.y+pr>spTopY&&player.y-pr<sp.h){
          hurt();
        }
      }
    }
  });

  // Moving hill collision (acts as temporary elevated terrain)
  movingHills.forEach(mh=>{
    const curH=mh.baseH+Math.sin(mh.phase)*mh.ampH;
    const surfY=H-curH;
    if(player.gDir===1&&player.x+pr>mh.x&&player.x-pr<mh.x+mh.w){
      if(player.y+pr>=surfY&&player.y+pr<surfY+20&&player.vy>=0){
        player.y=surfY-pr;player.vy=0;player.grounded=true;player.canFlip=true;flipCount=0;djumpUsed=false;if(ct().hasDjump)djumpAvailable=true;
      } else if(player.y+pr>surfY+4&&player.y-pr<surfY&&player.grounded){
        // Push player up with the hill
        player.y=surfY-pr;
      }
    }
  });

  // Crush detection (terrain pinch)
  const fSurf=floorSurfaceY(player.x);
  const cSurf=ceilSurfaceY(player.x);
  if(fSurf-cSurf<pr*2+4){
    hurt();return;
  }
  // Boundaries (void fall = instant death, lose all HP)
  if(player.y+pr>H+30||player.y-pr<-30){die();return;}

  // Rotation (tire spins continuously when grounded)
  if(ct().shape==='tire'&&player.grounded){
    player.rotTarget+=speed*0.08*player.gDir;
  }
  player.rot+=(player.rotTarget-player.rot)*0.12;

  // Trail
  player.trail.push({x:player.x,y:player.y,a:1});
  if(player.trail.length>14)player.trail.shift();
  player.trail.forEach(t=>t.a-=0.075);

  // Coins
  coins.forEach(c=>{
    c.x-=speed;c.p+=0.08;
    if(!c.col){
      let cd=pr+c.sz;
      const charMag=ct().coinMag;
      if(itemEff.magnet>0||charMag>0){
        const dx=player.x-c.x,dy=player.y-c.y,d=Math.sqrt(dx*dx+dy*dy);
        const magR=itemEff.magnet>0?180:charMag;
        const magStr=itemEff.magnet>0?0.12:0.06;
        if(d<magR){c.x+=dx*magStr;c.y+=dy*magStr;}if(itemEff.magnet>0)cd*=1.8;
      }
      const dx=player.x-c.x,dy=player.y-c.y;
      if(Math.sqrt(dx*dx+dy*dy)<cd){
        c.col=true;totalCoins++;combo++;comboDsp=combo;comboDspT=55;
        if(combo>maxCombo)maxCombo=combo;
        const bon=Math.ceil((3+Math.min(combo-1,8))*ct().coinMul);
        dist+=bon;sfx(combo>1?'combo':'coin');
        addPop(c.x,c.y-14,'+'+bon,'#ffd700');vibrate(10);
        if(combo>1)addPop(c.x,c.y-34,combo+'x','#ff6b35');
        emitParts(c.x,c.y,6,'#ffd700',3,2);
        player.face='happy';setTimeout(()=>{if(player.alive)player.face='normal';},250);
      }
    }
  });
  // Reset combo if any uncollected coin goes off-screen
  const prevCoinCount=coins.length;
  coins=coins.filter(c=>{
    if(c.col)return false; // collected, remove
    if(c.x>-50)return true; // still on screen, keep
    // Missed coin went off-screen: break combo
    if(combo>0){combo=0;comboT=0;}
    return false;
  });

  // Items
  items.forEach(it=>{
    it.x-=speed;it.p+=0.06;
    if(!it.col){
      const dx=player.x-it.x,dy=player.y-it.y;
      if(Math.sqrt(dx*dx+dy*dy)<pr+it.sz){
        it.col=true;
        applyItem(it.t);
        addPop(it.x,it.y-18,ITEMS[it.t].name+'!',ITEMS[it.t].col);
        emitParts(it.x,it.y,12,ITEMS[it.t].col,4,3);
        player.face='happy';setTimeout(()=>{if(player.alive)player.face='normal';},300);
      }
    }
  });
  items=items.filter(it=>it.x>-50&&!it.col);

  // Enemies
  enemies.forEach(en=>{
    if(!en.alive)return;
    // Boss enemies with custom movement: handled by updateBossPhase
    if(en.bossType)return;
    en.fr+=0.12;
    // Boss enemies stay on screen (don't scroll off)
    if(en.boss){
      if(en.x>W-30)en.x-=speed;
      if(en.x<30)en.x=30;
    } else {
      en.x-=speed;
    }

    if(en.type===2){
      // Flying enemy: sine wave movement, no ground snapping
      en.flyPhase+=0.04;
      en.y=en.baseY+Math.sin(en.flyPhase)*en.flyAmp;
      en.baseY-=speed*0.02;
    } else if(en.type===0&&en.patrolDir!==undefined){
      // Walker with left-right patrol
      en.x+=en.patrolDir*en.walkSpd;
      if(!en.boss) en.patrolOriginX-=speed; // keep origin scrolling with terrain (not for boss)
      if(en.x>en.patrolOriginX+en.patrolRange) en.patrolDir=-1;
      if(en.x<en.patrolOriginX-en.patrolRange) en.patrolDir=1;
      // Keep on surface or fall off cliff
      if(en.gDir===1){
        const sy=floorSurfaceY(en.x);
        if(sy<H+100){en.y=sy-en.sz;en.vy=0;}
        else{en.vy=(en.vy||0)+GRAVITY;en.y+=en.vy;}
      }else{
        const sy=ceilSurfaceY(en.x);
        if(sy>-100){en.y=sy+en.sz;en.vy=0;}
        else{en.vy=(en.vy||0)-GRAVITY;en.y+=en.vy;}
      }
    } else if(en.type===3){
      // Bomber: small patrol, stays on ground
      if(en.patrolDir!==undefined){
        en.x+=en.patrolDir*en.walkSpd;
        en.patrolOriginX-=speed;
        if(en.x>en.patrolOriginX+en.patrolRange) en.patrolDir=-1;
        if(en.x<en.patrolOriginX-en.patrolRange) en.patrolDir=1;
      }
      const sy=floorSurfaceY(en.x);
      if(sy<H+100){en.y=sy-en.sz;en.vy=0;}
      else{en.vy=(en.vy||0)+GRAVITY;en.y+=en.vy;}
    } else if(en.type===4){
      // Vertical mover: bounces between floor and ceiling
      if(en.pauseT>0){
        en.pauseT--;
      } else {
        en.y+=en.moveDir*en.moveSpd;
        const floorY=floorSurfaceY(en.x);
        const ceilY2=ceilSurfaceY(en.x);
        if(en.y+en.sz>=floorY){
          en.y=floorY-en.sz;en.moveDir=-1;en.pauseT=20+Math.floor(Math.random()*15);en.gDir=1;
        }
        if(en.y-en.sz<=ceilY2){
          en.y=ceilY2+en.sz;en.moveDir=1;en.pauseT=20+Math.floor(Math.random()*15);en.gDir=-1;
        }
      }
    } else if(en.type===5){
      // Phantom: float with sine, periodically turn invisible
      en.flyPhase+=0.03;
      en.y=en.baseY+Math.sin(en.flyPhase)*en.flyAmp;
      en.baseY-=speed*0.01;
      en.visTimer++;
      if(en.visible&&en.visTimer>=en.visCycle){
        en.visible=false;en.visTimer=0;en.fadeT=20; // fade out over 20 frames
      } else if(!en.visible&&en.visTimer>=en.visCycle*0.6){
        en.visible=true;en.visTimer=0;en.fadeT=20; // fade in over 20 frames
      }
      if(en.fadeT>0)en.fadeT--;
    } else {
      // Default movement (type 1 cannon and legacy)
      en.x-=en.walkSpd;
      // Keep on surface or fall off cliff
      if(en.gDir===1){
        const sy=floorSurfaceY(en.x);
        if(sy<H+100){en.y=sy-en.sz;en.vy=0;}
        else{en.vy=(en.vy||0)+GRAVITY;en.y+=en.vy;}
      }else{
        const sy=ceilSurfaceY(en.x);
        if(sy>-100){en.y=sy+en.sz;en.vy=0;}
        else{en.vy=(en.vy||0)-GRAVITY;en.y+=en.vy;}
      }
    }
    // Collision with player (boss enemies handle their own collision)
    if(en.bossType)return;
    // Phantom: collision active even when invisible
    const dx=player.x-en.x,dy=player.y-en.y;
    const d=Math.sqrt(dx*dx+dy*dy);
    if(d<pr+en.sz){
      // Invincible: destroy enemy on contact
      if(itemEff.invincible>0){
        en.alive=false;
        sfx('stomp');vibrate(15);shakeI=4;
        const bon=Math.floor(10+Math.min(score*0.1,20));
        dist+=bon;
        addPop(en.x,en.y-en.sz*en.gDir,'+'+bon,'#ff00ff');
        emitParts(en.x,en.y,15,'#ff00ff',4,3);
        player.face='happy';setTimeout(()=>{if(player.alive)player.face='normal';},300);
        return;
      }
      // Fast kill trait (Flame): destroy on contact at high speed
      const fkill=ct().fastKill&&speed>4;
      // Check stomp: player approaching from the "top" of the enemy
      const stomped=fkill||(en.gDir===1&&player.y<en.y-en.sz*0.2&&player.vy>=0)||(en.gDir===-1&&player.y>en.y+en.sz*0.2&&player.vy<=0);
      if(stomped){
        en.alive=false;
        // Bounce player off enemy
        player.vy=-JUMP_POWER*0.7*player.gDir;
        player.grounded=false;
        flipCount=0;player.canFlip=true;djumpUsed=false;djumpAvailable=true;
        // Gravity stomp bonus: 3x if flipped recently
        const gstomp=flipTimer<40;
        const gsMul=gstomp?3:1;
        const bon=Math.floor((10+Math.min(score*0.1,20))*gsMul);
        dist+=bon;
        if(gstomp){sfx('gstomp');vibrate([20,10,30]);shakeI=8;}else{sfx('stomp');vibrate(15);}
        addPop(en.x,en.y-en.sz*en.gDir,'+'+bon,gstomp?'#ffd700':'#ff3860');
        if(gstomp){addPop(en.x,en.y-en.sz*en.gDir-22,'\u91CD\u529B\u30B9\u30C8\u30F3\u30D7!','#ffd700');emitParts(en.x,en.y,20,'#ffd700',5,4);}
        else{emitParts(en.x,en.y,12,'#ff3860',4,3);}
        player.face='happy';setTimeout(()=>{if(player.alive)player.face='normal';},300);
      }else{
        hurt();return;
      }
    }
  });
  enemies=enemies.filter(en=>(en.boss||en.x>-50)&&en.alive&&en.y>-200&&en.y<H+200);

  // Shooter enemies fire horizontal bullets at player's Y position
  enemies.forEach(en=>{
    if(!en.alive||en.type!==1)return;
    en.shootT--;
    if(en.shootT<=0&&en.x>0&&en.x<W+50){
      en.shootT=90+Math.floor(Math.random()*50);
      const bspd=4+speed*0.3;
      // Fire horizontally from the enemy's position
      bullets.push({x:en.x-en.sz,y:en.y,vx:-bspd,vy:0,sz:5,life:180});
      sfx('shoot');
    }
  });
  // Bomber enemies throw bombs in a parabolic arc toward player
  enemies.forEach(en=>{
    if(!en.alive||en.type!==3)return;
    en.bombCD--;
    if(en.bombCD<=0&&en.x>0&&en.x<W+50){
      en.bombCD=80+Math.floor(Math.random()*40);
      // Lob bomb toward player's approximate X position with arc
      const dx=player.x-en.x;
      const lobT=40+Math.random()*20; // frames to reach target area
      const bvx=dx/lobT-speed*0.3;
      const bvy=-(4+Math.random()*2); // upward initial velocity for arc
      bullets.push({x:en.x,y:en.y-en.sz,vx:bvx,vy:bvy,sz:7,life:120,bomb:true,grav:0.15});
      sfx('shoot');
      en.fr=0; // reset frame for throw animation
    }
  });

  // Update bullets
  const bpr=PLAYER_R*ct().sizeMul;
  bullets.forEach(b=>{
    b.x+=b.vx;b.y+=b.vy;b.life--;
    // Bomb gravity (parabolic arc)
    if(b.grav)b.vy+=b.grav;
    // Bomb explodes on ground contact
    if(b.bomb){
      const gy=floorSurfaceY(b.x);
      if(b.y+b.sz>=gy){
        b.life=0;
        emitParts(b.x,gy-5,10,'#ff6600',5,3);
        // Explosion damage check
        const edx=player.x-b.x,edy=player.y-gy;
        if(Math.sqrt(edx*edx+edy*edy)<50){hurt();}
        return;
      }
    }
    const dx=player.x-b.x,dy=player.y-b.y;
    if(Math.sqrt(dx*dx+dy*dy)<bpr+b.sz){
      b.life=0;
      if(b.bomb)emitParts(b.x,b.y,8,'#ff6600',4,2);
      hurt();
    }
  });
  bullets=bullets.filter(b=>b.life>0&&b.x>-50&&b.x<W+100&&b.y>-50&&b.y<H+50);

  // Wall collision: hitting the side of a higher platform step
  // Small steps (<=STEP_TOLERANCE) are auto-climbed when grounded; larger steps cause damage
  // Tire character: smoothly climbs steps up to 50% of character height (=radius)
  {
    const tireStepTol=isTire?pr:0; // tire: 50% of character height = radius
    const STEP_TOLERANCE=ct().stepTol||20;
    const effectiveTol=isTire?Math.max(STEP_TOLERANCE,tireStepTol):STEP_TOLERANCE;
    if(player.gDir===1){
      for(let i=0;i<platforms.length;i++){
        const p=platforms[i];
        if(p.x>player.x-pr&&p.x<player.x+pr+speed*2){
          const surfY=H-p.h;
          if(player.y+pr>surfY+4){
            const stepH=player.y+pr-surfY;
            if(isTire&&stepH<=tireStepTol&&player.grounded){
              // Tire: smooth roll-over for small steps
              player.y+=(surfY-pr-player.y)*0.45;
            } else if(stepH<=STEP_TOLERANCE&&player.grounded){
              player.y=surfY-pr; // auto step up
            } else {
              hurt();return;
            }
          }
        }
      }
    } else {
      for(let i=0;i<ceilPlats.length;i++){
        const p=ceilPlats[i];
        if(p.x>player.x-pr&&p.x<player.x+pr+speed*2){
          const surfY=p.h;
          if(player.y-pr<surfY-4){
            const stepH=surfY-(player.y-pr);
            if(isTire&&stepH<=tireStepTol&&player.grounded){
              // Tire: smooth roll-over for small steps
              player.y+=(surfY+pr-player.y)*0.45;
            } else if(stepH<=STEP_TOLERANCE&&player.grounded){
              player.y=surfY+pr; // auto step down (ceiling)
            } else {
              hurt();return;
            }
          }
        }
      }
    }
  }

  // Invincible particles (rainbow sparkle)
  if(itemEff.invincible>0&&frame%2===0){const a=Math.random()*6.28;const ic=['#ff00ff','#ffff00','#00ffff','#ff4444','#44ff44'][frame%5];parts.push({x:player.x+Math.cos(a)*22,y:player.y+Math.sin(a)*22,vx:Math.cos(a)*0.6,vy:Math.sin(a)*0.6,life:14,ml:14,sz:Math.random()*3.5+1.5,col:ic});}
  // Double jump available indicator
  if(djumpAvailable&&!djumpUsed&&frame%6===0){parts.push({x:player.x,y:player.y+pr*player.gDir+4*player.gDir,vx:(Math.random()-0.5)*0.5,vy:0.3*player.gDir,life:10,ml:10,sz:2,col:'#ffaa00'});}

  parts=parts.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.life--;return p.life>0;});
  stars.forEach(s=>{s.x-=s.sp*speed*0.3;s.tw+=s.ts;if(s.x<-5)s.x=W+5;});
  mtns.forEach(m=>{m.off-=m.sp*speed*0.15;if(m.off<-500)m.off+=500;});
}

// ===== AMBIENT PARTICLES (stage pack themes) =====
function updateAmbient(){
  if(!isPackMode)return;
  const st=STAGE_THEMES[currentPackIdx];if(!st)return;
  const pt=st.partType;
  if(frame%4===0){
    if(pt==='twinkle'){ambientParts.push({x:W+5,y:Math.random()*H,vx:-0.3-Math.random()*0.5,vy:(Math.random()-0.5)*0.3,life:120,ml:120,sz:Math.random()*2+1,col:st.partCol,tw:Math.random()*6.28});}
    else if(pt==='snow'){ambientParts.push({x:Math.random()*W,y:-5,vx:(Math.random()-0.5)*0.5-0.3,vy:0.5+Math.random()*1,life:200,ml:200,sz:Math.random()*3+1,col:'#ffffff'});}
    else if(pt==='ember'){ambientParts.push({x:Math.random()*W,y:H+5,vx:(Math.random()-0.5)*0.8,vy:-1-Math.random()*2,life:100,ml:100,sz:Math.random()*3+1,col:['#ff4400','#ff6600','#ffaa00'][Math.floor(Math.random()*3)]});}
    else if(pt==='bubble'){ambientParts.push({x:Math.random()*W,y:H+5,vx:(Math.random()-0.5)*0.3,vy:-0.5-Math.random()*0.8,life:180,ml:180,sz:Math.random()*4+2,col:'#66ccff44'});}
    else if(pt==='petal'){ambientParts.push({x:W+5,y:Math.random()*H*0.7,vx:-1-Math.random()*1.5,vy:0.3+Math.random()*0.8,life:150,ml:150,sz:Math.random()*4+2,col:['#ffaacc','#ff88bb','#ffccdd'][Math.floor(Math.random()*3)]});}
  }
  ambientParts=ambientParts.filter(p=>{p.x+=p.vx;p.y+=p.vy;if(p.tw!==undefined)p.tw+=0.05;p.life--;return p.life>0;});
}
function drawAmbient(){
  ambientParts.forEach(p=>{
    const a=(p.life/p.ml)*0.6;ctx.globalAlpha=a;
    const st=STAGE_THEMES[currentPackIdx];
    if(st&&st.partType==='bubble'){
      ctx.strokeStyle=p.col;ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,6.28);ctx.stroke();
    } else if(st&&st.partType==='twinkle'){
      ctx.globalAlpha=a*(0.5+Math.sin(p.tw||0)*0.5);
      ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,6.28);ctx.fill();
    } else if(st&&st.partType==='petal'){
      ctx.fillStyle=p.col;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.life*0.05);
      ctx.beginPath();ctx.ellipse(0,0,p.sz,p.sz*0.5,0,0,6.28);ctx.fill();ctx.restore();
    } else {
      ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,6.28);ctx.fill();
    }
  });
  ctx.globalAlpha=1;
}
