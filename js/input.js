'use strict';
// Named constant: 3 seconds * 60fps
const COUNTDOWN_FRAMES = 180;
// Generic axis-aligned rectangle hit test helper
function hitRect(tx, ty, x, y, w, h){ return tx>=x && tx<=x+w && ty>=y && ty<=y+h; }
let touchStartY=0,touchStartX=0,touchStartT=0,touchMoved=false,touchBtnUsed=false;
let touchOriginY=0; // original Y at touchstart (not modified by scroll handlers)
// Character modal (long-press on title to show details + animated demo)
let charModal={show:false,idx:0,animT:0};
let longPressTimer=null,longPressFired=false,titleTouchPos=null;
let draggingSlider=null; // 'bgm' or 'sfx' when dragging a settings slider

function canvasXY(cx,cy){
  const r=canvas.getBoundingClientRect();
  return{x:cx-r.left,y:cy-r.top};
}

// Pause button hit test (moved lower, larger area for reliability)
function hitPauseBtn(px,py){return hitRect(px,py,W-58,safeTop+8,54,44);}
function itemBtnLayout(){const btnSz=44,btnGap=12,totalW=btnSz*2+btnGap,sx=W/2-totalW/2,by=H-PANEL_H-safeBot+6;return{invX:sx,bombX:sx+btnSz+btnGap,y:by,sz:btnSz};}
function hitInvBtn(px,py){const b=itemBtnLayout();return px>=b.invX&&px<=b.invX+b.sz&&py>=b.y&&py<=b.y+b.sz;}
function hitBombBtn(px,py){const b=itemBtnLayout();return px>=b.bombX&&px<=b.bombX+b.sz&&py>=b.y&&py<=b.y+b.sz;}
function pauseBtnLayout(){
  const hasSSel=isPackMode&&!isChallengeMode;
  const bBase=hasSSel?0.40:0.42;
  const bStep=hasSSel?0.10:0.11;
  return{resumeY:H*bBase,restartY:H*(bBase+bStep),stageSelY:hasSSel?H*(bBase+bStep*2):0,quitY:H*(bBase+bStep*(hasSSel?3:2)),hasStageSel:hasSSel};
}
function hitResumeBtn(px,py){const l=pauseBtnLayout();return px>=W/2-80&&px<=W/2+80&&py>=l.resumeY&&py<=l.resumeY+44;}
function hitRestartBtn(px,py){const l=pauseBtnLayout();return px>=W/2-80&&px<=W/2+80&&py>=l.restartY&&py<=l.restartY+44;}
function hitPauseStageSelBtn(px,py){const l=pauseBtnLayout();return l.hasStageSel&&px>=W/2-80&&px<=W/2+80&&py>=l.stageSelY&&py<=l.stageSelY+44;}
function hitQuitBtn(px,py){const l=pauseBtnLayout();return px>=W/2-80&&px<=W/2+80&&py>=l.quitY&&py<=l.quitY+44;}
// Game over screen buttons (must match drawDead layout exactly)
function deadBtnLayout(){
  const btnW2=Math.min(220,W-40),btnH2=38,btnX2=W/2-btnW2/2;
  const btns=[];
  if(isChallengeMode){
    // Challenge result: restart + title only
    const cardY=H*0.25,cardH=180;
    let btnTop=cardY+cardH+14;
    btns.push({id:'restart',x:btnX2,y:btnTop,w:btnW2,h:btnH2});
    btnTop+=btnH2+8;
    btns.push({id:'title',x:btnX2,y:btnTop,w:btnW2,h:btnH2});
  } else {
    const cardY=H*0.24,cardH=210+(runChests>0?56:0);
    let btnTop=cardY+cardH+12;
    if(!isPackMode){
      btns.push({id:'continue',x:btnX2,y:btnTop,w:btnW2,h:btnH2});
      btnTop+=btnH2+8;
    }
    btns.push({id:'restart',x:btnX2,y:btnTop,w:btnW2,h:btnH2});
    btnTop+=btnH2+8;
    btns.push({id:'title',x:btnX2,y:btnTop,w:btnW2,h:btnH2});
  }
  return btns;
}
function hitDeadChestBtn(px,py){
  if(runChests<=0)return false;
  const cardY=H*0.24;
  const scoreY=cardY+(newHi?68:60);
  const divY=scoreY+(maxCombo>1?82:70);
  const coinY=divY+18;
  const chestY=coinY+20;
  const ocW=140,ocH=28,ocX=W/2-ocW/2,ocY=chestY+6;
  return px>=ocX&&px<=ocX+ocW&&py>=ocY&&py<=ocY+ocH;
}
function hitDeadBtn(px,py){
  const btns=deadBtnLayout();
  for(const b of btns){
    if(px>=b.x&&px<=b.x+b.w&&py>=b.y&&py<=b.y+b.h)return b.id;
  }
  return null;
}
function canFreeRevive(){return freeRevivesUsed<5;}
function handleDeadBtn(btnId){
  if(btnId==='continue'){
    if(usedContinue){sfx('hurt');vibrate(15);return;}
    if(canFreeRevive()){
      // Free revival for new users (first 5 games)
      freeRevivesUsed++;localStorage.setItem('gd5freeRevives',freeRevivesUsed.toString());
      usedContinue=true;
      sfx('select');continueFromDeath();
    } else if(walletCoins>=100){
      walletCoins-=100;localStorage.setItem('gd5wallet',walletCoins.toString());
      usedContinue=true;
      sfx('select');continueFromDeath();
    } else {sfx('hurt');vibrate(15);}
  } else if(btnId==='restart'){
    sfx('click');
    if(isChallengeMode){startChallenge();return;}
    if(isPackMode){startPackStageFromDead();return;}
    startCountdown('endless');
  } else if(btnId==='title'){
    sfx('cancel');titleTouchPos=null;
    isChallengeMode=false;
    if(isPackMode){state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;stageSelGuardT=30;switchBGM('title');}
    else{state=ST.TITLE;switchBGM('title');}
  }
}
function handleInventoryChestTap(tapX,tapY){
  if(!inventoryOpen&&!deadChestOpen)return false;
  // Check for batch open button tap (only in inventory, NOT game over, phase=none, 2+ chests)
  if(!deadChestOpen&&chestOpen.phase==='none'&&storedChests>=2&&tapX!==undefined){
    const cx=W/2,mW2=Math.min(300,W-24),mH2=Math.min(400,H-40);
    const mY2=(H-mH2)/2,cy=mY2+mH2*0.42;
    const boW=160,boH=34,boX=cx-boW/2,boY=cy+82;
    if(tapX>=boX&&tapX<=boX+boW&&tapY>=boY&&tapY<=boY+boH){
      // Open ALL chests at once
      chestBatchResults=[];
      const count=storedChests;
      for(let i=0;i<count;i++){
        startInventoryChestOpen();
        const rw=chestOpen.reward;
        chestBatchResults.push(rw);
        // Apply rewards immediately
        if(rw.type==='coin'){
          walletCoins+=rw.amount;localStorage.setItem('gd5wallet',walletCoins.toString());
        }
        if(rw.type==='char'){
          if(rw.isNew){unlockCharFromChest(rw.charIdx);}
          else{rw.bonusCoins=500;walletCoins+=500;localStorage.setItem('gd5wallet',walletCoins.toString());}
        }
        if(rw.type==='cosmetic'){
          if(rw.item&&rw.item.rarity==='super_rare'&&rw.isNew){/* already granted in startInventoryChestOpen */}
          if(!rw.isNew){walletCoins+=300;localStorage.setItem('gd5wallet',walletCoins.toString());}
        }
        totalChestsOpened++;
      }
      localStorage.setItem('gd5chestTotal',totalChestsOpened.toString());
      storedChests=0;localStorage.setItem('gd5storedChests','0');
      chestOpen.phase='batchDone';chestOpen.t=0;chestOpen.parts=[];
      chestOpen._lastRevealIdx=-1;
      chestBatchMode=false;
      if(typeof fbSaveUserData==='function')fbSaveUserData();
      sfx('select');sfxChestOpen();vibrate([30,20,40,20,80]);shakeI=15;
      return true;
    }
  }
  // Tap anywhere in inventory when no chest is opening: start first chest
  if(chestOpen.phase==='none'&&storedChests>0){
    chestBatchMode=false;
    startInventoryChestOpen();
    return true;
  }
  if(chestOpen.phase==='waiting'){
    chestOpen.phase='wobble';chestOpen.t=0;sfx('select');vibrate(15);
    totalChestsOpened++;localStorage.setItem('gd5chestTotal',totalChestsOpened.toString());
    storedChests--;localStorage.setItem('gd5storedChests',storedChests.toString());
    if(deadChestOpen)deadChestsOpened++;
    if(typeof fbSaveUserData==='function')fbSaveUserData();
    return true;
  }
  if(chestOpen.phase==='done'){
    if(chestBatchMode){
      // Collect result
      chestBatchResults.push(chestOpen.reward);
      if(storedChests>0){
        startInventoryChestOpen();
        // Auto-open immediately in batch mode
        chestOpen.phase='wobble';chestOpen.t=0;
        totalChestsOpened++;localStorage.setItem('gd5chestTotal',totalChestsOpened.toString());
        storedChests--;localStorage.setItem('gd5storedChests',storedChests.toString());
      } else {
        // All done - show batch summary
        chestOpen.phase='batchDone';chestOpen.t=0;chestBatchMode=false;
      }
      sfx('click');
      return true;
    }
    // On dead screen, only open up to runChests; otherwise check storedChests
    const hasMore=deadChestOpen?(deadChestsOpened<runChests&&storedChests>0):(storedChests>0);
    if(hasMore){
      startInventoryChestOpen();
    } else {
      chestOpen.phase='none';chestOpen.t=0;chestOpen.parts=[];chestOpen.reward=null;
      if(deadChestOpen){deadChestOpen=false;}
      if(typeof fbSaveUserData==='function')fbSaveUserData();
    }
    sfx('click');
    return true;
  }
  if(chestOpen.phase==='batchDone'){
    // Only allow close after all cards revealed (calculate total reveal time)
    const n2=chestBatchResults.length;
    const bd2=n2>20?20:n2>10?28:36;
    let ct2=30;
    chestBatchResults.forEach(r2=>{
      const rar2=r2&&r2.type==='cosmetic'&&r2.item?r2.item.rarity:null;
      const inc2=r2&&r2.type==='char'&&r2.isNew;
      ct2+=bd2+(rar2==='super_rare'?60:rar2==='rare'?35:inc2?25:0);
    });
    if(chestOpen.t<ct2)return true; // block tap during reveal
    chestOpen.phase='none';chestOpen.t=0;chestOpen.parts=[];chestOpen.reward=null;
    chestBatchResults=[];
    if(deadChestOpen){deadChestOpen=false;}
    sfx('click');
    return true;
  }
  return true; // block taps during animation
}
function startInventoryChestOpen(){
  // Gacha probabilities:
  // Super Rare: 2%, Character: 15%, Secret (rare): 10%, Normal: 15%,
  // 1000 coins: 5%, 200 coins: 13%, 100 coins: 20%, 60 coins: 20%
  const roll=Math.random();
  let reward;
  if(roll<0.02){
    // Super Rare cosmetic (2%)
    const allSR=[];
    SHOP_ITEMS.skins.forEach(it=>{if(it.rarity==='super_rare')allSR.push({...it,tab:0});});
    SHOP_ITEMS.eyes.forEach(it=>{if(it.rarity==='super_rare')allSR.push({...it,tab:1});});
    SHOP_ITEMS.effects.forEach(it=>{if(it.rarity==='super_rare')allSR.push({...it,tab:2});});
    if(allSR.length>0){
      const ri=allSR[Math.floor(Math.random()*allSR.length)];
      const isNew=!ownsItem(ri.id);
      if(isNew){ownedItems.push(ri.id);localStorage.setItem('gd5owned',JSON.stringify(ownedItems));notifNewCosmetic=true;localStorage.setItem('gd5notifCosm','1');newCosmeticIds.add(ri.id);localStorage.setItem('gd5newCosm',JSON.stringify([...newCosmeticIds]));}
      reward={type:'cosmetic',item:ri,isNew:isNew,bonusCoins:isNew?0:300};
    } else {
      reward={type:'coin',amount:1000};
    }
  } else if(roll<0.17){
    // Character (15%) - exclude default cube (index 0), prefer unowned chars
    const charPool=[];
    for(let ci=1;ci<CHARS.length;ci++){
      const owned=isCharUnlocked(ci);
      // Unowned chars get weight 3, owned chars get weight 1
      const w=owned?1:3;
      for(let wi=0;wi<w;wi++)charPool.push(ci);
    }
    const ci=charPool[Math.floor(Math.random()*charPool.length)];
    reward={type:'char',charIdx:ci,isNew:!isCharUnlocked(ci),bonusCoins:0};
  } else if(roll<0.27){
    // Secret (rare) cosmetic item (10%) - duplicates allowed
    const allRare=[];
    SHOP_ITEMS.skins.forEach(it=>{if(it.rarity==='rare')allRare.push({...it,tab:0});});
    SHOP_ITEMS.eyes.forEach(it=>{if(it.rarity==='rare')allRare.push({...it,tab:1});});
    SHOP_ITEMS.effects.forEach(it=>{if(it.rarity==='rare')allRare.push({...it,tab:2});});
    if(allRare.length>0){
      const ri=allRare[Math.floor(Math.random()*allRare.length)];
      const isNew=!ownsItem(ri.id);
      if(isNew){ownedItems.push(ri.id);localStorage.setItem('gd5owned',JSON.stringify(ownedItems));notifNewCosmetic=true;localStorage.setItem('gd5notifCosm','1');newCosmeticIds.add(ri.id);localStorage.setItem('gd5newCosm',JSON.stringify([...newCosmeticIds]));}
      reward={type:'cosmetic',item:ri,isNew:isNew,bonusCoins:isNew?0:300};
    } else {
      reward={type:'coin',amount:1000};
    }
  } else if(roll<0.42){
    // Normal cosmetic item (15%) - duplicates allowed
    const allNormal=[];
    SHOP_ITEMS.skins.forEach(it=>{if(!it.rarity)allNormal.push({...it,tab:0});});
    SHOP_ITEMS.eyes.forEach(it=>{if(!it.rarity)allNormal.push({...it,tab:1});});
    SHOP_ITEMS.effects.forEach(it=>{if(!it.rarity)allNormal.push({...it,tab:2});});
    if(allNormal.length>0){
      const ni=allNormal[Math.floor(Math.random()*allNormal.length)];
      const isNew=!ownsItem(ni.id);
      if(isNew){ownedItems.push(ni.id);localStorage.setItem('gd5owned',JSON.stringify(ownedItems));notifNewCosmetic=true;localStorage.setItem('gd5notifCosm','1');newCosmeticIds.add(ni.id);localStorage.setItem('gd5newCosm',JSON.stringify([...newCosmeticIds]));}
      reward={type:'cosmetic',item:ni,isNew:isNew,bonusCoins:isNew?0:300};
    } else {
      reward={type:'coin',amount:200};
    }
  } else if(roll<0.47){reward={type:'coin',amount:1000};}
  else if(roll<0.60){reward={type:'coin',amount:200};}
  else if(roll<0.80){reward={type:'coin',amount:100};}
  else{reward={type:'coin',amount:60};}
  chestOpen.phase='waiting';chestOpen.t=0;
  chestOpen.charIdx=reward.type==='char'?reward.charIdx:-1;
  chestOpen.parts=[];chestOpen.reward=reward;
}
function continueFromDeath(){
  // Keep score, reset speed, revive player, start with countdown
  player.alive=true;player.face='normal';
  player.gDir=1;player.vy=0;player.canFlip=true;
  player.rot=0;player.rotTarget=0;_trailHead=0;_trailLen=0;player.faceTimer=0;
  hp=HP_MAX+(ct().hpBonus||0);hurtT=0;
  rawDist=0; // reset rawDist so speed returns to SPEED_INIT
  // Rebuild safe platforms around player
  platforms=[];ceilPlats=[];
  platforms.push({x:player.x-W*0.3,w:W*0.9,h:GROUND_H});
  ceilPlats.push({x:player.x-W*0.3,w:W*0.9,h:GROUND_H});
  for(let i=0;i<5;i++){generatePlatform(platforms,false);generatePlatform(ceilPlats,true);}
  player.x=W*0.2;
  player.y=floorSurfaceY(player.x)-PLAYER_R;player.grounded=false;
  // Clear hazards
  enemies=[];bullets=[];spikes=[];items=[];floatPlats=[];movingHills=[];gravZones=[];icicles=[];
  bossPhase={active:false,prepare:0,alertT:0,enemies:[],defeated:0,total:0,reward:false,rewardT:0,nextAt:(Math.floor(rawDist/BOSS_INTERVAL)+1)*BOSS_INTERVAL,lastBossScore:score,lastBossRawDist:rawDist,bossCount:bossPhase.bossCount||0,bossType:'',noDamage:true};
  itemEff={invincible:0,magnet:0};bombCount=0;bombFlashT=0;invCount=0;
  djumpAvailable=!!ct().hasDjump;djumpUsed=false;ghostPhaseT=0;ghostInvis=false;
  player._quakeStunned=false;player._quakeStunT=0;
  deadT=0;newHi=false;combo=0;comboT=0;comboDsp=0;comboDspT=0;airCombo=0;stompCombo=0;
  shakeX=0;shakeY=0;shakeI=0;flipCount=0;flipTimer=999;
  coinCD=0;itemCD=0;enemyCD=0;birdCD=0;spikeCD=0;hillCD=0;floatCD=0;gravZoneCD=0;icicleCD=0;
  flipZone={active:false,type:0,len:0,cd:0,lastType:-1};
  bossChests=0;chestFall={active:false,x:0,y:0,vy:0,sparkT:0,gotT:0};chestOpen={phase:'none',t:0,charIdx:-1,parts:[],reward:null};
  state=ST.COUNTDOWN;countdownT=COUNTDOWN_FRAMES;
  curTheme=0;prevTheme=0;themeLerp=1; // reset theme to initial color
  bgmTierOffset=Math.floor(score/1000); // BGM restarts from play1, progresses every 1000 score
  _pauseSavedBGM=''; // clear any stale pause state
  stopBGM(); // stop dead BGM with quick fade-out, force restart when countdown ends
  sfx('countdown');
}
function startPackStageFromDead(){
  // If checkpoint was reached in this run (or saved), restart from checkpoint
  const sid=currentPackStage?currentPackStage.id:'';
  const hasCp=checkpointReached||stageCheckpoints[sid];
  resetPackStage(currentPackIdx,currentPackStageIdx,hasCp);
  state=ST.COUNTDOWN;countdownT=COUNTDOWN_FRAMES;
  stopBGM(); // stop dead BGM, force restart when countdown ends
  sfx('countdown');
}

