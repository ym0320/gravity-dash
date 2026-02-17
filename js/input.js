'use strict';
let touchStartY=0,touchStartX=0,touchStartT=0,touchMoved=false;
// Character modal (long-press on title to show details + animated demo)
let charModal={show:false,idx:0,animT:0};
let longPressTimer=null,longPressFired=false,titleTouchPos=null;

function canvasXY(cx,cy){
  const r=canvas.getBoundingClientRect();
  return{x:cx-r.left,y:cy-r.top};
}

// Pause button hit test (top-right corner)
function hitPauseBtn(px,py){return px>=W-52&&px<=W-8&&py>=42&&py<=78;}
function hitBombBtn(px,py){const btnSz=44,btnX=W-btnSz-8,btnY=H-PANEL_H+6;return px>=btnX&&px<=btnX+btnSz&&py>=btnY&&py<=btnY+btnSz;}
function hitResumeBtn(px,py){return px>=W/2-80&&px<=W/2+80&&py>=H*0.45&&py<=H*0.45+44;}
function hitQuitBtn(px,py){return px>=W/2-80&&px<=W/2+80&&py>=H*0.56&&py<=H*0.56+44;}

canvas.addEventListener('touchstart',e=>{
  e.preventDefault();initAudio();
  const t=e.touches[0];
  const p=canvasXY(t.clientX,t.clientY);
  touchStartY=t.clientY;touchStartX=t.clientX;touchStartT=Date.now();touchMoved=false;
  if(state===ST.STAGE_SEL){stageSelTouchY=t.clientY;stageSelDragging=false;handleStageSelTouch(p.x,p.y);return;}
  if(state===ST.STAGE_CLEAR&&stageClearT>60){
    state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;switchBGM('title');return;
  }
  if(state===ST.PAUSE){
    if(hitResumeBtn(p.x,p.y)){state=ST.PLAY;switchBGM('play');return;}
    if(hitQuitBtn(p.x,p.y)){state=ST.TITLE;isPackMode=false;switchBGM('title');return;}
    return;
  }
  if(state===ST.PLAY&&hitBombBtn(p.x,p.y)){useBomb();return;}
  if(state===ST.PLAY&&hitPauseBtn(p.x,p.y)){state=ST.PAUSE;return;}
  if(state===ST.TITLE){
    if(charModal.show){charModal.show=false;return;}
    longPressFired=false;titleTouchPos=p;
    const cidx=getCharGridIdx(p.x,p.y);
    if(cidx>=0&&isCharUnlocked(cidx)){
      longPressTimer=setTimeout(()=>{longPressFired=true;charModal={show:true,idx:cidx,animT:0};vibrate(15);},400);
    } else if(cidx>=0){
    } else {
      handleTitleTouch(p.x,p.y);
    }
  }
  else if(state===ST.DEAD&&deadT>45){
    if(isPackMode){state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;switchBGM('title');return;}
    state=ST.TITLE;switchBGM('title');
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
      // Swipe down & currently on ceiling -> flip to floor
      player.gDir=1;player.vy=2;totalFlips++;flipCount++;flipTimer=0;
      player.canFlip=flipCount<ct().maxFlip;
      sfx('flip');vibrate(20);
      player.face='flip';setTimeout(()=>{if(player.alive)player.face='normal';},250);
      emitParts(player.x,player.y,10,tc('ply'),3,2.5);
      player.rotTarget+=Math.PI;
    } else if(player.canFlip&&dy<0&&player.gDir===1){
      // Swipe up & currently on floor -> flip to ceiling
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
      // Double jump from item (one-time use)
      djumpUsed=true;djumpAvailable=false;
      const jp=JUMP_POWER*ct().jumpMul*0.85;
      player.vy=-jp*player.gDir;
      sfx('jump');vibrate(10);
      player.face='flip';setTimeout(()=>{if(player.alive)player.face='normal';},180);
      emitParts(player.x,player.y,8,'#ffaa00',3,2.5);
    }
  }
},{passive:false});

// Keyboard support
canvas.addEventListener('mousedown',e=>{
  initAudio();
  const p=canvasXY(e.clientX,e.clientY);
  if(state===ST.STAGE_SEL){handleStageSelTouch(p.x,p.y);return;}
  if(state===ST.STAGE_CLEAR&&stageClearT>60){
    state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;switchBGM('title');return;
  }
  if(state===ST.PAUSE){
    if(hitResumeBtn(p.x,p.y)){state=ST.PLAY;switchBGM('play');return;}
    if(hitQuitBtn(p.x,p.y)){state=ST.TITLE;isPackMode=false;switchBGM('title');return;}
    return;
  }
  if(state===ST.PLAY&&hitBombBtn(p.x,p.y)){useBomb();return;}
  if(state===ST.PLAY&&hitPauseBtn(p.x,p.y)){state=ST.PAUSE;return;}
  if(state===ST.TITLE){if(charModal.show){charModal.show=false;return;}handleTitleTouch(p.x,p.y);}
  else if(state===ST.DEAD&&deadT>45){
    if(isPackMode){state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;switchBGM('title');return;}
    state=ST.TITLE;switchBGM('title');
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
    if(state===ST.STAGE_SEL){state=ST.TITLE;isPackMode=false;switchBGM('title');return;}
    if(state===ST.PLAY){state=ST.PAUSE;return;}
    if(state===ST.PAUSE){state=ST.PLAY;return;}
  }
  if(e.code==='Space'||e.code==='ArrowUp'){
    e.preventDefault();initAudio();
    if(state===ST.STAGE_SEL)return;
    if(state===ST.STAGE_CLEAR&&stageClearT>60){
      state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;switchBGM('title');return;
    }
    if(state===ST.PAUSE){state=ST.PLAY;switchBGM('play');return;}
    if(state===ST.TITLE){gameMode='endless';isPackMode=false;state=ST.PLAY;reset();switchBGM('play');}
    else if(state===ST.DEAD&&deadT>45){
      if(isPackMode){state=ST.STAGE_SEL;isPackMode=false;stageSelScroll=0;switchBGM('title');return;}
      state=ST.TITLE;switchBGM('title');
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
  const btnY=H*0.78;
  const ebx=btnStartX;
  const sbx=btnStartX+btnW+btnGap;
  // Endless mode button
  if(tx>=ebx&&tx<=ebx+btnW&&ty>=btnY&&ty<=btnY+btnH){
    gameMode='endless';isPackMode=false;state=ST.PLAY;reset();switchBGM('play');return;
  }
  // Stage mode button -> go to stage selection screen
  if(tx>=sbx&&tx<=sbx+btnW&&ty>=btnY&&ty<=btnY+btnH){
    gameMode='stage';state=ST.STAGE_SEL;stageSelScroll=0;stageSelTarget=0;return;
  }
}
