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
    if(debugBossRetry&&debugLastBossType){
      // Debug: restart boss fight directly
      gameMode='endless';isPackMode=false;reset();
      state=ST.PLAY;switchBGM('play');
      bossPhase.bossCount=Math.max(0,debugBossBc-1);
      bossPhase._forceType=debugLastBossType;
      startBossPhase();bossPhase.prepare=1;
      return;
    }
    if(debugEnemyMode&&debugEnemyType>=0){
      // Debug: restart enemy test directly
      gameMode='endless';isPackMode=false;reset();
      state=ST.PLAY;switchBGM('play');
      debugEnemyCD=0;
      return;
    }
    startCountdown('endless');
  } else if(btnId==='title'){
    sfx('cancel');titleTouchPos=null; // prevent stale touch from triggering title actions
    debugBossRetry=false;debugEnemyMode=false;debugEnemyType=-1;
    if(isPackMode){state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;switchBGM('title');}
    else{state=ST.TITLE;switchBGM('title');}
  }
}
function handleInventoryChestTap(tapX,tapY){
  if(!inventoryOpen&&!deadChestOpen)return false;
  // Check for batch open button tap (only in inventory, phase=none, 2+ chests)
  if(chestOpen.phase==='none'&&storedChests>=2&&tapX!==undefined){
    const cx=W/2,mW2=Math.min(300,W-24),mH2=Math.min(400,H-40);
    const mY2=(H-mH2)/2,cy=mY2+mH2*0.42;
    const boW=160,boH=34,boX=cx-boW/2,boY=cy+82;
    if(tapX>=boX&&tapX<=boX+boW&&tapY>=boY&&tapY<=boY+boH){
      // Start batch mode
      chestBatchMode=true;chestBatchResults=[];
      startInventoryChestOpen();
      sfx('select');vibrate(15);
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
    }
    sfx('click');
    return true;
  }
  if(chestOpen.phase==='batchDone'){
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
  // Character: 12%, Secret cosmetic (rare): 10%, Normal cosmetic: 15%,
  // 1000 coins: 5%, 200 coins: 13%, 100 coins: 20%, 60 coins: 25%
  const roll=Math.random();
  let reward;
  if(roll<0.12){
    // Character (12%)
    const ci=Math.floor(Math.random()*CHARS.length);
    reward={type:'char',charIdx:ci,isNew:!isCharUnlocked(ci),bonusCoins:0};
  } else if(roll<0.22){
    // Secret (rare) cosmetic item (10%)
    const allRare=[];
    SHOP_ITEMS.skins.forEach(it=>{if(it.rarity==='rare')allRare.push({...it,tab:0});});
    SHOP_ITEMS.eyes.forEach(it=>{if(it.rarity==='rare')allRare.push({...it,tab:1});});
    SHOP_ITEMS.effects.forEach(it=>{if(it.rarity==='rare')allRare.push({...it,tab:2});});
    const unownedRare=allRare.filter(it=>!ownsItem(it.id));
    if(unownedRare.length>0){
      const ri=unownedRare[Math.floor(Math.random()*unownedRare.length)];
      ownedItems.push(ri.id);localStorage.setItem('gd5owned',JSON.stringify(ownedItems));
      reward={type:'cosmetic',item:ri,isNew:true};
    } else {
      reward={type:'coin',amount:1000};
    }
  } else if(roll<0.37){
    // Normal cosmetic item (15%)
    const allNormal=[];
    SHOP_ITEMS.skins.forEach(it=>{if(it.rarity!=='rare')allNormal.push({...it,tab:0});});
    SHOP_ITEMS.eyes.forEach(it=>{if(it.rarity!=='rare')allNormal.push({...it,tab:1});});
    SHOP_ITEMS.effects.forEach(it=>{if(it.rarity!=='rare')allNormal.push({...it,tab:2});});
    const unownedNormal=allNormal.filter(it=>!ownsItem(it.id));
    if(unownedNormal.length>0){
      const ni=unownedNormal[Math.floor(Math.random()*unownedNormal.length)];
      ownedItems.push(ni.id);localStorage.setItem('gd5owned',JSON.stringify(ownedItems));
      reward={type:'cosmetic',item:ni,isNew:true};
    } else {
      reward={type:'coin',amount:200};
    }
  } else if(roll<0.42){reward={type:'coin',amount:1000};}
  else if(roll<0.55){reward={type:'coin',amount:200};}
  else if(roll<0.75){reward={type:'coin',amount:100};}
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

// Settings panel input helpers (must match drawTitle layout)
function settingsLayout(){
  const pw=Math.min(280,W-30),ph=330,px=W/2-pw/2,py=H/2-ph/2;
  const slW=pw-50,slX=px+25,barX=slX+42,barW=slW-42;
  const slY1=py+52,slY2=slY1+44;
  const barH=10;
  const tutBtnY=slY2+44;
  const resetBtnY=tutBtnY+38;
  return{px,py,pw,ph,barX,barW,barY1:slY1-8,barY2:slY2-8,barH,tutBtnY,resetBtnY,closeY:py+ph-42};
}
function hitSettingsGear(tx,ty){return tx>=W-44&&tx<=W-8&&ty>=safeTop+6&&ty<=safeTop+42;}
function handleSettingsTouch(tx,ty){
  const s=settingsLayout();
  // Close button
  if(tx>=W/2-60&&tx<=W/2+60&&ty>=s.closeY&&ty<=s.closeY+32){sfx('click');settingsOpen=false;resetConfirmStep=0;return true;}
  // Tutorial replay button
  if(tx>=s.px+20&&tx<=s.px+s.pw-20&&ty>=s.tutBtnY&&ty<=s.tutBtnY+30){
    sfx('select');settingsOpen=false;resetConfirmStep=0;startTutorial();return true;
  }
  // Data reset button
  if(tx>=s.px+20&&tx<=s.px+s.pw-20&&ty>=s.resetBtnY&&ty<=s.resetBtnY+30){
    if(resetConfirmStep===0){
      resetConfirmStep=1;sfx('hurt');vibrate(20);return true;
    } else if(resetConfirmStep===1){
      resetConfirmStep=2;sfx('hurt');vibrate(30);return true;
    } else if(resetConfirmStep===2){
      // Clear all game data (local + cloud)
      const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('gd5'))keys.push(k);}
      keys.forEach(k=>localStorage.removeItem(k));
      sfx('bomb');vibrate(50);
      resetConfirmStep=0;settingsOpen=false;
      if(typeof fbDeleteUserData==='function'){fbDeleteUserData().finally(()=>location.reload());}
      else{location.reload();}
      return true;
    }
  }
  // BGM slider
  if(ty>=s.barY1-10&&ty<=s.barY1+s.barH+10&&tx>=s.barX-10&&tx<=s.barX+s.barW+10){
    draggingSlider='bgm';updateSliderDrag(tx);return true;
  }
  // SFX slider
  if(ty>=s.barY2-10&&ty<=s.barY2+s.barH+10&&tx>=s.barX-10&&tx<=s.barX+s.barW+10){
    draggingSlider='sfx';updateSliderDrag(tx);return true;
  }
  return false;
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
  // Debug boss victory overlay
  if(debugBossVictoryT>30){
    const bw=160,bh=40,bx=W/2-bw/2;
    const retryY=H*0.50,homeY=H*0.60;
    if(p.x>=bx&&p.x<=bx+bw&&p.y>=retryY&&p.y<=retryY+bh){
      // Retry boss
      sfx('click');debugBossVictoryT=0;
      gameMode='endless';isPackMode=false;reset();
      state=ST.PLAY;switchBGM('play');
      bossPhase.bossCount=Math.max(0,debugBossBc-1);
      bossPhase._forceType=debugLastBossType;
      startBossPhase();bossPhase.prepare=1;
      return;
    }
    if(p.x>=bx&&p.x<=bx+bw&&p.y>=homeY&&p.y<=homeY+bh){
      // Go home
      sfx('cancel');debugBossVictoryT=0;
      debugBossRetry=false;debugEnemyMode=false;debugEnemyType=-1;
      state=ST.TITLE;switchBGM('title');
      return;
    }
    return; // block other input while victory overlay is shown
  }
  // Ranking modal intercepts all input when open
  if(rankingOpen){handleRankingTouch(p.x,p.y);return;}
  // Debug menu intercepts all input when open
  if(debugMenuOpen){handleDebugTouch(p.x,p.y);return;}
  // Settings panel intercepts all input when open
  if(settingsOpen){handleSettingsTouch(p.x,p.y);return;}
  if(state===ST.COUNTDOWN)return; // block input during countdown
  // Login screen
  if(state===ST.LOGIN){handleLoginTouch(p.x,p.y);return;}
  // Tutorial
  if(state===ST.TUTORIAL){handleTutorialTouch(p.x,p.y);return;}
  // Settings gear button on title screen
  if(state===ST.TITLE&&!charModal.show&&hitSettingsGear(p.x,p.y)){sfx('click');settingsOpen=true;return;}
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
  if(settingsOpen||rankingOpen||inventoryOpen)return;
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
canvas.addEventListener('mousedown',e=>{
  initAudio();
  const p=canvasXY(e.clientX,e.clientY);
  if(rankingOpen){handleRankingTouch(p.x,p.y);return;}
  if(debugMenuOpen){handleDebugTouch(p.x,p.y);return;}
  if(settingsOpen){handleSettingsTouch(p.x,p.y);return;}
  if(state===ST.COUNTDOWN)return;
  if(state===ST.LOGIN){handleLoginTouch(p.x,p.y);return;}
  if(state===ST.TUTORIAL){handleTutorialTouch(p.x,p.y);return;}
  if(state===ST.TITLE&&!charModal.show&&hitSettingsGear(p.x,p.y)){sfx('click');settingsOpen=true;return;}
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
    if(charModal.show){sfx('cancel');charModal.show=false;return;}handleTitleTouch(p.x,p.y);
  }
  else if(state===ST.DEAD&&deadChestOpen){
    handleInventoryChestTap(p.x,p.y);
  }
  else if(state===ST.DEAD&&deadT>45){
    if(hitDeadChestBtn(p.x,p.y)){deadChestOpen=true;chestBatchMode=false;startInventoryChestOpen();sfx('select');return;}
    const btnId=hitDeadBtn(p.x,p.y);
    if(btnId)handleDeadBtn(btnId);
  }
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
});
canvas.addEventListener('mousemove',e=>{
  if(draggingSlider){const p=canvasXY(e.clientX,e.clientY);updateSliderDrag(p.x);}
});
canvas.addEventListener('mouseup',()=>{
  if(draggingSlider==='sfx')sfx('coin');
  draggingSlider=null;
});
document.addEventListener('keydown',e=>{
  if(rankingOpen){if(e.code==='Escape'){rankingOpen=false;sfx('cancel');}e.preventDefault();return;}
  if(debugMenuOpen){if(e.code==='Escape'){debugMenuOpen=false;sfx('cancel');}e.preventDefault();return;}
  if(settingsOpen){if(e.code==='Escape'){settingsOpen=false;sfx('cancel');}e.preventDefault();return;}
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
    if(cp.type==='jump'&&(e.code==='Space'||e.code==='ArrowUp')&&player.grounded){
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
  if(e.code==='Space'||e.code==='ArrowUp'){
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
  if(e.code==='ArrowDown'&&state===ST.PLAY&&player.canFlip&&!player._quakeStunned){
    e.preventDefault();
    flipCount++;flipTimer=0;
    if(player.gDir===1){player.gDir=-1;player.vy=-2;totalFlips++;player.canFlip=flipCount<ct().maxFlip;sfx('flip');vibrate(20);player.rotTarget-=Math.PI;emitParts(player.x,player.y,10,tc('ply'),3,2.5);}
    else{player.gDir=1;player.vy=2;totalFlips++;player.canFlip=flipCount<ct().maxFlip;sfx('flip');vibrate(20);player.rotTarget+=Math.PI;emitParts(player.x,player.y,10,tc('ply'),3,2.5);}
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
  // Debug button (top right, left of settings gear)
  if(tx>=W-84&&tx<=W-48&&ty>=safeTop+6&&ty<=safeTop+42){
    debugMenuOpen=true;sfx('select');return;
  }
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
function handleDebugTouch(tx,ty){
  const bcBtnW=36,bcBtnH=26;
  const bcY=safeTop+60;
  // - button
  if(tx>=W/2-60&&tx<=W/2-60+bcBtnW&&ty>=bcY&&ty<=bcY+bcBtnH){
    debugBossBc=Math.max(1,debugBossBc-1);sfx('click');return;
  }
  // + button
  if(tx>=W/2+24&&tx<=W/2+24+bcBtnW&&ty>=bcY&&ty<=bcY+bcBtnH){
    debugBossBc=Math.min(10,debugBossBc+1);sfx('click');return;
  }
  // Boss buttons
  const bosses=['guardian','bruiser','wizard','dodge'];
  const bbW=Math.min(180,W-40),bbH=32,bbGap=5;
  const bbX=W/2-bbW/2;
  let bbY=bcY+bcBtnH+22;
  for(let i=0;i<bosses.length;i++){
    if(tx>=bbX&&tx<=bbX+bbW&&ty>=bbY&&ty<=bbY+bbH){
      debugMenuOpen=false;debugEnemyMode=false;debugEnemyType=-1;
      debugBossRetry=true;debugLastBossType=bosses[i];
      sfx('select');
      window.testBoss(bosses[i],debugBossBc);
      return;
    }
    bbY+=bbH+bbGap;
  }
  // Enemy buttons (driven by DEBUG_ENEMY_TYPES from data.js)
  bbY+=14;
  for(let i=0;i<DEBUG_ENEMY_TYPES.length;i++){
    if(tx>=bbX&&tx<=bbX+bbW&&ty>=bbY&&ty<=bbY+bbH){
      debugMenuOpen=false;debugBossRetry=false;
      debugEnemyMode=true;debugEnemyType=DEBUG_ENEMY_TYPES[i].id;debugEnemyCD=0;
      sfx('select');
      window.testEnemy(DEBUG_ENEMY_TYPES[i].id);
      return;
    }
    bbY+=bbH+bbGap;
  }
  // Close button
  const clY=bbY+6;
  if(tx>=W/2-50&&tx<=W/2+50&&ty>=clY&&ty<=clY+30){
    debugMenuOpen=false;sfx('cancel');return;
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
});
// Helper: finish login and enter the game
function _finishLogin(name){
  playerName=name;localStorage.setItem('gd5username',playerName);
  loginOverlay.classList.remove('active');
  sfx('select');vibrate(15);
  fbSaveUserData();
  if(!tutorialDone){startTutorial();}
  else{state=ST.TITLE;switchBGM('title');}
}
// Guest login (anonymous auth + username)
loginBtn.addEventListener('click',()=>{
  initAudio();
  const name=(nameInput.value||'').trim();
  if(name.length<1){sfx('hurt');vibrate(10);return;}
  loginBtn.disabled=true;
  fbSignInAnonymous().then(()=>{
    _finishLogin(name);
  }).catch(()=>{
    // Firebase unavailable – continue with local-only
    _finishLogin(name);
  }).finally(()=>{loginBtn.disabled=false;});
});
// Google Sign-In
const googleBtn=document.getElementById('googleBtn');
if(googleBtn){
  googleBtn.addEventListener('click',()=>{
    initAudio();
    googleBtn.disabled=true;
    fbSignInGoogle().then(cred=>{
      const user=cred.user;
      // Load cloud data to check for existing name
      return fbLoadUserData().then(data=>{
        if(data&&data.name){
          // Returning user – restore all data
          fbMergeCloudData(data);
          loginOverlay.classList.remove('active');
          sfx('select');vibrate(15);
          if(!tutorialDone){startTutorial();}
          else{state=ST.TITLE;switchBGM('title');}
        } else {
          // New Google user – use Google display name or ask
          const gName=(user.displayName||'').replace(/[<>&"']/g,'').substring(0,12).trim();
          if(gName){
            _finishLogin(gName);
          } else {
            // No display name – let them type one
            nameInput.focus();
          }
        }
      });
    }).catch(e=>{
      console.warn('[Firebase] Google sign-in error:',e);
      sfx('hurt');vibrate(10);
    }).finally(()=>{googleBtn.disabled=false;});
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