// Update info modal touch handler
function handleUpdateInfoTouch(tx,ty){
  const uw=Math.min(310,W-16),uh=Math.min(460,H-20),ux=W/2-uw/2,uy=H/2-uh/2;
  // Page navigation arrows
  const arrowY=uy+22;
  if(ty>=arrowY&&ty<=arrowY+30){
    // Left arrow (newer)
    if(tx>=ux&&tx<=ux+40&&updateInfoPage>0){sfx('click');updateInfoPage--;return;}
    // Right arrow (older)
    if(tx>=ux+uw-40&&tx<=ux+uw&&updateInfoPage<UPDATE_HISTORY.length-1){sfx('click');updateInfoPage++;return;}
  }
  // Close button - auto dismiss on close
  const uCloseY=uy+uh-42;
  if(tx>=W/2-50&&tx<=W/2+50&&ty>=uCloseY&&ty<=uCloseY+32){sfx('click');localStorage.setItem('gd5updateDismissed',UPDATE_VER);updateInfoOpen=false;updateInfoPage=0;return;}
  // Tap outside - auto dismiss on close
  if(tx<ux||tx>ux+uw||ty<uy||ty>uy+uh){sfx('cancel');localStorage.setItem('gd5updateDismissed',UPDATE_VER);updateInfoOpen=false;updateInfoPage=0;return;}
}
// Help overlay touch handler
function handleHelpTouch(tx,ty){
  const hw=Math.min(300,W-20),hh=420,hx=W/2-hw/2,hy=H/2-hh/2;
  // Close button
  const hCloseY=hy+hh-42;
  if(tx>=W/2-50&&tx<=W/2+50&&ty>=hCloseY&&ty<=hCloseY+32){sfx('click');helpOpen=false;return;}
  // Tap anywhere outside the modal closes it
  if(tx<hx||tx>hx+hw||ty<hy||ty>hy+hh){sfx('cancel');helpOpen=false;return;}
}

