'use strict';
// ===== DRAW =====

// --- Gradient & measureText cache for performance ---
let _grC={g1:'',g2:'',fGr:null,cGr:null};
let _bgC={b1:'',b2:'',gr:null};
let _fpC={ln:'',gr:null};
function _getTerrGr(){
  const g1=tc('gnd'),g2=tc('gnd2');
  if(g1!==_grC.g1||g2!==_grC.g2){
    _grC.g1=g1;_grC.g2=g2;
    const f=ctx.createLinearGradient(0,0,0,H+10);f.addColorStop(0,g1);f.addColorStop(1,g2);_grC.fGr=f;
    const c=ctx.createLinearGradient(0,-10,0,H);c.addColorStop(0,g2);c.addColorStop(1,g1);_grC.cGr=c;
  }
  return _grC;
}
let _mtC={};
let _mtCCount=0;
function _cMT(txt,font){const k=font+'|'+txt;if(_mtC[k]!==undefined)return _mtC[k];ctx.font=font;_mtC[k]=ctx.measureText(txt).width;_mtCCount++;if(_mtCCount>500){_mtC={};_mtCCount=0;}return _mtC[k];}
// Clear measureText cache when score changes (called from update)
let _lastScoreForMT=-1;

// --- Drawing constants ---
const TAU=6.28;      // 2*PI, used in ctx.arc() calls
const MODAL_R=16;    // corner radius for large modal panels
const BTN_R=8;       // corner radius for buttons

function rr(x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

// Helper: white ghost close button (used in inventory, ranking, shop, cosmetic menu)
function _drawCloseBtn(y){
  ctx.fillStyle='#ffffff12';rr(W/2-50,y,100,30,BTN_R);ctx.fill();
  ctx.strokeStyle='#fff2';ctx.lineWidth=1;rr(W/2-50,y,100,30,BTN_R);ctx.stroke();
  ctx.fillStyle='#fff8';ctx.font='bold 12px monospace';ctx.textAlign='center';
  ctx.fillText(t('close'),W/2,y+20);
}

function _wrapTextLines(text,maxChars){
  if(!text)return[];
  const max=Math.max(6,maxChars||24);
  const lines=[];
  let rest=text;
  while(rest.length>max&&lines.length<3){
    let cut=max;
    const jpBreak=Math.max(rest.lastIndexOf('、',max),rest.lastIndexOf('。',max));
    const enBreak=rest.lastIndexOf(' ',max);
    if(jpBreak>=Math.floor(max*0.55))cut=jpBreak+1;
    else if(enBreak>=Math.floor(max*0.55))cut=enBreak;
    lines.push(rest.substring(0,cut).trim());
    rest=rest.substring(cut).trim();
  }
  if(rest)lines.push(rest);
  return lines;
}
function titleBadgePalette(group,locked){
  if(locked)return{a:'#2c3446',b:'#1a2130',rim:'#94a3b8',glow:'rgba(148,163,184,0.15)',text:'#dbe4f0',gem:'#e2e8f0'};
  switch(group){
    case'coins':return{a:'#7c4a00',b:'#331b00',rim:'#ffd166',glow:'rgba(255,209,102,0.2)',text:'#fff6cf',gem:'#ffe8a3'};
    case'score':return{a:'#7a163f',b:'#2f0919',rim:'#ff8ab5',glow:'rgba(255,138,181,0.2)',text:'#ffe1ee',gem:'#ffd1e3'};
    case'challenge':return{a:'#7a1f10',b:'#2f0b05',rim:'#fb7185',glow:'rgba(251,113,133,0.2)',text:'#ffe4e8',gem:'#ffd0d7'};
    case'chests':return{a:'#0f5f63',b:'#08282a',rim:'#67e8f9',glow:'rgba(103,232,249,0.18)',text:'#d9fbff',gem:'#bff7ff'};
    case'collection':return{a:'#52208d',b:'#24103f',rim:'#c084fc',glow:'rgba(192,132,252,0.18)',text:'#f5e8ff',gem:'#ebd5ff'};
    case'characters':return{a:'#0f5e42',b:'#08281c',rim:'#6ee7b7',glow:'rgba(110,231,183,0.18)',text:'#dffff1',gem:'#c9ffe8'};
    case'plays':
    default:return{a:'#144c7b',b:'#0a1f36',rim:'#7dd3fc',glow:'rgba(125,211,252,0.18)',text:'#e0f6ff',gem:'#b8ebff'};
  }
}
function drawTitleBadge(cx,cy,title,opts){
  const opt=opts||{};
  const def=typeof title==='string'?getTitleDef(title):title;
  const label=opt.label||tTitleName(def);
  if(!label)return null;
  const scale=opt.scale||1;
  const fontPx=Math.max(7,Math.round((opt.fontPx||10)*scale));
  const font='bold '+fontPx+'px monospace';
  const pal=titleBadgePalette(def?def.group:(opt.group||'plays'),!!opt.locked);
  const textW=_cMT(label,font);
  const h=Math.max(16,Math.round(20*scale));
  const padX=12*scale;
  const gemR=Math.max(2,3.2*scale);
  const w=Math.max(56*scale,textW+padX*2+gemR*6+10*scale);
  const x=cx-w/2,y=cy-h/2;
  const bg=ctx.createLinearGradient(x,y,x+w,y+h);
  bg.addColorStop(0,pal.a);bg.addColorStop(0.55,pal.b);bg.addColorStop(1,pal.a);
  ctx.save();
  ctx.fillStyle=pal.glow;rr(x-2,y-2,w+4,h+4,h/2+3);ctx.fill();
  ctx.fillStyle=bg;rr(x,y,w,h,h/2);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.16)';ctx.lineWidth=Math.max(1,0.9*scale);rr(x+1.5,y+1.5,w-3,h-3,h/2-1);ctx.stroke();
  ctx.strokeStyle=pal.rim;ctx.lineWidth=Math.max(1.2,1.4*scale);rr(x,y,w,h,h/2);ctx.stroke();
  const leftGemX=x+10*scale,rightGemX=x+w-10*scale;
  ctx.fillStyle=pal.gem;
  [leftGemX,rightGemX].forEach(gx=>{
    ctx.beginPath();
    ctx.moveTo(gx,cy-gemR*1.3);ctx.lineTo(gx+gemR,cy);ctx.lineTo(gx,cy+gemR*1.3);ctx.lineTo(gx-gemR,cy);
    ctx.closePath();ctx.fill();
  });
  ctx.fillStyle=pal.text;ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(label,cx,cy+0.5);
  ctx.restore();
  return{x,y,w,h};
}

function specialDescForChar(ch){
  const map={
    cube:t('specialDescCube'),
    ball:t('specialDescBounce'),
    tire:t('specialDescTire'),
    ghost:t('specialDescGhost'),
    ninja:t('specialDescNinja'),
    stone:t('specialDescStone')
  };
  return map[ch.shape]||'';
}

// ===== CHARACTER STAT BARS =====
function drawCharStatBars(ch,cx,startY,totalW){
  // Stat bars: speed, jump, size, gravity — single smooth bar per stat
  const labels=[t('statSpeed'),t('statJump'),t('statSize'),t('statGravity')];
  const vals=[ch.speedMul,ch.jumpMul,ch.sizeMul,ch.gravMul];
  const cols=['#34d399','#00e5ff','#ffa500','#8B8B8B'];
  const barGap=18,labelW=56;
  const barW=totalW-labelW-10;
  const barH=10;
  const leftX=cx-totalW/2;
  // Normalize: 0.7 → 0%, 1.2 → 100%
  const minV=0.7,maxV=1.2;
  for(let i=0;i<4;i++){
    const y=startY+i*barGap;
    const ratio=Math.max(0,Math.min(1,(vals[i]-minV)/(maxV-minV)));
    // Label
    ctx.fillStyle='#fff8';ctx.font='10px monospace';ctx.textAlign='left';
    ctx.fillText(labels[i],leftX,y+barH-1);
    // Value text
    ctx.fillStyle='#fff5';ctx.font='9px monospace';ctx.textAlign='right';
    ctx.fillText(vals[i].toFixed(2),leftX+totalW,y+barH-1);
    // Background track
    const bx=leftX+labelW;
    ctx.fillStyle='#ffffff11';
    rr(bx,y,barW-32,barH,4);ctx.fill();
    // Filled bar with gradient
    const fillW=Math.max(2,(barW-32)*ratio);
    const barGr=ctx.createLinearGradient(bx,y,bx+fillW,y);
    barGr.addColorStop(0,cols[i]+'44');barGr.addColorStop(0.5,cols[i]+'cc');barGr.addColorStop(1,cols[i]);
    ctx.fillStyle=barGr;
    rr(bx,y,fillW,barH,4);ctx.fill();
    // Shine highlight
    ctx.fillStyle='#ffffff18';
    rr(bx,y,fillW,barH/2,4);ctx.fill();
  }
  // Special abilities (positioned below stat bars with extra gap)
  const specY=startY+4*barGap+12;
  const sectionX=leftX;
  const sectionW=totalW;
  function drawInfoSection(y,label,labelCol,lines,bodyCol){
    const bodyLines=[];
    for(let i=0;i<lines.length;i++){
      const wrapped=_wrapTextLines(lines[i],gameLang==='ja'?24:30);
      for(let j=0;j<wrapped.length;j++)bodyLines.push(wrapped[j]);
    }
    const h=24+bodyLines.length*14;
    ctx.fillStyle='rgba(255,255,255,0.055)';
    rr(sectionX,y-12,sectionW,h,8);ctx.fill();
    ctx.strokeStyle=labelCol+'44';ctx.lineWidth=1;
    rr(sectionX,y-12,sectionW,h,8);ctx.stroke();
    ctx.fillStyle=labelCol;ctx.font='bold 11px monospace';ctx.textAlign='left';
    ctx.fillText(label,sectionX+10,y+2);
    ctx.fillStyle=bodyCol;ctx.font='11px monospace';
    for(let i=0;i<bodyLines.length;i++)ctx.fillText('- '+bodyLines[i],sectionX+12,y+18+i*14);
    return h+8;
  }
  const specials=[];
  if(ch.hasDjump)specials.push(t('abilityDjump'));
  if(ch.shape==='ball')specials.push(t('abilityAirCoin'));
  if(ch.shape==='tire')specials.push(t('abilityStep'));
  if(ch.shape==='tire')specials.push(t('abilityStomp'));
  if(ch.shape==='ghost')specials.push(t('abilityShield'));
  if(ch.shape==='ghost')specials.push(t('abilityGhost'));
  if(ch.shape==='ghost')specials.push(t('abilityPassiveCoin'));
  if(ch.maxFlip>=3)specials.push(t('abilityFlip').replace('{0}',ch.maxFlip));
  if(ch.hpBonus)specials.push(t('abilityHp').replace('{0}',ch.hpBonus));
  if(specials.length===0)specials.push(t('balancedDesc'));
  const abilityH=drawInfoSection(specY,t('specialAbility'),'#facc15',specials,'#fff7cc');
  const specialDesc=specialDescForChar(ch);
  if(specialDesc){
    drawInfoSection(specY+abilityH,t('specialSkillLabel'),'#38bdf8',[specialDesc],'#d8f3ff');
  }
}

// ===== LOGIN SCREEN (HTML overlay handles rendering) =====
function drawLogin(){} // Login is HTML overlay, nothing to draw on canvas

// ===== TUTORIAL (course-based) =====
function drawTutorial(){
  // Draw tutorial course platforms relative to scroll
  ctx.save();
  // Floor platforms (cached gradient)
  const tutFlGr=ctx.createLinearGradient(0,0,0,H);
  tutFlGr.addColorStop(0,tc('gnd'));tutFlGr.addColorStop(1,tc('gnd2'));
  for(let i=0;i<tutCoursePlats.length;i++){const p=tutCoursePlats[i];
    const sx=p.x-tutScrollX;
    if(sx+p.w<-20||sx>W+20)continue;
    const surfY=H-p.h;
    ctx.fillStyle=tutFlGr;ctx.fillRect(sx,surfY,p.w,p.h+10);
    ctx.fillStyle=tc('line');ctx.fillRect(sx,surfY,p.w,3);
  }
  // Ceiling platforms (cached gradient)
  const tutClGr=ctx.createLinearGradient(0,0,0,H);
  tutClGr.addColorStop(0,tc('gnd2'));tutClGr.addColorStop(1,tc('gnd'));
  for(let i=0;i<tutCourseCeil.length;i++){const p=tutCourseCeil[i];
    const sx=p.x-tutScrollX;
    if(sx+p.w<-20||sx>W+20)continue;
    ctx.fillStyle=tutClGr;ctx.fillRect(sx,-10,p.w,p.h+10);
    ctx.fillStyle=tc('line');ctx.fillRect(sx,p.h,p.w,3);
  }
  // Spikes
  for(let _si=0;_si<tutCourseSpikes.length;_si++){const sp=tutCourseSpikes[_si];
    const sx=sp.x-tutScrollX;
    if(sx+sp.w<-20||sx>W+20)continue;
    const by=H-GROUND_H;
    ctx.fillStyle='#ff4444';
    // Triangle spikes
    for(let i=0;i<3;i++){
      const tx=sx+i*(sp.w/3);
      ctx.beginPath();
      ctx.moveTo(tx,by);ctx.lineTo(tx+sp.w/6,by-sp.h);ctx.lineTo(tx+sp.w/3,by);
      ctx.closePath();ctx.fill();
    }
  }
  // Enemies
  for(let i=0;i<enemies.length;i++){const en=enemies[i];if(!en.alive)continue;drawEnemy(en);}
  // Particles & pops
  for(let i=0;i<parts.length;i++){const pp=parts[i];ctx.globalAlpha=pp.life/pp.ml;ctx.fillStyle=pp.col;ctx.beginPath();ctx.arc(pp.x,pp.y,pp.sz,0,TAU);ctx.fill();}
  ctx.globalAlpha=1;
  for(let i=0;i<pops.length;i++){const pp=pops[i];ctx.globalAlpha=pp.life/40;ctx.fillStyle=pp.col;ctx.font='bold 14px monospace';ctx.textAlign='center';ctx.fillText(pp.txt,pp.x,pp.y);}
  ctx.globalAlpha=1;
  // Bomb flash
  if(bombFlashT>0){ctx.fillStyle='rgba(255,68,0,'+(bombFlashT/20*0.4)+')';ctx.fillRect(0,0,W,H);}
  // Player
  if(player.alive){
    drawCharacter(player.x,player.y,selChar,PLAYER_R,player.rot,1,player.face,0,true);
  }
  // Action panel for bomb step
  if(tutStep<TUT_CHECKPOINTS.length&&TUT_CHECKPOINTS[tutStep].type==='bomb'&&tutPhase==='wait'){
    drawActionPanel();
  }
  ctx.restore();
  // Tutorial overlay UI
  drawTutorialOverlay();
}

function drawTutorialOverlay(){
  if(tutStep>=TUT_CHECKPOINTS.length||tutWarpPhase){
    // Welcome / Warp transition
    if(tutWarpPhase==='welcome'){
      const fadeIn=Math.min(1,tutWarpT/30);
      ctx.fillStyle='rgba(0,0,0,'+(0.7*fadeIn)+')';ctx.fillRect(0,0,W,H);
      // Stars sparkle
      for(let i=0;i<20;i++){
        const sx=(Math.sin(i*3.7+tutWarpT*0.02)*0.5+0.5)*W;
        const sy=(Math.cos(i*2.3+tutWarpT*0.015)*0.5+0.5)*H;
        const sa=Math.sin(tutWarpT*0.1+i)*0.4+0.4;
        ctx.fillStyle='rgba(255,215,0,'+sa*fadeIn+')';
        ctx.beginPath();ctx.arc(sx,sy,1.5+Math.sin(i+tutWarpT*0.05)*1,0,TAU);ctx.fill();
      }
      // Title text
      ctx.save();ctx.translate(W/2,H*0.30);
      const ps=1+Math.sin(tutWarpT*0.06)*0.04;ctx.scale(ps*fadeIn,ps*fadeIn);
      ctx.fillStyle='#ffd700';ctx.font='bold 26px monospace';ctx.textAlign='center';
      _shadow(20,'#ffd700');
      ctx.fillText(tutIsIntro?t('tutorial'):t('welcome'),0,-20);
      ctx.fillText(tutIsIntro?t('learnControls'):t('toAdventure'),0,16);
      ctx.shadowBlur=0;ctx.restore();
      // Tap prompt (blink)
      if(tutWarpT>30){
        const blink=Math.sin(tutWarpT*0.12)*0.4+0.6;
        ctx.globalAlpha=blink*fadeIn;
        ctx.fillStyle='#fff';ctx.font='bold 16px monospace';ctx.textAlign='center';
        ctx.fillText(t('tapToStart'),W/2,H*0.55);
        ctx.globalAlpha=1;
      }
      return;
    }
    if(tutWarpPhase==='warp'){
      // RPG-style warp/suction transition (slow and dramatic)
      const t=tutWarpT,maxT=150;
      const prog=Math.min(1,t/maxT);
      // Radial suction effect: everything gets pulled to center
      ctx.save();
      // Rotating speed lines
      const numLines=24;
      for(let i=0;i<numLines;i++){
        const angle=(i/numLines)*Math.PI*2+t*0.08;
        const innerR=Math.max(0,(1-prog*1.5))*Math.max(W,H);
        const outerR=Math.max(W,H)*1.5;
        const lw=4+prog*12;
        ctx.strokeStyle='rgba(255,215,0,'+(0.3+prog*0.5)+')';
        ctx.lineWidth=lw;
        ctx.beginPath();
        ctx.moveTo(W/2+Math.cos(angle)*innerR,H/2+Math.sin(angle)*innerR);
        ctx.lineTo(W/2+Math.cos(angle)*outerR,H/2+Math.sin(angle)*outerR);
        ctx.stroke();
      }
      // Central glow expanding
      const glowR=prog*Math.max(W,H)*1.2;
      const grd=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,glowR||1);
      grd.addColorStop(0,'rgba(255,255,255,'+Math.min(1,prog*2)+')');
      grd.addColorStop(0.3,'rgba(255,215,0,'+Math.min(0.8,prog*1.5)+')');
      grd.addColorStop(0.7,'rgba(0,229,255,'+Math.min(0.4,prog)+')');
      grd.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grd;ctx.fillRect(0,0,W,H);
      // Spiral particles
      for(let i=0;i<12;i++){
        const sa=i/12*Math.PI*2+t*0.15;
        const sr=Math.max(0,(1-prog))*120+20;
        const sx=W/2+Math.cos(sa)*sr,sy=H/2+Math.sin(sa)*sr;
        const spA=Math.max(0,1-prog*1.2);
        ctx.fillStyle='rgba(255,215,0,'+spA+')';
        ctx.beginPath();ctx.arc(sx,sy,3+prog*4,0,TAU);ctx.fill();
      }
      // White flash at the end
      if(prog>0.7){
        const flashA=(prog-0.7)/0.3;
        ctx.fillStyle='rgba(255,255,255,'+flashA+')';ctx.fillRect(0,0,W,H);
      }
      ctx.restore();
      return;
    }
    // Fallback completion screen
    const sc=Math.min(1,tutSuccessT/30);
    ctx.fillStyle='rgba(0,0,0,'+(0.6*sc)+')';ctx.fillRect(0,0,W,H);
    ctx.save();ctx.translate(W/2,H*0.35);const ps=1+Math.sin(tutSuccessT*0.08)*0.05;ctx.scale(ps,ps);
    ctx.fillStyle='#ffd700';ctx.font='bold 28px monospace';ctx.textAlign='center';
    ctx.fillText(t('tutorialComplete'),0,0);ctx.restore();
    ctx.fillStyle='#fff';ctx.font='14px monospace';ctx.textAlign='center';
    ctx.fillText(t('startAdventure'),W/2,H*0.48);
    return;
  }
  const cp=TUT_CHECKPOINTS[tutStep];

  // Progress bar at top
  const barW=W-40,barH=6,barX=20,barY=safeTop+10;
  ctx.fillStyle='#ffffff15';rr(barX,barY,barW,barH,3);ctx.fill();
  const prog=(tutStep+(tutPhase==='scroll'?(tutScrollX-(tutStep>0?TUT_CHECKPOINTS[tutStep-1].dist:0))/(cp.dist-(tutStep>0?TUT_CHECKPOINTS[tutStep-1].dist:0)):1))/TUT_CHECKPOINTS.length;
  ctx.fillStyle='#00e5ff';rr(barX,barY,barW*Math.min(1,prog),barH,3);ctx.fill();
  // Step dots
  for(let i=0;i<TUT_CHECKPOINTS.length;i++){
    const dx=barX+barW*(i+1)/TUT_CHECKPOINTS.length;
    ctx.fillStyle=i<tutStep?'#00e5ff':i===tutStep?'#ffd700':'#ffffff44';
    ctx.beginPath();ctx.arc(dx,barY+3,5,0,TAU);ctx.fill();
  }
  ctx.fillStyle='#fff6';ctx.font='10px monospace';ctx.textAlign='center';
  ctx.fillText((tutStep+1)+'/'+TUT_CHECKPOINTS.length,W/2,barY+20);

  // Instruction display (only when waiting or success)
  if(tutPhase==='wait'||tutPhase==='success'){
    // Large instruction box
    const boxW=Math.min(300,W-20),boxH=110;
    const boxX=W/2-boxW/2,boxY=H*0.08;
    // Animated entry
    const entry=Math.min(1,tutStepT/20);
    ctx.globalAlpha=entry;
    ctx.fillStyle='rgba(0,0,0,0.8)';
    rr(boxX,boxY,boxW,boxH,14);ctx.fill();
    ctx.strokeStyle=tutPhase==='success'?'#34d399':'#ffd700';ctx.lineWidth=2;
    rr(boxX,boxY,boxW,boxH,14);ctx.stroke();
    ctx.globalAlpha=1;

    if(tutPhase==='success'){
      // Success message
      const sp=1+Math.sin(tutSuccessT*0.15)*0.08;
      ctx.save();ctx.translate(W/2,boxY+45);ctx.scale(sp,sp);
      ctx.fillStyle='#34d399';ctx.font='bold 24px monospace';ctx.textAlign='center';
      ctx.fillText('OK!',0,0);ctx.restore();
      ctx.fillStyle='#34d399aa';ctx.font='12px monospace';ctx.textAlign='center';
      ctx.fillText(t('nextStep'),W/2,boxY+80);
    } else {
      // Double-flip sub-step: override message for second flip
      let msgText=t(cp.msgKey),subText=t(cp.subKey);
      if(cp.type==='double_flip'&&tutFlipCount>=1){
        msgText=t('tutDoubleFlipReturnMsg');subText=t('tutDoubleFlipReturnSub');
      }
      // Main message (supports \n)
      const lines=msgText.split('\n');
      const fontSize=18;
      ctx.fillStyle='#ffd700';ctx.font='bold '+fontSize+'px monospace';ctx.textAlign='center';
      const startY=boxY+28+(lines.length===1?8:0);
      for(let i=0;i<lines.length;i++){const line=lines[i];
        const pulse=1+Math.sin(tutStepT*0.06)*0.04;
        ctx.save();ctx.translate(W/2,startY+i*22);ctx.scale(pulse,pulse);
        ctx.fillText(line,0,0);ctx.restore();
      }
      // Sub instruction - mobile (animated)
      const subY=boxY+70+(lines.length===1?8:0);
      const subPulse=Math.sin(tutStepT*0.1)*0.3+0.7;
      ctx.globalAlpha=0.5+subPulse*0.5;
      ctx.fillStyle='#00e5ff';ctx.font='bold 13px monospace';
      ctx.fillText('\uD83D\uDCF1 '+subText,W/2,subY);
      ctx.globalAlpha=1;

      // Big visual guide icons
      drawTutorialGuide(cp);
    }
  }

  // Skip button
  ctx.fillStyle='#ffffff22';rr(W-64,safeTop+4,56,24,6);ctx.fill();
  ctx.fillStyle='#fff6';ctx.font='10px monospace';ctx.textAlign='center';
  ctx.fillText(t('skip'),W-36,safeTop+20);
}

function drawTutorialGuide(cp){
  const px=player.x,py=player.y;
  const t=tutStepT;

  if(cp.icon==='tap'){
    // Big pulsing hand/finger tap icon
    const cy=py-60;
    const r=20+Math.sin(t*0.12)*8;
    const a=0.4+Math.sin(t*0.12)*0.3;
    // Ripple rings
    for(let i=0;i<3;i++){
      const rr2=r+i*15+((t*2+i*20)%45);
      const ra=Math.max(0,0.4-rr2/80);
      ctx.strokeStyle='rgba(255,215,0,'+ra+')';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(px,cy,rr2,0,TAU);ctx.stroke();
    }
    // Center circle
    ctx.fillStyle='rgba(255,215,0,'+a+')';
    ctx.beginPath();ctx.arc(px,cy,r,0,TAU);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 16px monospace';ctx.textAlign='center';
    ctx.fillText('TAP',px,cy+6);
    // Bouncing arrow down to player
    const arrowY=cy+r+8+Math.sin(t*0.15)*6;
    ctx.strokeStyle='#ffd700';ctx.lineWidth=3;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(px,arrowY);ctx.lineTo(px,arrowY+16);ctx.stroke();
    ctx.beginPath();ctx.moveTo(px-6,arrowY+10);ctx.lineTo(px,arrowY+18);ctx.lineTo(px+6,arrowY+10);ctx.stroke();
  } else if(cp.icon==='swipe_up'){
    // Big upward swipe gesture
    const cx=px+60,cy=H*0.55;
    const offset=Math.sin(t*0.08)*20-10;
    // Hand/finger trail going up
    ctx.strokeStyle='#00e5ff';ctx.lineWidth=5;ctx.lineCap='round';
    ctx.globalAlpha=0.8;
    ctx.beginPath();ctx.moveTo(cx,cy+40+offset);ctx.lineTo(cx,cy-40+offset);ctx.stroke();
    // Big arrow head
    ctx.beginPath();
    ctx.moveTo(cx-14,cy-20+offset);ctx.lineTo(cx,cy-50+offset);ctx.lineTo(cx+14,cy-20+offset);
    ctx.stroke();
    ctx.globalAlpha=1;
    // Glow trail
    const grd=ctx.createLinearGradient(cx,cy+40+offset,cx,cy-40+offset);
    grd.addColorStop(0,'rgba(0,229,255,0)');grd.addColorStop(1,'rgba(0,229,255,0.3)');
    ctx.fillStyle=grd;ctx.fillRect(cx-8,cy-40+offset,16,80);
  } else if(cp.icon==='swipe_down'){
    // Big downward swipe gesture
    const cx=px+60,cy=H*0.45;
    const offset=Math.sin(t*0.08)*20+10;
    ctx.strokeStyle='#ff3860';ctx.lineWidth=5;ctx.lineCap='round';
    ctx.globalAlpha=0.8;
    ctx.beginPath();ctx.moveTo(cx,cy-40+offset);ctx.lineTo(cx,cy+40+offset);ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx-14,cy+20+offset);ctx.lineTo(cx,cy+50+offset);ctx.lineTo(cx+14,cy+20+offset);
    ctx.stroke();
    ctx.globalAlpha=1;
    const grd=ctx.createLinearGradient(cx,cy-40+offset,cx,cy+40+offset);
    grd.addColorStop(0,'rgba(255,56,96,0)');grd.addColorStop(1,'rgba(255,56,96,0.3)');
    ctx.fillStyle=grd;ctx.fillRect(cx-8,cy-40+offset,16,80);
  } else if(cp.icon==='double'){
    // Two arrows: show relevant step based on tutFlipCount
    const cx=px+70;
    const showSecond=tutFlipCount>=1;
    // Up arrow
    const upA=showSecond?0.15:0.9;
    ctx.globalAlpha=upA;
    ctx.strokeStyle='#00e5ff';ctx.lineWidth=4;ctx.lineCap='round';
    const uy=H*0.4+(showSecond?0:Math.sin(t*0.1)*8);
    ctx.beginPath();ctx.moveTo(cx-20,uy+25);ctx.lineTo(cx-20,uy-15);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-30,uy-5);ctx.lineTo(cx-20,uy-20);ctx.lineTo(cx-10,uy-5);ctx.stroke();
    ctx.fillStyle='#00e5ff';ctx.font='bold 11px monospace';ctx.textAlign='center';
    ctx.fillText(tutFlipCount>=1?'✓':'①↑',cx-20,uy+42);
    // Down arrow (prominent when second step)
    const dnA=showSecond?0.9:0.2;
    ctx.globalAlpha=dnA;
    ctx.strokeStyle='#ff3860';ctx.lineWidth=4;
    const dy=H*0.4+(showSecond?Math.sin(t*0.1)*8:0);
    ctx.beginPath();ctx.moveTo(cx+20,dy-15);ctx.lineTo(cx+20,dy+25);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx+10,dy+15);ctx.lineTo(cx+20,dy+30);ctx.lineTo(cx+30,dy+15);ctx.stroke();
    ctx.fillStyle='#ff3860';ctx.font='bold 11px monospace';
    ctx.fillText(tutFlipCount>=2?'✓':'②↓',cx+20,dy+48);
    ctx.globalAlpha=1;
  } else if(cp.icon==='bomb'){
    // Highlight bomb button with big pulsing glow
    const b=itemBtnLayout();
    const glow=Math.sin(t*0.1)*0.4+0.6;
    // Large glow ring
    for(let i=0;i<3;i++){
      const rr2=30+i*10+((t*2)%20);
      const ra=Math.max(0,0.5-rr2/60);
      ctx.strokeStyle='rgba(255,68,0,'+ra*glow+')';ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(b.bombX+b.sz/2,b.y+b.sz/2,rr2,0,TAU);ctx.stroke();
    }
    // Arrow pointing to button
    const arrowX=b.bombX+b.sz/2,arrowY=b.y-20+Math.sin(t*0.12)*8;
    ctx.strokeStyle='#ff4400';ctx.lineWidth=3;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(arrowX,arrowY-20);ctx.lineTo(arrowX,arrowY);ctx.stroke();
    ctx.beginPath();ctx.moveTo(arrowX-6,arrowY-6);ctx.lineTo(arrowX,arrowY+2);ctx.lineTo(arrowX+6,arrowY-6);ctx.stroke();
  }
}

// --- Menu icon drawing functions (canvas-drawn, no emoji) ---
function drawPlatforms(arr,isFloor){
  // Use cached terrain gradients (recreated only on theme change)
  const gc=_getTerrGr();const gr=isFloor?gc.fGr:gc.cGr;
  for(let i=0;i<arr.length;i++){const p=arr[i];
    if(p.x+p.w<-10||p.x>W+10)continue;
    let surfY,y2;
    if(isFloor){surfY=H-p.h;y2=H+10;}
    else{surfY=p.h;y2=-10;}
    // Fill
    ctx.fillStyle=gr;
    ctx.fillRect(p.x,Math.min(surfY,y2),p.w,Math.abs(y2-surfY));
    // Neon edges
    ctx.strokeStyle=tc('line');ctx.lineWidth=2.5;
    ctx.beginPath();
    ctx.moveTo(p.x,surfY);ctx.lineTo(p.x+p.w,surfY);
    ctx.moveTo(p.x,surfY);ctx.lineTo(p.x,y2);
    ctx.moveTo(p.x+p.w,surfY);ctx.lineTo(p.x+p.w,y2);
    ctx.stroke();
  }
}

function drawFloatPlats(){
  // Cache float plat gradient (recreated only on theme change)
  const ln=tc('line');
  if(ln!==_fpC.ln){_fpC.ln=ln;const g=ctx.createLinearGradient(0,0,W,0);g.addColorStop(0,tca('line',0x44));g.addColorStop(0.5,tca('line',0x88));g.addColorStop(1,tca('line',0x44));_fpC.gr=g;}
  const fpGr=_fpC.gr;
  for(let i=0;i<floatPlats.length;i++){const fp=floatPlats[i];
    if(fp.x+fp.w<-10||fp.x>W+10)continue;
    // Glowing thin platform
    ctx.fillStyle=fpGr;
    ctx.fillRect(fp.x,fp.y,fp.w,fp.th);
    // Neon top edge
    ctx.strokeStyle=tc('line');ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(fp.x,fp.y);ctx.lineTo(fp.x+fp.w,fp.y);ctx.stroke();
    ctx.beginPath();ctx.moveTo(fp.x,fp.y+fp.th);ctx.lineTo(fp.x+fp.w,fp.y+fp.th);ctx.stroke();
    // Side caps
    ctx.strokeStyle=tca('line',0x88);ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(fp.x,fp.y);ctx.lineTo(fp.x,fp.y+fp.th);ctx.stroke();
    ctx.beginPath();ctx.moveTo(fp.x+fp.w,fp.y);ctx.lineTo(fp.x+fp.w,fp.y+fp.th);ctx.stroke();
  }
}

function drawSpikes(){
  for(let _si=0;_si<spikes.length;_si++){const sp=spikes[_si];
    if(sp.x+sp.w<-10||sp.x>W+10)continue;
    const isFloor=sp.isFloor;
    const baseY=isFloor?sp.h:sp.h; // floor: H-plat.h, ceiling: ceilPlat.h
    let spikeShow=0;
    if(sp.state==='warning'){
      spikeShow=Math.sin(sp.timer/30*Math.PI*4)*0.15;
    } else if(sp.state==='up'){
      spikeShow=1;
    } else if(sp.state==='retracting'){
      spikeShow=1-sp.timer/15;
    }
    const sH=sp.spikeH*spikeShow;
    const spikes_n=Math.floor(sp.w/10);
    const dir=isFloor?-1:1; // floor spikes point up (-1), ceiling spikes point down (+1)
    ctx.save();
    // Base slot
    ctx.fillStyle=tca('obs',0x44);
    ctx.fillRect(sp.x,baseY-2,sp.w,4);
    if(spikeShow<=0){
      ctx.strokeStyle=tca('obs',0x66);ctx.lineWidth=1;
      for(let i=0;i<spikes_n;i++){
        const sx=sp.x+i*(sp.w/spikes_n)+sp.w/spikes_n/2;
        ctx.beginPath();ctx.moveTo(sx,baseY-1);ctx.lineTo(sx,baseY+1);ctx.stroke();
      }
      ctx.restore();continue;
    }
    if(sp.state==='warning'){
      const wa=0.2*Math.abs(Math.sin(sp.timer*0.3));
      ctx.globalAlpha=wa;ctx.fillStyle=tc('obs');
      ctx.fillRect(sp.x,isFloor?baseY-5:baseY+1,sp.w,5);
      ctx.globalAlpha=1;
    }
    for(let i=0;i<spikes_n;i++){
      const sx=sp.x+i*(sp.w/spikes_n);
      const sw=sp.w/spikes_n;
      ctx.fillStyle=tc('obs');
      ctx.beginPath();
      ctx.moveTo(sx,baseY);
      ctx.lineTo(sx+sw/2,baseY+dir*sH);
      ctx.lineTo(sx+sw,baseY);
      ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(sx+sw*0.3,baseY);
      ctx.lineTo(sx+sw/2,baseY+dir*sH);
      ctx.lineTo(sx+sw*0.5,baseY);
      ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
}

function drawMovingHills(){
  // Use cached terrain gradients (recreated only on theme change)
  const gc=_getTerrGr();const flGr=gc.fGr,clGr=gc.cGr;
  for(let i=0;i<movingHills.length;i++){const mh=movingHills[i];
    if(mh.x+mh.w<-10||mh.x>W+10)continue;
    const curH=mh.baseH+Math.sin(mh.phase)*mh.ampH;
    if(!mh.isFloor){
      const surfY=curH;
      ctx.fillStyle=clGr;ctx.fillRect(mh.x,-10,mh.w,surfY+10);
      ctx.strokeStyle=tc('line');ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(mh.x,surfY);ctx.lineTo(mh.x+mh.w,surfY);ctx.stroke();
      ctx.moveTo(mh.x,surfY);ctx.lineTo(mh.x,-10);ctx.moveTo(mh.x+mh.w,surfY);ctx.lineTo(mh.x+mh.w,-10);
      ctx.stroke();
    } else {
      const surfY=H-curH;
      ctx.fillStyle=flGr;ctx.fillRect(mh.x,surfY,mh.w,H-surfY+10);
      ctx.strokeStyle=tc('line');ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(mh.x,surfY);ctx.lineTo(mh.x+mh.w,surfY);ctx.stroke();
      ctx.moveTo(mh.x,surfY);ctx.lineTo(mh.x,H+10);ctx.moveTo(mh.x+mh.w,surfY);ctx.lineTo(mh.x+mh.w,H+10);
      ctx.stroke();
    }
  }
}

function drawGravZones(){
  for(let _gi=0;_gi<gravZones.length;_gi++){const g=gravZones[_gi];
    if(g.x+g.w<-10||g.x>W+10)continue;
    const alpha=g.fadeT>0?Math.max(0,1-g.fadeT/40):1;
    if(alpha<=0)continue;
    const isDown=(g.dir||1)===1; // blue=down, pink=up
    const r1=isDown?'0,130,255':'255,80,160';
    const r2=isDown?'80,180,255':'255,130,190';
    const r3=isDown?'100,200,255':'255,160,210';
    ctx.save();ctx.globalAlpha=alpha;
    // Aura fill (simplified from gradient for perf)
    ctx.fillStyle='rgba('+r2+',0.13)';
    const inset=g.w*0.25;
    ctx.fillRect(g.x+inset,0,g.w-inset*2,H);
    ctx.fillStyle='rgba('+r1+',0.06)';
    ctx.fillRect(g.x,0,g.w,H);
    // Flowing stream lines (step 16 for perf, skip in lowQ)
    const t=frame*0.05;
    if(!_lowQ){
      ctx.strokeStyle='rgba('+r3+','+0.25*alpha+')';
      ctx.lineWidth=1.5;
      for(let i=0;i<3;i++){
        const lx=g.x+g.w*(0.25+i*0.25)+Math.sin(t+i)*3;
        ctx.beginPath();
        for(let y=0;y<H;y+=16){
          const ox=Math.sin(y*0.03+t+i*1.5)*4;
          if(y===0)ctx.moveTo(lx+ox,y);
          else ctx.lineTo(lx+ox,y);
        }
        ctx.stroke();
      }
    }
    // Particles flowing in the forced direction
    const flowDir=isDown?1:-1;
    const flowCount=_lowQ?3:6;
    ctx.fillStyle='rgba('+r3+','+0.5*alpha+')';
    for(let i=0;i<flowCount;i++){
      const px=g.x+((frame*2+i*40)%Math.max(1,Math.floor(g.w)));
      const py=((frame*3*flowDir+i*70))%H;
      const ppy=py<0?py+H:py;
      ctx.beginPath();ctx.arc(px,ppy,2+Math.sin(frame*0.1+i)*1,0,TAU);ctx.fill();
    }
    // Arrow indicators showing forced direction
    const arrowAlpha=0.3+Math.sin(frame*0.08)*0.15;
    ctx.fillStyle='rgba('+(isDown?'68,136,255':'255,102,170')+','+arrowAlpha*alpha+')';
    const cx=g.x+g.w/2;
    for(let i=0;i<3;i++){
      const ay=H*0.25+i*H*0.25+((frame*1.5*flowDir)%50);
      const apy=ay<0?ay+H:ay>H?ay-H:ay;
      if(isDown){
        // Down arrow ▽
        ctx.beginPath();ctx.moveTo(cx-8,apy-8);ctx.lineTo(cx,apy+8);ctx.lineTo(cx+8,apy-8);ctx.closePath();ctx.fill();
      } else {
        // Up arrow △
        ctx.beginPath();ctx.moveTo(cx-8,apy+8);ctx.lineTo(cx,apy-8);ctx.lineTo(cx+8,apy+8);ctx.closePath();ctx.fill();
      }
    }
    ctx.globalAlpha=1;ctx.restore();
  }
}

function drawFallingMtns(){
  // Use cached terrain gradients (recreated only on theme change)
  const gc=_getTerrGr();const fmFlGr=gc.fGr,fmClGr=gc.cGr;
  for(let i=0;i<fallingMtns.length;i++){const fm=fallingMtns[i];
    if(fm.x+fm.w<-10||fm.x>W+10||fm.state==='gone')continue;
    const isCeil=!fm.isFloor;
    const shakeOff=fm.state==='shaking'?(Math.sin(fm.shakeT*0.8)*(2+(60-fm.shakeT)*0.05)):0;
    ctx.save();ctx.globalAlpha=fm.alpha;ctx.translate(shakeOff,0);
    if(!isCeil){
      const surfY=H-Math.max(0,fm.curH);
      ctx.fillStyle=fmFlGr;ctx.fillRect(fm.x,surfY,fm.w,H-surfY+10);
      ctx.strokeStyle=tc('line');ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(fm.x,surfY);ctx.lineTo(fm.x+fm.w,surfY);ctx.stroke();
      ctx.moveTo(fm.x,surfY);ctx.lineTo(fm.x,H+10);ctx.moveTo(fm.x+fm.w,surfY);ctx.lineTo(fm.x+fm.w,H+10);
      ctx.stroke();
    } else {
      const surfY=Math.max(0,fm.curH);
      ctx.fillStyle=fmClGr;ctx.fillRect(fm.x,-10,fm.w,surfY+10);
      ctx.strokeStyle=tc('line');ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(fm.x,surfY);ctx.lineTo(fm.x+fm.w,surfY);ctx.stroke();
      ctx.moveTo(fm.x,surfY);ctx.lineTo(fm.x,-10);ctx.moveTo(fm.x+fm.w,surfY);ctx.lineTo(fm.x+fm.w,-10);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ===== MAGMA GAPS (fill abyss with animated lava) =====
function drawMagmaGaps(){
  if(!isPackMode||!currentPackStage||!currentPackStage.magma)return;
  const t=frame*0.02;
  // Floor gaps (magma below)
  for(let i=0;i<platforms.length-1;i++){
    const p1=platforms[i],p2=platforms[i+1];
    const gStart=p1.x+p1.w;
    const gEnd=p2.x;
    if(gEnd-gStart<5)continue;
    if(gStart>W+20||gEnd<-20)continue;
    const surfY=H-p1.h;
    // Lava fill (flat layers instead of gradient for perf)
    const gW=gEnd-gStart,gH=H-surfY+10;
    ctx.fillStyle='#660800';ctx.fillRect(gStart,surfY,gW,gH);
    ctx.fillStyle='#cc1100';ctx.fillRect(gStart,surfY,gW,gH*0.6);
    ctx.fillStyle='#ff2200';ctx.fillRect(gStart,surfY,gW,gH*0.3);
    ctx.fillStyle='#ff4400';ctx.fillRect(gStart,surfY,gW,4);
    // Animated bubble/glow on surface
    const bubbleStep=_lowQ?36:18;
    ctx.fillStyle='#ff880066';
    for(let bx=gStart+5;bx<gEnd-5;bx+=bubbleStep){
      const by=surfY+Math.sin(t*3+bx*0.05)*4;
      const br=3+Math.sin(t*2+bx*0.08)*1.5;
      ctx.beginPath();ctx.arc(bx,by,br,0,TAU);ctx.fill();
    }
    // Bright surface line
    const waveStep=_lowQ?12:6;
    ctx.strokeStyle='#ffaa44';ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(gStart,surfY);
    for(let x=gStart;x<=gEnd;x+=waveStep){
      ctx.lineTo(x,surfY+Math.sin(t*4+x*0.1)*2.5);
    }
    ctx.stroke();
  }
  // Ceiling gaps (magma above)
  for(let i=0;i<ceilPlats.length-1;i++){
    const p1=ceilPlats[i],p2=ceilPlats[i+1];
    const gStart=p1.x+p1.w;
    const gEnd=p2.x;
    if(gEnd-gStart<5)continue;
    if(gStart>W+20||gEnd<-20)continue;
    const surfY=p1.h;
    // Lava fill
    if(_lowQ){
      ctx.fillStyle='#660800';ctx.fillRect(gStart,-10,gEnd-gStart,surfY+10);
      ctx.fillStyle='#cc1100';ctx.fillRect(gStart,-10,gEnd-gStart,(surfY+10)*0.6);
      ctx.fillStyle='#ff4400';ctx.fillRect(gStart,surfY-4,gEnd-gStart,4);
    } else {
      const lg=ctx.createLinearGradient(0,-10,0,surfY);
      lg.addColorStop(0,'#660800');lg.addColorStop(0.4,'#cc1100');lg.addColorStop(0.7,'#ff2200');lg.addColorStop(1,'#ff4400');
      ctx.fillStyle=lg;
      ctx.fillRect(gStart,-10,gEnd-gStart,surfY+10);
    }
    // Animated bubble/glow on surface
    ctx.fillStyle='#ff880066';
    for(let bx=gStart+5;bx<gEnd-5;bx+=(_lowQ?36:18)){
      const by=surfY-Math.sin(t*3+bx*0.07)*4;
      const br=3+Math.sin(t*2+bx*0.09)*1.5;
      ctx.beginPath();ctx.arc(bx,by,br,0,TAU);ctx.fill();
    }
    // Bright surface line
    ctx.strokeStyle='#ffaa44';ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(gStart,surfY);
    for(let x=gStart;x<=gEnd;x+=(_lowQ?12:6)){
      ctx.lineTo(x,surfY-Math.sin(t*4+x*0.12)*2.5);
    }
    ctx.stroke();
  }
}

// ===== MAGMA FIREBALLS (cute fire creatures from magma gaps) =====
function drawMagmaFireballs(){
  for(let i=0;i<magmaFireballs.length;i++){const fb=magmaFireballs[i];
    if(!fb.alive)continue;
    if(fb.x<-30||fb.x>W+30)continue;
    ctx.save();ctx.translate(fb.x,fb.y);
    const s=fb.sz;
    const wobble=Math.sin(fb.phase+frame*0.15)*0.12;
    // Fire body (cute round flame shape) - layered fills instead of gradient
    // Outer flame layer
    ctx.fillStyle='#ff4400';
    ctx.beginPath();
    ctx.moveTo(-s*0.7,s*0.3);
    ctx.quadraticCurveTo(-s*0.8,-s*0.2,-s*0.3-s*wobble,-s*0.8);
    ctx.quadraticCurveTo(0,-s*1.2+s*wobble*2,s*0.3+s*wobble,-s*0.8);
    ctx.quadraticCurveTo(s*0.8,-s*0.2,s*0.7,s*0.3);
    ctx.quadraticCurveTo(s*0.3,s*0.5,0,s*0.4);
    ctx.quadraticCurveTo(-s*0.3,s*0.5,-s*0.7,s*0.3);
    ctx.closePath();ctx.fill();
    // Mid flame layer
    ctx.fillStyle='#ff8800';
    ctx.beginPath();ctx.arc(0,-s*0.1,s*0.55,0,TAU);ctx.fill();
    // Inner bright core
    ctx.fillStyle='#ffee44';
    ctx.beginPath();ctx.arc(0,-s*0.1,s*0.25,0,TAU);ctx.fill();
    // Inner glow
    ctx.fillStyle='#ffee6688';
    ctx.beginPath();ctx.ellipse(0,-s*0.1,s*0.3,s*0.4,0,0,TAU);ctx.fill();
    // Eyes (cute big white eyes)
    ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(-s*0.22,-s*0.05,s*0.18,0,TAU);ctx.fill();
    ctx.beginPath();ctx.arc(s*0.22,-s*0.05,s*0.18,0,TAU);ctx.fill();
    // Pupils (dark)
    ctx.fillStyle='#441100';
    ctx.beginPath();ctx.arc(-s*0.18,-s*0.08,s*0.09,0,TAU);ctx.fill();
    ctx.beginPath();ctx.arc(s*0.26,-s*0.08,s*0.09,0,TAU);ctx.fill();
    // Glow effect
    ctx.strokeStyle='#ff660066';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(0,0,s*0.6,0,TAU);ctx.stroke();
    ctx.restore();
  }
}

function drawIcicles(){
  for(let i=0;i<icicles.length;i++){const ic=icicles[i];
    if(ic.x+ic.w<-10||ic.x>W+10||ic.state==='gone')continue;
    ctx.save();
    ctx.globalAlpha=(ic.alpha||1);
    // Warning shake before falling
    if(ic.state==='hang'&&ic.warnT>10){
      const shk=Math.sin(ic.warnT*1.5)*(1+ic.warnT*0.08);
      ctx.translate(shk,0);
    }
    const cx=ic.x+ic.w/2;
    const tipY=ic.tipY;
    // Icicle body: tapered triangle from ceiling
    if(_lowQ){ctx.fillStyle='rgba(160,210,255,0.85)';}
    else{const gr=ctx.createLinearGradient(cx,ic.baseY,cx,tipY);
      gr.addColorStop(0,'rgba(180,220,255,0.9)');gr.addColorStop(0.5,'rgba(140,200,255,0.85)');gr.addColorStop(1,'rgba(200,240,255,0.6)');
      ctx.fillStyle=gr;}
    ctx.beginPath();
    ctx.moveTo(ic.x,ic.baseY);
    ctx.lineTo(cx,tipY);
    ctx.lineTo(ic.x+ic.w,ic.baseY);
    ctx.closePath();ctx.fill();
    // Highlight edge
    ctx.strokeStyle='rgba(220,240,255,0.7)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(ic.x+ic.w*0.3,ic.baseY);ctx.lineTo(cx,tipY);ctx.stroke();
    // Frost glow
    ctx.strokeStyle='rgba(136,204,255,0.5)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(ic.x,ic.baseY);ctx.lineTo(cx,tipY);ctx.lineTo(ic.x+ic.w,ic.baseY);ctx.stroke();
    ctx.restore();
  }
}

function drawCoinSwitches(){
  for(let i=0;i<coinSwitches.length;i++){const cs=coinSwitches[i];
    if(cs.x+cs.r<-10||cs.x-cs.r>W+10)continue;
    ctx.save();
    if(cs.activated){
      if(cs.flashT>0){
        ctx.globalAlpha=cs.flashT/40;ctx.fillStyle=COIN_SW_COL;
        ctx.beginPath();ctx.arc(cs.x,cs.y,cs.r*1.5,0,TAU);ctx.fill();ctx.globalAlpha=1;
      }
      ctx.restore();continue;
    }
    const pulse2=0.7+Math.sin(frame*0.06)*0.3;
    // Compact round button - layered fills instead of gradient
    ctx.fillStyle='#2255cc';ctx.beginPath();ctx.arc(cs.x,cs.y,cs.r,0,TAU);ctx.fill();
    ctx.fillStyle='#4488ff';ctx.beginPath();ctx.arc(cs.x,cs.y,cs.r*0.75,0,TAU);ctx.fill();
    ctx.fillStyle='#88ccff';ctx.beginPath();ctx.arc(cs.x-2,cs.y-2,cs.r*0.35,0,TAU);ctx.fill();
    ctx.strokeStyle='#aaddff';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(cs.x,cs.y,cs.r,0,TAU);ctx.stroke();
    ctx.fillStyle='#ffd700';ctx.font='bold 10px monospace';ctx.textAlign='center';
    ctx.fillText('$',cs.x,cs.y+4);
    if(frame%20<10){ctx.fillStyle='rgba(255,215,0,'+pulse2*0.5+')';ctx.beginPath();ctx.arc(cs.x,cs.y-cs.r-4,2,0,TAU);ctx.fill();}
    ctx.restore();
  }
}

function draw(){
  // Reset transform every frame to DPR base (prevent accumulated shift from unbalanced save/restore)
  // Use _appDpr (set in data.js resize) — must match canvas sizing to avoid zoom bug
  ctx.setTransform(_appDpr,0,0,_appDpr,0,0);
  // Fill background BEFORE shake translate so canvas is fully cleared
  const b1=tc('bg1'),b2=tc('bg2');
  if(b1!==_bgC.b1||b2!==_bgC.b2){_bgC.b1=b1;_bgC.b2=b2;const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,b1);g.addColorStop(1,b2);_bgC.gr=g;}
  ctx.fillStyle=_bgC.gr;ctx.fillRect(0,0,W,H);
  ctx.save();ctx.translate(shakeX,shakeY);

  {const step=_lowQ?2:1;for(let i=0;i<stars.length;i+=step){const s=stars[i];ctx.globalAlpha=s.a*(0.6+Math.sin(s.tw)*0.4);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.x,s.y,s.sz,0,TAU);ctx.fill();}}
  ctx.globalAlpha=1;
  if(!_lowQ){for(let i=0;i<mtns.length;i++){const m=mtns[i];ctx.globalAlpha=m.a;ctx.fillStyle=tc('line');ctx.beginPath();ctx.moveTo(-10,H*0.75);for(let j=0;j<m.pts.length;j++){const p=m.pts[j];ctx.lineTo(p.x+m.off,H*0.75-p.h);}ctx.lineTo(W+510+m.off,H*0.75);ctx.closePath();ctx.fill();}}
  ctx.globalAlpha=1;

  // Login screen
  if(state===ST.LOGIN){drawLogin();ctx.restore();return;}
  // Tutorial
  if(state===ST.TUTORIAL){drawTutorial();ctx.restore();return;}
  // Title and stage select: draw early, before game objects, to avoid leftover stage bleed
  if(state===ST.TITLE){drawDemo();drawTitle();drawCharModal();drawInventory();drawShop();drawCosmeticMenu();drawTitleMenu();
    // Screen transition fade-in (white overlay fading out to reveal title)
    if(screenFadeIn>0){ctx.fillStyle='rgba(255,255,255,'+(screenFadeIn/90)+')';ctx.fillRect(0,0,W,H);}
    ctx.restore();return;}
  if(state===ST.STAGE_SEL){drawStageSel();ctx.restore();return;}

  // Platforms
  drawPlatforms(platforms,true);
  drawPlatforms(ceilPlats,false);
  drawMagmaGaps();
  drawFloatPlats();
  drawSpikes();
  drawMovingHills();
  drawGravZones();
  drawFallingMtns();
  drawIcicles();
  drawMagmaFireballs();
  drawCoinSwitches();

  if(isPackMode)drawAmbient();
  if(state===ST.COUNTDOWN){drawCountdown();ctx.restore();return;}

  // Pack mode: draw death markers (other players first, then own on top)
  if(isPackMode&&currentPackStage){
    // 他プレイヤー（ゴースト）: 青い円 + グレーのX、控えめに表示
    if(otherDeathMarks&&otherDeathMarks.length>0){
      for(let di=0;di<otherDeathMarks.length;di++){
        const dm=otherDeathMarks[di];
        const markScreenX=player.x+(dm.dist-rawDist)/(speed*0.08)*speed;
        if(markScreenX>-40&&markScreenX<W+40){
          const markY=dm.py!=null?dm.py:(dm.gDir===1?floorSurfaceY(markScreenX):ceilSurfaceY(markScreenX));
          const pulse=Math.sin(frame*0.06+di*0.7)*0.1+0.75;
          const r=10;
          ctx.save();
          ctx.globalAlpha=0.55*pulse;
          ctx.fillStyle='#a5b4fc'; // 薄い青
          ctx.beginPath();ctx.arc(markScreenX,markY,r,0,Math.PI*2);ctx.fill();
          ctx.strokeStyle='#64748b'; // グレーX
          ctx.lineWidth=2.5;ctx.lineCap='round';
          const cr=5.5;
          ctx.beginPath();ctx.moveTo(markScreenX-cr,markY-cr);ctx.lineTo(markScreenX+cr,markY+cr);ctx.stroke();
          ctx.beginPath();ctx.moveTo(markScreenX+cr,markY-cr);ctx.lineTo(markScreenX-cr,markY+cr);ctx.stroke();
          ctx.restore();
        }
      }
    }
    // 自分: 白い円 + 赤のX（目立たせる）
    if(stageDeathMarks[currentPackStage.id]){
      const dmarks=stageDeathMarks[currentPackStage.id];
      for(let di=0;di<dmarks.length;di++){
        const dm=dmarks[di];
        const markScreenX=player.x+(dm.dist-rawDist)/(speed*0.08)*speed;
        if(markScreenX>-40&&markScreenX<W+40){
          const markY=dm.py!=null?dm.py:(dm.gDir===1?floorSurfaceY(markScreenX):ceilSurfaceY(markScreenX));
          const pulse=Math.sin(frame*0.08+di)*0.15+0.85;
          const r=12;
          ctx.save();
          ctx.globalAlpha=0.8*pulse;
          ctx.fillStyle='#fff';
          ctx.beginPath();ctx.arc(markScreenX,markY,r,0,Math.PI*2);ctx.fill();
          ctx.strokeStyle='#ff3860';ctx.lineWidth=3;ctx.lineCap='round';
          const cr=7;
          ctx.beginPath();ctx.moveTo(markScreenX-cr,markY-cr);ctx.lineTo(markScreenX+cr,markY+cr);ctx.stroke();
          ctx.beginPath();ctx.moveTo(markScreenX+cr,markY-cr);ctx.lineTo(markScreenX-cr,markY+cr);ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  // Pack mode: draw checkpoint flag at midpoint (500m)
  if(isPackMode&&currentPackStage&&!checkpointFlag.collected){
    const cpDist=currentPackStage.dist*0.5;
    const cpScreenX=player.x+(cpDist-rawDist)/(speed*0.08)*speed;
    if(cpScreenX>-60&&cpScreenX<W+200){
      const isVoid=currentPackStage.stageType==='void';
      // Void stages: place flag on ceiling (upper floor); others: floor
      const cpSurf=isVoid?ceilSurfaceY(cpScreenX)+10:floorSurfaceY(cpScreenX);
      const flagBase=cpSurf;
      const poleH=80;
      const flagW=30,flagH=22;
      const wave=Math.sin(frame*0.08)*2;
      ctx.save();
      if(isVoid){
        // Ceiling flag: pole goes downward
        ctx.strokeStyle='#ccc';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(cpScreenX,flagBase);ctx.lineTo(cpScreenX,flagBase+poleH);ctx.stroke();
        const fTop=flagBase+poleH-flagH;
        ctx.fillStyle='#34d399';ctx.beginPath();
        ctx.moveTo(cpScreenX,fTop);
        ctx.quadraticCurveTo(cpScreenX+flagW*0.5,fTop+flagH*0.3+wave,cpScreenX+flagW,fTop+flagH*0.5+wave*0.5);
        ctx.lineTo(cpScreenX,fTop+flagH);
        ctx.closePath();ctx.fill();
        ctx.fillStyle='#fff';ctx.font='bold 11px monospace';ctx.textAlign='center';
        ctx.fillText('\u2713',cpScreenX+flagW*0.4,fTop+flagH*0.6+wave*0.3);
        ctx.fillStyle='#34d399';ctx.font='bold 10px monospace';
        const lp=0.6+Math.sin(frame*0.1)*0.4;
        ctx.globalAlpha=lp;
        ctx.fillText('CHECK',cpScreenX,flagBase+poleH+16);
        ctx.globalAlpha=1;
        ctx.fillStyle='#34d399';ctx.beginPath();ctx.arc(cpScreenX,flagBase,4,0,TAU);ctx.fill();
      } else {
        // Normal floor flag: pole goes upward
        ctx.strokeStyle='#ccc';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(cpScreenX,flagBase);ctx.lineTo(cpScreenX,flagBase-poleH);ctx.stroke();
        const fTop=flagBase-poleH;
        ctx.fillStyle='#34d399';ctx.beginPath();
        ctx.moveTo(cpScreenX,fTop);
        ctx.quadraticCurveTo(cpScreenX+flagW*0.5,fTop+flagH*0.3+wave,cpScreenX+flagW,fTop+flagH*0.5+wave*0.5);
        ctx.lineTo(cpScreenX,fTop+flagH);
        ctx.closePath();ctx.fill();
        ctx.fillStyle='#fff';ctx.font='bold 11px monospace';ctx.textAlign='center';
        ctx.fillText('\u2713',cpScreenX+flagW*0.4,fTop+flagH*0.6+wave*0.3);
        ctx.fillStyle='#34d399';ctx.font='bold 10px monospace';
        const lp=0.6+Math.sin(frame*0.1)*0.4;
        ctx.globalAlpha=lp;
        ctx.fillText('CHECK',cpScreenX,flagBase-poleH-10);
        ctx.globalAlpha=1;
        ctx.fillStyle='#34d399';ctx.beginPath();ctx.arc(cpScreenX,flagBase,4,0,TAU);ctx.fill();
      }
      ctx.restore();
    }
  }
  // Pack mode: draw collected checkpoint flag indicator
  if(isPackMode&&currentPackStage&&checkpointFlag.collected){
    const cpDist=currentPackStage.dist*0.5;
    const cpScreenX=player.x+(cpDist-rawDist)/(speed*0.08)*speed;
    if(cpScreenX>-60&&cpScreenX<W+200){
      const isVoid2=currentPackStage.stageType==='void';
      const cpSurf=isVoid2?ceilSurfaceY(cpScreenX)+10:floorSurfaceY(cpScreenX);
      ctx.save();ctx.globalAlpha=0.3;
      ctx.strokeStyle='#aaa';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(cpScreenX,cpSurf);ctx.lineTo(cpScreenX,isVoid2?cpSurf+80:cpSurf-80);ctx.stroke();
      ctx.restore();
    }
  }

  // Pack mode: draw goal flag at target distance
  if(isPackMode&&currentPackStage){
    const goalDist=currentPackStage.dist;
    const goalScreenX=player.x+(goalDist-rawDist)/(speed*0.08)*speed;
    if(goalScreenX>-60&&goalScreenX<W+200){
      const gSurf=floorSurfaceY(goalScreenX);
      const flagBase=gSurf;
      const poleH=100;
      const flagW=40,flagH=30;
      const wave=Math.sin(frame*0.06)*3;
      ctx.save();
      // Flag pole
      ctx.strokeStyle='#fff';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(goalScreenX,flagBase);ctx.lineTo(goalScreenX,flagBase-poleH);ctx.stroke();
      const fTop=flagBase-poleH;
      ctx.fillStyle='#ffd700';ctx.beginPath();
      ctx.moveTo(goalScreenX,fTop);
      ctx.quadraticCurveTo(goalScreenX+flagW*0.5,fTop+flagH*0.3+wave,goalScreenX+flagW,fTop+flagH*0.5+wave*0.5);
      ctx.lineTo(goalScreenX,fTop+flagH);
      ctx.closePath();ctx.fill();
      ctx.fillStyle='#fff';ctx.font='bold 14px monospace';ctx.textAlign='center';
      ctx.fillText('\u2605',goalScreenX+flagW*0.4,fTop+flagH*0.6+wave*0.3);
      // "GOAL" label
      ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';
      const labelPulse=0.7+Math.sin(frame*0.08)*0.3;
      ctx.globalAlpha=labelPulse;
      ctx.fillText('GOAL',goalScreenX,flagBase-poleH-12);
      ctx.globalAlpha=1;
      // Pole base ornament
      ctx.fillStyle='#ffd700';ctx.beginPath();ctx.arc(goalScreenX,flagBase,5,0,TAU);ctx.fill();
      ctx.restore();
    }
  }

  // Pack mode: draw stars (stageBigCoins)
  if(isPackMode){
    for(let i=0;i<stageBigCoins.length;i++){const bc=stageBigCoins[i];
      if(bc.col||bc.x<-30||bc.x>W+30)continue;
      const p=Math.sin(bc.p)*0.15+1,sz=bc.sz*p;
      // Outer glow
      ctx.fillStyle='#ffd700';ctx.beginPath();
      for(let i=0;i<5;i++){
        const a=-Math.PI/2+i*Math.PI*2/5;
        const a2=a+Math.PI/5;
        ctx.lineTo(bc.x+Math.cos(a)*sz,bc.y+Math.sin(a)*sz);
        ctx.lineTo(bc.x+Math.cos(a2)*sz*0.45,bc.y+Math.sin(a2)*sz*0.45);
      }
      ctx.closePath();ctx.fill();
      // Inner highlight
      ctx.fillStyle='rgba(255,255,255,0.5)';ctx.beginPath();ctx.arc(bc.x-sz*0.15,bc.y-sz*0.2,sz*0.3,0,TAU);ctx.fill();
    }
  }

  // Coins & Items
  for(let i=0;i<coins.length;i++)drawCoin(coins[i]);
  for(let i=0;i<items.length;i++)drawItem(items[i]);

  // Enemies
  for(let i=0;i<enemies.length;i++){const en=enemies[i];if(en.alive)drawEnemy(en);}

  // Bullets
  for(let i=0;i<bullets.length;i++)drawBullet(bullets[i]);

  // Trail (skip in low quality)
  if(!_lowQ){for(let i=0;i<_trailLen;i++){const t=_trailBuf[(_trailHead+i)%20];if(t.a<=0)continue;ctx.globalAlpha=t.a*0.15;ctx.fillStyle=CHARS[selChar].col;const s=PLAYER_R*(0.3+t.a*0.5);ctx.beginPath();ctx.arc(t.x,t.y,s,0,TAU);ctx.fill();}}
  ctx.globalAlpha=1;

  if(player.alive)drawPlayer();

  {const step=_lowQ?2:1;for(let i=0;i<parts.length;i+=step){const p=parts[i];ctx.globalAlpha=p.life/p.ml;ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(p.x,p.y,p.sz*(p.life/p.ml),0,TAU);ctx.fill();}}
  ctx.globalAlpha=1;

  drawChestFall();
  for(let i=0;i<pops.length;i++){const p=pops[i];const a=p.life/p.ml;ctx.globalAlpha=a;ctx.fillStyle=p.col;ctx.font='bold 16px monospace';ctx.textAlign='center';ctx.fillText(p.txt,p.x,p.y);}
  ctx.globalAlpha=1;
  if(mileT>0)drawMile();
  // Fever rainbow overlay (invincibility item / special skill)
  const feverT=itemEff.invincible>0?itemEff.invincible:(specialState.active&&state===ST.PLAY?specialState.t:0);
  if(feverT>0&&state===ST.PLAY){
    const ending=feverT<=90; // last 1.5 seconds = warning phase
    const hue=(frame*6)%360;
    if(ending){
      // Big flashing warning - rapid blink that gets faster
      const blinkSpeed=feverT<30?0.8:feverT<60?0.5:0.3;
      const blinkAlpha=Math.abs(Math.sin(frame*blinkSpeed));
      ctx.globalAlpha=blinkAlpha*0.25;ctx.fillStyle='#fff';ctx.fillRect(-20,-20,W+40,H+40);ctx.globalAlpha=1;
      // Shrinking rainbow border
      const borderW=4+feverT/90*8;
      const borderAlpha=0.3+blinkAlpha*0.3;
      ctx.globalAlpha=borderAlpha;ctx.strokeStyle='hsl('+hue+',100%,60%)';ctx.lineWidth=borderW;
      ctx.strokeRect(-5,-5,W+10,H+10);ctx.globalAlpha=1;
      // Warning text flash
      if(feverT<60&&Math.floor(frame/8)%2===0){
        ctx.save();ctx.globalAlpha=0.6;
        ctx.fillStyle='#fff';ctx.font='bold 18px monospace';ctx.textAlign='center';
        _shadow(15,'#ff0000');
        ctx.fillText(t('invincibleEnding'),W/2,H*0.15);
        ctx.shadowBlur=0;ctx.restore();
      }
    } else {
      const ra=0.06+Math.sin(frame*0.15)*0.03;
      ctx.globalAlpha=ra;ctx.fillStyle='hsl('+hue+',100%,60%)';ctx.fillRect(-20,-20,W+40,H+40);ctx.globalAlpha=1;
      // Rainbow edge glow
      const ew=8+Math.sin(frame*0.2)*4;
      ctx.globalAlpha=0.15;
      for(let i=0;i<4;i++){
        const eh=(frame*4+i*90)%360;
        ctx.fillStyle='hsl('+eh+',100%,50%)';
        if(i===0)ctx.fillRect(-5,-5,W+10,ew);
        else if(i===1)ctx.fillRect(-5,H-ew,-5,ew+10);
        else if(i===2)ctx.fillRect(-5,-5,ew,H+10);
        else ctx.fillRect(W-ew,-5,ew+5,H+10);
      }
      ctx.globalAlpha=1;
    }
    // Sparkle particles in corners (fewer during ending)
    if(frame%(ending?6:3)===0){
      const sx=Math.random()*W,sy=Math.random()<0.5?Math.random()*40:H-Math.random()*40;
      const ph=((frame*8)%360+Math.floor(Math.random()*60))%360;
      parts.push({x:sx,y:sy,vx:(Math.random()-0.5)*1,vy:(Math.random()-0.5)*1,life:12,ml:12,sz:Math.random()*3+1,col:'hsl('+ph+',100%,70%)'});
    }
    // === Fever parade (item = kuribo, special = selected default character) ===
    if(!ending&&!specialState.active){
      const ksz=16; // kuribo size (bigger)
      const spacing=ksz*2.8;
      const count=Math.ceil(W/spacing)+1;
      const scrollX=(frame*1.2)%spacing;
      ctx.save();
      for(let row=0;row<2;row++){
        const baseY=row===0?safeTop+46:H-PANEL_H-Math.min(safeBot,10)-8;
        const flip=row===0?-1:1;
        for(let i=-1;i<count;i++){
          const kx=i*spacing+scrollX;
          if(kx<-ksz*2||kx>W+ksz*2)continue;
          const bounce=Math.abs(Math.sin((frame*0.08+i*0.7+row*1.5)))*8;
          const tilt=Math.sin(frame*0.06+i*0.9)*0.18;
          const ky=baseY-bounce*flip;
          // Face cycle: normal(0) → smile(1) → laugh(2) → smile(1) → repeat
          const faceCycle=Math.floor((frame*0.04+i*1.3+row*2)%4);
          const faceType=faceCycle===2?2:faceCycle===1||faceCycle===3?1:0;
          ctx.save();ctx.translate(kx,ky);ctx.rotate(tilt);
          if(flip===-1)ctx.scale(1,-1);
          // Body - layered fills instead of gradient
          ctx.fillStyle='#8b4513';
          ctx.beginPath();ctx.arc(0,-ksz*0.15,ksz*0.85,0,TAU);ctx.fill();
          ctx.fillStyle='#c87040';
          ctx.beginPath();ctx.arc(0,-ksz*0.15,ksz*0.5,0,TAU);ctx.fill();
          // Feet (bouncing walk)
          const step=Math.sin(frame*0.12+i)*ksz*0.18;
          ctx.fillStyle='#5a2d0c';
          ctx.fillRect(-ksz*0.5+step,ksz*0.35,ksz*0.3,ksz*0.25);
          ctx.fillRect(ksz*0.2-step,ksz*0.35,ksz*0.3,ksz*0.25);
          ctx.strokeStyle='#1a0a00';ctx.lineWidth=1.8;ctx.lineCap='round';
          if(faceType===0){
            // Normal face: round eyes, small smile
            ctx.fillStyle='#fff';
            ctx.beginPath();ctx.arc(-ksz*0.22,-ksz*0.28,ksz*0.17,0,TAU);ctx.fill();
            ctx.beginPath();ctx.arc(ksz*0.22,-ksz*0.28,ksz*0.17,0,TAU);ctx.fill();
            ctx.fillStyle='#1a0a00';
            ctx.beginPath();ctx.arc(-ksz*0.2,-ksz*0.3,ksz*0.09,0,TAU);ctx.fill();
            ctx.beginPath();ctx.arc(ksz*0.24,-ksz*0.3,ksz*0.09,0,TAU);ctx.fill();
            ctx.beginPath();ctx.arc(0,ksz*0.05,ksz*0.18,0.3,Math.PI-0.3);ctx.stroke();
          } else if(faceType===1){
            // Smile face: happy ^_^ eyes
            ctx.beginPath();ctx.arc(-ksz*0.22,-ksz*0.3,ksz*0.15,Math.PI*0.15,Math.PI*0.85);ctx.stroke();
            ctx.beginPath();ctx.arc(ksz*0.22,-ksz*0.3,ksz*0.15,Math.PI*0.15,Math.PI*0.85);ctx.stroke();
            ctx.beginPath();ctx.arc(0,ksz*0.05,ksz*0.22,0.2,Math.PI-0.2);ctx.stroke();
          } else {
            // Laugh face: wide open mouth, squint eyes
            ctx.beginPath();ctx.arc(-ksz*0.22,-ksz*0.3,ksz*0.13,Math.PI*0.1,Math.PI*0.9);ctx.stroke();
            ctx.beginPath();ctx.arc(ksz*0.22,-ksz*0.3,ksz*0.13,Math.PI*0.1,Math.PI*0.9);ctx.stroke();
            // Open mouth (filled)
            ctx.fillStyle='#1a0a00';
            ctx.beginPath();ctx.ellipse(0,ksz*0.1,ksz*0.22,ksz*0.15,0,0,TAU);ctx.fill();
            ctx.fillStyle='#c0392b';
            ctx.beginPath();ctx.ellipse(0,ksz*0.14,ksz*0.14,ksz*0.07,0,0,TAU);ctx.fill();
          }
          // Blush cheeks (always)
          ctx.fillStyle='rgba(255,120,120,0.4)';
          ctx.beginPath();ctx.arc(-ksz*0.48,-ksz*0.02,ksz*0.13,0,TAU);ctx.fill();
          ctx.beginPath();ctx.arc(ksz*0.48,-ksz*0.02,ksz*0.13,0,TAU);ctx.fill();
          ctx.lineCap='butt';
          ctx.restore();
        }
      }
      ctx.restore();
    }
    if(specialState.active)drawSpecialParade();
  }
  // Boss alert overlay
  if(bossPhase.active&&bossPhase.prepare>0){
    const bat=bossPhase.alertT;
    // Flashing red vignette
    const flash=Math.sin(bat*0.3)*0.15+0.15;
    if(_lowQ){ctx.fillStyle=`rgba(180,0,0,${flash*0.5})`;ctx.fillRect(-20,-20,W+40,H+40);}
    else{const vg=ctx.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.8);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,`rgba(180,0,0,${flash})`);ctx.fillStyle=vg;ctx.fillRect(-20,-20,W+40,H+40);}
    // Warning text
    if(bat>15){
      const ta=Math.min(1,(bat-15)/10)*Math.abs(Math.sin(bat*0.12));
      ctx.save();ctx.globalAlpha=ta;
      ctx.fillStyle='#ff3860';ctx.font='bold 42px monospace';ctx.textAlign='center';
      _shadow(30,'#ff0000');
      ctx.fillText('\u26A0 WARNING',W/2,H*0.35);
      ctx.font='bold 18px monospace';ctx.fillStyle='#ff6080';
      ctx.fillText(t('bossAppear'),W/2,H*0.43);
      // Boss name (show both for dual boss)
      const bossNameMap={bruiser:t('bossBruiser'),dodge:t('bossDodge'),wizard:t('bossWizard'),guardian:t('bossGuardian')};
      const bname=bossNameMap[bossPhase.bossType]||'';
      const bname2=bossPhase.bossType2?bossNameMap[bossPhase.bossType2]:'';
      if(bname){
        ctx.font='bold 24px monospace';ctx.fillStyle='#ffdd57';
        if(bname2){
          ctx.fillText(bname+' & '+bname2,W/2,H*0.52);
        } else {
          ctx.fillText(bname,W/2,H*0.52);
        }
      }
      ctx.shadowBlur=0;ctx.restore();
    }
    // Red scan lines
    if(bat%6<3){
      ctx.fillStyle='rgba(255,0,0,0.04)';
      for(let y=0;y<H;y+=4)ctx.fillRect(0,y,W,2);
    }
  }
  // Boss phase UI
  if(bossPhase.active&&bossPhase.prepare<=0&&!bossPhase.reward){
    // Boss instruction hint
    if(bossPhase.hintT>0){
      const hintAlpha=bossPhase.hintT<60?bossPhase.hintT/60:1;
      let hintMsg='';
      const bt=bossPhase.bossType;
      const _bossHints={bruiser:'hintBruiser',dodge:'hintDodge',wizard:'hintWizard',guardian:'hintGuardian'};
      if(_bossHints[bt])hintMsg=t(_bossHints[bt]);
      if(hintMsg){
        ctx.save();ctx.globalAlpha=hintAlpha;
        ctx.font='bold 15px monospace';ctx.textAlign='center';
        // Background pill
        const tw=ctx.measureText(hintMsg).width+24;
        const hx=W/2-tw/2,hy=Math.floor(H*0.28);
        ctx.fillStyle='rgba(0,0,0,0.7)';
        ctx.beginPath();ctx.moveTo(hx+8,hy);ctx.lineTo(hx+tw-8,hy);ctx.quadraticCurveTo(hx+tw,hy,hx+tw,hy+8);
        ctx.lineTo(hx+tw,hy+22);ctx.quadraticCurveTo(hx+tw,hy+30,hx+tw-8,hy+30);
        ctx.lineTo(hx+8,hy+30);ctx.quadraticCurveTo(hx,hy+30,hx,hy+22);
        ctx.lineTo(hx,hy+8);ctx.quadraticCurveTo(hx,hy,hx+8,hy);ctx.closePath();ctx.fill();
        ctx.fillStyle='#ffdd57';
        ctx.fillText(hintMsg,W/2,hy+21);
        ctx.restore();
      }
    }
  }
  // Special skill hint pill (same style as boss hint, shown for first 4 sec of activation)
  if(state===ST.PLAY&&specialState.active&&specialState.hintT>0){
    const sHintAlpha=specialState.hintT<60?specialState.hintT/60:1;
    const _specHints={cube:'hintSpecialCube',ball:'hintSpecialBall',bounce:'hintSpecialBall',tire:'hintSpecialTire',ghost:'hintSpecialGhost',ninja:'hintSpecialNinja',stone:'hintSpecialStone'};
    const sHintMsg=t(_specHints[specialState.type]||'');
    if(sHintMsg){
      ctx.save();ctx.globalAlpha=sHintAlpha;
      ctx.font='bold 14px monospace';ctx.textAlign='center';
      const stw=ctx.measureText(sHintMsg).width+24;
      const shx=W/2-stw/2,shy=Math.floor(H*0.28);
      ctx.fillStyle='rgba(0,10,40,0.82)';
      ctx.beginPath();ctx.moveTo(shx+8,shy);ctx.lineTo(shx+stw-8,shy);ctx.quadraticCurveTo(shx+stw,shy,shx+stw,shy+8);
      ctx.lineTo(shx+stw,shy+22);ctx.quadraticCurveTo(shx+stw,shy+30,shx+stw-8,shy+30);
      ctx.lineTo(shx+8,shy+30);ctx.quadraticCurveTo(shx,shy+30,shx,shy+22);
      ctx.lineTo(shx,shy+8);ctx.quadraticCurveTo(shx,shy,shx+8,shy);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#00e5ff55';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(shx+8,shy);ctx.lineTo(shx+stw-8,shy);ctx.quadraticCurveTo(shx+stw,shy,shx+stw,shy+8);
      ctx.lineTo(shx+stw,shy+22);ctx.quadraticCurveTo(shx+stw,shy+30,shx+stw-8,shy+30);
      ctx.lineTo(shx+8,shy+30);ctx.quadraticCurveTo(shx,shy+30,shx,shy+22);
      ctx.lineTo(shx,shy+8);ctx.quadraticCurveTo(shx,shy,shx+8,shy);ctx.closePath();ctx.stroke();
      ctx.fillStyle='#00e5ff';
      ctx.fillText(sHintMsg,W/2,shy+21);
      ctx.restore();
    }
  }
  // Bomb flash overlay
  if(bombFlashT>0&&state===ST.PLAY){
    const ba=bombFlashT/20;
    ctx.globalAlpha=ba*0.35;ctx.fillStyle='#ff4400';ctx.fillRect(-20,-20,W+40,H+40);
    if(bombFlashT>15){ctx.globalAlpha=(bombFlashT-15)/5*0.6;ctx.fillStyle='#fff';ctx.fillRect(-20,-20,W+40,H+40);}
    ctx.globalAlpha=1;
  }
  // New highscore golden glow effect
  if(newHiEffT>0&&state===ST.PLAY){
    const na=newHiEffT/120;
    // Golden border
    const bw=3+na*6;
    ctx.globalAlpha=na*0.7;ctx.strokeStyle='#ffd700';ctx.lineWidth=bw;
    _shadow(20*na,'#ffd700');
    ctx.strokeRect(-2,-2,W+4,H+4);ctx.shadowBlur=0;ctx.globalAlpha=1;
    // "NEW RECORD" text at top
    if(newHiEffT>80){
      const ta=(newHiEffT-80)/40;
      ctx.save();ctx.globalAlpha=ta;
      ctx.fillStyle='#ffd700';ctx.font='bold 22px monospace';ctx.textAlign='center';
      _shadow(15,'#ffd70088');
      ctx.fillText('\u2605 NEW RECORD! \u2605',W/2,H*0.25);
      ctx.shadowBlur=0;ctx.restore();
    }
  }
  ctx.restore();
  // === Draw UI and overlays OUTSIDE shake translate (fixed position) ===
  // Bottom action panel (must be outside shake so it doesn't jitter with gravity/impacts)
  // Also draw during PAUSE so terrain doesn't show through the home-indicator area
  if(state===ST.PLAY||state===ST.PAUSE){
    drawActionPanel();
  }
  drawUI();
  // Challenge blackout transition overlay
  if(isChallengeMode&&challTransition.active){
    drawChallTransition();
  }
  if(state===ST.DEAD){drawDead();if(deadChestOpen&&chestOpen.phase!=='none')drawChestOpen();}
  if(state===ST.PAUSE){drawPause();if(settingsOpen)drawTitle();}
  if(state===ST.STAGE_CLEAR)drawStageClear();
  if(window._fpsShow)drawFpsOverlay();
}

// Diagnostic FPS overlay — toggled by 5 quick taps on top-left corner (enable)
// or 3 quick taps on the overlay itself (disable)
function drawFpsOverlay(){
  const fps=Math.round(_fpsSmooth||60);
  const fpsMin=Math.round(_fpsMin||60);
  const col=fps>=55?'#4ade80':(fps>=40?'#fbbf24':'#f87171');
  const x=6,y=safeTop+6,w=180,h=56;
  ctx.fillStyle='rgba(0,0,0,0.7)';rr(x,y,w,h,4);ctx.fill();
  if(_gcSpikeT>0){ctx.fillStyle='rgba(248,113,113,0.25)';rr(x,y,w,h,4);ctx.fill();}
  ctx.font='bold 13px monospace';ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillStyle=col;ctx.fillText('FPS '+fps+' (min '+fpsMin+')',x+6,y+4);
  ctx.font='10px monospace';ctx.fillStyle='#e5e7eb';
  const pN=parts?parts.length:0,eN=enemies?enemies.length:0,bN=bullets?bullets.length:0;
  const cN=coins?coins.length:0,poN=pops?pops.length:0;
  ctx.fillText('P:'+pN+' E:'+eN+' B:'+bN+' C:'+cN+' Po:'+poN,x+6,y+18);
  ctx.fillStyle=_gcSpikeT>0?'#f87171':'#9ca3af';
  ctx.fillText('lastSpike:'+_lastBigDt+'ms'+(_lowQ?' LOW':''),x+6,y+30);
  ctx.fillStyle='#6b7280';ctx.font='9px monospace';
  ctx.fillText('tap here 3x to close',x+6,y+44);
}

function drawCoin(c){
  const p=Math.sin(c.p)*0.2+1,sz=c.sz*p;
  const cTier=getCoinTier();
  ctx.fillStyle=cTier.col;ctx.beginPath();ctx.arc(c.x,c.y,sz,0,TAU);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.4)';ctx.beginPath();ctx.arc(c.x-sz*0.2,c.y-sz*0.2,sz*0.3,0,TAU);ctx.fill();
  if(cTier.mul>1&&frame%4===0){ctx.fillStyle=cTier.col+'66';ctx.beginPath();ctx.arc(c.x+(Math.random()-0.5)*sz*2,c.y+(Math.random()-0.5)*sz*2,1+Math.random(),0,TAU);ctx.fill();}
}
function drawItem(it){
  const pl=Math.sin(it.p)*0.15+1,sz=it.sz*pl,col=ITEMS[it.t].col;
  const isHeart=it.t===3;
  ctx.fillStyle=isHeart?'#fff':col;
  ctx.save();ctx.translate(it.x,it.y);
  if(it.onCeil)ctx.scale(1,-1);
  ctx.rotate(Math.PI/4+it.p*0.3);
  rr(-sz/2,-sz/2,sz,sz,3);ctx.fill();
  ctx.rotate(-(Math.PI/4+it.p*0.3));
  ctx.fillStyle=isHeart?col:'#fff';ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(ITEMS[it.t].icon,0,1);ctx.textBaseline='alphabetic';ctx.restore();
}

// Speed tier for current enemy draw frame (0=normal,1=1.3x,2=1.5x,3=2.0x,4=2.5x)
// Set once per drawEnemy call; draw functions read this global directly (no per-call overhead)
let _esmTier=0;
function _drawEnemyEliteAccent(en,s,col){
  if(_esmTier<=0)return;
  ctx.save();
  ctx.translate(en.x,en.y);
  if(en.gDir===-1)ctx.scale(1,-1);
  ctx.globalAlpha=_esmTier>=2?0.9:0.55;
  ctx.fillStyle=col;
  ctx.beginPath();
  ctx.arc(0,-s*1.02,_esmTier>=2?s*0.15:s*0.11,0,TAU);
  ctx.fill();
  ctx.fillStyle='#fff8';
  ctx.beginPath();
  ctx.arc(0,-s*1.02,_esmTier>=2?s*0.06:s*0.045,0,TAU);
  ctx.fill();
  if(_esmTier>=2){
    ctx.strokeStyle=col+'aa';
    ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.moveTo(-s*0.55,-s*0.7);ctx.lineTo(-s*0.18,-s*0.56);
    ctx.moveTo(s*0.55,-s*0.7);ctx.lineTo(s*0.18,-s*0.56);
    ctx.stroke();
  }
  ctx.restore();
}
function drawEnemy(en){
  if(en.bossType==='dodge'){drawBossDodge(en);return;}
  if(en.bossType==='bruiser'){drawBossBruiser(en);return;}
  if(en.bossType==='guardian'){drawBossGuardian(en);return;}
  if(en.bossType==='wizard'){if(en.variant==='snowman')drawBossSnowman(en);else drawBossWizard(en);return;}
  // Set speed tier once (single enemySpeedMul() call per enemy)
  if(!isPackMode){const e=enemySpeedMul();_esmTier=e>=2.5?4:e>=2.0?3:e>=1.5?2:e>=1.3?1:0;}
  else{_esmTier=0;}
  if(en.type===1)drawShooter(en);
  else if(en.type===2)drawFlyer(en);
  else if(en.type===3)drawBomber(en);
  else if(en.type===4)drawVertMover(en);
  else if(en.type===5)drawPhantom(en);
  else if(en.type===6)drawDasher(en);
  else if(en.type===7)drawBird(en);
  else if(en.type===8)drawSplitter(en);
  else if(en.type===9)drawMiniSlime(en);
  else if(en.type===14)drawLeaper(en);
  else{
    // Walker (type 0) - mushroom/goomba with speed tier skin
    const s=en.sz,flip=en.gDir;
    const wb=_esmTier>=2?'#5a2810':_esmTier>=1?'#734018':'#6b3410';
    const wi=_esmTier>=2?'#8f4a28':_esmTier>=1?'#b16439':'#a0522d';
    const wf0=_esmTier>=2?'#3d1c06':_esmTier>=1?'#513010':'#4a2508';
    const ep=_esmTier>=2?'#ff3030':_esmTier>=1?'#2b1200':'#1a0a00';
    ctx.save();ctx.translate(en.x,en.y);
    if(flip===-1)ctx.scale(1,-1);
    ctx.fillStyle=wb;ctx.beginPath();ctx.arc(0,-s*0.15,s*0.85,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=wi;ctx.beginPath();ctx.arc(0,-s*0.15,s*0.5,0,Math.PI*2);ctx.fill();
    const fw=s*0.3,fh=s*0.2,step=Math.sin(en.fr*2)*s*0.18;
    ctx.fillStyle=wf0;
    ctx.fillRect(-s*0.5+step,s*0.4,fw,fh);ctx.fillRect(s*0.2-step,s*0.4,fw,fh);
    if(en.patrolDir!==undefined){
      const arrowX=en.patrolDir>0?s*0.6:-s*0.6;
      ctx.beginPath();ctx.moveTo(arrowX,0);ctx.lineTo(arrowX-en.patrolDir*4,-3);ctx.lineTo(arrowX-en.patrolDir*4,3);ctx.closePath();ctx.fill();
    }
    ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(-s*0.25,-s*0.25,s*0.22,0,TAU);ctx.fill();
    ctx.beginPath();ctx.arc(s*0.25,-s*0.25,s*0.22,0,TAU);ctx.fill();
    ctx.fillStyle=ep;
    ctx.beginPath();ctx.arc(-s*0.2,-s*0.28,s*0.12,0,TAU);ctx.fill();
    ctx.beginPath();ctx.arc(s*0.3,-s*0.28,s*0.12,0,TAU);ctx.fill();
    ctx.strokeStyle=wf0;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-s*0.45,-s*0.3);ctx.lineTo(-s*0.1,-s*0.48);ctx.stroke();
    ctx.beginPath();ctx.moveTo(s*0.45,-s*0.3);ctx.lineTo(s*0.1,-s*0.48);ctx.stroke();
    ctx.restore();
    _drawEnemyEliteAccent(en,s,_esmTier>=2?'#ff5f5f':'#a78bfa');
  }
}
function drawFlyer(en){
  const s=en.sz;
  const b0=_esmTier>=2?'#9f3412':_esmTier>=1?'#cc5a1a':'#c2410c';
  const b1=_esmTier>=2?'#db5b20':_esmTier>=1?'#ff8433':'#f97316';
  const bw=_esmTier>=2?'#7c250d':_esmTier>=1?'#ef7430':'#ea580c';
  const ep=_esmTier>=2?'#ff3030':_esmTier>=1?'#2a1200':'#1a0a00';
  ctx.save();ctx.translate(en.x,en.y);
  if(en.gDir===-1)ctx.scale(1,-1);
  ctx.fillStyle=b0;ctx.beginPath();ctx.arc(0,0,s*0.8,0,TAU);ctx.fill();
  ctx.fillStyle=b1;ctx.beginPath();ctx.arc(0,0,s*0.45,0,TAU);ctx.fill();
  const wf=Math.sin(en.fr*1.2)*6;
  ctx.fillStyle=bw;
  ctx.beginPath();ctx.moveTo(-s*0.7,0);ctx.quadraticCurveTo(-s-8,-6+wf,-s-3,-14+wf);ctx.quadraticCurveTo(-s*0.5+2,-4,-s*0.7,0);ctx.fill();
  ctx.beginPath();ctx.moveTo(s*0.7,0);ctx.quadraticCurveTo(s+8,-6+wf,s+3,-14+wf);ctx.quadraticCurveTo(s*0.5-2,-4,s*0.7,0);ctx.fill();
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.15,s*0.2,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.2,-s*0.15,s*0.2,0,TAU);ctx.fill();
  ctx.fillStyle=ep;
  ctx.beginPath();ctx.arc(-s*0.15,-s*0.18,s*0.1,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.25,-s*0.18,s*0.1,0,TAU);ctx.fill();
  ctx.strokeStyle=b0;ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(-s*0.4,-s*0.2);ctx.lineTo(-s*0.05,-s*0.38);ctx.stroke();
  ctx.beginPath();ctx.moveTo(s*0.4,-s*0.2);ctx.lineTo(s*0.05,-s*0.38);ctx.stroke();
  ctx.restore();
  _drawEnemyEliteAccent(en,s,_esmTier>=2?'#ff6b6b':'#5eead4');
}
function drawShooter(en){
  const s=en.sz;
  const so=_esmTier>=2?'#55208f':_esmTier>=1?'#7a2cc2':'#6b21a8';
  const sm=_esmTier>=2?'#481670':_esmTier>=1?'#6620a5':'#581c87';
  const si=_esmTier>=2?'#7e3dc2':_esmTier>=1?'#aa58f2':'#9333ea';
  const sc=_esmTier>=2?'#351056':_esmTier>=1?'#5c169c':'#4a1080';
  const eg=_esmTier>=2?'#ff3030':_esmTier>=1?'#f7d36b':'#fbbf24';
  ctx.save();ctx.translate(en.x,en.y);
  if(en.gDir===-1)ctx.scale(1,-1);
  ctx.fillStyle=so;
  ctx.beginPath();
  for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2;const r=i%2===0?s*1.1:s*0.65;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r-s*0.1);}
  ctx.closePath();ctx.fill();
  ctx.fillStyle=sm;ctx.beginPath();ctx.arc(0,-s*0.1,s*0.6,0,TAU);ctx.fill();
  ctx.fillStyle=si;ctx.beginPath();ctx.arc(0,-s*0.1,s*0.35,0,TAU);ctx.fill();
  ctx.fillStyle=sc;ctx.fillRect(-s*1.1,-s*0.15,s*0.6,s*0.3);
  ctx.fillStyle=eg;ctx.beginPath();ctx.arc(0,-s*0.2,s*0.28,0,TAU);ctx.fill();
  ctx.fillStyle='#1a0a00';ctx.beginPath();ctx.arc(s*0.05,-s*0.22,s*0.13,0,TAU);ctx.fill();
  if(en.shootT<30){
    ctx.globalAlpha=0.5+Math.sin(en.fr*3)*0.5;
    ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(-s*1.1,0,s*0.25,0,TAU);ctx.fill();
    ctx.globalAlpha=1;
  }
  ctx.restore();
  _drawEnemyEliteAccent(en,s,_esmTier>=2?'#ff7a7a':'#60a5fa');
}
function drawBomber(en){
  const s=en.sz,t=en.fr;
  const b0=_esmTier>=2?'#115226':_esmTier>=1?'#1b7a3d':'#166534';
  const b1=_esmTier>=2?'#1d8f46':_esmTier>=1?'#2fd06a':'#22c55e';
  const sh=_esmTier>=2?'#0e401d':_esmTier>=1?'#1d8b47':'#15803d';
  const sa=_esmTier>=2?'#0a2b14':_esmTier>=1?'#156a32':'#0d5a28';
  const ep=_esmTier>=2?'#ff3030':_esmTier>=1?'#16351e':'#111';
  ctx.save();ctx.translate(en.x,en.y);
  ctx.fillStyle=b0;ctx.beginPath();ctx.arc(0,-s*0.1,s*0.85,0,TAU);ctx.fill();
  ctx.fillStyle=b1;ctx.beginPath();ctx.arc(0,-s*0.1,s*0.5,0,TAU);ctx.fill();
  ctx.fillStyle=sh;ctx.beginPath();ctx.arc(0,-s*0.3,s*0.65,Math.PI,0);ctx.fill();
  ctx.strokeStyle=sa;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(-s*0.3,-s*0.55);ctx.lineTo(0,-s*0.7);ctx.lineTo(s*0.3,-s*0.55);ctx.stroke();
  const throwAnim=t<15?Math.sin(t/15*Math.PI):-0.2;
  ctx.strokeStyle=b1;ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(-s*0.5,-s*0.1);
  ctx.quadraticCurveTo(-s*0.8,-s*0.5-throwAnim*s*0.8,-s*0.6,-s*0.8-throwAnim*s*0.5);
  ctx.stroke();
  if(en.bombCD<25&&en.bombCD>5){
    ctx.fillStyle='#333';ctx.beginPath();ctx.arc(-s*0.6,-s*0.9,s*0.2,0,TAU);ctx.fill();
    ctx.fillStyle='#ff6600';ctx.beginPath();ctx.arc(-s*0.5,-s*1.05,s*0.08,0,TAU);ctx.fill();
  }
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.2,s*0.2,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.2,-s*0.2,s*0.2,0,TAU);ctx.fill();
  ctx.fillStyle=ep;
  ctx.beginPath();ctx.arc(-s*0.15,-s*0.22,s*0.1,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.25,-s*0.22,s*0.1,0,TAU);ctx.fill();
  ctx.strokeStyle=sa;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(0,s*0.1,s*0.25,0.2,Math.PI-0.2);ctx.stroke();
  const step=Math.sin(t*0.08)*s*0.08;
  ctx.fillStyle=b0;
  ctx.fillRect(-s*0.45+step,s*0.45,s*0.25,s*0.15);
  ctx.fillRect(s*0.2-step,s*0.45,s*0.25,s*0.15);
  ctx.restore();
  _drawEnemyEliteAccent(en,s,_esmTier>=2?'#ff7a7a':'#2dd4bf');
}
function drawVertMover(en){
  const s=en.sz;
  const b0=_esmTier>=2?'#17357f':_esmTier>=1?'#2955cf':'#2244aa';
  const b1=_esmTier>=2?'#315cb8':_esmTier>=1?'#5d93ff':'#4488ff';
  const ep=_esmTier>=2?'#ff3030':_esmTier>=1?'#11224d':'#111';
  ctx.save();ctx.translate(en.x,en.y);
  const squash=en.pauseT>0?1.2:0.9+Math.abs(Math.sin(en.fr*0.15))*0.2;
  ctx.scale(1/squash,squash);
  ctx.fillStyle=b0;ctx.beginPath();ctx.arc(0,0,s*0.9,0,TAU);ctx.fill();
  ctx.fillStyle=b1;ctx.beginPath();ctx.arc(0,0,s*0.5,0,TAU);ctx.fill();
  ctx.fillStyle='#fff5';
  const arrowY=en.moveDir<0?-s*0.5:s*0.5;
  ctx.beginPath();ctx.moveTo(-s*0.3,arrowY);ctx.lineTo(0,arrowY+en.moveDir*(-s*0.4));ctx.lineTo(s*0.3,arrowY);ctx.closePath();ctx.fill();
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.15,s*0.2,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.2,-s*0.15,s*0.2,0,TAU);ctx.fill();
  ctx.fillStyle=ep;
  const eyeOff=en.moveDir<0?-s*0.06:s*0.06;
  ctx.beginPath();ctx.arc(-s*0.15,-s*0.15+eyeOff,s*0.1,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.25,-s*0.15+eyeOff,s*0.1,0,TAU);ctx.fill();
  ctx.restore();
  _drawEnemyEliteAccent(en,s,_esmTier>=2?'#ff7a7a':'#a78bfa');
}
function drawPhantom(en){
  const s=en.sz;
  const pb=_esmTier>=2?'#6ec2e8':_esmTier>=1?'#9ae6ff':'#88ddff';
  const pi=_esmTier>=2?'rgba(110,194,232,0.28)':_esmTier>=1?'rgba(154,230,255,0.25)':'rgba(200,240,255,0.3)';
  const pe=_esmTier>=2?'#ff3030':_esmTier>=1?'#4b1899':'#4400aa';
  let alpha=1;
  if(!en.visible){alpha=en.fadeT>0?en.fadeT/20*0.95:0.03;}
  else if(en.fadeT>0){alpha=0.03+(1-en.fadeT/20)*0.97;}
  ctx.save();ctx.translate(en.x,en.y);
  if(en.gDir===-1)ctx.scale(1,-1);
  ctx.globalAlpha=alpha;
  const wobble=Math.sin(en.fr*0.1)*s*0.1;
  ctx.fillStyle=pb;
  ctx.beginPath();
  ctx.moveTo(-s*0.7,-s*0.3);
  ctx.quadraticCurveTo(-s*0.8,-s*0.8,0,-s*0.9);
  ctx.quadraticCurveTo(s*0.8,-s*0.8,s*0.7,-s*0.3);
  ctx.quadraticCurveTo(s*0.8,s*0.3,s*0.5+wobble,s*0.8);
  ctx.quadraticCurveTo(s*0.2,s*0.5,0,s*0.7+wobble*0.5);
  ctx.quadraticCurveTo(-s*0.2,s*0.5,-s*0.5-wobble,s*0.8);
  ctx.quadraticCurveTo(-s*0.8,s*0.3,-s*0.7,-s*0.3);
  ctx.closePath();ctx.fill();
  ctx.fillStyle=pi;ctx.beginPath();ctx.arc(0,-s*0.2,s*0.4,0,TAU);ctx.fill();
  ctx.fillStyle=en.visible?'#fff':'#fff4';
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.3,s*0.18,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.2,-s*0.3,s*0.18,0,TAU);ctx.fill();
  ctx.fillStyle=en.visible?pe:(pe+'44');
  ctx.beginPath();ctx.arc(-s*0.15,-s*0.32,s*0.1,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.25,-s*0.32,s*0.1,0,TAU);ctx.fill();
  ctx.globalAlpha=1;
  ctx.restore();
  _drawEnemyEliteAccent(en,s,_esmTier>=2?'#ff8a8a':'#fbbf24');
}
function drawDasher(en){
  const s=en.sz,ds=en.dashState;
  const t1=_esmTier===1,t2=_esmTier>=2;
  // Body colors per tier
  const bd=t2?(ds==='dash'?'#6b0208':'#7b0a10'):t1?(ds==='dash'?'#b51e24':'#a90f15'):(ds==='dash'?'#aa0000':'#9d0208');
  const bl=t2?(ds==='dash'?'#9c1016':'#8d0a10'):t1?(ds==='dash'?'#ff5a5f':'#ef4444'):(ds==='dash'?'#ff2222':'#e63946');
  const be=t2?(ds==='warn'||ds==='dash'?'#c21f26':'#a01218'):t1?(ds==='warn'||ds==='dash'?'#ff6b6b':'#dc2626'):(ds==='warn'||ds==='dash'?'#ff4444':'#c1121f');
  const ew='#fff';
  const ep=t2?'#ff3030':(ds==='warn'||ds==='dash'?'#ff0000':'#1a0a00');
  const mc=t2?(ds==='dash'?'#7d1116':'#611015'):t1?(ds==='dash'?'#ffb703':'#a61e1e'):(ds==='dash'?'#ffaa00':'#780000');
  const fc=t2?'#571015':t1?'#7f1d1d':'#780000';
  ctx.save();ctx.translate(en.x,en.y);
  if(en.gDir===-1)ctx.scale(1,-1);
  if(ds==='warn'){const shake=Math.sin(en.warnT*1.5)*(3-en.warnT*0.05);ctx.translate(shake,0);}
  const stretch=ds==='dash'?1.3:1;ctx.scale(stretch,1/stretch);
  ctx.fillStyle=bd;ctx.beginPath();ctx.arc(0,-s*0.1,s*0.85,0,TAU);ctx.fill();
  ctx.fillStyle=bl;ctx.beginPath();ctx.arc(0,-s*0.1,s*0.5,0,TAU);ctx.fill();
  if(ds==='dash'){
    ctx.strokeStyle='#ff444466';ctx.lineWidth=2;
    for(let i=0;i<3;i++){const ly=-s*0.5+i*s*0.4;ctx.beginPath();ctx.moveTo(-en.dashDir*s*1.2,ly);ctx.lineTo(-en.dashDir*s*2.5,ly);ctx.stroke();}
  }
  ctx.fillStyle=be;
  ctx.beginPath();ctx.moveTo(-s*0.55,-s*0.5);ctx.lineTo(-s*0.35,-s*1.1);ctx.lineTo(-s*0.1,-s*0.5);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(s*0.55,-s*0.5);ctx.lineTo(s*0.35,-s*1.1);ctx.lineTo(s*0.1,-s*0.5);ctx.closePath();ctx.fill();
  ctx.fillStyle=ew;
  ctx.beginPath();ctx.arc(-s*0.25,-s*0.2,s*0.2,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.25,-s*0.2,s*0.2,0,TAU);ctx.fill();
  ctx.fillStyle=ep;
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.22,s*0.1,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.3,-s*0.22,s*0.1,0,TAU);ctx.fill();
  ctx.strokeStyle=mc;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(-s*0.3,s*0.15);ctx.lineTo(-s*0.15,s*0.25);ctx.lineTo(0,s*0.15);ctx.lineTo(s*0.15,s*0.25);ctx.lineTo(s*0.3,s*0.15);ctx.stroke();
  const stepSpd=ds==='dash'?6:2,step=Math.sin(en.fr*stepSpd)*s*0.2;
  ctx.fillStyle=fc;
  ctx.fillRect(-s*0.5+step,s*0.4,s*0.28,s*0.2);ctx.fillRect(s*0.22-step,s*0.4,s*0.28,s*0.2);
  if(ds==='warn'){
    const wa=Math.sin(en.warnT*0.3)*0.3+0.7;
    ctx.globalAlpha=wa;ctx.fillStyle='#ff0';ctx.font='bold 14px monospace';ctx.textAlign='center';
    ctx.fillText('!',0,-s*1.4);ctx.globalAlpha=1;
  }
  ctx.restore();
  _drawEnemyEliteAccent(en,s,_esmTier>=2?'#ff7474':'#fb7185');
}
function drawBird(en){
  const s=en.sz;
  const b0=_esmTier>=2?'#dbdbdb':_esmTier>=1?'#f6f6f6':'#f0f0f0';
  const b1=_esmTier>=2?'#f0f0f0':_esmTier>=1?'#ffffff':'#fff';
  const bw=_esmTier>=2?'#bdbdbd':_esmTier>=1?'#d9d9d9':'#d0d0d0';
  const bt=_esmTier>=2?'#8b8b8b':_esmTier>=1?'#ababab':'#999';
  const ep=_esmTier>=2?'#ff3030':_esmTier>=1?'#333':'#222';
  ctx.save();ctx.translate(en.x,en.y);
  if(en.gDir===-1)ctx.scale(1,-1);
  ctx.scale(-1,1);
  const wf=Math.sin(en.fr*1.8)*0.6;
  ctx.fillStyle=b0;ctx.beginPath();ctx.ellipse(0,0,s*0.7,s*0.55,0,0,TAU);ctx.fill();
  ctx.fillStyle=b1;ctx.beginPath();ctx.ellipse(0,s*0.1,s*0.45,s*0.35,0,0,TAU);ctx.fill();
  ctx.fillStyle=bw;
  ctx.save();ctx.translate(-s*0.5,-s*0.1);ctx.rotate(wf);
  ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-s*0.4,-s*0.7,-s*0.8,-s*0.5);ctx.quadraticCurveTo(-s*0.5,s*0.1,0,0);ctx.fill();
  ctx.restore();
  ctx.save();ctx.translate(s*0.5,-s*0.1);ctx.rotate(-wf);
  ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(s*0.4,-s*0.7,s*0.8,-s*0.5);ctx.quadraticCurveTo(s*0.5,s*0.1,0,0);ctx.fill();
  ctx.restore();
  ctx.fillStyle=bt;
  ctx.save();ctx.translate(-s*0.5,-s*0.1);ctx.rotate(wf);
  ctx.beginPath();ctx.moveTo(-s*0.5,-s*0.5);ctx.quadraticCurveTo(-s*0.6,-s*0.6,-s*0.8,-s*0.5);ctx.quadraticCurveTo(-s*0.6,-s*0.35,-s*0.5,-s*0.5);ctx.fill();
  ctx.restore();
  ctx.save();ctx.translate(s*0.5,-s*0.1);ctx.rotate(-wf);
  ctx.beginPath();ctx.moveTo(s*0.5,-s*0.5);ctx.quadraticCurveTo(s*0.6,-s*0.6,s*0.8,-s*0.5);ctx.quadraticCurveTo(s*0.6,-s*0.35,s*0.5,-s*0.5);ctx.fill();
  ctx.restore();
  ctx.fillStyle=ep;
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.15,s*0.1,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.2,-s*0.15,s*0.1,0,TAU);ctx.fill();
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(-s*0.17,-s*0.18,s*0.04,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.23,-s*0.18,s*0.04,0,TAU);ctx.fill();
  ctx.fillStyle='#ff8c00';
  ctx.beginPath();ctx.moveTo(0,-s*0.05);ctx.lineTo(-s*0.12,s*0.05);ctx.lineTo(s*0.12,s*0.05);ctx.closePath();ctx.fill();
  ctx.fillStyle=bw;
  ctx.beginPath();ctx.moveTo(s*0.55,-s*0.1);ctx.lineTo(s*0.9,0);ctx.lineTo(s*0.85,-s*0.2);ctx.lineTo(s*0.55,-s*0.1);ctx.fill();
  ctx.restore();
  _drawEnemyEliteAccent(en,s,_esmTier>=2?'#ff8a8a':'#fbbf24');
}
function drawSplitter(en){
  const s=en.sz,flip=en.gDir;
  const isMagma=isPackMode&&currentPackIdx===2;
  const b0=_esmTier>=2?(isMagma?'#a12d00':'#2a6f12'):_esmTier>=1?(isMagma?'#d64510':'#3f981a'):(isMagma?'#cc3300':'#338811');
  const b1=_esmTier>=2?(isMagma?'#cc5d1b':'#4f8f22'):_esmTier>=1?(isMagma?'#ff7a33':'#69bd2e'):(isMagma?'#ff6622':'#55aa22');
  const bc=_esmTier>=2?(isMagma?'#e3a02a':'#75b030'):_esmTier>=1?(isMagma?'#ffd15a':'#9fe057'):(isMagma?'#ffcc44':'#88cc44');
  const bs=_esmTier>=2?(isMagma?'#ffcf8844':'#d3ef8a44'):_esmTier>=1?(isMagma?'#ffeeaa55':'#e4ff9955'):(isMagma?'#ffee8844':'#bbff6644');
  const ep=_esmTier>=2?'#ff3030':_esmTier>=1?(isMagma?'#5a1800':'#254b05'):(isMagma?'#441100':'#1a3300');
  const sl=_esmTier>=2?(isMagma?'#7b200044':'#295d1044'):_esmTier>=1?(isMagma?'#a6380044':'#3b7b1844'):(isMagma?'#88330044':'#44660044');
  ctx.save();ctx.translate(en.x,en.y);
  if(flip===-1)ctx.scale(1,-1);
  ctx.fillStyle=b0;
  const wobble=Math.sin(en.fr*0.8)*s*0.08;
  ctx.beginPath();
  ctx.moveTo(-s*0.8-wobble,s*0.3);
  ctx.quadraticCurveTo(-s*0.9,s*-0.3,-s*0.4-wobble,-s*0.7);
  ctx.quadraticCurveTo(0,-s*1.0+wobble,s*0.4+wobble,-s*0.7);
  ctx.quadraticCurveTo(s*0.9,s*-0.3,s*0.8+wobble,s*0.3);
  ctx.quadraticCurveTo(s*0.4,s*0.5,0,s*0.4);
  ctx.quadraticCurveTo(-s*0.4,s*0.5,-s*0.8-wobble,s*0.3);
  ctx.closePath();ctx.fill();
  ctx.fillStyle=b1;ctx.beginPath();ctx.arc(0,-s*0.1,s*0.55,0,TAU);ctx.fill();
  ctx.fillStyle=bc;ctx.beginPath();ctx.arc(0,-s*0.1,s*0.25,0,TAU);ctx.fill();
  ctx.fillStyle=bs;ctx.beginPath();ctx.ellipse(-s*0.2,-s*0.3,s*0.15,s*0.25,0.3,0,TAU);ctx.fill();
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(-s*0.25,-s*0.15,s*0.2,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.25,-s*0.15,s*0.2,0,TAU);ctx.fill();
  ctx.fillStyle=ep;
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.18,s*0.1,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.3,-s*0.18,s*0.1,0,TAU);ctx.fill();
  ctx.strokeStyle=sl;ctx.lineWidth=1.5;ctx.setLineDash([3,3]);
  ctx.beginPath();ctx.moveTo(0,-s*0.7);ctx.lineTo(0,s*0.35);ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  _drawEnemyEliteAccent(en,s,_esmTier>=2?'#ff8a8a':'#22d3ee');
}
function drawMiniSlime(en){
  const s=en.sz,flip=en.gDir;
  const isMagma=isPackMode&&currentPackIdx===2;
  const b0=_esmTier>=2?(isMagma?'#a12d00':'#2a6f12'):_esmTier>=1?(isMagma?'#d64510':'#3f981a'):(isMagma?'#cc3300':'#338811');
  const b1=_esmTier>=2?(isMagma?'#cc5d1b':'#4f8f22'):_esmTier>=1?(isMagma?'#ff7a33':'#69bd2e'):(isMagma?'#ff6622':'#55aa22');
  const bc=_esmTier>=2?(isMagma?'#e3a02a':'#75b030'):_esmTier>=1?(isMagma?'#ffd15a':'#9fe057'):(isMagma?'#ffcc44':'#88cc44');
  const bs=_esmTier>=2?(isMagma?'#ffcf8844':'#d3ef8a44'):_esmTier>=1?(isMagma?'#ffeeaa55':'#e4ff9955'):(isMagma?'#ffee8844':'#bbff6644');
  const ep=_esmTier>=2?'#ff3030':_esmTier>=1?(isMagma?'#5a1800':'#254b05'):(isMagma?'#441100':'#1a3300');
  ctx.save();ctx.translate(en.x,en.y);
  if(flip===-1)ctx.scale(1,-1);
  ctx.fillStyle=b0;
  const wobble=Math.sin(en.fr*1.2)*s*0.12;
  ctx.beginPath();
  ctx.moveTo(-s*0.8-wobble,s*0.3);
  ctx.quadraticCurveTo(-s*0.9,s*-0.3,-s*0.4-wobble,-s*0.7);
  ctx.quadraticCurveTo(0,-s*1.0+wobble,s*0.4+wobble,-s*0.7);
  ctx.quadraticCurveTo(s*0.9,s*-0.3,s*0.8+wobble,s*0.3);
  ctx.quadraticCurveTo(s*0.4,s*0.5,0,s*0.4);
  ctx.quadraticCurveTo(-s*0.4,s*0.5,-s*0.8-wobble,s*0.3);
  ctx.closePath();ctx.fill();
  ctx.fillStyle=b1;ctx.beginPath();ctx.arc(0,-s*0.1,s*0.5,0,TAU);ctx.fill();
  ctx.fillStyle=bc;ctx.beginPath();ctx.arc(0,-s*0.1,s*0.2,0,TAU);ctx.fill();
  ctx.fillStyle=bs;ctx.beginPath();ctx.ellipse(-s*0.15,-s*0.25,s*0.12,s*0.2,0.3,0,TAU);ctx.fill();
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.15,s*0.18,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.2,-s*0.15,s*0.18,0,TAU);ctx.fill();
  ctx.fillStyle=ep;
  ctx.beginPath();ctx.arc(-s*0.15,-s*0.18,s*0.09,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.25,-s*0.18,s*0.09,0,TAU);ctx.fill();
  ctx.restore();
  _drawEnemyEliteAccent(en,s,_esmTier>=2?'#ff8a8a':'#22d3ee');
}
function drawLeaper(en){
  const s=en.sz,flip=en.gDir;
  const state=en._state||'patrol';
  const isNotice=state==='notice';
  const isJump=state==='jumping';
  // Squash/stretch: crouch before jump, stretch in air
  const scX=isNotice?0.78:isJump?0.65:1.0;
  const scY=isNotice?1.25:isJump?1.45:1.0;
  ctx.save();ctx.translate(en.x,en.y);
  if(flip===-1)ctx.scale(1,-1);
  ctx.scale(scX,scY);
  // Body: soft round green
  ctx.fillStyle=_esmTier>=2?'#22aa22':_esmTier>=1?'#44bb22':'#55cc33';
  ctx.beginPath();ctx.ellipse(0,-s*0.08,s*0.78,s*0.72,0,0,TAU);ctx.fill();
  ctx.fillStyle=_esmTier>=2?'#55cc44':_esmTier>=1?'#77dd44':'#88ee55';
  ctx.beginPath();ctx.ellipse(s*0.06,-s*0.14,s*0.48,s*0.44,0,0,TAU);ctx.fill();
  // Shine
  ctx.fillStyle='rgba(255,255,255,0.22)';ctx.beginPath();ctx.ellipse(-s*0.18,-s*0.36,s*0.22,s*0.13,-0.4,0,TAU);ctx.fill();
  // Big cute eyes
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(-s*0.24,-s*0.20,s*0.22,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.24,-s*0.20,s*0.22,0,TAU);ctx.fill();
  // Pupils: wide when noticing
  const pupR=isNotice?s*0.16:s*0.11;
  const pupCol=_esmTier>=2?'#3b0000':_esmTier>=1?'#1a2800':'#1a3300';
  ctx.fillStyle=pupCol;
  ctx.beginPath();ctx.arc(-s*0.22,-s*0.22,pupR,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.26,-s*0.22,pupR,0,TAU);ctx.fill();
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(-s*0.17,-s*0.27,s*0.05,0,TAU);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.30,-s*0.27,s*0.05,0,TAU);ctx.fill();
  // Rosy blush marks (cute!)
  ctx.fillStyle='rgba(255,110,110,0.28)';
  ctx.beginPath();ctx.ellipse(-s*0.48,-s*0.08,s*0.15,s*0.09,0,0,TAU);ctx.fill();
  ctx.beginPath();ctx.ellipse(s*0.48,-s*0.08,s*0.15,s*0.09,0,0,TAU);ctx.fill();
  // Stubby feet
  const legStep=state==='patrol'?Math.sin(en.fr*2.5)*s*0.14:0;
  ctx.fillStyle=_esmTier>=2?'#117711':'#44aa22';
  ctx.beginPath();ctx.ellipse(-s*0.28+legStep,s*0.56,s*0.22,s*0.14,0,0,TAU);ctx.fill();
  ctx.beginPath();ctx.ellipse(s*0.28-legStep,s*0.56,s*0.22,s*0.14,0,0,TAU);ctx.fill();
  // Notice "!" bubble
  if(isNotice){
    const ba=0.7+Math.sin(en.fr*0.55)*0.3;
    ctx.globalAlpha=ba;
    ctx.fillStyle='#ff6600';ctx.font='bold '+(s*1.3)+'px monospace';ctx.textAlign='center';
    ctx.fillText('!',0,-s*1.7);
    ctx.globalAlpha=1;
  }
  ctx.restore();
  _drawEnemyEliteAccent(en,s,_esmTier>=2?'#ff8a8a':'#66dd22');
}
function drawBullet(b){
  ctx.save();ctx.translate(b.x,b.y);
  if(b.shockwave){
    // Shockwave: vertical energy wave traveling along floor
    const alpha=Math.min(1,b.life/20);
    ctx.globalAlpha=alpha;
    const waveH=30+Math.sin(b.life*0.3)*5;
    if(_lowQ){
      ctx.fillStyle='#ff8800';ctx.beginPath();ctx.moveTo(-b.sz*0.5,0);ctx.lineTo(0,-waveH*0.7);ctx.lineTo(b.sz*0.5,0);ctx.closePath();ctx.fill();
    } else {
      const gr=ctx.createLinearGradient(0,0,0,-waveH);
      gr.addColorStop(0,'#ffaa00');gr.addColorStop(0.5,'#ff660088');gr.addColorStop(1,'#ff660000');
      ctx.fillStyle=gr;
      ctx.beginPath();ctx.moveTo(-b.sz*0.6,0);ctx.lineTo(-b.sz*0.2,-waveH);
      ctx.lineTo(b.sz*0.2,-waveH);ctx.lineTo(b.sz*0.6,0);ctx.closePath();ctx.fill();
      // Bright core
      ctx.fillStyle='#ffdd44';ctx.beginPath();
      ctx.moveTo(-b.sz*0.3,0);ctx.lineTo(0,-waveH*0.7);ctx.lineTo(b.sz*0.3,0);ctx.closePath();ctx.fill();
    }
    ctx.globalAlpha=1;ctx.restore();return;
  }
  if(b.bomb){
    // Bomb projectile
    ctx.fillStyle='#333';ctx.beginPath();ctx.arc(0,0,b.sz,0,TAU);ctx.fill();
    ctx.fillStyle='#555';ctx.beginPath();ctx.arc(-b.sz*0.2,-b.sz*0.2,b.sz*0.4,0,TAU);ctx.fill();
    // Fuse
    ctx.strokeStyle='#aa8800';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(0,-b.sz);ctx.quadraticCurveTo(b.sz*0.5,-b.sz*1.5,b.sz*0.3,-b.sz*1.8);ctx.stroke();
    // Spark
    ctx.fillStyle='#ff6600';
    ctx.beginPath();ctx.arc(b.sz*0.3,-b.sz*1.8,2+Math.random()*2,0,TAU);ctx.fill();
  } else if(b.wizBullet){
    if(b.icicle){
      // Icicle projectile - horizontal ice spike pointing left
      const iw=b.sz*3,ih=b.sz*0.8;
      ctx.fillStyle='rgba(160,220,255,0.9)';
      ctx.beginPath();ctx.moveTo(iw/2,0);ctx.lineTo(-iw/2,-ih);ctx.lineTo(-iw/2,ih);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(220,240,255,0.6)';
      ctx.beginPath();ctx.moveTo(iw/2,0);ctx.lineTo(-iw/2,-ih*0.4);ctx.lineTo(-iw/2,ih*0.4);ctx.closePath();ctx.fill();
    } else {
      // Wizard magic bullet - purple energy orb
      ctx.fillStyle='#aa44ff';ctx.beginPath();ctx.arc(0,0,b.sz,0,TAU);ctx.fill();
      ctx.fillStyle='#eeccff';ctx.beginPath();ctx.arc(0,0,b.sz*0.4,0,TAU);ctx.fill();
    }
  } else {
    ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(0,0,b.sz,0,TAU);ctx.fill();
    ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.arc(0,0,b.sz*0.5,0,TAU);ctx.fill();
    // Trail behind bullet (in direction of travel)
    ctx.fillStyle='#ef444444';
    ctx.beginPath();ctx.arc(b.sz+4,0,b.sz*0.6,0,TAU);ctx.fill();
    ctx.beginPath();ctx.arc(b.sz+10,0,b.sz*0.3,0,TAU);ctx.fill();
  }
  ctx.restore();
}

function drawCharacter(x,y,charIdx,r,rot,alpha,face,dmgLevel,showCosmetics){
  dmgLevel=dmgLevel||0; // 0=full HP, 1=hurt once, 2=critical
  if(showCosmetics===undefined)showCosmetics=(charIdx===selChar);
  const ch=CHARS[charIdx];
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  // When upside-down (on ceiling), flip horizontally so face still looks right/forward
  // Skip tire (always spinning) and ghost (always upright, charRot=0)
  const normRot=((rot%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
  if(ch.shape!=='tire'&&normRot>Math.PI*0.5&&normRot<Math.PI*1.5)ctx.scale(-1,1);
  ctx.globalAlpha=alpha;
  // Apply skin color override (always, even when damaged)
  const skinData=showCosmetics?getEquippedSkinData():null;
  const isSkeleton=skinData&&skinData.col==='skeleton';
  let bodyCol=ch.col,bodyCol2=ch.col2;
  const isAurora=skinData&&skinData.col==='aurora';
  const isHologram=skinData&&skinData.col==='hologram';
  const isCubeSpecialRainbow=
    state===ST.PLAY&&charIdx===selChar&&ch.shape==='cube'&&cubeSpecialActive();
  if(skinData&&!isSkeleton&&!isAurora&&!isHologram){
    if(skinData.col==='rainbow'){
      const rh=(frame*3)%360;
      bodyCol='hsl('+rh+',90%,60%)';bodyCol2='hsl('+((rh+40)%360)+',80%,40%)';
    } else {bodyCol=skinData.col;bodyCol2=skinData.col2;}
  }
  if(isAurora){
    const ah=(frame*2)%360;
    bodyCol='hsl('+((ah+160)%360)+',90%,60%)';bodyCol2='hsl('+((ah+270)%360)+',80%,50%)';
  }
  if(isHologram){
    const hh=(frame*4)%360;
    bodyCol='hsla('+hh+',80%,70%,0.15)';bodyCol2='hsla('+((hh+60)%360)+',70%,60%,0.1)';
  }
  if(isCubeSpecialRainbow){
    const rh=(frame*10)%360;
    bodyCol='hsl('+rh+',95%,62%)';
    bodyCol2='hsl('+((rh+55)%360)+',92%,46%)';
  }
  if(isSkeleton){bodyCol='rgba(255,255,255,0.06)';bodyCol2='rgba(255,255,255,0.02)';}
  // Layered fills instead of gradient for character body
  // Skeleton: draw body at very low opacity
  if(isSkeleton)ctx.globalAlpha=alpha*0.1;
  if(isHologram)ctx.globalAlpha=alpha*0.25;

  switch(ch.shape){
    case'cube':
      ctx.fillStyle=bodyCol2;rr(-r,-r,r*2,r*2,r*0.3);ctx.fill();
      ctx.fillStyle=bodyCol;rr(-r*0.6,-r*0.6,r*1.2,r*1.2,r*0.2);ctx.fill();
      ctx.fillStyle=isCubeSpecialRainbow?'hsla('+((frame*10+140)%360)+',100%,78%,0.35)':'rgba(255,255,255,0.12)';
      rr(-r*0.75,-r*0.75,r*1.5,r*1.5,r*0.2);ctx.fill();
      if(isCubeSpecialRainbow){
        ctx.strokeStyle='hsla('+((frame*10+220)%360)+',100%,85%,0.9)';
        ctx.lineWidth=Math.max(2,r*0.12);
        rr(-r*0.86,-r*0.86,r*1.72,r*1.72,r*0.26);ctx.stroke();
      }
      break;
    case'ball':
      ctx.fillStyle=bodyCol2;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
      ctx.fillStyle=bodyCol;ctx.beginPath();ctx.arc(0,0,r*0.6,0,TAU);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.15)';ctx.beginPath();ctx.arc(-r*0.2,-r*0.2,r*0.6,0,TAU);ctx.fill();
      break;
    case'tire':
      // Outer tire ring
      ctx.fillStyle=bodyCol2;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
      ctx.fillStyle=bodyCol;ctx.beginPath();ctx.arc(0,0,r*0.75,0,TAU);ctx.fill();
      // Inner hub (lighter)
      ctx.fillStyle=dmgLevel>=2?'#666':'#888';
      ctx.beginPath();ctx.arc(0,0,r*0.5,0,TAU);ctx.fill();
      // Tread pattern (rotating)
      ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=r*0.12;
      for(let i=0;i<6;i++){
        const ta=rot+i*Math.PI/3;
        ctx.beginPath();ctx.moveTo(Math.cos(ta)*r*0.55,Math.sin(ta)*r*0.55);
        ctx.lineTo(Math.cos(ta)*r*0.92,Math.sin(ta)*r*0.92);ctx.stroke();
      }
      // Hub cap highlight
      ctx.fillStyle='rgba(255,255,255,0.1)';ctx.beginPath();ctx.arc(-r*0.15,-r*0.15,r*0.25,0,TAU);ctx.fill();
      break;
    case'ghost':
      ctx.fillStyle=bodyCol2;ctx.beginPath();ctx.arc(0,-r*0.15,r,Math.PI,0);
      ctx.lineTo(r,r);
      for(let i=0;i<4;i++){const bx=r-i*(r*2/4)-r*2/8;ctx.quadraticCurveTo(bx+r/8,r-r*0.35,bx-r/8,r);}
      ctx.closePath();ctx.fill();
      break;
    case'ninja':
      ctx.fillStyle=bodyCol2;rr(-r,-r,r*2,r*2,r*0.25);ctx.fill();
      ctx.fillStyle=bodyCol;rr(-r*0.6,-r*0.6,r*1.2,r*1.2,r*0.18);ctx.fill();
      // headband
      ctx.fillStyle='#1a1a1a';ctx.fillRect(-r*1.1,-r*0.1,r*2.2,r*0.35);
      // tail
      ctx.strokeStyle='#1a1a1a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r*0.8,-r*0.1);ctx.quadraticCurveTo(r*1.4,-r*0.5,r*1.6,-r*0.8);ctx.stroke();
      break;
    case'stone':
      // Rocky angular shape
      ctx.fillStyle=bodyCol2;
      ctx.beginPath();
      ctx.moveTo(-r*0.5,-r*0.9);ctx.lineTo(r*0.4,-r*0.85);ctx.lineTo(r*0.85,-r*0.3);
      ctx.lineTo(r*0.9,r*0.3);ctx.lineTo(r*0.5,r*0.85);ctx.lineTo(-r*0.3,r*0.9);
      ctx.lineTo(-r*0.85,r*0.4);ctx.lineTo(-r*0.9,-r*0.2);ctx.closePath();ctx.fill();
      // Crack lines
      ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(-r*0.3,-r*0.4);ctx.lineTo(r*0.1,-r*0.1);ctx.lineTo(-r*0.1,r*0.3);ctx.stroke();
      ctx.beginPath();ctx.moveTo(r*0.2,-r*0.5);ctx.lineTo(r*0.4,r*0.1);ctx.stroke();
      // Highlight
      ctx.fillStyle='rgba(255,255,255,0.15)';
      ctx.beginPath();ctx.moveTo(-r*0.4,-r*0.7);ctx.lineTo(r*0.2,-r*0.65);ctx.lineTo(0,-r*0.2);ctx.lineTo(-r*0.5,-r*0.1);ctx.closePath();ctx.fill();
      break;
  }

  // Skeleton: restore alpha and draw white outline
  if(isSkeleton){
    ctx.globalAlpha=alpha;
    ctx.strokeStyle='rgba(255,255,255,0.85)';ctx.lineWidth=3;
    switch(ch.shape){
      case'cube': rr(-r,-r,r*2,r*2,r*0.3);ctx.stroke();break;
      case'ball': ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();break;
      case'tire': ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();
        ctx.beginPath();ctx.arc(0,0,r*0.5,0,TAU);ctx.stroke();break;
      case'ghost': ctx.beginPath();ctx.arc(0,-r*0.15,r,Math.PI,0);ctx.lineTo(r,r);
        for(let i=0;i<4;i++){const bx=r-i*(r*2/4)-r*2/8;ctx.quadraticCurveTo(bx+r/8,r-r*0.35,bx-r/8,r);}
        ctx.closePath();ctx.stroke();break;
      case'ninja': rr(-r,-r,r*2,r*2,r*0.25);ctx.stroke();break;
      case'stone': ctx.beginPath();ctx.moveTo(-r*0.5,-r*0.9);ctx.lineTo(r*0.4,-r*0.85);ctx.lineTo(r*0.85,-r*0.3);
        ctx.lineTo(r*0.9,r*0.3);ctx.lineTo(r*0.5,r*0.85);ctx.lineTo(-r*0.3,r*0.9);
        ctx.lineTo(-r*0.85,r*0.4);ctx.lineTo(-r*0.9,-r*0.2);ctx.closePath();ctx.stroke();break;
    }
  }

  // Hologram: restore alpha and draw shifting hue outline that pulses
  if(isHologram){
    ctx.globalAlpha=alpha*(0.6+Math.sin(frame*0.1)*0.3);
    const hHue=(frame*6)%360;
    ctx.strokeStyle=`hsl(${hHue},100%,70%)`;ctx.lineWidth=2+Math.sin(frame*0.15);
    switch(ch.shape){
      case'cube': rr(-r,-r,r*2,r*2,r*0.3);ctx.stroke();break;
      case'ball': ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();break;
      case'tire': ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();
        ctx.beginPath();ctx.arc(0,0,r*0.5,0,TAU);ctx.stroke();break;
      case'ghost': ctx.beginPath();ctx.arc(0,-r*0.15,r,Math.PI,0);ctx.lineTo(r,r);
        for(let i=0;i<4;i++){const bx=r-i*(r*2/4)-r*2/8;ctx.quadraticCurveTo(bx+r/8,r-r*0.35,bx-r/8,r);}
        ctx.closePath();ctx.stroke();break;
      case'ninja': rr(-r,-r,r*2,r*2,r*0.25);ctx.stroke();break;
      case'stone': ctx.beginPath();ctx.moveTo(-r*0.5,-r*0.9);ctx.lineTo(r*0.4,-r*0.85);ctx.lineTo(r*0.85,-r*0.3);
        ctx.lineTo(r*0.9,r*0.3);ctx.lineTo(r*0.5,r*0.85);ctx.lineTo(-r*0.3,r*0.9);
        ctx.lineTo(-r*0.85,r*0.4);ctx.lineTo(-r*0.9,-r*0.2);ctx.closePath();ctx.stroke();break;
    }
    ctx.globalAlpha=alpha;
  }

  // Damage overlays — drawn BEFORE face so eyes always appear on top
  if(dmgLevel>=1){
    // Danger pulse outline (pulsing red ring around body)
    const dp=0.25+Math.sin(frame*0.18)*0.15;
    ctx.strokeStyle=`rgba(255,40,40,${dp})`;ctx.lineWidth=r*0.28;
    ctx.beginPath();ctx.arc(0,0,r*1.08,0,TAU);ctx.stroke();
    // Scratches — positioned LEFT side and LOWER RIGHT to avoid eye area (eye is at ~r*0.2, -r*0.15)
    ctx.strokeStyle='rgba(60,20,0,0.7)';ctx.lineWidth=1.5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-r*0.7,-r*0.2);ctx.lineTo(-r*0.2,r*0.35);ctx.stroke(); // left diagonal
    ctx.beginPath();ctx.moveTo(r*0.15,r*0.15);ctx.lineTo(r*0.55,r*0.55);ctx.stroke();  // lower-right, below eye
    ctx.fillStyle='rgba(40,20,10,0.35)';
    ctx.beginPath();ctx.arc(-r*0.38,r*0.38,r*0.2,0,TAU);ctx.fill(); // lower-left soot
  }
  if(dmgLevel>=2){
    ctx.strokeStyle='rgba(80,10,0,0.75)';ctx.lineWidth=2;
    // Crack runs down LEFT half — eye is on RIGHT, so no overlap
    ctx.beginPath();ctx.moveTo(-r*0.35,-r*0.85);ctx.lineTo(-r*0.2,-r*0.35);
    ctx.lineTo(-r*0.4,-r*0.15);ctx.lineTo(-r*0.2,r*0.25);
    ctx.lineTo(-r*0.3,r*0.5);ctx.stroke();
    ctx.fillStyle='rgba(40,20,10,0.45)';
    ctx.beginPath();ctx.arc(r*0.3,r*0.32,r*0.2,0,TAU);ctx.fill();  // lower-right soot
    ctx.beginPath();ctx.arc(-r*0.55,-r*0.25,r*0.15,0,TAU);ctx.fill(); // upper-left soot
    // Bandage on left side
    ctx.strokeStyle='rgba(255,255,220,0.7)';ctx.lineWidth=r*0.15;
    ctx.beginPath();ctx.moveTo(-r*0.75,r*0.05);ctx.lineTo(-r*0.3,r*0.05);ctx.stroke();
    ctx.strokeStyle='rgba(200,50,50,0.5)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(-r*0.62,r*0.0);ctx.lineTo(-r*0.62,r*0.1);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-r*0.42,r*0.0);ctx.lineTo(-r*0.42,r*0.1);ctx.stroke();
  }
  const accessoryData=showCosmetics?getEquippedAccessoryData():null;
  if(accessoryData)drawCharacterAccessory(accessoryData.type,r,alpha);
  // Face
  const eY=face==='dead'?0:-r*0.15;
  const eyeData=showCosmetics?getEquippedEyesData():null;
  if(face==='dead'){
    ctx.strokeStyle=ch.eye;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(r*0.05,eY-r*0.15);ctx.lineTo(r*0.35,eY+r*0.15);ctx.stroke();
    ctx.beginPath();ctx.moveTo(r*0.35,eY-r*0.15);ctx.lineTo(r*0.05,eY+r*0.15);ctx.stroke();
  }else if(eyeData){
    // Custom eye types
    const ex=r*0.2,ey2=eY,es=r*0.28;
    switch(eyeData.type){
      case'smile':
        // Happy smiling eyes (^_^) - black
        ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.lineCap='round';
        ctx.beginPath();ctx.arc(ex,ey2,es*0.8,Math.PI+0.3,2*Math.PI-0.3);ctx.stroke();
        break;
      case'angry':
        // Cute angry eye with pout
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        ctx.fillStyle='#442200';ctx.beginPath();ctx.arc(ex+r*0.06,ey2+es*0.05,es*0.55,0,TAU);ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex+r*0.12,ey2-es*0.2,es*0.18,0,TAU);ctx.fill();
        // Cute angled brow (softer)
        ctx.strokeStyle='#663300';ctx.lineWidth=2;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(ex-es*0.6,ey2-es*1.0);ctx.lineTo(ex+es*0.4,ey2-es*0.65);ctx.stroke();
        // Cute pout mouth
        ctx.strokeStyle='#cc6644';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(ex-es*0.2,ey2+es*1.2,es*0.3,Math.PI+0.4,2*Math.PI-0.4);ctx.stroke();
        break;
      case'star':
        // Yellow star with default eye in center
        ctx.fillStyle='#ffd700';
        ctx.beginPath();
        for(let si=0;si<5;si++){const a=-Math.PI/2+si*Math.PI*2/5,a2=a+Math.PI/5;
          ctx.lineTo(ex+Math.cos(a)*es*1.1,ey2+Math.sin(a)*es*1.1);
          ctx.lineTo(ex+Math.cos(a2)*es*0.45,ey2+Math.sin(a2)*es*0.45);
        }ctx.closePath();ctx.fill();
        // Default eye in center of star
        ctx.fillStyle=ch.eye;ctx.beginPath();ctx.arc(ex,ey2,es*0.4,0,TAU);ctx.fill();
        ctx.fillStyle=ch.pupil;ctx.beginPath();ctx.arc(ex+es*0.1,ey2,es*0.2,0,TAU);ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex+es*0.15,ey2-es*0.1,es*0.08,0,TAU);ctx.fill();
        break;
      case'heart':
        // Full red heart with vertical thickness
        ctx.fillStyle='#ee1111';
        ctx.save();ctx.translate(ex,ey2);
        const hs=es*0.9;ctx.beginPath();ctx.moveTo(0,hs*0.8);
        ctx.bezierCurveTo(-hs*0.2,hs*0.5,-hs*1.1,hs*0.1,-hs*1.0,-hs*0.35);
        ctx.bezierCurveTo(-hs*0.9,-hs*0.85,-hs*0.2,-hs*0.95,0,-hs*0.45);
        ctx.bezierCurveTo(hs*0.2,-hs*0.95,hs*0.9,-hs*0.85,hs*1.0,-hs*0.35);
        ctx.bezierCurveTo(hs*1.1,hs*0.1,hs*0.2,hs*0.5,0,hs*0.8);
        ctx.fill();
        // Highlight
        ctx.fillStyle='rgba(255,255,255,0.35)';
        ctx.beginPath();ctx.ellipse(-hs*0.35,-hs*0.35,hs*0.2,hs*0.28,Math.PI/6,0,TAU);ctx.fill();
        ctx.restore();
        break;
      case'fire':
        ctx.fillStyle='#ff2200';ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        ctx.fillStyle='#ff6600';ctx.beginPath();ctx.arc(ex+r*0.04,ey2,es*0.65,0,TAU);ctx.fill();
        ctx.fillStyle='#ffcc00';ctx.beginPath();ctx.arc(ex+r*0.08,ey2,es*0.3,0,TAU);ctx.fill();
        break;
      case'cat':
        ctx.fillStyle='#ccff44';ctx.beginPath();ctx.ellipse(ex,ey2,es,es*0.9,0,0,TAU);ctx.fill();
        ctx.fillStyle='#111';
        ctx.beginPath();ctx.ellipse(ex+r*0.06,ey2,es*0.12,es*0.7,0,0,TAU);ctx.fill();
        break;
      case'spiral':
        ctx.fillStyle=ch.eye;ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        ctx.strokeStyle=ch.pupil;ctx.lineWidth=0.8;ctx.beginPath();
        for(let si=0;si<20;si++){const sa=si*0.8,sr=es*0.1+si*es*0.035;
          const sx=ex+Math.cos(sa+(typeof frame!=='undefined'?frame*0.1:0))*sr;
          const sy=ey2+Math.sin(sa+(typeof frame!=='undefined'?frame*0.1:0))*sr;
          if(si===0)ctx.moveTo(sx,sy);else ctx.lineTo(sx,sy);
        }ctx.stroke();
        break;
      case'cyber':
        ctx.fillStyle='#00ff88';ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        ctx.strokeStyle='#003322';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(ex-es,ey2);ctx.lineTo(ex+es,ey2);ctx.stroke();
        ctx.beginPath();ctx.moveTo(ex,ey2-es);ctx.lineTo(ex,ey2+es);ctx.stroke();
        ctx.fillStyle='#003322';ctx.beginPath();ctx.arc(ex+r*0.06,ey2,es*0.25,0,TAU);ctx.fill();
        ctx.fillStyle='#00ff88';ctx.beginPath();ctx.arc(ex+r*0.08,ey2,es*0.1,0,TAU);ctx.fill();
        break;
      case'diamond':
        ctx.fillStyle='#aaeeff';
        ctx.beginPath();ctx.moveTo(ex,ey2-es);ctx.lineTo(ex+es*0.7,ey2);
        ctx.lineTo(ex,ey2+es);ctx.lineTo(ex-es*0.7,ey2);ctx.closePath();ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.6)';
        ctx.beginPath();ctx.moveTo(ex,ey2-es);ctx.lineTo(ex+es*0.3,ey2);ctx.lineTo(ex,ey2*0.5);ctx.closePath();ctx.fill();
        break;
      case'void':
        ctx.fillStyle='#111';ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        ctx.fillStyle='#330044';ctx.beginPath();ctx.arc(ex,ey2,es*0.7,0,TAU);ctx.fill();
        ctx.fillStyle='#220033';ctx.beginPath();ctx.arc(ex,ey2,es*0.4,0,TAU);ctx.fill();
        // Tiny white dot
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex+r*0.04,ey2-es*0.1,es*0.08,0,TAU);ctx.fill();
        break;
      case'galaxy':
        ctx.fillStyle='#0a0a2e';ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        // Swirling galaxy dots
        for(let gi=0;gi<6;gi++){const ga=gi*1.047+(typeof frame!=='undefined'?frame*0.04:0),gd=es*(0.3+gi*0.1);
          ctx.fillStyle=`hsla(${(gi*60+200)%360},80%,70%,0.7)`;
          ctx.beginPath();ctx.arc(ex+Math.cos(ga)*gd,ey2+Math.sin(ga)*gd,es*0.08,0,TAU);ctx.fill();}
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey2,es*0.12,0,TAU);ctx.fill();
        break;
      case'glitch':
        ctx.fillStyle=ch.eye;ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        ctx.fillStyle=ch.pupil;ctx.beginPath();ctx.arc(ex+r*0.08,ey2,es*0.5,0,TAU);ctx.fill();
        // Glitch offset slices
        const gt=typeof frame!=='undefined'?frame:0;
        if(gt%30<5){ctx.fillStyle='#ff004488';ctx.fillRect(ex-es,ey2-es*0.3,es*2,es*0.2);
          ctx.fillStyle='#00ff4488';ctx.fillRect(ex-es+2,ey2+es*0.1,es*2,es*0.15);}
        break;
      case'blink':{
        // Blinking eye - normal eye with periodic blink animation
        const bt=typeof frame!=='undefined'?frame:0;
        const bc=bt%180; // 180 frame cycle (~3 sec)
        const blinking=bc>=170&&bc<180; // blink for 10 frames
        const halfBlink=bc>=168&&bc<170||bc>=178&&bc<180; // half-close
        if(blinking){
          // Closed eye - horizontal line
          ctx.strokeStyle=ch.eye;ctx.lineWidth=1.5;ctx.lineCap='round';
          ctx.beginPath();ctx.moveTo(ex-es*0.7,ey2);ctx.lineTo(ex+es*0.7,ey2);ctx.stroke();
        } else if(halfBlink){
          // Half-closed - squished ellipse
          ctx.fillStyle=ch.eye;ctx.beginPath();ctx.ellipse(ex,ey2,es,es*0.3,0,0,TAU);ctx.fill();
          ctx.fillStyle=ch.pupil;ctx.beginPath();ctx.ellipse(ex+r*0.08,ey2,es*0.5,es*0.15,0,0,TAU);ctx.fill();
        } else {
          // Normal open eye with shine
          ctx.fillStyle=ch.eye;ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
          ctx.fillStyle=ch.pupil;ctx.beginPath();ctx.arc(ex+r*0.08,ey2,es*0.5,0,TAU);ctx.fill();
          ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex+r*0.14,ey2-es*0.2,es*0.15,0,TAU);ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.4)';ctx.beginPath();ctx.arc(ex-r*0.04,ey2+es*0.2,es*0.08,0,TAU);ctx.fill();
        }
        break;}
      case'pulse':{
        // Pulsing circular white eyes that scale up and down
        const pt=typeof frame!=='undefined'?frame:0;
        const pScale=1+Math.sin(pt*0.12)*0.25;
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey2,es*pScale,0,TAU);ctx.fill();
        ctx.fillStyle=ch.pupil;ctx.beginPath();ctx.arc(ex+r*0.06,ey2,es*0.4*pScale,0,TAU);ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.5)';ctx.beginPath();ctx.arc(ex+r*0.1,ey2-es*0.15,es*0.12*pScale,0,TAU);ctx.fill();
        break;}
      case'cross':{
        // Cross-shaped (+) glowing pupils
        ctx.fillStyle=ch.eye;ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        const ct2=typeof frame!=='undefined'?frame:0;
        const cGlow=0.7+Math.sin(ct2*0.1)*0.3;
        ctx.strokeStyle=`rgba(255,255,100,${cGlow})`;ctx.lineWidth=2;ctx.lineCap='round';
        const cs=es*0.5;
        ctx.beginPath();ctx.moveTo(ex,ey2-cs);ctx.lineTo(ex,ey2+cs);ctx.stroke();
        ctx.beginPath();ctx.moveTo(ex-cs,ey2);ctx.lineTo(ex+cs,ey2);ctx.stroke();
        break;}
      case'hypno':{
        // Animated concentric rings that rotate (spinning spiral)
        const ht=typeof frame!=='undefined'?frame:0;
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        ctx.save();ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.clip();
        ctx.strokeStyle='#6600cc';ctx.lineWidth=1.2;
        for(let hi=1;hi<=4;hi++){
          const hr=es*0.2*hi;
          const hOff=ht*0.08*((hi%2===0)?1:-1);
          ctx.beginPath();ctx.arc(ex+Math.cos(hOff)*hr*0.15,ey2+Math.sin(hOff)*hr*0.15,hr,0,TAU);ctx.stroke();
        }
        ctx.fillStyle='#6600cc';ctx.beginPath();ctx.arc(ex,ey2,es*0.1,0,TAU);ctx.fill();
        ctx.restore();
        break;}
      case'sleepy':
        ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(ex-es*0.85,ey2);ctx.quadraticCurveTo(ex,ey2+es*0.35,ex+es*0.85,ey2);ctx.stroke();
        ctx.fillStyle='rgba(100,180,255,0.75)';ctx.beginPath();ctx.arc(ex+es*0.9,ey2+es*0.55,es*0.18,0,TAU);ctx.fill();
        break;
      case'coin':
        ctx.fillStyle='#ffd700';ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        ctx.strokeStyle='#fff3';ctx.lineWidth=1;ctx.beginPath();ctx.arc(ex,ey2,es*0.7,0,TAU);ctx.stroke();
        ctx.fillStyle='#7a4a00';ctx.font='bold '+Math.max(6,es*1.3)+'px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('$',ex,ey2+0.5);ctx.textBaseline='alphabetic';
        break;
      case'moon':
        ctx.fillStyle='#fef3c7';ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        ctx.fillStyle='rgba(20,20,50,0.9)';ctx.beginPath();ctx.arc(ex+es*0.45,ey2-es*0.05,es*0.95,0,TAU);ctx.fill();
        break;
      case'target':
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        ctx.strokeStyle='#ef4444';ctx.lineWidth=1.3;
        ctx.beginPath();ctx.arc(ex,ey2,es*0.7,0,TAU);ctx.stroke();
        ctx.beginPath();ctx.arc(ex,ey2,es*0.35,0,TAU);ctx.stroke();
        ctx.beginPath();ctx.moveTo(ex-es,ey2);ctx.lineTo(ex+es,ey2);ctx.moveTo(ex,ey2-es);ctx.lineTo(ex,ey2+es);ctx.stroke();
        ctx.fillStyle='#111';ctx.beginPath();ctx.arc(ex,ey2,es*0.16,0,TAU);ctx.fill();
        break;
      case'prism':{
        const pg=ctx.createLinearGradient(ex-es,ey2-es,ex+es,ey2+es);
        pg.addColorStop(0,'#22d3ee');pg.addColorStop(0.5,'#fef08a');pg.addColorStop(1,'#fb7185');
        ctx.fillStyle=pg;ctx.beginPath();ctx.moveTo(ex,ey2-es);ctx.lineTo(ex+es*0.9,ey2+es*0.75);ctx.lineTo(ex-es*0.9,ey2+es*0.75);ctx.closePath();ctx.fill();
        ctx.strokeStyle='#fff8';ctx.lineWidth=1;ctx.stroke();
        break;}
      case'laser':
        ctx.fillStyle='#020617';ctx.beginPath();ctx.ellipse(ex,ey2,es*1.05,es*0.6,0,0,TAU);ctx.fill();
        ctx.strokeStyle='#ef4444';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(ex-es*0.95,ey2);ctx.lineTo(ex+es*0.95,ey2);ctx.stroke();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex+es*0.25,ey2-es*0.08,es*0.12,0,TAU);ctx.fill();
        break;
      case'tears':
        ctx.fillStyle='#dbeafe';ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        ctx.fillStyle='#1d4ed8';ctx.beginPath();ctx.arc(ex+es*0.15,ey2,es*0.45,0,TAU);ctx.fill();
        ctx.fillStyle='rgba(96,165,250,0.85)';ctx.beginPath();ctx.ellipse(ex+es*0.25,ey2+es*1.1,es*0.22,es*0.45,0,0,TAU);ctx.fill();
        break;
      case'crown':
        ctx.fillStyle='#fff7ed';ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        ctx.fillStyle='#f59e0b';ctx.beginPath();
        ctx.moveTo(ex-es*0.75,ey2-es*0.15);ctx.lineTo(ex-es*0.35,ey2-es*0.75);ctx.lineTo(ex,ey2-es*0.2);
        ctx.lineTo(ex+es*0.35,ey2-es*0.75);ctx.lineTo(ex+es*0.75,ey2-es*0.15);ctx.lineTo(ex+es*0.65,ey2+es*0.35);ctx.lineTo(ex-es*0.65,ey2+es*0.35);ctx.closePath();ctx.fill();
        ctx.fillStyle='#7c2d12';ctx.beginPath();ctx.arc(ex,ey2+es*0.05,es*0.18,0,TAU);ctx.fill();
        break;
      case'eclipse':
        ctx.fillStyle='#facc15';ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        ctx.fillStyle='#020617';ctx.beginPath();ctx.arc(ex+es*0.12,ey2,es*0.82,0,TAU);ctx.fill();
        ctx.strokeStyle='rgba(250,204,21,0.8)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(ex,ey2,es*1.12,0,TAU);ctx.stroke();
        break;
      case'constellation':
        ctx.fillStyle='#0f172a';ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        ctx.strokeStyle='#93c5fd';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(ex-es*0.45,ey2+es*0.2);ctx.lineTo(ex-es*0.1,ey2-es*0.35);ctx.lineTo(ex+es*0.35,ey2-es*0.1);ctx.lineTo(ex+es*0.1,ey2+es*0.45);ctx.stroke();
        ctx.fillStyle='#fff';
        [[-0.45,0.2],[-0.1,-0.35],[0.35,-0.1],[0.1,0.45]].forEach(p=>{ctx.beginPath();ctx.arc(ex+p[0]*es,ey2+p[1]*es,es*0.12,0,TAU);ctx.fill();});
        break;
      default:
        ctx.fillStyle=ch.eye;ctx.beginPath();ctx.arc(ex,ey2,es,0,TAU);ctx.fill();
        ctx.fillStyle=ch.pupil;ctx.beginPath();ctx.arc(ex+r*0.08,ey2,es*0.5,0,TAU);ctx.fill();
    }
    if(face==='happy'){ctx.strokeStyle=ch.eye;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(r*0.15,eY+r*0.3,r*0.15,0.2,Math.PI-0.2);ctx.stroke();}
    if(face==='hurt'){ctx.strokeStyle=ch.eye;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-r*0.1,eY+r*0.4);ctx.lineTo(r*0.05,eY+r*0.3);ctx.lineTo(r*0.2,eY+r*0.45);ctx.lineTo(r*0.35,eY+r*0.3);ctx.stroke();}
  }else{
    ctx.fillStyle=ch.eye;ctx.beginPath();ctx.arc(r*0.2,eY,r*0.28,0,TAU);ctx.fill();
    ctx.fillStyle=ch.pupil;ctx.beginPath();ctx.arc(r*0.28,eY,r*0.14,0,TAU);ctx.fill();
    ctx.fillStyle=ch.eye;ctx.beginPath();ctx.arc(r*0.33,eY-r*0.1,r*0.06,0,TAU);ctx.fill();
    if(face==='happy'){ctx.strokeStyle=ch.eye;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(r*0.15,eY+r*0.3,r*0.15,0.2,Math.PI-0.2);ctx.stroke();}
    if(face==='hurt'){
      // Grimace mouth
      ctx.strokeStyle=ch.eye;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(-r*0.1,eY+r*0.4);
      ctx.lineTo(r*0.05,eY+r*0.3);ctx.lineTo(r*0.2,eY+r*0.45);ctx.lineTo(r*0.35,eY+r*0.3);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawCharacterAccessory(accType,r,alpha){
  const t=frame||0;
  ctx.save();
  ctx.globalAlpha=alpha;
  switch(accType){
    case'halo':{
      const hy=-r*1.15+Math.sin(t*0.12)*2;
      ctx.strokeStyle='rgba(255,236,160,0.95)';ctx.lineWidth=Math.max(2,r*0.14);
      ctx.beginPath();ctx.ellipse(0,hy,r*0.7,r*0.22,0,0,TAU);ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,0.35)';ctx.lineWidth=Math.max(1,r*0.06);
      ctx.beginPath();ctx.ellipse(0,hy,r*0.45,r*0.12,0,0,TAU);ctx.stroke();
      for(let i=0;i<4;i++){
        const a=t*0.08+i*1.57;
        ctx.fillStyle='rgba(255,247,200,'+(0.45+Math.sin(t*0.12+i)*0.2)+')';
        ctx.beginPath();ctx.arc(Math.cos(a)*r*0.95,hy+Math.sin(a)*r*0.18,r*0.08,0,TAU);ctx.fill();
      }
      break;
    }
    case'crown':{
      const cy=-r*1.08+Math.sin(t*0.08)*1.5;
      ctx.fillStyle='#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-r*0.66,cy+r*0.2);
      ctx.lineTo(-r*0.48,cy-r*0.22);
      ctx.lineTo(-r*0.14,cy+r*0.02);
      ctx.lineTo(0,cy-r*0.34);
      ctx.lineTo(r*0.14,cy+r*0.02);
      ctx.lineTo(r*0.48,cy-r*0.22);
      ctx.lineTo(r*0.66,cy+r*0.2);
      ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(255,246,180,0.9)';ctx.lineWidth=Math.max(1.5,r*0.08);ctx.stroke();
      ctx.fillStyle='#fff7c2';
      for(let i=0;i<3;i++){
        const px=(i-1)*r*0.32;
        ctx.beginPath();ctx.arc(px,cy-r*(i===1?0.22:0.08),r*0.08,0,TAU);ctx.fill();
      }
      for(let i=0;i<3;i++){
        ctx.fillStyle='rgba(255,230,120,'+(0.4+Math.sin(t*0.18+i)*0.25)+')';
        ctx.beginPath();ctx.arc((i-1)*r*0.5,cy-r*0.45-Math.sin(t*0.14+i)*3,r*0.06,0,TAU);ctx.fill();
      }
      break;
    }
    case'ribbon':{
      const sway=Math.sin(t*0.11)*r*0.05;
      const rx=-r*0.52+sway*0.3,ry=-r*0.82+Math.sin(t*0.12)*1.6;
      const tailSwing=Math.sin(t*0.12);
      const leftWing=ctx.createLinearGradient(rx-r*0.4,ry-r*0.18,rx,ry+r*0.18);
      leftWing.addColorStop(0,'#ffb1d0');leftWing.addColorStop(1,'#ff5f97');
      const rightWing=ctx.createLinearGradient(rx,ry-r*0.2,rx+r*0.42,ry+r*0.2);
      rightWing.addColorStop(0,'#ff8ebd');rightWing.addColorStop(1,'#ff4f8b');
      ctx.fillStyle=leftWing;
      ctx.beginPath();
      ctx.moveTo(rx-r*0.04,ry);
      ctx.bezierCurveTo(rx-r*0.22,ry-r*0.34,rx-r*0.52,ry-r*0.16,rx-r*0.42,ry+r*0.12);
      ctx.bezierCurveTo(rx-r*0.28,ry+r*0.2,rx-r*0.12,ry+r*0.12,rx-r*0.02,ry+r*0.03);
      ctx.closePath();ctx.fill();
      ctx.fillStyle=rightWing;
      ctx.beginPath();
      ctx.moveTo(rx+r*0.03,ry-r*0.01);
      ctx.bezierCurveTo(rx+r*0.2,ry-r*0.34,rx+r*0.5,ry-r*0.14,rx+r*0.42,ry+r*0.16);
      ctx.bezierCurveTo(rx+r*0.26,ry+r*0.24,rx+r*0.12,ry+r*0.14,rx+r*0.01,ry+r*0.02);
      ctx.closePath();ctx.fill();
      ctx.fillStyle='#ffe6f1';
      ctx.beginPath();ctx.ellipse(rx,ry,r*0.12,r*0.1,0,0,TAU);ctx.fill();
      ctx.fillStyle='#ff79ad';
      ctx.beginPath();
      ctx.moveTo(rx-r*0.05,ry+r*0.07);
      ctx.lineTo(rx-r*0.18,ry+r*0.42+tailSwing*r*0.08);
      ctx.lineTo(rx-r*0.01,ry+r*0.25);
      ctx.closePath();ctx.fill();
      ctx.beginPath();
      ctx.moveTo(rx+r*0.04,ry+r*0.08);
      ctx.lineTo(rx+r*0.22,ry+r*0.38-tailSwing*r*0.07);
      ctx.lineTo(rx+r*0.03,ry+r*0.23);
      ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(255,241,247,0.9)';ctx.lineWidth=Math.max(1,r*0.05);
      ctx.beginPath();
      ctx.moveTo(rx-r*0.03,ry-r*0.02);ctx.quadraticCurveTo(rx-r*0.18,ry-r*0.2,rx-r*0.34,ry-r*0.04);
      ctx.moveTo(rx+r*0.03,ry-r*0.02);ctx.quadraticCurveTo(rx+r*0.18,ry-r*0.22,rx+r*0.34,ry-r*0.02);
      ctx.stroke();
      for(let i=0;i<4;i++){
        ctx.fillStyle='rgba(255,227,240,'+(0.32+Math.sin(t*0.16+i)*0.2)+')';
        ctx.beginPath();ctx.arc(rx-r*0.22+i*r*0.15,ry-r*0.34-i*r*0.02,r*(0.055-i*0.008),0,TAU);ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

function drawPlayer(){
  const pr=playerRadius();
  // Flashing during hurt invincibility
  if(hurtT>0&&Math.floor(hurtT/4)%2===0)return; // blink effect
  let ghostA=1;
  if(hurtT>0)ghostA*=0.7; // slightly transparent during hurt
  // Ghost character transparency phase - visually show the evasion state
  if(ghostInvis){
    ghostA*=0.15+Math.sin(frame*0.3)*0.05; // very transparent + shimmer
  }
  // Puff pet invis phase - slight transparency with pulse
  if(petPuffInvis){
    ghostA*=0.28+Math.sin(frame*0.4)*0.06;
  }
  const dmgLv=isPackMode?0:(maxHp()-hp); // stage mode: always look undamaged

  // Invincible ring (rainbow pulsing)
  if(itemEff.invincible>0){
    const ic=['#ff00ff','#ffff00','#00ffff'][Math.floor(frame*0.15)%3];
    ctx.strokeStyle=ic;
    const ending=itemEff.invincible<=90;
    if(ending){
      // Rapid shrinking flash when ending
      ctx.lineWidth=2+Math.abs(Math.sin(frame*0.5))*3;
      ctx.globalAlpha=Math.abs(Math.sin(frame*(itemEff.invincible<30?0.8:0.4)))*0.8;
    } else {
      ctx.lineWidth=3;ctx.globalAlpha=0.7;
    }
    ctx.lineWidth=ending?3:4;
    ctx.beginPath();ctx.arc(player.x,player.y,pr+(ending?6+Math.sin(frame*0.6)*4:12),0,TAU);ctx.stroke();ctx.globalAlpha=1;
  }
  // Gravity arrow
  ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=2;ctx.lineCap='round';
  const ay=player.gDir===1?pr+6:-pr-6,ad=player.gDir;
  ctx.beginPath();ctx.moveTo(player.x-5,player.y+ay-3*ad);ctx.lineTo(player.x,player.y+ay+3*ad);ctx.lineTo(player.x+5,player.y+ay-3*ad);ctx.stroke();
  ctx.lineCap='butt';

  // Quake stun indicator (stars spinning around player)
  if(player._quakeStunned){
    ghostA*=0.6+Math.sin(frame*0.3)*0.15;
    for(let i=0;i<3;i++){
      const sa=frame*0.08+i*2.09;
      const sx=player.x+Math.cos(sa)*pr*1.5,sy=player.y+Math.sin(sa*1.3)*pr*0.6-pr;
      ctx.fillStyle='#ffdd00';ctx.font='bold 10px monospace';ctx.textAlign='center';
      ctx.fillText('\u2605',sx,sy);
    }
    ctx.fillStyle='rgba(255,100,0,0.3)';
    ctx.beginPath();ctx.arc(player.x,player.y,pr*1.2,0,TAU);ctx.fill();
  }
  // Magma damage red flash overlay
  if(magmaHurtT>0){
    const mAlpha=magmaHurtT/30*0.6;
    ctx.save();ctx.globalAlpha=mAlpha;
    ctx.fillStyle='#ff2200';
    ctx.beginPath();ctx.arc(player.x,player.y,pr*1.3,0,TAU);ctx.fill();
    ctx.restore();
    // Fire particles rising from player
    if(frame%3===0&&parts.length<MAX_PARTS){
      parts.push({x:player.x+(Math.random()-0.5)*pr,y:player.y+pr*0.5,vx:(Math.random()-0.5)*1.5,vy:-1.5-Math.random()*2,
        life:12,ml:12,sz:Math.random()*3+2,col:['#ff4400','#ff6600','#ffaa00'][Math.floor(Math.random()*3)]});
    }
  }
  // All characters rotate with gravity; face direction corrected inside drawCharacter
  const charRot=player.rot;
  drawEquippedPetAt(petState.ready?petState.x:player.x-pr*2.05,petState.ready?petState.y:player.y,pr*0.68,ghostA,petState.mode||'idle',player.gDir);
  // Draw equipped effect behind character
  const fxData=getEquippedEffectData();
  if(fxData)drawPlayerEffect(player.x,player.y,pr,fxData.type,ghostA,player.gDir);
  if(isSpecialActive('tire')){
    ctx.save();
    ctx.translate(player.x,player.y);
    ctx.rotate(frame*0.18);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      const rx=Math.cos(a)*pr*1.55,ry=Math.sin(a)*pr*1.55;
      ctx.strokeStyle=i%2===0?'rgba(70,70,70,0.75)':'rgba(160,160,160,0.55)';
      ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(rx,ry,pr*0.42,a+0.4,a+1.9);ctx.stroke();
    }
    ctx.strokeStyle='rgba(255,255,255,0.18)';
    ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(0,0,pr*1.65,0,TAU);ctx.stroke();
    ctx.restore();
  }
  drawCharacter(player.x,player.y,selChar,pr,charRot,ghostA,player.face,dmgLv);
  // Magma burn overlay on character (red tint over the character)
  if(magmaHurtT>0){
    const mAlpha2=magmaHurtT/30*0.45;
    ctx.save();ctx.globalAlpha=mAlpha2;ctx.globalCompositeOperation='multiply';
    ctx.fillStyle='#ff3300';
    ctx.beginPath();ctx.arc(player.x,player.y,pr,0,TAU);ctx.fill();
    ctx.restore();
  }
}

function drawEquippedPetAt(x,y,scale,alpha,mode,gDir){
  const petData=getEquippedPetData();
  if(!petData)return;
  drawPetSpriteByType(petData.type,x,y,scale,alpha,mode,gDir);
}

function drawPetSpriteByType(type,x,y,scale,alpha,mode,gDir){
  const t=frame||0;
  const mood=mode||'idle';
  let localX=0;
  let localY=0;
  let rot=0;
  if(type==='puff'){
    localY=Math.sin(t*0.06)*3;
    rot=Math.sin(t*0.04)*0.04;
    if(mood==='special')localY+=Math.sin(t*0.12)*3;
  } else if(type==='drone'){
    localX=Math.sin(t*0.11)*4;
    localY=Math.sin(t*0.05)*1.2;
    rot=Math.sin(t*0.09)*0.05;
    if(mood==='special'||mood==='bomb')localX*=1.35;
  } else {
    rot=Math.sin(t*0.05)*0.02;
    if(mood==='special')localY=Math.sin(t*0.1)*2;
  }
  if(mood==='countdown'){
    localY-=2;
  } else if(mood==='hurt'){
    rot+=Math.sin(t*0.18)*0.05;
  } else if(mood==='gameover'){
    rot+=Math.sin(t*0.08)*0.08;
  }
  ctx.save();
  ctx.translate(x+localX,y+localY);
  ctx.rotate(rot);
  if(gDir===-1)ctx.scale(1,-1); // flip vertically when player is on ceiling
  ctx.globalAlpha=alpha;
  switch(type){
    case'comet':{
      const trailCol=mood==='special'?'rgba(125,211,252,0.35)':'rgba(250,204,21,0.28)';
      for(let i=0;i<4;i++){
        ctx.fillStyle=trailCol;
        ctx.beginPath();ctx.arc(-scale*0.55-i*scale*0.24,scale*0.08*i,Math.max(1,scale*(0.2-i*0.035)),0,TAU);ctx.fill();
      }
      ctx.fillStyle='#fde68a';
      ctx.beginPath();
      for(let i=0;i<5;i++){
        const a=-Math.PI/2+i*TAU/5,ia=a+Math.PI/5;
        ctx.lineTo(Math.cos(a)*scale*0.62,Math.sin(a)*scale*0.62);
        ctx.lineTo(Math.cos(ia)*scale*0.28,Math.sin(ia)*scale*0.28);
      }
      ctx.closePath();ctx.fill();
      ctx.fillStyle='#fff7cc';
      ctx.beginPath();ctx.arc(scale*0.08,-scale*0.08,scale*0.14,0,TAU);ctx.fill();
      break;
    }
    case'puff':{
      ctx.fillStyle='rgba(236,253,255,0.95)';
      ctx.beginPath();ctx.arc(0,-scale*0.08,scale*0.56,Math.PI,0);
      ctx.lineTo(scale*0.56,scale*0.52);
      for(let i=0;i<3;i++){
        const bx=scale*0.56-i*(scale*1.12/3)-scale*0.18;
        ctx.quadraticCurveTo(bx+scale*0.12,scale*0.18,bx-scale*0.12,scale*0.52);
      }
      ctx.closePath();ctx.fill();
      ctx.fillStyle='#7c3aed';
      ctx.beginPath();ctx.arc(scale*0.1,-scale*0.06,scale*0.12,0,TAU);ctx.fill();
      ctx.beginPath();ctx.arc(-scale*0.16,-scale*0.04,scale*0.08,0,TAU);ctx.fill();
      if(mood==='hurt'||mood==='gameover'){
        ctx.strokeStyle='#7c3aed';ctx.lineWidth=Math.max(1,scale*0.08);
        ctx.beginPath();ctx.arc(0,scale*0.22,scale*0.18,0.2,Math.PI-0.2);ctx.stroke();
      }
      break;
    }
    case'drone':{
      ctx.fillStyle='#1d4ed8';
      rr(-scale*0.5,-scale*0.34,scale,scale*0.68,scale*0.18);ctx.fill();
      ctx.fillStyle='#bfdbfe';ctx.beginPath();ctx.arc(0,0,scale*0.18,0,TAU);ctx.fill();
      ctx.strokeStyle='rgba(125,211,252,0.9)';ctx.lineWidth=Math.max(1.5,scale*0.1);
      ctx.beginPath();ctx.moveTo(-scale*0.78,-scale*0.08);ctx.lineTo(-scale*0.28,-scale*0.24);ctx.stroke();
      ctx.beginPath();ctx.moveTo(scale*0.78,-scale*0.08);ctx.lineTo(scale*0.28,-scale*0.24);ctx.stroke();
      ctx.fillStyle=mood==='special'?'#22d3ee':'#f97316';
      ctx.beginPath();ctx.arc(-scale*0.26,scale*0.38,scale*0.12+Math.abs(Math.sin(t*0.35))*scale*0.04,0,TAU);ctx.fill();
      ctx.beginPath();ctx.arc(scale*0.26,scale*0.38,scale*0.12+Math.abs(Math.sin(t*0.35+1))*scale*0.04,0,TAU);ctx.fill();
      break;
    }
  }
  if(mood==='countdown'||mood==='special'){
    ctx.fillStyle='rgba(255,255,255,0.55)';
    ctx.beginPath();ctx.arc(scale*0.7,-scale*0.5,scale*0.1,0,TAU);ctx.fill();
  }
  ctx.restore();
}

function drawPetShowcase(scene,x,y,scale,gDir,alpha){
  const petData=getEquippedPetData();
  if(!petData)return;
  const type=petData.type;
  const t=frame||0;
  const gd=gDir===-1?-1:1;
  const a=alpha==null?1:alpha;
  function orb(px,py,sz,col,oa){
    ctx.save();
    ctx.globalAlpha=oa;
    ctx.fillStyle=col;
    ctx.beginPath();ctx.arc(px,py,sz,0,TAU);ctx.fill();
    ctx.restore();
  }
  function ghost(px,py,ga,gs,mode){
    drawPetSpriteByType(type,px,py,scale*gs,a*ga,mode,gd);
  }
  function lerp(v0,v1,p){return v0+(v1-v0)*p;}
  if(scene==='demo'){
    if(type==='puff'){
      ghost(x-scale*1.5,y-scale*0.3+Math.sin(t*0.06)*scale*0.22,0.82,0.74,'preview');
    } else if(type==='drone'){
      ghost(x-scale*1.85+Math.sin(t*0.09)*scale*0.35,y-scale*0.18,0.82,0.74,'preview');
    } else {
      ghost(x-scale*1.65,y-scale*0.22,0.8,0.72,'preview');
    }
    return;
  }
  if(scene==='countdown'){
    if(type==='comet'){
      const ang=t*0.11;
      const px=x+Math.cos(ang)*scale*1.3;
      const py=y-scale*0.4+Math.sin(ang*1.3)*scale*0.82;
      for(let i=3;i>=1;i--){
        const ta=ang-i*0.3;
        orb(x+Math.cos(ta)*scale*1.18,y-scale*0.4+Math.sin(ta*1.3)*scale*0.74,scale*(0.12+i*0.02),'rgba(255,235,160,0.9)',a*(0.08+i*0.06));
      }
      ghost(px,py,1,0.82,'countdown');
      return;
    }
    if(type==='puff'){
      const ang=t*0.07;
      const px=x+Math.sin(ang)*scale*1.05;
      const py=y-scale*1.05+Math.sin(ang*2)*scale*0.48;
      orb(x+Math.sin(ang+1.6)*scale*0.9,y-scale*1.28+Math.cos(ang*1.7)*scale*0.24,scale*0.14,'rgba(236,253,255,0.95)',a*0.22);
      orb(x+Math.sin(ang+3.2)*scale*1.1,y-scale*1.02+Math.cos(ang*1.3)*scale*0.3,scale*0.1,'rgba(216,180,255,0.95)',a*0.18);
      ghost(px,py,1,0.84,'countdown');
      return;
    }
    const pts=[
      {x:x-scale*1.25,y:y-scale*1.0},
      {x:x+scale*1.05,y:y-scale*1.08},
      {x:x+scale*1.35,y:y-scale*0.18},
      {x:x-scale*1.05,y:y+scale*0.06},
    ];
    const prog=(t*0.055)%pts.length;
    const idx=Math.floor(prog);
    const next=(idx+1)%pts.length;
    const mix=prog-idx;
    const px=lerp(pts[idx].x,pts[next].x,mix);
    const py=lerp(pts[idx].y,pts[next].y,mix);
    const prev=(idx+pts.length-1)%pts.length;
    ghost(lerp(pts[prev].x,pts[idx].x,mix),lerp(pts[prev].y,pts[idx].y,mix),0.25,0.78,'countdown');
    ghost(px,py,1,0.84,'countdown');
    return;
  }
  if(scene==='gameover'){
    if(type==='comet'){
      const ang=t*0.06;
      const px=x+Math.cos(ang)*scale*1.55;
      const py=y-scale*0.2+Math.sin(ang*1.25)*scale*0.9;
      for(let i=4;i>=1;i--){
        const ta=ang-i*0.24;
        orb(x+Math.cos(ta)*scale*1.38,y-scale*0.22+Math.sin(ta*1.25)*scale*0.82,scale*(0.11+i*0.015),'rgba(255,223,130,0.95)',a*(0.06+i*0.05));
      }
      ghost(px,py,1,0.88,'gameover');
      return;
    }
    if(type==='puff'){
      const ang=t*0.055;
      const radius=scale*(0.45+0.12*Math.sin(t*0.03));
      const px=x+Math.sin(ang)*radius;
      const py=y-scale*1.05+Math.cos(ang*1.6)*scale*0.34;
      orb(x+Math.sin(ang+1.3)*scale*0.55,y-scale*1.4+Math.cos(ang+0.8)*scale*0.2,scale*0.12,'rgba(255,255,255,0.95)',a*0.2);
      orb(x+Math.sin(ang+3.4)*scale*0.75,y-scale*1.1+Math.cos(ang+2.1)*scale*0.25,scale*0.09,'rgba(216,180,255,0.95)',a*0.16);
      ghost(px,py,1,0.9,'gameover');
      return;
    }
    const px=x+Math.sin(t*0.085)*scale*1.45;
    const py=y-scale*0.92+Math.cos(t*0.15)*scale*0.14;
    ghost(x+Math.sin(t*0.085-0.45)*scale*1.2,y-scale*0.9,0.22,0.8,'gameover');
    ctx.save();
    ctx.globalAlpha=a*0.22;
    ctx.strokeStyle='rgba(125,211,252,0.85)';
    ctx.lineWidth=Math.max(1,scale*0.05);
    ctx.beginPath();
    ctx.moveTo(px-scale*0.18,py+scale*0.36);
    ctx.lineTo(px-scale*0.42,py+scale*1.05);
    ctx.moveTo(px+scale*0.18,py+scale*0.36);
    ctx.lineTo(px+scale*0.42,py+scale*1.05);
    ctx.stroke();
    ctx.restore();
    ghost(px,py,1,0.88,'gameover');
  }
}

function drawPlayerEffect(px,py,pr,fxType,alpha,gDir){
  if(_lowQ)return; // skip cosmetic effects in low quality mode
  ctx.save();ctx.globalAlpha=alpha*0.8;
  const t=frame||0;const gd=gDir!=null?gDir:1;
  switch(fxType){
    case'sparkle':
      for(let i=0;i<5;i++){
        const a=t*0.08+i*1.256,d=pr*1.3+Math.sin(t*0.12+i)*4;
        const sx=px+Math.cos(a)*d,sy=py+Math.sin(a)*d;
        const ss=2+Math.sin(t*0.15+i*2)*1.5;
        ctx.fillStyle=`hsla(${(t*4+i*60)%360},100%,80%,${0.7+Math.sin(t*0.2+i)*0.3})`;
        ctx.beginPath();ctx.arc(sx,sy,ss,0,TAU);ctx.fill();
      }break;
    case'fire_aura':
      for(let i=0;i<6;i++){
        const a=t*0.06+i*1.047,d=pr*1.1+Math.sin(t*0.1+i*0.7)*3;
        const fx=px+Math.cos(a)*d,fy=py+Math.sin(a)*d-Math.abs(Math.sin(t*0.15+i))*6*gd;
        ctx.fillStyle=`rgba(${200+Math.floor(Math.sin(t*0.1+i)*55)},${60+Math.floor(i*15)},0,${0.5+Math.sin(t*0.2+i)*0.2})`;
        ctx.beginPath();ctx.arc(fx,fy,3+Math.sin(t*0.12+i)*1.5,0,TAU);ctx.fill();
      }break;
    case'ice_aura':
      for(let i=0;i<6;i++){
        const a=t*0.05+i*1.047,d=pr*1.1+Math.sin(t*0.08+i*0.7)*3;
        const fx=px+Math.cos(a)*d,fy=py+Math.sin(a)*d;
        ctx.fillStyle=`rgba(${100+Math.floor(i*20)},${200+Math.floor(Math.sin(t*0.1+i)*40)},255,${0.4+Math.sin(t*0.15+i)*0.2})`;
        ctx.beginPath();ctx.arc(fx,fy,2.5+Math.sin(t*0.1+i)*1,0,TAU);ctx.fill();
      }break;
    case'electric':
      ctx.strokeStyle=`rgba(100,200,255,${0.5+Math.sin(t*0.3)*0.3})`;ctx.lineWidth=1.5;
      for(let i=0;i<3;i++){
        ctx.beginPath();const sa=t*0.1+i*2.09;
        let lx=px+Math.cos(sa)*pr,ly=py+Math.sin(sa)*pr;ctx.moveTo(lx,ly);
        for(let j=0;j<4;j++){lx+=((Math.random()-0.5)*8);ly+=((Math.random()-0.5)*8);ctx.lineTo(lx,ly);}
        ctx.stroke();
      }break;
    case'hearts':
      if(gd===0){
        for(let i=0;i<4;i++){const a=t*0.06+i*1.57,d=pr*1.1+Math.sin(t*0.1+i)*2;
          ctx.globalAlpha=alpha*0.8;ctx.fillStyle='#ff6688';ctx.font='7px monospace';ctx.textAlign='center';
          ctx.fillText('\u2665',px+Math.cos(a)*d,py+Math.sin(a)*d);}
      } else {
        for(let i=0;i<3;i++){
          const hy=py+(-pr*1.5-((t*1.5+i*30)%50))*gd,hx=px+Math.sin(t*0.05+i*2)*pr*0.8;
          const ha=1-((t*1.5+i*30)%50)/50;
          if(ha>0){ctx.globalAlpha=alpha*ha*0.7;ctx.fillStyle='#ff6688';ctx.font=(8+i*2)+'px monospace';ctx.textAlign='center';ctx.fillText('\u2665',hx,hy);}
        }
      }ctx.globalAlpha=alpha*0.8;break;
    case'shadow':
      const sg=ctx.createRadialGradient(px,py,pr*0.3,px,py,pr*2.2);
      sg.addColorStop(0,'rgba(20,0,30,0)');sg.addColorStop(0.3,`rgba(40,0,60,${0.2+Math.sin(t*0.06)*0.08})`);
      sg.addColorStop(0.6,`rgba(60,0,90,${0.15+Math.sin(t*0.08)*0.05})`);sg.addColorStop(1,'rgba(20,0,30,0)');
      ctx.fillStyle=sg;ctx.beginPath();ctx.arc(px,py,pr*2.2,0,TAU);ctx.fill();
      // Swirling dark wisps
      for(let i=0;i<5;i++){const sa=t*0.05+i*1.256,sd=pr*1.4+Math.sin(t*0.08+i)*5;
        const wx=px+Math.cos(sa)*sd,wy=py+Math.sin(sa)*sd;
        ctx.fillStyle=`rgba(80,0,120,${0.35+Math.sin(t*0.12+i)*0.15})`;
        ctx.beginPath();ctx.arc(wx,wy,3+Math.sin(t*0.1+i)*1.5,0,TAU);ctx.fill();
      }
      // Dark tendrils
      ctx.strokeStyle=`rgba(60,0,90,${0.2+Math.sin(t*0.06)*0.1})`;ctx.lineWidth=1.5;
      for(let i=0;i<3;i++){const ta=t*0.04+i*2.09;
        ctx.beginPath();ctx.moveTo(px,py);
        ctx.quadraticCurveTo(px+Math.cos(ta)*pr*1.5,py+Math.sin(ta)*pr*1.5,
          px+Math.cos(ta+0.5)*pr*2,py+Math.sin(ta+0.5)*pr*2);ctx.stroke();}
      break;
    case'rainbow':
      // Outer glow ring
      const rg=ctx.createRadialGradient(px,py,pr*0.6,px,py,pr*2.0);
      rg.addColorStop(0,'rgba(255,255,255,0)');
      rg.addColorStop(0.4,`hsla(${(t*5)%360},100%,70%,0.2)`);
      rg.addColorStop(0.7,`hsla(${(t*5+120)%360},100%,60%,0.12)`);
      rg.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=rg;ctx.beginPath();ctx.arc(px,py,pr*2.0,0,TAU);ctx.fill();
      // Rotating rainbow ring
      ctx.strokeStyle=`hsla(${(t*8)%360},100%,65%,0.4)`;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(px,py,pr*1.5+Math.sin(t*0.1)*3,0,TAU);ctx.stroke();
      // Orbiting particles (8 total, different colors)
      for(let i=0;i<8;i++){const a=t*0.07+i*0.785,d=pr*1.4+Math.sin(t*0.1+i)*4;
        ctx.fillStyle=`hsla(${(t*6+i*45)%360},100%,70%,${0.6+Math.sin(t*0.15+i)*0.2})`;
        ctx.beginPath();ctx.arc(px+Math.cos(a)*d,py+Math.sin(a)*d,2.5+Math.sin(t*0.12+i),0,TAU);ctx.fill();
      }
      // Inner sparkle burst
      for(let i=0;i<3;i++){const a=t*0.12+i*2.09,d=pr*0.8;
        ctx.fillStyle=`hsla(${(t*10+i*120)%360},100%,85%,${0.4+Math.sin(t*0.2+i)*0.2})`;
        ctx.beginPath();ctx.arc(px+Math.cos(a)*d,py+Math.sin(a)*d,1.5,0,TAU);ctx.fill();
      }break;
    case'sakura':
      if(gd===0){
        for(let i=0;i<4;i++){const a=t*0.04+i*1.57,d=pr*1.1+Math.sin(t*0.08+i)*2;
          ctx.globalAlpha=alpha*0.8;ctx.fillStyle='#ffb7c5';ctx.font='7px sans-serif';ctx.textAlign='center';
          ctx.fillText('\u273f',px+Math.cos(a)*d,py+Math.sin(a)*d);}
      } else {
        for(let i=0;i<4;i++){
          const sy2=py+(-pr*1.2-((t*0.8+i*25)%60))*gd,sx2=px+Math.sin(t*0.04+i*1.5)*pr*1.2;
          const sa2=1-((t*0.8+i*25)%60)/60;
          if(sa2>0){ctx.globalAlpha=alpha*sa2*0.8;ctx.fillStyle='#ffb7c5';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('\u273f',sx2,sy2);}
        }
      }ctx.globalAlpha=alpha*0.8;break;
    case'star_trail':
      // Golden glow behind
      for(let i=0;i<6;i++){
        const sd=pr*0.8+i*5,sa3=t*0.06-i*0.25;
        const stx=px+Math.cos(sa3)*sd*0.5-sd*0.3,sty=py+Math.sin(sa3)*sd*0.3;
        ctx.globalAlpha=alpha*(0.75-i*0.1);ctx.fillStyle=i%2===0?'#ffd700':'#ffaa00';
        ctx.beginPath();
        for(let si=0;si<5;si++){const a5=-Math.PI/2+si*Math.PI*2/5,a5b=a5+Math.PI/5,sr=3-i*0.3;
          ctx.lineTo(stx+Math.cos(a5)*sr,sty+Math.sin(a5)*sr);
          ctx.lineTo(stx+Math.cos(a5b)*sr*0.4,sty+Math.sin(a5b)*sr*0.4);
        }ctx.closePath();ctx.fill();
      }
      // Orbiting golden sparkles
      for(let i=0;i<3;i++){const a=t*0.09+i*2.09,d=pr*1.3;
        ctx.globalAlpha=alpha*(0.5+Math.sin(t*0.15+i)*0.2);ctx.fillStyle='#fff4b0';
        ctx.beginPath();ctx.arc(px+Math.cos(a)*d,py+Math.sin(a)*d,1.5,0,TAU);ctx.fill();
      }
      ctx.globalAlpha=alpha*0.8;break;
    case'plasma_trail':
      // Plasma glow ring
      ctx.strokeStyle=`hsla(${(280+t*3)%360},100%,60%,0.25)`;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(px,py,pr*1.5+Math.sin(t*0.1)*3,0,TAU);ctx.stroke();
      // Main plasma orbs
      for(let i=0;i<7;i++){
        const a=t*0.09+i*0.898,d=pr*1.3+Math.sin(t*0.14+i)*6;
        const ptx=px+Math.cos(a)*d,pty=py+Math.sin(a)*d;
        ctx.fillStyle=`hsla(${280+Math.sin(t*0.05+i)*40},100%,${60+Math.sin(t*0.1+i)*20}%,${0.55+Math.sin(t*0.2+i)*0.25})`;
        ctx.beginPath();ctx.arc(ptx,pty,3.5+Math.sin(t*0.12+i)*1.5,0,TAU);ctx.fill();
      }
      // Arc lightning between orbs
      if(t%8<4){ctx.strokeStyle=`hsla(${(300+t*5)%360},100%,80%,0.3)`;ctx.lineWidth=1;
        ctx.beginPath();const la=t*0.09,ld=pr*1.3;
        ctx.moveTo(px+Math.cos(la)*ld,py+Math.sin(la)*ld);
        ctx.lineTo(px+Math.cos(la+1.256)*ld+((Math.random()-0.5)*4),py+Math.sin(la+1.256)*ld+((Math.random()-0.5)*4));
        ctx.stroke();}
      break;
    case'void_aura':
      // Pulsing void field
      const vg=ctx.createRadialGradient(px,py,pr*0.2,px,py,pr*2.4);
      vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(0.3,`rgba(10,0,25,${0.25+Math.sin(t*0.06)*0.1})`);
      vg.addColorStop(0.6,`rgba(20,0,50,${0.15+Math.sin(t*0.08)*0.08})`);
      vg.addColorStop(0.85,`rgba(30,0,60,${0.08+Math.sin(t*0.1)*0.04})`);vg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=vg;ctx.beginPath();ctx.arc(px,py,pr*2.4,0,TAU);ctx.fill();
      // Void ring
      ctx.strokeStyle=`rgba(80,0,120,${0.3+Math.sin(t*0.07)*0.15})`;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(px,py,pr*1.8+Math.sin(t*0.08)*3,0,TAU);ctx.stroke();
      // Gravitational particles spiraling inward
      for(let i=0;i<6;i++){const va=t*0.05+i*1.047,vd=pr*(1.2+Math.sin(t*0.03+i*0.5)*0.5);
        ctx.fillStyle=`rgba(${50+i*10},0,${80+i*15},${0.45+Math.sin(t*0.1+i)*0.2})`;
        ctx.beginPath();ctx.arc(px+Math.cos(va)*vd,py+Math.sin(va)*vd,2.5-i*0.2,0,TAU);ctx.fill();
      }
      // Distortion flicker
      if(t%20<3){ctx.fillStyle='rgba(40,0,80,0.08)';
        ctx.fillRect(px-pr*2,py-pr*0.1,pr*4,pr*0.2);}
      break;
    case'celestial':
      // === SUPER RARE: Celestial Divine Aura ===
      // Multi-layered divine glow
      const cg1=ctx.createRadialGradient(px,py,pr*0.3,px,py,pr*2.5);
      cg1.addColorStop(0,'rgba(255,240,200,0)');
      cg1.addColorStop(0.3,`rgba(255,215,0,${0.12+Math.sin(t*0.05)*0.05})`);
      cg1.addColorStop(0.6,`hsla(${(t*3)%360},80%,70%,${0.08+Math.sin(t*0.07)*0.03})`);
      cg1.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=cg1;ctx.beginPath();ctx.arc(px,py,pr*2.5,0,TAU);ctx.fill();
      // Rotating golden ring
      ctx.save();ctx.translate(px,py);ctx.rotate(t*0.02);
      ctx.strokeStyle=`rgba(255,215,0,${0.35+Math.sin(t*0.08)*0.15})`;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(0,0,pr*1.8,0,TAU);ctx.stroke();
      // Second ring (counter-rotation)
      ctx.rotate(-t*0.04);
      ctx.strokeStyle=`hsla(${(t*4+180)%360},100%,75%,${0.25+Math.sin(t*0.1)*0.1})`;ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(0,0,pr*2.1,0,TAU);ctx.stroke();
      ctx.restore();
      // Radiating light beams
      ctx.save();ctx.translate(px,py);
      for(let i=0;i<6;i++){
        const ba=t*0.015+i*Math.PI/3;
        const bAlpha=0.08+Math.sin(t*0.06+i)*0.04;
        ctx.save();ctx.rotate(ba);
        ctx.fillStyle=`rgba(255,215,0,${bAlpha})`;
        ctx.beginPath();ctx.moveTo(-2,pr*0.5);ctx.lineTo(2,pr*0.5);ctx.lineTo(1,pr*2.8);ctx.lineTo(-1,pr*2.8);ctx.closePath();ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      // Orbiting celestial diamonds
      for(let i=0;i<5;i++){
        const ca=t*0.06+i*1.256,cd=pr*1.5+Math.sin(t*0.1+i)*5;
        const cx2=px+Math.cos(ca)*cd,cy2=py+Math.sin(ca)*cd;
        const cAlpha=0.6+Math.sin(t*0.15+i)*0.25;
        const cHue=(t*4+i*72)%360;
        ctx.fillStyle=`hsla(${cHue},100%,80%,${cAlpha})`;
        ctx.save();ctx.translate(cx2,cy2);ctx.rotate(t*0.1+i);
        ctx.beginPath();ctx.moveTo(0,-3);ctx.lineTo(2,0);ctx.lineTo(0,3);ctx.lineTo(-2,0);ctx.closePath();ctx.fill();
        ctx.restore();
      }
      // Floating sparkle rain
      for(let i=0;i<4;i++){
        const sy3=py+(-pr*1.5-((t*1.2+i*20)%55))*gd;
        const sx3=px+Math.sin(t*0.04+i*1.5)*pr*1.2;
        const sa4=1-((t*1.2+i*20)%55)/55;
        if(sa4>0){ctx.globalAlpha=alpha*sa4*0.7;
          ctx.fillStyle=`hsla(${(t*5+i*90)%360},100%,85%,1)`;
          ctx.font='8px monospace';ctx.textAlign='center';ctx.fillText('\u2726',sx3,sy3);}
      }
      ctx.globalAlpha=alpha*0.8;
      break;
    case'phoenix':
      // Orange/red feather-shaped particles drifting upward and fading
      for(let i=0;i<6;i++){
        const fy2=py+(-pr*1.0-((t*1.8+i*18)%65))*gd;
        const fx2=px+Math.sin(t*0.05+i*1.2)*pr*1.0;
        const fa=1-((t*1.8+i*18)%65)/65;
        if(fa>0){
          ctx.globalAlpha=alpha*fa*0.75;
          // Feather shape: elongated ellipse
          const fHue=15+i*8; // orange to red range
          ctx.fillStyle=`hsl(${fHue},100%,${55+i*5}%)`;
          ctx.save();ctx.translate(fx2,fy2);ctx.rotate(Math.sin(t*0.04+i)*0.4);
          ctx.beginPath();ctx.ellipse(0,0,2+i*0.3,5+i*0.5,0,0,TAU);ctx.fill();
          ctx.restore();
        }
      }
      // Occasional golden flash
      if(t%40<3){
        ctx.globalAlpha=alpha*0.4;
        const fg=ctx.createRadialGradient(px,py,pr*0.2,px,py,pr*2.0);
        fg.addColorStop(0,'rgba(255,215,0,0.3)');fg.addColorStop(1,'rgba(255,150,0,0)');
        ctx.fillStyle=fg;ctx.beginPath();ctx.arc(px,py,pr*2.0,0,TAU);ctx.fill();
      }
      // Ember ring
      for(let i=0;i<4;i++){const ea=t*0.07+i*1.57,ed=pr*1.2+Math.sin(t*0.1+i)*3;
        ctx.globalAlpha=alpha*(0.5+Math.sin(t*0.15+i)*0.2);
        ctx.fillStyle=i%2===0?'#ff6600':'#ffaa00';
        ctx.beginPath();ctx.arc(px+Math.cos(ea)*ed,py+Math.sin(ea)*ed,2,0,TAU);ctx.fill();
      }
      ctx.globalAlpha=alpha*0.8;break;
    case'glitch_trail':
      // Random colored rectangles that appear briefly behind player
      for(let i=0;i<5;i++){
        const gSeed=(t*7+i*131)%100;
        if(gSeed<40){ // only some visible at a time
          const gx=px+((t*3+i*47)%60-30)*(i%2===0?1:-1)-pr*0.5;
          const gy=py+((t*5+i*73)%40-20)-pr*0.3;
          const gw=4+((t+i*19)%8);const gh=3+((t+i*31)%6);
          const gColors=['#ff00ff','#00ffff','#ffff00','#ff3300','#00ff66'];
          ctx.globalAlpha=alpha*(0.3+((t+i*17)%30)/60);
          ctx.fillStyle=gColors[(t+i)%gColors.length];
          ctx.fillRect(gx,gy,gw,gh);
        }
      }
      // Scanline flicker
      if(t%12<4){
        ctx.globalAlpha=alpha*0.15;ctx.fillStyle='#fff';
        ctx.fillRect(px-pr*1.5,py-pr*0.05+Math.sin(t*0.5)*pr*0.3,pr*3,pr*0.1);
      }
      ctx.globalAlpha=alpha*0.8;break;
    case'supernova':
      // Large pulsing white/gold ring that expands and contracts
      const snScale=1+Math.sin(t*0.06)*0.3;
      const snR=pr*1.8*snScale;
      const sng=ctx.createRadialGradient(px,py,snR*0.8,px,py,snR);
      sng.addColorStop(0,'rgba(255,255,255,0)');
      sng.addColorStop(0.7,`rgba(255,215,0,${0.15+Math.sin(t*0.08)*0.08})`);
      sng.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=sng;ctx.beginPath();ctx.arc(px,py,snR,0,TAU);ctx.fill();
      // Ring outline
      ctx.strokeStyle=`rgba(255,240,200,${0.4+Math.sin(t*0.07)*0.2})`;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(px,py,snR,0,TAU);ctx.stroke();
      // Radiating star particles
      for(let i=0;i<8;i++){
        const sa5=t*0.04+i*0.785,sd5=pr*(1.3+Math.sin(t*0.05+i*0.8)*0.4)*snScale;
        const stx2=px+Math.cos(sa5)*sd5,sty2=py+Math.sin(sa5)*sd5;
        const sAlpha=0.5+Math.sin(t*0.12+i*1.2)*0.3;
        ctx.fillStyle=i%2===0?`rgba(255,255,255,${sAlpha})`:`rgba(255,215,0,${sAlpha})`;
        ctx.beginPath();
        // Small 4-point star
        for(let si=0;si<4;si++){const a4=si*Math.PI/2+t*0.1,sr2=2.5;
          ctx.lineTo(stx2+Math.cos(a4)*sr2,sty2+Math.sin(a4)*sr2);
          ctx.lineTo(stx2+Math.cos(a4+Math.PI/4)*sr2*0.3,sty2+Math.sin(a4+Math.PI/4)*sr2*0.3);
        }ctx.closePath();ctx.fill();
      }
      // Core glow
      ctx.globalAlpha=alpha*0.3;
      const coreG=ctx.createRadialGradient(px,py,0,px,py,pr*0.8);
      coreG.addColorStop(0,'rgba(255,255,255,0.4)');coreG.addColorStop(1,'rgba(255,215,0,0)');
      ctx.fillStyle=coreG;ctx.beginPath();ctx.arc(px,py,pr*0.8,0,TAU);ctx.fill();
      ctx.globalAlpha=alpha*0.8;break;
    case'bubbles':
      for(let i=0;i<7;i++){
        const by=py+(-pr*1.0-((t*1.1+i*15)%55))*gd;
        const bx=px+Math.sin(t*0.04+i)*pr*1.1;
        const ba=1-((t*1.1+i*15)%55)/55;
        ctx.globalAlpha=alpha*ba*0.6;ctx.strokeStyle='#7dd3fc';ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(bx,by,2+i%3,0,TAU);ctx.stroke();
      }
      ctx.globalAlpha=alpha*0.8;break;
    case'confetti':
      for(let i=0;i<8;i++){
        const cy=py+(-pr*1.3-((t*1.6+i*13)%60))*gd,cx=px+Math.sin(t*0.08+i*1.7)*pr*1.2;
        const ca=1-((t*1.6+i*13)%60)/60;
        ctx.globalAlpha=alpha*ca*0.8;ctx.fillStyle=`hsl(${(i*47+t*3)%360},90%,65%)`;
        ctx.save();ctx.translate(cx,cy);ctx.rotate(t*0.08+i);ctx.fillRect(-1.5,-3,3,6);ctx.restore();
      }
      ctx.globalAlpha=alpha*0.8;break;
    case'music':
      for(let i=0;i<4;i++){
        const my=py+(-pr*1.4-((t*1.2+i*22)%70))*gd,mx=px+Math.sin(t*0.05+i)*pr*1.1;
        const ma=1-((t*1.2+i*22)%70)/70;
        ctx.globalAlpha=alpha*ma*0.75;ctx.fillStyle=i%2?'#f472b6':'#60a5fa';ctx.font=(8+i%2*2)+'px monospace';ctx.textAlign='center';
        ctx.fillText(i%2?'\u266a':'\u266b',mx,my);
      }
      ctx.globalAlpha=alpha*0.8;break;
    case'pixel':
      for(let i=0;i<9;i++){
        const px2=px+((t*3+i*19)%50-25),py2=py+((t*5+i*23)%42-21);
        ctx.globalAlpha=alpha*(0.25+((t+i*11)%20)/40);ctx.fillStyle=['#22d3ee','#f97316','#a3e635','#f472b6'][i%4];
        ctx.fillRect(px2,py2,2+(i%2)*2,2+(i%3));
      }
      ctx.globalAlpha=alpha*0.8;break;
    case'snowflake':
      for(let i=0;i<6;i++){
        const a=t*0.04+i*1.047,d=pr*1.25+Math.sin(t*0.08+i)*4;
        const sx=px+Math.cos(a)*d,sy=py+Math.sin(a)*d;
        ctx.globalAlpha=alpha*0.75;ctx.strokeStyle='#bfdbfe';ctx.lineWidth=1;
        ctx.save();ctx.translate(sx,sy);ctx.rotate(t*0.04+i);
        for(let k=0;k<3;k++){ctx.rotate(Math.PI/3);ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(3,0);ctx.stroke();}
        ctx.restore();
      }
      ctx.globalAlpha=alpha*0.8;break;
    case'meteor':
      for(let i=0;i<4;i++){
        const mx=px+pr*1.8-((t*2.4+i*26)%80),my=py-pr*1.7+((t*1.4+i*18)%65);
        ctx.globalAlpha=alpha*0.65;ctx.strokeStyle=i%2?'#f97316':'#facc15';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo(mx+10,my-8);ctx.stroke();
        ctx.beginPath();ctx.arc(mx,my,2,0,TAU);ctx.fillStyle='#fff7ad';ctx.fill();
      }
      ctx.globalAlpha=alpha*0.8;break;
    case'rune':
      ctx.save();ctx.translate(px,py);ctx.rotate(t*0.025);
      ctx.strokeStyle=`rgba(168,85,247,${0.35+Math.sin(t*0.08)*0.12})`;ctx.lineWidth=1.4;
      ctx.beginPath();ctx.arc(0,0,pr*1.7,0,TAU);ctx.stroke();
      for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.moveTo(Math.cos(a)*pr*1.25,Math.sin(a)*pr*1.25);ctx.lineTo(Math.cos(a)*pr*1.65,Math.sin(a)*pr*1.65);ctx.stroke();}
      ctx.restore();break;
    case'comet_crown':
      for(let i=0;i<5;i++){
        const a=t*0.05+i*1.256,d=pr*1.55;
        const cx=px+Math.cos(a)*d,cy=py-pr*1.0+Math.sin(a)*pr*0.25;
        ctx.globalAlpha=alpha*(0.6+Math.sin(t*0.12+i)*0.2);ctx.fillStyle=i===0?'#fff':'#facc15';
        ctx.beginPath();ctx.arc(cx,cy,2.5,0,TAU);ctx.fill();
        ctx.strokeStyle='rgba(250,204,21,0.35)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-Math.cos(a)*10,cy-Math.sin(a)*5);ctx.stroke();
      }
      ctx.globalAlpha=alpha*0.8;break;
    case'matrix':
      ctx.fillStyle='rgba(34,197,94,0.55)';ctx.font='8px monospace';ctx.textAlign='center';
      for(let i=0;i<6;i++){
        const mx=px-pr*1.4+i*pr*0.55,my=py-pr*1.6+((t*1.4+i*17)%pr*3.2);
        ctx.globalAlpha=alpha*(0.2+(i%3)*0.15);ctx.fillText((t+i)%2?'1':'0',mx,my);
      }
      ctx.globalAlpha=alpha*0.8;break;
    case'timewarp':
      ctx.save();ctx.translate(px,py);ctx.rotate(-t*0.035);
      ctx.strokeStyle=`rgba(125,211,252,${0.3+Math.sin(t*0.06)*0.12})`;ctx.lineWidth=1.5;
      for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,0,pr*(1.2+i*0.28)+Math.sin(t*0.08+i)*2,0,TAU);ctx.stroke();}
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-pr*1.2);ctx.moveTo(0,0);ctx.lineTo(pr*0.9,0);ctx.stroke();
      ctx.restore();break;
  }
  ctx.restore();
}

function drawHeart(cx,cy,sz,filled,colSet){
  const cols=colSet||{fill:'#ff3860',glow:'rgba(255,255,255,0.3)',emptyFill:'rgba(255,56,96,0.12)',stroke:'#ff386044'};
  ctx.save();ctx.translate(cx,cy);
  const s=sz*0.5;
  ctx.beginPath();
  ctx.moveTo(0,s*0.8);
  ctx.bezierCurveTo(-s*0.1,s*0.4,-s,s*0.1,-s,-s*0.3);
  ctx.bezierCurveTo(-s,-s*0.8,-s*0.2,-s*0.9,0,-s*0.4);
  ctx.bezierCurveTo(s*0.2,-s*0.9,s,-s*0.8,s,-s*0.3);
  ctx.bezierCurveTo(s,s*0.1,s*0.1,s*0.4,0,s*0.8);
  ctx.closePath();
  if(filled){
    ctx.fillStyle=cols.fill;ctx.fill();
    // Highlight
    ctx.fillStyle=cols.glow;
    ctx.beginPath();ctx.arc(-s*0.35,-s*0.35,s*0.2,0,TAU);ctx.fill();
  } else {
    ctx.fillStyle=cols.emptyFill;ctx.fill();
    ctx.strokeStyle=cols.stroke;ctx.lineWidth=1.5;ctx.stroke();
  }
  ctx.restore();
}
function drawSpecialHpHearts(baseX,y,sz,spacing,alignCenter){
  const bonusCols={fill:'#ffd34d',glow:'rgba(255,255,255,0.38)',emptyFill:'rgba(255,211,77,0.12)',stroke:'rgba(255,211,77,0.35)'};
  const baseHp=maxHp();
  const bonusTotal=isSpecialActive('stone')?specialState.bonusHpGranted:0;
  const bonusFilled=isSpecialActive('stone')?Math.max(0,Math.min(bonusTotal,specialState.bonusHpCurrent)):0;
  const filledBase=Math.max(0,Math.min(baseHp,hp-bonusFilled));
  const totalHearts=baseHp+bonusTotal;
  const startX=alignCenter?baseX-((totalHearts-1)*spacing/2):baseX;
  for(let i=0;i<baseHp;i++)drawHeart(startX+i*spacing,y,sz,i<filledBase);
  for(let i=0;i<bonusTotal;i++)drawHeart(startX+(baseHp+i)*spacing,y,sz,i<bonusFilled,bonusCols);
}
function drawSpecialParade(){
  if(state!==ST.PLAY||!specialState.active)return;
  const charIdx=specialState.visualCharIdx!=null?specialState.visualCharIdx:selChar;
  const paradeSizeMul=(CHARS[charIdx]&&CHARS[charIdx].sizeMul)||1;
  const ksz=Math.max(14,Math.round(PLAYER_R*paradeSizeMul*0.8));
  const spacing=ksz*2.8;
  const count=Math.ceil(W/spacing)+1;
  const scrollX=(frame*1.4)%spacing;
  ctx.save();
  for(let row=0;row<2;row++){
    const baseY=row===0?safeTop+46:H-PANEL_H-Math.min(safeBot,10)-8;
    const flip=row===0?-1:1;
    for(let i=-1;i<count;i++){
      const kx=i*spacing+scrollX;
      if(kx<-ksz*2||kx>W+ksz*2)continue;
      const bounce=Math.abs(Math.sin(frame*0.08+i*0.7+row*1.5))*8;
      const tilt=Math.sin(frame*0.06+i*0.9)*0.18;
      const ky=baseY-bounce*flip;
      ctx.save();
      ctx.translate(kx,ky);
      ctx.rotate(tilt);
      if(flip===-1)ctx.scale(1,-1);
      // Fade near player to avoid obscuring them
      const _fdx=kx-player.x,_fdy=ky-player.y;
      const _fd=Math.sqrt(_fdx*_fdx+_fdy*_fdy);
      ctx.globalAlpha=_fd<90?Math.max(0.07,0.92*(_fd/90)):0.92;
      drawCharacter(0,0,charIdx,ksz,0,1,'happy',0,false);
      ctx.restore();
    }
  }
  ctx.restore();
}
function drawUI(){
  const hudTop=safeTop+4;
  if(isChallengeMode){
    ctx.fillStyle='#ffd700';ctx.font='bold 13px monospace';ctx.textAlign='left';
    ctx.fillText(t('challengeLabel'),10,hudTop+10);
  }

  // HP hearts at top-left
  const hpY=hudTop+18;
  drawSpecialHpHearts(24,hpY,28,34,false);

  // Combo display (center area)
  if(comboDspT>0&&comboDsp>1){
    const a=comboDspT/55,sc=1+(1-a)*0.25;
    ctx.globalAlpha=a;ctx.save();ctx.translate(W/2,128);ctx.scale(sc,sc);
    ctx.textAlign='center';
    ctx.font='bold 24px monospace';
    ctx.lineWidth=4;
    ctx.strokeStyle='rgba(0,0,0,0.4)';
    ctx.strokeText(comboDsp+'x '+t('combo'),0,0);
    ctx.fillStyle='#ff6b35';
    ctx.fillText(comboDsp+'x '+t('combo'),0,0);
    ctx.restore();ctx.globalAlpha=1;
  }

  // Top-right button: pause bars during play, gear icon during pause
  const pauseX=W-54,pauseY=safeTop+12,pauseBW=48,pauseBH=40;
  ctx.fillStyle='#ffffff1a';rr(pauseX,pauseY,pauseBW,pauseBH,8);ctx.fill();
  if(state===ST.PAUSE){
    // Settings gear (tapping opens settings without unpausing)
    ctx.strokeStyle='#ffffff55';ctx.lineWidth=1;rr(pauseX,pauseY,pauseBW,pauseBH,8);ctx.stroke();
    ctx.fillStyle='#fff9';ctx.font='22px monospace';ctx.textAlign='center';
    ctx.fillText('⚙️',pauseX+pauseBW/2,pauseY+pauseBH*0.7);
  } else {
    ctx.strokeStyle='#ffffff18';ctx.lineWidth=1;rr(pauseX,pauseY,pauseBW,pauseBH,8);ctx.stroke();
    ctx.fillStyle='#fffa';ctx.fillRect(pauseX+14,pauseY+8,6,24);ctx.fillRect(pauseX+28,pauseY+8,6,24);
  }

  // Bottom gameplay info lives in drawActionPanel()
}

function drawActionPanel(){
  // Semi-transparent bottom panel for thumb controls
  // Lift above iPhone home indicator (safeBot) so buttons don't overlap it
  const py=H-PANEL_H-Math.min(safeBot,10);
  // Panel background (extend to bottom edge for visual continuity)
  ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(0,py,W,PANEL_H+Math.min(safeBot,10));
  ctx.fillStyle='rgba(255,255,255,0.06)';ctx.fillRect(0,py,W,1);

  // Center area: item buttons (endless/challenge) OR progress bar (pack mode)
  if(isPackMode&&currentPackStage){
    // === PACK MODE: Progress bar in center of action panel ===
    const prog=Math.min(1,rawDist/currentPackStage.dist);
    const barW=W-120,barH=8;
    const barX=(W-barW)/2,barY=py+10;
    // Bar background
    ctx.fillStyle='#ffffff15';rr(barX,barY,barW,barH,4);ctx.fill();
    // Bar fill
    if(_lowQ){ctx.fillStyle=tc('ply');}
    else{const barGr=ctx.createLinearGradient(barX,barY,barX+barW*prog,barY);barGr.addColorStop(0,tc('ply'));barGr.addColorStop(1,'#ffd700');ctx.fillStyle=barGr;}
    rr(barX,barY,Math.max(2,barW*prog),barH,4);ctx.fill();
    // Checkpoint flag at 50%
    const cpX=barX+barW*0.5;
    const cpCollected=checkpointReached||checkpointFlag.collected;
    ctx.fillStyle=cpCollected?'#34d399':'#ffffff44';
    ctx.font='bold 11px monospace';ctx.textAlign='center';
    ctx.fillText('\u2691',cpX,barY-1);
    ctx.fillStyle=cpCollected?'#34d399':'#ffffff33';
    ctx.fillRect(cpX-0.5,barY,1,barH);
    // Goal flag at end
    ctx.fillStyle='#ffd700';ctx.font='bold 11px monospace';ctx.textAlign='center';
    ctx.fillText('\u2691',barX+barW+6,barY-1);
    // Character icon moving along bar
    const charIconX=barX+barW*prog;
    const charIconY=barY+barH+8;
    drawCharacter(charIconX,charIconY,selChar,7,player.rot,1,player.face,0,true);
    // Stage name + distance + stars below bar
    const pname=tPackName(currentPackIdx)+' '+currentPackStage.name;
    ctx.fillStyle='#ffd700';ctx.font='bold 11px monospace';ctx.textAlign='left';
    ctx.fillText(pname,barX,barY+barH+22);
    ctx.fillStyle='#fff6';ctx.font='10px monospace';ctx.textAlign='right';
    ctx.fillText(Math.floor(rawDist)+'m / '+currentPackStage.dist+'m',barX+barW,barY+barH+22);
    // Stars collected
    ctx.textAlign='left';
    for(let si2=0;si2<3;si2++){
      ctx.fillStyle=si2<stageBigCollected?'#ffd700':'#ffffff22';ctx.font='bold 11px monospace';
      ctx.fillText('\u2605',barX+si2*14,barY+barH+34);
    }
  } else if(!isChallengeMode){
    const b=itemBtnLayout();
    const btnY=b.y,btnSz=b.sz;
    function drawRoundBtn(bx,col,icon,count,active,ratio,labelColor){
      const cx=bx+btnSz/2,cy=btnY+btnSz/2,r=btnSz/2;
      const baseFill=active?col+'30':'rgba(255,255,255,0.05)';
      ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.fillStyle=baseFill;ctx.fill();
      ctx.strokeStyle=active?col:'rgba(255,255,255,0.14)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,r-1,0,TAU);ctx.stroke();
      if(ratio>0){
        ctx.strokeStyle=col;ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,cy,r+5,-Math.PI/2,-Math.PI/2+TAU*ratio);ctx.stroke();
      }
      ctx.fillStyle=active?(labelColor||'#fff'):'#fff4';ctx.font='bold 18px monospace';ctx.textAlign='center';
      ctx.fillText(icon,cx,cy+7);
      if(count>0){
        const badgeX=bx+btnSz-4,badgeY=btnY+2;
        ctx.fillStyle='#ff3860';ctx.beginPath();ctx.arc(badgeX,badgeY,9,0,TAU);ctx.fill();
        ctx.fillStyle='#fff';ctx.font='bold 11px monospace';
        ctx.fillText(count,badgeX,badgeY+4);
      }
    }
    const magRatio=itemEff.magnet>0?Math.max(0,Math.min(1,itemEff.magnet/ITEM_MAGNET_DURATION)):0;
    drawRoundBtn(b.magnetX,'#f59e0b','\u{1F9F2}',magnetCount,itemEff.magnet>0||magnetCount>0,magRatio,'#fff7d1');
    drawRoundBtn(b.bombX,'#ff6b35','\u{1F4A3}',bombCount,bombCount>0,0,'#fff');
  }
  if(isSpecialModeEnabled()){
    const spBtn=specialBtnLayout();
    const ratio=Math.max(0,Math.min(1,specialState.gauge/SPECIAL_GAUGE_MAX));
    const bossLocked=state===ST.PLAY&&!specialState.active&&(bossPhase.active||bossPhase.reward);
    const ready=canActivateSpecial()&&!specialState.active;
    const pulse=ready?(0.55+0.45*Math.sin(frame*0.22)):0;
    const cx2=spBtn.cx,cy2=spBtn.cy,baseR=spBtn.r;
    ctx.save();
    if(ready){
      const glowR=baseR+10+pulse*5;
      const glow=ctx.createRadialGradient(cx2,cy2,baseR*0.25,cx2,cy2,glowR);
      glow.addColorStop(0,'rgba(255,230,120,0.36)');
      glow.addColorStop(0.6,'rgba(251,191,36,0.20)');
      glow.addColorStop(1,'rgba(251,191,36,0)');
      ctx.beginPath();ctx.arc(cx2,cy2,glowR,0,TAU);ctx.fillStyle=glow;ctx.fill();
    }
    ctx.beginPath();ctx.arc(cx2,cy2,baseR+5,0,TAU);ctx.fillStyle=bossLocked?'rgba(80,80,90,0.16)':ready?'rgba(255,215,80,0.12)':'rgba(255,255,255,0.06)';ctx.fill();
    ctx.lineCap='round';
    ctx.strokeStyle=bossLocked?'rgba(148,163,184,0.32)':ready?'rgba(255,220,120,0.4)':'rgba(255,255,255,0.14)';ctx.lineWidth=ready?5:4;
    ctx.beginPath();ctx.arc(cx2,cy2,baseR+5,-Math.PI/2,Math.PI*1.5);ctx.stroke();
    if(ratio>0){
      const segs=Math.max(8,Math.ceil(56*ratio));
      for(let i=0;i<segs;i++){
        const p0=i/segs*ratio,p1=(i+1)/segs*ratio;
        const a0=-Math.PI/2+p0*TAU,a1=-Math.PI/2+p1*TAU;
        ctx.strokeStyle=ready?'hsl('+(42+Math.sin((frame+i)*0.08)*12)+',100%,62%)':'hsl('+((frame*7+i*13)%360)+',100%,62%)';
        ctx.lineWidth=specialState.active?5:(ready?6:4);
        ctx.beginPath();ctx.arc(cx2,cy2,baseR+5,a0,a1);ctx.stroke();
      }
    }
    const topDotHue=specialState.active?(frame*10)%360:ratio>=1?48:200;
    ctx.fillStyle='hsl('+topDotHue+',100%,68%)';
    ctx.beginPath();ctx.arc(cx2,cy2-(baseR+5),ready?4.6:3.2,0,TAU);ctx.fill();
    const btnGr=ctx.createLinearGradient(spBtn.x,spBtn.y,spBtn.x,spBtn.y+spBtn.sz);
    btnGr.addColorStop(0,specialState.active?'rgba(255,255,255,0.34)':bossLocked?'rgba(74,85,104,0.95)':ready?'rgba(255,235,150,0.98)':canActivateSpecial()?'rgba(28,42,64,0.95)':'rgba(26,26,34,0.94)');
    btnGr.addColorStop(1,specialState.active?'rgba(18,24,42,0.96)':bossLocked?'rgba(30,41,59,0.98)':ready?'rgba(160,95,0,0.98)':canActivateSpecial()?'rgba(12,18,34,0.98)':'rgba(12,12,20,0.96)');
    ctx.beginPath();ctx.arc(cx2,cy2,baseR-1,0,TAU);ctx.fillStyle=btnGr;ctx.fill();
    ctx.strokeStyle=specialState.active?'rgba(255,255,255,0.85)':bossLocked?'rgba(148,163,184,0.65)':ready?'rgba(255,246,180,0.95)':canActivateSpecial()?'rgba(125,211,252,0.75)':'rgba(255,255,255,0.18)';
    ctx.lineWidth=ready?2.5:1.5;ctx.beginPath();ctx.arc(cx2,cy2,baseR-1,0,TAU);ctx.stroke();
    ctx.fillStyle=specialState.active?'#fff':bossLocked?'#94a3b8':ready?'#fff9db':canActivateSpecial()?'#d8f3ff':'#cbd5e1';
    ctx.font=ready?'italic 900 19px Georgia':'italic 900 18px Georgia';ctx.textAlign='center';
    ctx.fillText(t('specialButton'),cx2,cy2+7);
    if(ready){
      const badgeW=44,badgeH=14,badgeX=cx2-badgeW/2,badgeY=spBtn.y+spBtn.sz+3;
      ctx.fillStyle='rgba(255,214,10,'+(0.78+0.18*pulse)+')';rr(badgeX,badgeY,badgeW,badgeH,7);ctx.fill();
      ctx.strokeStyle='rgba(255,250,220,0.9)';ctx.lineWidth=1;rr(badgeX,badgeY,badgeW,badgeH,7);ctx.stroke();
      ctx.fillStyle='#3b2500';ctx.font='bold 9px monospace';
      ctx.fillText('READY',cx2,badgeY+10);
    } else {
      ctx.fillStyle=specialState.active?'#34d399':bossLocked?'#64748b':'#94a3b8';
      ctx.font='bold 8px monospace';
      ctx.fillText(specialState.active?(specialState.t/60).toFixed(1):bossLocked?'LOCK':Math.floor(ratio*100)+'%',cx2,spBtn.y+spBtn.sz+12);
    }
    ctx.restore();
  }

  // Score display in panel (left side) — hidden in pack/stage mode
  if(isChallengeMode){
    // Challenge mode: show consecutive kill count
    ctx.fillStyle='#ffd700';ctx.font='bold 24px monospace';ctx.textAlign='left';
    ctx.fillText(t('killCountDisplay')+' '+challengeKills,40,py+31);
    ctx.fillStyle='#fff5';ctx.font='bold 11px monospace';
    ctx.fillText('WAVE '+(challTransition.waveNum||challengeKills+1),40,py+46);
  } else if(!isPackMode){
    // Endless mode only: show score and hi-score
    ctx.fillStyle='#fff';ctx.font='bold 24px monospace';ctx.textAlign='left';
    ctx.fillText(score,40,py+31);
    ctx.fillStyle='#ffd70088';ctx.font='bold 11px monospace';
    ctx.fillText('HI: '+highScore,40,py+46);
  }

  // Coin and speed display: right of bomb button
  if(!isPackMode&&!isChallengeMode){
    const b2=itemBtnLayout();
    const coinDispX=b2.bombX+b2.sz+10;
    const midY=py+PANEL_H/2;
    ctx.textAlign='left';
    ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';
    ctx.fillText('● '+totalCoins,coinDispX,midY-4);
    ctx.fillStyle='#9fb4c8';ctx.font='10px monospace';
    ctx.fillText(t('speedLabel')+' '+(speed/SPEED_INIT).toFixed(1),coinDispX,midY+10);
  }

  ctx.textAlign='left';
}

function drawMile(){
  const p=mileT/100;let a,sc;
  if(p>0.85){const t=(p-0.85)/0.15;a=1-t;sc=0.5+a*0.5;}
  else if(p>0.2){a=1;sc=1;}else{a=p/0.2;sc=1+(1-a)*0.25;}
  ctx.save();ctx.globalAlpha=a;ctx.translate(W/2,H*0.5);ctx.scale(sc,sc);
  ctx.fillStyle='#ffd700';_shadow(22,'#ffd70077');
  ctx.font='bold 36px monospace';ctx.textAlign='center';ctx.fillText(mileTxt,0,0);ctx.shadowBlur=0;
  ctx.restore();ctx.globalAlpha=1;
}

function drawDemo(){
  if(!demo.active)return;
  const d=demo,th=THEMES[d.themeIdx],ch=CHARS[d.charIdx];
  const pr=PLAYER_R*ch.sizeMul;
  ctx.save();ctx.globalAlpha=0.35;
  // Floor platforms
  for(let i=0;i<d.plats.length;i++){const p=d.plats[i];
    if(p.x+p.w<-10||p.x>W+10)continue;
    const sY=H-p.h;
    const gr=ctx.createLinearGradient(0,sY,0,H);
    gr.addColorStop(0,th.gnd);gr.addColorStop(1,th.gnd2||th.gnd);
    ctx.fillStyle=gr;ctx.fillRect(p.x,sY,p.w,p.h);
    ctx.strokeStyle=th.line;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(p.x,sY);ctx.lineTo(p.x+p.w,sY);ctx.stroke();
  }
  // Ceiling platforms
  for(let i=0;i<d.ceilPlats.length;i++){const p=d.ceilPlats[i];
    if(p.x+p.w<-10||p.x>W+10)continue;
    const sY=p.h;
    ctx.fillStyle=th.gnd2||th.gnd;ctx.fillRect(p.x,-10,p.w,sY+10);
    ctx.strokeStyle=th.line;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(p.x,sY);ctx.lineTo(p.x+p.w,sY);ctx.stroke();
  }
  // Coins
  for(let i=0;i<d.coins.length;i++){const c=d.coins[i];
    if(c.x<-10||c.x>W+10)continue;
    const sc=0.8+Math.sin(c.t)*0.15;
    ctx.fillStyle='#ffd700';ctx.beginPath();ctx.arc(c.x,c.y,c.sz*sc,0,TAU);ctx.fill();
    ctx.fillStyle='#fff4';ctx.beginPath();ctx.arc(c.x-1,c.y-1,c.sz*0.4,0,TAU);ctx.fill();
  }
  // Enemies — use actual in-game drawEnemy for authentic appearance
  _esmTier=0; // demo always shows base tier appearance
  for(let i=0;i<d.enemies.length;i++){const e=d.enemies[i];
    if(!e.alive||e.x<-20||e.x>W+20)continue;
    drawEnemy(e);
  }
  // Kill particles
  for(let i=0;i<d.killParts.length;i++){const p=d.killParts[i];
    const a=p.life/18;
    ctx.globalAlpha=0.35*a;ctx.fillStyle=p.col;
    ctx.beginPath();ctx.arc(p.x,p.y,2+a*2,0,TAU);ctx.fill();
  }
  ctx.globalAlpha=0.35;
  // Trail
  for(let i=0;i<d.trail.length;i++){const t=d.trail[i];
    const a=t.life/12;
    ctx.globalAlpha=0.12*a;ctx.fillStyle=ch.col;
    ctx.beginPath();ctx.arc(t.x,t.y,pr*a*0.6,0,TAU);ctx.fill();
  }
  ctx.globalAlpha=0.55;
  // Player
  const dRot=d.rot;
  const dFxData=getEquippedEffectData();
  if(dFxData)drawPlayerEffect(d.px,d.py,pr,dFxData.type,0.55);
  drawPetShowcase('demo',d.px,d.py,pr,1,0.6);
  drawCharacter(d.px,d.py,d.charIdx,pr,dRot,0.85,d.face,0);
  // Combo popup
  if(d.comboN>=2&&d.comboT>0){
    ctx.globalAlpha=0.5*(d.comboT/30);
    ctx.fillStyle='#ffd700';ctx.font='bold 14px monospace';ctx.textAlign='center';
    ctx.fillText(d.comboN+' COMBO!',d.px,d.py-pr-15);
  }
  ctx.restore();ctx.globalAlpha=1;
}

function drawTitle(){
  const p=Math.sin(titleT)*0.035+1;
  ctx.save();ctx.translate(W/2,H*0.18);ctx.scale(p,p);
  _shadow(35,'#00e5ff44');ctx.fillStyle='#00e5ff';
  ctx.font='bold 44px monospace';ctx.textAlign='center';ctx.fillText('GRAV',0,0);
  ctx.shadowColor='#ff386044';ctx.fillStyle='#ff3860';ctx.fillText('HOPPER',0,48);ctx.shadowBlur=0;
  ctx.restore();

  ctx.fillStyle='#ffffff33';ctx.font='11px monospace';ctx.textAlign='center';
  ctx.fillText('Gravity-Flip Action Runner',W/2,H*0.18+72);

  // Player name
  if(playerName){
    ctx.fillStyle='#fff8';ctx.font='bold 14px monospace';ctx.textAlign='center';
    ctx.fillText(playerName,W/2,H*0.18+92);
    const eqTitle=getEquippedTitleDef();
    if(eqTitle){
      drawTitleBadge(W/2,H*0.18+112,eqTitle,{scale:0.98,fontPx:10});
    }
  }

  // Character selection: 2 rows x 3 columns
  ctx.fillStyle='#fff8';ctx.font='bold 13px monospace';ctx.textAlign='center';
  ctx.fillText(t('charSelect'),W/2,H*0.42);

  const cols=3,rows=2;
  const charW=58,charH=62,charGap=10;
  const gridW=cols*(charW+charGap)-charGap;
  const gridX=W/2-gridW/2;
  const gridY=H*0.44;

  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const idx=r*cols+c;if(idx>=CHARS.length)break;
      const ch=CHARS[idx];
      const locked=!isCharUnlocked(idx);
      const cx=gridX+c*(charW+charGap);
      const cy=gridY+r*(charH+charGap);
      // Selection highlight
      if(idx===selChar&&!locked){
        ctx.strokeStyle=ch.col;ctx.lineWidth=2;_shadow(8,ch.col);
        rr(cx-2,cy-2,charW+4,charH+4,8);ctx.stroke();ctx.shadowBlur=0;
      }
      ctx.fillStyle=locked?'#ffffff06':idx===selChar?'#ffffff18':'#ffffff08';
      rr(cx,cy,charW,charH,6);ctx.fill();

      if(locked){
        // Secret: character silhouette drawn directly (no ctx reassignment)
        ctx.save();ctx.globalAlpha=0.5;
        const scx=cx+charW/2,scy=cy+charH/2-8,sr=14;
        ctx.fillStyle='#111118';
        switch(ch.shape){
          case'cube':rr(scx-sr,scy-sr,sr*2,sr*2,sr*0.3);ctx.fill();break;
          case'ball':ctx.beginPath();ctx.arc(scx,scy,sr,0,TAU);ctx.fill();break;
          case'tire':ctx.beginPath();ctx.arc(scx,scy,sr,0,TAU);ctx.fill();break;
          case'ghost':ctx.beginPath();ctx.arc(scx,scy-sr*0.15,sr,Math.PI,0);ctx.lineTo(scx+sr,scy+sr);
            for(let gi=0;gi<4;gi++){const bx=sr-gi*(sr*2/4)-sr*2/8;ctx.quadraticCurveTo(scx+bx+sr/8,scy+sr-sr*0.35,scx+bx-sr/8,scy+sr);}
            ctx.closePath();ctx.fill();break;
          case'ninja':rr(scx-sr,scy-sr,sr*2,sr*2,sr*0.25);ctx.fill();break;
          case'stone':ctx.beginPath();ctx.moveTo(scx-sr*0.5,scy-sr*0.9);ctx.lineTo(scx+sr*0.4,scy-sr*0.85);
            ctx.lineTo(scx+sr*0.85,scy-sr*0.3);ctx.lineTo(scx+sr*0.9,scy+sr*0.3);ctx.lineTo(scx+sr*0.5,scy+sr*0.85);
            ctx.lineTo(scx-sr*0.3,scy+sr*0.9);ctx.lineTo(scx-sr*0.85,scy+sr*0.4);ctx.lineTo(scx-sr*0.9,scy-sr*0.2);
            ctx.closePath();ctx.fill();break;
          default:ctx.beginPath();ctx.arc(scx,scy,sr,0,TAU);ctx.fill();
        }
        ctx.restore();
        // Lock icon
        ctx.fillStyle='#fff5';ctx.font='bold 14px monospace';ctx.textAlign='center';
        ctx.fillText('\uD83D\uDD12',cx+charW/2,cy+charH/2+1);
        ctx.fillStyle='#fff3';ctx.font='8px monospace';
        ctx.fillText('SECRET',cx+charW/2,cy+charH-4);
      } else {
        // Unlocked: draw character preview
        drawCharacter(cx+charW/2,cy+charH/2-8,idx,14,0,1,'normal');
        // Name
        ctx.fillStyle=idx===selChar?'#fff':'#fff6';ctx.font='9px monospace';ctx.textAlign='center';
        ctx.fillText(tCharName(idx),cx+charW/2,cy+charH-14);
        // Trait
        ctx.fillStyle=idx===selChar?ch.col:ch.col+'66';ctx.font='7px monospace';
        ctx.fillText(tCharTrait(idx),cx+charW/2,cy+charH-4);
        // New character notification badge (animated !)
        if(notifNewChars.includes(idx)){
          const bounce=Math.sin(titleT*4)*3;
          const bp=Math.sin(titleT*3)*0.15+1;
          ctx.save();ctx.translate(cx+charW-2,cy+2);ctx.scale(bp,bp);
          ctx.fillStyle='#ff3860';ctx.beginPath();ctx.arc(0,bounce,9,0,TAU);ctx.fill();
          ctx.strokeStyle='#ff6888';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,bounce,9,0,TAU);ctx.stroke();
          ctx.fillStyle='#fff';ctx.font='bold 12px monospace';ctx.textAlign='center';
          ctx.fillText('!',0,bounce+5);
          ctx.restore();
        }
      }
    }
  }

  // Long-press hint (below character grid, visible and clear)
  const hintY=gridY+rows*(charH+charGap)+8;
  ctx.fillStyle='#fff5';ctx.font='10px monospace';ctx.textAlign='center';
  ctx.fillText(t('longPressHint'),W/2,hintY);

  const modeLay=titleModeLayout();

  // Stats panel (between character grid and mode buttons)
  const statsY=hintY+16;
  {
    let statLines=2; // endless + challenge always shown
    statLines++; // coins always shown
    if(played>0) statLines++;
    const statsPanelH=statLines*16+6;
    ctx.fillStyle='rgba(0,0,0,0.35)';rr(W/2-100,statsY,200,statsPanelH,8);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=1;rr(W/2-100,statsY,200,statsPanelH,8);ctx.stroke();
    let lineIdx=0;
    ctx.fillStyle='#ffd700';ctx.font='bold 13px monospace';ctx.textAlign='center';ctx.fillText(t('endlessLabel')+': '+(highScore>0?highScore:'-'),W/2,statsY+16+lineIdx*16);lineIdx++;
    ctx.fillStyle='#ff6080';ctx.font='bold 13px monospace';ctx.textAlign='center';ctx.fillText(t('challengeLabel')+': '+(challengeBestKills>0?challengeBestKills:'-'),W/2,statsY+16+lineIdx*16);lineIdx++;
    ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText('\u25CF '+walletCoins,W/2,statsY+16+lineIdx*16);lineIdx++;
    if(played>0){ctx.fillStyle='#fff3';ctx.font='11px monospace';ctx.fillText(t('playCount')+': '+played,W/2,statsY+16+lineIdx*16);}
  }

  // Endless mode button (top, large)
  ctx.fillStyle='#00e5ff22';rr(modeLay.endless.x,modeLay.endless.y,modeLay.endless.w,modeLay.endless.h,10);ctx.fill();
  ctx.strokeStyle='#00e5ff';ctx.lineWidth=2;rr(modeLay.endless.x,modeLay.endless.y,modeLay.endless.w,modeLay.endless.h,10);ctx.stroke();
  ctx.fillStyle='#00e5ff';ctx.font='bold 16px monospace';ctx.textAlign='center';
  ctx.fillText(t('endless'),modeLay.endless.x+modeLay.endless.w/2,modeLay.endless.y+29);

  // Challenge mode button (bottom-left)
  ctx.fillStyle='#ff386022';rr(modeLay.challenge.x,modeLay.challenge.y,modeLay.challenge.w,modeLay.challenge.h,8);ctx.fill();
  ctx.strokeStyle='#ff3860';ctx.lineWidth=1.5;rr(modeLay.challenge.x,modeLay.challenge.y,modeLay.challenge.w,modeLay.challenge.h,8);ctx.stroke();
  ctx.fillStyle='#ff6080';ctx.font='bold 13px monospace';
  ctx.fillText(t('challenge'),modeLay.challenge.x+modeLay.challenge.w/2,modeLay.challenge.y+24);

  // Stage mode button (bottom-right, disabled)
  ctx.fillStyle='#ffffff08';rr(modeLay.stage.x,modeLay.stage.y,modeLay.stage.w,modeLay.stage.h,8);ctx.fill();
  ctx.strokeStyle='#ffffff22';ctx.lineWidth=1.5;rr(modeLay.stage.x,modeLay.stage.y,modeLay.stage.w,modeLay.stage.h,8);ctx.stroke();
  ctx.fillStyle='#ffffff44';ctx.font='bold 13px monospace';
  ctx.fillText(t('stage'),modeLay.stage.x+modeLay.stage.w/2,modeLay.stage.y+17);
  ctx.fillStyle='#ffffff33';ctx.font='bold 8px monospace';
  ctx.fillText(t('comingSoon'),modeLay.stage.x+modeLay.stage.w/2,modeLay.stage.y+31);

  // Copyright (bottom center)
  ctx.fillStyle='#fff2';ctx.font='8px monospace';ctx.textAlign='center';
  ctx.fillText('\u00A9 2026 ny',W/2,H-safeBot+4);
  // Version (top right, below buttons)
  ctx.fillStyle='#fff2';ctx.font='8px monospace';ctx.textAlign='right';
  ctx.fillText('v'+GAME_VERSION,W-8,safeTop+124);

  // Controls info removed – now accessible via settings panel ❓ button

  // Ranking button (top left, row 1)
  ctx.fillStyle='#ffffff14';rr(8,safeTop+6,36,36,8);ctx.fill();
  ctx.strokeStyle='#ffd70044';ctx.lineWidth=1;rr(8,safeTop+6,36,36,8);ctx.stroke();
  ctx.fillStyle='#ffd700';ctx.font='16px monospace';ctx.textAlign='center';
  ctx.fillText('\uD83C\uDFC6',26,safeTop+30);
  // Ranking notification badge (new high score)
  if(notifNewHighScore){
    const bp=Math.sin(titleT*3)*0.18+1;
    ctx.save();ctx.translate(38,safeTop+10);ctx.scale(bp,bp);
    ctx.fillStyle='#ff3860';ctx.beginPath();ctx.arc(0,0,8,0,TAU);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 10px monospace';ctx.textAlign='center';
    ctx.fillText('!',0,4);
    ctx.restore();
  }

  // Inventory button (top left, row 2) - chest icon with ! badge
  ctx.fillStyle='#ffffff14';rr(8,safeTop+44,36,36,8);ctx.fill();
  ctx.fillStyle='#ffd700';ctx.font='18px monospace';ctx.textAlign='center';
  ctx.fillText('\uD83D\uDCE6',26,safeTop+68);
  if(storedChests>0){
    const bp=Math.sin(titleT*2)*0.15+1;
    ctx.save();ctx.translate(38,safeTop+48);ctx.scale(bp,bp);
    ctx.fillStyle='#ff3860';ctx.beginPath();ctx.arc(0,0,8,0,TAU);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 10px monospace';ctx.textAlign='center';
    ctx.fillText('!',0,4);
    ctx.restore();
  }
  // Shop button (top left, row 3)
  ctx.fillStyle='#ffffff14';rr(8,safeTop+82,36,36,8);ctx.fill();
  ctx.strokeStyle='#ff69b444';ctx.lineWidth=1;rr(8,safeTop+82,36,36,8);ctx.stroke();
  ctx.fillStyle='#ff69b4';ctx.font='16px monospace';ctx.textAlign='center';
  ctx.fillText('\uD83D\uDED2',26,safeTop+105);
  // Dress-up button (top left, row 4)
  ctx.fillStyle='#ffffff14';rr(8,safeTop+120,36,36,8);ctx.fill();
  ctx.strokeStyle='#a855f744';ctx.lineWidth=1;rr(8,safeTop+120,36,36,8);ctx.stroke();
  ctx.fillStyle='#a855f7';ctx.font='16px monospace';ctx.textAlign='center';
  ctx.fillText('\uD83D\uDC57',26,safeTop+143);
  // Title button (top left, row 5)
  ctx.fillStyle='#ffffff14';rr(8,safeTop+158,36,36,8);ctx.fill();
  ctx.strokeStyle='#7dd3fc44';ctx.lineWidth=1;rr(8,safeTop+158,36,36,8);ctx.stroke();
  ctx.fillStyle='#7dd3fc';ctx.font='16px monospace';ctx.textAlign='center';
  ctx.fillText('\uD83C\uDF96',26,safeTop+181);
  // Cosmetic notification badge (new cosmetic obtained)
  if(notifNewCosmetic){
    const bp=Math.sin(titleT*3)*0.18+1;
    ctx.save();ctx.translate(38,safeTop+124);ctx.scale(bp,bp);
    ctx.fillStyle='#ff3860';ctx.beginPath();ctx.arc(0,0,8,0,TAU);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 10px monospace';ctx.textAlign='center';
    ctx.fillText('!',0,4);
    ctx.restore();
  }

  // Settings gear button (top right)
  ctx.fillStyle='#ffffff14';rr(W-44,safeTop+6,36,36,8);ctx.fill();
  ctx.fillStyle='#fff6';ctx.font='18px monospace';ctx.textAlign='center';
  ctx.fillText('\u2699\uFE0F',W-26,safeTop+30);
  // Help button
  ctx.fillStyle='#ffffff14';rr(W-44,safeTop+44,36,36,8);ctx.fill();
  ctx.strokeStyle='#4488ff44';ctx.lineWidth=1;rr(W-44,safeTop+44,36,36,8);ctx.stroke();
  ctx.fillStyle='#4488ff';ctx.font='16px monospace';ctx.textAlign='center';
  ctx.fillText('\u2753',W-26,safeTop+67);
  // Settings panel overlay
  if(settingsOpen){
    ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(0,0,W,H);
    const pw=Math.min(320,W-24),ph=484,px=W/2-pw/2,py=H/2-ph/2;
    const panGr=ctx.createLinearGradient(px,py,px,py+ph);
    panGr.addColorStop(0,'rgba(15,15,40,0.97)');panGr.addColorStop(1,'rgba(8,8,25,0.97)');
    ctx.fillStyle=panGr;rr(px,py,pw,ph,14);ctx.fill();
    ctx.strokeStyle='#00e5ff44';ctx.lineWidth=1.5;rr(px,py,pw,ph,14);ctx.stroke();
    // Title
    ctx.fillStyle='#fff';ctx.font='bold 16px monospace';ctx.textAlign='center';
    ctx.fillText(t('settings'),W/2,py+28);
    // BGM volume slider
    const slW=pw-50,slX=px+25,slY1=py+52;
    ctx.fillStyle='#fff8';ctx.font='11px monospace';ctx.textAlign='left';
    ctx.fillText('BGM',slX,slY1);
    const barX=slX+42,barW=slW-42,barY=slY1-8,barH=10;
    ctx.fillStyle='#ffffff12';rr(barX,barY,barW,barH,5);ctx.fill();
    ctx.fillStyle='#00e5ff';rr(barX,barY,barW*bgmVol,barH,5);ctx.fill();
    // Knob
    const knobX=barX+barW*bgmVol;
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(knobX,barY+barH/2,7,0,TAU);ctx.fill();
    ctx.fillStyle='#00e5ff';ctx.beginPath();ctx.arc(knobX,barY+barH/2,5,0,TAU);ctx.fill();
    // Value
    ctx.fillStyle='#fff6';ctx.font='10px monospace';ctx.textAlign='right';
    ctx.fillText(Math.round(bgmVol*100)+'%',slX+slW,slY1);
    // SFX volume slider
    const slY2=slY1+44;
    ctx.fillStyle='#fff8';ctx.font='11px monospace';ctx.textAlign='left';
    ctx.fillText('SE',slX,slY2);
    const barY2=slY2-8;
    ctx.fillStyle='#ffffff12';rr(barX,barY2,barW,barH,5);ctx.fill();
    ctx.fillStyle='#ff8600';rr(barX,barY2,barW*sfxVol,barH,5);ctx.fill();
    const knobX2=barX+barW*sfxVol;
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(knobX2,barY2+barH/2,7,0,TAU);ctx.fill();
    ctx.fillStyle='#ff8600';ctx.beginPath();ctx.arc(knobX2,barY2+barH/2,5,0,TAU);ctx.fill();
    ctx.fillStyle='#fff6';ctx.font='10px monospace';ctx.textAlign='right';
    ctx.fillText(Math.round(sfxVol*100)+'%',slX+slW,slY2);
    // Shared toggle button constants (vibration + language)
    const langBtnW=48,langBtnH=22,langBtnGap=6;
    const langBtnX=slX+54;
    // Vibration toggle
    const vibY=slY2+32;
    ctx.fillStyle='#fff8';ctx.font='11px monospace';ctx.textAlign='left';
    ctx.fillText(t('vibration'),slX,vibY);
    const vbOffX=langBtnX+langBtnW+langBtnGap;
    ctx.fillStyle=hapticEnabled?'#00e5ff22':'#ffffff08';rr(langBtnX,vibY-14,langBtnW,langBtnH,4);ctx.fill();
    ctx.strokeStyle=hapticEnabled?'#00e5ff':'#ffffff22';ctx.lineWidth=1;rr(langBtnX,vibY-14,langBtnW,langBtnH,4);ctx.stroke();
    ctx.fillStyle=hapticEnabled?'#00e5ff':'#fff6';ctx.font='bold 10px monospace';ctx.textAlign='center';
    ctx.fillText(t('vibeOn'),langBtnX+langBtnW/2,vibY);
    ctx.fillStyle=!hapticEnabled?'#00e5ff22':'#ffffff08';rr(vbOffX,vibY-14,langBtnW,langBtnH,4);ctx.fill();
    ctx.strokeStyle=!hapticEnabled?'#00e5ff':'#ffffff22';ctx.lineWidth=1;rr(vbOffX,vibY-14,langBtnW,langBtnH,4);ctx.stroke();
    ctx.fillStyle=!hapticEnabled?'#00e5ff':'#fff6';ctx.font='bold 10px monospace';ctx.textAlign='center';
    ctx.fillText(t('vibeOff'),vbOffX+langBtnW/2,vibY);
    // Language selector
    const langY=vibY+34;
    ctx.fillStyle='#fff8';ctx.font='11px monospace';ctx.textAlign='left';
    ctx.fillText(t('language'),slX,langY);
    // Japanese button
    ctx.fillStyle=gameLang==='ja'?'#00e5ff22':'#ffffff08';
    rr(langBtnX,langY-14,langBtnW,langBtnH,4);ctx.fill();
    ctx.strokeStyle=gameLang==='ja'?'#00e5ff':'#ffffff22';ctx.lineWidth=1;
    rr(langBtnX,langY-14,langBtnW,langBtnH,4);ctx.stroke();
    ctx.fillStyle=gameLang==='ja'?'#00e5ff':'#fff6';ctx.font='bold 10px monospace';ctx.textAlign='center';
    ctx.fillText(t('langJa'),langBtnX+langBtnW/2,langY);
    // English button
    const engBtnX=langBtnX+langBtnW+langBtnGap;
    ctx.fillStyle=gameLang==='en'?'#00e5ff22':'#ffffff08';
    rr(engBtnX,langY-14,langBtnW,langBtnH,4);ctx.fill();
    ctx.strokeStyle=gameLang==='en'?'#00e5ff':'#ffffff22';ctx.lineWidth=1;
    rr(engBtnX,langY-14,langBtnW,langBtnH,4);ctx.stroke();
    ctx.fillStyle=gameLang==='en'?'#00e5ff':'#fff6';ctx.font='bold 10px monospace';ctx.textAlign='center';
    ctx.fillText('EN',engBtnX+langBtnW/2,langY);
    // Player name display + edit button
    const nameY=langY+24;
    ctx.fillStyle='#fff6';ctx.font='10px monospace';ctx.textAlign='left';
    ctx.fillText(t('player'),slX,nameY);
    if(nameEditMode){
      // Editing: show input box
      ctx.fillStyle='#0a0a2e';rr(slX+54,nameY-14,pw-100,22,4);ctx.fill();
      ctx.strokeStyle='#ffd700';ctx.lineWidth=1.5;rr(slX+54,nameY-14,pw-100,22,4);ctx.stroke();
      const blink=Math.floor(Date.now()/500)%2===0?'|':'';
      ctx.fillStyle='#fff';ctx.font='12px monospace';ctx.textAlign='left';
      ctx.fillText(nameEditBuf+blink,slX+60,nameY);
      // OK button
      ctx.fillStyle='#00e5ff22';rr(px+pw-42,nameY-14,36,22,4);ctx.fill();
      ctx.strokeStyle='#00e5ff';ctx.lineWidth=1;rr(px+pw-42,nameY-14,36,22,4);ctx.stroke();
      ctx.fillStyle='#00e5ff';ctx.font='bold 10px monospace';ctx.textAlign='center';
      ctx.fillText('OK',px+pw-24,nameY);
    } else {
      // Display name + change button
      ctx.fillStyle='#fff';ctx.font='12px monospace';ctx.textAlign='left';
      ctx.fillText(playerName,slX+54,nameY);
      ctx.fillStyle='#ffd70022';rr(px+pw-72,nameY-14,66,22,4);ctx.fill();
      ctx.strokeStyle='#ffd70066';ctx.lineWidth=1;rr(px+pw-72,nameY-14,66,22,4);ctx.stroke();
      ctx.fillStyle='#ffd700';ctx.font='10px monospace';ctx.textAlign='center';
      ctx.fillText(t('change'),px+pw-39,nameY);
    }
    // Tutorial replay button
    const tutBtnY=nameY+22;
    ctx.fillStyle='#ffd70022';rr(px+20,tutBtnY,pw-40,30,6);ctx.fill();
    ctx.strokeStyle='#ffd70066';ctx.lineWidth=1;rr(px+20,tutBtnY,pw-40,30,6);ctx.stroke();
    ctx.fillStyle='#ffd700';ctx.font='12px monospace';ctx.textAlign='center';
    ctx.fillText(t('replayTutorial'),W/2,tutBtnY+20);
    // Data reset button
    const resetBtnY=tutBtnY+38;
    if(resetConfirmStep===0){
      ctx.fillStyle='#ff444422';rr(px+20,resetBtnY,pw-40,30,6);ctx.fill();
      ctx.strokeStyle='#ff444466';ctx.lineWidth=1;rr(px+20,resetBtnY,pw-40,30,6);ctx.stroke();
      ctx.fillStyle='#ff4444';ctx.font='12px monospace';ctx.textAlign='center';
      ctx.fillText(t('dataReset'),W/2,resetBtnY+20);
    } else if(resetConfirmStep===1){
      ctx.fillStyle='#ff444444';rr(px+20,resetBtnY,pw-40,30,6);ctx.fill();
      ctx.strokeStyle='#ff4444';ctx.lineWidth=2;rr(px+20,resetBtnY,pw-40,30,6);ctx.stroke();
      ctx.fillStyle='#ff4444';ctx.font='bold 12px monospace';ctx.textAlign='center';
      ctx.fillText(t('confirmDelete'),W/2,resetBtnY+20);
    } else if(resetConfirmStep===2){
      const blink=Math.sin(Date.now()*0.01)*0.3+0.7;
      ctx.fillStyle='rgba(255,68,68,'+(0.3*blink)+')';rr(px+20,resetBtnY,pw-40,30,6);ctx.fill();
      ctx.strokeStyle='#ff0000';ctx.lineWidth=2;rr(px+20,resetBtnY,pw-40,30,6);ctx.stroke();
      ctx.fillStyle='#ff0000';ctx.font='bold 12px monospace';ctx.textAlign='center';
      ctx.fillText(t('finalConfirm'),W/2,resetBtnY+20);
    }
    // Login method indicator (above logout button)
    const methodY=resetBtnY+42;
    ctx.fillStyle='#fff3';ctx.font='9px monospace';ctx.textAlign='center';
    const methodStr=fbLoginMethod==='google'?t('googleAccount'):fbLoginMethod==='apple'?t('appleAccount'):fbLoginMethod==='twitter'?t('xAccount'):fbLoginMethod==='anonymous'?t('guestLogin'):'';
    if(methodStr)ctx.fillText(methodStr,W/2,methodY);
    // Account linking buttons (guest users only)
    let linkBtnOffset=0;
    if(fbLoginMethod==='anonymous'){
      const linkY=methodY+10;
      const linkBW=(pw-48)/2;
      // Google link
      ctx.fillStyle='#4285f422';rr(px+20,linkY,linkBW,28,6);ctx.fill();
      ctx.strokeStyle='#4285f466';ctx.lineWidth=1;rr(px+20,linkY,linkBW,28,6);ctx.stroke();
      ctx.fillStyle='#4285f4';ctx.font='bold 10px monospace';ctx.textAlign='center';
      ctx.fillText(t('googleLink'),px+20+linkBW/2,linkY+18);
      // Apple link
      ctx.fillStyle='#ffffff22';rr(px+20+linkBW+8,linkY,linkBW,28,6);ctx.fill();
      ctx.strokeStyle='#ffffff66';ctx.lineWidth=1;rr(px+20+linkBW+8,linkY,linkBW,28,6);ctx.stroke();
      ctx.fillStyle='#fff';ctx.font='bold 10px monospace';ctx.textAlign='center';
      ctx.fillText(t('appleLink'),px+20+linkBW+8+linkBW/2,linkY+18);
      linkBtnOffset=42;
    }
    // Logout button
    const logoutBtnY=methodY+8+linkBtnOffset;
    if(!logoutConfirm){
      ctx.fillStyle='#ff860022';rr(px+20,logoutBtnY,pw-40,30,6);ctx.fill();
      ctx.strokeStyle='#ff860066';ctx.lineWidth=1;rr(px+20,logoutBtnY,pw-40,30,6);ctx.stroke();
      ctx.fillStyle='#ff8600';ctx.font='12px monospace';ctx.textAlign='center';
      ctx.fillText(t('logout'),W/2,logoutBtnY+20);
    } else {
      ctx.fillStyle='#ff860044';rr(px+20,logoutBtnY,pw-40,30,6);ctx.fill();
      ctx.strokeStyle='#ff8600';ctx.lineWidth=2;rr(px+20,logoutBtnY,pw-40,30,6);ctx.stroke();
      ctx.fillStyle='#ff8600';ctx.textAlign='center';
      if(fbLoginMethod==='anonymous'){
        ctx.font='bold 10px monospace';
        ctx.fillText(t('guestDataWarning'),W/2,logoutBtnY+20);
      } else {
        ctx.font='bold 12px monospace';
        ctx.fillText(t('confirmLogout'),W/2,logoutBtnY+20);
      }
    }
    // Delete Account button
    const deleteAccBtnY=logoutBtnY+56;
    ctx.fillStyle='#88000018';rr(px+20,deleteAccBtnY,pw-40,28,6);ctx.fill();
    ctx.strokeStyle='#88000044';ctx.lineWidth=1;rr(px+20,deleteAccBtnY,pw-40,28,6);ctx.stroke();
    ctx.fillStyle='#aa3333';ctx.font='11px monospace';ctx.textAlign='center';
    ctx.fillText(t('deleteAccount'),W/2,deleteAccBtnY+18);
    // Close button
    const closeY=py+ph-42;
    ctx.fillStyle='#00e5ff22';rr(px+20,closeY,pw-40,32,8);ctx.fill();
    ctx.strokeStyle='#00e5ff';ctx.lineWidth=1;rr(px+20,closeY,pw-40,32,8);ctx.stroke();
    ctx.fillStyle='#00e5ff';ctx.font='bold 13px monospace';ctx.textAlign='center';
    ctx.fillText(t('close'),W/2,closeY+22);
    // Confirm modal overlay
    if(confirmModal){
      ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(0,0,W,H);
      const mW2=Math.min(280,W-40),mH2=220;
      const mX2=W/2-mW2/2,mY2=H/2-mH2/2;
      // Modal box
      ctx.fillStyle='#1a1a2e';rr(mX2,mY2,mW2,mH2,14);ctx.fill();
      const borderCol=confirmModal.type==='reset'?'#ff4444':confirmModal.type==='deleteAccount'?'#cc2222':'#ff8600';
      ctx.strokeStyle=borderCol;ctx.lineWidth=2;rr(mX2,mY2,mW2,mH2,14);ctx.stroke();
      // Icon
      ctx.font='32px monospace';ctx.textAlign='center';
      ctx.fillStyle=borderCol;
      ctx.fillText(confirmModal.type==='reset'?'\u26A0':confirmModal.type==='deleteAccount'?'\u{1F5D1}':'\u{1F6AA}',W/2,mY2+44);
      // Title
      ctx.font='bold 16px monospace';ctx.fillStyle='#fff';
      ctx.fillText(confirmModal.type==='reset'?t('dataResetTitle'):confirmModal.type==='deleteAccount'?t('deleteAccountTitle'):t('logoutTitle'),W/2,mY2+72);
      // Description
      ctx.font='12px monospace';ctx.fillStyle='#fff8';
      if(confirmModal.step===0){
        if(confirmModal.type==='reset'){
          ctx.fillText(t('allDataDeleted'),W/2,mY2+100);
          ctx.fillText(t('cannotUndo'),W/2,mY2+118);
        } else if(confirmModal.type==='deleteAccount'){
          ctx.fillText(t('deleteAccountDesc'),W/2,mY2+100);
          ctx.fillText(t('cannotUndo'),W/2,mY2+118);
        } else {
          if(fbLoginMethod==='anonymous'){
            ctx.fillText(t('guestDataLost'),W/2,mY2+100);
            ctx.fillText(t('cannotUndo'),W/2,mY2+118);
          } else {
            ctx.fillText(t('logoutQuestion'),W/2,mY2+100);
            ctx.fillText(t('dataKept'),W/2,mY2+118);
          }
        }
      } else {
        ctx.fillStyle='#ff4444';ctx.font='bold 13px monospace';
        ctx.fillText(t('reallyExecute'),W/2,mY2+100);
        ctx.fillStyle='#ff444488';ctx.font='11px monospace';
        ctx.fillText(t('cannotRevert'),W/2,mY2+118);
      }
      // Buttons
      const btnW2=(mW2-60)/2,btnH2=40;
      const cancelX2=mX2+15,confirmX2=mX2+mW2-15-btnW2;
      const btnY2=mY2+mH2-60;
      // Cancel
      ctx.fillStyle='#ffffff11';rr(cancelX2,btnY2,btnW2,btnH2,8);ctx.fill();
      ctx.strokeStyle='#ffffff44';ctx.lineWidth=1;rr(cancelX2,btnY2,btnW2,btnH2,8);ctx.stroke();
      ctx.fillStyle='#fff';ctx.font='bold 13px monospace';ctx.textAlign='center';
      ctx.fillText(t('cancel'),cancelX2+btnW2/2,btnY2+26);
      // Confirm
      const cBg=confirmModal.step===0?borderCol+'44':(Math.sin(Date.now()*0.01)*0.15+0.35>0.4?borderCol+'88':borderCol+'44');
      ctx.fillStyle=cBg;rr(confirmX2,btnY2,btnW2,btnH2,8);ctx.fill();
      ctx.strokeStyle=borderCol;ctx.lineWidth=2;rr(confirmX2,btnY2,btnW2,btnH2,8);ctx.stroke();
      ctx.fillStyle=borderCol;ctx.font='bold 13px monospace';
      const cLabel=confirmModal.type==='logout'?t('logoutBtn'):confirmModal.type==='deleteAccount'?(confirmModal.step===0?t('deleteBtn'):t('completeDelete')):confirmModal.step===0?t('deleteBtn'):t('completeDelete');
      ctx.fillText(cLabel,confirmX2+btnW2/2,btnY2+26);
    }
  }

  // Help (操作方法) overlay
  if(helpOpen){
    ctx.fillStyle='rgba(0,0,0,0.85)';ctx.fillRect(0,0,W,H);
    const hw=Math.min(300,W-20),hh=460,hx=W/2-hw/2,hy=H/2-hh/2;
    const hGr=ctx.createLinearGradient(hx,hy,hx,hy+hh);
    hGr.addColorStop(0,'rgba(10,10,40,0.98)');hGr.addColorStop(1,'rgba(5,5,20,0.98)');
    ctx.fillStyle=hGr;rr(hx,hy,hw,hh,14);ctx.fill();
    ctx.strokeStyle='#4488ff44';ctx.lineWidth=1.5;rr(hx,hy,hw,hh,14);ctx.stroke();
    // Title
    ctx.fillStyle='#4488ff';ctx.font='bold 16px monospace';ctx.textAlign='center';
    ctx.fillText(t('helpTitle'),W/2,hy+28);
    const lx=hx+16,rx=hx+hw-16;
    let ly=hy+54;
    // Mobile section
    ctx.fillStyle='#00e5ff';ctx.font='bold 12px monospace';ctx.textAlign='left';
    ctx.fillText(t('smartphone'),lx,ly);
    ly+=20;
    ctx.font='11px monospace';
    const mobileHelp=[
      [t('tap'),t('jump')],
      [t('swipeUpDown'),t('gravityControl')],
      [t('itemButton'),t('useItem')],
    ];
    for(const[k,v]of mobileHelp){
      ctx.fillStyle='#fffa';ctx.textAlign='left';ctx.fillText(k,lx+8,ly);
      ctx.fillStyle='#fff6';ctx.textAlign='right';ctx.fillText(v,rx-4,ly);
      ly+=18;
    }
    ly+=14;
    // Tips
    ctx.fillStyle='#ffd70088';ctx.font='bold 10px monospace';ctx.textAlign='center';
    ctx.fillText(t('tipGravity'),W/2,ly);
    ly+=14;
    ctx.fillText(t('tipCombo'),W/2,ly);
    // Close button
    const hCloseY=hy+hh-42;
    ctx.fillStyle='#4488ff22';rr(W/2-50,hCloseY,100,32,8);ctx.fill();
    ctx.strokeStyle='#4488ff';ctx.lineWidth=1;rr(W/2-50,hCloseY,100,32,8);ctx.stroke();
    ctx.fillStyle='#4488ff';ctx.font='bold 13px monospace';ctx.textAlign='center';
    ctx.fillText(t('close'),W/2,hCloseY+22);
  }

  // Update info modal
  if(updateInfoOpen){
    ctx.fillStyle='rgba(0,0,0,0.88)';ctx.fillRect(0,0,W,H);
    const uw=Math.min(310,W-16),uh=Math.min(460,H-20),ux=W/2-uw/2,uy=H/2-uh/2;
    const uGr=ctx.createLinearGradient(ux,uy,ux,uy+uh);
    uGr.addColorStop(0,'rgba(15,10,30,0.98)');uGr.addColorStop(1,'rgba(8,5,18,0.98)');
    ctx.fillStyle=uGr;rr(ux,uy,uw,uh,14);ctx.fill();
    ctx.strokeStyle='#ffd70044';ctx.lineWidth=1.5;rr(ux,uy,uw,uh,14);ctx.stroke();
    // Title
    ctx.fillStyle='#ffd700';ctx.font='bold 16px monospace';ctx.textAlign='center';
    ctx.fillText(t('updateInfo'),W/2,uy+28);
    // Current page data
    const curPage=UPDATE_HISTORY[updateInfoPage]||UPDATE_HISTORY[0];
    // Date with page indicator
    ctx.fillStyle='#fff6';ctx.font='10px monospace';
    const pageLabel=curPage.ver+(UPDATE_HISTORY.length>1?' ('+(updateInfoPage+1)+'/'+UPDATE_HISTORY.length+')':'');
    ctx.fillText(pageLabel,W/2,uy+44);
    // Page navigation arrows
    if(UPDATE_HISTORY.length>1){
      const arrowY=uy+38;
      // Left arrow (newer = previous page)
      if(updateInfoPage>0){
        ctx.fillStyle='#ffd700';ctx.font='bold 18px monospace';ctx.textAlign='center';
        ctx.fillText('\u25C0',ux+20,arrowY);
      } else {
        ctx.fillStyle='#ffffff22';ctx.font='bold 18px monospace';ctx.textAlign='center';
        ctx.fillText('\u25C0',ux+20,arrowY);
      }
      // Right arrow (older = next page)
      if(updateInfoPage<UPDATE_HISTORY.length-1){
        ctx.fillStyle='#ffd700';ctx.font='bold 18px monospace';ctx.textAlign='center';
        ctx.fillText('\u25B6',ux+uw-20,arrowY);
      } else {
        ctx.fillStyle='#ffffff22';ctx.font='bold 18px monospace';ctx.textAlign='center';
        ctx.fillText('\u25B6',ux+uw-20,arrowY);
      }
    }
    // Notes
    let ny=uy+64;
    const nlx=ux+16;
    for(const sec of curPage.notes){
      ctx.fillStyle='#ffd700cc';ctx.font='bold 12px monospace';ctx.textAlign='left';
      ctx.fillText('\u25B6 '+sec.title,nlx,ny);
      ny+=18;
      for(const item of sec.items){
        ctx.fillStyle='#fffb';ctx.font='10px monospace';ctx.textAlign='left';
        ctx.fillText('\u30FB '+item,nlx+8,ny);
        ny+=15;
      }
      ny+=8;
    }
    // Close button
    const uCloseY=uy+uh-42;
    ctx.fillStyle='#ffd70022';rr(W/2-50,uCloseY,100,32,8);ctx.fill();
    ctx.strokeStyle='#ffd700';ctx.lineWidth=1;rr(W/2-50,uCloseY,100,32,8);ctx.stroke();
    ctx.fillStyle='#ffd700';ctx.font='bold 13px monospace';ctx.textAlign='center';
    ctx.fillText(t('close'),W/2,uCloseY+22);
  }

  // Ranking modal overlay
  if(rankingOpen){
    rankingScroll+=(rankingScrollTarget-rankingScroll)*0.15;
    ctx.fillStyle='rgba(0,0,0,0.92)';ctx.fillRect(0,0,W,H);
    const mW=Math.min(340,W-16),topPad=safeTop+8;
    const mH=H-topPad-10;
    const mX=(W-mW)/2,mY=topPad;
    // Modal background
    ctx.fillStyle='#0a0a1a';rr(mX,mY,mW,mH,12);ctx.fill();
    ctx.strokeStyle='#ffd70044';ctx.lineWidth=2;rr(mX,mY,mW,mH,12);ctx.stroke();
    // Header
    const hdrH=76;
    ctx.fillStyle='#1a1a2e';rr(mX,mY,mW,hdrH,12);ctx.fill();
    ctx.fillStyle='#ffd700';ctx.font='bold 18px monospace';ctx.textAlign='center';
    ctx.fillText(t('ranking'),W/2,mY+22);
    // Tab buttons
    const tabY=mY+34,tabH=24,tabW=Math.floor((mW-24)/2);
    const tabLX=mX+8,tabRX=mX+8+tabW+8;
    // Endless tab
    if(rankingTab==='endless'){
      ctx.fillStyle='#ffd70033';rr(tabLX,tabY,tabW,tabH,6);ctx.fill();
      ctx.strokeStyle='#ffd700';ctx.lineWidth=1.5;rr(tabLX,tabY,tabW,tabH,6);ctx.stroke();
      ctx.fillStyle='#ffd700';
    } else {
      ctx.fillStyle='#ffffff10';rr(tabLX,tabY,tabW,tabH,6);ctx.fill();
      ctx.fillStyle='#fff6';
    }
    ctx.font='bold 11px monospace';ctx.textAlign='center';
    ctx.fillText(t('endless'),tabLX+tabW/2,tabY+16);
    // Challenge tab
    if(rankingTab==='challenge'){
      ctx.fillStyle='#ff386033';rr(tabRX,tabY,tabW,tabH,6);ctx.fill();
      ctx.strokeStyle='#ff3860';ctx.lineWidth=1.5;rr(tabRX,tabY,tabW,tabH,6);ctx.stroke();
      ctx.fillStyle='#ff3860';
    } else {
      ctx.fillStyle='#ffffff10';rr(tabRX,tabY,tabW,tabH,6);ctx.fill();
      ctx.fillStyle='#fff6';
    }
    ctx.font='bold 11px monospace';ctx.textAlign='center';
    ctx.fillText(t('challenge'),tabRX+tabW/2,tabY+16);
    // List area
    const listY=mY+hdrH+4;
    const listH=mH-hdrH-50;
    ctx.save();
    ctx.beginPath();ctx.rect(mX,listY,mW,listH);ctx.clip();
    const rowH=36;
    const scrollOff=-rankingScroll;
    const rankData=rankingTab==='challenge'?CHALLENGE_RANKING_DATA:RANKING_DATA;
    for(let i=0;i<rankData.length;i++){const entry=rankData[i];
      const ry=listY+i*rowH+scrollOff;
      if(ry+rowH<listY||ry>listY+listH)continue;
      const rank=entry.rank;
      // Row background
      if(entry.isPlayer){
        ctx.fillStyle='rgba(0,229,255,0.15)';rr(mX+4,ry,mW-8,rowH-2,6);ctx.fill();
        ctx.strokeStyle='#00e5ff88';ctx.lineWidth=1.5;rr(mX+4,ry,mW-8,rowH-2,6);ctx.stroke();
      } else if(rank===1){
        ctx.fillStyle='rgba(255,215,0,0.12)';rr(mX+4,ry,mW-8,rowH-2,6);ctx.fill();
        ctx.strokeStyle='#ffd70066';ctx.lineWidth=1;rr(mX+4,ry,mW-8,rowH-2,6);ctx.stroke();
      } else if(rank===2){
        ctx.fillStyle='rgba(192,192,192,0.10)';rr(mX+4,ry,mW-8,rowH-2,6);ctx.fill();
        ctx.strokeStyle='#c0c0c044';ctx.lineWidth=1;rr(mX+4,ry,mW-8,rowH-2,6);ctx.stroke();
      } else if(rank===3){
        ctx.fillStyle='rgba(205,127,50,0.10)';rr(mX+4,ry,mW-8,rowH-2,6);ctx.fill();
        ctx.strokeStyle='#cd7f3244';ctx.lineWidth=1;rr(mX+4,ry,mW-8,rowH-2,6);ctx.stroke();
      } else if(i%2===0){
        ctx.fillStyle='#ffffff06';rr(mX+4,ry,mW-8,rowH-2,4);ctx.fill();
      }
      // Rank number
      const rx=mX+12;
      if(rank===1){
        ctx.fillStyle='#ffd700';ctx.font='bold 14px monospace';ctx.textAlign='left';
        _shadow(8,'#ffd700');
        ctx.fillText('\uD83E\uDD47',rx,ry+24);ctx.shadowBlur=0;
      } else if(rank===2){
        ctx.fillStyle='#c0c0c0';ctx.font='bold 14px monospace';ctx.textAlign='left';
        ctx.fillText('\uD83E\uDD48',rx,ry+24);
      } else if(rank===3){
        ctx.fillStyle='#cd7f32';ctx.font='bold 14px monospace';ctx.textAlign='left';
        ctx.fillText('\uD83E\uDD49',rx,ry+24);
      } else {
        ctx.fillStyle=rank<=10?'#fff8':'#fff4';ctx.font=(rank<=10?'bold ':'')+'11px monospace';ctx.textAlign='left';
        ctx.fillText(String(rank),rx+(rank<10?4:0),ry+22);
      }
      // Character icon with per-player cosmetics
      const cix=mX+50,ciy=ry+16;
      const _rkSkin=equippedSkin,_rkEyes=equippedEyes,_rkFx=equippedEffect,_rkPet=equippedPet,_rkAcc=equippedAccessory;
      equippedSkin=entry.eqSkin||'';equippedEyes=entry.eqEyes||'';equippedEffect=entry.eqFx||'';equippedPet=entry.eqPet||'';equippedAccessory=entry.eqAcc||'';
      const rkFxData=getEquippedEffectData();
      if(rkFxData){
        ctx.save();
        ctx.beginPath();ctx.rect(mX+4,ry,mW-8,rowH-2);ctx.clip();
        drawPlayerEffect(cix,ciy+2,10,rkFxData.type,0.85,0);
        ctx.restore();
      }
      drawEquippedPetAt(cix-14,ciy+4,6,0.95,'preview',1);
      drawCharacter(cix,ciy,entry.charIdx,9,0,1,'normal',0,true);
      equippedSkin=_rkSkin;equippedEyes=_rkEyes;equippedEffect=_rkFx;equippedPet=_rkPet;equippedAccessory=_rkAcc;
      // Name
      const nameX=mX+66;
      const nameFont=entry.isPlayer?'bold 12px monospace':rank<=3?'bold 12px monospace':'11px monospace';
      if(entry.isPlayer)ctx.fillStyle='#00e5ff';
      else if(rank===1)ctx.fillStyle='#ffd700';
      else if(rank===2)ctx.fillStyle='#e0e0e0';
      else if(rank===3)ctx.fillStyle='#dda060';
      else ctx.fillStyle='#ccca';
      ctx.font=nameFont;ctx.textAlign='left';
      const scX=mX+mW-14;
      ctx.fillText(entry.name,nameX,ry+22);
      const nameW=_cMT(entry.name,nameFont);
      let markerX=nameX+nameW+4;
      if(entry.titleId){
        const badgeCx=Math.min(scX-52,nameX+nameW+42);
        const rkBd=drawTitleBadge(badgeCx,ry+16,entry.titleId,{scale:0.72,fontPx:9});
        if(rkBd)markerX=rkBd.x+rkBd.w+4;
      }
      if(entry.isPlayer){
        ctx.fillStyle='#00e5ff';ctx.font='bold 11px monospace';ctx.textAlign='left';
        ctx.fillText('\u25C0',markerX,ry+22);
      }
      // Value (right-aligned): score for endless, kills for challenge
      if(entry.isPlayer){ctx.fillStyle='#00e5ff';ctx.font='bold 13px monospace';}
      else if(rank===1){ctx.fillStyle='#ffd700';ctx.font='bold 13px monospace';}
      else if(rank===2){ctx.fillStyle='#e0e0e0';ctx.font='bold 12px monospace';}
      else if(rank===3){ctx.fillStyle='#dda060';ctx.font='bold 12px monospace';}
      else{ctx.fillStyle='#fff6';ctx.font='11px monospace';}
      ctx.textAlign='right';
      if(rankingTab==='challenge'){
        ctx.fillText(String(entry.kills),scX,ry+22);
      } else {
        ctx.fillText(entry.score.toLocaleString(),scX,ry+22);
      }
    }
    ctx.restore();
    // Scroll indicator
    const totalH=rankData.length*rowH;
    if(totalH>listH){
      const scrollRatio=rankingScroll/Math.max(1,totalH-listH);
      const thumbH=Math.max(20,listH*(listH/totalH));
      const thumbY=listY+scrollRatio*(listH-thumbH);
      ctx.fillStyle='#ffffff22';rr(mX+mW-6,thumbY,4,thumbH,2);ctx.fill();
    }
    // Footer
    const ftY=mY+mH-40;
    _drawCloseBtn(ftY);
  }
  // Character unlock celebration overlay (modal)
  if(unlockCelebT>0&&unlockCelebChar>=0){
    const ch=CHARS[unlockCelebChar];
    const p=unlockCelebT/120; // 1→0
    const fadeIn=Math.min(1,(120-unlockCelebT)/15);
    const fadeOut=unlockCelebT<20?unlockCelebT/20:1;
    const a=fadeIn*fadeOut;
    ctx.save();ctx.globalAlpha=a;
    // Full-screen dark overlay (opaque)
    ctx.fillStyle='rgba(0,0,0,0.88)';ctx.fillRect(0,0,W,H);
    // Modal panel
    const mw=Math.min(W*0.88,300),mh=Math.min(H*0.72,380);
    const mx=W/2-mw/2,my=H/2-mh/2;
    const mgr=ctx.createLinearGradient(mx,my,mx,my+mh);
    mgr.addColorStop(0,'#1a1a3a');mgr.addColorStop(1,'#0c0c20');
    ctx.fillStyle=mgr;rr(mx,my,mw,mh,16);ctx.fill();
    ctx.strokeStyle=ch.col+'88';ctx.lineWidth=2;rr(mx,my,mw,mh,16);ctx.stroke();
    // Glow behind character
    const glR=60+Math.sin((120-unlockCelebT)*0.15)*15;
    const glow=ctx.createRadialGradient(W/2,my+mh*0.32,0,W/2,my+mh*0.32,glR);
    glow.addColorStop(0,ch.col+'44');glow.addColorStop(1,ch.col+'00');
    ctx.fillStyle=glow;ctx.fillRect(mx,my,mw,mh);
    // Radial burst lines (inside modal)
    const burstA=p*Math.PI*2;
    ctx.strokeStyle=ch.col+'33';ctx.lineWidth=1.5;
    for(let i=0;i<12;i++){
      const ba=burstA+i*(Math.PI/6);
      const r1=30+((1-p)*40);const r2=r1+35;
      ctx.beginPath();ctx.moveTo(W/2+Math.cos(ba)*r1,my+mh*0.32+Math.sin(ba)*r1);
      ctx.lineTo(W/2+Math.cos(ba)*r2,my+mh*0.32+Math.sin(ba)*r2);ctx.stroke();
    }
    // Title
    ctx.fillStyle='#ffd700';_shadow(15,'#ffd70066');
    ctx.font='bold 22px monospace';ctx.textAlign='center';
    ctx.fillText(t('get'),W/2,my+30);ctx.shadowBlur=0;
    // Character big
    const sc=1.5+Math.sin((120-unlockCelebT)*0.15)*0.1;
    ctx.save();ctx.translate(W/2,my+mh*0.32);ctx.scale(sc,sc);
    drawCharacter(0,0,unlockCelebChar,22,0,1,'happy');
    ctx.restore();
    // Sparkle particles
    for(let i=0;i<8;i++){
      const sa=(120-unlockCelebT)*0.08+i*0.785;
      const sr=40+Math.sin(sa*3)*10+((120-unlockCelebT)*0.3);
      const sx=W/2+Math.cos(sa)*sr,sy=my+mh*0.32+Math.sin(sa)*sr;
      ctx.fillStyle=i%2===0?'#ffd700':ch.col;
      ctx.beginPath();ctx.arc(sx,sy,2.5+Math.sin(sa*5),0,TAU);ctx.fill();
    }
    // Character info
    ctx.fillStyle='#fff';ctx.font='bold 16px monospace';ctx.textAlign='center';
    ctx.fillText(tCharName(unlockCelebChar),W/2,my+mh*0.55);
    ctx.fillStyle=ch.col;ctx.font='11px monospace';
    ctx.fillText(tCharTrait(unlockCelebChar)+' - '+tCharDesc(unlockCelebChar),W/2,my+mh*0.55+18);
    // Stat bars in modal
    drawCharStatBars(ch,W/2,my+mh*0.55+32,Math.min(mw-30,260));
    ctx.restore();ctx.globalAlpha=1;
  }
}

function drawTitleMenu(){
  if(!titleMenuOpen)return;
  const lay=titleMenuLayout();
  const mX=lay.mX,mY=lay.mY,mW=lay.mW,mH=lay.mH;
  ctx.fillStyle='rgba(0,0,0,0.72)';ctx.fillRect(0,0,W,H);
  const panGr=ctx.createLinearGradient(mX,mY,mX,mY+mH);
  panGr.addColorStop(0,'rgba(10,20,40,0.98)');
  panGr.addColorStop(1,'rgba(8,10,22,0.98)');
  ctx.fillStyle=panGr;rr(mX,mY,mW,mH,16);ctx.fill();
  ctx.strokeStyle='rgba(125,211,252,0.35)';ctx.lineWidth=1.5;rr(mX,mY,mW,mH,16);ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='bold 16px monospace';ctx.textAlign='center';
  ctx.fillText(t('titlesMenu'),W/2,mY+26);
  ctx.fillStyle='#fff7';ctx.font='10px monospace';
  ctx.fillText(t('titleNowEquipped'),W/2,mY+46);
  const equipped=getEquippedTitleDef();
  if(equipped){
    drawTitleBadge(W/2,mY+67,equipped,{scale:1.06,fontPx:11});
  } else {
    ctx.fillStyle='#ffffff44';ctx.font='bold 12px monospace';
    ctx.fillText(t('titleUnset'),W/2,mY+71);
  }
  ctx.fillStyle='#fff5';ctx.font='10px monospace';
  const unlocked=getUnlockedTitleDefs().length;
  ctx.fillText((gameLang==='ja'?'獲得 ':'Unlocked ')+unlocked+'/'+TITLE_DEFS.length,W/2,mY+90);
  ctx.fillStyle='#fff3';ctx.font='9px monospace';
  ctx.fillText(t('titleEquipHint'),W/2,mY+104);

  const entries=getTitleMenuEntries();
  ctx.save();
  ctx.beginPath();ctx.rect(mX,lay.listY,mW,lay.listH);ctx.clip();
  let cy=lay.listY-titleMenuScroll;
  for(let i=0;i<entries.length;i++){
    const entry=entries[i],eh=titleMenuEntryHeight(entry);
    if(cy+eh<lay.listY||cy>lay.listY+lay.listH){cy+=eh;continue;}
    if(entry.type==='header'){
      ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(mX+10,cy+6,mW-20,1);
      ctx.fillStyle='#ffffff88';ctx.font='bold 10px monospace';ctx.textAlign='left';
      ctx.fillText(entry.label,mX+12,cy+18);
      cy+=eh;
      continue;
    }
    const def=entry.def;
    const unlockedTitle=isTitleUnlocked(def);
    const equippedTitle=equippedTitleId===def.id;
    const pal=titleBadgePalette(def.group,!unlockedTitle);
    const rowX=mX+8,rowY=cy+2,rowW=mW-16,rowH=eh-4;
    const rowBg=ctx.createLinearGradient(rowX,rowY,rowX+rowW,rowY+rowH);
    rowBg.addColorStop(0,equippedTitle?(pal.glow.replace('0.18','0.24').replace('0.2','0.24').replace('0.15','0.22')):'rgba(255,255,255,0.035)');
    rowBg.addColorStop(1,'rgba(255,255,255,0.02)');
    ctx.fillStyle=rowBg;rr(rowX,rowY,rowW,rowH,10);ctx.fill();
    ctx.strokeStyle=equippedTitle?pal.rim:(unlockedTitle?'rgba(255,255,255,0.12)':'rgba(148,163,184,0.16)');
    ctx.lineWidth=equippedTitle?1.5:1;rr(rowX,rowY,rowW,rowH,10);ctx.stroke();
    const bd=drawTitleBadge(mX+72,cy+34,def,{label:unlockedTitle?tTitleName(def):t('titleLockedName'),locked:!unlockedTitle,scale:0.88,fontPx:9});
    const status=equippedTitle?t('titleEquippedState'):(unlockedTitle?t('titleUnlockedState'):t('titleLockedState'));
    const statusColor=equippedTitle?pal.rim:(unlockedTitle?'#ffffff99':'#94a3b8');
    const descX=bd?Math.max(mX+130,bd.x+bd.w+8):mX+130;
    const statusX=mX+mW-18;
    ctx.fillStyle=statusColor;ctx.font='bold 9px monospace';ctx.textAlign='right';
    ctx.fillText(status,statusX,cy+16);
    const availW=statusX-descX-4;
    const wrapCh=Math.max(8,Math.floor(availW/(gameLang==='ja'?9.5:6)));
    const lines=_wrapTextLines(getTitleConditionText(def),wrapCh).slice(0,2);
    ctx.fillStyle='#fff8';ctx.font='10px monospace';ctx.textAlign='left';
    for(let li=0;li<lines.length;li++)ctx.fillText(lines[li],descX,cy+26+li*14);
    cy+=eh;
  }
  ctx.restore();
  const totalH=titleMenuContentHeight(entries);
  if(totalH>lay.listH){
    const scrollRatio=titleMenuScroll/Math.max(1,totalH-lay.listH);
    const thumbH=Math.max(20,lay.listH*(lay.listH/totalH));
    const thumbY=lay.listY+scrollRatio*(lay.listH-thumbH);
    ctx.fillStyle='#ffffff22';rr(mX+mW-6,thumbY,4,thumbH,2);ctx.fill();
  }
  _drawCloseBtn(lay.footerY);

  // Title equip confirmation modal
  if(titleConfirmPending){
    const {def,nextId}=titleConfirmPending;
    const cW=220,cH=120,cX=W/2-cW/2,cY=H/2-cH/2;
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,H);
    const cgr=ctx.createLinearGradient(cX,cY,cX,cY+cH);
    cgr.addColorStop(0,'#1a2236');cgr.addColorStop(1,'#0e1222');
    ctx.fillStyle=cgr;rr(cX,cY,cW,cH,14);ctx.fill();
    ctx.strokeStyle='rgba(125,211,252,0.5)';ctx.lineWidth=1.5;rr(cX,cY,cW,cH,14);ctx.stroke();
    const msgKey=nextId?'titleEquipConfirm':'titleUnequipConfirm';
    ctx.fillStyle='#fff';ctx.font='bold 12px monospace';ctx.textAlign='center';
    ctx.fillText(t(msgKey),W/2,cY+28);
    if(def){drawTitleBadge(W/2,cY+60,def,{scale:1,fontPx:10});}
    const btnY=cY+cH-36,btnW=(cW-36)/2;
    // Yes button
    const yesX=cX+12;
    ctx.fillStyle='rgba(125,211,252,0.18)';rr(yesX,btnY,btnW,28,8);ctx.fill();
    ctx.strokeStyle='rgba(125,211,252,0.7)';ctx.lineWidth=1;rr(yesX,btnY,btnW,28,8);ctx.stroke();
    ctx.fillStyle='#7dd3fc';ctx.font='bold 12px monospace';ctx.textAlign='center';
    ctx.fillText(t('titleConfirmYes'),yesX+btnW/2,btnY+19);
    // No button
    const noX=cX+12+btnW+12;
    ctx.fillStyle='rgba(255,255,255,0.08)';rr(noX,btnY,btnW,28,8);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1;rr(noX,btnY,btnW,28,8);ctx.stroke();
    ctx.fillStyle='#94a3b8';ctx.font='bold 12px monospace';ctx.textAlign='center';
    ctx.fillText(t('titleConfirmNo'),noX+btnW/2,btnY+19);
  }
}

function drawCharModal(){
  if(!charModal.show)return;
  const ch=CHARS[charModal.idx],t=charModal.animT;
  // Dark overlay
  ctx.fillStyle='rgba(0,0,0,0.78)';ctx.fillRect(0,0,W,H);
  // Modal panel
  const mw=Math.min(W*0.85,320),mh=H*0.72,mx=W/2-mw/2,my=H/2-mh/2;
  const panelGr=ctx.createLinearGradient(mx,my,mx,my+mh);
  panelGr.addColorStop(0,'rgba(15,15,40,0.97)');panelGr.addColorStop(1,'rgba(8,8,25,0.97)');
  ctx.fillStyle=panelGr;rr(mx,my,mw,mh,16);ctx.fill();
  ctx.strokeStyle=ch.col+'66';ctx.lineWidth=2;rr(mx,my,mw,mh,16);ctx.stroke();
  // Glow border accent
  _shadow(20,ch.col+'44');rr(mx,my,mw,mh,16);ctx.stroke();ctx.shadowBlur=0;
  // Character name
  ctx.fillStyle=ch.col;ctx.font='bold 22px monospace';ctx.textAlign='center';
  ctx.fillText(tCharName(charModal.idx),W/2,my+34);
  // Trait badge
  ctx.fillStyle=ch.col+'22';rr(W/2-50,my+40,100,20,10);ctx.fill();
  ctx.fillStyle=ch.col;ctx.font='bold 11px monospace';
  ctx.fillText(tCharTrait(charModal.idx),W/2,my+54);
  // Animated character demo area
  const demoY=my+mh*0.35;
  const bob=Math.sin(t*0.06)*6;
  const rot=Math.sin(t*0.025)*0.08;
  // Demo background circle
  ctx.fillStyle=ch.col+'0a';ctx.beginPath();ctx.arc(W/2,demoY,48,0,TAU);ctx.fill();
  ctx.strokeStyle=ch.col+'22';ctx.lineWidth=1;ctx.beginPath();ctx.arc(W/2,demoY,48,0,TAU);ctx.stroke();
  // Draw character large with animation
  const cmFxData=getEquippedEffectData();
  if(cmFxData)drawPlayerEffect(W/2,demoY+bob,32,cmFxData.type,1);
  drawCharacter(W/2,demoY+bob,charModal.idx,32,rot,1,'normal');
  // Trait-specific animated demo effects
  drawTraitDemo(ch,charModal.idx,W/2,demoY,t);
  // Status bars + special abilities
  const barStartY=demoY+72;
  drawCharStatBars(ch,W/2,barStartY,mw-40);
  // Close hint
  ctx.fillStyle='#fff3';ctx.font='10px monospace';ctx.textAlign='center';
  ctx.fillText(t('tapToCloseModal'),W/2,my+mh-12);
}
function drawTraitDemo(ch,idx,cx,cy,t){
  // Animated demonstration of each character's special trait
  switch(ch.shape){
    case'ball':
      // Bouncing effect - show higher jump arc
      for(let i=0;i<3;i++){
        const bt=t*0.08+i*2.1;
        const bh=Math.abs(Math.sin(bt))*30;
        const bx=cx-30+i*30;
        ctx.globalAlpha=0.2;ctx.fillStyle=ch.col;
        ctx.beginPath();ctx.arc(bx,cy+40-bh,4,0,TAU);ctx.fill();
      }
      ctx.globalAlpha=1;
      break;
    case'tire':
      // Step climbing + gap bridging demo
      ctx.strokeStyle='#ffffff22';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(cx-40,cy+30);ctx.lineTo(cx-10,cy+30);
      ctx.lineTo(cx-10,cy+22);ctx.lineTo(cx+4,cy+22);
      // Small gap
      ctx.moveTo(cx+12,cy+22);ctx.lineTo(cx+40,cy+22);ctx.stroke();
      // Gap indicator
      ctx.strokeStyle='#ff444466';ctx.lineWidth=1;ctx.setLineDash([2,2]);
      ctx.beginPath();ctx.moveTo(cx+4,cy+22);ctx.lineTo(cx+4,cy+38);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx+12,cy+22);ctx.lineTo(cx+12,cy+38);ctx.stroke();
      ctx.setLineDash([]);
      // Rolling tire going over stairs and gap
      const tp=((t*0.03)%1);
      const tx2=cx-40+tp*80;
      const stairY=tp<0.375?cy+30-8:cy+22-8;
      ctx.strokeStyle=ch.col+'66';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(tx2,stairY,6,0,TAU);ctx.stroke();
      // Rolling animation
      ctx.strokeStyle=ch.col+'33';ctx.lineWidth=1;
      const ra=t*0.15;
      for(let ri=0;ri<3;ri++){const a2=ra+ri*2.09;ctx.beginPath();ctx.moveTo(tx2+Math.cos(a2)*3,stairY+Math.sin(a2)*3);ctx.lineTo(tx2+Math.cos(a2)*5.5,stairY+Math.sin(a2)*5.5);ctx.stroke();}
      break;
    case'ghost':{
      // Passive coin magnet ring (dashed, subtle)
      ctx.globalAlpha=0.18+Math.sin(t*0.05)*0.08;
      ctx.strokeStyle=ch.col;ctx.lineWidth=1;ctx.setLineDash([3,3]);
      ctx.beginPath();ctx.arc(cx,cy,GHOST_PASSIVE_COIN_RADIUS*0.38,0,TAU);ctx.stroke();
      ctx.setLineDash([]);ctx.globalAlpha=1;
      // Coins orbiting toward ghost (passive absorption demo)
      for(let i=0;i<4;i++){
        const ca=t*0.04+i*1.57;
        const dist=28+Math.sin(t*0.06+i)*6;
        const cx2=cx+Math.cos(ca)*dist,cy2=cy+Math.sin(ca)*dist*0.55;
        const cAlpha=0.55+Math.sin(t*0.08+i)*0.2;
        ctx.globalAlpha=cAlpha;
        ctx.fillStyle='#ffd700';ctx.beginPath();ctx.arc(cx2,cy2,3.5,0,TAU);ctx.fill();
        ctx.fillStyle='#fff5';ctx.beginPath();ctx.arc(cx2-0.8,cy2-0.8,1,0,TAU);ctx.fill();
      }
      ctx.globalAlpha=1;
      // Transparency flicker
      if(Math.floor(t*0.015)%3===0){
        ctx.globalAlpha=0.12+Math.sin(t*0.3)*0.05;
        ctx.fillStyle=ch.col;ctx.beginPath();ctx.arc(cx+22,cy-4,7,0,TAU);ctx.fill();
        ctx.globalAlpha=1;
      }
      break;}
    case'ninja':
      // Speed lines + flip arrows
      ctx.strokeStyle=ch.col+'44';ctx.lineWidth=1.5;
      for(let i=0;i<4;i++){
        const lx=cx+20+i*8+((t*2)%40);
        ctx.globalAlpha=0.3-i*0.06;
        ctx.beginPath();ctx.moveTo(lx,cy-12);ctx.lineTo(lx+12,cy-12);ctx.stroke();
        ctx.beginPath();ctx.moveTo(lx,cy+12);ctx.lineTo(lx+12,cy+12);ctx.stroke();
      }
      ctx.globalAlpha=1;
      // Double flip arrows
      const fa=Math.sin(t*0.1)*0.3;
      ctx.save();ctx.translate(cx-42,cy);ctx.rotate(fa);
      ctx.fillStyle='#34d39966';ctx.font='16px monospace';ctx.textAlign='center';
      ctx.fillText('\u21BB',0,5);ctx.restore();
      ctx.save();ctx.translate(cx+42,cy);ctx.rotate(-fa);
      ctx.fillStyle='#34d39966';ctx.font='16px monospace';ctx.textAlign='center';
      ctx.fillText('\u21BA',0,5);ctx.restore();
      break;
    case'stone':
      // Shield/HP indicator - pulsing hearts
      for(let i=0;i<4;i++){
        const hx=cx-30+i*20,hy=cy-30+Math.sin(t*0.08+i*1.5)*3;
        ctx.fillStyle=i<3?'#ff4444':'#ffaa00';
        ctx.globalAlpha=0.4+Math.sin(t*0.1+i)*0.15;
        ctx.font='12px monospace';ctx.textAlign='center';
        ctx.fillText('\u2665',hx,hy);
      }
      ctx.globalAlpha=1;
      // Sturdy ground impact particles
      if(Math.floor(t*0.04)%3===0){
        for(let i=0;i<3;i++){
          const sx=cx-15+i*15,sy=cy+18;
          ctx.fillStyle='#8B8B8B44';
          ctx.beginPath();ctx.arc(sx,sy,2+Math.random()*2,0,TAU);ctx.fill();
        }
      }
      break;
    default: // cube
      break;
  }
}

function drawCountdown(){
  // Semi-dark overlay
  ctx.fillStyle=isChallengeMode?'rgba(0,0,0,0.65)':'rgba(0,0,0,0.45)';ctx.fillRect(-20,-20,W+40,H+40);
  const sec=Math.ceil(countdownT/60); // 3, 2, 1
  const frac=(countdownT%60)/60; // 1→0 within each second

  // Challenge mode title header
  if(isChallengeMode){
    const headerA=Math.min(1,(180-countdownT)/30);
    ctx.save();ctx.globalAlpha=headerA;
    ctx.fillStyle='#ff3860';ctx.font='bold 22px monospace';ctx.textAlign='center';
    _shadow(15,'#ff386066');
    ctx.fillText('BOSS RUSH',W/2,H*0.15);ctx.shadowBlur=0;
    ctx.fillStyle='#ffd700';ctx.font='bold 14px monospace';
    ctx.fillText(t('challengeMode'),W/2,H*0.20);
    ctx.restore();
  }

  if(sec>=1&&sec<=3){
    // Scale: starts big, shrinks to normal
    const sc=1+frac*0.6;
    const a=Math.min(1,frac*3); // fade in fast, stay visible
    ctx.save();
    ctx.globalAlpha=a;
    ctx.translate(W/2,H*0.4);
    ctx.scale(sc,sc);
    // Pulsing ring behind number
    const ringR=50+frac*20;
    const ringA=frac*0.4;
    const ringCol=isChallengeMode?'255,56,96':'0,229,255';
    ctx.strokeStyle=`rgba(${ringCol},${ringA})`;ctx.lineWidth=4;
    ctx.beginPath();ctx.arc(0,0,ringR,0,TAU);ctx.stroke();
    // Outer expanding ring
    ctx.strokeStyle=`rgba(${ringCol},${ringA*0.4})`;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(0,0,ringR+20*(1-frac),0,TAU);ctx.stroke();
    // Number
    ctx.fillStyle='#fff';_shadow(30,isChallengeMode?'#ff3860':'#00e5ff');
    ctx.font='bold 72px monospace';ctx.textAlign='center';
    ctx.fillText(sec,0,26);
    ctx.shadowBlur=0;
    ctx.restore();
  } else if(countdownT<=0){
    // "GO!" flash (shown briefly via bombFlashT-like mechanism)
    const goT=Math.max(0,20+countdownT); // countdownT goes negative briefly
    if(goT>0){
      const goA=goT/20;
      const goSc=1.5-goA*0.5;
      ctx.save();ctx.globalAlpha=goA;ctx.translate(W/2,H*0.4);ctx.scale(goSc,goSc);
      const goCol=isChallengeMode?'#ff3860':'#ffd700';
      ctx.fillStyle=goCol;_shadow(25,goCol);
      ctx.font='bold 64px monospace';ctx.textAlign='center';
      ctx.fillText(isChallengeMode?'FIGHT!':'GO!',0,22);ctx.shadowBlur=0;ctx.restore();
    }
  }
  // Character preview during countdown
  const ch=CHARS[selChar];
  ctx.fillStyle='#fff6';ctx.font='bold 12px monospace';ctx.textAlign='center';
  ctx.fillText(tCharName(selChar),W/2,H*0.58);
  drawPetShowcase('countdown',W/2,H*0.66,20,1,1);
  drawCharacter(W/2,H*0.66,selChar,20,0,1,'normal');
}

function drawPause(){
  ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(-20,-20,W+40,H+40);
  ctx.fillStyle='#fff';ctx.font='bold 34px monospace';ctx.textAlign='center';
  _shadow(12,'#fff3');
  ctx.fillText(t('paused'),W/2,H*0.28);ctx.shadowBlur=0;
  ctx.fillStyle='#fff5';ctx.font='13px monospace';
  if(isChallengeMode){
    ctx.fillText(t('killCount')+': '+challengeKills,W/2,H*0.33);
  } else {
    ctx.fillText(t('scoreLabel')+': '+score,W/2,H*0.33);
  }
  // HP in pause
  drawSpecialHpHearts(W/2,H*0.37,16,26,true);
  // Button layout: pack mode has 4 buttons, others have 3
  const hasStageSelBtn=isPackMode&&!isChallengeMode;
  const bBase=hasStageSelBtn?0.40:0.42;
  const bStep=hasStageSelBtn?0.10:0.11;
  const resumeY=H*bBase, restartY=H*(bBase+bStep);
  const stageSelY=hasStageSelBtn?H*(bBase+bStep*2):0;
  const quitY=H*(bBase+bStep*(hasStageSelBtn?3:2));
  // Resume button
  ctx.fillStyle='#00e5ff33';rr(W/2-80,resumeY,160,44,10);ctx.fill();
  ctx.strokeStyle='#00e5ff';ctx.lineWidth=2;rr(W/2-80,resumeY,160,44,10);ctx.stroke();
  ctx.fillStyle='#00e5ff';ctx.font='bold 18px monospace';ctx.fillText(t('resume'),W/2,resumeY+28);
  // Restart button
  ctx.fillStyle='#ffa50033';rr(W/2-80,restartY,160,44,10);ctx.fill();
  ctx.strokeStyle='#ffa500';ctx.lineWidth=2;rr(W/2-80,restartY,160,44,10);ctx.stroke();
  ctx.fillStyle='#ffa500';ctx.font='bold 18px monospace';ctx.fillText(t('restart'),W/2,restartY+28);
  // Stage select button (pack mode only)
  if(hasStageSelBtn){
    ctx.fillStyle='#34d39933';rr(W/2-80,stageSelY,160,44,10);ctx.fill();
    ctx.strokeStyle='#34d399';ctx.lineWidth=2;rr(W/2-80,stageSelY,160,44,10);ctx.stroke();
    ctx.fillStyle='#34d399';ctx.font='bold 18px monospace';ctx.fillText(t('stageSelect'),W/2,stageSelY+28);
  }
  // Quit button (retire in challenge mode)
  ctx.fillStyle='#ff386033';rr(W/2-80,quitY,160,44,10);ctx.fill();
  ctx.strokeStyle='#ff3860';ctx.lineWidth=2;rr(W/2-80,quitY,160,44,10);ctx.stroke();
  ctx.fillStyle='#ff3860';ctx.font='bold 18px monospace';
  ctx.fillText(isChallengeMode?t('retire'):t('toTitle'),W/2,quitY+28);
}

// ===== INVENTORY MODAL (title screen) =====
function drawInventory(){
  if(!inventoryOpen)return;
  // If chest opening is active, draw the chest open modal instead
  if(chestOpen.phase!=='none'){
    drawChestOpen();
    return;
  }
  ctx.save();
  // Dark overlay
  ctx.fillStyle='rgba(0,0,0,0.85)';ctx.fillRect(0,0,W,H);
  const mW=Math.min(300,W-24),mH=Math.min(360,H-40);
  const mX=(W-mW)/2,mY=(H-mH)/2;
  // Modal panel
  const mgr=ctx.createLinearGradient(mX,mY,mX,mY+mH);
  mgr.addColorStop(0,'#1a1a2e');mgr.addColorStop(0.5,'#16213e');mgr.addColorStop(1,'#0f0f23');
  ctx.fillStyle=mgr;rr(mX,mY,mW,mH,16);ctx.fill();
  ctx.strokeStyle='#ffd70044';ctx.lineWidth=2;rr(mX,mY,mW,mH,16);ctx.stroke();
  // Gold accent top
  ctx.strokeStyle='#ffd700';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(mX+16,mY);ctx.lineTo(mX+mW-16,mY);ctx.stroke();
  // Title
  ctx.fillStyle='#ffd700';ctx.font='bold 18px monospace';ctx.textAlign='center';
  ctx.fillText(t('treasureChest'),W/2,mY+36);
  // Wallet
  ctx.fillStyle='#ffd700';ctx.font='bold 13px monospace';
  ctx.fillText('\u25CF '+walletCoins,W/2,mY+58);
  // Chest count display
  const cx=W/2,cy=mY+mH*0.42;
  if(storedChests>0){
    // Animated chest icon
    const pulse=1+Math.sin(Date.now()*0.003)*0.05;
    ctx.save();ctx.translate(cx,cy);ctx.scale(pulse,pulse);
    drawChestIcon(0,0,48,false);
    ctx.restore();
    // Count
    ctx.fillStyle='#ffd700';ctx.font='bold 28px monospace';ctx.textAlign='center';
    ctx.fillText('\u00D7 '+storedChests,cx,cy+50);
    // Tap to open hint
    ctx.fillStyle='#fff8';ctx.font='12px monospace';
    ctx.fillText(t('tapToOpen'),cx,cy+72);
    // Batch open button (if 2+ chests)
    if(storedChests>=2){
      const boW=160,boH=34,boX=cx-boW/2,boY=cy+82;
      ctx.fillStyle='#ffd70018';rr(boX,boY,boW,boH,8);ctx.fill();
      ctx.strokeStyle='#ffd700';ctx.lineWidth=1.5;rr(boX,boY,boW,boH,8);ctx.stroke();
      ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';ctx.textAlign='center';
      ctx.fillText('\uD83D\uDCE6 '+t('openAllChests')+' ('+storedChests+')',cx,boY+22);
    }
    // Total opened
    ctx.fillStyle='#fff4';ctx.font='10px monospace';
    ctx.fillText(t('totalOpened')+' '+totalChestsOpened+' '+t('chestsOpened'),cx,mY+mH-48);
  } else {
    // No chests
    ctx.globalAlpha=0.3;
    ctx.save();ctx.translate(cx,cy);
    drawChestIcon(0,0,40,false);
    ctx.restore();
    ctx.globalAlpha=1;
    ctx.fillStyle='#fff4';ctx.font='14px monospace';ctx.textAlign='center';
    ctx.fillText(t('noChests'),cx,cy+48);
    ctx.fillStyle='#fff3';ctx.font='10px monospace';
    ctx.fillText(t('defeatBossForChest'),cx,cy+66);
    if(totalChestsOpened>0){
      ctx.fillStyle='#fff3';ctx.font='10px monospace';
      ctx.fillText(t('totalOpened')+' '+totalChestsOpened+' '+t('chestsOpened'),cx,mY+mH-48);
    }
  }
  // Footer close button
  const invCloseY=mY+mH-38;
  _drawCloseBtn(invCloseY);
  ctx.restore();
}

// ===== TREASURE CHEST DRAWING =====
function drawChestIcon(cx,cy,sz,openLid){
  // Chest body
  ctx.fillStyle='#8B5E3C';
  rr(cx-sz/2,cy-sz*0.3,sz,sz*0.6,sz*0.08);ctx.fill();
  // Dark wood grain
  ctx.fillStyle='#6B3E1C';
  ctx.fillRect(cx-sz/2+2,cy-sz*0.1,sz-4,sz*0.08);
  // Gold trim
  ctx.strokeStyle='#ffd700';ctx.lineWidth=2;
  rr(cx-sz/2,cy-sz*0.3,sz,sz*0.6,sz*0.08);ctx.stroke();
  // Gold clasp
  ctx.fillStyle='#ffd700';
  rr(cx-sz*0.1,cy-sz*0.15,sz*0.2,sz*0.2,2);ctx.fill();
  // Keyhole
  ctx.fillStyle='#3a2010';
  ctx.beginPath();ctx.arc(cx,cy-sz*0.05,sz*0.04,0,TAU);ctx.fill();
  ctx.fillRect(cx-sz*0.015,cy-sz*0.05,sz*0.03,sz*0.08);
  if(openLid){
    // Open lid (tilted back)
    ctx.save();ctx.translate(cx,cy-sz*0.3);ctx.rotate(-0.3);
    ctx.fillStyle='#9B6E4C';
    rr(-sz/2,-sz*0.35,sz,sz*0.35,sz*0.08);ctx.fill();
    ctx.strokeStyle='#ffd700';ctx.lineWidth=2;
    rr(-sz/2,-sz*0.35,sz,sz*0.35,sz*0.08);ctx.stroke();
    ctx.restore();
  } else {
    // Closed lid (rounded top)
    ctx.fillStyle='#9B6E4C';
    ctx.beginPath();
    ctx.moveTo(cx-sz/2,cy-sz*0.3);
    ctx.quadraticCurveTo(cx,cy-sz*0.55,cx+sz/2,cy-sz*0.3);
    ctx.closePath();ctx.fill();
    ctx.strokeStyle='#ffd700';ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(cx-sz/2,cy-sz*0.3);
    ctx.quadraticCurveTo(cx,cy-sz*0.55,cx+sz/2,cy-sz*0.3);
    ctx.stroke();
  }
}

function drawChestFall(){
  if(!chestFall.active)return;
  ctx.save();
  const sz=36;
  let scale=1,alpha=1;
  if(chestFall.gotT>0){
    // Shrink and fade out after collection
    const t=chestFall.gotT/40;
    scale=1-t*0.8;
    alpha=1-t;
    // Glow ring expanding
    const ringR=30+chestFall.gotT*2;
    ctx.globalAlpha=Math.max(0,(1-chestFall.gotT/30)*0.6);
    ctx.strokeStyle='#ffd700';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(chestFall.x,chestFall.y,ringR,0,TAU);ctx.stroke();
    ctx.globalAlpha=1;
  }
  ctx.globalAlpha=alpha;
  ctx.translate(chestFall.x,chestFall.y);
  ctx.scale(scale,scale);
  // Glow behind chest
  const glow=ctx.createRadialGradient(0,0,0,0,0,sz);
  glow.addColorStop(0,'rgba(255,215,0,0.4)');glow.addColorStop(1,'rgba(255,215,0,0)');
  ctx.fillStyle=glow;ctx.fillRect(-sz,-sz,sz*2,sz*2);
  // Wobble while falling
  if(chestFall.gotT===0){
    ctx.rotate(Math.sin(chestFall.sparkT*0.15)*0.15);
  }
  drawChestIcon(0,0,sz,false);
  ctx.restore();
}

function drawChestOpen(){
  if(chestOpen.phase==='none')return;
  const p=chestOpen.phase,cot=chestOpen.t;
  const rw=chestOpen.reward;
  const isChar=rw&&rw.type==='char';
  const isCosmetic=rw&&rw.type==='cosmetic';
  // isNew: true=new item, false=already owned, undefined=unknown (no badge)
  function drawChestPreviewCharacter(px,py,pr,item,alpha,isNew){
    const a=alpha===undefined?1:alpha;
    const drawA=isNew===false?a*0.42:a; // dim owned items
    const prevSkin=equippedSkin,prevEyes=equippedEyes,prevEffect=equippedEffect;
    const prevPet=equippedPet,prevAcc=equippedAccessory;
    equippedSkin='';equippedEyes='';equippedEffect='';equippedPet='';equippedAccessory='';
    if(item&&item.tab===0)equippedSkin=item.id;
    else if(item&&item.tab===1)equippedEyes=item.id;
    else if(item&&item.tab===2)equippedEffect=item.id;
    else if(item&&item.tab===3)equippedPet=item.id;
    else if(item&&item.tab===4)equippedAccessory=item.id;
    if(item&&item.tab===2)drawPlayerEffect(px,py,pr,item.type,drawA,1);
    drawCharacter(px,py,selChar,pr,0,drawA,'happy',0,true);
    if(item&&item.tab===3)drawEquippedPetAt(px+pr*1.4,py-pr*0.6,0.55,drawA,'idle',1);
    equippedSkin=prevSkin;equippedEyes=prevEyes;equippedEffect=prevEffect;
    equippedPet=prevPet;equippedAccessory=prevAcc;
  }
  ctx.save();

  // === SOLID MODAL BACKGROUND (covers game over screen) ===
  ctx.fillStyle='rgba(0,0,0,0.92)';ctx.fillRect(0,0,W,H);
  const mW=Math.min(300,W-24),mH=Math.min(400,H-40);
  const mX=(W-mW)/2,mY=(H-mH)/2;
  // Modal panel
  const mgr=ctx.createLinearGradient(mX,mY,mX,mY+mH);
  mgr.addColorStop(0,'#1a1a2e');mgr.addColorStop(0.5,'#16213e');mgr.addColorStop(1,'#0f0f23');
  ctx.fillStyle=mgr;rr(mX,mY,mW,mH,16);ctx.fill();
  // Border
  ctx.strokeStyle='#ffd70044';ctx.lineWidth=2;rr(mX,mY,mW,mH,16);ctx.stroke();
  // Gold accent top
  ctx.strokeStyle='#ffd700';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(mX+16,mY);ctx.lineTo(mX+mW-16,mY);ctx.stroke();

  const cx=W/2,cy=mY+mH*0.42;
  const chSz=48;

  // Header: chest count (skip in batchDone to avoid duplicate title)
  if(p!=='batchDone'){
    ctx.textAlign='center';ctx.fillStyle='#ffd700';ctx.font='bold 16px monospace';
    ctx.fillText(t('chestOpen'),cx,mY+30);
    ctx.fillStyle='#fff8';ctx.font='11px monospace';
    ctx.fillText(t('totalOpened')+' '+totalChestsOpened+' '+t('chestsOpened'),cx,mY+48);
    // Remaining chests
    const remainChests=deadChestOpen?Math.max(0,runChests-deadChestsOpened):storedChests;
    if(remainChests>0){
      ctx.fillStyle='#ffaa00';ctx.font='10px monospace';
      ctx.fillText(t('remainingChests')+' '+remainChests+t('chestsUnit'),cx,mY+62);
    }
    const closeX=mX+mW-38,closeY=mY+10;
    ctx.fillStyle='#ffffff12';rr(closeX,closeY,28,28,8);ctx.fill();
    ctx.strokeStyle='#fff2';ctx.lineWidth=1;rr(closeX,closeY,28,28,8);ctx.stroke();
    ctx.fillStyle='#fff8';ctx.font='bold 16px monospace';ctx.textAlign='center';
    ctx.fillText('x',closeX+14,closeY+19);
  }

  // Update and draw chest particles (clipped to modal)
  fip(chestOpen.parts,pp=>{
    pp.x+=pp.vx;pp.y+=pp.vy;pp.vy+=pp.g||0;pp.vx*=0.99;pp.life--;
    if(pp.life<=0)return false;
    const a=pp.life/pp.ml;
    ctx.globalAlpha=a;ctx.fillStyle=pp.col;
    ctx.beginPath();ctx.arc(pp.x,pp.y,pp.sz*a,0,TAU);ctx.fill();
    return true;
  });
  ctx.globalAlpha=1;

  if(p==='waiting'){
    // Pulsing chest
    const pulse=1+Math.sin(cot*0.08)*0.05;
    ctx.save();ctx.translate(cx,cy);ctx.scale(pulse,pulse);
    ctx.fillStyle='rgba(255,215,0,0.15)';
    ctx.beginPath();ctx.arc(0,0,chSz*1.2,0,TAU);ctx.fill();
    drawChestIcon(0,0,chSz,false);
    ctx.restore();
    // Floating sparkles
    if(cot%8===0){
      const a=Math.random()*TAU,r=chSz*0.8+Math.random()*20;
      chestOpen.parts.push({x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r,vx:(Math.random()-0.5)*0.5,vy:-0.5-Math.random(),life:25,ml:25,sz:Math.random()*3+1,col:['#ffd700','#ffffff','#ffaa00'][Math.floor(Math.random()*3)],g:0});
    }
    const ta=0.5+Math.sin(cot*0.1)*0.3;
    ctx.globalAlpha=ta;ctx.fillStyle='#ffd700';ctx.font='bold 15px monospace';ctx.textAlign='center';
    ctx.fillText(t('tapToOpenChest'),cx,mY+mH-30);
    ctx.globalAlpha=1;
  }
  else if(p==='wobble'){
    const wobble=Math.sin(cot*0.8)*Math.min(cot*0.3,8);
    ctx.save();ctx.translate(cx+wobble,cy);
    const glowA=Math.min(cot/40,0.6);
    ctx.globalAlpha=glowA;ctx.fillStyle='#ffd700';
    ctx.beginPath();ctx.arc(0,0,chSz*1.5,0,TAU);ctx.fill();ctx.globalAlpha=1;
    drawChestIcon(0,0,chSz,false);
    ctx.restore();
    if(cot%3===0){
      chestOpen.parts.push({x:cx+(Math.random()-0.5)*chSz,y:cy+(Math.random()-0.5)*chSz*0.5,
        vx:(Math.random()-0.5)*4,vy:-2-Math.random()*3,life:20,ml:20,sz:Math.random()*3+1,
        col:['#ffd700','#ff8800','#ffffff'][Math.floor(Math.random()*3)],g:0.1});
    }
  }
  else if(p==='burst'){
    const burstT=Math.min(cot/30,1);
    // Light beam
    const beamA=burstT*0.6;
    const beamGr=ctx.createRadialGradient(cx,cy,0,cx,cy,mH*0.8);
    beamGr.addColorStop(0,`rgba(255,230,150,${beamA})`);beamGr.addColorStop(0.4,`rgba(255,215,0,${beamA*0.3})`);beamGr.addColorStop(1,'rgba(255,215,0,0)');
    ctx.fillStyle=beamGr;ctx.fillRect(mX,mY,mW,mH);
    // Light rays
    ctx.save();ctx.translate(cx,cy);
    for(let i=0;i<12;i++){
      const ra=i*Math.PI/6+cot*0.02;
      const rayLen=60+burstT*120;
      ctx.save();ctx.rotate(ra);
      ctx.fillStyle=`rgba(255,230,180,${0.12*burstT})`;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-6,rayLen);ctx.lineTo(6,rayLen);ctx.closePath();ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.save();ctx.translate(cx,cy);
    drawChestIcon(0,0,chSz,true);
    ctx.restore();
    if(cot===1){
      for(let i=0;i<40;i++){
        const a=(TAU/40)*i,s=2+Math.random()*5;
        chestOpen.parts.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,
          life:45+Math.random()*25,ml:70,sz:Math.random()*5+2,
          col:['#ffd700','#ffaa00','#ff88cc','#88ffff','#ffffff','#ff44ff'][i%6],g:0.04});
      }
    }
  }
  else if(p==='reveal'){
    if(isChar){
      // === SUPER RARE CHARACTER REVEAL ===
      const revealT=Math.min(cot/100,1);
      // Rainbow pulsing background
      const hue=(cot*3)%360;
      const rbgA=0.15+Math.sin(cot*0.05)*0.05;
      ctx.fillStyle=`hsla(${hue},80%,50%,${rbgA})`;ctx.fillRect(mX,mY,mW,mH);
      // Rotating light rays (rainbow)
      ctx.save();ctx.translate(cx,cy-20);
      for(let i=0;i<16;i++){
        const ra=i*Math.PI/8+cot*0.03;
        const rayLen=40+revealT*140;
        const rHue=(hue+i*22)%360;
        ctx.save();ctx.rotate(ra);
        ctx.fillStyle=`hsla(${rHue},90%,70%,${0.1*revealT})`;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-5,rayLen);ctx.lineTo(5,rayLen);ctx.closePath();ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      // Open chest small below
      ctx.save();ctx.translate(cx,cy+50);ctx.scale(0.5,0.5);
      drawChestIcon(0,0,chSz,true);
      ctx.restore();
      // Character rising
      const charY=cy-10-revealT*50;
      const charScale=0.4+revealT*0.6;
      const charR=24*charScale;
      if(revealT<0.3){
        // Silhouette with rainbow glow
        ctx.save();ctx.translate(cx,charY);ctx.scale(charScale,charScale);
        ctx.fillStyle='#000';
        _shadow(30,`hsl(${hue},90%,60%)`);
        ctx.beginPath();ctx.arc(0,0,24,0,TAU);ctx.fill();
        ctx.shadowBlur=0;ctx.restore();
      } else {
        const colorT=Math.min((revealT-0.3)/0.35,1);
        ctx.save();
        _shadow(25+colorT*30,`hsl(${hue},90%,60%)`);
        drawCharacter(cx,charY,rw.charIdx,charR,0,colorT,'happy',0,false);
        ctx.shadowBlur=0;ctx.restore();
        if(colorT>=1){
          // "SUPER RARE!" banner
          const bannerA=Math.min((revealT-0.65)/0.15,1);
          const bannerPulse=1+Math.sin(cot*0.15)*0.08;
          ctx.globalAlpha=bannerA;
          ctx.save();ctx.translate(cx,charY-charR-20);ctx.scale(bannerPulse,bannerPulse);
          ctx.font='bold 20px monospace';ctx.textAlign='center';
          // Rainbow text
          const tHue=(cot*5)%360;
          ctx.fillStyle=`hsl(${tHue},100%,65%)`;
          _shadow(15,`hsl(${tHue},100%,50%)`);
          ctx.fillText(rw.isNew?'★ SUPER RARE! ★':'★ RARE! ★',0,0);
          ctx.shadowBlur=0;ctx.restore();
          ctx.globalAlpha=1;
          // Name & trait
          const nameA=Math.min((revealT-0.75)/0.15,1);
          ctx.globalAlpha=nameA;
          ctx.fillStyle='#ffd700';ctx.font='bold 18px monospace';ctx.textAlign='center';
          _shadow(12,'#ffd70088');
          ctx.fillText(tCharName(rw.charIdx),cx,charY+charR+24);
          ctx.shadowBlur=0;
          ctx.fillStyle='#fff8';ctx.font='12px monospace';
          ctx.fillText(tCharTrait(rw.charIdx),cx,charY+charR+42);
          if(rw.isNew){
            ctx.fillStyle='#34d399';ctx.font='bold 13px monospace';
            ctx.fillText(t('newUnlock'),cx,charY+charR+60);
          } else {
            ctx.fillStyle='#ffaa00';ctx.font='12px monospace';
            ctx.fillText(t('alreadyOwned500'),cx,charY+charR+60);
          }
          ctx.globalAlpha=1;
        }
      }
      // Intense rainbow sparkles
      if(cot%2===0){
        const a=Math.random()*TAU,r=20+Math.random()*80;
        const sHue=Math.floor(Math.random()*360);
        chestOpen.parts.push({x:cx+Math.cos(a)*r,y:(charY||cy)+Math.sin(a)*r,vx:(Math.random()-0.5)*2.5,vy:-1.5-Math.random()*1.5,life:35,ml:35,sz:Math.random()*4+2,col:`hsl(${sHue},90%,70%)`,g:-0.02});
      }
      // Glitter falling from top
      if(cot%4===0){
        chestOpen.parts.push({x:mX+Math.random()*mW,y:mY,vx:(Math.random()-0.5)*0.5,vy:0.5+Math.random(),life:60,ml:60,sz:Math.random()*3+1,col:['#ffd700','#ff88cc','#88ffff','#ff44ff','#ffffff'][Math.floor(Math.random()*5)],g:0.02});
      }
    } else if(isCosmetic){
      // === COSMETIC REVEAL ===
      const revealT=Math.min(cot/80,1);
      const ri=rw.item;
      const isSuperRareItem=ri.rarity==='super_rare';
      const isRareItem=ri.rarity==='rare'||isSuperRareItem;
      const hue=isRareItem?(cot*3)%360:200;
      if(isSuperRareItem){
        // === SUPER RARE: Ultra-gorgeous background ===
        const srBgA=0.18+Math.sin(cot*0.04)*0.06;
        ctx.fillStyle=`hsla(${(cot*2)%360},80%,50%,${srBgA})`;ctx.fillRect(mX,mY,mW,mH);
        // Golden light rays rotating
        ctx.save();ctx.translate(cx,cy-10);
        for(let i=0;i<20;i++){
          const ra=i*Math.PI/10+cot*0.025;const rayLen=30+revealT*160;
          const rHue=(hue+i*18)%360;
          ctx.save();ctx.rotate(ra);
          ctx.fillStyle=`hsla(${rHue},100%,70%,${0.06*revealT})`;
          ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-4,rayLen);ctx.lineTo(4,rayLen);ctx.closePath();ctx.fill();
          ctx.restore();
        }ctx.restore();
        // Falling golden glitter (constant)
        if(cot%2===0){
          chestOpen.parts.push({x:mX+Math.random()*mW,y:mY,vx:(Math.random()-0.5)*1,vy:0.8+Math.random()*1.5,
            life:70,ml:70,sz:Math.random()*4+1,col:['#ffd700','#ff88cc','#88ffff','#ff44ff','#ffffff','#ffaa00'][Math.floor(Math.random()*6)],g:0.02});
        }
        // Diamond sparkle burst
        if(cot%5===0){const a=Math.random()*TAU,r=30+Math.random()*80;
          chestOpen.parts.push({x:cx+Math.cos(a)*r,y:cy-20+Math.sin(a)*r,vx:(Math.random()-0.5)*3,vy:-2-Math.random()*2,
            life:40,ml:40,sz:Math.random()*5+3,col:`hsl(${Math.floor(Math.random()*360)},100%,75%)`,g:-0.03});}
      } else {
        const rbgA=isRareItem?0.12+Math.sin(cot*0.05)*0.04:0.06;
        ctx.fillStyle=isRareItem?`hsla(${hue},70%,50%,${rbgA})`:`rgba(100,200,255,${rbgA})`;ctx.fillRect(mX,mY,mW,mH);
        if(isRareItem){
          ctx.save();ctx.translate(cx,cy-10);
          for(let i=0;i<12;i++){
            const ra=i*Math.PI/6-cot*0.018;
            ctx.save();ctx.rotate(ra);
            ctx.fillStyle=`hsla(${260+i*8},90%,65%,${0.045+0.03*revealT})`;
            ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-3,80+revealT*70);ctx.lineTo(3,80+revealT*70);ctx.closePath();ctx.fill();
            ctx.restore();
          }
          ctx.restore();
          if(cot%4===0){
            chestOpen.parts.push({x:mX+Math.random()*mW,y:mY+Math.random()*mH*0.7,vx:(Math.random()-0.5)*1.5,vy:-0.8-Math.random()*0.8,
              life:35,ml:35,sz:Math.random()*4+1.5,col:['#a855f7','#d4a8ff','#ffffff','#7dd3fc'][Math.floor(Math.random()*4)],g:0});
          }
        }
      }
      // Open chest
      ctx.save();ctx.translate(cx,cy+40);ctx.scale(0.5,0.5);
      drawChestIcon(0,0,chSz,true);
      ctx.restore();
      // Item icon rising
      const itemY=cy-10-revealT*(isSuperRareItem?55:40);
      const itemScale=0.5+revealT*(isSuperRareItem?0.7:0.5);
      ctx.save();ctx.translate(cx,itemY);ctx.scale(itemScale,itemScale);
      if(isSuperRareItem){
        // Super rare: multi-layer glow
        _shadow(35,`hsl(${hue},100%,60%)`);
      } else {
        _shadow(20,isRareItem?`hsl(${hue},90%,60%)`:'#00aaff');
      }
      // Draw cosmetic preview
      drawChestPreviewCharacter(0,0,ri.tab===2?20:24,ri,1,rw.isNew);
      ctx.shadowBlur=0;
      ctx.restore();
      if(revealT>0.5){
        const nameA=Math.min((revealT-0.5)/0.3,1);
        ctx.globalAlpha=nameA;
        if(rw.isNew){
          if(isSuperRareItem){
            const tHue=(cot*5)%360;
            const pulse=1+Math.sin(cot*0.15)*0.1;
            ctx.save();ctx.translate(cx,itemY-40);ctx.scale(pulse,pulse);
            ctx.fillStyle=`hsl(${tHue},100%,65%)`;ctx.font='bold 20px monospace';ctx.textAlign='center';
            _shadow(20,`hsl(${tHue},100%,50%)`);
            ctx.fillText('\u2605\u2605 SUPER RARE!! \u2605\u2605',0,0);
            ctx.shadowBlur=0;ctx.restore();
          } else if(isRareItem){
            const tHue=(cot*5)%360;
            ctx.fillStyle=`hsl(${tHue},100%,65%)`;ctx.font='bold 16px monospace';ctx.textAlign='center';
            _shadow(12,`hsl(${tHue},100%,50%)`);
            ctx.fillText('\u2605 SECRET ITEM! \u2605',cx,itemY-36);
          } else {
            ctx.fillStyle='#34d399';ctx.font='bold 15px monospace';ctx.textAlign='center';
            _shadow(10,'#34d399');
            ctx.fillText('\u2728 NEW! \u2728',cx,itemY-36);
          }
        } else {
          // Already owned: prominent grey stamp
          ctx.fillStyle='rgba(0,0,0,0.55)';rr(cx-72,itemY-50,144,24,6);ctx.fill();
          ctx.strokeStyle='#666';ctx.lineWidth=1;rr(cx-72,itemY-50,144,24,6);ctx.stroke();
          ctx.fillStyle='#999';ctx.font='bold 12px monospace';ctx.textAlign='center';
          ctx.fillText('\ud83d\udd12 '+t('alreadyOwned300'),cx,itemY-33);
        }
        ctx.shadowBlur=0;
        const catLabel=ri.tab===0?t('categorySkin'):ri.tab===1?t('categoryEyes'):ri.tab===2?t('categoryEffect'):ri.tab===3?t('categoryPet'):t('categoryAccessory');
        ctx.fillStyle=ri.tab===0?'#88ccff':ri.tab===1?'#ffcc44':ri.tab===2?'#44ffaa':ri.tab===3?'#34d399':'#fb923c';ctx.font='bold 11px monospace';
        ctx.fillText(catLabel,cx,itemY+32);
        ctx.fillStyle=isSuperRareItem?'#ffd700':'#fff';ctx.font='bold 16px monospace';
        ctx.fillText(tCosName(ri.id),cx,itemY+50);
        ctx.fillStyle='#fff8';ctx.font='11px monospace';
        ctx.fillText(tCosDesc(ri.id),cx,itemY+66);
        ctx.globalAlpha=1;
      }
      // Sparkle particles
      if(isSuperRareItem){
        if(cot%2===0){const a=Math.random()*TAU,r=20+Math.random()*80;const sHue=Math.floor(Math.random()*360);
          chestOpen.parts.push({x:cx+Math.cos(a)*r,y:itemY+Math.sin(a)*r,vx:(Math.random()-0.5)*3,vy:-2-Math.random()*2,
            life:40,ml:40,sz:Math.random()*5+2,col:`hsl(${sHue},100%,75%)`,g:-0.03});}
      } else if(isRareItem){
        if(cot%2===0){const a=Math.random()*TAU,r=22+Math.random()*70;const sHue=260+Math.floor(Math.random()*80);
          chestOpen.parts.push({x:cx+Math.cos(a)*r,y:itemY+Math.sin(a)*r,vx:(Math.random()-0.5)*2.4,vy:-1.4-Math.random()*1.2,life:34,ml:34,sz:Math.random()*4+2,col:`hsl(${sHue},90%,72%)`,g:-0.01});}
      } else if(cot%5===0){const a=Math.random()*TAU,r=18+Math.random()*45;
        chestOpen.parts.push({x:cx+Math.cos(a)*r,y:itemY+Math.sin(a)*r,vx:(Math.random()-0.5)*1.2,vy:-0.8-Math.random()*0.7,life:24,ml:24,sz:Math.random()*2.5+1,col:['#7dd3fc','#e0f2fe','#ffffff'][Math.floor(Math.random()*3)],g:0});}
    } else {
      // === COIN REVEAL ===
      const revealT=Math.min(cot/60,1);
      // Golden glow bg
      const bgA=0.3*(1-revealT*0.3);
      const bgGr=ctx.createRadialGradient(cx,cy,0,cx,cy,mH*0.5);
      bgGr.addColorStop(0,`rgba(255,215,0,${bgA})`);bgGr.addColorStop(1,'rgba(255,215,0,0)');
      ctx.fillStyle=bgGr;ctx.fillRect(mX,mY,mW,mH);
      // Open chest
      ctx.save();ctx.translate(cx,cy+30);ctx.scale(0.6,0.6);
      drawChestIcon(0,0,chSz,true);
      ctx.restore();
      // Coins flying up from chest
      const coinY=cy-20-revealT*50;
      const coinScale=0.6+revealT*0.4;
      // Draw coin icon (big golden circle)
      ctx.save();ctx.translate(cx,coinY);
      const coinR=20*coinScale;
      _shadow(15+revealT*10,'#ffd700');
      ctx.fillStyle='#ffd700';
      ctx.beginPath();ctx.arc(0,0,coinR,0,TAU);ctx.fill();
      ctx.fillStyle='#ffaa00';
      ctx.beginPath();ctx.arc(0,0,coinR*0.7,0,TAU);ctx.fill();
      ctx.fillStyle='#ffd700';ctx.font='bold '+(coinR*0.9|0)+'px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('¥',0,1);
      ctx.shadowBlur=0;ctx.restore();
      ctx.textBaseline='alphabetic';
      // Amount text
      if(revealT>0.4){
        const amtA=Math.min((revealT-0.4)/0.3,1);
        ctx.globalAlpha=amtA;
        ctx.fillStyle='#ffd700';ctx.font='bold 28px monospace';ctx.textAlign='center';
        _shadow(12,'#ffd70088');
        ctx.fillText('+'+rw.amount,cx,coinY+coinR+30);
        ctx.shadowBlur=0;
        ctx.fillStyle='#fff8';ctx.font='13px monospace';
        ctx.fillText(t('coinEarned'),cx,coinY+coinR+50);
        ctx.globalAlpha=1;
      }
      // Coin sparkles
      if(cot%4===0){
        const a=Math.random()*TAU,r=25+Math.random()*40;
        chestOpen.parts.push({x:cx+Math.cos(a)*r,y:coinY+Math.sin(a)*r,vx:(Math.random()-0.5)*1.5,vy:-1-Math.random(),life:25,ml:25,sz:Math.random()*3+1,col:['#ffd700','#ffffff','#ffaa00'][Math.floor(Math.random()*3)],g:0});
      }
    }
  }
  else if(p==='done'){
    if(isChar){
      // === SUPER RARE DONE DISPLAY ===
      const charY=cy-40;
      const charR=26;
      const hue=(cot*3)%360;
      // Subtle rainbow bg
      ctx.fillStyle=`hsla(${hue},60%,50%,0.05)`;ctx.fillRect(mX,mY,mW,mH);
      // Character display with rainbow glow
      const bounce=Math.sin(cot*0.06)*3;
      ctx.save();
      _shadow(25,`hsl(${hue},90%,60%)`);
      drawCharacter(cx,charY+bounce,rw.charIdx,charR,0,1,'happy',0,false);
      ctx.shadowBlur=0;ctx.restore();
      // Rainbow "SUPER RARE" text
      const tHue=(cot*5)%360;
      ctx.fillStyle=`hsl(${tHue},100%,65%)`;ctx.font='bold 14px monospace';ctx.textAlign='center';
      ctx.fillText(rw.isNew?'★ SUPER RARE! ★':'★ RARE! ★',cx,charY-charR-12);
      // Name and trait
      ctx.fillStyle='#ffd700';ctx.font='bold 18px monospace';
      ctx.fillText(tCharName(rw.charIdx),cx,charY+charR+22);
      ctx.fillStyle='#fff8';ctx.font='12px monospace';
      ctx.fillText(tCharTrait(rw.charIdx),cx,charY+charR+40);
      if(rw.isNew){
        ctx.fillStyle='#34d399';ctx.font='bold 13px monospace';
        ctx.fillText(t('newUnlock'),cx,charY+charR+58);
      } else {
        ctx.fillStyle='#ffaa00';ctx.font='12px monospace';
        ctx.fillText(t('alreadyOwned500'),cx,charY+charR+58);
      }
      // Continuous rainbow sparkles
      if(cot%4===0){
        const a=Math.random()*TAU,r=40+Math.random()*40;
        const sHue=Math.floor(Math.random()*360);
        chestOpen.parts.push({x:cx+Math.cos(a)*r,y:charY+Math.sin(a)*r,vx:(Math.random()-0.5),vy:-0.5-Math.random()*0.5,life:30,ml:30,sz:Math.random()*3+1,col:`hsl(${sHue},90%,70%)`,g:0});
      }
      if(cot%6===0){
        chestOpen.parts.push({x:mX+Math.random()*mW,y:mY,vx:0,vy:0.3+Math.random()*0.5,life:50,ml:50,sz:Math.random()*2+1,col:['#ffd700','#ff88cc','#88ffff'][Math.floor(Math.random()*3)],g:0.01});
      }
    } else if(isCosmetic){
      // === COSMETIC DONE DISPLAY ===
      const hue=(cot*3)%360;
      const ri=rw.item;
      const isSR=ri.rarity==='super_rare';
      const isRareDone=ri.rarity==='rare';
      ctx.fillStyle=isSR?`hsla(${hue},80%,50%,0.08)`:isRareDone?`hsla(${260+Math.sin(cot*0.04)*30},70%,50%,0.07)`:`rgba(80,180,255,0.035)`;ctx.fillRect(mX,mY,mW,mH);
      const bounce=Math.sin(cot*0.06)*3;
      ctx.save();ctx.translate(cx,cy-30+bounce);
      _shadow(isSR?30:isRareDone?24:15,isSR?`hsl(${hue},100%,60%)`:isRareDone?'#a855f7':'#7dd3fc');
      drawChestPreviewCharacter(0,0,ri.tab===2?18:22,ri,1,rw.isNew);
      ctx.shadowBlur=0;ctx.restore();
      if(isSR){
        const tHue=(cot*5)%360;const pulse=1+Math.sin(cot*0.15)*0.08;
        ctx.save();ctx.translate(cx,cy-70);ctx.scale(pulse,pulse);
        ctx.fillStyle=`hsl(${tHue},100%,65%)`;ctx.font='bold 16px monospace';ctx.textAlign='center';
        _shadow(15,`hsl(${tHue},100%,50%)`);
        ctx.fillText('\u2605\u2605 SUPER RARE!! \u2605\u2605',0,0);
        ctx.shadowBlur=0;ctx.restore();
      } else if(ri.rarity==='rare'){
        const tHue=(cot*5)%360;
        ctx.fillStyle=`hsl(${tHue},100%,65%)`;ctx.font='bold 14px monospace';ctx.textAlign='center';
        ctx.fillText('\u2605 SECRET ITEM! \u2605',cx,cy-70);
      } else if(rw.isNew){
        ctx.fillStyle='#34d399';ctx.font='bold 15px monospace';ctx.textAlign='center';
        _shadow(10,'#34d399');ctx.fillText('\u2728 NEW! \u2728',cx,cy-70);ctx.shadowBlur=0;
      } else {
        ctx.fillStyle='#888';ctx.font='bold 13px monospace';ctx.textAlign='center';
        ctx.fillText('\ud83d\udd12 OWNED',cx,cy-70);
      }
      const catLabel2=ri.tab===0?t('categorySkin'):ri.tab===1?t('categoryEyes'):ri.tab===2?t('categoryEffect'):ri.tab===3?t('categoryPet'):t('categoryAccessory');
      ctx.fillStyle=ri.tab===0?'#88ccff':ri.tab===1?'#ffcc44':ri.tab===2?'#44ffaa':ri.tab===3?'#34d399':'#fb923c';ctx.font='bold 11px monospace';ctx.textAlign='center';
      ctx.fillText(catLabel2,cx,cy-4);
      ctx.fillStyle=isSR?'#ffd700':'#fff';ctx.font='bold 16px monospace';ctx.textAlign='center';
      ctx.fillText(tCosName(ri.id),cx,cy+14);
      ctx.fillStyle='#fff8';ctx.font='11px monospace';
      ctx.fillText(tCosDesc(ri.id),cx,cy+32);
      if(rw.isNew){
        ctx.fillStyle='rgba(52,211,153,0.18)';rr(cx-80,cy+42,160,26,6);ctx.fill();
        ctx.strokeStyle='#34d399';ctx.lineWidth=1;rr(cx-80,cy+42,160,26,6);ctx.stroke();
        ctx.fillStyle='#34d399';ctx.font='bold 13px monospace';
        ctx.fillText(t('newGet'),cx,cy+60);
      } else {
        ctx.fillStyle='rgba(0,0,0,0.45)';rr(cx-80,cy+42,160,26,6);ctx.fill();
        ctx.strokeStyle='#555';ctx.lineWidth=1;rr(cx-80,cy+42,160,26,6);ctx.stroke();
        ctx.fillStyle='#888';ctx.font='bold 12px monospace';
        ctx.fillText('\ud83d\udcb0 '+t('alreadyOwned300'),cx,cy+60);
      }
      const sparkRate=isSR?3:isRareDone?4:8;
      if(cot%sparkRate===0){const a=Math.random()*TAU,r=30+Math.random()*40;const sHue=isRareDone?260+Math.floor(Math.random()*70):Math.floor(Math.random()*360);
        chestOpen.parts.push({x:cx+Math.cos(a)*r,y:cy-30+Math.sin(a)*r,vx:(Math.random()-0.5)*(isSR?1.5:isRareDone?1.25:0.8),vy:-0.5-Math.random()*(isSR?1:isRareDone?0.8:0.4),life:isSR?35:isRareDone?30:22,ml:isSR?35:isRareDone?30:22,sz:Math.random()*3+(isSR?2:isRareDone?1.5:0.8),col:`hsl(${sHue},${isSR?100:isRareDone?92:80}%,70%)`,g:0});}
    } else {
      // === COIN DONE DISPLAY ===
      const coinY=cy-30;
      const coinR=22;
      // Coin display
      const bounce=Math.sin(cot*0.06)*2;
      ctx.save();ctx.translate(cx,coinY+bounce);
      _shadow(15,'#ffd700');
      ctx.fillStyle='#ffd700';ctx.beginPath();ctx.arc(0,0,coinR,0,TAU);ctx.fill();
      ctx.fillStyle='#ffaa00';ctx.beginPath();ctx.arc(0,0,coinR*0.7,0,TAU);ctx.fill();
      ctx.fillStyle='#ffd700';ctx.font='bold 18px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('¥',0,1);
      ctx.shadowBlur=0;ctx.restore();
      ctx.textBaseline='alphabetic';
      // Amount
      ctx.fillStyle='#ffd700';ctx.font='bold 26px monospace';ctx.textAlign='center';
      ctx.fillText('+'+rw.amount,cx,coinY+coinR+28);
      ctx.fillStyle='#fff8';ctx.font='13px monospace';
      ctx.fillText(t('coinEarned'),cx,coinY+coinR+48);
      // Sparkle
      if(cot%6===0){
        const a=Math.random()*TAU,r=30+Math.random()*25;
        chestOpen.parts.push({x:cx+Math.cos(a)*r,y:coinY+Math.sin(a)*r,vx:(Math.random()-0.5),vy:-0.5-Math.random()*0.5,life:25,ml:25,sz:Math.random()*2+1,col:['#ffd700','#ffffff'][Math.floor(Math.random()*2)],g:0});
      }
    }
    // "Tap to close" at bottom
    const ta=0.4+Math.sin(cot*0.1)*0.3;
    ctx.globalAlpha=ta;ctx.fillStyle='#fff6';ctx.font='13px monospace';ctx.textAlign='center';
    const hasNextChest=deadChestOpen?(deadChestsOpened<runChests&&storedChests>0):(storedChests>0);
    ctx.fillText(hasNextChest?t('tapNextChest'):t('tapToClose'),cx,mY+mH-20);
    ctx.globalAlpha=1;
  }
  else if(p==='batchDone'){
    // === SEQUENTIAL CARD REVEAL ===
    // Header (clear spacing)
    ctx.fillStyle='#ffd700';ctx.font='bold 15px monospace';ctx.textAlign='center';
    ctx.fillText(t('batchResult'),cx,mY+24);
    ctx.fillStyle='#fff6';ctx.font='10px monospace';
    ctx.fillText(chestBatchResults.length+' '+t('chestsOpenedCount'),cx,mY+40);

    // 引いた順をそのまま保持（コイン→アイテムの並び替えを廃止）
    const sorted=[...chestBatchResults];

    // Calculate reveal timing per card (slow sequential opening)
    const n=sorted.length;
    const baseDur=n>20?20:n>10?28:36;
    let cumT=30;
    const revInfo=sorted.map((rw2)=>{
      const rar=rw2&&rw2.type==='cosmetic'&&rw2.item?rw2.item.rarity:null;
      const isNewChar=rw2&&rw2.type==='char'&&rw2.isNew;
      const dur=baseDur+(rar==='super_rare'?60:rar==='rare'?35:isNewChar?25:0);
      const info={start:cumT,dur:dur};
      cumT+=dur;
      return info;
    });
    const totalRevealT=cumT;
    const allRevealed=cot>=totalRevealT;

    // Card grid layout
    const cols=4,cardW=62,cardH=76,gap=4;
    const gridW=cols*cardW+(cols-1)*gap;
    const startX=cx-gridW/2;
    const startY=mY+50;
    const visH=mH-50-(allRevealed?56:24);

    // Total coins
    let totalCoinsGot=0;
    for(let i=0;i<chestBatchResults.length;i++){const r=chestBatchResults[i];if(r&&r.type==='coin')totalCoinsGot+=r.amount;
      if(r&&r.type==='char'&&!r.isNew)totalCoinsGot+=500;
      if(r&&r.type==='cosmetic'&&!r.isNew)totalCoinsGot+=300;}

    // Auto-scroll to keep current revealing card visible
    let currentIdx=-1;
    for(let i=0;i<revInfo.length;i++){
      if(cot>=revInfo[i].start)currentIdx=i;
    }
    const curRow=currentIdx>=0?Math.floor(currentIdx/cols):0;
    const totalRows=Math.ceil(n/cols);
    const contentH=totalRows*(cardH+gap);
    const targetScr=Math.max(0,curRow*(cardH+gap)-visH+cardH+16);
    const maxScr=Math.max(0,contentH-visH);
    const scrollY=Math.min(targetScr,maxScr);

    // Trigger reveal effects for newly revealed cards
    if(chestOpen._lastRevealIdx===undefined)chestOpen._lastRevealIdx=-1;
    for(let i=chestOpen._lastRevealIdx+1;i<=currentIdx&&i<n;i++){
      const ri=revInfo[i];
      if(cot>=ri.start+Math.min(ri.dur*0.4,10)){
        chestOpen._lastRevealIdx=i;
        const rw2=sorted[i];
        const rar=rw2&&rw2.type==='cosmetic'&&rw2.item?rw2.item.rarity:null;
        if(rar==='super_rare'){
          shakeI=20;vibrate('chest_super');
          if(typeof sfxSuperRare==='function')sfxSuperRare();
          for(let pp=0;pp<16;pp++){
            const a2=Math.random()*TAU;
            chestOpen.parts.push({x:cx+Math.cos(a2)*30,y:mY+mH*0.4+Math.sin(a2)*30,
              vx:Math.cos(a2)*4,vy:Math.sin(a2)*4-1,life:35,ml:35,
              sz:Math.random()*5+2,col:['#ffd700','#fff','#ffaa00'][pp%3],g:0.06});
          }
        } else if(rar==='rare'){
          shakeI=14;vibrate('chest');
          if(typeof sfxRare==='function')sfxRare();else sfx('bossHit');
          for(let pp=0;pp<12;pp++){
            const a2=Math.random()*TAU;
            chestOpen.parts.push({x:cx+Math.cos(a2)*25,y:mY+mH*0.4+Math.sin(a2)*25,
              vx:Math.cos(a2)*3.4,vy:Math.sin(a2)*3.4-1,life:32,ml:32,
              sz:Math.random()*4+1.8,col:['#a855f7','#d4a8ff','#7dd3fc','#fff'][pp%4],g:0.04});
          }
        } else if(rw2&&rw2.type==='char'&&rw2.isNew){
          shakeI=6;vibrate('stomp_heavy');sfx('gstompHeavy');
          for(let pp=0;pp<6;pp++){
            const a2=Math.random()*TAU;
            chestOpen.parts.push({x:cx+Math.cos(a2)*20,y:mY+mH*0.4+Math.sin(a2)*20,
              vx:Math.cos(a2)*2,vy:Math.sin(a2)*2-1,life:22,ml:22,
              sz:Math.random()*3+1,col:['#ff88cc','#ffaadd','#fff'][pp%3],g:0.04});
          }
        } else if(rw2&&(rw2.type==='cosmetic'||rw2.type==='coin')){
          shakeI=Math.max(shakeI,4);
          vibrate('jump');
          if(rw2.type==='cosmetic'&&typeof sfxChestNormal==='function')sfxChestNormal();
          for(let pp=0;pp<5;pp++){
            const a2=Math.random()*TAU;
            chestOpen.parts.push({x:cx+Math.cos(a2)*18,y:mY+mH*0.4+Math.sin(a2)*18,
              vx:Math.cos(a2)*1.8,vy:Math.sin(a2)*1.8-0.8,life:20,ml:20,
              sz:Math.random()*2.4+1,col:['#7dd3fc','#ffffff','#ffd700'][pp%3],g:0.03});
          }
        }
      }
    }

    // Draw card grid (clipped)
    ctx.save();
    ctx.beginPath();ctx.rect(mX+1,startY,mW-2,visH);ctx.clip();

    for(let i=0;i<sorted.length;i++){const rw2=sorted[i];
      if(!rw2)continue;
      const ri=revInfo[i];
      const cardT=cot-ri.start;
      if(cardT<0)continue; // not yet
      const progress=Math.min(cardT/ri.dur,1);
      const col2=i%cols,row2=Math.floor(i/cols);
      const cardX=startX+col2*(cardW+gap);
      const cardY2=startY+row2*(cardH+gap)-scrollY;
      if(cardY2+cardH<startY-10||cardY2>startY+visH+10)continue;

      const rar=rw2.type==='cosmetic'&&rw2.item?rw2.item.rarity:null;
      const isNewChar=rw2.type==='char'&&rw2.isNew;

      // Scale pop-in animation
      const scale=progress<0.25?progress/0.25:1+(1-Math.min((progress-0.25)/0.15,1))*0.08;
      ctx.save();
      ctx.translate(cardX+cardW/2,cardY2+cardH/2);
      ctx.scale(Math.min(scale,1.08),Math.min(scale,1.08));
      ctx.translate(-(cardX+cardW/2),-(cardY2+cardH/2));

      // Card bg & border based on rarity — special designs for rare/super_rare
      let borderCol='#445',bgCol='#ffffff08',glowCol=null,lw2=1;
      if(rar==='super_rare'){
        borderCol='#ffd700';lw2=2.5;
        // Gold gradient background
        const srGr=ctx.createLinearGradient(cardX,cardY2,cardX,cardY2+cardH);
        srGr.addColorStop(0,'#4a3800');srGr.addColorStop(0.3,'#2a1f00');
        srGr.addColorStop(0.7,'#3d2e00');srGr.addColorStop(1,'#4a3800');
        ctx.fillStyle=srGr;rr(cardX,cardY2,cardW,cardH,6);ctx.fill();
        // Inner gold frame
        ctx.strokeStyle='#ffd70088';ctx.lineWidth=1;
        rr(cardX+3,cardY2+3,cardW-6,cardH-6,4);ctx.stroke();
        // Shimmer effect
        const shimX=cardX+((cot*2+i*40)%((cardW+20)*2))-10;
        ctx.save();ctx.beginPath();rr(cardX,cardY2,cardW,cardH,6);ctx.clip();
        const shimGr=ctx.createLinearGradient(shimX-15,cardY2,shimX+15,cardY2);
        shimGr.addColorStop(0,'transparent');shimGr.addColorStop(0.5,'rgba(255,215,0,0.15)');shimGr.addColorStop(1,'transparent');
        ctx.fillStyle=shimGr;ctx.fillRect(cardX,cardY2,cardW,cardH);ctx.restore();
        glowCol='#ffd70060';
      } else if(rar==='rare'){
        borderCol='#a855f7';lw2=2;
        // Purple gradient background
        const rGr=ctx.createLinearGradient(cardX,cardY2,cardX,cardY2+cardH);
        rGr.addColorStop(0,'#2a1048');rGr.addColorStop(0.5,'#1a0830');rGr.addColorStop(1,'#2a1048');
        ctx.fillStyle=rGr;rr(cardX,cardY2,cardW,cardH,6);ctx.fill();
        // Inner purple frame
        ctx.strokeStyle='#a855f744';ctx.lineWidth=1;
        rr(cardX+3,cardY2+3,cardW-6,cardH-6,4);ctx.stroke();
        glowCol='#a855f740';
      } else if(rw2.type==='char'){
        borderCol=isNewChar?'#ff88cc':'#ff88cc88';bgCol='#ff88cc15';
      } else if(rw2.type==='coin'){
        borderCol=rw2.amount>=1000?'#ffd700':'#ffd70066';bgCol='#ffd70010';
      }

      // Flash effect during reveal for rare/super_rare
      if(progress<0.6&&(rar==='super_rare'||rar==='rare')){
        const flashA=(1-progress/0.6)*0.7;
        const fc=rar==='super_rare'?'rgba(255,215,0,'+flashA+')':'rgba(168,85,247,'+flashA+')';
        ctx.fillStyle=fc;rr(cardX-8,cardY2-8,cardW+16,cardH+16,10);ctx.fill();
      }

      // Glow for special items
      if(glowCol&&progress>0.3){
        const glow=ctx.createRadialGradient(cardX+cardW/2,cardY2+cardH/2,5,cardX+cardW/2,cardY2+cardH/2,cardW*0.9);
        glow.addColorStop(0,glowCol);glow.addColorStop(1,'transparent');
        ctx.fillStyle=glow;ctx.fillRect(cardX-12,cardY2-12,cardW+24,cardH+24);
      }

      // Normal cards: simple bg fill
      if(rar!=='super_rare'&&rar!=='rare'){
        ctx.fillStyle=bgCol;rr(cardX,cardY2,cardW,cardH,6);ctx.fill();
      }
      ctx.strokeStyle=borderCol;ctx.lineWidth=lw2;rr(cardX,cardY2,cardW,cardH,6);ctx.stroke();

      // Card content (fade in after pop)
      const contentA=Math.max(0,Math.min((progress-0.2)/0.3,1));
      if(contentA>0){
        ctx.globalAlpha=contentA;
        const ccx2=cardX+cardW/2;
        ctx.textAlign='center';

        if(rw2.type==='coin'){
          ctx.fillStyle='#ffd700';ctx.font='bold 16px monospace';
          ctx.fillText('\u25CF',ccx2,cardY2+22);
          ctx.fillStyle='#ffd700';ctx.font='bold 11px monospace';
          ctx.fillText('+'+rw2.amount,ccx2,cardY2+40);
          ctx.fillStyle='#fff4';ctx.font='8px monospace';
          ctx.fillText(t('coins'),ccx2,cardY2+52);
        } else if(rw2.type==='char'){
          drawCharacter(ccx2,cardY2+24,rw2.charIdx,10,0,1,'happy',0,false);
          const cname=CHARS[rw2.charIdx]?tCharName(rw2.charIdx):'???';
          const sname=cname.length>4?cname.substring(0,4)+'..':cname;
          ctx.fillStyle='#fff';ctx.font='8px monospace';
          ctx.fillText(sname,ccx2,cardY2+46);
          ctx.fillStyle=isNewChar?'#34d399':'#ffaa00';ctx.font='bold 9px monospace';
          ctx.fillText(isNewChar?'NEW!':'+500',ccx2,cardY2+60);
        } else if(rw2.type==='cosmetic'&&rw2.item){
          const tab2=rw2.item.tab;
          // Rarity badge at top
          if(rar==='super_rare'){
            ctx.fillStyle='#ffd700';ctx.font='bold 9px monospace';
            ctx.fillText('\u2605\u2605 S.RARE',ccx2,cardY2+12);
          } else if(rar==='rare'){
            ctx.fillStyle='#a855f7';ctx.font='bold 9px monospace';
            ctx.fillText('\u2605 RARE',ccx2,cardY2+12);
          }
          // Actual cosmetic preview
          const pvY=cardY2+(rar?26:20);
          drawChestPreviewCharacter(ccx2,pvY,tab2===2?8:10,rw2.item,1,rw2.isNew);
          // Category label
          const catL=tab2===0?'SKIN':tab2===1?'EYE':tab2===2?'FX':tab2===3?'PET':'ACC';
          const catC=tab2===0?'#88ccff':tab2===1?'#ffcc44':tab2===2?'#44ffaa':tab2===3?'#34d399':'#fb923c';
          ctx.fillStyle=catC;ctx.font='bold 7px monospace';ctx.textAlign='center';
          ctx.fillText(catL,ccx2,cardY2+(rar?44:38));
          // Item name
          const iname=tCosName(rw2.item.id)||'???';
          const siname=iname.length>5?iname.substring(0,5)+'..':iname;
          ctx.fillStyle='#fff';ctx.font='8px monospace';ctx.textAlign='center';
          ctx.fillText(siname,ccx2,cardY2+(rar?54:48));
          ctx.fillStyle=rw2.isNew?'#34d399':'#777';ctx.font='bold 9px monospace';
          ctx.fillText(rw2.isNew?(rar==='super_rare'?'S.RARE!':'NEW!'):'+300',ccx2,cardY2+(rar?66:60));
        }
        ctx.globalAlpha=1;
      }
      ctx.restore();
    }
    ctx.restore(); // end clip

    // Footer: total coins + close (after all revealed)
    if(allRevealed){
      if(totalCoinsGot>0){
        ctx.fillStyle='#ffd700';ctx.font='bold 13px monospace';ctx.textAlign='center';
        ctx.fillText(t('totalCoins')+' +'+totalCoinsGot+' '+t('coins'),cx,mY+mH-38);
      }
      const ta2=0.4+Math.sin(cot*0.1)*0.3;
      ctx.globalAlpha=ta2;ctx.fillStyle='#fff6';ctx.font='12px monospace';ctx.textAlign='center';
      ctx.fillText(t('tapToClose'),cx,mY+mH-16);
      ctx.globalAlpha=1;
    } else {
      // Show progress during reveal
      const revealedCount=currentIdx+1;
      ctx.fillStyle='#fff4';ctx.font='10px monospace';ctx.textAlign='center';
      ctx.fillText(revealedCount+'/'+n+' '+t('openingProgress'),cx,mY+mH-16);
    }
    // Sparkles
    if(cot%5===0){
      const a=Math.random()*TAU,r2=40+Math.random()*40;
      chestOpen.parts.push({x:cx+Math.cos(a)*r2,y:mY+mH*0.4+Math.sin(a)*r2,vx:(Math.random()-0.5),vy:-0.3-Math.random()*0.5,life:25,ml:25,sz:Math.random()*2+1,col:['#ffd700','#ffffff','#ffaa00'][Math.floor(Math.random()*3)],g:0});
    }
  }
  ctx.restore();
}

function drawDead(){
  const oa=Math.min(deadT/40,0.7);
  ctx.fillStyle=`rgba(0,0,0,${oa})`;ctx.fillRect(-20,-20,W+40,H+40);
  if(deadT<15)return;
  const si=Math.min((deadT-15)/20,1),e=1-Math.pow(1-si,3);
  ctx.save();ctx.translate(0,-50*(1-e));ctx.globalAlpha=e;

  // Challenge mode: show challenge result instead of normal game over
  if(isChallengeMode){
    drawChallengeResult(e);ctx.restore();ctx.globalAlpha=1;return;
  }

  // "GAME OVER" title with glow
  ctx.fillStyle=tc('obs');ctx.font='bold 36px monospace';ctx.textAlign='center';
  _shadow(25,tca('obs',0x66));
  ctx.fillText(t('gameOver'),W/2,H*0.16);ctx.shadowBlur=0;

  // Rating comment with color (based on score, 5000 = legendary)
  // ステージモードではレーティング非表示（スコア概念なし）
  if(!isPackMode){
    let rating='',ratingCol='#fff6';
    if(score>=5000){rating=t('ratingLegend');ratingCol='#ffd700';}
    else if(score>=3000){rating=t('ratingGodlike');ratingCol='#ff44ff';}
    else if(score>=2000){rating=t('ratingSuperhuman');ratingCol='#00e5ff';}
    else if(score>=1000){rating=t('ratingMaster');ratingCol='#34d399';}
    else if(score>=500){rating=t('ratingExcellent');ratingCol='#ff6b35';}
    else if(score>=200){rating=t('ratingGood');ratingCol='#a0d0ff';}
    else if(score>=100){rating=t('ratingNice');ratingCol='#fff8';}
    else if(score>=50){rating=t('ratingOkay');ratingCol='#fff5';}
    else if(score>=10){rating=t('ratingTryHard');ratingCol='#fff4';}
    if(rating){
      const rp=Math.sin(deadT*0.08)*0.15+0.85;
      ctx.globalAlpha=rp*e;ctx.fillStyle=ratingCol;ctx.font='bold 15px monospace';
      _shadow(10,ratingCol+'66');
      ctx.fillText(rating,W/2,H*0.21);ctx.shadowBlur=0;ctx.globalAlpha=e;
    }
  }

  // Card metrics (shared with button layout below)
  let cardY,cardH;
  // ステージモード: シンプルなスター表示のみ中央揃え
  if(isPackMode){
    const cardW=Math.min(260,W-40),cardX=W/2-cardW/2;
    cardY=H*0.32;cardH=150;
    // Card background
    ctx.fillStyle='rgba(10,10,30,0.92)';rr(cardX,cardY,cardW,cardH,14);ctx.fill();
    ctx.strokeStyle='#ffd70044';ctx.lineWidth=1.5;rr(cardX,cardY,cardW,cardH,14);ctx.stroke();
    // Character: キューブ(0)固定、コスメなしで純粋に
    drawPetShowcase('gameover',W/2,cardY+32,15,1,e);
    drawCharacter(W/2,cardY+32,0,15,0,1,'dead',1,false);
    // ラベル
    ctx.fillStyle='#ffd70099';ctx.font='11px monospace';ctx.textAlign='center';
    ctx.fillText(gameLang==='ja'?'獲得スター':'STARS',W/2,cardY+72);
    // ☆★★ 3つのスターを視覚的に表示
    const scY=cardY+118,sStep=46,scX=W/2-sStep;
    ctx.font='bold 40px monospace';ctx.textAlign='center';
    for(let i=0;i<3;i++){
      const got=i<(stageBigCollected||0);
      if(got){
        ctx.fillStyle='#ffd700';_shadow(14,'#ffd70088');
        ctx.fillText('\u2605',scX+i*sStep,scY);
      } else {
        ctx.fillStyle='#ffffff33';ctx.shadowBlur=0;
        ctx.fillText('\u2606',scX+i*sStep,scY);
      }
    }
    ctx.shadowBlur=0;
  } else {
    // Endless mode (original layout)
    const cardW=Math.min(270,W-30),cardX=W/2-cardW/2;
    cardY=H*0.24;cardH=210+(runChests>0?56:0);
    const cardGr=ctx.createLinearGradient(cardX,cardY,cardX,cardY+cardH);
    cardGr.addColorStop(0,'rgba(10,10,30,0.92)');cardGr.addColorStop(1,'rgba(5,5,20,0.92)');
    ctx.fillStyle=cardGr;rr(cardX,cardY,cardW,cardH,14);ctx.fill();
    ctx.strokeStyle='#ffffff12';ctx.lineWidth=1;rr(cardX,cardY,cardW,cardH,14);ctx.stroke();
    // Accent top border
    const accentCol=score>=5000?'#ffd700':score>=1000?'#00e5ff':tc('obs');
    ctx.strokeStyle=accentCol+'66';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(cardX+14,cardY);ctx.lineTo(cardX+cardW-14,cardY);ctx.stroke();

    // New record badge
    if(newHi){const np=Math.sin(deadT*0.12)*0.3+0.7;ctx.globalAlpha=np*e;ctx.fillStyle='#ffd700';ctx.font='bold 14px monospace';_shadow(12,'#ffd70066');ctx.fillText(t('newRecord'),W/2,cardY+18);ctx.shadowBlur=0;ctx.globalAlpha=e;}

    // Character (show fully damaged)
    drawPetShowcase('gameover',W/2,cardY+(newHi?46:38),16,1,e);
    drawCharacter(W/2,cardY+(newHi?46:38),selChar,16,0,1,'dead',maxHp());

    const scoreY=cardY+(newHi?68:60);
    ctx.fillStyle='#fff6';ctx.font='10px monospace';ctx.fillText(t('score'),W/2,scoreY);
    ctx.fillStyle='#fff';ctx.font='bold 38px monospace';
    _shadow(8,'#fff2');ctx.fillText(score,W/2,scoreY+38);ctx.shadowBlur=0;
    ctx.fillStyle='#fff4';ctx.font='11px monospace';
    ctx.fillText(t('best')+': '+highScore,W/2,scoreY+56);
    if(maxCombo>1){
      ctx.fillStyle='#ff6b3599';ctx.font='10px monospace';
      ctx.fillText(t('maxCombo')+': '+maxCombo+'x',W/2,scoreY+72);
    }

    const divY=scoreY+(maxCombo>1?82:70);
    ctx.strokeStyle='#ffffff0a';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(cardX+20,divY);ctx.lineTo(cardX+cardW-20,divY);ctx.stroke();

    const coinY=divY+18;
    ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';
    ctx.fillText(t('earned')+' \u25CF'+totalCoins,W/2-40,coinY);
    ctx.fillStyle='#fff5';ctx.font='11px monospace';
    ctx.fillText(t('held')+': '+walletCoins,W/2+50,coinY);

    if(runChests>0){
      const chestY=coinY+20;
      ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';ctx.textAlign='center';
      ctx.fillText(t('chests')+' \u00D7'+runChests,W/2,chestY);
      const ocW=140,ocH=28,ocX=W/2-ocW/2,ocY=chestY+6;
      ctx.fillStyle='#ffd70018';rr(ocX,ocY,ocW,ocH,6);ctx.fill();
      ctx.strokeStyle='#ffd700';ctx.lineWidth=1;rr(ocX,ocY,ocW,ocH,6);ctx.stroke();
      ctx.fillStyle='#ffd700';ctx.font='bold 11px monospace';
      ctx.fillText(t('openChests'),W/2,ocY+19);
    }
  }

  // --- Action buttons (below card) ---
  if(deadT>45){
    const btnW2=Math.min(220,W-40),btnH2=38,btnX2=W/2-btnW2/2;
    let btnTop=cardY+cardH+12;

    // Continue button - only in endless mode
    if(!isPackMode){
      const isFree=freeRevivesUsed<5;
      const canContinue=(isFree||walletCoins>=100)&&!usedContinue;
      if(usedContinue){
        ctx.fillStyle='#ffffff06';rr(btnX2,btnTop,btnW2,btnH2,8);ctx.fill();
        ctx.strokeStyle='#ffffff22';ctx.lineWidth=1;rr(btnX2,btnTop,btnW2,btnH2,8);ctx.stroke();
        ctx.fillStyle='#fff3';ctx.font='bold 13px monospace';
        ctx.fillText(t('continuePlay'),W/2,btnTop+24);
        ctx.fillStyle='#ff444488';ctx.font='9px monospace';
        ctx.fillText(t('usedUp'),W/2,btnTop+36);
      } else if(canContinue){
        const pulse=Math.sin(deadT*0.08)*0.08+0.92;
        ctx.globalAlpha=pulse*e;
        ctx.fillStyle=isFree?'#34d39918':'#00e5ff18';rr(btnX2,btnTop,btnW2,btnH2,8);ctx.fill();
        ctx.strokeStyle=isFree?'#34d399':'#00e5ff';ctx.lineWidth=1.5;rr(btnX2,btnTop,btnW2,btnH2,8);ctx.stroke();
        ctx.fillStyle=isFree?'#34d399':'#00e5ff';ctx.font='bold 13px monospace';
        if(isFree){
          ctx.fillText(t('continuePlay'),W/2,btnTop+20);
          ctx.font='10px monospace';ctx.fillStyle='#34d399cc';
          ctx.fillText(t('freeRevive')+' '+t('remaining')+(5-freeRevivesUsed)+t('times'),W/2,btnTop+34);
        } else {
          ctx.fillText(t('continuePlay')+'  \u25CF100',W/2,btnTop+24);
        }
        ctx.globalAlpha=e;
      } else {
        ctx.fillStyle='#ffffff06';rr(btnX2,btnTop,btnW2,btnH2,8);ctx.fill();
        ctx.strokeStyle='#ffffff22';ctx.lineWidth=1;rr(btnX2,btnTop,btnW2,btnH2,8);ctx.stroke();
        ctx.fillStyle='#fff3';ctx.font='bold 13px monospace';
        ctx.fillText(t('continuePlay')+'  \u25CF100',W/2,btnTop+24);
        ctx.fillStyle='#ff444488';ctx.font='9px monospace';
        ctx.fillText(t('coinShort'),W/2,btnTop+36);
      }
      btnTop+=btnH2+8;
    }

    // Restart button
    ctx.fillStyle='#ff860018';rr(btnX2,btnTop,btnW2,btnH2,8);ctx.fill();
    ctx.strokeStyle='#ff8600';ctx.lineWidth=1.5;rr(btnX2,btnTop,btnW2,btnH2,8);ctx.stroke();
    ctx.fillStyle='#ff8600';ctx.font='bold 13px monospace';
    ctx.fillText(isPackMode?t('retryAgain'):t('restartFromBegin'),W/2,btnTop+24);
    btnTop+=btnH2+8;

    // Title button
    ctx.fillStyle='#ff386018';rr(btnX2,btnTop,btnW2,btnH2,8);ctx.fill();
    ctx.strokeStyle='#ff3860';ctx.lineWidth=1.5;rr(btnX2,btnTop,btnW2,btnH2,8);ctx.stroke();
    ctx.fillStyle='#ff3860';ctx.font='bold 13px monospace';
    ctx.fillText(isPackMode?t('toStageSelect'):t('toTitleBtn'),W/2,btnTop+24);
  }

  ctx.restore();ctx.globalAlpha=1;
}

// ===== CHALLENGE RESULT SCREEN =====
function drawChallengeResult(e){
  // Title
  const titleText=challengeRetired?t('retireTitle'):t('gameOver');
  ctx.fillStyle=challengeRetired?'#ffd700':'#ff3860';ctx.font='bold 34px monospace';ctx.textAlign='center';
  _shadow(20,(challengeRetired?'#ffd700':'#ff3860')+'66');
  ctx.fillText(titleText,W/2,H*0.15);ctx.shadowBlur=0;
  // Rating based on kills
  let cRating='',cRatingCol='#fff6';
  if(challengeKills>=20){cRating=t('ratingLegend');cRatingCol='#ffd700';}
  else if(challengeKills>=15){cRating=t('ratingGodlike');cRatingCol='#ff44ff';}
  else if(challengeKills>=10){cRating=t('ratingMaster');cRatingCol='#00e5ff';}
  else if(challengeKills>=6){cRating=t('ratingExcellent');cRatingCol='#34d399';}
  else if(challengeKills>=3){cRating=t('ratingGood');cRatingCol='#a0d0ff';}
  if(cRating){
    const rp=Math.sin(deadT*0.08)*0.15+0.85;
    ctx.globalAlpha=rp*e;ctx.fillStyle=cRatingCol;ctx.font='bold 15px monospace';
    _shadow(10,cRatingCol+'66');
    ctx.fillText(cRating,W/2,H*0.20);ctx.shadowBlur=0;ctx.globalAlpha=e;
  }
  // Result card
  const cardW=Math.min(260,W-30),cardX=W/2-cardW/2;
  const cardY=H*0.25,cardH=180;
  const cardGr=ctx.createLinearGradient(cardX,cardY,cardX,cardY+cardH);
  cardGr.addColorStop(0,'rgba(10,10,30,0.92)');cardGr.addColorStop(1,'rgba(5,5,20,0.92)');
  ctx.fillStyle=cardGr;rr(cardX,cardY,cardW,cardH,14);ctx.fill();
  ctx.strokeStyle='#ffd70033';ctx.lineWidth=1;rr(cardX,cardY,cardW,cardH,14);ctx.stroke();
  // Character
  drawPetShowcase('gameover',W/2,cardY+35,18,1,e);
  drawCharacter(W/2,cardY+35,selChar,18,0,1,challengeRetired?'normal':'dead');
  // Kill count (big)
  ctx.fillStyle='#fff6';ctx.font='11px monospace';ctx.textAlign='center';
  ctx.fillText(t('killCountLabel'),W/2,cardY+68);
  ctx.fillStyle='#ffd700';ctx.font='bold 42px monospace';
  _shadow(12,'#ffd70044');
  ctx.fillText(challengeKills,W/2,cardY+110);ctx.shadowBlur=0;
  // Best kills
  ctx.fillStyle='#fff4';ctx.font='11px monospace';
  ctx.fillText(t('bestLabel')+': '+challengeBestKills,W/2,cardY+130);
  // Phase reached
  ctx.fillStyle='#00e5ff';ctx.font='bold 12px monospace';
  ctx.fillText(t('phaseLabel')+' '+(challengePhase+1),W/2,cardY+150);
  // HP display
  ctx.fillStyle='#fff4';ctx.font='11px monospace';
  ctx.fillText('HP: '+hp+' / '+maxHp(),W/2,cardY+168);
  // Buttons
  if(deadT>45){
    const btnW2=Math.min(220,W-40),btnH2=38,btnX2=W/2-btnW2/2;
    let btnTop=cardY+cardH+14;
    // Retry button
    ctx.fillStyle='#ff860018';rr(btnX2,btnTop,btnW2,btnH2,8);ctx.fill();
    ctx.strokeStyle='#ff8600';ctx.lineWidth=1.5;rr(btnX2,btnTop,btnW2,btnH2,8);ctx.stroke();
    ctx.fillStyle='#ff8600';ctx.font='bold 13px monospace';
    ctx.fillText(t('retryAgain'),W/2,btnTop+24);
    btnTop+=btnH2+8;
    // Title button
    ctx.fillStyle='#ff386018';rr(btnX2,btnTop,btnW2,btnH2,8);ctx.fill();
    ctx.strokeStyle='#ff3860';ctx.lineWidth=1.5;rr(btnX2,btnTop,btnW2,btnH2,8);ctx.stroke();
    ctx.fillStyle='#ff3860';ctx.font='bold 13px monospace';
    ctx.fillText(t('toTitleBtn'),W/2,btnTop+24);
  }
}

// ===== CHALLENGE BLACKOUT TRANSITION DRAWING =====
function drawChallTransition(){
  const ct_=challTransition;
  const t=ct_.timer;
  ctx.save();ctx.setTransform(_appDpr,0,0,_appDpr,0,0);

  // Fade: 0-25 fade in, 25-85 solid black, 85-120 fade out
  let blackA;
  if(t<25) blackA=t/25;
  else if(t<85) blackA=1;
  else blackA=Math.max(0,1-(t-85)/35);
  ctx.fillStyle=`rgba(0,0,0,${blackA})`;ctx.fillRect(0,0,W,H);

  // Wave number display: 30-80
  if(t>=30&&t<80){
    const fadeIn=Math.min(1,(t-30)/10);
    const fadeOut=t>70?Math.max(0,1-(t-70)/10):1;
    ctx.globalAlpha=fadeIn*fadeOut;
    ctx.fillStyle='#ffd700';ctx.font='bold 32px monospace';ctx.textAlign='center';
    _shadow(20,'#ffd70088');
    ctx.fillText('WAVE '+ct_.waveNum,W/2,H*0.42);
    // Dual indicator
    if(challQueueIdx>0&&challBossQueue[challQueueIdx-1]&&challBossQueue[challQueueIdx-1].isDual){
      ctx.font='bold 16px monospace';ctx.fillStyle='#ff6060';
      ctx.fillText('DUAL BOSS',W/2,H*0.42+30);
    }
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  }

  ctx.restore();
}

// ===== STAGE SELECTION SCREEN =====
function drawBigCoinIcon(cx,cy,r){
  ctx.fillStyle='#ffd700';ctx.beginPath();
  for(let i=0;i<5;i++){
    const a=-Math.PI/2+i*Math.PI*2/5,a2=a+Math.PI/5;
    ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);
    ctx.lineTo(cx+Math.cos(a2)*r*0.45,cy+Math.sin(a2)*r*0.45);
  }
  ctx.closePath();ctx.fill();
}
function drawStageSel(){
  // Background
  const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#08081e');bg.addColorStop(1,'#14143a');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  // Header
  ctx.fillStyle='#fff';ctx.font='bold 20px monospace';ctx.textAlign='center';
  ctx.fillText(t('stageSelection'),W/2,40+safeTop);
  // Back button
  ctx.fillStyle='#ffffff22';rr(10,22+safeTop,50,30,8);ctx.fill();
  ctx.fillStyle='#fff8';ctx.font='bold 14px monospace';ctx.textAlign='center';
  ctx.fillText(t('back'),35,42+safeTop);
  // Reset button
  ctx.fillStyle='#ff386022';rr(W-60,22+safeTop,50,30,8);ctx.fill();
  ctx.strokeStyle='#ff386066';ctx.lineWidth=1;rr(W-60,22+safeTop,50,30,8);ctx.stroke();
  ctx.fillStyle='#ff3860';ctx.font='bold 10px monospace';ctx.textAlign='center';
  ctx.fillText(t('reset'),W-35,42+safeTop);
  // Star total display
  ctx.fillStyle='#ffd700';ctx.font='bold 14px monospace';ctx.textAlign='right';
  ctx.fillText('\u2605'+totalStars,W-68,42+safeTop);
  // Scrollable pack list
  ctx.save();
  ctx.beginPath();ctx.rect(0,60+safeTop,W,H-70-safeTop-safeBot);ctx.clip();
  const startY=70+safeTop+stageSelScroll;
  const cardH=130,cardGap=14,cardW=W-30;
  for(let pi=0;pi<STAGE_PACKS.length;pi++){
    const pack=STAGE_PACKS[pi];
    const cy=startY+pi*(cardH+cardGap);
    if(cy+cardH<60+safeTop||cy>H)continue; // off-screen cull
    const st=STAGE_THEMES[pack.theme];
    const cleared=pack.stages.filter(s=>packProgress[s.id]&&packProgress[s.id].cleared).length;
    // Card background
    const cg=ctx.createLinearGradient(15,cy,15+cardW,cy+cardH);
    cg.addColorStop(0,st.bg1+'cc');cg.addColorStop(1,st.bg2+'cc');
    ctx.fillStyle=cg;rr(15,cy,cardW,cardH,12);ctx.fill();
    ctx.strokeStyle=st.line+'88';ctx.lineWidth=1.5;rr(15,cy,cardW,cardH,12);ctx.stroke();
    // Pack name and progress
    ctx.fillStyle=st.ply;ctx.font='bold 16px monospace';ctx.textAlign='left';
    ctx.fillText(tPackName(pi),28,cy+24);
    ctx.fillStyle='#fff6';ctx.font='11px monospace';
    ctx.fillText(cleared+'/5 '+t('cleared'),28,cy+40);
    // Stage buttons (5 in a row)
    const sbW=44,sbH=44,sbGap=8;
    const sbX=15+(cardW-(5*sbW+4*sbGap))/2;
    const sbY=cy+52;
    for(let si=0;si<5;si++){
      const stage=pack.stages[si];
      const sx=sbX+si*(sbW+sbGap);
      const prog=packProgress[stage.id];
      const isClear=prog&&prog.cleared;
      const stageStars=prog?prog.stars:0;
      const canPlay=true; // all stages unlocked
      if(isClear){
        const is3Star=stageStars>=3;
        // Cleared: gold (3-star: cyan glow for perfect clear)
        ctx.fillStyle=is3Star?'#00e5ff33':'#ffd70033';rr(sx,sbY,sbW,sbH,10);ctx.fill();
        ctx.strokeStyle=is3Star?'#00e5ff':'#ffd700';ctx.lineWidth=is3Star?2:1.5;rr(sx,sbY,sbW,sbH,10);ctx.stroke();
        if(is3Star){ctx.strokeStyle='#ffd70066';ctx.lineWidth=1;rr(sx+2,sbY+2,sbW-4,sbH-4,8);ctx.stroke();}
        ctx.fillStyle=is3Star?'#00e5ff':'#ffd700';ctx.font='bold 12px monospace';ctx.textAlign='center';
        ctx.fillText(stage.name,sx+sbW/2,sbY+16);
        // Show stars earned
        ctx.font='10px monospace';
        for(let si2=0;si2<3;si2++){
          ctx.fillStyle=si2<stageStars?'#ffd700':'#ffffff33';
          ctx.fillText('★',sx+sbW/2-10+si2*10,sbY+36);
        }
      } else if(canPlay){
        // Next playable: white border, pulse
        const pulse=0.5+Math.sin(frame*0.08)*0.3;
        ctx.fillStyle=st.ply+'22';rr(sx,sbY,sbW,sbH,10);ctx.fill();
        ctx.strokeStyle=st.ply;ctx.lineWidth=1.5+pulse;rr(sx,sbY,sbW,sbH,10);ctx.stroke();
        ctx.fillStyle='#fff';ctx.font='bold 12px monospace';ctx.textAlign='center';
        ctx.fillText(stage.name,sx+sbW/2,sbY+18);
        ctx.fillStyle='#fff6';ctx.font='10px monospace';
        ctx.fillText(stage.dist+'m',sx+sbW/2,sbY+36);
      } else {
        // Locked stage: gray
        ctx.fillStyle='#ffffff08';rr(sx,sbY,sbW,sbH,10);ctx.fill();
        ctx.strokeStyle='#ffffff22';ctx.lineWidth=1;rr(sx,sbY,sbW,sbH,10);ctx.stroke();
        ctx.fillStyle='#fff3';ctx.font='bold 12px monospace';ctx.textAlign='center';
        ctx.fillText(stage.name,sx+sbW/2,sbY+18);
        ctx.fillStyle='#fff2';ctx.font='10px monospace';
        ctx.fillText('🔒',sx+sbW/2,sbY+36);
      }
      // Checkpoint pin indicator (on any playable/cleared stage with checkpoint saved)
      if(stageCheckpoints[stage.id]){
        ctx.save();
        const pinX=sx+sbW-4,pinY=sbY-2;
        // Pin pole
        ctx.strokeStyle='#34d399';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(pinX,pinY);ctx.lineTo(pinX,pinY+12);ctx.stroke();
        // Pin flag (small triangle)
        ctx.fillStyle='#34d399';
        ctx.beginPath();ctx.moveTo(pinX,pinY);ctx.lineTo(pinX+8,pinY+3);ctx.lineTo(pinX,pinY+6);ctx.closePath();ctx.fill();
        ctx.restore();
      }
    }
    // Star total indicator at bottom of card
    const bcY=sbY+sbH+8;
    const packStars=pack.stages.reduce((sum,s)=>{const p=packProgress[s.id];return sum+(p?p.stars:0);},0);
    ctx.fillStyle='#ffd700';ctx.font='9px monospace';ctx.textAlign='left';
    ctx.fillText('★ '+packStars+' / 15  ('+cleared+'/5 '+t('cleared')+')',28,bcY+4);
  }
  ctx.restore();
  // Scroll indicator
  const totalH=STAGE_PACKS.length*(cardH+cardGap);
  const viewH=H-70-safeTop-safeBot;
  if(totalH>viewH){
    const scrollR=viewH/totalH;
    const barH=Math.max(30,viewH*scrollR);
    const barY=60+safeTop+(-stageSelScroll/totalH)*viewH;
    ctx.fillStyle='#ffffff22';rr(W-6,60+safeTop,4,viewH,2);ctx.fill();
    ctx.fillStyle='#ffffff55';rr(W-6,barY,4,barH,2);ctx.fill();
  }
  // Start choice modal overlay
  if(showStartChoice){
    ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(0,0,W,H);
    const mw=Math.min(280,W-20),mh=180;
    const mx=W/2-mw/2,my=H/2-mh/2;
    ctx.fillStyle='#111828';rr(mx,my,mw,mh,14);ctx.fill();
    ctx.strokeStyle='#34d399';ctx.lineWidth=2;rr(mx,my,mw,mh,14);ctx.stroke();
    // Title
    ctx.fillStyle='#fff';ctx.font='bold 16px monospace';ctx.textAlign='center';
    ctx.fillText(t('whereToStart'),W/2,my+30);
    // Button: はじめから
    const btnW=mw-30,btnH=40;
    const btn1X=mx+15,btn1Y=my+50;
    ctx.fillStyle='#ffffff11';rr(btn1X,btn1Y,btnW,btnH,10);ctx.fill();
    ctx.strokeStyle='#fff4';ctx.lineWidth=1;rr(btn1X,btn1Y,btnW,btnH,10);ctx.stroke();
    ctx.fillStyle='#fff';ctx.font='bold 14px monospace';ctx.textAlign='center';
    ctx.fillText(t('fromBeginning'),W/2,btn1Y+26);
    // Button: セーブポイントから
    const btn2Y=my+100;
    ctx.fillStyle='#34d39922';rr(btn1X,btn2Y,btnW,btnH,10);ctx.fill();
    ctx.strokeStyle='#34d399';ctx.lineWidth=2;rr(btn1X,btn2Y,btnW,btnH,10);ctx.stroke();
    ctx.fillStyle='#34d399';ctx.font='bold 14px monospace';
    ctx.fillText(t('fromSavePoint'),W/2,btn2Y+26);
    // Hint
    ctx.fillStyle='#fff4';ctx.font='10px monospace';
    ctx.fillText(t('savePointHint'),W/2,my+mh-10);
  }
  // Reset confirmation modal
  if(stageResetConfirm){
    ctx.fillStyle='rgba(0,0,0,0.8)';ctx.fillRect(0,0,W,H);
    const mw=Math.min(280,W-20),mh=160;
    const mx=W/2-mw/2,my=H/2-mh/2;
    ctx.fillStyle='#1a1028';rr(mx,my,mw,mh,14);ctx.fill();
    ctx.strokeStyle='#ff3860';ctx.lineWidth=2;rr(mx,my,mw,mh,14);ctx.stroke();
    ctx.fillStyle='#ff3860';ctx.font='bold 14px monospace';ctx.textAlign='center';
    ctx.fillText(t('stageDataReset'),W/2,my+28);
    ctx.fillStyle='#fff8';ctx.font='11px monospace';
    ctx.fillText(t('stageResetWarn1'),W/2,my+52);
    ctx.fillText(t('stageResetWarn2'),W/2,my+68);
    const btnW=mw-30,btnH=36;
    const btnX=mx+15;
    // Confirm button
    const cfY=my+84;
    ctx.fillStyle='#ff386022';rr(btnX,cfY,btnW,btnH,10);ctx.fill();
    ctx.strokeStyle='#ff3860';ctx.lineWidth=1.5;rr(btnX,cfY,btnW,btnH,10);ctx.stroke();
    ctx.fillStyle='#ff3860';ctx.font='bold 13px monospace';
    ctx.fillText(t('doReset'),W/2,cfY+24);
    // Cancel button
    const ccY=my+126;
    ctx.fillStyle='#ffffff11';rr(btnX,ccY,btnW,btnH,10);ctx.fill();
    ctx.strokeStyle='#fff4';ctx.lineWidth=1;rr(btnX,ccY,btnW,btnH,10);ctx.stroke();
    ctx.fillStyle='#fff8';ctx.font='bold 13px monospace';
    ctx.fillText(t('cancelBtn'),W/2,ccY+24);
  }
}
function handleStageSelTouch(tx,ty){
  if(stageSelGuardT>0)return; // ignore taps right after transitioning to stage select
  // Reset confirmation modal
  if(stageResetConfirm){
    const mw=Math.min(280,W-20),mh=160;
    const mx=W/2-mw/2,my=H/2-mh/2;
    const btnW=mw-30,btnH=36,btnX=mx+15;
    const cfY=my+84,ccY=my+126;
    // Confirm reset
    if(tx>=btnX&&tx<=btnX+btnW&&ty>=cfY&&ty<=cfY+btnH){
      sfx('select');stageResetConfirm=false;
      packProgress={};localStorage.setItem('gd5pp','{}');
      stageCheckpoints={};localStorage.setItem('gd5checkpoints','{}');
      stageDeathMarks={};
      totalStars=getTotalStars();
      if(typeof fbSaveUserData==='function')fbSaveUserData();
      return;
    }
    // Cancel
    if(tx>=btnX&&tx<=btnX+btnW&&ty>=ccY&&ty<=ccY+btnH){
      sfx('cancel');stageResetConfirm=false;return;
    }
    // Tap outside
    if(tx<mx||tx>mx+mw||ty<my||ty>my+mh){sfx('cancel');stageResetConfirm=false;return;}
    return;
  }
  // Reset button
  if(tx>=W-60&&tx<=W-10&&ty>=22+safeTop&&ty<=52+safeTop){
    sfx('select');stageResetConfirm=true;return;
  }
  // Start choice modal
  if(showStartChoice){
    const mw=Math.min(280,W-20),mh=180;
    const mx=W/2-mw/2,my=H/2-mh/2;
    const btnW=mw-30,btnH=40;
    const btn1X=mx+15,btn1Y=my+50;
    const btn2Y=my+100;
    // "はじめから" button
    if(tx>=btn1X&&tx<=btn1X+btnW&&ty>=btn1Y&&ty<=btn1Y+btnH){
      showStartChoice=false;
      gameMode='pack';isPackMode=true;
      resetPackStage(pendingPackPi,pendingPackSi,false);
      state=ST.COUNTDOWN;countdownT=180;sfx('countdown');
      return;
    }
    // "セーブポイントから" button
    if(tx>=btn1X&&tx<=btn1X+btnW&&ty>=btn2Y&&ty<=btn2Y+btnH){
      showStartChoice=false;
      gameMode='pack';isPackMode=true;
      resetPackStage(pendingPackPi,pendingPackSi,true);
      state=ST.COUNTDOWN;countdownT=180;sfx('countdown');
      return;
    }
    // Tap outside modal = cancel
    if(tx<mx||tx>mx+mw||ty<my||ty>my+mh){
      showStartChoice=false;sfx('cancel');
      return;
    }
    return;
  }
  // Back button
  if(tx>=10&&tx<=60&&ty>=22+safeTop&&ty<=52+safeTop){
    sfx('cancel');titleTouchPos=null;state=ST.TITLE;isPackMode=false;switchBGM('title');return;
  }
  const startY=70+safeTop+stageSelScroll;
  const cardH=130,cardGap=14,cardW=W-30;
  for(let pi=0;pi<STAGE_PACKS.length;pi++){
    const pack=STAGE_PACKS[pi];
    const cy=startY+pi*(cardH+cardGap);
    if(ty<cy||ty>cy+cardH)continue;
    // All packs unlocked
    // Check stage buttons
    const sbW=44,sbH=44,sbGap=8;
    const sbX=15+(cardW-(5*sbW+4*sbGap))/2;
    const sbY=cy+52;
    for(let si=0;si<5;si++){
      const stage=pack.stages[si];
      const sx=sbX+si*(sbW+sbGap);
      if(tx>=sx&&tx<=sx+sbW&&ty>=sbY&&ty<=sbY+sbH){
        // All stages unlocked
        // Check if checkpoint exists for this stage
        if(stageCheckpoints[stage.id]){
          // Show start choice modal
          showStartChoice=true;stageStartChoice='';
          pendingPackPi=pi;pendingPackSi=si;
          sfx('select');return;
        }
        // Start this stage!
        gameMode='pack';isPackMode=true;
        resetPackStage(pi,si,false);
        state=ST.COUNTDOWN;countdownT=180;sfx('countdown');
        return;
      }
    }
    return;
  }
}
let stageSelTouchY=0,stageSelDragging=false;

function drawStageClear(){
  const oa=Math.min(stageClearT/30,0.6);
  ctx.fillStyle=`rgba(0,0,0,${oa})`;ctx.fillRect(-20,-20,W+40,H+40);
  if(stageClearT<10)return;
  const si2=Math.min((stageClearT-10)/20,1),e=1-Math.pow(1-si2,3);
  ctx.save();ctx.translate(0,-40*(1-e));ctx.globalAlpha=e;

  // Big bouncing "STAGE CLEAR!" text
  const clearBounce=stageClearT<40?Math.sin((stageClearT-10)/30*Math.PI)*8:0;
  const clearScale=stageClearT<25?0.5+((stageClearT-10)/15)*0.5:1;
  ctx.save();ctx.translate(W/2,H*0.24-clearBounce);ctx.scale(clearScale,clearScale);
  ctx.fillStyle='#ffd700';ctx.font='bold 42px monospace';ctx.textAlign='center';
  _shadow(30,'#ffd700');
  ctx.fillText('STAGE CLEAR!',0,0);
  _shadow(8,'#fff');
  ctx.fillText('STAGE CLEAR!',0,0);
  ctx.shadowBlur=0;ctx.restore();

  // Stage clear display (unified - always pack mode)
  const pname=currentPackStage?tPackName(currentPackIdx)+' '+currentPackStage.name:'';
  ctx.fillStyle='#fff8';ctx.font='14px monospace';
  ctx.fillText(pname,W/2,H*0.32);
  const cardY=H*0.36,cardH=170;
  ctx.fillStyle='#0008';rr(W/2-120,cardY,240,cardH,12);ctx.fill();
  ctx.strokeStyle='#ffd70033';ctx.lineWidth=1;rr(W/2-120,cardY,240,cardH,12);ctx.stroke();
  drawCharacter(W/2,cardY+35,selChar,20,0,1,'happy');
  // Stars display (3 stars with animation)
  const starY=cardY+75;
  for(let i=0;i<3;i++){
    const sx=W/2-30+i*30,collected=i<stageBigCollected;
    const delay=i*12,ap=stageClearT>20+delay?Math.min(1,(stageClearT-20-delay)/15):0;
    if(collected){
      const sc=1+Math.sin(stageClearT*0.1+i)*0.1;
      ctx.save();ctx.translate(sx,starY);ctx.scale(sc*ap,sc*ap);
      ctx.fillStyle='#ffd700';_shadow(12,'#ffd70088');
      ctx.font='bold 26px monospace';ctx.textAlign='center';ctx.fillText('★',0,8);ctx.shadowBlur=0;ctx.restore();
    } else {ctx.globalAlpha=e*0.3;ctx.fillStyle='#fff';ctx.font='bold 26px monospace';ctx.textAlign='center';ctx.fillText('☆',sx,starY+8);ctx.globalAlpha=e;}
  }
  // New stars earned
  if(gotNewStars>0){
    const bcA=stageClearT>30?Math.min(1,(stageClearT-30)/20):0;
    ctx.globalAlpha=bcA*e;
    ctx.fillStyle='#ffd700';ctx.font='bold 13px monospace';ctx.textAlign='center';
    ctx.fillText('★ +'+gotNewStars+' NEW!',W/2,cardY+150);
    ctx.globalAlpha=e;
  }
  if(stageClearT>60){
    const ta=Math.sin(stageClearT*0.07)*0.3+0.7;
    ctx.globalAlpha=ta*e;ctx.fillStyle='#fff';ctx.font='bold 15px monospace';
    ctx.fillText(t('tapToStageSelect'),W/2,H*0.82);
  }

  for(let i=0;i<parts.length;i++){const p=parts[i];ctx.globalAlpha=p.life/p.ml;ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(p.x,p.y,p.sz*(p.life/p.ml),0,TAU);ctx.fill();}
  ctx.restore();ctx.globalAlpha=1;
}

// ===== EYE PREVIEW (for shop/cosmetic menu) =====
function drawEyePreview(x,y,type,sz){
  ctx.save();
  const es=sz;
  switch(type){
    case'smile':
      ctx.strokeStyle='#111';ctx.lineWidth=Math.max(1.5,sz*0.2);ctx.lineCap='round';
      ctx.beginPath();ctx.arc(x,y-es*0.1,es*0.6,Math.PI+0.4,Math.PI*2-0.4);ctx.stroke();
      break;
    case'angry':
      // Cute angry eye preview
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,es,0,TAU);ctx.fill();
      ctx.fillStyle='#442200';ctx.beginPath();ctx.arc(x+es*0.1,y+es*0.05,es*0.55,0,TAU);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x+es*0.2,y-es*0.15,es*0.15,0,TAU);ctx.fill();
      ctx.strokeStyle='#663300';ctx.lineWidth=Math.max(1.5,sz*0.15);ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(x-es*0.6,y-es*0.9);ctx.lineTo(x+es*0.4,y-es*0.6);ctx.stroke();
      break;
    case'star':
      ctx.fillStyle='#ffd700';
      ctx.beginPath();
      for(let si=0;si<5;si++){const a=-Math.PI/2+si*Math.PI*2/5,a2=a+Math.PI/5;
        ctx.lineTo(x+Math.cos(a)*es,y+Math.sin(a)*es);
        ctx.lineTo(x+Math.cos(a2)*es*0.45,y+Math.sin(a2)*es*0.45);
      }ctx.closePath();ctx.fill();
      // Default eye in center
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,es*0.3,0,TAU);ctx.fill();
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(x+es*0.08,y,es*0.15,0,TAU);ctx.fill();
      break;
    case'heart':
      ctx.fillStyle='#ee1111';
      ctx.save();ctx.translate(x,y);
      const hs2=es*0.9;ctx.beginPath();ctx.moveTo(0,hs2*0.8);
      ctx.bezierCurveTo(-hs2*0.2,hs2*0.5,-hs2*1.1,hs2*0.1,-hs2*1.0,-hs2*0.35);
      ctx.bezierCurveTo(-hs2*0.9,-hs2*0.85,-hs2*0.2,-hs2*0.95,0,-hs2*0.45);
      ctx.bezierCurveTo(hs2*0.2,-hs2*0.95,hs2*0.9,-hs2*0.85,hs2*1.0,-hs2*0.35);
      ctx.bezierCurveTo(hs2*1.1,hs2*0.1,hs2*0.2,hs2*0.5,0,hs2*0.8);ctx.fill();ctx.restore();
      break;
    case'fire':
      ctx.fillStyle='#ff2200';ctx.beginPath();ctx.arc(x,y,es,0,TAU);ctx.fill();
      ctx.fillStyle='#ff6600';ctx.beginPath();ctx.arc(x+es*0.1,y,es*0.65,0,TAU);ctx.fill();
      ctx.fillStyle='#ffcc00';ctx.beginPath();ctx.arc(x+es*0.15,y,es*0.3,0,TAU);ctx.fill();
      break;
    case'cat':
      ctx.fillStyle='#ccff44';ctx.beginPath();ctx.ellipse(x,y,es,es*0.9,0,0,TAU);ctx.fill();
      ctx.fillStyle='#111';ctx.beginPath();ctx.ellipse(x+es*0.1,y,es*0.12,es*0.7,0,0,TAU);ctx.fill();
      break;
    case'spiral':
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,es,0,TAU);ctx.fill();
      ctx.strokeStyle='#333';ctx.lineWidth=Math.max(0.6,sz*0.07);ctx.beginPath();
      for(let si=0;si<16;si++){const sa=si*0.8,sr=es*0.1+si*es*0.05;
        const sx=x+Math.cos(sa)*sr,sy=y+Math.sin(sa)*sr;
        if(si===0)ctx.moveTo(sx,sy);else ctx.lineTo(sx,sy);
      }ctx.stroke();
      break;
    case'cyber':
      ctx.fillStyle='#00ff88';ctx.beginPath();ctx.arc(x,y,es,0,TAU);ctx.fill();
      ctx.strokeStyle='#003322';ctx.lineWidth=Math.max(0.8,sz*0.08);
      ctx.beginPath();ctx.moveTo(x-es,y);ctx.lineTo(x+es,y);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x,y-es);ctx.lineTo(x,y+es);ctx.stroke();
      ctx.fillStyle='#003322';ctx.beginPath();ctx.arc(x+es*0.1,y,es*0.25,0,TAU);ctx.fill();
      ctx.fillStyle='#00ff88';ctx.beginPath();ctx.arc(x+es*0.1,y,es*0.1,0,TAU);ctx.fill();
      break;
    case'diamond':
      ctx.fillStyle='#aaeeff';
      ctx.beginPath();ctx.moveTo(x,y-es);ctx.lineTo(x+es*0.7,y);
      ctx.lineTo(x,y+es);ctx.lineTo(x-es*0.7,y);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.5)';
      ctx.beginPath();ctx.moveTo(x,y-es);ctx.lineTo(x+es*0.3,y);ctx.lineTo(x,y);ctx.closePath();ctx.fill();
      break;
    case'void':
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(x,y,es,0,TAU);ctx.fill();
      ctx.fillStyle='#330044';ctx.beginPath();ctx.arc(x,y,es*0.7,0,TAU);ctx.fill();
      ctx.fillStyle='#220033';ctx.beginPath();ctx.arc(x,y,es*0.4,0,TAU);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x+es*0.05,y-es*0.1,es*0.08,0,TAU);ctx.fill();
      break;
    case'galaxy':
      ctx.fillStyle='#0a0a2e';ctx.beginPath();ctx.arc(x,y,es,0,TAU);ctx.fill();
      for(let gi=0;gi<6;gi++){const ga=gi*1.047+(typeof frame!=='undefined'?frame*0.04:0),gd=es*(0.3+gi*0.1);
        ctx.fillStyle=`hsla(${(gi*60+200)%360},80%,70%,0.7)`;
        ctx.beginPath();ctx.arc(x+Math.cos(ga)*gd,y+Math.sin(ga)*gd,es*0.08,0,TAU);ctx.fill();}
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,es*0.12,0,TAU);ctx.fill();
      break;
    case'glitch':
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,es,0,TAU);ctx.fill();
      ctx.fillStyle='#333';ctx.beginPath();ctx.arc(x+es*0.15,y,es*0.5,0,TAU);ctx.fill();
      const gt2=typeof frame!=='undefined'?frame:0;
      if(gt2%30<5){ctx.fillStyle='#ff004488';ctx.fillRect(x-es,y-es*0.3,es*2,es*0.2);
        ctx.fillStyle='#00ff4488';ctx.fillRect(x-es+1,y+es*0.1,es*2,es*0.15);}
      break;
    case'blink':{
      const bt2=typeof frame!=='undefined'?frame:0;
      const bc2=bt2%180;
      const blk2=bc2>=170&&bc2<180;
      const hlf2=bc2>=168&&bc2<170||bc2>=178&&bc2<180;
      if(blk2){
        ctx.strokeStyle='#333';ctx.lineWidth=Math.max(1,sz*0.12);ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(x-es*0.6,y);ctx.lineTo(x+es*0.6,y);ctx.stroke();
      } else if(hlf2){
        ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(x,y,es,es*0.3,0,0,TAU);ctx.fill();
        ctx.fillStyle='#333';ctx.beginPath();ctx.ellipse(x+es*0.15,y,es*0.5,es*0.15,0,0,TAU);ctx.fill();
      } else {
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,es,0,TAU);ctx.fill();
        ctx.fillStyle='#333';ctx.beginPath();ctx.arc(x+es*0.15,y,es*0.5,0,TAU);ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x+es*0.25,y-es*0.2,es*0.13,0,TAU);ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.4)';ctx.beginPath();ctx.arc(x-es*0.05,y+es*0.2,es*0.07,0,TAU);ctx.fill();
      }
      break;}
    default:
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,es,0,TAU);ctx.fill();
      ctx.fillStyle='#333';ctx.beginPath();ctx.arc(x+es*0.15,y,es*0.45,0,TAU);ctx.fill();
  }
  ctx.restore();
}

function withTempPreviewEquip(tab,item,drawFn){
  const prevSkin=equippedSkin,prevEyes=equippedEyes,prevFx=equippedEffect,prevPet=equippedPet,prevAcc=equippedAccessory;
  const def=shopTabDef(tab);
  if(def.equipSlot==='skin')equippedSkin=item.id;
  else if(def.equipSlot==='eyes')equippedEyes=item.id;
  else if(def.equipSlot==='effect')equippedEffect=item.id;
  else if(def.equipSlot==='pet')equippedPet=item.id;
  else if(def.equipSlot==='accessory')equippedAccessory=item.id;
  drawFn();
  equippedSkin=prevSkin;equippedEyes=prevEyes;equippedEffect=prevFx;equippedPet=prevPet;equippedAccessory=prevAcc;
}

function drawShopItemPreview(tab,item,x,y){
  const def=shopTabDef(tab);
  if(def.key==='items'){
    ctx.fillStyle=item.id==='item_magnet'?'#f59e0b':'#ff6b35';
    ctx.font='bold 18px monospace';ctx.textAlign='center';
    ctx.fillText(item.id==='item_magnet'?'\u{1F9F2}':'\u{1F4A3}',x,y+6);
    return;
  }
  withTempPreviewEquip(tab,item,()=>{
    if(def.key==='effects'){
      drawCharacter(x,y,selChar,10,0,1,'normal',0,true);
      drawPlayerEffect(x,y,10,item.type,0.7,1);
    } else if(def.key==='pets'){
      drawEquippedPetAt(x-12,y+3,8.5,1,'preview',1);
      drawCharacter(x+7,y,selChar,10,0,1,'normal',0,true);
    } else {
      drawCharacter(x,y,selChar,12,0,1,'normal',0,true);
    }
  });
}

function drawFullPreviewWithItem(tab,item,x,y,r,showItemText){
  const def=shopTabDef(tab);
  if(def.key==='items'){
    ctx.save();
    ctx.fillStyle=item.id==='item_magnet'?'#f59e0b':'#ff6b35';
    ctx.font='bold 34px monospace';ctx.textAlign='center';
    ctx.fillText(item.id==='item_magnet'?'\u{1F9F2}':'\u{1F4A3}',x,y+10);
    if(showItemText!==false){
      ctx.fillStyle='#fff6';ctx.font='10px monospace';
      ctx.fillText(item.id==='item_magnet'?t('itemDescMagnet'):t('itemDescBomb'),x,y+40);
    }
    ctx.restore();
    return;
  }
  withTempPreviewEquip(tab,item,()=>{
    if(def.key==='pets')drawEquippedPetAt(x-r*1.35,y+r*0.18,r*0.5,1,'preview',1);
    drawCharacter(x,y,selChar,r,0,1,'normal',0,true);
    const fxPrev=getEquippedEffectData();
    if(fxPrev)drawPlayerEffect(x,y,r,fxPrev.type,1,1);
  });
}
// ===== SHOP DRAW =====
function drawShop(){
  if(!shopOpen)return;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.88)';ctx.fillRect(0,0,W,H);
  const {mW,mH,mX,mY,listY,listH,rowH}=shopModalLayout();
  const mgr=ctx.createLinearGradient(mX,mY,mX,mY+mH);
  mgr.addColorStop(0,'#1a1a2e');mgr.addColorStop(0.5,'#16213e');mgr.addColorStop(1,'#0f0f23');
  ctx.fillStyle=mgr;rr(mX,mY,mW,mH,16);ctx.fill();
  ctx.strokeStyle='#ff69b444';ctx.lineWidth=2;rr(mX,mY,mW,mH,16);ctx.stroke();
  ctx.strokeStyle='#ff69b4';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(mX+16,mY);ctx.lineTo(mX+mW-16,mY);ctx.stroke();
  // Title
  ctx.fillStyle='#ff69b4';ctx.font='bold 18px monospace';ctx.textAlign='center';
  ctx.fillText(t('shop'),W/2,mY+30);
  // Wallet
  ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';
  ctx.fillText('\u25CF '+walletCoins,W/2,mY+48);
  // Tabs
  for(let i=0;i<SHOP_TAB_DEFS.length;i++){
    const def=shopTabDef(i),tr=shopTabRect(i);
    ctx.fillStyle=shopTab===i?def.color+'33':'#ffffff08';
    rr(tr.x,tr.y,tr.w,tr.h,6);ctx.fill();
    ctx.strokeStyle=shopTab===i?def.color:def.color+'44';ctx.lineWidth=1;rr(tr.x,tr.y,tr.w,tr.h,6);ctx.stroke();
    ctx.fillStyle=shopTab===i?def.color:'#fff6';ctx.font=shopTab===i?'bold 10px monospace':'10px monospace';
    ctx.fillText(t(def.labelKey),tr.x+tr.w/2,tr.y+18);
  }
  // Items list
  const items=shopSorted(shopItemsForTab(shopTab),true);
  ctx.save();ctx.beginPath();ctx.rect(mX+1,listY,mW-2,listH);ctx.clip();
  for(let i=0;i<items.length;i++){
    const item=items[i];
    const iy=listY+i*rowH-shopScroll;
    if(iy+rowH<listY||iy>listY+listH)continue;
    const def=shopTabDef(shopTab);
    const isConsumable=isConsumableItem(item);
    const owned=isConsumable?itemStock(item.id)>0:ownsItem(item.id);
    const isSecret=(item.rarity==='rare'||item.rarity==='super_rare')&&!owned;
    const isRareShop=item.rarity==='rare';
    const isSuperRareShop=item.rarity==='super_rare';
    const equipped=def.isCosmetic&&equippedIdForSlot(def.equipSlot)===item.id;
    // Row bg with rarity tint
    ctx.fillStyle=isSuperRareShop&&owned?'#ffd70012':isRareShop&&owned?'#a855f710':equipped?'#ffffff15':owned?'#ffffff08':isSecret?'#ffffff02':'#ffffff04';
    rr(mX+8,iy+2,mW-16,rowH-4,8);ctx.fill();
    // Rarity borders (for both owned and unowned)
    if(equipped){ctx.strokeStyle='#ffd700';ctx.lineWidth=1.5;rr(mX+8,iy+2,mW-16,rowH-4,8);ctx.stroke();}
    else if(isSuperRareShop){
      ctx.strokeStyle=owned?'#ffd700':'#ffd70033';ctx.lineWidth=owned?2:1.5;rr(mX+8,iy+2,mW-16,rowH-4,8);ctx.stroke();
      if(owned){
        // Corner accents for owned super rare
        ctx.strokeStyle='#ffd70088';ctx.lineWidth=1;
        const cx1=mX+8,cy1=iy+2,cx2=mX+mW-8,cy2=iy+rowH-2,cl=8;
        ctx.beginPath();ctx.moveTo(cx1,cy1+cl);ctx.lineTo(cx1,cy1);ctx.lineTo(cx1+cl,cy1);ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx2-cl,cy1);ctx.lineTo(cx2,cy1);ctx.lineTo(cx2,cy1+cl);ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx1,cy2-cl);ctx.lineTo(cx1,cy2);ctx.lineTo(cx1+cl,cy2);ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx2-cl,cy2);ctx.lineTo(cx2,cy2);ctx.lineTo(cx2,cy2-cl);ctx.stroke();
      }
    } else if(isRareShop){
      ctx.strokeStyle=owned?'#a855f7':'#a855f722';ctx.lineWidth=owned?1.5:1;rr(mX+8,iy+2,mW-16,rowH-4,8);ctx.stroke();
    }
    if(isSecret){
      // Secret item: show mystery appearance
      const sCol=isSuperRareShop?'#ffd700':'#a855f7';
      const sCol2=isSuperRareShop?'#ffd70033':'#a855f733';
      const sCol3=isSuperRareShop?'#ffd70066':'#a855f766';
      ctx.fillStyle=sCol2;ctx.font='20px monospace';ctx.textAlign='center';
      ctx.fillText(isSuperRareShop?'\u2605':'?',mX+33,iy+rowH/2+7);
      ctx.fillStyle=sCol;ctx.font='bold 12px monospace';ctx.textAlign='left';
      ctx.fillText(isSuperRareShop?t('secretSuper'):t('secretItem'),mX+56,iy+20);
      ctx.fillStyle=sCol3;ctx.font='9px monospace';
      ctx.fillText(t('gachaOnly'),mX+56,iy+34);
      ctx.textAlign='right';
      ctx.fillStyle=sCol;ctx.font='bold 11px monospace';
      ctx.fillText(isSuperRareShop?'\uD83D\uDD12 S.RARE':'\uD83D\uDD12 SECRET',mX+mW-16,iy+20);
      ctx.fillStyle=sCol3;ctx.font='9px monospace';ctx.fillText(t('fromChest'),mX+mW-16,iy+34);
    } else {
    // Preview: show actual character with cosmetic applied
    drawShopItemPreview(shopTab,item,mX+33,iy+rowH/2);
    // Name & desc with rarity
    ctx.fillStyle=isSuperRareShop?'#ffd700':isRareShop?'#a855f7':'#fff';
    ctx.font='bold 12px monospace';ctx.textAlign='left';
    ctx.fillText(tCosName(item.id),mX+56,iy+16);
    // Rarity label
    if(isSuperRareShop){
      ctx.fillStyle='#ffd700';ctx.font='bold 7px monospace';
      ctx.fillText('\u2605 S.RARE',mX+56,iy+26);
    } else if(isRareShop){
      ctx.fillStyle='#a855f7';ctx.font='bold 7px monospace';
      ctx.fillText('\u25C6 RARE',mX+56,iy+26);
    }
    const isPetRow=def.key==='pets';
    const rowDesc=def.key==='items'?(item.id==='item_magnet'?t('itemDescMagnet'):t('itemDescBomb')):tCosDesc(item.id);
    if(isPetRow){
      // Ability text (from i18n desc - now ability-focused)
      ctx.fillStyle='#6ee7b7';ctx.font='bold 8px monospace';
      ctx.fillText('⚡ '+rowDesc,mX+56,iy+30,mW-162);
      // Flavor text from item.ability or item.desc field
      ctx.fillStyle='#fff4';ctx.font='8px monospace';
      ctx.fillText(item.desc||'',mX+56,iy+44,mW-162);
    } else {
      ctx.fillStyle='#fff6';ctx.font='9px monospace';
      ctx.fillText(rowDesc,mX+56,iy+38,mW-162);
    }
    // Price / owned / equipped
    ctx.textAlign='right';
    if(equipped){
      ctx.fillStyle='#ffd700';ctx.font='bold 11px monospace';
      ctx.fillText(t('equipped'),mX+mW-16,iy+20);
    } else if(isConsumable){
      const stock=itemStock(item.id);
      ctx.fillStyle=stock>0?'#60a5fa':'#fff6';ctx.font='bold 11px monospace';
      ctx.fillText(t('stockLabel')+' '+stock+'/'+(item.stackMax||99),mX+mW-16,iy+20);
      ctx.fillStyle=stock>=(item.stackMax||99)?'#34d399':walletCoins>=item.price?'#fff6':'#ff444488';ctx.font='9px monospace';
      ctx.fillText(stock>=(item.stackMax||99)?t('maxLabel'):t('tapToBuy'),mX+mW-16,iy+34);
    } else if(owned){
      ctx.fillStyle='#34d399';ctx.font='bold 11px monospace';
      ctx.fillText(t('owned'),mX+mW-16,iy+27);
    } else {
      ctx.fillStyle=walletCoins>=item.price?'#ffd700':'#ff4444';ctx.font='bold 12px monospace';
      ctx.fillText('\u25CF '+item.price,mX+mW-16,iy+20);
      ctx.fillStyle=walletCoins>=item.price?'#fff6':'#ff444488';ctx.font='9px monospace';
      ctx.fillText(t('tapToBuy'),mX+mW-16,iy+34);
    }
    } // end !isSecret
  }
  ctx.restore();
  // Scroll indicator
  const totalItemH=items.length*rowH;
  if(totalItemH>listH){
    const scrollR=listH/totalItemH,thumbH=Math.max(20,listH*scrollR);
    const thumbY=listY+(shopScroll/(totalItemH-listH))*(listH-thumbH);
    ctx.fillStyle='#ffffff22';rr(mX+mW-6,thumbY,4,thumbH,2);ctx.fill();
  }
  // Footer close button
  const shopCloseY=mY+mH-42;
  _drawCloseBtn(shopCloseY);
  // Purchase confirmation dialog with preview
  if(shopConfirm){
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,H);
    const lay=shopConfirmLayout(shopConfirm.item);
    const dlgW=lay.dlgW,dlgH=lay.dlgH,dlgX=lay.dlgX,dlgY=lay.dlgY;
    const dgr=ctx.createLinearGradient(dlgX,dlgY,dlgX,dlgY+dlgH);
    dgr.addColorStop(0,'#1e1e3a');dgr.addColorStop(1,'#0f0f23');
    ctx.fillStyle=dgr;rr(dlgX,dlgY,dlgW,dlgH,14);ctx.fill();
    ctx.strokeStyle='#ffd700';ctx.lineWidth=2;rr(dlgX,dlgY,dlgW,dlgH,14);ctx.stroke();
    // Title
    ctx.fillStyle='#ffd700';ctx.font='bold 14px monospace';ctx.textAlign='center';
    ctx.fillText(t('purchaseConfirm'),W/2,dlgY+26);
    // Character preview with item applied
    const prevY2=dlgY+80;
    drawFullPreviewWithItem(shopConfirm.tab,shopConfirm.item,W/2,prevY2,26,false);
    // Item name
    ctx.fillStyle='#fff';ctx.font='bold 13px monospace';ctx.textAlign='center';
    ctx.fillText(tCosName(shopConfirm.item.id),W/2,prevY2+42);
    const isBulk=isConsumableItem(shopConfirm.item);
    const qty=isBulk?Math.max(1,Math.min(maxPurchasableConsumable(shopConfirm.item),shopConfirm.qty||1)):1;
    const totalPrice=shopConfirm.item.price*qty;
    const canBuy=isBulk?qty>0:walletCoins>=shopConfirm.item.price;
    if(!isBulk){
      ctx.fillStyle='#fff6';ctx.font='10px monospace';
      ctx.fillText(tCosDesc(shopConfirm.item.id),W/2,prevY2+58);
    }
    if(isBulk){
      function drawMiniBtn(btn,label,active){
        ctx.fillStyle=active?'#ffffff14':'#ffffff08';rr(btn.x,btn.y,btn.w,btn.h,7);ctx.fill();
        ctx.strokeStyle=active?'#ffd70088':'#ffffff22';ctx.lineWidth=1;rr(btn.x,btn.y,btn.w,btn.h,7);ctx.stroke();
        ctx.fillStyle=active?'#fff':'#fff5';ctx.font='bold 12px monospace';ctx.textAlign='center';
        ctx.fillText(label,btn.x+btn.w/2,btn.y+btn.h/2+4);
      }
      drawMiniBtn(lay.minusBtn,'-1',qty>1);
      drawMiniBtn(lay.plusTenBtn,'+10',qty<maxPurchasableConsumable(shopConfirm.item));
      drawMiniBtn(lay.maxBtn,'MAX',maxPurchasableConsumable(shopConfirm.item)>0&&qty!==maxPurchasableConsumable(shopConfirm.item));
      drawMiniBtn(lay.plusBtn,'+1',qty<maxPurchasableConsumable(shopConfirm.item));
      ctx.fillStyle='#ffffff10';rr(lay.qtyBox.x,lay.qtyBox.y,lay.qtyBox.w,lay.qtyBox.h,8);ctx.fill();
      ctx.strokeStyle='#ffd70055';ctx.lineWidth=1.5;rr(lay.qtyBox.x,lay.qtyBox.y,lay.qtyBox.w,lay.qtyBox.h,8);ctx.stroke();
      ctx.fillStyle='#fff8';ctx.font='bold 16px monospace';
      ctx.fillText('x'+qty,lay.qtyCenterX,lay.qtyY);
    }
    // Price
    ctx.fillStyle='#ffd700';ctx.font='bold 16px monospace';
    ctx.fillText('\u25CF '+(isBulk?shopConfirm.item.price+' x '+qty+' = '+totalPrice:shopConfirm.item.price),W/2,isBulk?lay.priceY:prevY2+82);
    // Balance after purchase
    const after=walletCoins-(isBulk?totalPrice:shopConfirm.item.price);
    if(canBuy){
      ctx.fillStyle='#fff6';ctx.font='10px monospace';
      ctx.fillText(t('balance')+': '+walletCoins+' \u2192 '+after,W/2,isBulk?lay.balanceY:prevY2+98);
    } else {
      ctx.fillStyle='#ff4444';ctx.font='bold 10px monospace';
      ctx.fillText((isBulk&&itemStock(shopConfirm.item.id)>=(shopConfirm.item.stackMax||99)?t('maxLabel'):t('coinShortMsg'))+' ('+t('balance')+': '+walletCoins+')',W/2,isBulk?lay.balanceY:prevY2+98);
    }
    // Buttons
    if(canBuy){
      ctx.fillStyle='#ffd70022';rr(lay.buyBtn.x,lay.buyBtn.y,lay.buyBtn.w,lay.buyBtn.h,8);ctx.fill();
      ctx.strokeStyle='#ffd700';ctx.lineWidth=1.5;rr(lay.buyBtn.x,lay.buyBtn.y,lay.buyBtn.w,lay.buyBtn.h,8);ctx.stroke();
      ctx.fillStyle='#ffd700';ctx.font='bold 13px monospace';ctx.textAlign='center';
      ctx.fillText(t('purchase'),lay.buyBtn.x+lay.buyBtn.w/2,lay.buyBtn.y+24);
    } else {
      ctx.fillStyle='#ffffff08';rr(lay.buyBtn.x,lay.buyBtn.y,lay.buyBtn.w,lay.buyBtn.h,8);ctx.fill();
      ctx.strokeStyle='#ff444466';ctx.lineWidth=1;rr(lay.buyBtn.x,lay.buyBtn.y,lay.buyBtn.w,lay.buyBtn.h,8);ctx.stroke();
      ctx.fillStyle='#ff444488';ctx.font='bold 13px monospace';ctx.textAlign='center';
      ctx.fillText(t('purchase'),lay.buyBtn.x+lay.buyBtn.w/2,lay.buyBtn.y+24);
    }
    ctx.fillStyle='#ffffff0a';rr(lay.cancelBtn.x,lay.cancelBtn.y,lay.cancelBtn.w,lay.cancelBtn.h,8);ctx.fill();
    ctx.strokeStyle='#fff4';ctx.lineWidth=1;rr(lay.cancelBtn.x,lay.cancelBtn.y,lay.cancelBtn.w,lay.cancelBtn.h,8);ctx.stroke();
    ctx.fillStyle='#fff8';ctx.font='bold 13px monospace';
    ctx.fillText(t('cancel'),lay.cancelBtn.x+lay.cancelBtn.w/2,lay.cancelBtn.y+24);
  }
  // Purchase gacha animation
  if(shopPurchaseAnim){
    shopPurchaseAnim.t++;
    const a=shopPurchaseAnim;
    const fadeIn=Math.min(1,a.t/10);
    const fadeOut=a.t>80?Math.max(0,1-(a.t-80)/20):1;
    const alpha=fadeIn*fadeOut;
    if(alpha<=0){shopPurchaseAnim=null;}
    else{
      ctx.save();ctx.globalAlpha=alpha;
      ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(0,0,W,H);
      // Radial glow
      const glowR=80+Math.sin(a.t*0.15)*20;
      const glow=ctx.createRadialGradient(W/2,H/2-20,0,W/2,H/2-20,glowR);
      glow.addColorStop(0,'rgba(255,215,0,0.3)');glow.addColorStop(1,'rgba(255,215,0,0)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
      // Item name with scale animation
      const sc=a.t<15?0.5+0.5*(a.t/15):1;
      ctx.save();ctx.translate(W/2,H/2-30);ctx.scale(sc,sc);
      ctx.fillStyle='#ffd700';ctx.font='bold 20px monospace';ctx.textAlign='center';
      ctx.fillText('GET!',0,-30);
      ctx.fillStyle='#fff';ctx.font='bold 16px monospace';
      ctx.fillText(tCosName(a.item.id)+(a.qty&&a.qty>1?' x'+a.qty:''),0,0);
      if(!(isConsumableItem(a.item)&&a.qty&&a.qty>1)){
        ctx.fillStyle='#fff8';ctx.font='11px monospace';
        ctx.fillText(tCosDesc(a.item.id),0,22);
      }
      ctx.restore();
      // Particles
      for(const p of a.parts){
        p.x+=p.vx;p.y+=p.vy;p.vy+=0.15;p.vx*=0.98;p.life--;
        if(p.life>0){
          ctx.globalAlpha=alpha*Math.min(1,p.life/20);
          ctx.fillStyle=p.col;
          ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,TAU);ctx.fill();
        }
      }
      // Tap to dismiss hint
      if(a.t>30){
        ctx.globalAlpha=alpha*0.5;
        ctx.fillStyle='#fff';ctx.font='10px monospace';ctx.textAlign='center';
        ctx.fillText(t('tapToClose'),W/2,H/2+60);
      }
      ctx.restore();
    }
  }
  // Equip-now prompt after purchase
  if(shopEquipPrompt){
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,H);
    const dlgW=Math.min(250,W-30),dlgH=150;
    const dlgX=W/2-dlgW/2,dlgY=H/2-dlgH/2;
    const dgr=ctx.createLinearGradient(dlgX,dlgY,dlgX,dlgY+dlgH);
    dgr.addColorStop(0,'#1e1e3a');dgr.addColorStop(1,'#0f0f23');
    ctx.fillStyle=dgr;rr(dlgX,dlgY,dlgW,dlgH,14);ctx.fill();
    ctx.strokeStyle='#ffd700';ctx.lineWidth=2;rr(dlgX,dlgY,dlgW,dlgH,14);ctx.stroke();
    // Title
    ctx.fillStyle='#ffd700';ctx.font='bold 14px monospace';ctx.textAlign='center';
    ctx.fillText(t('equipQuestion'),W/2,dlgY+30);
    // Item preview
    const prevY3=dlgY+62;
    drawFullPreviewWithItem(shopEquipPrompt.tab,shopEquipPrompt.item,W/2,prevY3,22);
    // Item name
    ctx.fillStyle='#fff';ctx.font='bold 11px monospace';ctx.textAlign='center';
    ctx.fillText(tCosName(shopEquipPrompt.item.id),W/2,prevY3+30);
    // Buttons
    const btnW2=90,btnH2=34;
    ctx.fillStyle='#ffd70022';rr(W/2-btnW2-6,dlgY+dlgH-48,btnW2,btnH2,8);ctx.fill();
    ctx.strokeStyle='#ffd700';ctx.lineWidth=1.5;rr(W/2-btnW2-6,dlgY+dlgH-48,btnW2,btnH2,8);ctx.stroke();
    ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';ctx.textAlign='center';
    ctx.fillText(t('equip'),W/2-btnW2/2-6,dlgY+dlgH-26);
    ctx.fillStyle='#ffffff0a';rr(W/2+6,dlgY+dlgH-48,btnW2,btnH2,8);ctx.fill();
    ctx.strokeStyle='#fff3';ctx.lineWidth=1;rr(W/2+6,dlgY+dlgH-48,btnW2,btnH2,8);ctx.stroke();
    ctx.fillStyle='#fff8';ctx.font='bold 12px monospace';
    ctx.fillText(t('later'),W/2+btnW2/2+6,dlgY+dlgH-26);
  }
  ctx.restore();
}

// ===== COSMETIC EQUIP MENU =====
function drawCosmeticMenu(){
  if(!cosmeticMenuOpen)return;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.88)';ctx.fillRect(0,0,W,H);
  const {mW,mH,mX,mY,listY,listH,rowH}=cosmeticModalLayout();
  const mgr=ctx.createLinearGradient(mX,mY,mX,mY+mH);
  mgr.addColorStop(0,'#1a1a2e');mgr.addColorStop(0.5,'#16213e');mgr.addColorStop(1,'#0f0f23');
  ctx.fillStyle=mgr;rr(mX,mY,mW,mH,16);ctx.fill();
  ctx.strokeStyle='#a855f744';ctx.lineWidth=2;rr(mX,mY,mW,mH,16);ctx.stroke();
  ctx.strokeStyle='#a855f7';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(mX+16,mY);ctx.lineTo(mX+mW-16,mY);ctx.stroke();
  // Title
  ctx.fillStyle='#a855f7';ctx.font='bold 18px monospace';
  ctx.fillText(t('dressUp'),W/2,mY+30);
  // Character preview
  const prevX=W/2,prevY=mY+70;
  drawEquippedPetAt(prevX-36,prevY+8,12,1,'preview',1);
  drawCharacter(prevX,prevY,selChar,22,0,1,'normal',0,true);
  const fxD=getEquippedEffectData();
  if(fxD)drawPlayerEffect(prevX,prevY,22,fxD.type,1);
  // Tabs
  for(let i=0;i<COSMETIC_TAB_DEFS.length;i++){
    const def=cosmeticTabDef(i),tr=cosmeticTabRect(i);
    ctx.fillStyle=cosmeticTab===i?def.color+'33':'#ffffff08';
    rr(tr.x,tr.y,tr.w,tr.h,6);ctx.fill();
    ctx.strokeStyle=cosmeticTab===i?def.color:def.color+'44';ctx.lineWidth=1;rr(tr.x,tr.y,tr.w,tr.h,6);ctx.stroke();
    ctx.fillStyle=cosmeticTab===i?def.color:'#fff6';ctx.font=cosmeticTab===i?'bold 10px monospace':'10px monospace';
    ctx.fillText(t(def.labelKey),tr.x+tr.w/2,tr.y+18);
  }
  // Item list: show every item as a collection frame; unowned stays hidden as ???.
  const ownedList=cosmeticListForTab(cosmeticTab);
  ctx.save();ctx.beginPath();ctx.rect(mX,listY,mW,listH);ctx.clip();
  for(let i=0;i<ownedList.length;i++){
    const item=ownedList[i];
    const iy=listY+i*rowH-cosmeticScroll;
    if(iy+rowH<listY||iy>listY+listH)continue;
    const isNone=item.id==='';
    const owned=isNone||ownsItem(item.id);
    const def=cosmeticTabDef(cosmeticTab);
    const equipped=def.isCosmetic&&equippedIdForSlot(def.equipSlot)===item.id;
    const isRare=!isNone&&item.rarity==='rare';
    const isSR=!isNone&&item.rarity==='super_rare';
    // Row background with rarity tint
    ctx.fillStyle=!owned?'#ffffff03':isSR?'#ffd70012':isRare?'#a855f710':equipped?'#ffffff18':'#ffffff06';
    rr(mX+8,iy+2,mW-16,rowH-4,8);ctx.fill();
    // Rarity border
    if(isSR){
      ctx.strokeStyle=owned?'#ffd700':'#ffd70044';ctx.lineWidth=owned?2:1.5;rr(mX+8,iy+2,mW-16,rowH-4,8);ctx.stroke();
      // Corner accents for super rare
      ctx.strokeStyle=owned?'#ffd70088':'#ffd70033';ctx.lineWidth=1;
      const cx1=mX+8,cy1=iy+2,cx2=mX+mW-8,cy2=iy+rowH-2,cl=8;
      ctx.beginPath();ctx.moveTo(cx1,cy1+cl);ctx.lineTo(cx1,cy1);ctx.lineTo(cx1+cl,cy1);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx2-cl,cy1);ctx.lineTo(cx2,cy1);ctx.lineTo(cx2,cy1+cl);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx1,cy2-cl);ctx.lineTo(cx1,cy2);ctx.lineTo(cx1+cl,cy2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx2-cl,cy2);ctx.lineTo(cx2,cy2);ctx.lineTo(cx2,cy2-cl);ctx.stroke();
    } else if(isRare){
      ctx.strokeStyle=owned?'#a855f7':'#a855f744';ctx.lineWidth=owned?1.5:1;rr(mX+8,iy+2,mW-16,rowH-4,8);ctx.stroke();
    } else if(equipped){
      ctx.strokeStyle='#ffd700';ctx.lineWidth=1.5;rr(mX+8,iy+2,mW-16,rowH-4,8);ctx.stroke();
    } else if(!owned){
      ctx.strokeStyle='#ffffff22';ctx.lineWidth=1;rr(mX+8,iy+2,mW-16,rowH-4,8);ctx.stroke();
    }
    // Preview
    if(!owned){
      const qCol=isSR?'#ffd70088':isRare?'#a855f788':'#ffffff55';
      ctx.fillStyle=qCol;ctx.font='bold 18px monospace';ctx.textAlign='center';
      ctx.fillText('??',mX+33,iy+rowH/2+6);
    } else if(!isNone){
      drawShopItemPreview(cosmeticTab,item,mX+33,iy+rowH/2);
    } else {
      ctx.fillStyle='#fff4';ctx.font='18px monospace';ctx.textAlign='center';
      ctx.fillText('\u2013',mX+33,iy+rowH/2+6);
    }
    // Name with rarity color
    ctx.fillStyle=!owned?'#fff6':equipped?'#ffd700':isSR?'#ffd700':isRare?'#a855f7':'#fff';
    ctx.font='bold 11px monospace';ctx.textAlign='left';
    ctx.fillText(owned?tCosName(item.id):'???',mX+56,iy+18);
    // Rarity label
    if(isSR){
      ctx.fillStyle=owned?'#ffd700':'#ffd70088';ctx.font='bold 7px monospace';
      ctx.fillText('\u2605 S.RARE',mX+56,iy+28);
    } else if(isRare){
      ctx.fillStyle=owned?'#a855f7':'#a855f788';ctx.font='bold 7px monospace';
      ctx.fillText('\u25C6 RARE',mX+56,iy+28);
    }
    const isCosmeticPet=def.key==='pets';
    if(isCosmeticPet&&owned){
      ctx.fillStyle='#6ee7b7';ctx.font='bold 8px monospace';
      ctx.fillText('⚡ '+tCosDesc(item.id),mX+56,iy+30,mW-130);
      ctx.fillStyle='#fff4';ctx.font='8px monospace';
      ctx.fillText(item.desc||'',mX+56,iy+42,mW-130);
    } else {
      ctx.fillStyle='#fff5';ctx.font='9px monospace';
      ctx.fillText(owned?(tCosDesc(item.id)||''):'???',mX+56,iy+38);
    }
    // Status
    ctx.textAlign='right';
    if(equipped){ctx.fillStyle='#ffd700';ctx.font='bold 10px monospace';ctx.fillText(t('equipped'),mX+mW-16,iy+22);}
    else if(!owned){ctx.fillStyle='#fff4';ctx.font='bold 10px monospace';ctx.fillText('???',mX+mW-16,iy+22);}
    else{ctx.fillStyle='#fff5';ctx.font='9px monospace';ctx.fillText(t('tapToEquip'),mX+mW-16,iy+22);}
  }
  ctx.restore();
  // Footer close button
  const cosCloseY=mY+mH-42;
  _drawCloseBtn(cosCloseY);
  // Equip confirmation dialog
  if(cosmeticConfirm){
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,H);
    const dlgW=Math.min(240,W-40),dlgH=140;
    const dlgX=W/2-dlgW/2,dlgY=H/2-dlgH/2;
    const dgr=ctx.createLinearGradient(dlgX,dlgY,dlgX,dlgY+dlgH);
    dgr.addColorStop(0,'#1e1e3a');dgr.addColorStop(1,'#0f0f23');
    ctx.fillStyle=dgr;rr(dlgX,dlgY,dlgW,dlgH,14);ctx.fill();
    ctx.strokeStyle='#a855f7';ctx.lineWidth=2;rr(dlgX,dlgY,dlgW,dlgH,14);ctx.stroke();
    ctx.fillStyle='#a855f7';ctx.font='bold 14px monospace';ctx.textAlign='center';
    const isUnequip=cosmeticConfirm.item.id==='';
    ctx.fillText(isUnequip?t('unequipConfirm'):t('equipConfirm'),W/2,dlgY+26);
    ctx.fillStyle='#fff';ctx.font='bold 13px monospace';
    ctx.fillText(tCosName(cosmeticConfirm.item.id),W/2,dlgY+56);
    ctx.fillStyle='#fff6';ctx.font='10px monospace';
    ctx.fillText(isUnequip?t('resetToDefault'):t('equipThisItem'),W/2,dlgY+76);
    const btnW2=90,btnH2=34;
    ctx.fillStyle='#a855f722';rr(W/2-btnW2-6,dlgY+dlgH-48,btnW2,btnH2,8);ctx.fill();
    ctx.strokeStyle='#a855f7';ctx.lineWidth=1.5;rr(W/2-btnW2-6,dlgY+dlgH-48,btnW2,btnH2,8);ctx.stroke();
    ctx.fillStyle='#a855f7';ctx.font='bold 13px monospace';ctx.textAlign='center';
    ctx.fillText('OK',W/2-btnW2/2-6,dlgY+dlgH-26);
    ctx.fillStyle='#ffffff0a';rr(W/2+6,dlgY+dlgH-48,btnW2,btnH2,8);ctx.fill();
    ctx.strokeStyle='#fff4';ctx.lineWidth=1;rr(W/2+6,dlgY+dlgH-48,btnW2,btnH2,8);ctx.stroke();
    ctx.fillStyle='#fff8';ctx.font='bold 13px monospace';
    ctx.fillText(t('cancel'),W/2+btnW2/2+6,dlgY+dlgH-26);
  }
  ctx.restore();
}
