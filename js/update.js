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
  fip(pops,p=>{p.y-=1.2;p.life--;return p.life>0;});

  if(state===ST.PAUSE)return; // freeze everything while paused

  if(state===ST.COUNTDOWN){
    countdownT--;
    // Play SE at each second mark (3, 2, 1) - 179 because it decremented already
    if(countdownT===179||countdownT===119||countdownT===59)sfx('countdown');
    // Play GO sound and transition to play
    if(countdownT<=0){
      sfx('countgo');
      state=ST.PLAY;
      if(isChallengeMode){
        switchBGM('challenge');challengeNextBossT=60; // brief delay then first boss
      } else {
        switchBGM('play');
      }
    }
    // Animate background during countdown
    stars.forEach(s=>{s.x-=s.sp*0.3;s.tw+=s.ts;if(s.x<-5)s.x=W+5;});
    mtns.forEach(m=>{m.off-=m.sp*0.2;if(m.off<-500)m.off+=500;});
    return;
  }

  if(state===ST.LOGIN){
    loginT+=0.03;
    stars.forEach(s=>{s.x-=s.sp*0.2;s.tw+=s.ts;if(s.x<-5)s.x=W+5;});
    return;
  }
  if(state===ST.TUTORIAL){
    frame++;tutStepT++;
    if(tutPhase==='success')tutSuccessT++;
    // Warp transition animation
    if(tutWarpPhase==='welcome'||tutWarpPhase==='warp'){
      tutWarpT++;
      if(tutWarpPhase==='warp'&&tutWarpT>150){
        state=ST.TITLE;switchBGM('title');tutWarpPhase='';tutWarpT=0;
        screenFadeIn=90;
      }
      return;
    }
    // Background scroll (also scroll during 'action' phase)
    const scrollSpd=(tutPhase==='scroll'||tutPhase==='action'||tutPhase==='success')?tutSpeed:0;
    stars.forEach(s=>{s.x-=s.sp*scrollSpd*0.3;s.tw+=s.ts;if(s.x<-5)s.x=W+5;});
    mtns.forEach(m=>{m.off-=m.sp*scrollSpd*0.15;if(m.off<-500)m.off+=500;});
    // Scroll camera (also during success so player clears obstacles)
    if(tutPhase==='scroll'||tutPhase==='action'||tutPhase==='success'){
      tutScrollX+=scrollSpd;
      // Only detect checkpoints during scroll phase (not action)
      if(tutPhase==='scroll'){
        if(tutStep<TUT_CHECKPOINTS.length){
          const cp=TUT_CHECKPOINTS[tutStep];
          if(tutScrollX>=cp.dist){
            tutScrollX=cp.dist;tutPhase='wait';tutWaiting=true;tutStepT=0;
            if(cp.type==='bomb')bombCount=1;
          }
        }
        if(tutStep>=TUT_CHECKPOINTS.length&&tutPhase!=='transition'){
          tutPhase='transition';tutSuccessT=0;
        }
      }
    }
    // Player gravity physics (freeze during double-flip mid-air pause)
    if(!player.grounded&&!tutFreezePlayer){player.vy+=GRAVITY*player.gDir;player.y+=player.vy;}
    player.x=W*0.25;
    // Platform collision (world-space)
    const wpx=player.x+tutScrollX,tpr=PLAYER_R;
    let onFloor2=false,onCeil2=false;
    tutCoursePlats.forEach(p=>{
      if(wpx>=p.x&&wpx<=p.x+p.w){
        const surfY=H-p.h;
        if(player.gDir===1&&player.y+tpr>=surfY&&player.vy>=0){
          player.y=surfY-tpr;player.vy=0;player.grounded=true;onFloor2=true;
        }
      }
    });
    tutCourseCeil.forEach(p=>{
      if(wpx>=p.x&&wpx<=p.x+p.w){
        const surfY=p.h;
        if(player.gDir===-1&&player.y-tpr<=surfY&&player.vy<=0){
          player.y=surfY+tpr;player.vy=0;player.grounded=true;onCeil2=true;
        }
      }
    });
    if(player.gDir===1&&!onFloor2&&player.grounded)player.grounded=false;
    if(player.gDir===-1&&!onCeil2&&player.grounded)player.grounded=false;
    if(player.y>H+50){player.y=H-GROUND_H-tpr;player.vy=0;player.gDir=1;player.grounded=true;}
    if(player.y<-50){player.y=GROUND_H+tpr;player.vy=0;player.gDir=-1;player.grounded=true;}
    player.rot+=(player.rotTarget-player.rot)*0.15;
    // Spawn enemies for bomb (realistic size and walking on floor like real game)
    if(tutStep<TUT_CHECKPOINTS.length&&TUT_CHECKPOINTS[tutStep].type==='bomb'&&tutPhase==='wait'&&!tutEnemySpawned){
      tutEnemySpawned=true;
      const eSz=13; // same as real game enemy size
      for(let i=0;i<5;i++){
        const ex=tutScrollX+W*0.5+i*38;
        enemies.push({x:ex-tutScrollX,y:H-GROUND_H-eSz,vy:0,gDir:1,sz:eSz,alive:true,type:0,
          shootT:999,fr:Math.random()*100,boss:false,_worldX:ex,
          patrolDir:Math.random()<0.5?1:-1,walkSpd:0.3,patrolOriginX:ex,patrolRange:18});
      }
    }
    enemies.forEach(en=>{
      if(!en.alive)return;
      en.fr+=0.12;
      if(en._worldX!==undefined){
        // Patrol walk in world-space
        if(en.patrolDir!==undefined){
          en._worldX+=en.patrolDir*(en.walkSpd||0);
          if(en._worldX>en.patrolOriginX+en.patrolRange)en.patrolDir=-1;
          if(en._worldX<en.patrolOriginX-en.patrolRange)en.patrolDir=1;
        }
        en.x=en._worldX-tutScrollX;
        en.y=H-GROUND_H-en.sz; // keep on floor
      }
    });
    fip(parts,p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.07;p.vx*=0.99;p.life--;return p.life>0;});
    fip(pops,p=>{p.y-=1.2;p.life--;return p.life>0;});
    if(bombFlashT>0)bombFlashT--;
    if(itemEff.invincible>0)itemEff.invincible--;
    return;
  }
  if(state===ST.STAGE_SEL){frame++;return;}
  if(state===ST.TITLE){
    // Auto-show update info on first title entry (if not dismissed)
    if(!updateInfoShown&&localStorage.getItem('gd5updateDismissed')!==UPDATE_VER){
      updateInfoShown=true;updateInfoOpen=true;
    }
    titleT+=0.03;
    if(screenFadeIn>0)screenFadeIn--;
    if(unlockCelebT>0)unlockCelebT--;
    if(charModal.show)charModal.animT++;
    stars.forEach(s=>{s.x-=s.sp*SPEED_INIT*0.3;s.tw+=s.ts;if(s.x<-5)s.x=W+5;});
    mtns.forEach(m=>{m.off-=m.sp*SPEED_INIT*0.15;if(m.off<-500)m.off+=500;});
    updateDemo();
    // Inventory/dead chest opening state machine
    if((inventoryOpen||deadChestOpen)&&chestOpen.phase!=='none'){
      chestOpen.t++;
      if(chestOpen.phase==='wobble'&&chestOpen.t>=50){
        chestOpen.phase='burst';chestOpen.t=0;sfxChestOpen();shakeI=15;vibrate([30,20,40,20,80]);
      }
      else if(chestOpen.phase==='burst'&&chestOpen.t>=40){
        chestOpen.phase='reveal';chestOpen.t=0;
        if(chestOpen.reward&&chestOpen.reward.type==='coin'){
          walletCoins+=chestOpen.reward.amount;localStorage.setItem('gd5wallet',walletCoins.toString());
        }
        if(chestOpen.reward&&chestOpen.reward.type==='char'){
          sfxSuperRare();shakeI=25;vibrate([40,20,60,30,80,40,100]);
          if(chestOpen.reward.isNew){
            unlockCharFromChest(chestOpen.reward.charIdx);
          } else {
            chestOpen.reward.bonusCoins=500;
            walletCoins+=500;localStorage.setItem('gd5wallet',walletCoins.toString());
          }
        }
        if(chestOpen.reward&&chestOpen.reward.type==='cosmetic'){
          if(chestOpen.reward.item.rarity==='super_rare'){
            sfxSuperRare();shakeI=30;vibrate([50,20,70,30,90,40,120]);
          }
          if(!chestOpen.reward.isNew){
            walletCoins+=300;localStorage.setItem('gd5wallet',walletCoins.toString());
          }
        }
      }
      else if(chestOpen.phase==='reveal'){
        const revealLen=chestOpen.reward&&chestOpen.reward.type==='char'?140:
          (chestOpen.reward&&chestOpen.reward.type==='cosmetic'&&chestOpen.reward.item&&chestOpen.reward.item.rarity==='super_rare')?160:90;
        if(chestOpen.t>=revealLen){
          if(chestBatchMode){
            // Auto-advance in batch mode: collect result and open next
            chestBatchResults.push(chestOpen.reward);
            if(storedChests>0){
              startInventoryChestOpen();
              chestOpen.phase='wobble';chestOpen.t=0;
              totalChestsOpened++;localStorage.setItem('gd5chestTotal',totalChestsOpened.toString());
              storedChests--;localStorage.setItem('gd5storedChests',storedChests.toString());
            } else {
              chestOpen.phase='batchDone';chestOpen.t=0;chestBatchMode=false;
            }
          } else {
            chestOpen.phase='done';chestOpen.t=0;
          }
        }
      }
      else if(chestOpen.phase==='batchDone'){
        // Just increment timer for sparkle animation
      }
    }
    return;
  }
  if(state===ST.DEAD){
    deadT++;
    fip(parts,p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.07;p.vx*=0.99;p.life--;return p.life>0;});
    stars.forEach(s=>{s.x-=s.sp*0.15;s.tw+=s.ts;if(s.x<-5)s.x=W+5;});
    // Chest opening on death screen
    if(deadChestOpen&&chestOpen.phase!=='none'){
      chestOpen.t++;
      if(chestOpen.phase==='wobble'&&chestOpen.t>=50){
        chestOpen.phase='burst';chestOpen.t=0;sfxChestOpen();shakeI=15;vibrate([30,20,40,20,80]);
      }
      else if(chestOpen.phase==='burst'&&chestOpen.t>=40){
        chestOpen.phase='reveal';chestOpen.t=0;
        if(chestOpen.reward&&chestOpen.reward.type==='coin'){
          walletCoins+=chestOpen.reward.amount;localStorage.setItem('gd5wallet',walletCoins.toString());
        }
        if(chestOpen.reward&&chestOpen.reward.type==='char'){
          sfxSuperRare();shakeI=25;vibrate([40,20,60,30,80,40,100]);
          if(chestOpen.reward.isNew){unlockCharFromChest(chestOpen.reward.charIdx);}
          else{chestOpen.reward.bonusCoins=500;walletCoins+=500;localStorage.setItem('gd5wallet',walletCoins.toString());}
        }
        if(chestOpen.reward&&chestOpen.reward.type==='cosmetic'){
          if(chestOpen.reward.item.rarity==='super_rare'){
            sfxSuperRare();shakeI=30;vibrate([50,20,70,30,90,40,120]);
          }
          if(!chestOpen.reward.isNew){
            walletCoins+=300;localStorage.setItem('gd5wallet',walletCoins.toString());
          }
        }
      }
      else if(chestOpen.phase==='reveal'){
        const revealLen=chestOpen.reward&&chestOpen.reward.type==='char'?140:
          (chestOpen.reward&&chestOpen.reward.type==='cosmetic'&&chestOpen.reward.item&&chestOpen.reward.item.rarity==='super_rare')?160:90;
        if(chestOpen.t>=revealLen){chestOpen.phase='done';chestOpen.t=0;}
      }
    }
    return;
  }
  if(state===ST.STAGE_CLEAR){
    stageClearT++;
    fip(parts,p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.05;p.vx*=0.99;p.life--;return p.life>0;});
    // Spawn celebration particles — massive confetti burst
    if(stageClearT<90&&stageClearT%2===0){
      for(let i=0;i<5;i++){
        const cx=W*Math.random(),cy=-10;
        parts.push({x:cx,y:cy,vx:(Math.random()-0.5)*4,vy:1.5+Math.random()*3,life:70+Math.random()*40,ml:110,sz:Math.random()*6+2,col:['#ffd700','#00e5ff','#ff3860','#34d399','#a855f7','#ff6600'][Math.floor(Math.random()*6)]});
      }
    }
    // Firework bursts at specific frames
    if(stageClearT===15||stageClearT===35||stageClearT===55||stageClearT===75){
      const bx=W*0.2+Math.random()*W*0.6,by=H*0.15+Math.random()*H*0.3;
      for(let i=0;i<20;i++){
        const a=6.28/20*i,s=3+Math.random()*5;
        parts.push({x:bx,y:by,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:40+Math.random()*20,ml:60,sz:Math.random()*4+2,col:['#ffd700','#ff3860','#00e5ff','#34d399'][i%4]});
      }
    }
    return;
  }

  // === PLAYING ===
  // Ghost character periodic transparency (immune to enemy attacks while transparent)
  if(ct().shape==='ghost'){
    // Use equipped skin color for ghost particles (default: ghost's own color)
    const _sd=getEquippedSkinData();
    const ghostCol=_sd?(_sd.col==='rainbow'?'#ff00ff':_sd.col):ct().col;
    ghostPhaseT++;
    if(ghostInvis&&ghostPhaseT>=60){
      ghostInvis=false;ghostPhaseT=0;
      emitParts(player.x,player.y,6,ghostCol,2,1);
    } else if(!ghostInvis&&ghostPhaseT>=60){
      ghostInvis=true;ghostPhaseT=0;
      emitParts(player.x,player.y,8,ghostCol,3,2);
    }
    // Shimmer particles while invisible (use skin color + alpha)
    if(ghostInvis&&frame%6===0){
      parts.push({x:player.x+(Math.random()-0.5)*20,y:player.y+(Math.random()-0.5)*20,
        vx:(Math.random()-0.5)*0.5,vy:(Math.random()-0.5)*0.5,
        life:10,ml:10,sz:Math.random()*2+1,col:ghostCol+'66'});
    }
  } else {ghostInvis=false;ghostPhaseT=0;}
  // Hurt invincibility timer
  if(hurtT>0)hurtT--;
  // Item timers
  const wasInvincible=itemEff.invincible>0;
  const prevInvT=itemEff.invincible;
  for(const k in itemEff)if(itemEff[k]>0)itemEff[k]--;
  if(wasInvincible&&itemEff.invincible<=0&&state===ST.PLAY){
    switchBGM(bossPhase.active?'boss':'play');
  }

  if(isPackMode&&currentPackStage){
    speed=SPEED_INIT*currentPackStage.spdMul*ct().speedMul;
  } else {
    speed=Math.min(SPEED_MAX,(SPEED_INIT+(dist-speedOffset)*SPEED_INC))*ct().speedMul;
  }

  // Distance scoring (score freezes during boss, catches up on victory)
  dist+=speed*0.08;
  rawDist+=speed*0.08;
  if(!bossPhase.active){
    const ns=Math.floor(dist);
    if(ns>score){
      score=ns;checkMile();
    }
  }
  // Theme change every 1000 dist (fixed interval, independent of score/coins)
  if(!isPackMode){
    const newThemeIdx=Math.min(Math.floor(dist/1000),THEMES.length-1);
    if(newThemeIdx!==curTheme){
      prevTheme=curTheme;curTheme=newThemeIdx;themeLerp=0;
      addPop(W/2,H*0.55,THEMES[curTheme].n+'!','#00e5ff');
    }
  }
  // BGM progression
  if(!isPackMode&&!bossPhase.active&&itemEff.invincible<=0&&state===ST.PLAY){
    const newBGM=getPlayBGMType();
    if(bgmCurrent!==newBGM&&bgmCurrent!=='boss'&&bgmCurrent!=='fever'){
      switchBGM('play');
    }
  }

  // Platform scrolling
  platforms.forEach(p=>p.x-=speed);
  ceilPlats.forEach(p=>p.x-=speed);
  floatPlats.forEach(p=>p.x-=speed);
  spikes.forEach(s=>s.x-=speed);
  movingHills.forEach(h=>{h.x-=speed;h.phase+=h.spd;});
  gravZones.forEach(g=>g.x-=speed);
  // Remove off-screen platforms
  fip(platforms,p=>p.x+p.w>-50);
  fip(ceilPlats,p=>p.x+p.w>-50);
  fip(floatPlats,p=>p.x+p.w>-50);
  fip(spikes,s=>s.x+s.w>-50);
  fip(movingHills,h=>h.x+h.w>-50);
  fip(gravZones,g=>g.x+g.w>-50&&g.fadeT<60);
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
    // Pack mode: boss stage trigger at 90% distance
    if(currentPackStage.boss&&!bossPhase.active&&!bossPhase.reward&&dist>=currentPackStage.dist*0.9&&bossPhase.bossCount===0){
      // Trigger boss fight - set HP to 3 for boss fight
      hp=3;
      bossPhase.nextAt=0; // trigger immediately
      startBossPhase();
    }
    // Pack mode: update boss phase
    if(bossPhase.active||bossPhase.reward){
      updateBossPhase();
      // After boss reward phase completes in pack mode, trigger stage clear
      if(!bossPhase.active&&!bossPhase.reward&&bossPhase.bossCount>0){
        // Boss defeated → stage clear
        state=ST.STAGE_CLEAR;stageClearT=0;gotNewStars=0;
        sfxFanfare();vibrate([30,20,30,20,60]);shakeI=8;
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
        fbSaveUserData();
        switchBGM('title');
        for(let i=0;i<50;i++)parts.push({x:W*Math.random(),y:-10,vx:(Math.random()-0.5)*4,vy:1+Math.random()*4,life:80+Math.random()*40,ml:120,sz:Math.random()*6+2,col:['#ffd700','#00e5ff','#ff3860','#34d399','#a855f7'][i%5]});
      }
    }
    // Pack mode clear check (non-boss stages)
    if(!currentPackStage.boss&&dist>=currentPackStage.dist){
      state=ST.STAGE_CLEAR;stageClearT=0;gotNewStars=0;
      sfxFanfare();vibrate([30,20,30,20,60]);shakeI=8;
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
      fbSaveUserData();
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
        sfx('bigcoin');vibrate([20,10,20,10,40]);shakeI=8;
        addPop(bc.x,bc.y-20,'\u2605 STAR!','#ffd700');
        emitParts(bc.x,bc.y,25,'#ffd700',6,4);
      }
    });
    // Enemy spawning in pack mode (much more aggressive than endless)
    const sType=currentPackStage.stageType||'';
    const pastGoal=dist>=currentPackStage.dist*0.92;
    if(currentPackStage.enemyChance&&!pastGoal){
      const stageProgress=dist/currentPackStage.dist;
      const baseRate=currentPackStage.enemyChance;
      const progressBoost=1+stageProgress*1.5;
      // Swarm stages: spawn enemies very frequently
      const swarmMul=sType==='swarm'?1.8:1;
      if(packRng()<baseRate*progressBoost*0.5*swarmMul) trySpawnEnemy();
    }
    // Stage mode gimmicks based on stageType
    const nearGoal=dist>=currentPackStage.dist*0.92;
    if(sType==='gravity'){
      // Gravity stage: massive gravity zone spawning (no platform needed)
      if(!nearGoal){
        if(gravZoneCD>0)gravZoneCD--;
        if(gravZoneCD<=0){
          const gx=W+20+packRng()*80;
          const gw=50+packRng()*60;
          const gdir=packRng()<0.5?1:-1;
          gravZones.push({x:gx,w:gw,triggered:false,fadeT:0,dir:gdir});
          gravZoneCD=8+Math.floor(packRng()*30); // very dense: 8-37 frames
        }
      }
    } else if(sType==='void'){
      // Void stage: wall-heavy stage with gravity navigation
      if(!nearGoal){
        // Dense gravity zones for wall avoidance
        if(gravZoneCD>0)gravZoneCD--;
        if(gravZoneCD<=0){
          const gx=W+20+packRng()*60;
          const gw=40+packRng()*50;
          const gdir=packRng()<0.5?1:-1;
          gravZones.push({x:gx,w:gw,triggered:false,fadeT:0,dir:gdir});
          gravZoneCD=15+Math.floor(packRng()*25);
        }
        trySpawnMovingHill();trySpawnMovingHill(); // some dynamic obstacles
        trySpawnFloatPlat(); // helpful floating platforms
      }
    } else if(sType==='chasm'){
      // Chasm stage: gravity zones + floating platforms for up/down navigation
      if(!nearGoal){
        trySpawnGravZone();
        trySpawnFloatPlat();trySpawnFloatPlat();
        trySpawnMovingHill();
      }
    } else if(sType==='moving'){
      // Moving-only stage: heavy moving hills + floating platforms
      if(!nearGoal){
        trySpawnMovingHill();trySpawnMovingHill();
        trySpawnFloatPlat();trySpawnFloatPlat();
        trySpawnFallingMtn();
      }
    } else if(sType==='swarm'){
      // Swarm stage: primarily enemies, add floating platforms
      if(!nearGoal){
        trySpawnFloatPlat();trySpawnFloatPlat();
        trySpawnMovingHill();
        trySpawnSpike();
      }
    } else {
      // Normal stage: all gimmicks
      if(!nearGoal){
        trySpawnFloatPlat();
        trySpawnSpike();
        trySpawnMovingHill();
        trySpawnGravZone();
        trySpawnFallingMtn();
      }
    }
    // Ambient particles for theme
    updateAmbient();
  }
  // === CHALLENGE MODE: flat terrain + boss rush ===
  if(isChallengeMode){
    // Generate flat terrain (always)
    if(platforms.length===0)platforms.push({x:player.x-30,w:200,h:GROUND_H});
    if(ceilPlats.length===0)ceilPlats.push({x:player.x-30,w:200,h:GROUND_H});
    while(platforms[platforms.length-1].x+platforms[platforms.length-1].w<W+300){
      const last=platforms[platforms.length-1];
      platforms.push({x:last.x+last.w,w:150+Math.random()*100,h:GROUND_H});
    }
    while(ceilPlats[ceilPlats.length-1].x+ceilPlats[ceilPlats.length-1].w<W+300){
      const last=ceilPlats[ceilPlats.length-1];
      ceilPlats.push({x:last.x+last.w,w:150+Math.random()*100,h:GROUND_H});
    }
    // Floor collapse animation update
    if(challCollapse.active){
      updateChallCollapse();
    }
    // Boss chaining: spawn next boss after collapse ends
    if(challengeNextBossT>0&&!challCollapse.active){
      challengeNextBossT--;
      if(challengeNextBossT<=0){
        // Challenge: no HP recovery here (HP +1 already given at boss defeat)
        // Set bossCount for scaling: base + phase boost
        bossPhase.bossCount=challengeKills+challengePhase*3;
        startBossPhase();
      }
    }
    // After boss reward ends, trigger floor collapse
    if(!bossPhase.active&&!bossPhase.reward&&bossPhase.bossCount>0&&challengeNextBossT<=0&&!challCollapse.active){
      challengeKills++;
      challengePhase=Math.floor(challengeKills/3);
      challCollapse.waveNum=challengeKills+1;
      // Start floor collapse sequence
      startChallCollapse();
    }
    // Update boss phase during challenge
    if(bossPhase.active||bossPhase.reward){
      updateBossPhase();
    }
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

    // Abyss phase: score 6000+, occasionally force massive floor gaps
    if(abyssPhase.cd>0)abyssPhase.cd--;
    if(!abyssPhase.active&&abyssPhase.cd<=0&&score>=6000&&!bossPhase.active){
      if(Math.random()<0.005){
        abyssPhase.active=true;
        abyssPhase.len=8+Math.floor(Math.random()*6); // 8-13 platforms of heavy gaps
      }
    }
    // Gravity rush phase: score 5000+, occasionally force many gravity zones
    if(gravRushPhase.cd>0)gravRushPhase.cd--;
    if(!gravRushPhase.active&&gravRushPhase.cd<=0&&score>=5000&&!bossPhase.active){
      if(Math.random()<0.005){
        gravRushPhase.active=true;
        gravRushPhase.len=6+Math.floor(Math.random()*5); // 6-10 rapid gravity zones
      }
    }
    // Terrain gimmick phase: score 8000+, occasionally force falling-floor-only or moving-floor-only
    if(terrainGimmickPhase.cd>0)terrainGimmickPhase.cd--;
    if(!terrainGimmickPhase.active&&terrainGimmickPhase.cd<=0&&score>=8000&&!bossPhase.active){
      if(Math.random()<0.004){
        terrainGimmickPhase.active=true;
        terrainGimmickPhase.type=Math.random()<0.5?'falling':'moving';
        terrainGimmickPhase.len=5+Math.floor(Math.random()*4); // 5-8 spawns
      }
    }

    let lastF=platforms[platforms.length-1];
    let lastC=ceilPlats[ceilPlats.length-1];
    while(lastF.x+lastF.w<W+300){
      const forceFloorGap=flipZone.active&&flipZone.type===0&&flipZone.len>0;
      generatePlatform(platforms,false,forceFloorGap);
      if(forceFloorGap){flipZone.len--;if(flipZone.len<=0){flipZone.active=false;flipZone.cd=120+Math.floor(Math.random()*100);}}
      // Abyss phase: count down platforms generated
      if(abyssPhase.active){abyssPhase.len--;if(abyssPhase.len<=0){abyssPhase.active=false;abyssPhase.cd=600+Math.floor(Math.random()*400);}}
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
    trySpawnGravZone();
    trySpawnFallingMtn();
    trySpawnCoinSwitch();
    // Boss phase trigger
    if(!bossPhase.active&&rawDist>=bossPhase.nextAt){
      startBossPhase();
    }
    updateBossPhase();
    // During boss prepare/active, cancel flip zones and special phases
    if(bossPhase.active){flipZone.active=false;flipZone.cd=200;abyssPhase.active=false;abyssPhase.cd=300;gravRushPhase.active=false;gravRushPhase.cd=300;terrainGimmickPhase.active=false;terrainGimmickPhase.cd=300;}
  }

  // Physics
  flipTimer++;
  const pr=PLAYER_R*ct().sizeMul;
  // Quake stun: completely freeze player (no gravity, no movement)
  if(player._quakeStunned){
    player.vy=0;
  } else {
    const grav=GRAVITY*player.gDir*ct().gravMul;
    player.vy+=grav;
    player.vy=Math.max(-14,Math.min(14,player.vy));
  }
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

  // Wall collision removed: was causing players to get caught on floor edges
  // and pushed offscreen. Step-up collision at bottom of update handles edge cases.

  // Drop-through timer countdown (extend while still overlapping a float plat)
  if(player._dropThrough>0){
    let stillInside=false;
    for(let fi=0;fi<floatPlats.length;fi++){
      const fp=floatPlats[fi];
      if(player.x+pr>fp.x&&player.x-pr<fp.x+fp.w&&player.y+pr>fp.y&&player.y-pr<fp.y+fp.th){
        stillInside=true;break;
      }
    }
    if(stillInside){player._dropThrough=Math.max(player._dropThrough,4);} // keep active while overlapping
    else{player._dropThrough--;}
  }
  // Clear onFloatPlat when not grounded
  if(!player.grounded)player._onFloatPlat=null;
  // Floating platform collision (mid-air landing + wall)
  if(!player.grounded&&!player._dropThrough){
    for(let fi=0;fi<floatPlats.length;fi++){
      const fp=floatPlats[fi];
      if(player.x>=fp.x-pr*0.5&&player.x<=fp.x+fp.w+pr*0.5){
        if(player.gDir===1&&player.vy>=0){
          if(player.y+pr>=fp.y&&player.y+pr<fp.y+fp.th+8){
            player.y=fp.y-pr;player.vy=0;player.grounded=true;player.canFlip=true;flipCount=0;djumpUsed=false;if(ct().hasDjump)djumpAvailable=true;
            player._onFloatPlat=fp;
            break;
          }
        } else if(player.gDir===-1&&player.vy<=0){
          if(player.y-pr<=fp.y+fp.th&&player.y-pr>fp.y-8){
            player.y=fp.y+fp.th+pr;player.vy=0;player.grounded=true;player.canFlip=true;flipCount=0;djumpUsed=false;if(ct().hasDjump)djumpAvailable=true;
            player._onFloatPlat=fp;
            break;
          }
        }
      }
    }
  }
  // Reset air combo when grounded
  if(player.grounded)airCombo=0;

  // Spike gimmick update & collision (proximity-triggered: activates when player approaches)
  spikes.forEach(sp=>{
    sp.timer++;
    const playerNear=player.x+pr>sp.x-100&&player.x-pr<sp.x+sp.w+30;
    if(sp.state==='hidden'){
      if(playerNear){sp.state='warning';sp.timer=0;}
    } else if(sp.state==='warning'&&sp.timer>=20){
      sp.state='up';sp.timer=0;
    } else if(sp.state==='up'){
      sp.timer++;
      if(sp.timer>=sp.upTime||(!playerNear&&sp.timer>30)){sp.state='retracting';sp.timer=0;}
    } else if(sp.state==='retracting'&&sp.timer>=15){
      sp.state='hidden';sp.timer=0;
    }
    // Collision when spikes are up
    if(sp.state==='up'&&itemEff.invincible<=0&&hurtT<=0){
      if(player.x+pr>sp.x&&player.x-pr<sp.x+sp.w){
        if(sp.isFloor){
          // Floor spike: points up from baseY
          const spTopY=sp.h-sp.spikeH;
          if(player.y+pr>spTopY&&player.y-pr<sp.h) hurt(true);
        } else {
          // Ceiling spike: points down from baseY
          const spBotY=sp.h+sp.spikeH;
          if(player.y+pr>sp.h&&player.y-pr<spBotY) hurt(true);
        }
      }
    }
  });

  // Moving hill collision (acts as temporary elevated terrain, both floor and ceiling)
  movingHills.forEach(mh=>{
    const curH=mh.baseH+Math.sin(mh.phase)*mh.ampH;
    if(player.x+pr>mh.x&&player.x-pr<mh.x+mh.w){
      const surfY=mh.isFloor?H-curH:curH;
      const thickness=20;
      if(!mh.isFloor){
        // Ceiling moving hill - landing
        if(player.gDir===-1){
          if(player.y-pr<=surfY&&player.y-pr>surfY-20&&player.vy<=0){
            player.y=surfY+pr;player.vy=0;player.grounded=true;player.canFlip=true;flipCount=0;djumpUsed=false;if(ct().hasDjump)djumpAvailable=true;
          } else if(player.y-pr<surfY-4&&player.y+pr>surfY&&player.grounded){
            player.y=surfY+pr;
          }
        }
      } else {
        // Floor moving hill - landing
        if(player.gDir===1){
          if(player.y+pr>=surfY&&player.y+pr<surfY+20&&player.vy>=0){
            player.y=surfY-pr;player.vy=0;player.grounded=true;player.canFlip=true;flipCount=0;djumpUsed=false;if(ct().hasDjump)djumpAvailable=true;
          } else if(player.y+pr>surfY+4&&player.y-pr<surfY&&player.grounded){
            player.y=surfY-pr;
          }
        }
      }
    }
  });

  // Gravity zones: blue=force down (dir=1), pink=force up (dir=-1)
  gravZones.forEach(g=>{
    if(g.fadeT>0){g.fadeT++;return;}
    if(g.triggered)return;
    if(player.x>=g.x&&player.x<=g.x+g.w){
      g.triggered=true;g.fadeT=1;
      const forceDir=g.dir||1;
      // Force gravity direction and reset movement state so player can act again
      player.gDir=forceDir;player.vy=0;
      flipCount=0;player.canFlip=true;djumpUsed=false;if(ct().hasDjump)djumpAvailable=true;
      const col=forceDir===1?'#4488ff':'#ff66aa';
      if(forceDir===1)sfxGravDown();else sfxGravUp();
      vibrate([20,10,30]);shakeI=8;
      emitParts(player.x,player.y,15,col,4,3);
      addPop(player.x,player.y-20*player.gDir,forceDir===1?'DOWN!':'UP!',col);
    }
  });

  // Falling mountain update (supports both floor and ceiling)
  fallingMtns.forEach(fm=>{
    fm.x-=speed;
    const isCeil=!fm.isFloor;
    if(fm.state==='idle'){
      // Auto-trigger when visible on screen (before player reaches it)
      if(fm.x<W+20){fm.state='shaking';fm.shakeT=60;}
      if(!isCeil){
        const surfY2=H-fm.curH;
        if(player.gDir===1&&player.x+pr>fm.x&&player.x-pr<fm.x+fm.w){
          if(player.y+pr>=surfY2&&player.y+pr<surfY2+12&&player.vy>=0){
            player.y=surfY2-pr;player.vy=0;player.grounded=true;player.canFlip=true;flipCount=0;djumpUsed=false;djumpAvailable=true;
          }
        }
      } else {
        const surfY2=fm.curH;
        if(player.gDir===-1&&player.x+pr>fm.x&&player.x-pr<fm.x+fm.w){
          if(player.y-pr<=surfY2&&player.y-pr>surfY2-12&&player.vy<=0){
            player.y=surfY2+pr;player.vy=0;player.grounded=true;player.canFlip=true;flipCount=0;djumpUsed=false;djumpAvailable=true;
          }
        }
      }
    } else if(fm.state==='shaking'){
      fm.shakeT--;
      fm.shakeAmt=Math.sin(fm.shakeT*0.8)*(2+(60-fm.shakeT)*0.05);
      if(!isCeil){
        const surfY2=H-fm.curH;
        if(player.gDir===1&&player.x+pr>fm.x&&player.x-pr<fm.x+fm.w){
          if(player.y+pr>=surfY2&&player.y+pr<surfY2+12&&player.vy>=0){
            player.y=surfY2-pr;player.vy=0;player.grounded=true;
          }
        }
      } else {
        const surfY2=fm.curH;
        if(player.gDir===-1&&player.x+pr>fm.x&&player.x-pr<fm.x+fm.w){
          if(player.y-pr<=surfY2&&player.y-pr>surfY2-12&&player.vy<=0){
            player.y=surfY2+pr;player.vy=0;player.grounded=true;
          }
        }
      }
      if(fm.shakeT<=0){fm.state='falling';fm.vy=0.5;sfx('death');vibrate([10,5,10]);}
    } else if(fm.state==='falling'){
      fm.vy+=0.3;fm.curH-=fm.vy;fm.alpha=Math.max(0,fm.curH/fm.baseH);
      if(!isCeil){
        const surfY2=H-fm.curH;
        if(fm.curH>0&&player.gDir===1&&player.x+pr>fm.x&&player.x-pr<fm.x+fm.w){
          if(player.y+pr>=surfY2&&player.y+pr<surfY2+12&&player.vy>=0){
            player.y=surfY2-pr;player.vy=fm.vy*-0.3;player.grounded=true;
          }
        }
        if(fm.curH<=-50)fm.state='gone';
        if(frame%3===0)emitParts(fm.x+Math.random()*fm.w,H-Math.max(0,fm.curH),2,tc('gnd'),2,1);
      } else {
        const surfY2=fm.curH;
        if(fm.curH>0&&player.gDir===-1&&player.x+pr>fm.x&&player.x-pr<fm.x+fm.w){
          if(player.y-pr<=surfY2&&player.y-pr>surfY2-12&&player.vy<=0){
            player.y=surfY2+pr;player.vy=fm.vy*0.3;player.grounded=true;
          }
        }
        if(fm.curH<=-50)fm.state='gone';
        if(frame%3===0)emitParts(fm.x+Math.random()*fm.w,Math.max(0,fm.curH),2,tc('gnd'),2,1);
      }
    }
  });
  fip(fallingMtns,fm=>fm.state!=='gone'&&fm.x+fm.w>-50);

  // Coin switch update (round button)
  coinSwitches.forEach(cs=>{cs.x-=speed;if(cs.flashT>0)cs.flashT--;});
  fip(coinSwitches,cs=>cs.x+cs.r>-50);
  coinSwitches.forEach(cs=>{
    if(cs.activated)return;
    const dx3=player.x-cs.x,dy3=player.y-cs.y;
    const d3=Math.sqrt(dx3*dx3+dy3*dy3);
    if(d3<pr+cs.r+4){
      cs.activated=true;cs.flashT=40;
      sfx('item');vibrate([15,10,15]);shakeI=4;
      addPop(cs.x,cs.y-20,'\u30B3\u30A4\u30F3\u30B9\u30A4\u30C3\u30C1!',COIN_SW_COL);
      emitParts(cs.x,cs.y,10,COIN_SW_COL,3,2);
      // Spawn 30-100 coins in organized grid ahead
      const totalCoins2=30+Math.floor(Math.random()*71);
      const cols=Math.ceil(Math.sqrt(totalCoins2*1.5));
      const rows=Math.ceil(totalCoins2/cols);
      const spacing=24;
      const startX2=cs.x+40;
      const surfY3=cs.isFloor?cs.y:cs.y;
      let placed=0;
      for(let r2=0;r2<rows&&placed<totalCoins2;r2++){
        for(let c2=0;c2<cols&&placed<totalCoins2;c2++){
          const cx2=startX2+c2*spacing;
          const cy2=cs.isFloor?surfY3-10-r2*spacing:surfY3+10+r2*spacing;
          if(!coinOverlaps(cx2,cy2)){coins.push({x:cx2,y:cy2,sz:9,col:false,p:Math.random()*6.28});placed++;}
        }
      }
    }
  });

  // Crush detection (terrain pinch)
  const fSurf=floorSurfaceY(player.x);
  const cSurf=ceilSurfaceY(player.x);
  if(fSurf-cSurf<pr*2+4){
    hurt(true);return;
  }
  // Boundaries (void fall = instant death, lose all HP)
  if(player.y+pr>H+30||player.y-pr<-30){die();return;}

  // Rotation (tire spins continuously when grounded)
  if(ct().shape==='tire'&&player.grounded){
    player.rotTarget+=speed*0.08*player.gDir;
  }
  // Correct rotation when grounded to prevent inversion from rapid flipping
  if(player.grounded&&ct().shape!=='tire'){
    const correctRot=player.gDir===1?Math.round(player.rotTarget/(Math.PI*2))*Math.PI*2
      :(Math.round((player.rotTarget-Math.PI)/(Math.PI*2))*Math.PI*2+Math.PI);
    player.rotTarget+=(correctRot-player.rotTarget)*0.2;
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
        const pinkMul=score>=PINK_COIN_SCORE?PINK_COIN_MUL:1;
        const bon=Math.ceil((3+Math.min(combo-1,8))*ct().coinMul*pinkMul);
        dist+=bon;sfx(combo>1?'combo':'coin');
        const popCol=score>=PINK_COIN_SCORE?PINK_COIN_COLOR:'#ffd700';
        addPop(c.x,c.y-14,'+'+bon,popCol);vibrate(10);
        if(combo>1)addPop(c.x,c.y-34,combo+'x','#ff6b35');
        emitParts(c.x,c.y,6,'#ffd700',3,2);
        player.face='happy';setTimeout(()=>{if(player.alive)player.face='normal';},250);
      }
    }
  });
  // Reset combo if any uncollected coin goes off-screen
  const prevCoinCount=coins.length;
  fip(coins,c=>{
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
  fip(items,it=>it.x>-50&&!it.col);

  // Enemies
  const esm=enemySpeedMul(); // enemy speed multiplier (1.0 to 2.0)
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
      en.flyPhase+=0.04*esm;
      en.y=en.baseY+Math.sin(en.flyPhase)*en.flyAmp;
      en.baseY-=speed*0.02;
    } else if(en.type===0&&en.patrolDir!==undefined){
      // Walker with left-right patrol
      en.x+=en.patrolDir*en.walkSpd*esm;
      if(!en.boss) en.patrolOriginX-=speed; // keep origin scrolling with terrain (not for boss)
      if(en.x>en.patrolOriginX+en.patrolRange) en.patrolDir=-1;
      if(en.x<en.patrolOriginX-en.patrolRange) en.patrolDir=1;
      // Edge detection: reverse direction if about to walk off platform
      if(en.gDir===1){
        const sy=floorSurfaceY(en.x);
        const aheadSy=floorSurfaceY(en.x+en.patrolDir*(en.sz+4));
        if(sy<H+100){
          en.y=sy-en.sz;en.vy=0;
          // If the ground ahead is a void or much lower, reverse direction
          if(aheadSy>H+100||aheadSy>sy+30) en.patrolDir*=-1;
        }
        else{en.vy=(en.vy||0)+GRAVITY;en.y+=en.vy;}
      }else{
        const sy=ceilSurfaceY(en.x);
        const aheadSy=ceilSurfaceY(en.x+en.patrolDir*(en.sz+4));
        if(sy>-100){
          en.y=sy+en.sz;en.vy=0;
          // If the ceiling ahead is a void or much higher, reverse direction
          if(aheadSy<-100||aheadSy<sy-30) en.patrolDir*=-1;
        }
        else{en.vy=(en.vy||0)-GRAVITY;en.y+=en.vy;}
      }
    } else if(en.type===3){
      // Bomber: small patrol, stays on ground
      if(en.patrolDir!==undefined){
        en.x+=en.patrolDir*en.walkSpd*esm;
        en.patrolOriginX-=speed;
        if(en.x>en.patrolOriginX+en.patrolRange) en.patrolDir=-1;
        if(en.x<en.patrolOriginX-en.patrolRange) en.patrolDir=1;
      }
      const sy=floorSurfaceY(en.x);
      if(sy<H+100){en.y=sy-en.sz;en.vy=0;}
      else{en.vy=(en.vy||0)+GRAVITY;en.y+=en.vy;}
    } else if(en.type===4){
      // Vertical mover: irregular movement, tracks player
      en.moveTimer=(en.moveTimer||0)+1;
      if(en.pauseT>0){
        en.pauseT--;
      } else {
        // Occasionally change direction toward player Y
        if(en.moveTimer%25===0&&Math.random()<0.5){
          en.moveDir=player.y>en.y?1:-1;
        }
        // Random speed variation (sinusoidal + noise)
        const spdMod=0.6+Math.sin(en.moveTimer*0.07)*0.4+Math.sin(en.moveTimer*0.17)*0.2;
        en.y+=en.moveDir*en.moveSpd*spdMod*esm;
        const floorY=floorSurfaceY(en.x);
        const ceilY2=ceilSurfaceY(en.x);
        if(en.y+en.sz>=floorY){
          en.y=floorY-en.sz;en.moveDir=-1;en.pauseT=5+Math.floor(Math.random()*15);en.gDir=1;
        }
        if(en.y-en.sz<=ceilY2){
          en.y=ceilY2+en.sz;en.moveDir=1;en.pauseT=5+Math.floor(Math.random()*15);en.gDir=-1;
        }
        // Random mid-air pause
        if(en.moveTimer%40===0&&Math.random()<0.15){
          en.pauseT=8+Math.floor(Math.random()*12);
        }
      }
    } else if(en.type===5){
      // Phantom: float with sine, periodically turn invisible
      en.flyPhase+=0.03*esm;
      en.y=en.baseY+Math.sin(en.flyPhase)*en.flyAmp;
      en.baseY-=speed*0.01;
      en.visTimer+=esm;
      if(en.visible&&en.visTimer>=en.visCycle){
        en.visible=false;en.visTimer=0;en.fadeT=20; // fade out over 20 frames
      } else if(!en.visible&&en.visTimer>=en.visCycle*0.6){
        en.visible=true;en.visTimer=0;en.fadeT=20; // fade in over 20 frames
      }
      if(en.fadeT>0)en.fadeT--;
    } else if(en.type===6){
      // Dasher: patrol → warn → dash → cooldown → patrol
      en.patrolOriginX-=speed;
      if(en.gDir===1){
        const sy=floorSurfaceY(en.x);
        if(sy<H+100){en.y=sy-en.sz;en.vy=0;}
        else{en.vy=(en.vy||0)+GRAVITY;en.y+=en.vy;}
      } else {
        const sy=ceilSurfaceY(en.x);
        if(sy>-100){en.y=sy+en.sz;en.vy=0;}
        else{en.vy=(en.vy||0)-GRAVITY;en.y+=en.vy;}
      }
      const dxP=player.x-en.x;
      if(en.dashState==='patrol'){
        en.x+=en.patrolDir*en.walkSpd*esm;
        if(en.x>en.patrolOriginX+en.patrolRange) en.patrolDir=-1;
        if(en.x<en.patrolOriginX-en.patrolRange) en.patrolDir=1;
        // Detect player within range
        if(Math.abs(dxP)<300&&Math.abs(player.y-en.y)<100){
          en.dashState='warn';en.warnT=40;
          en.dashDir=dxP<0?-1:1;
        }
      } else if(en.dashState==='warn'){
        en.warnT--;
        if(en.warnT<=0){en.dashState='dash';en.dashTimer=35;}
      } else if(en.dashState==='dash'){
        en.x+=en.dashDir*en.dashSpd*esm;
        en.dashTimer--;
        if(en.dashTimer<=0){en.dashState='cooldown';en.dashTimer=50;}
      } else if(en.dashState==='cooldown'){
        en.dashTimer--;
        if(en.dashTimer<=0){en.dashState='patrol';en.patrolOriginX=en.x;}
      }
    } else if(en.type===8){
      // Splitter: patrol, detect player, then self-split into 2 small bouncing slimes
      en.x+=en.patrolDir*en.walkSpd*esm;
      en.patrolOriginX-=speed;
      if(en.x>en.patrolOriginX+en.patrolRange) en.patrolDir=-1;
      if(en.x<en.patrolOriginX-en.patrolRange) en.patrolDir=1;
      if(en.gDir===1){
        const sy=floorSurfaceY(en.x);
        const aheadSy=floorSurfaceY(en.x+en.patrolDir*(en.sz+4));
        if(sy<H+100){en.y=sy-en.sz;en.vy=0;if(aheadSy>H+100||aheadSy>sy+30)en.patrolDir*=-1;}
        else{en.vy=(en.vy||0)+GRAVITY;en.y+=en.vy;}
      } else {
        const sy=ceilSurfaceY(en.x);
        const aheadSy=ceilSurfaceY(en.x+en.patrolDir*(en.sz+4));
        if(sy>-100){en.y=sy+en.sz;en.vy=0;if(aheadSy<-100||aheadSy<sy-30)en.patrolDir*=-1;}
        else{en.vy=(en.vy||0)-GRAVITY;en.y+=en.vy;}
      }
      // Detect player and self-split
      if(!en.splitDone){
        const sdx=player.x-en.x,sdy=player.y-en.y;
        const sdist=Math.sqrt(sdx*sdx+sdy*sdy);
        if(sdist<180){
          en.splitDone=true;en.alive=false;
          for(let si=0;si<2;si++){
            const sdir=si===0?-1:1;
            enemies.push({x:en.x+sdir*10,y:en.y,vy:en.gDir===1?-4:4,gDir:en.gDir,
              walkSpd:sdir*(1.5+Math.random()*1.0),sz:9,alive:true,fr:Math.random()*100,type:9,shootT:999,
              bounceVy:en.gDir===1?-3.5:3.5,patrolOriginX:en.x+sdir*10,lifeT:180+Math.floor(Math.random()*60)});
          }
          sfx('shoot');emitParts(en.x,en.y,10,'#88cc44',4,3);
          addPop(en.x,en.y-en.sz*en.gDir-10,'\u5206\u88C2!','#88cc44');
        }
      }
    } else if(en.type===9){
      // Mini slime (from splitter): bounces left/right, then falls off after lifeT
      const grav=GRAVITY*en.gDir;
      en.vy+=grav;
      en.y+=en.vy;
      en.x+=en.walkSpd; // drift sideways
      en.patrolOriginX-=speed;
      if(en.lifeT!==undefined)en.lifeT--;
      const expired=en.lifeT!==undefined&&en.lifeT<=0;
      if(!expired){
        if(en.gDir===1){
          const sy=floorSurfaceY(en.x);
          if(en.y+en.sz>=sy&&sy<H+100){en.y=sy-en.sz;en.vy=en.bounceVy;}
        } else {
          const sy=ceilSurfaceY(en.x);
          if(en.y-en.sz<=sy&&sy>-100){en.y=sy+en.sz;en.vy=en.bounceVy;}
        }
      }
      // expired: no ground collision → falls off screen
    } else {
      // Default movement (type 1 cannon and legacy)
      en.x-=en.walkSpd*esm;
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
    // Phantom: when invisible, can still damage player but cannot be stomped
    if(en.type===5&&!en.visible){
      const dx2=player.x-en.x,dy2=player.y-en.y;
      const d2=Math.sqrt(dx2*dx2+dy2*dy2);
      if(d2<pr+en.sz){
        if(itemEff.invincible>0){
          en.alive=false;sfx('stomp');vibrate(15);shakeI=4;
          const bon2=Math.floor(10+Math.min(score*0.1,20));dist+=bon2;
          addPop(en.x,en.y-en.sz*en.gDir,'+'+bon2,'#ff00ff');
          emitParts(en.x,en.y,15,'#ff00ff',4,3);
        } else { hurt(); }
      }
      return;
    }
    const dx=player.x-en.x,dy=player.y-en.y;
    const d=Math.sqrt(dx*dx+dy*dy);
    if(d<pr+en.sz){
      // Invincible: destroy enemy on contact
      if(itemEff.invincible>0){
        en.alive=false;
        sfxEnemyDeath(en.type);vibrate(15);shakeI=4;
        const bon=Math.floor(10+Math.min(score*0.1,20));
        dist+=bon;
        addPop(en.x,en.y-en.sz*en.gDir,'+'+bon,'#ff00ff');
        emitParts(en.x,en.y,15,'#ff00ff',4,3);
        player.face='happy';setTimeout(()=>{if(player.alive)player.face='normal';},300);
        return;
      }
      // Fast kill trait (Flame): destroy on contact at high speed
      const fkill=ct().fastKill&&speed>4;
      // Tire roll kill: grounded tire destroys ground-based enemies by rolling into them
      const tireRoll=isTire&&player.grounded&&(en.type===0||en.type===1||en.type===3);
      // Check stomp: player approaching from the "top" of the enemy
      const stomped=fkill||tireRoll||(en.gDir===1&&player.y<en.y-en.sz*0.2&&player.vy>=0)||(en.gDir===-1&&player.y>en.y+en.sz*0.2&&player.vy<=0);
      if(stomped){
        en.alive=false;
        // Tire: crush without bouncing; others: bounce off enemy
        if(isTire&&(tireRoll||player.grounded)){
          player.vy=0;
        } else {
          player.vy=-JUMP_POWER*0.7*player.gDir;
          player.grounded=false;
        }
        flipCount=0;player.canFlip=true;djumpUsed=false;djumpAvailable=true;
        // Gravity stomp bonus: 3x if flipped recently
        const gstomp=flipTimer<40;
        const gsMul=gstomp?3:1;
        const bon=Math.floor((10+Math.min(score*0.1,20))*gsMul);
        dist+=bon;
        if(gstomp){sfx('gstompHeavy');sfxEnemyDeath(en.type);vibrate([20,10,30]);shakeI=8;}else{sfxEnemyDeath(en.type);vibrate(15);}
        addPop(en.x,en.y-en.sz*en.gDir,'+'+bon,gstomp?'#ffd700':'#ff3860');
        if(gstomp){addPop(en.x,en.y-en.sz*en.gDir-22,'\u91CD\u529B\u30B9\u30C8\u30F3\u30D7!','#ffd700');emitParts(en.x,en.y,20,'#ffd700',5,4);}
        else{emitParts(en.x,en.y,12,'#ff3860',4,3);}
        // Aerial combo: consecutive kills without touching ground
        if(!player.grounded){airCombo++;sfxAirCombo(airCombo);const acb=airCombo*5;dist+=acb;addPop(en.x,en.y-en.sz*en.gDir-36,airCombo+' AIR COMBO!','#00e5ff');emitParts(en.x,en.y,8,'#00e5ff',3,2);}
        player.face='happy';setTimeout(()=>{if(player.alive)player.face='normal';},300);
      }else{
        hurt();return;
      }
    }
  });
  fip(enemies,en=>(en.boss||en.x>-50)&&en.alive&&en.y>-200&&en.y<H+200);

  // Shooter enemies fire horizontal bullets at player's Y position
  enemies.forEach(en=>{
    if(!en.alive||en.type!==1)return;
    en.shootT-=esm;
    if(en.shootT<=0&&en.x>0&&en.x<W+50){
      en.shootT=90+Math.floor(Math.random()*50);
      const bspd=(4+speed*0.3)*esm;
      // Fire horizontally from the enemy's position
      bullets.push({x:en.x-en.sz,y:en.y,vx:-bspd,vy:0,sz:5,life:180});
      sfx('shoot');
    }
  });
  // Bomber enemies throw bombs in a parabolic arc toward player
  enemies.forEach(en=>{
    if(!en.alive||en.type!==3)return;
    en.bombCD-=esm;
    if(en.bombCD<=0&&en.x>0&&en.x<W+50){
      en.bombCD=120+Math.floor(Math.random()*50);
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
    // Shockwave: stays on floor, tall hitbox
    if(b.shockwave){
      const sy=floorSurfaceY(b.x);
      if(sy<H+100)b.y=sy-6;
      // Tall collision area (player must jump over)
      const dx=player.x-b.x,dy=player.y-(b.y-20);
      if(Math.abs(dx)<bpr+b.sz&&dy>-40&&dy<30){
        if(itemEff.invincible<=0&&hurtT<=0){b.life=0;hurt();}
      }
      // Particles trail
      if(b.life%3===0&&parts.length<MAX_PARTS)parts.push({x:b.x,y:b.y,vx:(Math.random()-0.5)*0.5,vy:-1-Math.random()*2,life:12,ml:12,sz:Math.random()*4+2,col:'#ffaa00'});
      return;
    }
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
  fip(bullets,b=>b.life>0&&(b.wizBullet||(b.x>-50&&b.x<W+100&&b.y>-50&&b.y<H+50)));

  // Wall collision: hitting the side of a higher platform step
  // All characters: climb steps up to half their height (pr = radius = half diameter)
  // Tire character: climbs steps up to 0.75x its height (pr*1.5)
  {
    const tireStepTol=isTire?pr*1.5:0; // tire: 0.75x character height
    const STEP_TOLERANCE=pr; // all characters: half character height
    if(player.gDir===1){
      for(let i=0;i<platforms.length;i++){
        const p=platforms[i];
        if(p.x>player.x-pr&&p.x<player.x+pr+speed*2){
          const surfY=H-p.h;
          if(player.y+pr>surfY+4){
            const stepH=player.y+pr-surfY;
            if(isTire&&stepH<=tireStepTol){
              // Tire: snap directly onto the step
              player.y=surfY-pr;player.vy=0;player.grounded=true;
            } else if(stepH<=STEP_TOLERANCE){
              // All characters: auto step up (half height or less)
              player.y=surfY-pr;player.vy=0;player.grounded=true;
            } else {
              hurt(true);return;
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
            if(isTire&&stepH<=tireStepTol){
              // Tire: snap directly onto the step
              player.y=surfY+pr;player.vy=0;player.grounded=true;
            } else if(stepH<=STEP_TOLERANCE){
              // All characters: auto step up (half height or less)
              player.y=surfY+pr;player.vy=0;player.grounded=true;
            } else {
              hurt(true);return;
            }
          }
        }
      }
    }
  }

  // Invincible particles (rainbow sparkle)
  if(itemEff.invincible>0&&frame%2===0&&parts.length<MAX_PARTS){const a=Math.random()*6.28;const ic=['#ff00ff','#ffff00','#00ffff','#ff4444','#44ff44'][frame%5];parts.push({x:player.x+Math.cos(a)*22,y:player.y+Math.sin(a)*22,vx:Math.cos(a)*0.6,vy:Math.sin(a)*0.6,life:14,ml:14,sz:Math.random()*3.5+1.5,col:ic});}
  // Double jump available indicator
  if(djumpAvailable&&!djumpUsed&&frame%6===0&&parts.length<MAX_PARTS){parts.push({x:player.x,y:player.y+pr*player.gDir+4*player.gDir,vx:(Math.random()-0.5)*0.5,vy:0.3*player.gDir,life:10,ml:10,sz:2,col:'#ffaa00'});}

  fip(parts,p=>{p.x+=p.vx;p.y+=p.vy;p.life--;return p.life>0;});
  stars.forEach(s=>{s.x-=s.sp*speed*0.3;s.tw+=s.ts;if(s.x<-5)s.x=W+5;});
  mtns.forEach(m=>{m.off-=m.sp*speed*0.15;if(m.off<-500)m.off+=500;});
}

// ===== AMBIENT PARTICLES (stage pack themes) =====
function updateAmbient(){
  if(!isPackMode)return;
  const st=STAGE_THEMES[currentPackIdx];if(!st)return;
  const pt=st.partType;
  if(frame%4===0&&ambientParts.length<MAX_AMBIENT){
    if(pt==='twinkle'){ambientParts.push({x:W+5,y:Math.random()*H,vx:-0.3-Math.random()*0.5,vy:(Math.random()-0.5)*0.3,life:120,ml:120,sz:Math.random()*2+1,col:st.partCol,tw:Math.random()*6.28});}
    else if(pt==='snow'){ambientParts.push({x:Math.random()*W,y:-5,vx:(Math.random()-0.5)*0.5-0.3,vy:0.5+Math.random()*1,life:200,ml:200,sz:Math.random()*3+1,col:'#ffffff'});}
    else if(pt==='ember'){ambientParts.push({x:Math.random()*W,y:H+5,vx:(Math.random()-0.5)*0.8,vy:-1-Math.random()*2,life:100,ml:100,sz:Math.random()*3+1,col:['#ff4400','#ff6600','#ffaa00'][Math.floor(Math.random()*3)]});}
    else if(pt==='bubble'){ambientParts.push({x:Math.random()*W,y:H+5,vx:(Math.random()-0.5)*0.3,vy:-0.5-Math.random()*0.8,life:180,ml:180,sz:Math.random()*4+2,col:'#66ccff44'});}
    else if(pt==='petal'){ambientParts.push({x:W+5,y:Math.random()*H*0.7,vx:-1-Math.random()*1.5,vy:0.3+Math.random()*0.8,life:150,ml:150,sz:Math.random()*4+2,col:['#ffaacc','#ff88bb','#ffccdd'][Math.floor(Math.random()*3)]});}
  }
  fip(ambientParts,p=>{p.x+=p.vx;p.y+=p.vy;if(p.tw!==undefined)p.tw+=0.05;p.life--;return p.life>0;});
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

// ===== CHALLENGE MODE: FLOOR COLLAPSE SYSTEM =====
function startChallCollapse(){
  const cc=challCollapse;
  cc.active=true;
  cc.timer=0;
  cc.debris=[];
  cc.shakeAmt=0;
  cc.fallY=0;
  // If player is on ceiling, force them down first
  if(player.gDir===-1){
    cc.phase='forceDown';
  } else {
    cc.phase='rumble';
    sfxFloorCrumble();switchBGM('collapse');
  }
}
function updateChallCollapse(){
  const cc=challCollapse;
  cc.timer++;
  const floorY=H-GROUND_H;
  const ceilY=GROUND_H;

  if(cc.phase==='forceDown'){
    // Force player off ceiling to floor
    player.gDir=1;player.grounded=false;
    player.vy=2; // gentle push down
    // Check if player landed on floor
    const sy=floorSurfaceY(player.x);
    if(player.y+PLAYER_R*ct().sizeMul>=sy-5){
      player.y=sy-PLAYER_R*ct().sizeMul;
      player.vy=0;player.grounded=true;
      cc.phase='rumble';cc.timer=0;
      sfxFloorCrumble();switchBGM('collapse');
    }
    // Timeout safety
    if(cc.timer>120){
      player.y=floorY-PLAYER_R*ct().sizeMul;
      player.vy=0;player.grounded=true;player.gDir=1;
      cc.phase='rumble';cc.timer=0;
      sfxFloorCrumble();switchBGM('collapse');
    }
    return;
  }

  if(cc.phase==='rumble'){
    // Ground shaking builds up over 90 frames
    cc.shakeAmt=Math.min(20,cc.timer*0.25);
    shakeI=Math.max(shakeI,cc.shakeAmt);
    // Generate cracks and dust from floor
    if(cc.timer%3===0){
      const cx=Math.random()*W;
      parts.push({x:cx,y:floorY,vx:(Math.random()-0.5)*3,vy:-2-Math.random()*4,
        life:25+Math.random()*15,ml:40,sz:Math.random()*4+2,col:['#8a7060','#a09070','#665544'][Math.floor(Math.random()*3)]});
    }
    // Ceiling dust too
    if(cc.timer%5===0){
      const cx=Math.random()*W;
      parts.push({x:cx,y:ceilY,vx:(Math.random()-0.5)*2,vy:1+Math.random()*3,
        life:20+Math.random()*10,ml:30,sz:Math.random()*3+1,col:'#8a7060'});
    }
    // After 90 frames, start the collapse
    if(cc.timer>=90){
      cc.phase='collapse';cc.timer=0;
      // Generate debris from BOTH floor AND ceiling breaking apart
      const cols=['#4a3a2a','#5a4a3a','#6a5a4a','#3a2a1a','#8a7060'];
      // Floor debris (falls down)
      for(let i=0;i<25;i++){
        const dw=15+Math.random()*35;
        const dh=10+Math.random()*25;
        cc.debris.push({
          x:Math.random()*W,y:floorY-Math.random()*GROUND_H,w:dw,h:dh,
          vx:(Math.random()-0.5)*4,vy:2+Math.random()*5,
          rot:Math.random()*6.28,rotV:(Math.random()-0.5)*0.15,
          col:cols[Math.floor(Math.random()*5)],alpha:1
        });
      }
      // Ceiling debris (falls down from top)
      for(let i=0;i<20;i++){
        const dw=15+Math.random()*35;
        const dh=10+Math.random()*25;
        cc.debris.push({
          x:Math.random()*W,y:Math.random()*GROUND_H,w:dw,h:dh,
          vx:(Math.random()-0.5)*4,vy:2+Math.random()*4,
          rot:Math.random()*6.28,rotV:(Math.random()-0.5)*0.15,
          col:cols[Math.floor(Math.random()*5)],alpha:1
        });
      }
      sfx('earthquake');shakeI=25;vibrate([60,30,80,40,100,50,80]);
    }
    return;
  }

  if(cc.phase==='collapse'){
    // BOTH floors break apart - debris falls with gravity and rotation
    shakeI=Math.max(shakeI,15-cc.timer*0.1);
    // Remove BOTH floor and ceiling platforms visually
    platforms.forEach(p=>{p.h=Math.max(0,p.h-3);});
    ceilPlats.forEach(p=>{p.h=Math.max(0,p.h-3);});
    // Update debris
    cc.debris.forEach(d=>{
      d.vy+=0.3; // gravity
      d.x+=d.vx;
      d.y+=d.vy;
      d.rot+=d.rotV;
      d.alpha=Math.max(0,1-(d.y-H)/200);
    });
    cc.debris=cc.debris.filter(d=>d.y<H+300);
    // Generate extra falling dust from both sides
    if(cc.timer%2===0){
      parts.push({x:Math.random()*W,y:floorY+cc.timer*2,vx:(Math.random()-0.5)*2,vy:3+Math.random()*3,
        life:30,ml:30,sz:Math.random()*5+2,col:'#8a7060'});
      parts.push({x:Math.random()*W,y:ceilY,vx:(Math.random()-0.5)*2,vy:2+Math.random()*3,
        life:25,ml:25,sz:Math.random()*4+2,col:'#6a5a4a'});
    }
    // After 40 frames, player starts falling (faster transition)
    if(cc.timer>=40){
      cc.phase='fall';cc.timer=0;
      player.grounded=false;player.vy=0;
    }
    return;
  }

  if(cc.phase==='fall'){
    // Player drops rapidly straight down
    if(cc.timer<10){
      // Fast vertical drop
      player.vy+=2.5;player.grounded=false;
      shakeI=Math.max(shakeI,6);
    }
    // At frame 20: fully black – rebuild level
    if(cc.timer===20){
      platforms.length=0;ceilPlats.length=0;
      platforms.push({x:player.x-100,w:300,h:GROUND_H});
      ceilPlats.push({x:player.x-100,w:300,h:GROUND_H});
      player.y=H-GROUND_H-PLAYER_R*ct().sizeMul;
      player.vy=0;player.grounded=true;player.gDir=1;
    }
    // Extended blackout: after 110 frames, transition to land
    if(cc.timer>=110){
      cc.phase='land';cc.timer=0;
      sfx('gstompHeavy');shakeI=8;vibrate([30,15,40]);
    }
    return;
  }

  if(cc.phase==='land'){
    // Show wave number overlay then transition
    if(cc.timer>=70){
      cc.active=false;cc.phase='none';cc.timer=0;cc.debris=[];cc.fallY=0;
      challengeNextBossT=60;
      switchBGM('challenge');
    }
    return;
  }
}