// Settings panel input helpers (must match drawTitle layout)
function settingsLayout(){
  const pw=Math.min(280,W-30),ph=582,px=W/2-pw/2,py=H/2-ph/2;
  const slW=pw-50,slX=px+25,barX=slX+42,barW=slW-42;
  const slY1=py+52,slY2=slY1+44;
  const barH=10;
  const langY=slY2+30;
  const langBtnW=48,langBtnH=22,langBtnGap=6;
  const langBtnX=slX+54;
  const engBtnX=langBtnX+langBtnW+langBtnGap;
  const nameY=langY+24;
  const tutBtnY=nameY+22;
  const resetBtnY=tutBtnY+38;
  const methodY=resetBtnY+42;
  const linkBtnOffset=fbLoginMethod==='anonymous'?42:0;
  const linkY=methodY+10;
  const linkBW=(pw-48)/2;
  const logoutBtnY=methodY+8+linkBtnOffset;
  const deleteAccBtnY=logoutBtnY+56;
  return{px,py,pw,ph,slX,barX,barW,barY1:slY1-8,barY2:slY2-8,barH,langY,langBtnX,langBtnW,langBtnH,engBtnX,nameY,tutBtnY,resetBtnY,linkY,linkBW,logoutBtnY,deleteAccBtnY,closeY:py+ph-42};
}
function hitSettingsGear(tx,ty){return hitRect(tx,ty,W-44,safeTop+6,36,36);}
function hitHelpBtn(tx,ty){return hitRect(tx,ty,W-44,safeTop+44,36,36);}
function hitUpdateBtn(tx,ty){return hitRect(tx,ty,W-44,safeTop+82,36,36);}
function handleConfirmModalTouch(tx,ty){
  if(!confirmModal)return false;
  const mW=Math.min(280,W-40),mH=220;
  const mX=W/2-mW/2,mY=H/2-mH/2;
  const btnW=(mW-60)/2,btnH=40;
  const cancelX=mX+15,confirmX=mX+mW-15-btnW;
  const btnY=mY+mH-60;
  // Cancel button
  if(tx>=cancelX&&tx<=cancelX+btnW&&ty>=btnY&&ty<=btnY+btnH){
    sfx('cancel');confirmModal=null;return true;
  }
  // Confirm button
  if(tx>=confirmX&&tx<=confirmX+btnW&&ty>=btnY&&ty<=btnY+btnH){
    if(confirmModal.type==='reset'){
      // Reset: 2-step confirmation
      if(confirmModal.step===0){confirmModal.step=1;sfx('hurt');vibrate(30);return true;}
      const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('gd5'))keys.push(k);}
      keys.forEach(k=>localStorage.removeItem(k));
      sfx('bomb');vibrate(50);
      confirmModal=null;settingsOpen=false;
      if(typeof fbDeleteUserData==='function'){fbDeleteUserData().finally(()=>location.reload());}
      else{location.reload();}
    } else if(confirmModal.type==='deleteAccount'){
      // Delete Account: 2-step confirmation
      if(confirmModal.step===0){confirmModal.step=1;sfx('hurt');vibrate(30);return true;}
      sfx('bomb');vibrate(50);
      confirmModal=null;settingsOpen=false;
      // Stop pending auto-saves before deletion
      fbSynced=false;if(typeof _fbSaveTimer!=='undefined')clearTimeout(_fbSaveTimer);
      if(typeof fbDeleteAccount==='function'){
        fbDeleteAccount()
          .then(()=>{
            // Clear localStorage only after Firebase deletion succeeds
            const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('gd5'))keys.push(k);}
            keys.forEach(k=>localStorage.removeItem(k));
            addPop(W/2,H/2,t('deleteAccountDone'),'#ff4444');
            setTimeout(()=>location.reload(),1200);
          })
          .catch(err=>{
            // auth/requires-recent-login: session too old, need re-auth
            if(err&&err.code==='auth/requires-recent-login'){
              addPop(W/2,H/2,t('deleteAccountError'),'#ff8600');
            } else {
              addPop(W/2,H/2,t('deleteAccountError'),'#ff3860');
            }
            sfx('hurt');
          });
      } else{location.reload();}
    } else {
      // Logout: single confirmation
      sfx('cancel');vibrate(30);
      confirmModal=null;settingsOpen=false;
      fbSynced=false;clearTimeout(_fbSaveTimer);
      const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('gd5'))keys.push(k);}
      keys.forEach(k=>localStorage.removeItem(k));
      if(fbLoginMethod==='anonymous'&&typeof fbDeleteUserData==='function'){
        fbDeleteUserData().finally(()=>location.reload());
      } else if(typeof fbSignOut==='function'){fbSignOut().finally(()=>location.reload());}
      else{location.reload();}
    }
    return true;
  }
  // Tap outside modal = close
  if(tx<mX||tx>mX+mW||ty<mY||ty>mY+mH){
    sfx('cancel');confirmModal=null;return true;
  }
  return true; // absorb all touches while modal is open
}
function handleSettingsTouch(tx,ty){
  if(confirmModal){return handleConfirmModalTouch(tx,ty);}
  const s=settingsLayout();
  // Close button
  if(tx>=W/2-60&&tx<=W/2+60&&ty>=s.closeY&&ty<=s.closeY+32){sfx('click');settingsOpen=false;resetConfirmStep=0;nameEditMode=false;logoutConfirm=false;confirmModal=null;return true;}
  // Language buttons
  if(ty>=s.langY-14&&ty<=s.langY-14+s.langBtnH){
    if(tx>=s.langBtnX&&tx<=s.langBtnX+s.langBtnW){setLang('ja');sfx('click');return true;}
    if(tx>=s.engBtnX&&tx<=s.engBtnX+s.langBtnW){setLang('en');sfx('click');return true;}
  }
  // Name change button / OK button
  if(nameEditMode){
    // OK button (right side of input)
    if(tx>=s.px+s.pw-42&&tx<=s.px+s.pw&&ty>=s.nameY-14&&ty<=s.nameY+8){
      const newName=nameEditBuf.trim();
      if(newName.length<1){sfx('hurt');vibrate(10);return true;}
      if(newName===playerName){nameEditMode=false;sfx('click');return true;}
      // NG word check
      if(typeof ngCheck==='function'&&ngCheck(newName)){
        sfx('hurt');vibrate(15);
        addPop(W/2,H/2,t('popNameBanned'),'#ff3860');
        return true;
      }
      // Check name uniqueness then save
      fbCheckNameExists(newName).then(taken=>{
        if(taken){
          sfx('hurt');vibrate(15);
          addPop(W/2,H/2,t('nameInUse'),'#ff3860');
        } else {
          playerName=newName;localStorage.setItem('gd5username',playerName);
          nameEditMode=false;sfx('select');vibrate(10);
          addPop(W/2,H/2,t('nameChanged'),'#00e5ff');
          if(typeof fbSaveUserData==='function')fbSaveUserData();
        }
      });
      return true;
    }
    // Tap on input area - keep in edit mode (let keyboard handle input)
    return true;
  } else {
    // "変更" button
    if(tx>=s.px+s.pw-72&&tx<=s.px+s.pw-6&&ty>=s.nameY-14&&ty<=s.nameY+8){
      nameEditMode=true;nameEditBuf=playerName||'';
      sfx('click');
      // Show virtual keyboard by creating temporary input
      _showNameEditKeyboard();
      return true;
    }
  }
  // Tutorial replay button
  if(tx>=s.px+20&&tx<=s.px+s.pw-20&&ty>=s.tutBtnY&&ty<=s.tutBtnY+30){
    sfx('select');settingsOpen=false;resetConfirmStep=0;nameEditMode=false;logoutConfirm=false;startTutorial();return true;
  }
  // Data reset button - opens modal
  if(tx>=s.px+20&&tx<=s.px+s.pw-20&&ty>=s.resetBtnY&&ty<=s.resetBtnY+30){
    confirmModal={type:'reset',step:0};sfx('hurt');vibrate(20);return true;
  }
  // Account linking buttons (guest only)
  if(fbLoginMethod==='anonymous'&&ty>=s.linkY&&ty<=s.linkY+28){
    // Google link
    if(tx>=s.px+20&&tx<=s.px+20+s.linkBW){
      sfx('select');
      if(typeof fbLinkGoogle==='function'){
        fbLinkGoogle().then(()=>{
          addPop(W/2,H/2,t('googleLinkDone'),'#4285f4');sfx('item');vibrate(15);
        }).catch(e=>{
          console.warn('[Firebase] Link Google error:',e);
          if(e.code==='auth/credential-already-in-use'&&e.credential){
            // Credential belongs to existing user — sign in as that user & migrate data
            fbHandleCredentialInUse(e.credential,'google').then(data=>{
              if(data&&data.name){fbMergeCloudData(data);}
              fbSynced=true;fbSaveUserData();
              addPop(W/2,H/2,t('googleLinkDone'),'#4285f4');sfx('item');vibrate(15);
            }).catch(e2=>{
              console.warn('[Firebase] Switch error:',e2);
              addPop(W/2,H/2,t('linkFailed'),'#ff3860');sfx('hurt');vibrate(10);
            });
          } else if(e.code==='auth/credential-already-in-use'){
            addPop(W/2,H/2,t('linkFailedLogout'),'#ff3860');sfx('hurt');vibrate(10);
          } else {
            addPop(W/2,H/2,t('linkFailed'),'#ff3860');sfx('hurt');vibrate(10);
          }
        });
      }
      return true;
    }
    // Apple link
    if(tx>=s.px+20+s.linkBW+8&&tx<=s.px+20+s.linkBW+8+s.linkBW){
      sfx('select');
      if(typeof fbLinkApple==='function'){
        fbLinkApple().then(()=>{
          addPop(W/2,H/2,t('appleLinkDone'),'#aaa');sfx('item');vibrate(15);
        }).catch(e=>{
          console.warn('[Firebase] Link Apple error:',e);
          if(e.code==='auth/credential-already-in-use'&&e.credential){
            fbHandleCredentialInUse(e.credential,'apple').then(data=>{
              if(data&&data.name){fbMergeCloudData(data);}
              fbSynced=true;fbSaveUserData();
              addPop(W/2,H/2,t('appleLinkDone'),'#aaa');sfx('item');vibrate(15);
            }).catch(e2=>{
              console.warn('[Firebase] Switch error:',e2);
              addPop(W/2,H/2,t('linkFailed'),'#ff3860');sfx('hurt');vibrate(10);
            });
          } else if(e.code==='auth/credential-already-in-use'){
            addPop(W/2,H/2,t('linkFailedLogoutApple'),'#ff3860');sfx('hurt');vibrate(10);
          } else {
            addPop(W/2,H/2,t('linkFailed'),'#ff3860');sfx('hurt');vibrate(10);
          }
        });
      }
      return true;
    }
  }
  // Logout button - always show confirmation modal
  if(tx>=s.px+20&&tx<=s.px+s.pw-20&&ty>=s.logoutBtnY&&ty<=s.logoutBtnY+30){
    confirmModal={type:'logout',step:0};sfx('hurt');vibrate(15);
    return true;
  }
  // Delete Account button
  if(tx>=s.px+20&&tx<=s.px+s.pw-20&&ty>=s.deleteAccBtnY&&ty<=s.deleteAccBtnY+28){
    confirmModal={type:'deleteAccount',step:0};sfx('hurt');vibrate(20);
    return true;
  }
  // BGM slider
  if(ty>=s.barY1-10&&ty<=s.barY1+s.barH+10&&tx>=s.barX-10&&tx<=s.barX+s.barW+10){
    draggingSlider='bgm';updateSliderDrag(tx);return true;
  }
  // SFX slider
  if(ty>=s.barY2-10&&ty<=s.barY2+s.barH+10&&tx>=s.barX-10&&tx<=s.barX+s.barW+10){
    draggingSlider='sfx';updateSliderDrag(tx);return true;
  }
  // Tap anywhere else resets confirm states
  logoutConfirm=false;resetConfirmStep=0;
  return false;
}
// Virtual keyboard for name editing (mobile)
let _nameEditInput=null;
function _showNameEditKeyboard(){
  if(_nameEditInput)_nameEditInput.remove();
  const inp=document.createElement('input');
  inp.type='text';inp.maxLength=12;inp.value=nameEditBuf;
  inp.style.cssText='position:fixed;top:-100px;left:0;opacity:0;font-size:16px;';
  document.body.appendChild(inp);
  inp.focus();
  _nameEditInput=inp;
  inp.addEventListener('input',()=>{
    nameEditBuf=inp.value.replace(/[<>&"']/g,'').substring(0,12);
    inp.value=nameEditBuf;
  });
  inp.addEventListener('blur',()=>{
    setTimeout(()=>{if(_nameEditInput===inp){_nameEditInput.remove();_nameEditInput=null;}},100);
  });
}
function updateSliderDrag(tx){
  const s=settingsLayout();
  const v=Math.max(0,Math.min(1,(tx-s.barX)/s.barW));
  if(draggingSlider==='bgm')setBgmVol(v);
  else if(draggingSlider==='sfx')setSfxVol(v);
}

// Pause BGM management: save pre-pause BGM, switch to quiet pause BGM
let _pauseSavedBGM='';
function enterPause(){state=ST.PAUSE;_pauseSavedBGM=bgmCurrent;switchBGM('pause');}
function resumeFromPauseMenu(){state=ST.PLAY;if(_pauseSavedBGM){switchBGM(_pauseSavedBGM);_pauseSavedBGM='';}else{switchBGM('play');}}
// Auto-pause when page loses visibility or focus
// Stop BGM timers when hidden to prevent audio burst on return
let bgmBeforePause='';
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    if(state===ST.PLAY||state===ST.COUNTDOWN){
      if(!_pauseSavedBGM)_pauseSavedBGM=bgmCurrent; // save original BGM (not 'pause')
      state=ST.PAUSE;
    }
    // Stop BGM to prevent sound pile-up
    bgmBeforePause=_pauseSavedBGM||bgmCurrent;
    if(bgmTimer){clearTimeout(bgmTimer);bgmTimer=null;}
    if(typeof feverTimer!=='undefined'&&feverTimer){clearTimeout(feverTimer);feverTimer=null;}
    bgmCurrent=''; // allow restart
  } else {
    // Page visible again: reset game loop timing to prevent stutter
    lastTime=0;_tickAcc=0;_skipDraw=2;_recoveryFrames=5;
    // Resume AudioContext then restart BGM
    const _restoreBGM=()=>{
      if(bgmBeforePause){switchBGM(bgmBeforePause);bgmBeforePause='';}
      else if(audioCtx&&!bgmCurrent){
        // Restore BGM based on current game state
        if(state===ST.PLAY||state===ST.PAUSE){switchBGM(isChallengeMode?'challenge':'play');}
        else if(state===ST.TITLE||state===ST.LOGIN){switchBGM('title');}
      }
    };
    if(audioCtx&&audioCtx.state==='suspended'){
      audioCtx.resume().then(_restoreBGM).catch(()=>{});
    } else {
      _restoreBGM();
    }
  }
});
// Try auto-init audio on page load (works if browser allows or user previously interacted)
(function autoInitBGM(){
  try{
    initAudio();
    if(audioCtx&&audioCtx.state==='suspended'){
      // AudioContext suspended - add one-time listeners for earliest possible resume
      const resumeAudio=()=>{
        initAudio();
        document.removeEventListener('touchstart',resumeAudio,true);
        document.removeEventListener('mousedown',resumeAudio,true);
        document.removeEventListener('keydown',resumeAudio,true);
      };
      document.addEventListener('touchstart',resumeAudio,{capture:true,once:true});
      document.addEventListener('mousedown',resumeAudio,{capture:true,once:true});
      document.addEventListener('keydown',resumeAudio,{capture:true,once:true});
    }
  }catch(e){}
})();
window.addEventListener('blur',()=>{
  if(state===ST.PLAY){enterPause();}
});

// Restart from pause menu (works for both endless and stage mode)
function restartFromPause(){
  sfx('select');
  if(isChallengeMode){startChallenge();return;}
  if(isPackMode){
    const sid2=currentPackStage?currentPackStage.id:'';
    const hasCp2=checkpointReached||stageCheckpoints[sid2];
    resetPackStage(currentPackIdx,currentPackStageIdx,hasCp2);
    state=ST.COUNTDOWN;countdownT=COUNTDOWN_FRAMES;
    stopBGM(); // stop current BGM, force restart when countdown ends
    sfx('countdown');
  } else {
    bossRetry=null;isRetryGame=false;
    reset();
    state=ST.COUNTDOWN;countdownT=COUNTDOWN_FRAMES;
    stopBGM(); // force restart when countdown ends
    sfx('countdown');
  }
}

// Start challenge mode (boss rush)
function startChallenge(){
  gameMode='challenge';isChallengeMode=true;isPackMode=false;
  challengeKills=0;challengePhase=0;challengeRetired=false;challengeNextBossT=0;
  challBossQueue=generateChallBossQueue();challQueueIdx=0;
  challTransition={active:false,timer:0,waveNum:0};
  bossRetry=null;isRetryGame=false;
  reset();
  hp=maxHp(); // full HP
  state=ST.COUNTDOWN;countdownT=COUNTDOWN_FRAMES;
  titleTouchPos=null;
  sfx('countdown');
}
// Start countdown instead of immediately playing
function startCountdown(mode){
  gameMode=mode;isPackMode=false;isChallengeMode=false;
  const retry=bossRetry;
  reset();
  if(retry){
    // Boss retry: start at saved score, boss triggers immediately
    isRetryGame=true;
    bossRetry=null;
    score=retry.score;dist=retry.score;rawDist=retry.rawDist;
    bossPhase.bossCount=retry.bossCount;
    bossPhase.nextAt=rawDist; // will trigger boss on first play frame
    bossPhase.lastBossScore=score;
    lastMile=Math.floor(score/1000)*1000;
    // Set correct theme for this score
    const ti=Math.min(Math.floor(score/1000),THEMES.length-1);
    if(ti!==curTheme){prevTheme=curTheme;curTheme=ti;themeLerp=1;}
  } else {
    isRetryGame=false;
  }
  state=ST.COUNTDOWN;countdownT=COUNTDOWN_FRAMES; // 3 seconds at 60fps
  titleTouchPos=null; // clear stale touch pos
  sfx('countdown');
}


