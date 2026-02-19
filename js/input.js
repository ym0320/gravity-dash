'use strict';
let touchStartY=0,touchStartX=0,touchStartT=0,touchMoved=false;
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
  const cardY=H*0.24,cardH=210;
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
function hitDeadBtn(px,py){
  const btns=deadBtnLayout();
  for(const b of btns){
    if(px>=b.x&&px<=b.x+b.w&&py>=b.y&&py<=b.y+b.h)return b.id;
  }
  return null;
}
function handleDeadBtn(btnId){
  if(btnId==='continue'){
    if(walletCoins>=100){
      walletCoins-=100;localStorage.setItem('gd5wallet',walletCoins.toString());
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
function handleChestTap(){
  if(bossChests<=0||chestOpen.phase==='none')return false;
  if(chestOpen.phase==='waiting'){
    // Start opening animation
    chestOpen.phase='wobble';chestOpen.t=0;sfx('select');vibrate(15);
    return true;
  }
  if(chestOpen.phase==='done'){
    // Close chest display, decrement chests
    bossChests--;
    if(bossChests>0){
      // More chests to open
      chestOpen.phase='waiting';chestOpen.t=0;
      chestOpen.charIdx=Math.floor(Math.random()*CHARS.length);
      chestOpen.parts=[];
    } else {
      chestOpen.phase='none';chestOpen.t=0;chestOpen.parts=[];
    }
    sfx('click');
    return true;
  }
  // During wobble/burst/reveal, tap does nothing (let animation play)
  return true;
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
  deadT=0;newHi=false;combo=0;comboT=0;comboDsp=0;comboDspT=0;airCombo=0;
  shakeX=0;shakeY=0;shakeI=0;flipCount=0;flipTimer=999;
  coinCD=0;itemCD=0;enemyCD=0;spikeCD=0;hillCD=0;floatCD=0;gravZoneCD=0;
  flipZone={active:false,type:0,len:0,cd:0,lastType:-1};
  bossChests=0;chestFall={active:false,x:0,y:0,vy:0,sparkT:0,gotT:0};chestOpen={phase:'none',t:0,charIdx:-1,parts:[]};
  state=ST.COUNTDOWN;countdownT=180;
  sfx('countdown');
}
function startPackStageFromDead(){
  state=ST.PLAY;resetPackStage(currentPackIdx,currentPackStageIdx);switchBGM('play');
}

// Settings panel input helpers (must match drawTitle layout)
function settingsLayout(){
  const pw=Math.min(280,W-30),ph=200,px=W/2-pw/2,py=H/2-ph/2;
  const slW=pw-50,slX=px+25,barX=slX+42,barW=slW-42;
  const slY1=py+52,slY2=slY1+44;
  const barH=10;
  return{px,py,pw,ph,barX,barW,barY1:slY1-8,barY2:slY2-8,barH,closeY:py+ph-42};
}
function hitSettingsGear(tx,ty){return tx>=W-44&&tx<=W-8&&ty>=safeTop+6&&ty<=safeTop+42;}
function handleSettingsTouch(tx,ty){
  const s=settingsLayout();
  // Close button
  if(tx>=W/2-60&&tx<=W/2+60&&ty>=s.closeY&&ty<=s.closeY+32){sfx('click');settingsOpen=false;return true;}
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
    // Page visible again: restart BGM silently (no sfx)
    if(bgmBeforePause)switchBGM(bgmBeforePause);
    bgmBeforePause='';
  }
});
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
  touchStartY=t.clientY;touchStartX=t.clientX;touchStartT=Date.now();touchMoved=false;
  // Settings panel intercepts all input when open
  if(settingsOpen){handleSettingsTouch(p.x,p.y);return;}
  if(state===ST.COUNTDOWN)return; // block input during countdown
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
  if(state===ST.PLAY&&hitInvBtn(p.x,p.y)){useInvincible();return;}
  if(state===ST.PLAY&&hitBombBtn(p.x,p.y)){useBomb();return;}
  if(state===ST.PLAY&&hitPauseBtn(p.x,p.y)){sfx('pause');state=ST.PAUSE;return;}
  if(state===ST.TITLE){
    if(charModal.show){sfx('cancel');charModal.show=false;return;}
    longPressFired=false;titleTouchPos=p;
    const cidx=getCharGridIdx(p.x,p.y);
    if(cidx>=0&&isCharUnlocked(cidx)){
      longPressTimer=setTimeout(()=>{longPressFired=true;charModal={show:true,idx:cidx,animT:0};vibrate(15);sfxCharVoice(cidx);},400);
    } else if(cidx>=0){
    } else {
      handleTitleTouch(p.x,p.y);
    }
  }
  else if(state===ST.DEAD&&deadT>45){
    if(handleChestTap())return;
    const btnId=hitDeadBtn(p.x,p.y);
    if(btnId)handleDeadBtn(btnId);
  }
},{passive:false});

