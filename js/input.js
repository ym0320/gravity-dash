'use strict';
let touchStartY=0,touchStartX=0,touchStartT=0,touchMoved=false,touchBtnUsed=false;
// Character modal (long-press on title to show details + animated demo)
let charModal={show:false,idx:0,animT:0};
let longPressTimer=null,longPressFired=false,titleTouchPos=null;
let draggingSlider=null; // 'bgm' or 'sfx' when dragging a settings slider

function canvasXY(cx,cy){
  const r=canvas.getBoundingClientRect();
  return{x:cx-r.left,y:cy-r.top};
}

// Pause button hit test (moved lower, larger area for reliability)
function hitPauseBtn(px,py){return px>=W-58&&px<=W-4&&py>=safeTop+8&&py<=safeTop+52;}
function itemBtnLayout(){const btnSz=44,btnGap=12,totalW=btnSz*2+btnGap,sx=W/2-totalW/2,by=H-PANEL_H+6;return{invX:sx,bombX:sx+btnSz+btnGap,y:by,sz:btnSz};}
function hitInvBtn(px,py){const b=itemBtnLayout();return px>=b.invX&&px<=b.invX+b.sz&&py>=b.y&&py<=b.y+b.sz;}
function hitBombBtn(px,py){const b=itemBtnLayout();return px>=b.bombX&&px<=b.bombX+b.sz&&py>=b.y&&py<=b.y+b.sz;}
function hitResumeBtn(px,py){return px>=W/2-80&&px<=W/2+80&&py>=H*0.45&&py<=H*0.45+44;}
function hitQuitBtn(px,py){return px>=W/2-80&&px<=W/2+80&&py>=H*0.56&&py<=H*0.56+44;}
// Game over screen buttons (must match drawDead layout exactly)
function deadBtnLayout(){
  const btnW2=Math.min(220,W-40),btnH2=38,btnX2=W/2-btnW2/2;
  const cardY=H*0.24,cardH=210+(storedChests>0?56:0);
  let btnTop=cardY+cardH+12;
  const btns=[];
  if(!isPackMode){
    btns.push({id:'continue',x:btnX2,y:btnTop,w:btnW2,h:btnH2});
    btnTop+=btnH2+8;
  }
  btns.push({id:'restart',x:btnX2,y:btnTop,w:btnW2,h:btnH2});
  btnTop+=btnH2+8;
  btns.push({id:'title',x:btnX2,y:btnTop,w:btnW2,h:btnH2});
  return btns;
}
function hitDeadChestBtn(px,py){
  if(storedChests<=0)return false;
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
function handleDeadBtn(btnId){
  if(btnId==='continue'){
    if(usedContinue){sfx('hurt');vibrate(15);return;}
    if(walletCoins>=100){
      walletCoins-=100;localStorage.setItem('gd5wallet',walletCoins.toString());
      usedContinue=true;
      sfx('select');continueFromDeath();
    } else {sfx('hurt');vibrate(15);}
  } else if(btnId==='restart'){
    sfx('click');
    if(isPackMode){startPackStageFromDead();return;}
    startCountdown('endless');
  } else if(btnId==='title'){
    sfx('cancel');titleTouchPos=null; // prevent stale touch from triggering title actions
    if(isPackMode){state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;switchBGM('title');}
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
    if(storedChests>0){
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
    const bd2=n2>20?6:n2>10?8:12;
    let ct2=12;
    chestBatchResults.forEach(r2=>{
      const rar2=r2&&r2.type==='cosmetic'&&r2.item?r2.item.rarity:null;
      const inc2=r2&&r2.type==='char'&&r2.isNew;
      ct2+=bd2+(rar2==='super_rare'?40:rar2==='rare'?20:inc2?15:0);
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
      if(isNew){ownedItems.push(ri.id);localStorage.setItem('gd5owned',JSON.stringify(ownedItems));}
      reward={type:'cosmetic',item:ri,isNew:isNew,bonusCoins:isNew?0:300};
    } else {
      reward={type:'coin',amount:1000};
    }
  } else if(roll<0.17){
    // Character (15%)
    const ci=Math.floor(Math.random()*CHARS.length);
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
      if(isNew){ownedItems.push(ri.id);localStorage.setItem('gd5owned',JSON.stringify(ownedItems));}
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
      if(isNew){ownedItems.push(ni.id);localStorage.setItem('gd5owned',JSON.stringify(ownedItems));}
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
  player.rot=0;player.rotTarget=0;player.trail=[];
  hp=HP_MAX+(ct().hpBonus||0);hurtT=0;
  speed=SPEED_INIT;speedOffset=dist; // reset speed to initial by offsetting
  // Rebuild safe platforms around player
  platforms=[];ceilPlats=[];
  platforms.push({x:player.x-W*0.3,w:W*0.9,h:GROUND_H});
  ceilPlats.push({x:player.x-W*0.3,w:W*0.9,h:GROUND_H});
  for(let i=0;i<5;i++){generatePlatform(platforms,false);generatePlatform(ceilPlats,true);}
  player.x=W*0.2;
  player.y=floorSurfaceY(player.x)-PLAYER_R;player.grounded=false;
  // Clear hazards
  enemies=[];bullets=[];spikes=[];items=[];floatPlats=[];movingHills=[];gravZones=[];
  bossPhase={active:false,prepare:0,alertT:0,enemies:[],defeated:0,total:0,reward:false,rewardT:0,nextAt:(Math.floor(dist/1000)+1)*1000,lastBossScore:score,bossCount:bossPhase.bossCount||0,bossType:'',noDamage:true};
  itemEff={invincible:0,magnet:0};bombCount=0;bombFlashT=0;invCount=0;
  djumpAvailable=!!ct().hasDjump;djumpUsed=false;ghostPhaseT=0;ghostInvis=false;
  player._quakeStunned=false;player._quakeStunT=0;
  deadT=0;newHi=false;combo=0;comboT=0;comboDsp=0;comboDspT=0;airCombo=0;
  shakeX=0;shakeY=0;shakeI=0;flipCount=0;flipTimer=999;
  coinCD=0;itemCD=0;enemyCD=0;spikeCD=0;hillCD=0;floatCD=0;gravZoneCD=0;
  flipZone={active:false,type:0,len:0,cd:0,lastType:-1};
  bossChests=0;chestFall={active:false,x:0,y:0,vy:0,sparkT:0,gotT:0};chestOpen={phase:'none',t:0,charIdx:-1,parts:[],reward:null};
  state=ST.COUNTDOWN;countdownT=180;
  bgmCurrent='';switchBGM('play'); // reset BGM from beginning
  sfx('countdown');
}
function startPackStageFromDead(){
  state=ST.PLAY;resetPackStage(currentPackIdx,currentPackStageIdx);switchBGM('play');
}

// Help overlay touch handler
function handleHelpTouch(tx,ty){
  const hw=Math.min(300,W-20),hh=380,hx=W/2-hw/2,hy=H/2-hh/2;
  const hCloseY=hy+hh-42;
  // Close button
  if(tx>=W/2-50&&tx<=W/2+50&&ty>=hCloseY&&ty<=hCloseY+32){sfx('click');helpOpen=false;return;}
  // Tap anywhere outside the modal closes it
  if(tx<hx||tx>hx+hw||ty<hy||ty>hy+hh){sfx('cancel');helpOpen=false;return;}
}

// Settings panel input helpers (must match drawTitle layout)
function settingsLayout(){
  const pw=Math.min(280,W-30),ph=500,px=W/2-pw/2,py=H/2-ph/2;
  const slW=pw-50,slX=px+25,barX=slX+42,barW=slW-42;
  const slY1=py+52,slY2=slY1+44;
  const barH=10;
  const nameY=slY2+28;
  const tutBtnY=nameY+22;
  const resetBtnY=tutBtnY+38;
  const methodY=resetBtnY+42;
  const logoutBtnY=methodY+8;
  return{px,py,pw,ph,slX,barX,barW,barY1:slY1-8,barY2:slY2-8,barH,nameY,tutBtnY,resetBtnY,logoutBtnY,closeY:py+ph-42};
}
function hitSettingsGear(tx,ty){return tx>=W-44&&tx<=W-8&&ty>=safeTop+6&&ty<=safeTop+42;}
function hitHelpBtn(tx,ty){return tx>=W-44&&tx<=W-8&&ty>=safeTop+44&&ty<=safeTop+80;}
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
  // Confirm button (step 0 = first confirm, step 1 = final delete)
  if(tx>=confirmX&&tx<=confirmX+btnW&&ty>=btnY&&ty<=btnY+btnH){
    if(confirmModal.step===0){
      confirmModal.step=1;sfx('hurt');vibrate(30);return true;
    } else {
      // Execute action
      if(confirmModal.type==='reset'){
        const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('gd5'))keys.push(k);}
        keys.forEach(k=>localStorage.removeItem(k));
        sfx('bomb');vibrate(50);
        confirmModal=null;settingsOpen=false;
        if(typeof fbDeleteUserData==='function'){fbDeleteUserData().finally(()=>location.reload());}
        else{location.reload();}
      } else {
        sfx('cancel');vibrate(30);
        confirmModal=null;settingsOpen=false;
        fbSynced=false;
        clearTimeout(_fbSaveTimer);
        const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('gd5'))keys.push(k);}
        keys.forEach(k=>localStorage.removeItem(k));
        if(fbLoginMethod==='anonymous'&&typeof fbDeleteUserData==='function'){
          fbDeleteUserData().finally(()=>location.reload());
        } else if(typeof fbSignOut==='function'){fbSignOut().finally(()=>location.reload());}
        else{location.reload();}
      }
      return true;
    }
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
        addPop(W/2,H/2,'\u3053\u306E\u540D\u524D\u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093','#ff3860');
        return true;
      }
      // Check name uniqueness then save
      fbCheckNameExists(newName).then(taken=>{
        if(taken){
          sfx('hurt');vibrate(15);
          addPop(W/2,H/2,'\u3053\u306E\u540D\u524D\u306F\u4F7F\u308F\u308C\u3066\u3044\u307E\u3059','#ff3860');
        } else {
          playerName=newName;localStorage.setItem('gd5username',playerName);
          nameEditMode=false;sfx('select');vibrate(10);
          addPop(W/2,H/2,'\u540D\u524D\u3092\u5909\u66F4\u3057\u307E\u3057\u305F','#00e5ff');
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
  // Logout button - always show confirmation modal
  if(tx>=s.px+20&&tx<=s.px+s.pw-20&&ty>=s.logoutBtnY&&ty<=s.logoutBtnY+30){
    confirmModal={type:'logout',step:0};sfx('hurt');vibrate(15);
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

// Auto-pause when page loses visibility or focus
// Stop BGM timers when hidden to prevent audio burst on return
let bgmBeforePause='';
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    if(state===ST.PLAY||state===ST.COUNTDOWN){state=ST.PAUSE;}
    // Stop BGM to prevent sound pile-up
    bgmBeforePause=bgmCurrent;
    if(bgmTimer){clearTimeout(bgmTimer);bgmTimer=null;}
    if(typeof feverTimer!=='undefined'&&feverTimer){clearTimeout(feverTimer);feverTimer=null;}
    bgmCurrent=''; // allow restart
  } else {
    // Page visible again: try resume audio and restart BGM
    if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume();
    if(bgmBeforePause){switchBGM(bgmBeforePause);bgmBeforePause='';}
    else if(audioCtx&&!bgmCurrent)switchBGM('title');
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
  if(state===ST.PLAY){state=ST.PAUSE;}
});

// Start countdown instead of immediately playing
function startCountdown(mode){
  gameMode=mode;isPackMode=false;
  const retry=bossRetry;
  reset();
  if(retry){
    // Boss retry: start at saved score, boss triggers immediately
    isRetryGame=true;
    bossRetry=null;
    score=retry.score;dist=retry.score;
    bossPhase.bossCount=retry.bossCount;
    bossPhase.nextAt=dist; // will trigger boss on first play frame
    bossPhase.lastBossScore=score;
    lastMile=Math.floor(score/1000)*1000;
    // Set correct theme for this score
    const ti=Math.min(Math.floor(dist/1000),THEMES.length-1);
    if(ti!==curTheme){prevTheme=curTheme;curTheme=ti;themeLerp=1;}
  } else {
    isRetryGame=false;
  }
  state=ST.COUNTDOWN;countdownT=180; // 3 seconds at 60fps
  titleTouchPos=null; // clear stale touch pos
  sfx('countdown');
}

canvas.addEventListener('touchstart',e=>{
  e.preventDefault();initAudio();
  const t=e.touches[0];
  const p=canvasXY(t.clientX,t.clientY);
  touchStartY=t.clientY;touchStartX=t.clientX;touchStartT=Date.now();touchMoved=false;touchBtnUsed=false;
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
  // Settings gear button on title screen
  if(state===ST.TITLE&&!charModal.show&&hitSettingsGear(p.x,p.y)){sfx('click');settingsOpen=true;return;}
  // Help button on title screen
  if(state===ST.TITLE&&!charModal.show&&hitHelpBtn(p.x,p.y)){sfx('select');helpOpen=true;return;}
  if(state===ST.STAGE_SEL){stageSelTouchY=t.clientY;stageSelDragging=false;handleStageSelTouch(p.x,p.y);return;}
  if(state===ST.STAGE_CLEAR&&stageClearT>60){
    sfx('click');state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;switchBGM('title');return;
  }
  if(state===ST.PAUSE){
    if(hitResumeBtn(p.x,p.y)){sfx('select');state=ST.PLAY;switchBGM('play');return;}
    if(hitQuitBtn(p.x,p.y)){sfx('cancel');if(bossPhase.active&&!isRetryGame){bossRetry={score:bossPhase.lastBossScore,bossCount:bossPhase.bossCount-1};}state=ST.TITLE;isPackMode=false;switchBGM('title');return;}
    return;
  }
  if(state===ST.PLAY&&hitInvBtn(p.x,p.y)){useInvincible();touchBtnUsed=true;return;}
  if(state===ST.PLAY&&hitBombBtn(p.x,p.y)){useBomb();touchBtnUsed=true;return;}
  if(state===ST.PLAY&&hitPauseBtn(p.x,p.y)){sfx('pause');state=ST.PAUSE;touchBtnUsed=true;return;}
  if(state===ST.TITLE){
    // Shop modal intercepts all input when open
    if(shopOpen){handleShopTouch(p.x,p.y);titleTouchPos=null;return;}
    // Cosmetic menu intercepts all input when open
    if(cosmeticMenuOpen){handleCosmeticTouch(p.x,p.y);titleTouchPos=null;return;}
    // Inventory modal intercepts all input when open
    if(inventoryOpen){
      const mW2=Math.min(300,W-24),mH2=Math.min(360,H-40);
      const mX2=(W-mW2)/2,mY2=(H-mH2)/2;
      // Footer close button
      const invClY=mY2+mH2-38;
      if(p.x>=W/2-50&&p.x<=W/2+50&&p.y>=invClY&&p.y<=invClY+30&&chestOpen.phase==='none'){
        inventoryOpen=false;sfx('cancel');return;
      }
      // Tap outside modal
      if((p.x<mX2||p.x>mX2+mW2||p.y<mY2||p.y>mY2+mH2)&&chestOpen.phase==='none'){
        inventoryOpen=false;sfx('cancel');return;
      }
      handleInventoryChestTap(p.x,p.y);titleTouchPos=null;return;
    }
    if(charModal.show){sfx('cancel');charModal.show=false;titleTouchPos=null;return;}
    longPressFired=false;titleTouchPos=p;
    const cidx=getCharGridIdx(p.x,p.y);
    if(cidx>=0&&isCharUnlocked(cidx)){
      longPressTimer=setTimeout(()=>{longPressFired=true;charModal={show:true,idx:cidx,animT:0};vibrate(15);sfxCharVoice(cidx);},400);
    } else if(cidx>=0){
    } else {
      handleTitleTouch(p.x,p.y);
      titleTouchPos=null; // prevent touchend from re-calling handleTitleTouch
    }
  }
  else if(state===ST.DEAD&&deadChestOpen){
    handleInventoryChestTap(p.x,p.y);
  }
  else if(state===ST.DEAD&&deadT>45){
    if(hitDeadChestBtn(p.x,p.y)){deadChestOpen=true;chestBatchMode=false;startInventoryChestOpen();sfx('select');return;}
    const btnId=hitDeadBtn(p.x,p.y);
    if(btnId)handleDeadBtn(btnId);
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
    const mH=H-topPad-10,hdrH=52,listH=mH-hdrH-50;
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
    shopScroll=Math.max(0,Math.min(maxS,shopScroll-dy2*2));touchMoved=true;return;
  }
  // Cosmetic scroll
  if(cosmeticMenuOpen){
    const dy2=t.clientY-touchStartY;touchStartY=t.clientY;
    const allItems=cosmeticTab===0?SHOP_ITEMS.skins:cosmeticTab===1?SHOP_ITEMS.eyes:SHOP_ITEMS.effects;
    const ownedList=[{id:''}].concat(allItems.filter(it=>ownsItem(it.id)));
    const mH2=Math.min(500,H-30),listH2=mH2-184,totalH2=ownedList.length*48;
    const maxS=Math.max(0,totalH2-listH2);
    cosmeticScroll=Math.max(0,Math.min(maxS,cosmeticScroll-dy2*2));touchMoved=true;return;
  }
  const dy=t.clientY-touchStartY;
  const dx=t.clientX-touchStartX;
  if(Math.abs(dy)>20||Math.abs(dx)>20){touchMoved=true;if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null;}}
  // Stage selection scroll
  if(state===ST.STAGE_SEL){
    const scrollDy=t.clientY-stageSelTouchY;
    if(Math.abs(scrollDy)>5){stageSelDragging=true;stageSelScroll+=scrollDy;stageSelTouchY=t.clientY;
    const maxScroll=0,minScroll=-(STAGE_PACKS.length*144-H+120);
    stageSelScroll=Math.max(minScroll,Math.min(maxScroll,stageSelScroll));}
  }
},{passive:false});

canvas.addEventListener('touchend',e=>{
  e.preventDefault();
  if(draggingSlider){
    if(draggingSlider==='sfx')sfx('coin'); // preview SE at new volume
    draggingSlider=null;return;
  }
  if(helpOpen||settingsOpen||rankingOpen||inventoryOpen)return;
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
        player.gDir=-1;player.vy=-8;sfx('flip');vibrate(20);
        player.face='flip';setTimeout(()=>{if(player.alive)player.face='normal';},250);
        emitParts(player.x,player.y,10,tc('ply'),3,2.5);player.rotTarget-=Math.PI;
        tutDone=true;tutPhase='action';
        setTimeout(()=>{tutPhase='success';tutSuccessT=0;setTimeout(tutAdvance,600);},700);
      } else if(cp.type==='flip_down'&&tdy>0&&player.gDir===-1){
        player.gDir=1;player.vy=8;sfx('flip');vibrate(20);
        player.face='flip';setTimeout(()=>{if(player.alive)player.face='normal';},250);
        emitParts(player.x,player.y,10,tc('ply'),3,2.5);player.rotTarget+=Math.PI;
        tutDone=true;tutPhase='action';
        setTimeout(()=>{tutPhase='success';tutSuccessT=0;setTimeout(tutAdvance,600);},700);
      } else if(cp.type==='double_flip'){
        if(tdy<0&&player.gDir===1&&tutFlipCount===0){
          // First flip: up → freeze mid-air after 280ms (higher on screen)
          player.gDir=-1;player.vy=-7;sfx('flip');vibrate(20);player.grounded=false;
          emitParts(player.x,player.y,10,tc('ply'),3,2.5);player.rotTarget-=Math.PI;
          tutFlipCount=1;tutPhase='action';
          setTimeout(()=>{if(tutFlipCount===1){player.vy=0;tutFreezePlayer=true;tutPhase='wait';tutStepT=0;}},280);
        } else if(tdy>0&&player.gDir===-1&&tutFlipCount>=1){
          // Second flip: down → success
          player.gDir=1;player.vy=5;sfx('flip');vibrate(20);player.grounded=false;
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

  if(touchMoved&&Math.abs(dy)>30&&!player._quakeStunned){
    // Swipe: flip gravity to the swiped direction (only if canFlip)
    if(player.canFlip&&dy>0&&player.gDir===-1){
      player.gDir=1;player.vy=2;totalFlips++;flipCount++;flipTimer=0;
      player.canFlip=flipCount<ct().maxFlip;
      sfx('flip');vibrate(20);
      player.face='flip';setTimeout(()=>{if(player.alive)player.face='normal';},250);
      emitParts(player.x,player.y,10,tc('ply'),3,2.5);
      player.rotTarget+=Math.PI;
    } else if(player.canFlip&&dy<0&&player.gDir===1){
      player.gDir=-1;player.vy=-2;totalFlips++;flipCount++;flipTimer=0;
      player.canFlip=flipCount<ct().maxFlip;
      sfx('flip');vibrate(20);
      player.face='flip';setTimeout(()=>{if(player.alive)player.face='normal';},250);
      emitParts(player.x,player.y,10,tc('ply'),3,2.5);
      player.rotTarget-=Math.PI;
    }
  } else if(!touchMoved||dt<200){
    // Tap: jump from current surface
    if(player.grounded){
      const jp=JUMP_POWER*ct().jumpMul;
      player.vy=-jp*player.gDir;
      player.grounded=false;
      djumpUsed=false;
      sfx('jump');vibrate(10);
      player.face='flip';setTimeout(()=>{if(player.alive)player.face='normal';},180);
      emitParts(player.x,player.y+PLAYER_R*player.gDir,6,tc('ply'),2.5,2);
    } else if(djumpAvailable&&!djumpUsed){
      djumpUsed=true;djumpAvailable=false;
      const jp=JUMP_POWER*ct().jumpMul*0.85;
      player.vy=-jp*player.gDir;
      sfx('jump');vibrate(10);
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
    if(hitResumeBtn(p.x,p.y)){sfx('select');state=ST.PLAY;switchBGM('play');return;}
    if(hitQuitBtn(p.x,p.y)){sfx('cancel');if(bossPhase.active&&!isRetryGame){bossRetry={score:bossPhase.lastBossScore,bossCount:bossPhase.bossCount-1};}state=ST.TITLE;isPackMode=false;switchBGM('title');return;}
    return;
  }
  if(state===ST.PLAY&&hitInvBtn(p.x,p.y)){useInvincible();return;}
  if(state===ST.PLAY&&hitBombBtn(p.x,p.y)){useBomb();return;}
  if(state===ST.PLAY&&hitPauseBtn(p.x,p.y)){sfx('pause');state=ST.PAUSE;return;}
  if(state===ST.TITLE){
    if(shopOpen){handleShopTouch(p.x,p.y);return;}
    if(cosmeticMenuOpen){handleCosmeticTouch(p.x,p.y);return;}
    if(inventoryOpen){
      const mW2=Math.min(300,W-24),mH2=Math.min(360,H-40);
      const mX2=(W-mW2)/2,mY2=(H-mH2)/2;
      const invClY=mY2+mH2-38;
      if(p.x>=W/2-50&&p.x<=W/2+50&&p.y>=invClY&&p.y<=invClY+30&&chestOpen.phase==='none'){
        inventoryOpen=false;sfx('cancel');return;
      }
      if((p.x<mX2||p.x>mX2+mW2||p.y<mY2||p.y>mY2+mH2)&&chestOpen.phase==='none'){
        inventoryOpen=false;sfx('cancel');return;
      }
      handleInventoryChestTap(p.x,p.y);return;
    }
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
    if(hitDeadChestBtn(p.x,p.y)){deadChestOpen=true;chestBatchMode=false;startInventoryChestOpen();sfx('select');return;}
    const btnId=hitDeadBtn(p.x,p.y);
    if(btnId)handleDeadBtn(btnId);
  }
  // Left click during gameplay: gravity flip (toggle)
  else if(state===ST.PLAY&&player.canFlip&&!player._quakeStunned){
    flipCount++;flipTimer=0;
    if(player.gDir===1){player.gDir=-1;player.vy=-2;totalFlips++;player.canFlip=flipCount<ct().maxFlip;sfx('flip');vibrate(20);player.rotTarget-=Math.PI;emitParts(player.x,player.y,10,tc('ply'),3,2.5);}
    else{player.gDir=1;player.vy=2;totalFlips++;player.canFlip=flipCount<ct().maxFlip;sfx('flip');vibrate(20);player.rotTarget+=Math.PI;emitParts(player.x,player.y,10,tc('ply'),3,2.5);}
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
  if(helpOpen){if(e.code==='Escape'){helpOpen=false;sfx('cancel');}e.preventDefault();return;}
  if(rankingOpen){if(e.code==='Escape'){rankingOpen=false;sfx('cancel');}e.preventDefault();return;}
  if(settingsOpen){if(e.code==='Escape'){if(confirmModal){confirmModal=null;sfx('cancel');}else if(nameEditMode){nameEditMode=false;}else{settingsOpen=false;logoutConfirm=false;resetConfirmStep=0;}sfx('cancel');e.preventDefault();}if(!nameEditMode){e.preventDefault();}return;}
  if(e.code==='Escape'){
    e.preventDefault();
    if(state===ST.STAGE_SEL){sfx('cancel');titleTouchPos=null;state=ST.TITLE;isPackMode=false;switchBGM('title');return;}
    if(state===ST.PLAY){sfx('pause');state=ST.PAUSE;return;}
    if(state===ST.PAUSE){sfx('select');state=ST.PLAY;return;}
  }
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
      player.gDir=-1;player.vy=-8;sfx('flip');vibrate(20);player.rotTarget-=Math.PI;
      emitParts(player.x,player.y,10,tc('ply'),3,2.5);
      tutDone=true;tutPhase='action';
      setTimeout(()=>{tutPhase='success';tutSuccessT=0;setTimeout(tutAdvance,600);},700);return;
    }
    if(cp.type==='flip_down'&&e.code==='ArrowDown'&&player.gDir===-1){
      player.gDir=1;player.vy=8;sfx('flip');vibrate(20);player.rotTarget+=Math.PI;
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
    if(state===ST.PAUSE){sfx('select');state=ST.PLAY;switchBGM('play');return;}
    if(state===ST.TITLE){startCountdown('endless');}
    else if(state===ST.DEAD&&deadT>45){handleDeadBtn('restart');}
    else if(state===ST.PLAY&&player.grounded&&!player._quakeStunned){
      const jp=JUMP_POWER*ct().jumpMul;
      player.vy=-jp*player.gDir;player.grounded=false;djumpUsed=false;
      sfx('jump');vibrate(10);
      emitParts(player.x,player.y+PLAYER_R*player.gDir,6,tc('ply'),2.5,2);
    }
    else if(state===ST.PLAY&&djumpAvailable&&!djumpUsed&&!player._quakeStunned){
      djumpUsed=true;djumpAvailable=false;
      const jp=JUMP_POWER*ct().jumpMul*0.85;
      player.vy=-jp*player.gDir;
      sfx('jump');vibrate(10);
      emitParts(player.x,player.y,8,'#ffaa00',3,2.5);
    }
  }
  // ArrowUp: gravity flip to ceiling (gDir 1→-1)
  if(e.code==='ArrowUp'){
    e.preventDefault();
    if(state===ST.PLAY&&player.canFlip&&!player._quakeStunned&&player.gDir===1){
      flipCount++;flipTimer=0;
      player.gDir=-1;player.vy=-2;totalFlips++;player.canFlip=flipCount<ct().maxFlip;sfx('flip');vibrate(20);player.rotTarget-=Math.PI;emitParts(player.x,player.y,10,tc('ply'),3,2.5);
    }
  }
  // ArrowDown: gravity flip to floor (gDir -1→1)
  if(e.code==='ArrowDown'){
    e.preventDefault();
    if(state===ST.PLAY&&player.canFlip&&!player._quakeStunned&&player.gDir===-1){
      flipCount++;flipTimer=0;
      player.gDir=1;player.vy=2;totalFlips++;player.canFlip=flipCount<ct().maxFlip;sfx('flip');vibrate(20);player.rotTarget+=Math.PI;emitParts(player.x,player.y,10,tc('ply'),3,2.5);
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
    rebuildRankingData();if(typeof fbRefreshRankings==='function')fbRefreshRankings();rankingOpen=true;rankingScroll=0;rankingScrollTarget=0;sfx('select');return;
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
    cosmeticMenuOpen=true;cosmeticTab=0;cosmeticScroll=0;
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
          sfxCharVoice(idx);vibrate(10);
        } else {
          // Locked: show hint to get from chest
          sfx('hurt');vibrate(15);
          addPop(cx+charW/2,cy,'宝箱で入手!','#ffd700');
        }
        return;
      }
    }
  }
  // Mode selection buttons (2 buttons: Endless, Stage)
  const btnW=W*0.35,btnH=38,btnGap=12;
  const totalBtnW=btnW*2+btnGap;
  const btnStartX=W/2-totalBtnW/2;
  const btnY=H*0.82;
  const ebx=btnStartX;
  const sbx=btnStartX+btnW+btnGap;
  // Endless mode button -> start countdown
  if(tx>=ebx&&tx<=ebx+btnW&&ty>=btnY&&ty<=btnY+btnH){
    startCountdown('endless');return;
  }
  // Stage mode button (disabled - coming soon)
  if(tx>=sbx&&tx<=sbx+btnW&&ty>=btnY&&ty<=btnY+btnH){
    sfx('cancel');vibrate(10);return;
  }
}
function handleRankingTouch(tx,ty){
  const mW=Math.min(340,W-16),topPad=safeTop+8;
  const mH=H-topPad-10;
  const mX=(W-mW)/2,mY=topPad;
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
    const topPad=safeTop+8,mH=H-topPad-10,hdrH=52,listH=mH-hdrH-50;
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
    const ownedList=[{id:''}].concat(allItems.filter(it=>ownsItem(it.id)));
    const mH2=Math.min(500,H-30),listH2=mH2-184,totalH2=ownedList.length*48;
    const maxS=Math.max(0,totalH2-listH2);
    cosmeticScroll=Math.max(0,Math.min(maxS,cosmeticScroll+e.deltaY*1.5));
  }
},{passive:false});