// Shared inventory modal close/tap logic (touchstart and mousedown both use this)
// Returns true if the event was fully handled, false if not in inventory modal.
function handleInventoryModalTouch(px, py){
  if(!inventoryOpen) return false;
  const mW2=Math.min(300,W-24),mH2=Math.min(360,H-40);
  const mX2=(W-mW2)/2,mY2=(H-mH2)/2;
  const invClY=mY2+mH2-38;
  if(px>=W/2-50&&px<=W/2+50&&py>=invClY&&py<=invClY+30&&chestOpen.phase==='none'){
    inventoryOpen=false;sfx('cancel');return true;
  }
  if((px<mX2||px>mX2+mW2||py<mY2||py>mY2+mH2)&&chestOpen.phase==='none'){
    inventoryOpen=false;sfx('cancel');return true;
  }
  handleInventoryChestTap(px,py);
  return true;
}
canvas.addEventListener('touchstart',e=>{
  e.preventDefault();initAudio();
  const t=e.touches[0];
  const p=canvasXY(t.clientX,t.clientY);
  touchStartY=t.clientY;touchStartX=t.clientX;touchOriginY=t.clientY;touchStartT=Date.now();touchMoved=false;touchBtnUsed=false;
  // Update info modal intercepts all input when open
  if(updateInfoOpen){handleUpdateInfoTouch(p.x,p.y);return;}
  // Help overlay intercepts all input when open
  if(helpOpen){handleHelpTouch(p.x,p.y);return;}
  // Ranking modal intercepts all input when open
  if(rankingOpen){handleRankingTouch(p.x,p.y);return;}
  // Settings panel intercepts all input when open
  if(settingsOpen){handleSettingsTouch(p.x,p.y);return;}
  if(state===ST.COUNTDOWN)return; // block input during countdown
  // Login screen
  if(state===ST.LOGIN){handleLoginTouch(p.x,p.y);return;}
  // Tutorial
  if(state===ST.TUTORIAL){handleTutorialTouch(p.x,p.y);return;}
  // Settings gear button on title screen (delay for dev mode combo)
  if(state===ST.TITLE&&!charModal.show&&hitSettingsGear(p.x,p.y)){sfx('click');settingsOpen=true;return;}
  if(state===ST.TITLE&&!charModal.show&&hitHelpBtn(p.x,p.y)){sfx('select');helpOpen=true;return;}
  if(state===ST.STAGE_SEL){stageSelTouchY=t.clientY;stageSelDragging=false;return;}
  if(state===ST.STAGE_CLEAR&&stageClearT>60){
    sfx('click');state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;switchBGM('title');return;
  }
  if(state===ST.PAUSE){
    if(hitResumeBtn(p.x,p.y)){sfx('select');resumeFromPauseMenu();return;}
    if(hitRestartBtn(p.x,p.y)){_pauseSavedBGM='';restartFromPause();return;}
    if(hitPauseStageSelBtn(p.x,p.y)){sfx('cancel');_pauseSavedBGM='';state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;stageSelGuardT=30;switchBGM('title');return;}
    if(hitQuitBtn(p.x,p.y)){_pauseSavedBGM='';if(isChallengeMode){challengeRetired=true;sfx('cancel');player.alive=false;state=ST.DEAD;deadT=0;switchBGM('dead');return;}sfx('cancel');if(bossPhase.active&&!isRetryGame){bossRetry={score:bossPhase.lastBossScore,bossCount:bossPhase.bossCount-1,rawDist:bossPhase.lastBossRawDist||0};}state=ST.TITLE;isPackMode=false;switchBGM('title');return;}
    return;
  }
  if(state===ST.PLAY&&!isPackMode&&hitInvBtn(p.x,p.y)){useInvincible();touchBtnUsed=true;return;}
  if(state===ST.PLAY&&!isPackMode&&hitBombBtn(p.x,p.y)){useBomb();touchBtnUsed=true;return;}
  if(state===ST.PLAY&&hitPauseBtn(p.x,p.y)){sfx('pause');enterPause();touchBtnUsed=true;return;}
  if(state===ST.TITLE){
    // Shop modal intercepts all input when open
    if(shopOpen){handleShopTouch(p.x,p.y);titleTouchPos=null;return;}
    // Cosmetic menu intercepts all input when open
    if(cosmeticMenuOpen){handleCosmeticTouch(p.x,p.y);titleTouchPos=null;return;}
    // Inventory modal intercepts all input when open
    if(inventoryOpen){if(handleInventoryModalTouch(p.x,p.y)){titleTouchPos=null;return;}return;}
    if(charModal.show){sfx('cancel');charModal.show=false;titleTouchPos=null;return;}
    longPressFired=false;titleTouchPos=p;
    const cidx=getCharGridIdx(p.x,p.y);
    if(cidx>=0&&isCharUnlocked(cidx)){
      longPressTimer=setTimeout(()=>{longPressFired=true;charModal={show:true,idx:cidx,animT:0};vibrate(15);sfxCharVoice(cidx);},400);
    } else if(cidx<0){
      handleTitleTouch(p.x,p.y);
      titleTouchPos=null; // prevent touchend from re-calling handleTitleTouch
    }
  }
  else if(state===ST.DEAD&&deadChestOpen){
    handleInventoryChestTap(p.x,p.y);
  }
  else if(state===ST.DEAD&&deadT>45){
    if(hitDeadChestBtn(p.x,p.y)){deadChestOpen=true;deadChestsOpened=0;chestBatchMode=false;startInventoryChestOpen();sfx('select');return;}
    const btnId=hitDeadBtn(p.x,p.y);
    if(btnId){handleDeadBtn(btnId);touchBtnUsed=true;return;}
  }
},{passive:false});

canvas.addEventListener('touchmove',e=>{
  e.preventDefault();
  const t=e.touches[0];
  // Ranking scroll
  if(rankingOpen){
    const dy2=t.clientY-touchStartY;
    touchStartY=t.clientY;
    const rowH=36;
    const topPad=safeTop+8;
    const mH=H-topPad-10,hdrH=76,listH=mH-hdrH-50;
    const totalH=RANKING_DATA.length*rowH;
    const maxScroll=Math.max(0,totalH-listH);
    rankingScrollTarget=Math.max(0,Math.min(maxScroll,rankingScrollTarget-dy2*2.5));
    return;
  }
  // Settings slider drag
  if(settingsOpen&&draggingSlider){const mp=canvasXY(t.clientX,t.clientY);updateSliderDrag(mp.x);return;}
  // Shop scroll
  if(shopOpen){
    const dy2=t.clientY-touchStartY;touchStartY=t.clientY;
    const items=shopSorted(shopTab===0?SHOP_ITEMS.skins:shopTab===1?SHOP_ITEMS.eyes:SHOP_ITEMS.effects);
    const mH2=Math.min(500,H-30),listH2=mH2-140,totalH2=items.length*54;
    const maxS=Math.max(0,totalH2-listH2);
    shopScroll=Math.max(0,Math.min(maxS,shopScroll-dy2*2));
    if(Math.abs(t.clientY-touchOriginY)>18)touchMoved=true;
    return;
  }
  // Cosmetic scroll
  if(cosmeticMenuOpen){
    const dy2=t.clientY-touchStartY;touchStartY=t.clientY;
    const allItems=cosmeticTab===0?SHOP_ITEMS.skins:cosmeticTab===1?SHOP_ITEMS.eyes:SHOP_ITEMS.effects;
    const ownedList=[{id:''}].concat(shopSorted(allItems.filter(it=>ownsItem(it.id)),true));
    const mH2=Math.min(500,H-30),listH2=mH2-184,totalH2=ownedList.length*48;
    const maxS=Math.max(0,totalH2-listH2);
    cosmeticScroll=Math.max(0,Math.min(maxS,cosmeticScroll-dy2*2));
    if(Math.abs(t.clientY-touchOriginY)>18)touchMoved=true;
    return;
  }
  const dy=t.clientY-touchStartY;
  const dx=t.clientX-touchStartX;
  if(Math.abs(dy)>20||Math.abs(dx)>20){touchMoved=true;if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null;}}
  // Stage selection scroll
  if(state===ST.STAGE_SEL){
    const scrollDy=t.clientY-stageSelTouchY;
    if(Math.abs(scrollDy)>5){stageSelDragging=true;stageSelScroll+=scrollDy;stageSelTouchY=t.clientY;
    const viewH=H-70-safeTop-safeBot;
    const totalH=STAGE_PACKS.length*(130+14);
    const minScroll=totalH>viewH?-(totalH-viewH):0;
    stageSelScroll=Math.max(minScroll,Math.min(0,stageSelScroll));}
  }
},{passive:false});

canvas.addEventListener('touchend',e=>{
  e.preventDefault();
  if(draggingSlider){
    if(draggingSlider==='sfx')sfx('coin'); // preview SE at new volume
    draggingSlider=null;return;
  }
  if(updateInfoOpen||helpOpen||settingsOpen||rankingOpen||inventoryOpen)return;
  // Stage selection: handle tap only if user didn't drag
  if(state===ST.STAGE_SEL){
    if(!stageSelDragging){const ct3=e.changedTouches[0];const cp2=canvasXY(ct3.clientX,ct3.clientY);handleStageSelTouch(cp2.x,cp2.y);}
    stageSelDragging=false;return;
  }
  // Shop/cosmetic: confirm pending item taps if user didn't scroll
  if(shopOpen){
    if(!touchMoved&&shopPendingTap){confirmShopTap();}
    else{shopPendingTap=null;}
    return;
  }
  if(cosmeticMenuOpen){
    if(!touchMoved&&cosmeticPendingTap){confirmCosmeticTap();}
    else{cosmeticPendingTap=null;}
    return;
  }
  if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null;}
  if(state===ST.TITLE&&!longPressFired&&titleTouchPos){handleTitleTouch(titleTouchPos.x,titleTouchPos.y);titleTouchPos=null;return;}
  // Tutorial swipe & tap
  if(state===ST.TUTORIAL){
    if((tutPhase!=='wait'&&tutPhase!=='action')||tutStep>=TUT_CHECKPOINTS.length){return;}
    if(tutPhase==='action')return; // block input during action animation
    const cp=TUT_CHECKPOINTS[tutStep];
    const tt=e.changedTouches[0];const tdy=tt.clientY-touchStartY;
    if(touchMoved&&Math.abs(tdy)>30){
      // Swipe in tutorial
      if(cp.type==='flip_up'&&tdy<0&&player.gDir===1){
        player.gDir=-1;player.vy=-8;sfx('flip');vibrate('flip');
        player.face='flip';setTimeout(()=>{if(player.alive)player.face='normal';},250);
        emitParts(player.x,player.y,10,tc('ply'),3,2.5);player.rotTarget-=Math.PI;
        tutDone=true;tutPhase='action';
        setTimeout(()=>{tutPhase='success';tutSuccessT=0;setTimeout(tutAdvance,600);},700);
      } else if(cp.type==='flip_down'&&tdy>0&&player.gDir===-1){
        player.gDir=1;player.vy=8;sfx('flip');vibrate('flip');
        player.face='flip';setTimeout(()=>{if(player.alive)player.face='normal';},250);
        emitParts(player.x,player.y,10,tc('ply'),3,2.5);player.rotTarget+=Math.PI;
        tutDone=true;tutPhase='action';
        setTimeout(()=>{tutPhase='success';tutSuccessT=0;setTimeout(tutAdvance,600);},700);
      } else if(cp.type==='double_flip'){
        if(tdy<0&&player.gDir===1&&tutFlipCount===0){
          // First flip: up → freeze mid-air after 280ms (higher on screen)
          player.gDir=-1;player.vy=-7;sfx('flip');vibrate('flip');player.grounded=false;
          emitParts(player.x,player.y,10,tc('ply'),3,2.5);player.rotTarget-=Math.PI;
          tutFlipCount=1;tutPhase='action';
          setTimeout(()=>{if(tutFlipCount===1){player.vy=0;tutFreezePlayer=true;tutPhase='wait';tutStepT=0;}},280);
        } else if(tdy>0&&player.gDir===-1&&tutFlipCount>=1){
          // Second flip: down → success
          player.gDir=1;player.vy=5;sfx('flip');vibrate('flip');player.grounded=false;
          emitParts(player.x,player.y,10,tc('ply'),3,2.5);player.rotTarget+=Math.PI;
          tutFreezePlayer=false;tutFlipCount=2;
          tutDone=true;tutPhase='success';tutSuccessT=0;setTimeout(tutAdvance,800);
        }
      }
    }
    return;
  }
  if(state!==ST.PLAY||state===ST.PAUSE)return;
  if(touchBtnUsed)return; // button was pressed in touchstart, don't also jump
  const dt=Date.now()-touchStartT;
  const t=e.changedTouches[0];
  const dy=t.clientY-touchStartY;

  if(touchMoved&&Math.abs(dy)>20&&!player._quakeStunned){
    // Swipe: flip gravity to the swiped direction (only if canFlip)
    if(player.canFlip&&dy>0&&player.gDir===-1){
      player.gDir=1;player.vy=2;totalFlips++;flipCount++;flipTimer=0;
      player.canFlip=flipCount<ct().maxFlip;
      sfx('flip');vibrate('flip');
      player.face='flip';setTimeout(()=>{if(player.alive)player.face='normal';},250);
      emitParts(player.x,player.y,10,tc('ply'),3,2.5);
      player.rotTarget+=Math.PI;
    } else if(player.canFlip&&dy<0&&player.gDir===1){
      player.gDir=-1;player.vy=-2;totalFlips++;flipCount++;flipTimer=0;
      player.canFlip=flipCount<ct().maxFlip;
      sfx('flip');vibrate('flip');
      player.face='flip';setTimeout(()=>{if(player.alive)player.face='normal';},250);
      emitParts(player.x,player.y,10,tc('ply'),3,2.5);
      player.rotTarget-=Math.PI;
    } else if(player.grounded&&player._onFloatPlat){
      // Drop through floating platform: swipe same direction as gravity
      if((dy>0&&player.gDir===1)||(dy<0&&player.gDir===-1)){
        player.grounded=false;
        player.vy=player.gDir*3;
        player._dropThrough=15; // ignore float plat landing+wall while passing through
        sfx('jump');vibrate('jump');
      }
    }
  } else if(!touchMoved||dt<200){
    // Tap: jump from current surface
    if(player.grounded){
      const jp=JUMP_POWER*ct().jumpMul;
      player.vy=-jp*player.gDir;
      player.grounded=false;
      djumpUsed=false;
      sfx('jump');vibrate('jump');
      player.face='flip';setTimeout(()=>{if(player.alive)player.face='normal';},180);
      emitParts(player.x,player.y+PLAYER_R*player.gDir,6,tc('ply'),2.5,2);
    } else if(djumpAvailable&&!djumpUsed){
      djumpUsed=true;djumpAvailable=false;
      const jp=JUMP_POWER*ct().jumpMul*0.85;
      player.vy=-jp*player.gDir;
      sfx('jump');vibrate('jump');
      player.face='flip';setTimeout(()=>{if(player.alive)player.face='normal';},180);
      emitParts(player.x,player.y,8,'#ffaa00',3,2.5);
    }
  }
},{passive:false});