canvas.addEventListener('touchmove',e=>{
  e.preventDefault();
  const t=e.touches[0];
  // Settings slider drag
  if(settingsOpen&&draggingSlider){const mp=canvasXY(t.clientX,t.clientY);updateSliderDrag(mp.x);return;}
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
  if(settingsOpen)return;
  if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null;}
  if(state===ST.TITLE&&!longPressFired&&titleTouchPos){handleTitleTouch(titleTouchPos.x,titleTouchPos.y);titleTouchPos=null;return;}
  if(state!==ST.PLAY||state===ST.PAUSE)return;
  const dt=Date.now()-touchStartT;
  const t=e.changedTouches[0];
  const dy=t.clientY-touchStartY;

  if(touchMoved&&Math.abs(dy)>30){
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
  if(settingsOpen){handleSettingsTouch(p.x,p.y);return;}
  if(state===ST.COUNTDOWN)return;
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
  if(state===ST.TITLE){if(charModal.show){sfx('cancel');charModal.show=false;return;}handleTitleTouch(p.x,p.y);}
  else if(state===ST.DEAD&&deadT>45){
    if(handleChestTap())return;
    const btnId=hitDeadBtn(p.x,p.y);
    if(btnId)handleDeadBtn(btnId);
  }
  else if(state===ST.PLAY&&player.grounded){
    const jp=JUMP_POWER*ct().jumpMul;
    player.vy=-jp*player.gDir;player.grounded=false;djumpUsed=false;
    sfx('jump');vibrate(10);
    emitParts(player.x,player.y+PLAYER_R*player.gDir,6,tc('ply'),2.5,2);
  }
  else if(state===ST.PLAY&&djumpAvailable&&!djumpUsed){
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
  if(settingsOpen){if(e.code==='Escape'){settingsOpen=false;sfx('cancel');}e.preventDefault();return;}
  if(e.code==='Escape'){
    e.preventDefault();
    if(state===ST.STAGE_SEL){sfx('cancel');titleTouchPos=null;state=ST.TITLE;isPackMode=false;switchBGM('title');return;}
    if(state===ST.PLAY){sfx('pause');state=ST.PAUSE;return;}
    if(state===ST.PAUSE){sfx('select');state=ST.PLAY;return;}
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
    else if(state===ST.DEAD&&deadT>45){if(!handleChestTap())handleDeadBtn('restart');}
    else if(state===ST.PLAY&&player.grounded){
      const jp=JUMP_POWER*ct().jumpMul;
      player.vy=-jp*player.gDir;player.grounded=false;djumpUsed=false;
      sfx('jump');vibrate(10);
      emitParts(player.x,player.y+PLAYER_R*player.gDir,6,tc('ply'),2.5,2);
    }
    else if(state===ST.PLAY&&djumpAvailable&&!djumpUsed){
      djumpUsed=true;djumpAvailable=false;
      const jp=JUMP_POWER*ct().jumpMul*0.85;
      player.vy=-jp*player.gDir;
      sfx('jump');vibrate(10);
      emitParts(player.x,player.y,8,'#ffaa00',3,2.5);
    }
  }
  if(e.code==='ArrowDown'&&state===ST.PLAY&&player.canFlip){
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
          buyChar(idx);
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
  // Stage mode button -> go to stage selection screen
  if(tx>=sbx&&tx<=sbx+btnW&&ty>=btnY&&ty<=btnY+btnH){
    sfx('select');gameMode='stage';state=ST.STAGE_SEL;stageSelScroll=0;stageSelTarget=0;titleTouchPos=null;return;
  }
}
