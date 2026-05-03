'use strict';
// ===== UPDATE =====
let lastTime=0;
// Circular trail buffer (avoids push/shift GC pressure)
let _trailBuf=new Array(20),_trailHead=0,_trailLen=0;
for(let _ti=0;_ti<20;_ti++)_trailBuf[_ti]={x:0,y:0,a:0};
// Helper: reset player flip/jump state after landing or stomp
function resetFlipState(){
  flipCount=0;
  flipTimer=999;
  player.canFlip=true;
  djumpUsed=false;
  djumpAvailable=!!ct().hasDjump||isSpecialActive('bounce');
  if(typeof refreshAirActionState==='function')refreshAirActionState(true);
}
function triggerCoinSwitch(cs){
  cs.activated=true;cs.flashT=40;
  sfx('item');vibrate('item');shakeI=4;
  addPop(cs.x,cs.y-20,t('popCoinSwitch'),COIN_SW_COL);
  emitParts(cs.x,cs.y,10,COIN_SW_COL,3,2);
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
function rewardEnemySpecialKill(en,col,bonus){
  en.alive=false;
  sfxEnemyDeath(en.type);vibrate('stomp');shakeI=Math.max(shakeI,4);
  dist+=cubeSpecialKillBonus(bonus);
  addPop(en.x,en.y-en.sz*en.gDir,'+'+cubeSpecialKillBonus(bonus),col);
  emitParts(en.x,en.y,15,col,4,3);
  player.face='happy';player.faceTimer=18;
}
function rewardStackedStompEnemy(en,gstomp){
  en.alive=false;
  const baseBon=gstomp?90:30;
  const bon=cubeSpecialKillBonus(baseBon+stompCombo*(gstomp?60:30));
  stompCombo++;
  dist+=bon;
  addSpecialGauge((gstomp?SPECIAL_STOMP_GAIN:SPECIAL_KILL_GAIN)+Math.min(stompCombo,6)*0.8);
  addPop(en.x,en.y-en.sz*en.gDir,'+'+bon,gstomp?'#ffd700':'#ff3860');
  emitParts(en.x,en.y,gstomp?20:12,gstomp?'#ffd700':'#ff3860',gstomp?5:4,gstomp?4:3);
}
function stompRescuedByStep(en){
  if(en._prevY===undefined)return false;
  if(en.gDir===1){
    return en._prevY>en.y&&player.vy>=0&&player.y<en._prevY-en.sz*0.2;
  }
  return en._prevY<en.y&&player.vy<=0&&player.y>en._prevY+en.sz*0.2;
}

// Shared chest open state machine: wobble -> burst -> reveal -> done
// Used by ST.TITLE (with batch-mode extension) and ST.DEAD.
function chestRewardRarity(reward){
  if(!reward)return 'normal';
  if(reward.type==='char')return 'super_rare';
  if(reward.type==='cosmetic'&&reward.item&&reward.item.rarity)return reward.item.rarity;
  return 'normal';
}
function playChestRevealFeedback(reward){
  const rar=chestRewardRarity(reward);
  if(rar==='super_rare'){
    if(typeof sfxSuperRare==='function')sfxSuperRare();
    shakeI=Math.max(shakeI,30);
    vibrate('chest_super');
  } else if(rar==='rare'){
    if(typeof sfxRare==='function')sfxRare();
    shakeI=Math.max(shakeI,18);
    vibrate('chest');
  } else {
    if(typeof sfxChestNormal==='function')sfxChestNormal();
    shakeI=Math.max(shakeI,6);
    vibrate('jump');
  }
}
function updateChestOpenStateMachine(){
  chestOpen.t++;
  if(chestOpen.phase==='wobble'&&chestOpen.t>=50){
    chestOpen.phase='burst';chestOpen.t=0;sfxChestOpen();shakeI=15;vibrate('chest');
  }
  else if(chestOpen.phase==='burst'&&chestOpen.t>=40){
    chestOpen.phase='reveal';chestOpen.t=0;
    playChestRevealFeedback(chestOpen.reward);
    if(chestOpen.reward&&chestOpen.reward.type==='coin'){
      walletCoins+=chestOpen.reward.amount;localStorage.setItem('gd5wallet',walletCoins.toString());
    }
    if(chestOpen.reward&&chestOpen.reward.type==='char'){
      if(chestOpen.reward.isNew){
        unlockCharFromChest(chestOpen.reward.charIdx);
      } else {
        chestOpen.reward.bonusCoins=500;
        walletCoins+=500;localStorage.setItem('gd5wallet',walletCoins.toString());
      }
    }
    if(chestOpen.reward&&chestOpen.reward.type==='cosmetic'){
      if(!chestOpen.reward.isNew){
        walletCoins+=300;localStorage.setItem('gd5wallet',walletCoins.toString());
      }
    }
    chestOpen.rewardGranted=true;
  }
  else if(chestOpen.phase==='reveal'){
    const revealRarity=chestRewardRarity(chestOpen.reward);
    const revealLen=revealRarity==='super_rare'?160:revealRarity==='rare'?120:95;
    if(chestOpen.t>=revealLen){
      chestOpen.phase='done';chestOpen.t=0;
    }
  }
}
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
  if(state!==ST.PLAY&&specialState.active)endSpecialSkill(true);
  if(state!==ST.PLAY&&specialState.requested)clearSpecialActivationRequest();
  if((bossPhase.active||bossPhase.reward)&&specialState.requested)clearSpecialActivationRequest();

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
    for(let i=0;i<stars.length;i++){const s=stars[i];s.x-=s.sp*0.3;s.tw+=s.ts;if(s.x<-5)s.x=W+5;}
    for(let i=0;i<mtns.length;i++){const m=mtns[i];m.off-=m.sp*0.2;if(m.off<-500)m.off+=500;}
    return;
  }

  if(state===ST.LOGIN){
    loginT+=0.03;
    for(let i=0;i<stars.length;i++){const s=stars[i];s.x-=s.sp*0.2;s.tw+=s.ts;if(s.x<-5)s.x=W+5;}
    return;
  }
  if(state===ST.TUTORIAL){
    tutStepT++;
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
    for(let i=0;i<stars.length;i++){const s=stars[i];s.x-=s.sp*scrollSpd*0.3;s.tw+=s.ts;if(s.x<-5)s.x=W+5;}
    for(let i=0;i<mtns.length;i++){const m=mtns[i];m.off-=m.sp*scrollSpd*0.15;if(m.off<-500)m.off+=500;}
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
    for(let i=0;i<tutCoursePlats.length;i++){const p=tutCoursePlats[i];
      if(wpx>=p.x&&wpx<=p.x+p.w){
        const surfY=H-p.h;
        if(player.gDir===1&&player.y+tpr>=surfY&&player.vy>=0){
          player.y=surfY-tpr;player.vy=0;player.grounded=true;onFloor2=true;
        }
      }
    }
    for(let i=0;i<tutCourseCeil.length;i++){const p=tutCourseCeil[i];
      if(wpx>=p.x&&wpx<=p.x+p.w){
        const surfY=p.h;
        if(player.gDir===-1&&player.y-tpr<=surfY&&player.vy<=0){
          player.y=surfY+tpr;player.vy=0;player.grounded=true;onCeil2=true;
        }
      }
    }
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
    for(let i=0;i<enemies.length;i++){const en=enemies[i];
      if(!en.alive)continue;
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
    }
    fip(parts,p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.07;p.vx*=0.99;p.life--;return p.life>0;});
    if(bombFlashT>0)bombFlashT--;
    if(itemEff.invincible>0)itemEff.invincible--;
    return;
  }
  if(state===ST.STAGE_SEL){frame++;if(stageSelGuardT>0)stageSelGuardT--;return;}
  if(state===ST.TITLE){
    // Auto-show update info on first title entry (disabled for now)
    // if(!updateInfoShown&&localStorage.getItem('gd5updateDismissed')!==UPDATE_VER){
    //   updateInfoShown=true;updateInfoOpen=true;
    // }
    titleT+=0.03;
    if(screenFadeIn>0)screenFadeIn--;
    if(unlockCelebT>0)unlockCelebT--;
    if(charModal.show)charModal.animT++;
    for(let i=0;i<stars.length;i++){const s=stars[i];s.x-=s.sp*SPEED_INIT*0.3;s.tw+=s.ts;if(s.x<-5)s.x=W+5;}
    for(let i=0;i<mtns.length;i++){const m=mtns[i];m.off-=m.sp*SPEED_INIT*0.15;if(m.off<-500)m.off+=500;}
    updateDemo();
    // Inventory/dead chest opening state machine
    if((inventoryOpen||deadChestOpen)&&chestOpen.phase!=='none'){
      // Run shared wobble->burst->reveal->done logic
      updateChestOpenStateMachine();
      // Batch-mode extension: when reveal completes, auto-advance instead of stopping at 'done'
      if(chestOpen.phase==='done'&&chestBatchMode){
        chestBatchResults.push(chestOpen.reward);
        if(storedChests>0){
          startInventoryChestOpen();
          chestOpen.phase='wobble';chestOpen.t=0;
          totalChestsOpened++;localStorage.setItem('gd5chestTotal',totalChestsOpened.toString());
          storedChests--;localStorage.setItem('gd5storedChests',storedChests.toString());
        } else {
          chestOpen.phase='batchDone';chestOpen.t=0;chestBatchMode=false;
        }
      }
      // batchDone phase: t++ handled above by updateChestOpenStateMachine; sparkle drawn by draw.js
    }
    return;
  }
  if(state===ST.DEAD){
    deadT++;
    fip(parts,p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.07;p.vx*=0.99;p.life--;return p.life>0;});
    for(let i=0;i<stars.length;i++){const s=stars[i];s.x-=s.sp*0.15;s.tw+=s.ts;if(s.x<-5)s.x=W+5;}
    // Chest opening on death screen
    if(deadChestOpen&&chestOpen.phase!=='none'){
      updateChestOpenStateMachine();
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
  if(ct().shape==='ghost'&&!isSpecialActive('ghost')){
    // Use equipped skin color for ghost particles (default: ghost's own color)
    const _sd=getEquippedSkinData();
    const ghostCol=_sd?(_sd.col==='rainbow'?'#ff00ff':_sd.col):ct().col;
    ghostPhaseT++;
    if(ghostInvis&&ghostPhaseT>=GHOST_PHASE_DURATION){
      ghostInvis=false;ghostPhaseT=0;
      hurtT=Math.max(hurtT,45); // brief invincibility on reappear: prevents instant damage if overlapping enemy
      emitParts(player.x,player.y,6,ghostCol,2,1);
    } else if(!ghostInvis&&ghostPhaseT>=GHOST_PHASE_DURATION){
      ghostInvis=true;ghostPhaseT=0;
      emitParts(player.x,player.y,8,ghostCol,3,2);
    }
    // Shimmer particles while invisible (use skin color + alpha)
    if(ghostInvis&&frame%6===0){
      parts.push({x:player.x+(Math.random()-0.5)*20,y:player.y+(Math.random()-0.5)*20,
        vx:(Math.random()-0.5)*0.5,vy:(Math.random()-0.5)*0.5,
        life:10,ml:10,sz:Math.random()*2+1,col:ghostCol+'66'});
    }
  } else if(!isSpecialActive('ghost')) {ghostInvis=false;ghostPhaseT=0;}
  // Hurt invincibility timer
  if(hurtT>0)hurtT--;
  if(magmaHurtT>0)magmaHurtT--;
  // Face timer (replaces setTimeout for face reset)
  if(player.faceTimer>0){player.faceTimer--;if(player.faceTimer<=0&&player.alive)player.face='normal';}
  // Item timers
  const wasInvincible=itemEff.invincible>0;
  for(const k in itemEff)if(itemEff[k]>0)itemEff[k]--;
  if(wasInvincible&&itemEff.invincible<=0&&state===ST.PLAY){
    syncGameplayBGM(true);
  }
  if(canChargeSpecial())addSpecialGauge(SPECIAL_TIME_GAIN);
  if(specialState.requested)tryActivateSpecialSkill(specialState.requestSource||'manual',false);
  if(specialState.active){
    if(specialState.t>0)specialState.t--;
    if(specialState.hintT>0)specialState.hintT--;
    if(isSpecialActive('bounce')||isSpecialActive('ninja'))refreshAirActionState(true);
    if(isSpecialActive('ghost')){
      ghostInvis=true;
      ghostPhaseT=0;
    }
    if(specialState.t<=0)endSpecialSkill(true);
  }

  if(isPackMode&&currentPackStage){
    speed=SPEED_INIT*currentPackStage.spdMul*ct().speedMul;
  } else if(isChallengeMode){
    speed=SPEED_INIT*ct().speedMul; // fixed speed in challenge
  } else {
    speed=Math.min(SPEED_MAX,(SPEED_INIT+rawDist*SPEED_INC))*ct().speedMul;
  }

  // Distance scoring (score freezes during boss, catches up on victory)
  const frameDist=speed*0.08;
  dist+=frameDist;
  rawDist+=frameDist;
  if(canChargeSpecial())addSpecialGauge(frameDist*SPECIAL_DISTANCE_GAIN);
  if(!bossPhase.active){
    const ns=Math.floor(dist);
    if(ns>score){
      score=ns;checkMile();
    }
  }
  // Theme change every 1000 score (linked to BGM progression)
  if(!isPackMode){
    const newThemeIdx=Math.min(Math.floor(score/1000),THEMES.length-1);
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
  for(let i=0;i<platforms.length;i++)platforms[i].x-=speed;
  for(let i=0;i<ceilPlats.length;i++)ceilPlats[i].x-=speed;
  for(let i=0;i<floatPlats.length;i++)floatPlats[i].x-=speed;
  for(let i=0;i<spikes.length;i++)spikes[i].x-=speed;
  for(let i=0;i<movingHills.length;i++){const h=movingHills[i];h.x-=speed;h.phase+=h.spd;}
  for(let i=0;i<gravZones.length;i++)gravZones[i].x-=speed;
  for(let i=0;i<icicles.length;i++)icicles[i].x-=speed;
  // Remove off-screen platforms
  fip(platforms,p=>p.x+p.w>-50);
  fip(ceilPlats,p=>p.x+p.w>-50);
  fip(floatPlats,p=>p.x+p.w>-50);
  fip(spikes,s=>s.x+s.w>-50);
  fip(movingHills,h=>h.x+h.w>-50);
  fip(gravZones,g=>g.x+g.w>-50&&g.fadeT<60);
  fip(icicles,ic=>ic.state!=='gone'&&ic.x+ic.w>-80);
  // Generate new platforms ahead (pack mode: seeded terrain)
  if(isPackMode&&currentPackStage){
    if(platforms.length===0)platforms.push({x:player.x-30,w:200,h:GROUND_H});
    if(!currentPackStage.noCeiling&&ceilPlats.length===0)ceilPlats.push({x:player.x-30,w:200,h:GROUND_H});
    while(platforms.length>0&&platforms[platforms.length-1].x+platforms[platforms.length-1].w<W+300){
      generatePackPlatform(platforms,false,currentPackStage);
    }
    if(!currentPackStage.noCeiling){
      while(ceilPlats.length>0&&ceilPlats[ceilPlats.length-1].x+ceilPlats[ceilPlats.length-1].w<W+300){
        generatePackPlatform(ceilPlats,true,currentPackStage);
      }
    }
    // Pack mode: boss stage trigger at 90% distance
    if(currentPackStage.boss&&!bossPhase.active&&!bossPhase.reward&&rawDist>=currentPackStage.dist*0.9&&bossPhase.bossCount===0){
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
        sfxFanfare();vibrate('milestone');shakeI=8;
        let starsThisRun=0;for(let _si=0;_si<stageBigCoins.length;_si++)if(stageBigCoins[_si].col)starsThisRun++;
        const sid=currentPackStage.id;
        const prev=packProgress[sid];
        const prevStars=prev?prev.stars:0;
        const newStars=Math.max(prevStars,starsThisRun);
        gotNewStars=Math.max(0,newStars-prevStars);
        packProgress[sid]={cleared:true,stars:newStars};
        localStorage.setItem('gd5pp',JSON.stringify(packProgress));
        // Remove checkpoint pin after clearing
        delete stageCheckpoints[sid];
        localStorage.setItem('gd5checkpoints',JSON.stringify(stageCheckpoints));
        totalStars=getTotalStars();
        const reward=10+starsThisRun*5+(gotNewStars>0?10:0);
        walletCoins+=reward;localStorage.setItem('gd5wallet',walletCoins.toString());
        fbSaveUserData();
        switchBGM('title');
        for(let i=0;i<50&&parts.length<MAX_PARTS;i++)parts.push({x:W*Math.random(),y:-10,vx:(Math.random()-0.5)*4,vy:1+Math.random()*4,life:80+Math.random()*40,ml:120,sz:Math.random()*6+2,col:['#ffd700','#00e5ff','#ff3860','#34d399','#a855f7'][i%5]});
      }
    }
    // Pack mode clear check (non-boss stages)
    if(!currentPackStage.boss&&rawDist>=currentPackStage.dist){
      state=ST.STAGE_CLEAR;stageClearT=0;gotNewStars=0;
      sfxFanfare();vibrate([30,20,30,20,60]);shakeI=8;
      let starsThisRun=0;for(let _si=0;_si<stageBigCoins.length;_si++)if(stageBigCoins[_si].col)starsThisRun++;
      const sid=currentPackStage.id;
      const prev=packProgress[sid];
      const prevStars=prev?prev.stars:0;
      const newStars=Math.max(prevStars,starsThisRun);
      gotNewStars=Math.max(0,newStars-prevStars);
      packProgress[sid]={cleared:true,stars:newStars};
      localStorage.setItem('gd5pp',JSON.stringify(packProgress));
      // Remove checkpoint pin after clearing
      delete stageCheckpoints[sid];
      localStorage.setItem('gd5checkpoints',JSON.stringify(stageCheckpoints));
      totalStars=getTotalStars();
      const reward=10+starsThisRun*5+(gotNewStars>0?10:0);
      walletCoins+=reward;localStorage.setItem('gd5wallet',walletCoins.toString());
      fbSaveUserData();
      switchBGM('title');
      for(let i=0;i<30&&parts.length<MAX_PARTS;i++)parts.push({x:W*Math.random(),y:-10,vx:(Math.random()-0.5)*3,vy:1+Math.random()*3,life:60+Math.random()*40,ml:100,sz:Math.random()*5+2,col:['#ffd700','#00e5ff','#ff3860','#34d399','#a855f7'][i%5]});
    }
    // Star scrolling and collection
    const pr2=playerRadius();
    for(let i=0;i<stageBigCoins.length;i++){const bc=stageBigCoins[i];
      bc.x-=speed;bc.p+=0.06;
      // Compute Y from floor surface + offset
      const fsy=floorSurfaceY(bc.x);
      if(fsy<H+100) bc.y=fsy+bc.yOff;
      else bc.y=H*0.4; // fallback if in gap
    }
    for(let i=0;i<stageBigCoins.length;i++){const bc=stageBigCoins[i];
      if(bc.col)continue;
      const dx=player.x-bc.x,dy=player.y-bc.y;
      const thr=pr2+bc.sz;if(dx*dx+dy*dy<thr*thr){
        bc.col=true;stageBigCollected++;
        sfx('bigcoin');vibrate('bigcoin');shakeI=8;
        addPop(bc.x,bc.y-20,'\u2605 STAR!','#ffd700');
        emitParts(bc.x,bc.y,25,'#ffd700',6,4);
      }
    }
    // Checkpoint flag at 500m (midpoint)
    if(!checkpointReached&&!checkpointFlag.collected){
      const cpDist=currentPackStage.dist*0.5; // midpoint
      const cpScreenX=player.x+(cpDist-rawDist)/(speed*0.08)*speed;
      checkpointFlag.x=cpScreenX;
      // Collection detection (void stages: flag on ceiling; others: floor)
      if(rawDist>=cpDist-5&&rawDist<=cpDist+30){
        const isVoidCP=currentPackStage.stageType==='void';
        const cpSurf=isVoidCP?ceilSurfaceY(cpScreenX)+10:floorSurfaceY(cpScreenX);
        const cpFlagY=isVoidCP?cpSurf+50:cpSurf-50; // flag center
        const dx2=player.x-cpScreenX,dy2=player.y-cpFlagY;
        if(Math.abs(dx2)<30&&Math.abs(dy2)<60){
          checkpointFlag.collected=true;checkpointReached=true;
          // Save checkpoint
          const sid=currentPackStage.id;
          stageCheckpoints[sid]=true;
          localStorage.setItem('gd5checkpoints',JSON.stringify(stageCheckpoints));
          sfx('bigcoin');vibrate('bigcoin');shakeI=5;
          addPop(cpScreenX,cpFlagY-20,t('popCheckpoint'),'#34d399');
          emitParts(cpScreenX,cpFlagY,20,'#34d399',4,3);
        }
      }
    }
    // Enemy spawning in pack mode (much more aggressive than endless)
    const sType=currentPackStage.stageType||'';
    const pastGoal=rawDist>=currentPackStage.dist*0.92;
    if(currentPackStage.enemyChance&&!pastGoal){
      const stageProgress=rawDist/currentPackStage.dist;
      const baseRate=currentPackStage.enemyChance;
      const progressBoost=1+stageProgress*1.5;
      // Swarm stages: spawn enemies very frequently
      const swarmMul=sType==='swarm'?1.8:1;
      if(packRng()<baseRate*progressBoost*0.5*swarmMul) trySpawnEnemy();
    }
    // Stage mode gimmicks based on stageType
    const nearGoal=rawDist>=currentPackStage.dist*0.92;
    if(sType==='gravity'){
      // Gravity stage: moving hills only (only way to traverse abyss)
      if(!nearGoal){
        if(hillCD>0)hillCD--;
        if(hillCD<=0){
          // 新しい上下床のスペースを決定する前に、既存の上下床との重なりをチェック
          const hx=W+30+packRng()*120;
          const hw=50+packRng()*45;
          const isFloor=packRng()<0.5;
          // 同じisFloor側に存在する他の上下床との重なり禁止（絶対ルール）
          // 余白280pxを含めて完全に重ならない位置のみ許可
          const minGap=280;
          let overlap=false;
          for(let _i=0;_i<movingHills.length;_i++){
            const mh=movingHills[_i];
            if(mh.isFloor!==isFloor)continue; // 床と天井は別扱い（視覚的に重ならない）
            if(hx<mh.x+mh.w+minGap && hx+hw>mh.x-minGap){overlap=true;break;}
          }
          if(overlap){
            // 重なる位置なら短いCDで再試行
            hillCD=15+Math.floor(packRng()*15);
          } else {
            const baseH=GROUND_H;
            const ampH=40+packRng()*50;
            movingHills.push({x:hx,w:hw,baseH:baseH,ampH:ampH,phase:packRng()*6.28,spd:0.03+packRng()*0.02,isFloor:isFloor});
            // 通常CDを長く（確実に前の床が十分スクロールするまで待つ）
            hillCD=90+Math.floor(packRng()*60);
          }
        }
      }
    } else if(sType==='void'){
      // Void stage: wall-heavy stage with gravity navigation only
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
        // Dense spikes: lots of red spikes on both floor and ceiling (limited safe landing)
        if(currentPackStage.denseSpikes){
          trySpawnSpike();trySpawnSpike();trySpawnSpike();
        }
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
    } else if(sType==='spikeOnly'){
      // Spike-only stage: dense red spikes on floor+ceiling, no other gimmicks
      if(!nearGoal){
        trySpawnSpike();trySpawnSpike();trySpawnSpike();
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
    // Bird enemy spawning (all stages, rare)
    trySpawnBird();
    // Icicle spawning (snow stages, controlled by icicleChance)
    if(!nearGoal) trySpawnIcicle();
    // Magma fireball spawning (magma stages)
    if(!nearGoal) trySpawnMagmaFire();
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
    // Blackout transition update
    if(challTransition.active){
      updateChallTransition();
    }
    // Boss chaining: spawn next boss after transition ends
    if(challengeNextBossT>0&&!challTransition.active){
      challengeNextBossT--;
      if(challengeNextBossT<=0){
        // Challenge: no HP recovery here (HP +1 already given at boss defeat)
        // Set bossCount for scaling: base + phase boost
        bossPhase.bossCount=challengeKills+challengePhase*3;
        startBossPhase();
      }
    }
    // After boss reward ends, trigger blackout transition
    if(!bossPhase.active&&!bossPhase.reward&&bossPhase.bossCount>0&&challengeNextBossT<=0&&!challTransition.active){
      challengeKills++;
      challengePhase=Math.floor(challengeKills/3);
      challTransition.waveNum=challengeKills+1;
      startChallTransition();
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
      const flipChance=Math.min(0.04,0.008+(score-100)*0.0004);
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
    trySpawnBird();
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
  const pr=playerRadius();
  // Quake stun: completely freeze player (no gravity, no movement)
  if(player._quakeStunned){
    player.vy=0;
  } else {
    const grav=GRAVITY*player.gDir*ct().gravMul;
    player.vy+=grav;
    player.vy=Math.max(-14,Math.min(14,player.vy));
  }
  player.y+=player.vy;

  const _wasGrounded=player.grounded; // for bounce wave landing detection
  // Ground collision
  player.grounded=false;
  const isTire=ct().shape==='tire'||isSpecialActive('tire');
  if(player.gDir===1){
    let surfY=floorSurfaceY(player.x);
    // Tire gap bridging: if over a void, check if tire edges are still on ground
    if(surfY>H+100&&isTire){
      const lS=floorSurfaceY(player.x-pr),rS=floorSurfaceY(player.x+pr);
      if(lS<H+100||rS<H+100) surfY=lS<H+100&&rS<H+100?Math.max(lS,rS):lS<H+100?lS:rS;
    }
    if(player.y+pr>=surfY&&surfY<H+100){
      player.y=surfY-pr;player.vy=0;player.grounded=true;resetFlipState();
    }
  } else {
    let surfY=ceilSurfaceY(player.x);
    // Tire gap bridging for ceiling
    if(surfY<-100&&isTire){
      const lS=ceilSurfaceY(player.x-pr),rS=ceilSurfaceY(player.x+pr);
      if(lS>-100||rS>-100) surfY=lS>-100&&rS>-100?Math.min(lS,rS):lS>-100?lS:rS;
    }
    if(player.y-pr<=surfY&&surfY>-100){
      player.y=surfY+pr;player.vy=0;player.grounded=true;resetFlipState();
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
            player.y=fp.y-pr;player.vy=0;player.grounded=true;resetFlipState();
            player._onFloatPlat=fp;
            break;
          }
        } else if(player.gDir===-1&&player.vy<=0){
          if(player.y-pr<=fp.y+fp.th&&player.y-pr>fp.y-8){
            player.y=fp.y+fp.th+pr;player.vy=0;player.grounded=true;resetFlipState();
            player._onFloatPlat=fp;
            break;
          }
        }
      }
    }
  }
  // Reset air combo when grounded
  if(player.grounded){airCombo=0;stompCombo=0;}
  // Bounce special: landing wave — knock all enemies sideways with boing SE
  if(!_wasGrounded&&player.grounded&&isSpecialActive('bounce')){
    sfx('bounce');vibrate('stomp');shakeI=Math.max(shakeI,8);
    emitParts(player.x,player.y,22,'#ff9988',5,4);
    for(let _ei=0;_ei<enemies.length;_ei++){
      const _en=enemies[_ei];
      if(!_en.alive||_en.bossType||_en.boss)continue;
      _en._bounceKnock=Math.random()<0.5?-1:1;
      _en.vy=-(3+Math.random()*3);
    }
  }

  // Spike gimmick update & collision (proximity-triggered: activates when player approaches)
  for(let i=0;i<spikes.length;i++){const sp=spikes[i];
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
    if(sp.state==='up'&&!playerDamageImmune()&&hurtT<=0){
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
  }

  // Clear _onMovingHill when not grounded (before collision re-sets it)
  if(!player.grounded)player._onMovingHill=null;
  // Moving hill collision (acts as temporary elevated terrain, both floor and ceiling)
  // At high game speed, hills can shift several pixels per frame, so we also
  // explicitly "stick" to the hill each frame when the player is already on it
  // (fixes the micro-bounce / missed-jump bug on moving floors)
  for(let i=0;i<movingHills.length;i++){const mh=movingHills[i];
    const curH=mh.baseH+Math.sin(mh.phase)*mh.ampH;
    if(player.x+pr>mh.x&&player.x-pr<mh.x+mh.w){
      const surfY=mh.isFloor?H-curH:curH;
      if(!mh.isFloor){
        // Ceiling moving hill
        if(player.gDir===-1){
          // Follow the hill if already grounded on it
          if(player.grounded&&player._onMovingHill===mh){
            player.y=surfY+pr;player.vy=0;
          } else if(player.y-pr<=surfY+4&&player.y-pr>surfY-24&&player.vy<=0){
            // Landing (slightly wider vertical tolerance)
            player.y=surfY+pr;player.vy=0;player.grounded=true;resetFlipState();
            player._onMovingHill=mh;
          } else if(player.y-pr<surfY-4&&player.y+pr>surfY&&player.grounded){
            player.y=surfY+pr;
          }
        }
      } else {
        // Floor moving hill
        if(player.gDir===1){
          // Follow the hill if already grounded on it
          if(player.grounded&&player._onMovingHill===mh){
            player.y=surfY-pr;player.vy=0;
          } else if(player.y+pr>=surfY-4&&player.y+pr<surfY+24&&player.vy>=0){
            // Landing (slightly wider vertical tolerance)
            player.y=surfY-pr;player.vy=0;player.grounded=true;resetFlipState();
            player._onMovingHill=mh;
          } else if(player.y+pr>surfY+4&&player.y-pr<surfY&&player.grounded){
            player.y=surfY-pr;
          }
        }
      }
    }
  }

  // Gravity zones: blue=force down (dir=1), pink=force up (dir=-1)
  for(let i=0;i<gravZones.length;i++){const g=gravZones[i];
    if(g.fadeT>0){g.fadeT++;continue;}
    if(g.triggered)continue;
    if(player.x>=g.x&&player.x<=g.x+g.w){
      g.triggered=true;g.fadeT=1;
      const forceDir=g.dir||1;
      // Force gravity direction and reset movement state so player can act again
      player.gDir=forceDir;player.vy=0;
      resetFlipState();
      const col=forceDir===1?'#4488ff':'#ff66aa';
      if(forceDir===1)sfxGravDown();else sfxGravUp();
      vibrate('flip');shakeI=8;
      emitParts(player.x,player.y,15,col,4,3);
      addPop(player.x,player.y-20*player.gDir,forceDir===1?'DOWN!':'UP!',col);
    }
  }

  // Falling mountain update (supports both floor and ceiling)
  for(let i=0;i<fallingMtns.length;i++){const fm=fallingMtns[i];
    fm.x-=speed;
    const isCeil=!fm.isFloor;
    if(fm.state==='idle'){
      // Trigger shaking when player is close (just before passing over)
      if(fm.x<player.x+fm.triggerDist+fm.w){fm.state='shaking';fm.shakeT=45;}
      if(!isCeil){
        const surfY2=H-fm.curH;
        if(player.gDir===1&&player.x+pr>fm.x&&player.x-pr<fm.x+fm.w){
          if(player.y+pr>=surfY2&&player.y+pr<surfY2+12&&player.vy>=0){
            player.y=surfY2-pr;player.vy=0;player.grounded=true;resetFlipState();
          }
        }
      } else {
        const surfY2=fm.curH;
        if(player.gDir===-1&&player.x+pr>fm.x&&player.x-pr<fm.x+fm.w){
          if(player.y-pr<=surfY2&&player.y-pr>surfY2-12&&player.vy<=0){
            player.y=surfY2+pr;player.vy=0;player.grounded=true;resetFlipState();
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
  }
  fip(fallingMtns,fm=>fm.state!=='gone'&&fm.x+fm.w>-50);

  // Icicle update & collision (snow stage gimmick - ceiling only, detach and fall as whole piece)
  for(let i=0;i<icicles.length;i++){const ic=icicles[i];
    if(ic.state==='hang'){
      // When player is on ceiling (gDir===-1), icicles stay hanging as static obstacles (jump over)
      if(player.gDir===-1){
        // No shake, no fall - just a static obstacle
      } else {
        // Already hanging from ceiling. Shake when icicle is slightly AHEAD of player.
        const triggerDist=160; // trigger when player is approaching (icicle ahead)
        if(ic.x<player.x+triggerDist+ic.w&&ic.x+ic.w>player.x-20){
          ic.warnT++;
          if(ic.warnT>=30){
            ic.state='fall';ic.vy=0;
            sfx('icecrack');
            // Dust particles at detach point
            for(let i=0;i<4;i++){
              if(parts.length<MAX_PARTS)parts.push({x:ic.x+ic.w*Math.random(),y:ic.baseY,vx:(Math.random()-0.5)*1.5,vy:0.5+Math.random(),
                life:15,ml:15,sz:Math.random()*2+1,col:'#cceeff'});
            }
          }
        }
      }
    } else if(ic.state==='fall'){
      // Whole icicle falls together (baseY and tipY move together)
      ic.vy+=0.4;
      ic.baseY+=ic.vy;
      ic.tipY+=ic.vy;
      // Hit the floor?
      const floorY=floorSurfaceY(ic.x+ic.w/2);
      if(ic.tipY>=floorY){
        // Embed tip partially into ground (8px)
        ic.tipY=floorY+8;
        ic.baseY=ic.tipY-ic.h;
        ic.state='stuck';ic.stuckT=180; // longer duration for riding
        shakeI=3;sfx('icecrack');
        // Impact particles
        for(let i=0;i<6;i++){
          if(parts.length<MAX_PARTS)parts.push({x:ic.x+ic.w*Math.random(),y:floorY,vx:(Math.random()-0.5)*3,vy:-1-Math.random()*3,
            life:15,ml:15,sz:Math.random()*3+1,col:'#cceeff'});
        }
      }
    } else if(ic.state==='stuck'){
      ic.stuckT--;
      if(ic.stuckT<=0){ic.state='fade';ic.fadeT=30;}
    } else if(ic.state==='fade'){
      ic.fadeT--;
      ic.alpha=Math.max(0,ic.fadeT/30);
      if(ic.fadeT<=0)ic.state='gone';
    }
    // Collision: while hanging or falling (stuck icicles are safe platforms)
    if((ic.state==='fall'||ic.state==='hang')&&!playerDamageImmune()&&hurtT<=0){
      const icTop=ic.baseY;
      const icBot=ic.tipY;
      if(player.x+pr>ic.x&&player.x-pr<ic.x+ic.w){
        if(player.y+pr>icTop&&player.y-pr<icBot){
          hurt(true);
        }
      }
    }
    // Icicle riding: player can stand on stuck icicles (top surface at baseY)
    if(ic.state==='stuck'&&!player.grounded&&player.gDir===1&&player.vy>=0){
      if(player.x>=ic.x-pr*0.3&&player.x<=ic.x+ic.w+pr*0.3){
        if(player.y+pr>=ic.baseY&&player.y+pr<ic.baseY+12){
          player.y=ic.baseY-pr;player.vy=0;player.grounded=true;resetFlipState();
        }
      }
    }
  }

  // Magma fireball update & collision
  for(let i=0;i<magmaFireballs.length;i++){const fb=magmaFireballs[i];
    if(!fb.alive)continue;
    fb.x-=speed; // scroll with world
    fb.originX-=speed;
    // Gravity: floor fireballs go up then fall back, ceiling fireballs go down then come back
    if(fb.isFloor){
      fb.vy+=0.18; // gravity pulls back down
    } else {
      fb.vy-=0.18; // gravity pulls back up (for ceiling magma)
    }
    fb.x+=fb.vx;
    fb.y+=fb.vy;
    fb.phase+=0.1;
    // Remove when returned into magma
    if(fb.isFloor&&fb.y>H+30)fb.alive=false;
    if(!fb.isFloor&&fb.y<-30)fb.alive=false;
    // Collision with player
    if(!playerDamageImmune()&&hurtT<=0){
      const dx=player.x-fb.x,dy=player.y-fb.y;
      if(dx*dx+dy*dy<(pr+fb.sz*0.5)*(pr+fb.sz*0.5)){
        hurt(true);
        magmaHurtT=30; // red flash for magma damage
        // Fire particles on player
        for(let i=0;i<8;i++){
          if(parts.length<MAX_PARTS)parts.push({x:player.x,y:player.y,vx:(Math.random()-0.5)*3,vy:-1-Math.random()*2,
            life:20,ml:20,sz:Math.random()*4+2,col:['#ff4400','#ff6600','#ffaa00'][i%3]});
        }
      }
    }
  }
  fip(magmaFireballs,fb=>fb.alive&&fb.x>-50);

  // Coin switch update (round button)
  for(let i=0;i<coinSwitches.length;i++){const cs=coinSwitches[i];cs.x-=speed;if(cs.flashT>0)cs.flashT--;}
  fip(coinSwitches,cs=>cs.x+cs.r>-50);
  for(let i=0;i<coinSwitches.length;i++){const cs=coinSwitches[i];
    if(cs.activated)continue;
    const magR=playerItemMagnetRadius();
    const magStr=playerItemMagnetStrength();
    if(magR>0&&magStr>0){
      const mdx=player.x-cs.x,mdy=player.y-cs.y,md2=mdx*mdx+mdy*mdy;
      if(md2<magR*magR){
        cs.x+=mdx*magStr*0.7;cs.y+=mdy*magStr*0.7;
        if(md2<(pr+cs.r+10)*(pr+cs.r+10)){triggerCoinSwitch(cs);continue;}
      }
    }
    const dx3=player.x-cs.x,dy3=player.y-cs.y;
    const csR=pr+cs.r+4;
    if(dx3*dx3+dy3*dy3<csR*csR){
      triggerCoinSwitch(cs);
    }
  }

  // Crush detection (terrain pinch)
  const fSurf=floorSurfaceY(player.x);
  const cSurf=ceilSurfaceY(player.x);
  if(fSurf-cSurf<pr*2+4){
    hurt(true);return;
  }
  // Boundaries (void fall = instant death, lose all HP)
  if(player.y+pr>H+30||player.y-pr<-30){die(false);return;}

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

  // Trail (circular buffer)
  {const slot=(_trailHead+_trailLen)%20;
  _trailBuf[slot].x=player.x;_trailBuf[slot].y=player.y;_trailBuf[slot].a=1;
  if(_trailLen<14)_trailLen++;else _trailHead=(_trailHead+1)%20;
  for(let i=0;i<_trailLen;i++)_trailBuf[(_trailHead+i)%20].a-=0.075;}

  // Coins
  for(let i=0;i<coins.length;i++){const c=coins[i];
    c.x-=speed;c.p+=0.08;
    if(!c.col){
      let cd=pr+c.sz;
      const magR=playerCoinMagnetRadius();
      const magStr=playerCoinMagnetStrength();
      if(magR>0&&magStr>0){
        const dx=player.x-c.x,dy=player.y-c.y,d2=dx*dx+dy*dy;
        if(d2<magR*magR){
          if(c.x<player.x){
            // Behind player: boost x pull to overcome scroll speed, y stays normal
            c.x+=Math.sign(dx)*Math.max(Math.abs(dx)*magStr,speed*3);
          } else {
            c.x+=dx*magStr;
          }
          c.y+=dy*magStr;
        }
        if(itemEff.magnet>0)cd*=1.8;
      }
      const dx=player.x-c.x,dy=player.y-c.y;
      if(dx*dx+dy*dy<cd*cd){
        c.col=true;totalCoins++;combo++;comboDsp=combo;comboDspT=55;
        const cTier=getCoinTier();
        const tierGain=1+(Math.max(1,cTier.mul)-1)*SPECIAL_COIN_TIER_FACTOR;
        addSpecialGauge(SPECIAL_COIN_GAIN*tierGain+Math.min(combo,8)*SPECIAL_COMBO_GAIN);
        if(combo>maxCombo)maxCombo=combo;
        const airMul=(ct().shape==='ball'&&!player.grounded)?1.2:1;
        const bon=Math.ceil((3+Math.min(combo-1,8))*ct().coinMul*cTier.mul*cubeSpecialCoinMul()*airMul);
        dist+=bon;sfx(combo>1?'combo':'coin');
        addPop(c.x,c.y-14,'+'+bon,cTier.col);vibrate('coin');
        if(combo>1)addPop(c.x,c.y-34,combo+'x','#ff6b35');
        emitParts(c.x,c.y,6,cTier.sparkCol,3,2);
        player.face='happy';player.faceTimer=15;
      }
    }
  }
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
  for(let i=0;i<items.length;i++){const it=items[i];
    it.x-=speed;it.p+=0.06;
    if(!it.col){
      const magR=playerItemMagnetRadius();
      const magStr=playerItemMagnetStrength();
      if(magR>0&&magStr>0){
        const mdx=player.x-it.x,mdy=player.y-it.y,md2=mdx*mdx+mdy*mdy;
        if(md2<magR*magR){
          if(it.x<player.x){
            it.x+=Math.sign(mdx)*Math.max(Math.abs(mdx)*magStr,speed*3);
          } else {
            it.x+=mdx*magStr;
          }
          it.y+=mdy*magStr;
        }
      }
      const dx=player.x-it.x,dy=player.y-it.y;
      if(dx*dx+dy*dy<(pr+it.sz)*(pr+it.sz)){
        it.col=true;
        addSpecialGauge(SPECIAL_ITEM_GAIN);
        applyItem(it.t);
        addPop(it.x,it.y-18,ITEMS[it.t].name+'!',ITEMS[it.t].col);
        emitParts(it.x,it.y,12,ITEMS[it.t].col,4,3);
        player.face='happy';player.faceTimer=18;
      }
    }
  }
  fip(items,it=>it.x>-50&&!it.col);

  // Enemies
  const esm=enemySpeedMul(); // enemy speed multiplier (1.0 to 2.0)
  for(let i=0;i<enemies.length;i++){const en=enemies[i];
    if(!en.alive)continue;
    // Bounce wave knock: fly sideways then off screen
    if(en._bounceKnock){
      en.x+=en._bounceKnock*(speed*2.5+6);
      en.vy=(en.vy||0)+0.6;
      en.y+=en.vy;
      if(en.x<-100||en.x>W+100||en.y>H+100||en.y<-100){
        en.alive=false;
        addSpecialGauge(SPECIAL_KILL_GAIN*0.5);
        dist+=Math.floor(5+Math.min(score*0.05,15));
      }
      continue;
    }
    en._prevY=en.y;
    // Boss enemies with custom movement: handled by updateBossPhase
    if(en.bossType)continue;
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
      if(!en.boss) en.patrolOriginX-=speed;
      if(en.x>en.patrolOriginX+en.patrolRange) en.patrolDir=-1;
      if(en.x<en.patrolOriginX-en.patrolRange) en.patrolDir=1;
      // score>=20000: periodic small hops
      if(score>=20000){
        if(en._hopCD===undefined)en._hopCD=50+Math.floor(Math.random()*70);
        en._hopCD--;
        if(en._hopCD<=0&&Math.abs(en.vy)<0.1){
          en._hopCD=70+Math.floor(Math.random()*80);
          en.vy=en.gDir===1?-4:4;
        }
      }
      if(en._edgeCD>0){en._edgeCD--;}
      if(en.gDir===1){
        const sy=floorSupportY(en.x);
        const aheadSy=floorSupportY(en.x+en.patrolDir*(en.sz+4));
        // Only snap when landing (vy>=0 moving into ground)
        if(sy<H+100&&en.y+en.sz>=sy&&en.vy>=0){
          en.y=sy-en.sz;en.vy=0;
          if(!en._edgeCD&&(aheadSy>H+100||aheadSy>sy+5)){en.patrolDir*=-1;en._edgeCD=15;en.patrolOriginX=en.x;}
        }
        else{en.vy=(en.vy||0)+GRAVITY;en.y+=en.vy;}
      }else{
        const sy=ceilSupportY(en.x);
        const aheadSy=ceilSupportY(en.x+en.patrolDir*(en.sz+4));
        if(sy>-100&&en.y-en.sz<=sy&&en.vy<=0){
          en.y=sy+en.sz;en.vy=0;
          if(!en._edgeCD&&(aheadSy<-100||aheadSy<sy-5)){en.patrolDir*=-1;en._edgeCD=15;en.patrolOriginX=en.x;}
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
      const sy=floorSupportY(en.x);
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
        const floorY=floorSupportY(en.x);
        const ceilY2=ceilSupportY(en.x);
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
        const sy=floorSupportY(en.x);
        if(sy<H+100){en.y=sy-en.sz;en.vy=0;}
        else{en.vy=(en.vy||0)+GRAVITY;en.y+=en.vy;}
      } else {
        const sy=ceilSupportY(en.x);
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
    } else if(en.type===7){
      // Bird: fly horizontally at spawn height (no vertical tracking)
      en.x-=en.flySpd;
    } else if(en.type===8){
      // Splitter: patrol, detect player, then self-split into 2 small bouncing slimes
      en.x+=en.patrolDir*en.walkSpd*esm;
      en.patrolOriginX-=speed;
      if(en.x>en.patrolOriginX+en.patrolRange) en.patrolDir=-1;
      if(en.x<en.patrolOriginX-en.patrolRange) en.patrolDir=1;
      if(en.gDir===1){
        const sy=floorSupportY(en.x);
        const aheadSy=floorSupportY(en.x+en.patrolDir*(en.sz+4));
        if(sy<H+100){en.y=sy-en.sz;en.vy=0;if(aheadSy>H+100||aheadSy>sy+30)en.patrolDir*=-1;}
        else{en.vy=(en.vy||0)+GRAVITY;en.y+=en.vy;}
      } else {
        const sy=ceilSupportY(en.x);
        const aheadSy=ceilSupportY(en.x+en.patrolDir*(en.sz+4));
        if(sy>-100){en.y=sy+en.sz;en.vy=0;if(aheadSy<-100||aheadSy<sy-30)en.patrolDir*=-1;}
        else{en.vy=(en.vy||0)-GRAVITY;en.y+=en.vy;}
      }
      // Detect player and self-split
      if(!en.splitDone){
        const sdx=player.x-en.x,sdy=player.y-en.y;
        const sdist=Math.sqrt(sdx*sdx+sdy*sdy);
        if(sdist<180){
          en.splitDone=true;en.alive=false;
          const splitCount=score>=20000?3:2;
          for(let si=0;si<splitCount;si++){
            let svx,svy;
            if(splitCount===2){
              svx=(si===0?-1:1)*(1.5+Math.random()*1.0);
              svy=en.gDir===1?-4:4;
            } else {
              // 3-way: left-fast / center-straight / right-varied
              const vxTable=[-(2.2+Math.random()*0.8),(Math.random()-0.5)*0.6,(1.6+Math.random()*1.0)];
              const vyTable=[en.gDir===1?-3.8:3.8, en.gDir===1?-5.5:5.5, en.gDir===1?-3.2:3.2];
              svx=vxTable[si]; svy=vyTable[si];
            }
            const sdir=si===0?-1:si===1?0:1;
            enemies.push({x:en.x+sdir*10,y:en.y,vy:svy,gDir:en.gDir,
              walkSpd:svx,sz:splitCount===3?8:9,alive:true,fr:Math.random()*100,type:9,shootT:999,
              bounceVy:en.gDir===1?-3.5:3.5,patrolOriginX:en.x+sdir*10,lifeT:180+Math.floor(Math.random()*60)});
          }
          sfx('shoot');emitParts(en.x,en.y,12,'#88cc44',4,3);
          addPop(en.x,en.y-en.sz*en.gDir-10,t('popSplit'),'#88cc44');
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
          const sy=floorSupportY(en.x);
          if(en.y+en.sz>=sy&&sy<H+100){en.y=sy-en.sz;en.vy=en.bounceVy;}
        } else {
          const sy=ceilSupportY(en.x);
          if(en.y-en.sz<=sy&&sy>-100){en.y=sy+en.sz;en.vy=en.bounceVy;}
        }
      }
      // expired: no ground collision → falls off screen
    } else if(en.type===14){
      // Leaper: cute round creature that notices and leaps at player
      en.patrolOriginX-=speed;
      en._state=en._state||'patrol';
      if(en._state==='patrol'){
        en.x+=en.patrolDir*en.walkSpd*esm;
        if(en.x>en.patrolOriginX+en.patrolRange)en.patrolDir=-1;
        if(en.x<en.patrolOriginX-en.patrolRange)en.patrolDir=1;
        if(en.gDir===1){const sy=floorSupportY(en.x);if(sy<H+100){en.y=sy-en.sz;en.vy=0;}else{en.vy=(en.vy||0)+GRAVITY;en.y+=en.vy;}}
        else{const sy=ceilSupportY(en.x);if(sy>-100){en.y=sy+en.sz;en.vy=0;}else{en.vy=(en.vy||0)-GRAVITY;en.y+=en.vy;}}
        const ndx=player.x-en.x,ndy=player.y-en.y,nd2=ndx*ndx+ndy*ndy;
        if(nd2<220*220&&Math.abs(ndy)<H*0.4){
          en._state='notice';en._noticeT=50;
        }
      } else if(en._state==='notice'){
        // Crouch telegraph
        if(en.gDir===1){const sy=floorSupportY(en.x);if(sy<H+100)en.y=sy-en.sz*0.65;}
        else{const sy=ceilSupportY(en.x);if(sy>-100)en.y=sy+en.sz*0.65;}
        en._noticeT--;
        if(en._noticeT<=0){
          en._state='jumping';
          const fdx=player.x-en.x;
          en._jVx=fdx/28+speed; // compensate for scroll
          en.vy=en.gDir===1?-10:10;
          if(en.gDir===1){const sy=floorSupportY(en.x);if(sy<H+100)en.y=sy-en.sz;}
          else{const sy=ceilSupportY(en.x);if(sy>-100)en.y=sy+en.sz;}
          sfx('gstomp');shakeI=Math.max(shakeI,3);
        }
      } else if(en._state==='jumping'){
        en.vy+=GRAVITY*en.gDir;
        en.y+=en.vy;
        en.x+=en._jVx||0;
        if(en.gDir===1){
          const sy=floorSupportY(en.x);
          if(en.vy>0&&en.y+en.sz>=sy&&sy<H+100){
            en.y=sy-en.sz;en.vy=0;en._jVx=0;
            en._state='landed';en._landT=55;
            shakeI=Math.max(shakeI,4);emitParts(en.x,sy,6,'#88dd44',3,2);
          }
        } else {
          const sy=ceilSupportY(en.x);
          if(en.vy<0&&en.y-en.sz<=sy&&sy>-100){
            en.y=sy+en.sz;en.vy=0;en._jVx=0;
            en._state='landed';en._landT=55;
            shakeI=Math.max(shakeI,4);emitParts(en.x,sy,6,'#88dd44',3,2);
          }
        }
        if(en.x<-80||en.x>W+80||en.y>H+80||en.y<-80)en.alive=false;
      } else if(en._state==='landed'){
        if(en.gDir===1){const sy=floorSupportY(en.x);if(sy<H+100){en.y=sy-en.sz;en.vy=0;}}
        else{const sy=ceilSupportY(en.x);if(sy>-100){en.y=sy+en.sz;en.vy=0;}}
        en._landT--;
        if(en._landT<=0){en._state='patrol';}
      }
    } else {
      // Default movement (type 1 cannon and legacy)
      // Cannon moves but can't climb steps (falls off edges naturally)
      en.x-=en.walkSpd*esm;
      if(en.gDir===1){
        const sy=floorSupportY(en.x);
        if(sy<H+100){en.y=sy-en.sz;en.vy=0;}
        else{en.vy=(en.vy||0)+GRAVITY;en.y+=en.vy;}
      }else{
        const sy=ceilSupportY(en.x);
        if(sy>-100){en.y=sy+en.sz;en.vy=0;}
        else{en.vy=(en.vy||0)-GRAVITY;en.y+=en.vy;}
      }
    }
    if(isSpecialActive('tire')){
      const tdx=player.x-en.x,tdy=player.y-en.y,td2=tdx*tdx+tdy*tdy;
      const tMagR=SPECIAL_TIRE_MAGNET_RADIUS;
      if(td2<tMagR*tMagR){
        if(en.x<player.x){
          // Behind player: boost x pull to overcome scroll, y stays normal
          en.x+=Math.sign(tdx)*Math.max(Math.abs(tdx)*SPECIAL_TIRE_MAGNET_STRENGTH,speed*4);
        } else {
          en.x+=tdx*SPECIAL_TIRE_MAGNET_STRENGTH;
        }
        en.y+=tdy*SPECIAL_TIRE_MAGNET_STRENGTH;
        // Kill check uses updated position (after movement)
        const ntdx=player.x-en.x,ntdy=player.y-en.y;
        const killR=pr+en.sz+10;
        if(ntdx*ntdx+ntdy*ntdy<killR*killR){
          const bon=cubeSpecialKillBonus(Math.floor(10+Math.min(score*0.1,20)));
          rewardEnemySpecialKill(en,'#f59e0b',bon);
          continue;
        }
      }
    }
    // Collision with player (boss enemies handle their own collision)
    if(en.bossType)continue;
    // Phantom: when invisible, can still damage player but cannot be stomped
    if(en.type===5&&!en.visible){
      const dx2=player.x-en.x,dy2=player.y-en.y;
      const d2=Math.sqrt(dx2*dx2+dy2*dy2);
      if(d2<pr+en.sz){
        if(playerDamageImmune()){
          en.alive=false;sfx('stomp');vibrate('stomp');shakeI=4;
          const bon2=cubeSpecialKillBonus(Math.floor(10+Math.min(score*0.1,20)));dist+=bon2;
          addSpecialGauge(SPECIAL_KILL_GAIN);
          addPop(en.x,en.y-en.sz*en.gDir,'+'+bon2,'#ff00ff');
          emitParts(en.x,en.y,15,'#ff00ff',4,3);
        } else { hurt(); }
      }
      continue;
    }
    const dx=player.x-en.x,dy=player.y-en.y;
    const enR=pr+en.sz;
    if(dx*dx+dy*dy<enR*enR){
      // Invincible: destroy enemy on contact
      if(playerDamageImmune()){
        const bon=cubeSpecialKillBonus(Math.floor(10+Math.min(score*0.1,20)));
        addSpecialGauge(SPECIAL_KILL_GAIN);
        rewardEnemySpecialKill(en,'#ff00ff',bon);
        continue;
      }
      // Fast kill trait (Flame): destroy on contact at high speed
      const fkill=ct().fastKill&&speed>4;
      // Tire roll kill: grounded tire destroys ground-based enemies by rolling into them
      const tireRoll=isTire&&player.grounded&&(en.type===0||en.type===1||en.type===3);
      // Check stomp: player approaching from the "top" of the enemy
      const stomped=fkill||tireRoll||(en.gDir===1&&player.y<en.y-en.sz*0.2&&player.vy>=0)||(en.gDir===-1&&player.y>en.y+en.sz*0.2&&player.vy<=0)||stompRescuedByStep(en);
      if(stomped){
        en.alive=false;
        // Tire: crush without bouncing; others: bounce off enemy
        if(isTire&&(tireRoll||player.grounded)){
          player.vy=0;
        } else {
          player.vy=-JUMP_POWER*0.7*player.gDir;
          player.grounded=false;
        }
        flipCount=0;player.canFlip=true;djumpUsed=false;if(typeof refreshAirActionState==='function')refreshAirActionState(true);else if(ct().hasDjump)djumpAvailable=true;
        // Gravity stomp bonus
        const gstomp=flipTimer<40;
        // Stomp combo: base + combo bonus (additive)
        const baseBon=gstomp?90:30;
        const bon=cubeSpecialKillBonus(baseBon+stompCombo*(gstomp?60:30));
        stompCombo++;
        dist+=bon;
        addSpecialGauge((gstomp?SPECIAL_STOMP_GAIN:SPECIAL_KILL_GAIN)+Math.min(stompCombo,6)*0.8);
        if(gstomp){sfx('gstompHeavy');sfxEnemyDeath(en.type);vibrate('stomp_heavy');shakeI=8;}else{sfxEnemyDeath(en.type);vibrate('stomp');}
        if(stompCombo>=2)sfxStompCombo(stompCombo);
        addPop(en.x,en.y-en.sz*en.gDir,'+'+bon,gstomp?'#ffd700':'#ff3860');
        if(stompCombo>=2){addPop(en.x,en.y-en.sz*en.gDir-22,t('popCombo').replace('{0}',stompCombo),gstomp?'#ffd700':'#ff6600');emitParts(en.x,en.y,14+stompCombo*3,gstomp?'#ffd700':'#ff6600',4,3);}
        if(gstomp){addPop(en.x,en.y-en.sz*en.gDir-(stompCombo>=2?40:22),t('popGStomp'),'#ffd700');emitParts(en.x,en.y,20,'#ffd700',5,4);}
        else{emitParts(en.x,en.y,12,'#ff3860',4,3);}
        for(let j=i+1;j<enemies.length;j++){
          const other=enemies[j];
          if(!other.alive||other.bossType||(other.type===5&&!other.visible))continue;
          const odx=player.x-other.x,ody=player.y-other.y;
          const otherR=pr+other.sz;
          if(odx*odx+ody*ody<otherR*otherR)rewardStackedStompEnemy(other,gstomp);
        }
        // Aerial combo: consecutive kills without touching ground
        if(!player.grounded){airCombo++;sfxAirCombo(airCombo);const acb=airCombo*5;dist+=acb;addPop(en.x,en.y-en.sz*en.gDir-36,airCombo+' AIR COMBO!','#00e5ff');emitParts(en.x,en.y,8,'#00e5ff',3,2);}
        player.face='happy';player.faceTimer=18;
      }else{
        hurt();continue;
      }
    }
  }
  fip(enemies,en=>(en.boss||en.x>-50)&&en.alive&&en.y>-200&&en.y<H+200);

  // Attack speed multiplier based on score
  const atkMul=score>=10000?1.5:(score>=5000?1.2:1);
  // Shooter enemies fire horizontal bullets at player's Y position
  for(let i=0;i<enemies.length;i++){const en=enemies[i];
    if(!en.alive||en.type!==1)continue;
    en.shootT-=esm*atkMul;
    if(en.shootT<=0&&en.x>0&&en.x<W+50){
      en.shootT=90+Math.floor(Math.random()*50);
      const bspd=(4+speed*0.3)*esm;
      // Fire horizontally from the enemy's position
      bullets.push({x:en.x-en.sz,y:en.y,vx:-bspd,vy:0,sz:5,life:180});
      sfx('shoot');
    }
  }
  // Bomber enemies throw bombs in a parabolic arc toward player
  for(let i=0;i<enemies.length;i++){const en=enemies[i];
    if(!en.alive||en.type!==3)continue;
    en.bombCD-=esm*atkMul;
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
  }

  // Update bullets
  const bpr=playerRadius();
  for(let i=0;i<bullets.length;i++){const b=bullets[i];
    b.x+=b.vx;b.y+=b.vy;b.life--;
    // Shockwave: stays on floor, tall hitbox
    if(b.shockwave){
      const sy=floorSurfaceY(b.x);
      if(sy<H+100)b.y=sy-6;
      // Tall collision area (player must jump over)
      const dx=player.x-b.x,dy=player.y-(b.y-20);
      if(Math.abs(dx)<bpr+b.sz&&dy>-40&&dy<30){
        if(!playerDamageImmune()&&hurtT<=0){b.life=0;hurt();}
      }
      // Particles trail
      if(b.life%3===0&&parts.length<MAX_PARTS)parts.push({x:b.x,y:b.y,vx:(Math.random()-0.5)*0.5,vy:-1-Math.random()*2,life:12,ml:12,sz:Math.random()*4+2,col:'#ffaa00'});
      continue;
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
        if(edx*edx+edy*edy<2500){hurt();}
        continue;
      }
    }
    const dx=player.x-b.x,dy=player.y-b.y;
    const bthr=bpr+b.sz;if(dx*dx+dy*dy<bthr*bthr){
      b.life=0;
      if(b.bomb)emitParts(b.x,b.y,8,'#ff6600',4,2);
      hurt();
    }
  }
  fip(bullets,b=>b.life>0&&(b.wizBullet||(b.x>-50&&b.x<W+100&&b.y>-50&&b.y<H+50)));

  // Wall collision: hitting the side of a higher platform step.
  // Normal characters can clear up to half their height; tires can clear up to full height.
  {
    const STEP_TOLERANCE=isTire?pr*2:pr*1.5;
    if(player.gDir===1){
      for(let i=0;i<platforms.length;i++){
        const p=platforms[i];
        if(p.x>player.x-pr&&p.x<player.x+pr+speed*2){
          const surfY=H-p.h;
          if(player.y+pr>surfY+4){
            const stepH=player.y+pr-surfY;
            if(stepH<=STEP_TOLERANCE){
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
            if(stepH<=STEP_TOLERANCE){
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
  for(let i=0;i<stars.length;i++){const s=stars[i];s.x-=s.sp*speed*0.3;s.tw+=s.ts;if(s.x<-5)s.x=W+5;}
  for(let i=0;i<mtns.length;i++){const m=mtns[i];m.off-=m.sp*speed*0.15;if(m.off<-500)m.off+=500;}
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
  for(let i=0;i<ambientParts.length;i++){const p=ambientParts[i];
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
  }
  ctx.globalAlpha=1;
}

// ===== CHALLENGE MODE: BLACKOUT TRANSITION =====
function startChallTransition(){
  challTransition.active=true;
  challTransition.timer=0;
}
function updateChallTransition(){
  const ct_=challTransition;
  ct_.timer++;
  // 0-25: fade to black
  // 25: rebuild terrain & reposition player
  if(ct_.timer===25){
    platforms.length=0;ceilPlats.length=0;
    platforms.push({x:player.x-100,w:300,h:GROUND_H});
    ceilPlats.push({x:player.x-100,w:300,h:GROUND_H});
    player.y=H-GROUND_H-playerRadius();
    player.vy=0;player.grounded=true;player.gDir=1;
    enemies=[];bullets=[];
  }
  // 85-120: fade out
  // 120: done
  if(ct_.timer>=120){
    ct_.active=false;ct_.timer=0;
    challengeNextBossT=60;
    switchBGM('challenge');
  }
}