// Keyboard / Mouse support
// Prevent right-click context menu on canvas
canvas.addEventListener('contextmenu',e=>{e.preventDefault();});
canvas.addEventListener('mousedown',e=>{
  initAudio();
  // Right click: use bomb during gameplay
  if(e.button===2){
    e.preventDefault();
    if(state===ST.PLAY){useBomb();}
    return;
  }
  const p=canvasXY(e.clientX,e.clientY);
  if(updateInfoOpen){handleUpdateInfoTouch(p.x,p.y);return;}
  if(helpOpen){handleHelpTouch(p.x,p.y);return;}
  if(rankingOpen){handleRankingTouch(p.x,p.y);return;}
  if(settingsOpen){handleSettingsTouch(p.x,p.y);return;}
  if(state===ST.COUNTDOWN)return;
  if(state===ST.LOGIN){handleLoginTouch(p.x,p.y);return;}
  if(state===ST.TUTORIAL){handleTutorialTouch(p.x,p.y);return;}
  if(state===ST.TITLE&&!charModal.show&&hitSettingsGear(p.x,p.y)){sfx('click');settingsOpen=true;return;}
  if(state===ST.TITLE&&!charModal.show&&hitHelpBtn(p.x,p.y)){sfx('select');helpOpen=true;return;}
  if(state===ST.STAGE_SEL){handleStageSelTouch(p.x,p.y);return;}
  if(state===ST.STAGE_CLEAR&&stageClearT>60){
    sfx('click');state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;switchBGM('title');return;
  }
  if(state===ST.PAUSE){
    if(hitResumeBtn(p.x,p.y)){sfx('select');resumeFromPauseMenu();return;}
    if(hitRestartBtn(p.x,p.y)){_pauseSavedBGM='';restartFromPause();return;}
    if(hitPauseStageSelBtn(p.x,p.y)){sfx('cancel');_pauseSavedBGM='';state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;stageSelGuardT=30;switchBGM('title');return;}
    if(hitQuitBtn(p.x,p.y)){_pauseSavedBGM='';if(isChallengeMode){challengeRetired=true;sfx('cancel');player.alive=false;state=ST.DEAD;deadT=0;switchBGM('dead');return;}sfx('cancel');if(bossPhase.active&&!isRetryGame){bossRetry={score:bossPhase.lastBossScore,bossCount:bossPhase.bossCount-1,rawDist:bossPhase.lastBossRawDist||0};}state=ST.TITLE;isPackMode=false;switchBGM('title');return;}
    return;
  }
  if(state===ST.PLAY&&!isPackMode&&hitInvBtn(p.x,p.y)){useInvincible();return;}
  if(state===ST.PLAY&&!isPackMode&&hitBombBtn(p.x,p.y)){useBomb();return;}
  if(state===ST.PLAY&&hitPauseBtn(p.x,p.y)){sfx('pause');enterPause();return;}
  if(state===ST.TITLE){
    if(shopOpen){handleShopTouch(p.x,p.y);return;}
    if(cosmeticMenuOpen){handleCosmeticTouch(p.x,p.y);return;}
    if(inventoryOpen){handleInventoryModalTouch(p.x,p.y);return;}
    if(charModal.show){sfx('cancel');charModal.show=false;return;}
    // Long-press detection for character grid (same as touch)
    longPressFired=false;titleTouchPos=p;
    const cidx=getCharGridIdx(p.x,p.y);
    if(cidx>=0&&isCharUnlocked(cidx)){
      longPressTimer=setTimeout(()=>{longPressFired=true;charModal={show:true,idx:cidx,animT:0};sfxCharVoice(cidx);},400);
    } else if(cidx<0){
      handleTitleTouch(p.x,p.y);titleTouchPos=null;
    }
  }
  else if(state===ST.DEAD&&deadChestOpen){
    handleInventoryChestTap(p.x,p.y);
  }
  else if(state===ST.DEAD&&deadT>45){
    if(hitDeadChestBtn(p.x,p.y)){deadChestOpen=true;deadChestsOpened=0;chestBatchMode=false;startInventoryChestOpen();sfx('select');return;}
    const btnId=hitDeadBtn(p.x,p.y);
    if(btnId)handleDeadBtn(btnId);
  }
  // Left click during gameplay: gravity flip (toggle)
  else if(state===ST.PLAY&&player.canFlip&&!player._quakeStunned){
    flipCount++;flipTimer=0;
    if(player.gDir===1){player.gDir=-1;player.vy=-2;totalFlips++;player.canFlip=flipCount<ct().maxFlip;sfx('flip');vibrate('flip');player.rotTarget-=Math.PI;emitParts(player.x,player.y,10,tc('ply'),3,2.5);}
    else{player.gDir=1;player.vy=2;totalFlips++;player.canFlip=flipCount<ct().maxFlip;sfx('flip');vibrate('flip');player.rotTarget+=Math.PI;emitParts(player.x,player.y,10,tc('ply'),3,2.5);}
  }
});
canvas.addEventListener('mousemove',e=>{
  const p=canvasXY(e.clientX,e.clientY);
  if(draggingSlider){updateSliderDrag(p.x);}
  if(longPressTimer&&titleTouchPos&&(Math.abs(p.x-titleTouchPos.x)>20||Math.abs(p.y-titleTouchPos.y)>20)){clearTimeout(longPressTimer);longPressTimer=null;}
});
canvas.addEventListener('mouseup',()=>{
  if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null;}
  if(state===ST.TITLE&&!longPressFired&&titleTouchPos){handleTitleTouch(titleTouchPos.x,titleTouchPos.y);titleTouchPos=null;}
  longPressFired=false;
  if(shopOpen&&shopPendingTap){confirmShopTap();}
  else if(cosmeticMenuOpen&&cosmeticPendingTap){confirmCosmeticTap();}
  if(draggingSlider==='sfx')sfx('coin');
  draggingSlider=null;
});
document.addEventListener('keydown',e=>{
  if(updateInfoOpen){if(e.code==='Escape'){localStorage.setItem('gd5updateDismissed',UPDATE_VER);updateInfoOpen=false;updateInfoPage=0;sfx('cancel');}if(e.code==='ArrowLeft'&&updateInfoPage>0){updateInfoPage--;sfx('click');}if(e.code==='ArrowRight'&&updateInfoPage<UPDATE_HISTORY.length-1){updateInfoPage++;sfx('click');}e.preventDefault();return;}
  if(helpOpen){if(e.code==='Escape'){helpOpen=false;sfx('cancel');}e.preventDefault();return;}
  if(rankingOpen){if(e.code==='Escape'){rankingOpen=false;sfx('cancel');}e.preventDefault();return;}
  if(settingsOpen){if(e.code==='Escape'){if(confirmModal){confirmModal=null;sfx('cancel');}else if(nameEditMode){nameEditMode=false;}else{settingsOpen=false;logoutConfirm=false;resetConfirmStep=0;}sfx('cancel');e.preventDefault();}if(!nameEditMode){e.preventDefault();}return;}
  if(e.code==='Escape'){
    e.preventDefault();
    if(state===ST.STAGE_SEL){sfx('cancel');titleTouchPos=null;state=ST.TITLE;isPackMode=false;switchBGM('title');return;}
    if(state===ST.PLAY){sfx('pause');enterPause();return;}
    if(state===ST.PAUSE){sfx('select');resumeFromPauseMenu();return;}
  }
  if(e.code==='KeyR'&&state===ST.PAUSE){e.preventDefault();_pauseSavedBGM='';restartFromPause();return;}
  if(state===ST.LOGIN)return; // login handled by HTML overlay
  // Tutorial keyboard
  if(state===ST.TUTORIAL){
    e.preventDefault();initAudio();
    if(e.code==='Escape'){tutorialDone=true;localStorage.setItem('gd5tutorialDone','1');state=ST.TITLE;switchBGM('title');tutWarpPhase='';return;}
    // Welcome screen: any key to start warp
    if(tutWarpPhase==='welcome'&&tutWarpT>30&&(e.code==='Space'||e.code==='Enter')){
      sfx('select');vibrate([15,10,30]);tutWarpPhase='warp';tutWarpT=0;return;
    }
    if(tutWarpPhase==='warp')return;
    if(tutPhase==='action')return;
    if(tutPhase!=='wait'||tutStep>=TUT_CHECKPOINTS.length)return;
    const cp=TUT_CHECKPOINTS[tutStep];
    if(cp.type==='jump'&&e.code==='Space'&&player.grounded){
      player.vy=player.gDir===1?-JUMP_POWER:JUMP_POWER;player.grounded=false;sfx('jump');
      tutDone=true;tutPhase='action';
      setTimeout(()=>{tutPhase='success';tutSuccessT=0;setTimeout(tutAdvance,600);},500);return;
    }
    if(cp.type==='flip_up'&&e.code==='ArrowUp'&&player.gDir===1){
      player.gDir=-1;player.vy=-8;sfx('flip');vibrate('flip');player.rotTarget-=Math.PI;
      emitParts(player.x,player.y,10,tc('ply'),3,2.5);
      tutDone=true;tutPhase='action';
      setTimeout(()=>{tutPhase='success';tutSuccessT=0;setTimeout(tutAdvance,600);},700);return;
    }
    if(cp.type==='flip_down'&&e.code==='ArrowDown'&&player.gDir===-1){
      player.gDir=1;player.vy=8;sfx('flip');vibrate('flip');player.rotTarget+=Math.PI;
      emitParts(player.x,player.y,10,tc('ply'),3,2.5);
      tutDone=true;tutPhase='action';
      setTimeout(()=>{tutPhase='success';tutSuccessT=0;setTimeout(tutAdvance,600);},700);return;
    }
    if(cp.type==='double_flip'){
      if(e.code==='ArrowUp'&&player.gDir===1&&tutFlipCount===0){
        player.gDir=-1;player.vy=-7;sfx('flip');player.grounded=false;player.rotTarget-=Math.PI;
        emitParts(player.x,player.y,10,tc('ply'),3,2.5);
        tutFlipCount=1;tutPhase='action';
        setTimeout(()=>{if(tutFlipCount===1){player.vy=0;tutFreezePlayer=true;tutPhase='wait';tutStepT=0;}},280);
      } else if(e.code==='ArrowDown'&&player.gDir===-1&&tutFlipCount>=1){
        player.gDir=1;player.vy=5;sfx('flip');player.grounded=false;player.rotTarget+=Math.PI;
        emitParts(player.x,player.y,10,tc('ply'),3,2.5);
        tutFreezePlayer=false;tutFlipCount=2;
        tutDone=true;tutPhase='success';tutSuccessT=0;setTimeout(tutAdvance,800);
      }
      return;
    }
    if(cp.type==='bomb'&&(e.code==='KeyB'||e.code==='KeyX')&&bombCount>0){
      useBomb();tutDone=true;tutPhase='success';tutSuccessT=0;setTimeout(tutAdvance,800);return;
    }
    return;
  }
  if(e.code==='Space'){
    e.preventDefault();initAudio();
    if(state===ST.COUNTDOWN)return;
    if(state===ST.STAGE_SEL)return;
    if(state===ST.STAGE_CLEAR&&stageClearT>60){
      sfx('click');state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;switchBGM('title');return;
    }
    if(state===ST.PAUSE){sfx('select');resumeFromPauseMenu();return;}
    if(state===ST.TITLE){startCountdown('endless');}
    else if(state===ST.DEAD&&deadT>45){handleDeadBtn('restart');}
    else if(state===ST.PLAY&&player.grounded&&!player._quakeStunned){
      const jp=JUMP_POWER*ct().jumpMul;
      player.vy=-jp*player.gDir;player.grounded=false;djumpUsed=false;
      sfx('jump');vibrate('jump');
      emitParts(player.x,player.y+PLAYER_R*player.gDir,6,tc('ply'),2.5,2);
    }
    else if(state===ST.PLAY&&djumpAvailable&&!djumpUsed&&!player._quakeStunned){
      djumpUsed=true;djumpAvailable=false;
      const jp=JUMP_POWER*ct().jumpMul*0.85;
      player.vy=-jp*player.gDir;
      sfx('jump');vibrate('jump');
      emitParts(player.x,player.y,8,'#ffaa00',3,2.5);
    }
  }
  // ArrowUp: gravity flip to ceiling (gDir 1→-1)
  if(e.code==='ArrowUp'){
    e.preventDefault();
    if(state===ST.PLAY&&player.canFlip&&!player._quakeStunned&&player.gDir===1){
      flipCount++;flipTimer=0;
      player.gDir=-1;player.vy=-2;totalFlips++;player.canFlip=flipCount<ct().maxFlip;sfx('flip');vibrate('flip');player.rotTarget-=Math.PI;emitParts(player.x,player.y,10,tc('ply'),3,2.5);
    } else if(state===ST.PLAY&&player.grounded&&player._onFloatPlat&&player.gDir===-1){
      player.grounded=false;player.vy=player.gDir*3;player._dropThrough=15;sfx('jump');vibrate('jump');
    }
  }
  // ArrowDown: gravity flip to floor (gDir -1→1) OR drop through floatPlat (gDir 1)
  if(e.code==='ArrowDown'){
    e.preventDefault();
    if(state===ST.PLAY&&player.canFlip&&!player._quakeStunned&&player.gDir===-1){
      flipCount++;flipTimer=0;
      player.gDir=1;player.vy=2;totalFlips++;player.canFlip=flipCount<ct().maxFlip;sfx('flip');vibrate('flip');player.rotTarget+=Math.PI;emitParts(player.x,player.y,10,tc('ply'),3,2.5);
    } else if(state===ST.PLAY&&player.grounded&&player._onFloatPlat&&player.gDir===1){
      player.grounded=false;player.vy=player.gDir*3;player._dropThrough=15;sfx('jump');vibrate('jump');
    }
  }
  if((e.code==='KeyB'||e.code==='KeyX')&&state===ST.PLAY){e.preventDefault();useBomb();}
  if((e.code==='KeyV'||e.code==='KeyZ')&&state===ST.PLAY){e.preventDefault();useInvincible();}
});

