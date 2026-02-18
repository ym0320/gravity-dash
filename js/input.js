'use strict';
let touchStartY=0,touchStartX=0,touchStartT=0,touchMoved=false;
// Character modal (long-press on title to show details + animated demo)
let charModal={show:false,idx:0,animT:0};
let longPressTimer=null,longPressFired=false,titleTouchPos=null;

function canvasXY(cx,cy){
  const r=canvas.getBoundingClientRect();
  return{x:cx-r.left,y:cy-r.top};
}

// Pause button hit test (moved lower, larger area for reliability)
function hitPauseBtn(px,py){return px>=W-58&&px<=W-4&&py>=safeTop+8&&py<=safeTop+52;}
function hitBombBtn(px,py){const btnSz=44,btnX=W-btnSz-8,btnY=H-PANEL_H+6;return px>=btnX&&px<=btnX+btnSz&&py>=btnY&&py<=btnY+btnSz;}
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
    sfx('cancel');
    if(isPackMode){state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;switchBGM('title');}
    else{state=ST.TITLE;switchBGM('title');}
  }
}
function continueFromDeath(){
  // Keep score, reset speed, revive player, start with countdown
  player.alive=true;player.face='normal';
  player.gDir=1;player.vy=0;player.canFlip=true;
  player.rot=0;player.rotTarget=0;player.trail=[];
  hp=HP_MAX+(ct().hpBonus||0);hurtT=0;
  speed=SPEED_INIT; // reset speed
  // Rebuild safe platforms around player
  platforms=[];ceilPlats=[];
  platforms.push({x:player.x-W*0.3,w:W*0.9,h:GROUND_H});
  ceilPlats.push({x:player.x-W*0.3,w:W*0.9,h:GROUND_H});
  for(let i=0;i<5;i++){generatePlatform(platforms,false);generatePlatform(ceilPlats,true);}
  player.x=W*0.2;
  player.y=floorSurfaceY(player.x)-PLAYER_R;player.grounded=false;
  // Clear hazards
  enemies=[];bullets=[];spikes=[];items=[];floatPlats=[];movingHills=[];gravZones=[];
  bossPhase={active:false,prepare:0,alertT:0,enemies:[],defeated:0,total:0,reward:false,rewardT:0,nextAt:score+800,lastBossScore:score,bossCount:bossPhase.bossCount||0};
  itemEff={invincible:0,magnet:0};bombCount=0;bombFlashT=0;
  djumpAvailable=!!ct().hasDjump;djumpUsed=false;ghostPhaseT=0;ghostInvis=false;
  deadT=0;newHi=false;combo=0;comboT=0;comboDsp=0;comboDspT=0;
  shakeX=0;shakeY=0;shakeI=0;flipCount=0;flipTimer=999;
  coinCD=0;itemCD=0;enemyCD=0;spikeCD=0;hillCD=0;floatCD=0;gravZoneCD=0;
  flipZone={active:false,type:0,len:0,cd:0,lastType:-1};
  state=ST.COUNTDOWN;countdownT=180;
  sfx('countdown');
}
function startPackStageFromDead(){
  state=ST.PLAY;resetPackStage(currentPackIdx,currentPackStageIdx);switchBGM('play');
}

// Auto-pause when page loses visibility or focus
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&state===ST.PLAY){state=ST.PAUSE;sfx('pause');}
});
window.addEventListener('blur',()=>{
  if(state===ST.PLAY){state=ST.PAUSE;sfx('pause');}
});

// Start countdown instead of immediately playing
function startCountdown(mode){
  gameMode=mode;isPackMode=false;reset();
  state=ST.COUNTDOWN;countdownT=180; // 3 seconds at 60fps
  sfx('countdown');
}

canvas.addEventListener('touchstart',e=>{
  e.preventDefault();initAudio();
  const t=e.touches[0];
  const p=canvasXY(t.clientX,t.clientY);
  touchStartY=t.clientY;touchStartX=t.clientX;touchStartT=Date.now();touchMoved=false;
  if(state===ST.COUNTDOWN)return; // block input during countdown
  if(state===ST.STAGE_SEL){stageSelTouchY=t.clientY;stageSelDragging=false;handleStageSelTouch(p.x,p.y);return;}
  if(state===ST.STAGE_CLEAR&&stageClearT>60){
    sfx('click');state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;switchBGM('title');return;
  }
  if(state===ST.PAUSE){
    if(hitResumeBtn(p.x,p.y)){sfx('select');state=ST.PLAY;switchBGM('play');return;}
    if(hitQuitBtn(p.x,p.y)){sfx('cancel');state=ST.TITLE;isPackMode=false;switchBGM('title');return;}
    return;
  }
  if(state===ST.PLAY&&hitBombBtn(p.x,p.y)){useBomb();return;}
  if(state===ST.PLAY&&hitPauseBtn(p.x,p.y)){sfx('pause');state=ST.PAUSE;return;}
  if(state===ST.TITLE){
    if(charModal.show){sfx('cancel');charModal.show=false;return;}
    longPressFired=false;titleTouchPos=p;
    const cidx=getCharGridIdx(p.x,p.y);
    if(cidx>=0&&isCharUnlocked(cidx)){
      longPressTimer=setTimeout(()=>{longPressFired=true;charModal={show:true,idx:cidx,animT:0};vibrate(15);sfx('select');},400);
    } else if(cidx>=0){
    } else {
      handleTitleTouch(p.x,p.y);
    }
  }
  else if(state===ST.DEAD&&deadT>45){
    const btnId=hitDeadBtn(p.x,p.y);
    if(btnId)handleDeadBtn(btnId);
  }
},{passive:false});

canvas.addEventListener('touchmove',e=>{
  e.preventDefault();
  const t=e.touches[0];
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
  if(state===ST.COUNTDOWN)return;
  if(state===ST.STAGE_SEL){handleStageSelTouch(p.x,p.y);return;}
  if(state===ST.STAGE_CLEAR&&stageClearT>60){
    sfx('click');state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;switchBGM('title');return;
  }
  if(state===ST.PAUSE){
    if(hitResumeBtn(p.x,p.y)){sfx('select');state=ST.PLAY;switchBGM('play');return;}
    if(hitQuitBtn(p.x,p.y)){sfx('cancel');state=ST.TITLE;isPackMode=false;switchBGM('title');return;}
    return;
  }
  if(state===ST.PLAY&&hitBombBtn(p.x,p.y)){useBomb();return;}
  if(state===ST.PLAY&&hitPauseBtn(p.x,p.y)){sfx('pause');state=ST.PAUSE;return;}
  if(state===ST.TITLE){if(charModal.show){sfx('cancel');charModal.show=false;return;}handleTitleTouch(p.x,p.y);}
  else if(state===ST.DEAD&&deadT>45){
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
document.addEventListener('keydown',e=>{
  if(e.code==='Escape'){
    e.preventDefault();
    if(state===ST.STAGE_SEL){sfx('cancel');state=ST.TITLE;isPackMode=false;switchBGM('title');return;}
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
    else if(state===ST.DEAD&&deadT>45){handleDeadBtn('restart');}
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
    sfx('select');gameMode='stage';state=ST.STAGE_SEL;stageSelScroll=0;stageSelTarget=0;return;
  }
}