// ===== SHOP TOUCH HANDLING =====
function handleShopTouch(tx,ty){
  const mW=Math.min(320,W-16),mH=Math.min(500,H-30);
  const mX=(W-mW)/2,mY=(H-mH)/2;
  // Purchase animation playing - tap to dismiss
  if(shopPurchaseAnim){
    if(shopPurchaseAnim.t>30){shopPurchaseAnim=null;sfx('click');}
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
        // Auto-equip
        if(tab===0)equipSkin(item.id);
        else if(tab===1)equipEyes(item.id);
        else equipEffect(item.id);
        // Start gacha celebration
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
    // Block purchase of secret/rare items (gacha only)
    if(item.rarity==='rare'){
      sfx('hurt');vibrate(15);
      addPop(W/2,H/2,'\u30AC\u30C1\u30E3\u9650\u5B9A!','#a855f7');
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
  if(tx>=W/2-50&&tx<=W/2+50&&ty>=cosClY&&ty<=cosClY+30){cosmeticMenuOpen=false;sfx('cancel');return;}
  // Outside modal
  if(tx<mX||tx>mX+mW||ty<mY||ty>mY+mH){cosmeticMenuOpen=false;sfx('cancel');return;}
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
  const ownedList=[{id:'',name:'\u306A\u3057',desc:'\u30C7\u30D5\u30A9\u30EB\u30C8'}].concat(allItems.filter(it=>ownsItem(it.id)));
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
  const ownedList=[{id:'',name:'\u306A\u3057',desc:'\u30C7\u30D5\u30A9\u30EB\u30C8'}].concat(allItems.filter(it=>ownsItem(it.id)));
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
    nameError.textContent='この名前は使用できません';
    sfx('hurt');vibrate(10);return;
  }
  nameError.textContent='';
  loginBtn.disabled=true;
  // If already signed in with Google, try to migrate existing data by name
  if(fbUser&&!fbUser.isAnonymous){
    fbFindAndMigrateByName(name).then(migrated=>{
      if(migrated){
        // Found and migrated old data to Google UID
        fbMergeCloudData(migrated);
        fbSynced=true;
        loginOverlay.classList.remove('active');
        sfx('select');vibrate(15);
        if(!tutorialDone){startTutorial();}
        else{state=ST.TITLE;switchBGM('title');}
      } else {
        // No existing data with this name – create new
        fbSynced=true;
        _finishLogin(name);
      }
    }).finally(()=>{loginBtn.disabled=false;});
    return;
  }
  // Guest login – check name uniqueness
  fbCheckNameExists(name).then(taken=>{
    if(taken){
      nameError.textContent='この名前は使われています';
      sfx('hurt');vibrate(10);
      loginBtn.disabled=false;
      return;
    }
    fbSignInAnonymous().then(()=>{
      _finishLogin(name);
    }).catch(()=>{
      _finishLogin(name);
    }).finally(()=>{loginBtn.disabled=false;});
  });
});
// Google Sign-In
const googleBtn=document.getElementById('googleBtn');
if(googleBtn){
  googleBtn.addEventListener('click',()=>{
    initAudio();
    googleBtn.disabled=true;
    _fbGoogleLoginInProgress=true;
    fbSignInGoogle().then(cred=>{
      const user=cred.user;
      fbUser=user;
      // Step 1: Check if this Google UID already has data
      return fbLoadUserData(user.uid).then(data=>{
        if(data&&data.name){
          // Returning Google user – restore
          fbMergeCloudData(data);
          fbSynced=true;
          _fbGoogleLoginInProgress=false;
          fbSaveUserData(); // update ranking with current cosmetics
          loginOverlay.classList.remove('active');
          sfx('select');vibrate(15);
          if(!tutorialDone){startTutorial();}
          else{state=ST.TITLE;switchBGM('title');}
          return;
        }
        // Step 2: No data under Google UID – try local name
        const localName=playerName||localStorage.getItem('gd5username')||'';
        if(localName){
          return fbFindAndMigrateByName(localName).then(migrated=>{
            if(migrated&&migrated.name){
              fbMergeCloudData(migrated);
              fbSynced=true;
              _fbGoogleLoginInProgress=false;
              fbSaveUserData(); // update ranking with current cosmetics
              loginOverlay.classList.remove('active');
              sfx('select');vibrate(15);
              if(!tutorialDone){startTutorial();}
              else{state=ST.TITLE;switchBGM('title');}
            } else {
              // Local name exists but no cloud data – keep name, save to Google UID
              fbSynced=true;
              _fbGoogleLoginInProgress=false;
              _finishLogin(localName);
            }
          });
        }
        // Step 3: Completely new – show name input
        _fbGoogleLoginInProgress=false;
        fbSynced=true;
        nameInput.focus();
      });
    }).catch(e=>{
      console.warn('[Firebase] Google sign-in error:',e);
      _fbGoogleLoginInProgress=false;
      sfx('hurt');vibrate(10);
    }).finally(()=>{googleBtn.disabled=false;});
  });
}
// Twitter Sign-In
const twitterBtn=document.getElementById('twitterBtn');
if(twitterBtn){
  twitterBtn.addEventListener('click',()=>{
    initAudio();
    twitterBtn.disabled=true;
    _fbGoogleLoginInProgress=true;
    fbSignInTwitter().then(cred=>{
      const user=cred.user;
      fbUser=user;
      return fbLoadUserData(user.uid).then(data=>{
        if(data&&data.name){
          fbMergeCloudData(data);
          fbSynced=true;
          _fbGoogleLoginInProgress=false;
          fbSaveUserData();
          loginOverlay.classList.remove('active');
          sfx('select');vibrate(15);
          if(!tutorialDone){startTutorial();}
          else{state=ST.TITLE;switchBGM('title');}
          return;
        }
        const localName=playerName||localStorage.getItem('gd5username')||'';
        if(localName){
          return fbFindAndMigrateByName(localName).then(migrated=>{
            if(migrated&&migrated.name){
              fbMergeCloudData(migrated);
              fbSynced=true;
              _fbGoogleLoginInProgress=false;
              fbSaveUserData();
              loginOverlay.classList.remove('active');
              sfx('select');vibrate(15);
              if(!tutorialDone){startTutorial();}
              else{state=ST.TITLE;switchBGM('title');}
            } else {
              fbSynced=true;
              _fbGoogleLoginInProgress=false;
              _finishLogin(localName);
            }
          });
        }
        _fbGoogleLoginInProgress=false;
        fbSynced=true;
        nameInput.focus();
      });
    }).catch(e=>{
      console.warn('[Firebase] Twitter sign-in error:',e);
      _fbGoogleLoginInProgress=false;
      sfx('hurt');vibrate(10);
    }).finally(()=>{twitterBtn.disabled=false;});
  });
}
// Auto-login for returning Firebase users (check on page load)
fbOnReady(user=>{
  if(user&&!playerName){
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
  {dist:160,type:'jump',msg:'障害物をジャンプで\n飛び越えよう！',sub:'画面をタップ！',icon:'tap'},
  {dist:430,type:'flip_up',msg:'奈落だ！重力反転で\n天井へ避難！',sub:'上にスワイプ！',icon:'swipe_up'},
  {dist:700,type:'flip_down',msg:'天井が途切れる！\n地面に戻ろう！',sub:'下にスワイプ！',icon:'swipe_down'},
  {dist:980,type:'double_flip',msg:'空中で重力を\n切り替えよう！',sub:'↑ 上にスワイプ！',icon:'double'},
  {dist:1300,type:'bomb',msg:'ボムで敵を\n一掃しよう！',sub:'ボムボタンをタップ！',icon:'bomb'},
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
  tutWarpT=0;tutWarpPhase='';tutFreezePlayer=false;
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