function getCharGridIdx(tx,ty){
  const cols=3,rows=2,charW=58,charH=62,charGap=10;
  const gridW=cols*(charW+charGap)-charGap;
  const gridX=W/2-gridW/2,gridY=H*0.44;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const idx=r*cols+c;if(idx>=CHARS.length)return -1;
      const cx=gridX+c*(charW+charGap),cy=gridY+r*(charH+charGap);
      if(tx>=cx-5&&tx<=cx+charW+5&&ty>=cy-5&&ty<=cy+charH+5)return idx;
    }
  }
  return -1;
}
function handleTitleTouch(tx,ty){
  // Ranking button (top-left, row 1)
  if(tx>=8&&tx<=44&&ty>=safeTop+6&&ty<=safeTop+42){
    rebuildRankingData();rebuildChallengeRankingData();if(typeof fbRefreshRankings==='function')fbRefreshRankings();rankingOpen=true;rankingTab='endless';rankingScroll=0;rankingScrollTarget=0;notifNewHighScore=false;localStorage.removeItem('gd5notifHi');sfx('select');return;
  }
  // Inventory button (top-left, row 2)
  if(tx>=8&&tx<=44&&ty>=safeTop+44&&ty<=safeTop+80){
    inventoryOpen=true;chestOpen={phase:'none',t:0,charIdx:-1,parts:[],reward:null};
    sfx('select');return;
  }
  // Shop button (top-left, row 3)
  if(tx>=8&&tx<=44&&ty>=safeTop+82&&ty<=safeTop+118){
    shopOpen=true;shopTab=0;shopScroll=0;
    sfx('select');return;
  }
  // Cosmetic button (top-left, row 4)
  if(tx>=8&&tx<=44&&ty>=safeTop+120&&ty<=safeTop+156){
    cosmeticMenuOpen=true;cosmeticTab=0;cosmeticScroll=0;notifNewCosmetic=false;localStorage.removeItem('gd5notifCosm');
    sfx('select');return;
  }
  // Character selection: 2 rows x 3 columns grid
  const cols=3,rows=2;
  const charW=58,charH=62,charGap=10;
  const gridW=cols*(charW+charGap)-charGap;
  const gridX=W/2-gridW/2;
  const gridY=H*0.44;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const idx=r*cols+c;if(idx>=CHARS.length)break;
      const cx=gridX+c*(charW+charGap);
      const cy=gridY+r*(charH+charGap);
      if(tx>=cx-5&&tx<=cx+charW+5&&ty>=cy-5&&ty<=cy+charH+5){
        if(isCharUnlocked(idx)){
          selChar=idx;localStorage.setItem('gd5char',selChar.toString());
          // Clear new character notification for this character
          const nci=notifNewChars.indexOf(idx);if(nci!==-1){notifNewChars.splice(nci,1);localStorage.setItem('gd5notifChars',JSON.stringify(notifNewChars));}
          sfxCharVoice(idx);vibrate(10);
        } else {
          // Locked: show hint to get from chest
          sfx('hurt');vibrate(15);
          addPop(cx+charW/2,cy,t('popFromChest'),'#ffd700');
        }
        return;
      }
    }
  }
  // Mode selection buttons (2+1 layout: Endless/Stage row, Challenge below)
  const btnW=W*0.35,btnH=38,btnGap=12;
  const totalBtnW=btnW*2+btnGap;
  const btnStartX=W/2-totalBtnW/2;
  const btnY=H*0.80;
  const ebx=btnStartX;
  const sbx=btnStartX+btnW+btnGap;
  // Endless mode button -> start countdown
  if(tx>=ebx&&tx<=ebx+btnW&&ty>=btnY&&ty<=btnY+btnH){
    startCountdown('endless');return;
  }
  // Stage mode button (disabled)
  // if(tx>=sbx&&tx<=sbx+btnW&&ty>=btnY&&ty<=btnY+btnH){
  //   sfx('select');vibrate(30);state=ST.STAGE_SEL;stageSelScroll=0;stageSelTarget=0;return;
  // }
  // Challenge mode button
  const cbtnW=W*0.45,cbtnH=34;
  const cbx2=W/2-cbtnW/2,cbtnY2=btnY+btnH+6;
  if(tx>=cbx2&&tx<=cbx2+cbtnW&&ty>=cbtnY2&&ty<=cbtnY2+cbtnH){
    sfx('select');vibrate(30);startChallenge();return;
  }
}
function handleRankingTouch(tx,ty){
  const mW=Math.min(340,W-16),topPad=safeTop+8;
  const mH=H-topPad-10;
  const mX=(W-mW)/2,mY=topPad;
  // Tab buttons
  const tabY=mY+34,tabH=24,tabW=Math.floor((mW-24)/2);
  const tabLX=mX+8,tabRX=mX+8+tabW+8;
  if(ty>=tabY&&ty<=tabY+tabH){
    if(tx>=tabLX&&tx<=tabLX+tabW){rankingTab='endless';rankingScroll=0;rankingScrollTarget=0;sfx('click');return;}
    if(tx>=tabRX&&tx<=tabRX+tabW){rankingTab='challenge';rankingScroll=0;rankingScrollTarget=0;sfx('click');return;}
  }
  // Footer close button
  const ftY=mY+mH-40;
  if(tx>=W/2-50&&tx<=W/2+50&&ty>=ftY&&ty<=ftY+30){
    rankingOpen=false;sfx('cancel');return;
  }
  // Tap outside modal
  if(tx<mX||tx>mX+mW||ty<mY||ty>mY+mH){
    rankingOpen=false;sfx('cancel');return;
  }
}
// Mouse wheel for ranking scroll & shop/cosmetic scroll
canvas.addEventListener('wheel',e=>{
  if(rankingOpen){
    e.preventDefault();
    const rowH=36;
    const topPad=safeTop+8,mH=H-topPad-10,hdrH=76,listH=mH-hdrH-50;
    const totalH=RANKING_DATA.length*rowH;
    const maxScroll=Math.max(0,totalH-listH);
    rankingScrollTarget=Math.max(0,Math.min(maxScroll,rankingScrollTarget+e.deltaY*1.5));
  }
  if(shopOpen){
    e.preventDefault();
    const items=shopSorted(shopTab===0?SHOP_ITEMS.skins:shopTab===1?SHOP_ITEMS.eyes:SHOP_ITEMS.effects);
    const mH2=Math.min(500,H-30),listH2=mH2-140,totalH2=items.length*54;
    const maxS=Math.max(0,totalH2-listH2);
    shopScroll=Math.max(0,Math.min(maxS,shopScroll+e.deltaY*1.5));
  }
  if(cosmeticMenuOpen){
    e.preventDefault();
    const allItems=cosmeticTab===0?SHOP_ITEMS.skins:cosmeticTab===1?SHOP_ITEMS.eyes:SHOP_ITEMS.effects;
    const ownedList=[{id:''}].concat(shopSorted(allItems.filter(it=>ownsItem(it.id)),true));
    const mH2=Math.min(500,H-30),listH2=mH2-184,totalH2=ownedList.length*48;
    const maxS=Math.max(0,totalH2-listH2);
    cosmeticScroll=Math.max(0,Math.min(maxS,cosmeticScroll+e.deltaY*1.5));
  }
  if(state===ST.STAGE_SEL){
    e.preventDefault();
    const viewH2=H-70-safeTop-safeBot;
    const totalH2=STAGE_PACKS.length*(130+14);
    const minScroll2=totalH2>viewH2?-(totalH2-viewH2):0;
    stageSelScroll=Math.max(minScroll2,Math.min(0,stageSelScroll-e.deltaY*1.5));
  }
},{passive:false});

// ===== SHOP TOUCH HANDLING =====
function handleShopTouch(tx,ty){
  const mW=Math.min(320,W-16),mH=Math.min(500,H-30);
  const mX=(W-mW)/2,mY=(H-mH)/2;
  // Purchase animation playing - tap to dismiss, then show equip prompt
  if(shopPurchaseAnim){
    if(shopPurchaseAnim.t>30){
      const anim=shopPurchaseAnim;
      shopPurchaseAnim=null;sfx('click');
      // Show equip-now prompt after animation
      shopEquipPrompt={item:anim.item,tab:anim.tab};
    }
    return;
  }
  // Equip-now prompt after purchase
  if(shopEquipPrompt){
    const dlgW=Math.min(250,W-30),dlgH=150;
    const dlgX=W/2-dlgW/2,dlgY=H/2-dlgH/2;
    const btnW2=90,btnH2=34;
    // Equip now button
    if(tx>=W/2-btnW2-6&&tx<=W/2-6&&ty>=dlgY+dlgH-48&&ty<=dlgY+dlgH-48+btnH2){
      const it=shopEquipPrompt.item,tab=shopEquipPrompt.tab;
      if(tab===0)equipSkin(it.id);
      else if(tab===1)equipEyes(it.id);
      else equipEffect(it.id);
      sfx('select');vibrate(10);shopEquipPrompt=null;return;
    }
    // Later button
    if(tx>=W/2+6&&tx<=W/2+6+btnW2&&ty>=dlgY+dlgH-48&&ty<=dlgY+dlgH-48+btnH2){
      shopEquipPrompt=null;sfx('cancel');return;
    }
    // Tap outside dialog dismisses (don't equip)
    if(tx<dlgX||tx>dlgX+dlgW||ty<dlgY||ty>dlgY+dlgH){shopEquipPrompt=null;sfx('cancel');return;}
    return;
  }
  // Confirm dialog active
  if(shopConfirm){
    const dlgW=Math.min(270,W-30),dlgH=260;
    const dlgX=W/2-dlgW/2,dlgY=H/2-dlgH/2;
    const btnW2=100,btnH2=36;
    // Buy button (only respond if player can afford)
    if(tx>=W/2-btnW2-6&&tx<=W/2-6&&ty>=dlgY+dlgH-52&&ty<=dlgY+dlgH-52+btnH2){
      const item=shopConfirm.item,tab=shopConfirm.tab;
      if(walletCoins<item.price){sfx('cancel');return;} // can't afford - ignore tap
      if(buyItem(item.id,item.price)){
        // Start gacha celebration (equip prompt shown after animation)
        const parts=[];
        for(let i=0;i<20;i++){
          parts.push({x:W/2,y:H/2,vx:(Math.random()-0.5)*12,vy:(Math.random()-0.5)*12,
            life:60+Math.random()*40,col:['#ffd700','#ff69b4','#00e5ff','#a855f7','#34d399','#ff4444'][Math.floor(Math.random()*6)],
            sz:3+Math.random()*5});
        }
        shopPurchaseAnim={item,tab,t:0,parts};
        sfx('item');sfxFanfare();vibrate([10,5,15,5,10]);
      }
      shopConfirm=null;
      return;
    }
    // Cancel button
    if(tx>=W/2+6&&tx<=W/2+6+btnW2&&ty>=dlgY+dlgH-52&&ty<=dlgY+dlgH-52+btnH2){
      shopConfirm=null;sfx('cancel');return;
    }
    // Tap outside dialog dismisses it
    if(tx<dlgX||tx>dlgX+dlgW||ty<dlgY||ty>dlgY+dlgH){
      shopConfirm=null;sfx('cancel');return;
    }
    return;
  }
  // Footer close button
  const shopClY=mY+mH-42;
  if(tx>=W/2-50&&tx<=W/2+50&&ty>=shopClY&&ty<=shopClY+30){shopOpen=false;sfx('cancel');return;}
  // Outside modal
  if(tx<mX||tx>mX+mW||ty<mY||ty>mY+mH){shopOpen=false;sfx('cancel');return;}
  // Tabs
  const tabW=(mW-20)/3;
  for(let i=0;i<3;i++){
    const tbx=mX+10+i*tabW,tby=mY+56;
    if(tx>=tbx&&tx<=tbx+tabW-4&&ty>=tby&&ty<=tby+26){
      shopTab=i;shopScroll=0;sfx('click');return;
    }
  }
  // Item rows - record pending tap (confirmed on touchend if no scroll)
  shopPendingTap=null;
  const listY=mY+90,listH=mH-140;
  const items=shopSorted(shopTab===0?SHOP_ITEMS.skins:shopTab===1?SHOP_ITEMS.eyes:SHOP_ITEMS.effects);
  const rowH=54;
  for(let i=0;i<items.length;i++){
    const iy=listY+i*rowH-shopScroll;
    if(iy+rowH<listY||iy>listY+listH)continue;
    if(tx>=mX+8&&tx<=mX+mW-8&&ty>=iy+2&&ty<=iy+rowH-2){
      shopPendingTap={idx:i,tab:shopTab};
      return;
    }
  }
}
function confirmShopTap(){
  if(!shopPendingTap)return;
  const tab=shopPendingTap.tab,idx=shopPendingTap.idx;
  shopPendingTap=null;
  const items=shopSorted(tab===0?SHOP_ITEMS.skins:tab===1?SHOP_ITEMS.eyes:SHOP_ITEMS.effects);
  if(idx>=items.length)return;
  const item=items[idx];
  if(ownsItem(item.id)){
    // Already owned - do nothing (equip via cosmetic menu instead)
    return;
  } else {
    // Block purchase of secret/rare/super_rare items (gacha only)
    if(item.rarity==='rare'||item.rarity==='super_rare'){
      sfx('hurt');vibrate(15);
      addPop(W/2,H/2,t('popGachaOnly'),item.rarity==='super_rare'?'#ffd700':'#a855f7');
      return;
    }
    shopConfirm={item,tab};sfx('select');
  }
}

// ===== COSMETIC MENU TOUCH HANDLING =====
function handleCosmeticTouch(tx,ty){
  const mW=Math.min(320,W-16),mH=Math.min(500,H-30);
  const mX=(W-mW)/2,mY=(H-mH)/2;
  // Equip confirm dialog active
  if(cosmeticConfirm){
    const dlgW=Math.min(240,W-40),dlgH=140;
    const dlgX=W/2-dlgW/2,dlgY=H/2-dlgH/2;
    const btnW2=90,btnH2=34;
    // OK button
    if(tx>=W/2-btnW2-6&&tx<=W/2-6&&ty>=dlgY+dlgH-48&&ty<=dlgY+dlgH-48+btnH2){
      const it=cosmeticConfirm.item,tab=cosmeticConfirm.tab;
      if(it.id===''){
        if(tab===0)unequipSkin();else if(tab===1)unequipEyes();else unequipEffect();
      } else {
        if(tab===0)equipSkin(it.id);else if(tab===1)equipEyes(it.id);else equipEffect(it.id);
      }
      sfx('select');vibrate(10);cosmeticConfirm=null;return;
    }
    // Cancel button
    if(tx>=W/2+6&&tx<=W/2+6+btnW2&&ty>=dlgY+dlgH-48&&ty<=dlgY+dlgH-48+btnH2){
      cosmeticConfirm=null;sfx('cancel');return;
    }
    if(tx<dlgX||tx>dlgX+dlgW||ty<dlgY||ty>dlgY+dlgH){cosmeticConfirm=null;sfx('cancel');return;}
    return;
  }
  // Footer close button
  const cosClY=mY+mH-42;
  if(tx>=W/2-50&&tx<=W/2+50&&ty>=cosClY&&ty<=cosClY+30){cosmeticMenuOpen=false;newCosmeticIds.clear();localStorage.removeItem('gd5newCosm');sfx('cancel');return;}
  // Outside modal
  if(tx<mX||tx>mX+mW||ty<mY||ty>mY+mH){cosmeticMenuOpen=false;newCosmeticIds.clear();localStorage.removeItem('gd5newCosm');sfx('cancel');return;}
  // Tabs
  const tabW=(mW-20)/3;
  for(let i=0;i<3;i++){
    const tbx=mX+10+i*tabW,tby=mY+100;
    if(tx>=tbx&&tx<=tbx+tabW-4&&ty>=tby&&ty<=tby+26){
      cosmeticTab=i;cosmeticScroll=0;sfx('click');return;
    }
  }
  // Item rows - record pending tap (confirmed on touchend if no scroll)
  cosmeticPendingTap=null;
  const listY=mY+134,listH=mH-184;
  const allItems=cosmeticTab===0?SHOP_ITEMS.skins:cosmeticTab===1?SHOP_ITEMS.eyes:SHOP_ITEMS.effects;
  const ownedList=[{id:'',name:'\u306A\u3057',desc:'\u30C7\u30D5\u30A9\u30EB\u30C8'}].concat(shopSorted(allItems.filter(it=>ownsItem(it.id)),true));
  const rowH=48;
  for(let i=0;i<ownedList.length;i++){
    const iy=listY+i*rowH-cosmeticScroll;
    if(iy+rowH<listY||iy>listY+listH)continue;
    if(tx>=mX+8&&tx<=mX+mW-8&&ty>=iy+2&&ty<=iy+rowH-2){
      cosmeticPendingTap={idx:i,tab:cosmeticTab};
      return;
    }
  }
}
function confirmCosmeticTap(){
  if(!cosmeticPendingTap)return;
  const tab=cosmeticPendingTap.tab,idx=cosmeticPendingTap.idx;
  cosmeticPendingTap=null;
  const allItems=tab===0?SHOP_ITEMS.skins:tab===1?SHOP_ITEMS.eyes:SHOP_ITEMS.effects;
  const ownedList=[{id:'',name:'\u306A\u3057',desc:'\u30C7\u30D5\u30A9\u30EB\u30C8'}].concat(shopSorted(allItems.filter(it=>ownsItem(it.id)),true));
  if(idx>=ownedList.length)return;
  const item=ownedList[idx];
  // Show equip confirmation dialog
  cosmeticConfirm={item,tab};sfx('select');
}

// ===== LOGIN (HTML overlay) =====
function handleLoginTouch(tx,ty){return;} // Login handled by HTML overlay
nameInput.addEventListener('input',()=>{
  let v=nameInput.value.replace(/[<>&"']/g,'').substring(0,12);
  nameInput.value=v;
  loginBtn.classList.toggle('ready',v.trim().length>=1);
  const ne=document.getElementById('nameError');if(ne)ne.textContent='';
});
// Helper: finish login and enter the game
function _finishLogin(name){
  playerName=name;localStorage.setItem('gd5username',playerName);
  loginOverlay.classList.remove('active');
  sfx('select');vibrate(15);
  // Ensure initial save happens – retry until Firebase is fully ready
  let _saveRetries=0;
  const _doInitialSave=()=>{
    _saveRetries++;
    if(fbUser&&fbSynced){
      if(typeof fbForceSave==='function')fbForceSave();
    } else if(_saveRetries<30){
      setTimeout(_doInitialSave,300);
    } else {
      fbSynced=true;
      if(typeof fbForceSave==='function')fbForceSave();
    }
  };
  // First attempt immediately, then retry
  _doInitialSave();
  if(!tutorialDone){startTutorial();}
  else{state=ST.TITLE;switchBGM('title');}
}
// Guest login (anonymous auth + username)
const nameError=document.getElementById('nameError');
loginBtn.addEventListener('click',()=>{
  initAudio();
  const name=(nameInput.value||'').trim();
  if(name.length<1){sfx('hurt');vibrate(10);return;}
  // NG word check
  if(typeof ngCheck==='function'&&ngCheck(name)){
    nameError.textContent=t('nameUnavailable');
    sfx('hurt');vibrate(10);return;
  }
  nameError.textContent='';
  loginBtn.disabled=true;
  // If already signed in with Google/Twitter, check name uniqueness (same as guest)
  if(fbUser&&!fbUser.isAnonymous){
    fbCheckNameExists(name).then(taken=>{
      if(taken){
        nameError.textContent=t('nameTaken');
        sfx('hurt');vibrate(10);
        return;
      }
      fbSynced=true;
      _finishLogin(name);
    }).finally(()=>{loginBtn.disabled=false;});
    return;
  }
  // Guest login – sign in first, then check name uniqueness
  fbSignInAnonymous().then(()=>{
    return fbCheckNameExists(name).then(taken=>{
      if(taken){
        nameError.textContent=t('nameTaken');
        sfx('hurt');vibrate(10);
        return;
      }
      _finishLogin(name);
    });
  }).catch(()=>{
    _finishLogin(name);
  }).finally(()=>{loginBtn.disabled=false;});
});
// Google Sign-In (React Nativeネイティブ経由 – disallowed_useragent回避)
const googleBtn=document.getElementById('googleBtn');
if(googleBtn){
  googleBtn.addEventListener('click',()=>{
    initAudio();
    googleBtn.disabled=true;
    if(fbUser&&fbUser.isAnonymous)localStorage.setItem('gd5anonUid',fbUser.uid);
    localStorage.setItem('gd5prevMethod',fbLoginMethod||'');
    // RNにGoogle認証を依頼
    if(window.ReactNativeWebView){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'googleSignIn'}));
    } else {
      // ウェブブラウザはpopup優先（redirectへフォールバック）
      localStorage.setItem('gd5pendingProvider','google');
      fbSignInGoogle().then(result=>{
        // popup成功時はUserCredentialが返る。redirectの場合はundefinedでgetRedirectResultが処理
        if(result&&result.user)_handleSocialLogin(result.user,'google');
      }).catch(err=>{
        console.warn('[Firebase] Google sign-in error:',err);
        googleBtn.disabled=false;
        sfx('hurt');vibrate(10);
      });
    }
  });
}
// Apple Sign-In (React Nativeネイティブ経由)
const appleBtn=document.getElementById('appleBtn');
if(appleBtn){
  appleBtn.addEventListener('click',()=>{
    initAudio();
    appleBtn.disabled=true;
    if(fbUser&&fbUser.isAnonymous)localStorage.setItem('gd5anonUid',fbUser.uid);
    localStorage.setItem('gd5prevMethod',fbLoginMethod||'');
    if(window.ReactNativeWebView){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'appleSignIn'}));
    } else {
      // ウェブブラウザはpopup優先（redirectへフォールバック）
      localStorage.setItem('gd5pendingProvider','apple');
      fbSignInApple().then(result=>{
        if(result&&result.user)_handleSocialLogin(result.user,'apple');
      }).catch(err=>{
        console.warn('[Firebase] Apple sign-in error:',err);
        appleBtn.disabled=false;
        sfx('hurt');vibrate(10);
      });
    }
  });
}
// RNからの認証結果を受け取る（native bridge）
window.addEventListener('nativeAuthResult',(e)=>{
  const msg=e.detail;
  if(msg.type==='googleCredential'){
    fbSignInWithGoogleIdToken(msg.idToken).then(cred=>{
      _handleSocialLogin(cred.user,'google');
    }).catch(err=>{
      console.warn('[Firebase] Google credential error:',err);
      if(googleBtn)googleBtn.disabled=false;
      sfx('hurt');vibrate(10);
    });
  } else if(msg.type==='appleCredential'){
    const _noteAC=document.getElementById('loginNote');
    fbSignInWithAppleToken(msg.identityToken,msg.rawNonce).then(cred=>{
      _handleSocialLogin(cred.user,'apple');
    }).catch(err=>{
      const code=(err&&err.code)||'unknown';
      console.warn('[Firebase] Apple credential error:',code,err);
      if(appleBtn)appleBtn.disabled=false;
      if(_noteAC){_noteAC.textContent='Apple error: '+code;_noteAC.style.color='#ff3860';}
      sfx('hurt');vibrate(10);
    });
  } else if(msg.type==='googleSignInError'){
    if(googleBtn)googleBtn.disabled=false;
    sfx('hurt');vibrate(10);
  } else if(msg.type==='appleSignInError'){
    if(appleBtn)appleBtn.disabled=false;
    const code=msg.errorCode||'unknown';
    console.warn('[Apple] Sign in error:',code,msg.errorMessage||'');
    const _note=document.getElementById('loginNote');
    if(_note){_note.textContent='Apple Sign In error: '+code;_note.style.color='#ff3860';}
    sfx('hurt');vibrate(10);
  } else if(msg.type==='appleSignInCanceled'){
    if(appleBtn)appleBtn.disabled=false;
    const _noteC=document.getElementById('loginNote');
    if(_noteC){_noteC.textContent='キャンセルされました。もう一度試してください。';_noteC.style.color='#ff9800cc';}
  }
});
// Handle redirect result after page reload (Google/Apple sign-in)
function _handleSocialLogin(user,providerName){
  const prevMethod=localStorage.getItem('gd5prevMethod')||'';
  const prevAnonUid=localStorage.getItem('gd5anonUid')||null;
  localStorage.removeItem('gd5pendingProvider');
  localStorage.removeItem('gd5prevMethod');
  localStorage.removeItem('gd5anonUid');
  fbUser=user;
  _fbGoogleLoginInProgress=true;
  fbLoadUserData(user.uid).then(data=>{
    if(data&&data.name){
      fbMergeCloudData(data);fbSynced=true;_fbGoogleLoginInProgress=false;
      fbSaveUserData();loginOverlay.classList.remove('active');
      sfx('select');vibrate(15);
      if(!tutorialDone){startTutorial();}else{state=ST.TITLE;switchBGM('title');}
      return;
    }
    const localName=playerName||localStorage.getItem('gd5username')||'';
    const canMigrate=prevMethod===''||prevMethod==='anonymous';
    if(localName&&canMigrate&&prevAnonUid){
      return fbFindAndMigrateByName(localName,prevAnonUid).then(migrated=>{
        if(migrated&&migrated.name){
          fbMergeCloudData(migrated);fbSynced=true;_fbGoogleLoginInProgress=false;
          fbSaveUserData();loginOverlay.classList.remove('active');
          sfx('select');vibrate(15);
          if(!tutorialDone){startTutorial();}else{state=ST.TITLE;switchBGM('title');}
        } else {
          fbSynced=true;_fbGoogleLoginInProgress=false;
          if(localName){
            // Check name uniqueness before auto-registering with existing localName
            // (prevents duplicate names when re-login gives different UID)
            fbCheckNameExists(localName).then(taken=>{
              if(taken) _showSocialNameInput(user,prevMethod);
              else _finishLogin(localName);
            });
          } else {
            _showSocialNameInput(user,prevMethod);
          }
        }
      });
    }
    _fbGoogleLoginInProgress=false;fbSynced=true;
    _showSocialNameInput(user,prevMethod);
  }).catch(()=>{_fbGoogleLoginInProgress=false;fbSynced=true;});
}
function _showSocialNameInput(user,prevMethod){
  if(prevMethod==='google'||prevMethod==='apple'||prevMethod==='twitter'){
    playerName='';highScore=0;walletCoins=0;played=0;
    totalChestsOpened=0;storedChests=0;tutorialDone=false;
    unlockedChars=[0];ownedItems=[];packProgress={};totalStars=0;
    equippedSkin='';equippedEyes='';equippedEffect='';
    selChar=0;rankChar=-1;rankSkin='';rankEyes='';rankFx='';
    const ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('gd5'))ks.push(k);}
    ks.forEach(k=>localStorage.removeItem(k));
  }
  if(googleBtn)googleBtn.style.display='none';
  if(appleBtn)appleBtn.style.display='none';
  document.getElementById('loginDivider').style.display='none';
  document.getElementById('loginLabel').textContent=t('registerName');
  const ln=document.getElementById('loginNote');ln.textContent=t('nameNote');ln.style.color='#fff4';
  if(user&&user.displayName){
    const dn=user.displayName.replace(/[<>&"']/g,'').substring(0,12);
    nameInput.value=dn;loginBtn.classList.toggle('ready',dn.trim().length>=1);
  }
  nameInput.placeholder=t('namePlaceholderAlt');nameInput.focus();
}
window.addEventListener('fbRedirectResult',(e)=>{
  const result=e.detail;
  const providerName=(result.additionalUserInfo&&result.additionalUserInfo.providerId==='apple.com')?'apple':'google';
  _handleSocialLogin(result.user,providerName);
});
window.addEventListener('fbLinkResult',(e)=>{
  const method=e.detail.method;
  addPop(W/2,H/2,method==='apple'?t('appleLinkDone'):t('googleLinkDone'),method==='apple'?'#aaa':'#4285f4');
  sfx('item');vibrate(15);
});
// Auto-login for returning Firebase users (check on page load)
fbOnReady(user=>{
  if(user&&!playerName){
    if(_fbRedirectPending)return;
    // Returning user on new device – try to restore data
    fbLoadUserData().then(data=>{
      if(data&&data.name){
        initAudio();
        fbMergeCloudData(data);
        loginOverlay.classList.remove('active');
        if(!tutorialDone){startTutorial();}
        else{state=ST.TITLE;switchBGM('title');}
      }
    });
  }
});

// ===== TUTORIAL (course-based) =====
// Checkpoint distances calculated for player at W*0.25
const TUT_CHECKPOINTS=[
  {dist:160,type:'jump',msgKey:'tutJumpMsg',subKey:'tutJumpSub',icon:'tap'},
  {dist:430,type:'flip_up',msgKey:'tutFlipUpMsg',subKey:'tutFlipUpSub',icon:'swipe_up'},
  {dist:700,type:'flip_down',msgKey:'tutFlipDownMsg',subKey:'tutFlipDownSub',icon:'swipe_down'},
  {dist:980,type:'double_flip',msgKey:'tutDoubleFlipMsg',subKey:'tutDoubleFlipSub',icon:'double'},
  {dist:1300,type:'bomb',msgKey:'tutBombMsg',subKey:'tutBombSub',icon:'bomb'},
];
function buildTutorialCourse(){
  tutCoursePlats=[];tutCourseCeil=[];tutCourseSpikes=[];
  // Player screen-x = W*0.25. At dist D, player world-x = W*0.25+D
  const pw=W*0.25; // player screen offset (~90px)
  // --- Jump section (dist=160, player world-x=250) ---
  // Continuous floor, spike ahead of player
  tutCoursePlats.push({x:-50,w:600,h:GROUND_H}); // floor [-50,550]
  tutCourseSpikes.push({x:pw+160+30,w:30,h:24}); // spike ~30px ahead of player when stopped
  // --- Flip-up section (dist=430, player world-x=520) ---
  // Floor ends near player → long abyss ahead → ceiling available
  // (floor [-50,550] ends at 550, player at 520 is near edge)
  tutCourseCeil.push({x:400,w:420,h:GROUND_H}); // ceiling [400,820] ends just past player at flip_down
  // --- Flip-down section (dist=700, player world-x=790) ---
  // Ceiling ends ギリギリ near player → must flip back to floor ASAP
  // (ceiling ends at 820, player at 790 is right at the edge)
  tutCoursePlats.push({x:780,w:770,h:GROUND_H}); // floor [780,1550] player lands safely at 790
  // --- Double-flip section (dist=980, player world-x=1070) ---
  // Floor present, NO ceiling (player flips up into open air, gets frozen, flips back)
  // (floor [700,1400] covers this area, no ceiling between 850 and 1250)
  // --- Bomb section (dist=1300, player world-x=1390) ---
  tutCoursePlats.push({x:1250,w:600,h:GROUND_H}); // floor [1250,1850]
  tutCourseCeil.push({x:1250,w:600,h:GROUND_H}); // ceiling [1250,1850]
}
function startTutorial(){
  reset();
  state=ST.TUTORIAL;
  tutStep=0;tutStepT=0;tutDone=false;tutEnemySpawned=false;
  tutScrollX=0;tutSpeed=1.5;tutWaiting=false;
  tutPhase='scroll';tutSuccessT=0;tutFlipCount=0;
  tutWarpT=0;tutWarpPhase='';tutIsIntro=false;tutFreezePlayer=false;
  screenFadeIn=30;
  bombCount=0;invCount=0;
  buildTutorialCourse();
  player.x=W*0.25;player.gDir=1;player.vy=0;
  player.y=H-GROUND_H-PLAYER_R;player.grounded=true;
  speed=1.5;
  switchBGM('title');
}
function tutAdvance(){
  tutPhase='scroll';tutSpeed=1.5;tutWaiting=false;tutFreezePlayer=false;
  tutStep++;tutStepT=0;tutDone=false;tutEnemySpawned=false;tutFlipCount=0;
  if(tutStep>=TUT_CHECKPOINTS.length){
    tutorialDone=true;localStorage.setItem('gd5tutorialDone','1');
    tutPhase='transition';tutSuccessT=0;
    tutWarpT=0;tutWarpPhase='welcome';
  }
}
function handleTutorialTouch(tx,ty){
  // Skip button
  if(tutWarpPhase!=='warp'&&tx>=W-64&&tx<=W-8&&ty>=safeTop+4&&ty<=safeTop+28){
    sfx('select');tutorialDone=true;localStorage.setItem('gd5tutorialDone','1');
    state=ST.TITLE;switchBGM('title');return;
  }
  // Welcome screen: tap to start warp
  if(tutWarpPhase==='welcome'&&tutWarpT>30){
    sfx('select');vibrate([15,10,30]);
    tutWarpPhase='warp';tutWarpT=0;
    return;
  }
  if(tutWarpPhase==='warp')return;
  if(tutPhase==='success'||tutPhase==='action')return;
  if(tutStep>=TUT_CHECKPOINTS.length)return;
  const cp=TUT_CHECKPOINTS[tutStep];
  if(tutPhase!=='wait')return;
  // Bomb: hit test on button
  if(cp.type==='bomb'){
    if(hitBombBtn(tx,ty)&&bombCount>0){useBomb();tutDone=true;tutPhase='success';tutSuccessT=0;sfx('item');setTimeout(tutAdvance,800);}
    return;
  }
  // Jump: tap anywhere → jump + resume scroll so player flies over spike
  if(cp.type==='jump'&&player.grounded){
    player.vy=player.gDir===1?-JUMP_POWER:JUMP_POWER;player.grounded=false;
    sfx('jump');tutDone=true;
    tutPhase='action'; // scroll resumes during jump
    setTimeout(()=>{tutPhase='success';tutSuccessT=0;setTimeout(tutAdvance,600);},500);
    return;
  }
}
