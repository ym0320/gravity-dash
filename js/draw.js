'use strict';
// ===== DRAW =====
function rr(x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

function drawPlatforms(arr,isFloor){
  arr.forEach(p=>{
    if(p.x+p.w<-10||p.x>W+10)return;
    let surfY,y2;
    if(isFloor){surfY=H-p.h;y2=H+10;}
    else{surfY=p.h;y2=-10;}
    // Fill
    const gr=ctx.createLinearGradient(0,isFloor?surfY:y2,0,isFloor?y2:surfY);
    gr.addColorStop(0,tc('gnd'));gr.addColorStop(1,tc('gnd2'));
    ctx.fillStyle=gr;
    ctx.fillRect(p.x,Math.min(surfY,y2),p.w,Math.abs(y2-surfY));
    // Neon edges
    ctx.strokeStyle=tc('line');ctx.lineWidth=2;
    ctx.shadowColor=tc('line');ctx.shadowBlur=8;
    ctx.beginPath();
    // Top/bottom surface line
    ctx.moveTo(p.x,surfY);ctx.lineTo(p.x+p.w,surfY);
    // Side edges
    ctx.moveTo(p.x,surfY);ctx.lineTo(p.x,y2);
    ctx.moveTo(p.x+p.w,surfY);ctx.lineTo(p.x+p.w,y2);
    ctx.stroke();ctx.shadowBlur=0;
  });
}

function drawFloatPlats(){
  floatPlats.forEach(fp=>{
    if(fp.x+fp.w<-10||fp.x>W+10)return;
    // Glowing thin platform
    const gr=ctx.createLinearGradient(fp.x,0,fp.x+fp.w,0);
    gr.addColorStop(0,tca('line',0x44));gr.addColorStop(0.5,tca('line',0x88));gr.addColorStop(1,tca('line',0x44));
    ctx.fillStyle=gr;
    ctx.fillRect(fp.x,fp.y,fp.w,fp.th);
    // Neon top edge
    ctx.strokeStyle=tc('line');ctx.lineWidth=2;
    ctx.shadowColor=tc('line');ctx.shadowBlur=10;
    ctx.beginPath();ctx.moveTo(fp.x,fp.y);ctx.lineTo(fp.x+fp.w,fp.y);ctx.stroke();
    // Bottom edge
    ctx.beginPath();ctx.moveTo(fp.x,fp.y+fp.th);ctx.lineTo(fp.x+fp.w,fp.y+fp.th);ctx.stroke();
    ctx.shadowBlur=0;
    // Side caps
    ctx.strokeStyle=tca('line',0x88);ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(fp.x,fp.y);ctx.lineTo(fp.x,fp.y+fp.th);ctx.stroke();
    ctx.beginPath();ctx.moveTo(fp.x+fp.w,fp.y);ctx.lineTo(fp.x+fp.w,fp.y+fp.th);ctx.stroke();
  });
}

function drawSpikes(){
  spikes.forEach(sp=>{
    if(sp.x+sp.w<-10||sp.x>W+10)return;
    const baseY=sp.h; // floor surface Y position (stored as H-plat.h originally)
    let spikeShow=0; // 0=hidden, 0-1=partial
    if(sp.state==='warning'){
      spikeShow=Math.sin(sp.timer/30*Math.PI*4)*0.15; // pulsing warning
    } else if(sp.state==='up'){
      spikeShow=1;
    } else if(sp.state==='retracting'){
      spikeShow=1-sp.timer/15;
    }
    const sH=sp.spikeH*spikeShow;
    const spikes_n=Math.floor(sp.w/10);
    ctx.save();
    // Always show base slot (visible from right edge as soon as it spawns)
    ctx.fillStyle=tca('obs',0x44);
    ctx.fillRect(sp.x,baseY-3,sp.w,5);
    // Slot lines to show spike positions even when hidden
    if(spikeShow<=0){
      ctx.strokeStyle=tca('obs',0x66);ctx.lineWidth=1;
      for(let i=0;i<spikes_n;i++){
        const sx=sp.x+i*(sp.w/spikes_n)+sp.w/spikes_n/2;
        ctx.beginPath();ctx.moveTo(sx,baseY-2);ctx.lineTo(sx,baseY);ctx.stroke();
      }
      ctx.restore();return;
    }
    // Warning glow on ground
    if(sp.state==='warning'){
      const wa=0.2*Math.abs(Math.sin(sp.timer*0.3));
      ctx.globalAlpha=wa;ctx.fillStyle=tc('obs');
      ctx.fillRect(sp.x,baseY-5,sp.w,5);
      ctx.globalAlpha=1;
    }
    // Draw spike triangles
    for(let i=0;i<spikes_n;i++){
      const sx=sp.x+i*(sp.w/spikes_n);
      const sw=sp.w/spikes_n;
      ctx.fillStyle=tc('obs');
      ctx.beginPath();
      ctx.moveTo(sx,baseY);
      ctx.lineTo(sx+sw/2,baseY-sH);
      ctx.lineTo(sx+sw,baseY);
      ctx.closePath();ctx.fill();
      // Metallic highlight
      ctx.fillStyle='rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(sx+sw*0.3,baseY);
      ctx.lineTo(sx+sw/2,baseY-sH);
      ctx.lineTo(sx+sw*0.5,baseY);
      ctx.closePath();ctx.fill();
    }
    ctx.restore();
  });
}

function drawMovingHills(){
  movingHills.forEach(mh=>{
    if(mh.x+mh.w<-10||mh.x>W+10)return;
    const curH=mh.baseH+Math.sin(mh.phase)*mh.ampH;
    const surfY=H-curH;
    // Draw as elevated terrain block
    const gr=ctx.createLinearGradient(0,surfY,0,H);
    gr.addColorStop(0,tc('gnd'));gr.addColorStop(1,tc('gnd2'));
    ctx.fillStyle=gr;
    ctx.fillRect(mh.x,surfY,mh.w,H-surfY);
    // Neon top edge
    ctx.strokeStyle=tc('line');ctx.lineWidth=2;
    ctx.shadowColor=tc('line');ctx.shadowBlur=8;
    ctx.beginPath();ctx.moveTo(mh.x,surfY);ctx.lineTo(mh.x+mh.w,surfY);ctx.stroke();
    ctx.shadowBlur=0;
    // Arrow indicator (up/down)
    const dir=Math.cos(mh.phase);
    ctx.fillStyle='rgba(255,255,255,0.15)';
    const ax=mh.x+mh.w/2,ay=surfY+15;
    ctx.beginPath();
    if(dir<0){ctx.moveTo(ax-6,ay+6);ctx.lineTo(ax,ay-6);ctx.lineTo(ax+6,ay+6);}
    else{ctx.moveTo(ax-6,ay-6);ctx.lineTo(ax,ay+6);ctx.lineTo(ax+6,ay-6);}
    ctx.closePath();ctx.fill();
  });
}

function drawGravZones(){
  gravZones.forEach(g=>{
    if(g.x+g.w<-10||g.x>W+10)return;
    const alpha=g.fadeT>0?Math.max(0,1-g.fadeT/40):1;
    if(alpha<=0)return;
    ctx.save();ctx.globalAlpha=alpha;
    // Waterfall aura: vertical gradient flowing from ceiling to floor
    const gr=ctx.createLinearGradient(g.x,0,g.x+g.w,0);
    gr.addColorStop(0,'rgba(0,200,255,0)');
    gr.addColorStop(0.3,'rgba(0,200,255,0.12)');
    gr.addColorStop(0.5,'rgba(100,220,255,0.18)');
    gr.addColorStop(0.7,'rgba(0,200,255,0.12)');
    gr.addColorStop(1,'rgba(0,200,255,0)');
    ctx.fillStyle=gr;
    ctx.fillRect(g.x,0,g.w,H);
    // Flowing stream lines (animated)
    const t=frame*0.05;
    ctx.strokeStyle='rgba(100,230,255,'+0.25*alpha+')';
    ctx.lineWidth=1.5;
    for(let i=0;i<4;i++){
      const lx=g.x+g.w*(0.2+i*0.2)+Math.sin(t+i)*3;
      ctx.beginPath();
      for(let y=0;y<H;y+=8){
        const ox=Math.sin(y*0.03+t+i*1.5)*4;
        if(y===0)ctx.moveTo(lx+ox,y);
        else ctx.lineTo(lx+ox,y);
      }
      ctx.stroke();
    }
    // Particles flowing downward/upward
    const flowDir=frame%120<60?1:-1;
    ctx.fillStyle='rgba(150,240,255,'+0.5*alpha+')';
    for(let i=0;i<6;i++){
      const px=g.x+((frame*2+i*40)%Math.max(1,Math.floor(g.w)));
      const py=((frame*3+i*70)*flowDir)%H;
      const ppy=py<0?py+H:py;
      ctx.beginPath();ctx.arc(px,ppy,2+Math.sin(frame*0.1+i)*1,0,6.28);ctx.fill();
    }
    // Arrow indicators showing gravity direction
    const arrowAlpha=0.3+Math.sin(frame*0.08)*0.15;
    ctx.fillStyle='rgba(0,229,255,'+arrowAlpha*alpha+')';
    const cx=g.x+g.w/2;
    for(let i=0;i<3;i++){
      const ay=H*0.25+i*H*0.25+((frame*1.5)%50);
      ctx.beginPath();
      ctx.moveTo(cx-8,ay-8);ctx.lineTo(cx,ay+8);ctx.lineTo(cx+8,ay-8);
      ctx.closePath();ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx-8,ay+8);ctx.lineTo(cx,ay-8);ctx.lineTo(cx+8,ay+8);
      ctx.closePath();ctx.fill();
    }
    ctx.globalAlpha=1;ctx.restore();
  });
}

function drawFallingMtns(){
  fallingMtns.forEach(fm=>{
    if(fm.x+fm.w<-10||fm.x>W+10||fm.state==='gone')return;
    const surfY=H-Math.max(0,fm.curH);
    const shakeOff=fm.state==='shaking'?fm.shakeAmt:0;
    ctx.save();ctx.globalAlpha=fm.alpha;ctx.translate(shakeOff,0);
    const gr=ctx.createLinearGradient(0,surfY,0,H);
    gr.addColorStop(0,tc('gnd'));gr.addColorStop(1,tc('gnd2'));
    ctx.fillStyle=gr;ctx.fillRect(fm.x,surfY,fm.w,H-surfY+10);
    ctx.strokeStyle=tc('line');ctx.lineWidth=2;ctx.shadowColor=tc('line');ctx.shadowBlur=8;
    ctx.beginPath();ctx.moveTo(fm.x,surfY);ctx.lineTo(fm.x+fm.w,surfY);ctx.stroke();ctx.shadowBlur=0;
    if(fm.state==='shaking'){
      const wa=Math.abs(Math.sin(fm.shakeT*0.3));
      ctx.fillStyle='rgba(255,60,60,'+wa*0.3+')';ctx.fillRect(fm.x,surfY,fm.w,6);
      ctx.fillStyle='rgba(255,100,100,'+wa+')';ctx.font='bold 16px monospace';ctx.textAlign='center';
      ctx.fillText('!',fm.x+fm.w/2,surfY-10);
      if(fm.shakeT<30){
        ctx.strokeStyle='rgba(255,100,100,0.5)';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(fm.x+fm.w*0.3,surfY);ctx.lineTo(fm.x+fm.w*0.5,surfY+15);ctx.lineTo(fm.x+fm.w*0.4,surfY+30);ctx.stroke();
      }
    }
    ctx.restore();
  });
}

function drawCoinSwitches(){
  coinSwitches.forEach(cs=>{
    if(cs.x+cs.r<-10||cs.x-cs.r>W+10)return;
    ctx.save();
    if(cs.activated){
      if(cs.flashT>0){
        ctx.globalAlpha=cs.flashT/40;ctx.fillStyle=COIN_SW_COL;ctx.shadowColor=COIN_SW_COL;ctx.shadowBlur=15;
        ctx.beginPath();ctx.arc(cs.x,cs.y,cs.r*1.5,0,6.28);ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;
      }
      ctx.restore();return;
    }
    const pulse2=0.7+Math.sin(frame*0.06)*0.3;
    // Compact round button
    const gr2=ctx.createRadialGradient(cs.x-2,cs.y-2,0,cs.x,cs.y,cs.r);
    gr2.addColorStop(0,'#88ccff');gr2.addColorStop(0.6,'#4488ff');gr2.addColorStop(1,'#2255cc');
    ctx.fillStyle=gr2;ctx.beginPath();ctx.arc(cs.x,cs.y,cs.r,0,6.28);ctx.fill();
    ctx.shadowColor=COIN_SW_COL;ctx.shadowBlur=8*pulse2;ctx.strokeStyle='#aaddff';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(cs.x,cs.y,cs.r,0,6.28);ctx.stroke();ctx.shadowBlur=0;
    ctx.fillStyle='#ffd700';ctx.font='bold 10px monospace';ctx.textAlign='center';
    ctx.fillText('$',cs.x,cs.y+4);
    if(frame%20<10){ctx.fillStyle='rgba(255,215,0,'+pulse2*0.5+')';ctx.beginPath();ctx.arc(cs.x,cs.y-cs.r-4,2,0,6.28);ctx.fill();}
    ctx.restore();
  });
}

function draw(){
  ctx.save();ctx.translate(shakeX,shakeY);
  const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,tc('bg1'));bg.addColorStop(1,tc('bg2'));
  ctx.fillStyle=bg;ctx.fillRect(-20,-20,W+40,H+40);

  stars.forEach(s=>{ctx.globalAlpha=s.a*(0.6+Math.sin(s.tw)*0.4);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.x,s.y,s.sz,0,6.28);ctx.fill();});
  ctx.globalAlpha=1;
  mtns.forEach(m=>{ctx.globalAlpha=m.a;ctx.fillStyle=tc('line');ctx.beginPath();ctx.moveTo(-10,H*0.75);m.pts.forEach(p=>ctx.lineTo(p.x+m.off,H*0.75-p.h));ctx.lineTo(W+510+m.off,H*0.75);ctx.closePath();ctx.fill();});
  ctx.globalAlpha=1;

  // Platforms
  drawPlatforms(platforms,true);
  drawPlatforms(ceilPlats,false);
  drawFloatPlats();
  drawSpikes();
  drawMovingHills();
  drawGravZones();
  drawFallingMtns();
  drawCoinSwitches();

  if(isPackMode)drawAmbient();
  if(state===ST.TITLE){drawDemo();drawTitle();drawCharModal();ctx.restore();return;}
  if(state===ST.STAGE_SEL){drawStageSel();ctx.restore();return;}
  if(state===ST.COUNTDOWN){drawCountdown();ctx.restore();return;}

  // Pack mode: draw stars (stageBigCoins)
  if(isPackMode){
    stageBigCoins.forEach(bc=>{
      if(bc.col||bc.x<-30||bc.x>W+30)return;
      const p=Math.sin(bc.p)*0.15+1,sz=bc.sz*p;
      // Outer glow
      ctx.shadowColor='#ffd700';ctx.shadowBlur=20;
      // Star shape
      ctx.fillStyle='#ffd700';ctx.beginPath();
      for(let i=0;i<5;i++){
        const a=-Math.PI/2+i*Math.PI*2/5;
        const a2=a+Math.PI/5;
        ctx.lineTo(bc.x+Math.cos(a)*sz,bc.y+Math.sin(a)*sz);
        ctx.lineTo(bc.x+Math.cos(a2)*sz*0.45,bc.y+Math.sin(a2)*sz*0.45);
      }
      ctx.closePath();ctx.fill();ctx.shadowBlur=0;
      // Inner highlight
      ctx.fillStyle='rgba(255,255,255,0.5)';ctx.beginPath();ctx.arc(bc.x-sz*0.15,bc.y-sz*0.2,sz*0.3,0,6.28);ctx.fill();
    });
  }

  // Coins & Items
  coins.forEach(drawCoin);
  items.forEach(drawItem);

  // Enemies
  enemies.forEach(en=>{if(en.alive)drawEnemy(en);});

  // Bullets
  bullets.forEach(drawBullet);

  // Trail
  player.trail.forEach(t=>{if(t.a<=0)return;ctx.globalAlpha=t.a*0.15;ctx.fillStyle=CHARS[selChar].col;const s=PLAYER_R*(0.3+t.a*0.5);ctx.beginPath();ctx.arc(t.x,t.y,s,0,6.28);ctx.fill();});
  ctx.globalAlpha=1;

  if(player.alive)drawPlayer();

  parts.forEach(p=>{ctx.globalAlpha=p.life/p.ml;ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(p.x,p.y,p.sz*(p.life/p.ml),0,6.28);ctx.fill();});
  ctx.globalAlpha=1;

  drawChestFall();
  drawUI();
  pops.forEach(p=>{const a=p.life/p.ml;ctx.globalAlpha=a;ctx.fillStyle=p.col;ctx.font='bold 16px monospace';ctx.textAlign='center';ctx.fillText(p.txt,p.x,p.y);});
  ctx.globalAlpha=1;
  if(mileT>0)drawMile();
  // Invincibility rainbow overlay
  if(itemEff.invincible>0&&state===ST.PLAY){
    const invLeft=itemEff.invincible;
    const ending=invLeft<=90; // last 1.5 seconds = warning phase
    const hue=(frame*6)%360;
    if(ending){
      // Big flashing warning - rapid blink that gets faster
      const blinkSpeed=invLeft<30?0.8:invLeft<60?0.5:0.3;
      const blinkAlpha=Math.abs(Math.sin(frame*blinkSpeed));
      ctx.fillStyle=`rgba(255,255,255,${blinkAlpha*0.25})`;ctx.fillRect(-20,-20,W+40,H+40);
      // Shrinking rainbow border
      const borderW=4+invLeft/90*8;
      const borderAlpha=0.3+blinkAlpha*0.3;
      ctx.strokeStyle=`hsla(${hue},100%,60%,${borderAlpha})`;ctx.lineWidth=borderW;
      ctx.strokeRect(-5,-5,W+10,H+10);
      // Warning text flash
      if(invLeft<60&&Math.floor(frame/8)%2===0){
        ctx.save();ctx.globalAlpha=0.6;
        ctx.fillStyle='#fff';ctx.font='bold 18px monospace';ctx.textAlign='center';
        ctx.shadowColor='#ff0000';ctx.shadowBlur=15;
        ctx.fillText('\u7121\u6575\u7d42\u4e86\u9593\u8fd1!',W/2,H*0.15);
        ctx.shadowBlur=0;ctx.restore();
      }
    } else {
      const ra=0.06+Math.sin(frame*0.15)*0.03;
      ctx.fillStyle=`hsla(${hue},100%,60%,${ra})`;ctx.fillRect(-20,-20,W+40,H+40);
      // Rainbow edge glow
      const ew=8+Math.sin(frame*0.2)*4;
      for(let i=0;i<4;i++){
        const eh=(frame*4+i*90)%360;
        ctx.fillStyle=`hsla(${eh},100%,50%,0.15)`;
        if(i===0)ctx.fillRect(-5,-5,W+10,ew);
        else if(i===1)ctx.fillRect(-5,H-ew,-5,ew+10);
        else if(i===2)ctx.fillRect(-5,-5,ew,H+10);
        else ctx.fillRect(W-ew,-5,ew+5,H+10);
      }
    }
    // Sparkle particles in corners (fewer during ending)
    if(frame%(ending?6:3)===0){
      const sx=Math.random()*W,sy=Math.random()<0.5?Math.random()*40:H-Math.random()*40;
      parts.push({x:sx,y:sy,vx:(Math.random()-0.5)*1,vy:(Math.random()-0.5)*1,life:12,ml:12,sz:Math.random()*3+1,col:`hsl(${(frame*8+Math.random()*60)%360},100%,70%)`});
    }
  }
  // Boss alert overlay
  if(bossPhase.active&&bossPhase.prepare>0){
    const t=bossPhase.alertT;
    // Flashing red vignette
    const flash=Math.sin(t*0.3)*0.15+0.15;
    const vg=ctx.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.8);
    vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,`rgba(180,0,0,${flash})`);
    ctx.fillStyle=vg;ctx.fillRect(-20,-20,W+40,H+40);
    // Warning text
    if(t>15){
      const ta=Math.min(1,(t-15)/10)*Math.abs(Math.sin(t*0.12));
      ctx.save();ctx.globalAlpha=ta;
      ctx.fillStyle='#ff3860';ctx.font='bold 42px monospace';ctx.textAlign='center';
      ctx.shadowColor='#ff0000';ctx.shadowBlur=30;
      ctx.fillText('\u26A0 WARNING',W/2,H*0.35);
      ctx.font='bold 18px monospace';ctx.fillStyle='#ff6080';
      ctx.fillText('BOSS \u51FA\u73FE',W/2,H*0.43);
      ctx.shadowBlur=0;ctx.restore();
    }
    // Red scan lines
    if(t%6<3){
      ctx.fillStyle='rgba(255,0,0,0.04)';
      for(let y=0;y<H;y+=4)ctx.fillRect(0,y,W,2);
    }
  }
  // Boss phase UI (enemy count)
  if(bossPhase.active&&bossPhase.prepare<=0&&!bossPhase.reward){
    ctx.fillStyle='#ff3860';ctx.font='bold 13px monospace';ctx.textAlign='center';
    ctx.fillText('\u6575: '+(bossPhase.total-bossPhase.defeated)+' / '+bossPhase.total,W/2,96);
  }
  // Bomb flash overlay
  if(bombFlashT>0&&state===ST.PLAY){
    const ba=bombFlashT/20;
    ctx.fillStyle=`rgba(255,68,0,${ba*0.35})`;ctx.fillRect(-20,-20,W+40,H+40);
    if(bombFlashT>15){ctx.fillStyle=`rgba(255,255,255,${(bombFlashT-15)/5*0.6})`;ctx.fillRect(-20,-20,W+40,H+40);}
  }
  // New highscore golden glow effect
  if(newHiEffT>0&&state===ST.PLAY){
    const na=newHiEffT/120;
    // Golden border
    const bw=3+na*6;
    ctx.strokeStyle=`rgba(255,215,0,${na*0.7})`;ctx.lineWidth=bw;
    ctx.shadowColor='#ffd700';ctx.shadowBlur=20*na;
    ctx.strokeRect(-2,-2,W+4,H+4);ctx.shadowBlur=0;
    // "NEW RECORD" text at top
    if(newHiEffT>80){
      const ta=(newHiEffT-80)/40;
      ctx.save();ctx.globalAlpha=ta;
      ctx.fillStyle='#ffd700';ctx.font='bold 22px monospace';ctx.textAlign='center';
      ctx.shadowColor='#ffd70088';ctx.shadowBlur=15;
      ctx.fillText('\u2605 NEW RECORD! \u2605',W/2,H*0.25);
      ctx.shadowBlur=0;ctx.restore();
    }
  }
  // Bottom action panel
  if(state===ST.PLAY){
    drawActionPanel();
  }
  if(state===ST.DEAD)drawDead();
  if(state===ST.PAUSE)drawPause();
  if(state===ST.STAGE_CLEAR)drawStageClear();
  ctx.restore();
}

function drawCoin(c){
  const p=Math.sin(c.p)*0.2+1,sz=c.sz*p;
  const isPink=score>=PINK_COIN_SCORE;
  const coinCol=isPink?PINK_COIN_COLOR:'#ffd700';
  ctx.shadowColor=isPink?'#ff69b455':'#ffd70055';ctx.shadowBlur=10;ctx.fillStyle=coinCol;ctx.beginPath();ctx.arc(c.x,c.y,sz,0,6.28);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle='rgba(255,255,255,0.4)';ctx.beginPath();ctx.arc(c.x-sz*0.2,c.y-sz*0.2,sz*0.3,0,6.28);ctx.fill();
  if(isPink&&frame%4===0){ctx.fillStyle='#ff69b466';ctx.beginPath();ctx.arc(c.x+(Math.random()-0.5)*sz*2,c.y+(Math.random()-0.5)*sz*2,1+Math.random(),0,6.28);ctx.fill();}
}
function drawItem(it){
  const pl=Math.sin(it.p)*0.15+1,sz=it.sz*pl,col=ITEMS[it.t].col;
  ctx.shadowColor=col+'77';ctx.shadowBlur=16;ctx.fillStyle=col;
  ctx.save();ctx.translate(it.x,it.y);ctx.rotate(Math.PI/4+it.p*0.3);
  rr(-sz/2,-sz/2,sz,sz,3);ctx.fill();ctx.shadowBlur=0;
  ctx.rotate(-(Math.PI/4+it.p*0.3));
  ctx.fillStyle='#fff';ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(ITEMS[it.t].icon,0,1);ctx.textBaseline='alphabetic';ctx.restore();
}

function drawEnemy(en){
  if(en.bossType==='charge'||en.bossType==='dodge'){drawBossCharge(en);return;}
  if(en.bossType==='bruiser'){drawBossBruiser(en);return;}
  if(en.bossType==='wizard'){drawBossWizard(en);return;}
  if(en.type===1){drawShooter(en);return;}
  if(en.type===2){drawFlyer(en);return;}
  if(en.type===3){drawBomber(en);return;}
  if(en.type===4){drawVertMover(en);return;}
  if(en.type===5){drawPhantom(en);return;}
  const s=en.sz,flip=en.gDir;
  ctx.save();ctx.translate(en.x,en.y);
  if(flip===-1)ctx.scale(1,-1);
  // Body (mushroom/goomba shape)
  const gr=ctx.createRadialGradient(0,0,0,0,0,s);
  gr.addColorStop(0,'#a0522d');gr.addColorStop(1,'#6b3410');
  ctx.fillStyle=gr;
  ctx.beginPath();ctx.arc(0,-s*0.15,s*0.85,0,Math.PI*2);ctx.fill();
  // Feet (animated)
  const fw=s*0.3,fh=s*0.2,step=Math.sin(en.fr*2)*s*0.18;
  ctx.fillStyle='#4a2508';
  ctx.fillRect(-s*0.5+step,s*0.4,fw,fh);
  ctx.fillRect(s*0.2-step,s*0.4,fw,fh);
  // Direction indicator for patrol enemies
  if(en.patrolDir!==undefined){
    ctx.fillStyle='#4a2508';
    const arrowX=en.patrolDir>0?s*0.6:-s*0.6;
    ctx.beginPath();ctx.moveTo(arrowX,0);ctx.lineTo(arrowX-en.patrolDir*4,-3);ctx.lineTo(arrowX-en.patrolDir*4,3);ctx.closePath();ctx.fill();
  }
  // Angry eyes
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(-s*0.25,-s*0.25,s*0.22,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.25,-s*0.25,s*0.22,0,6.28);ctx.fill();
  ctx.fillStyle='#1a0a00';
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.28,s*0.12,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.3,-s*0.28,s*0.12,0,6.28);ctx.fill();
  // Angry eyebrows
  ctx.strokeStyle='#4a2508';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(-s*0.45,-s*0.3);ctx.lineTo(-s*0.1,-s*0.48);ctx.stroke();
  ctx.beginPath();ctx.moveTo(s*0.45,-s*0.3);ctx.lineTo(s*0.1,-s*0.48);ctx.stroke();
  ctx.restore();
}
function drawFlyer(en){
  const s=en.sz;
  ctx.save();ctx.translate(en.x,en.y);
  // Body (orange flying enemy)
  const gr=ctx.createRadialGradient(0,0,0,0,0,s);
  gr.addColorStop(0,'#f97316');gr.addColorStop(1,'#c2410c');
  ctx.fillStyle=gr;ctx.shadowColor='#f9731655';ctx.shadowBlur=8;
  ctx.beginPath();ctx.arc(0,0,s*0.8,0,6.28);ctx.fill();ctx.shadowBlur=0;
  // Wings (animated flapping)
  const wf=Math.sin(en.fr*1.2)*6;
  ctx.fillStyle='#ea580c';
  ctx.beginPath();ctx.moveTo(-s*0.7,0);ctx.quadraticCurveTo(-s-8,-6+wf,-s-3,-14+wf);ctx.quadraticCurveTo(-s*0.5+2,-4,-s*0.7,0);ctx.fill();
  ctx.beginPath();ctx.moveTo(s*0.7,0);ctx.quadraticCurveTo(s+8,-6+wf,s+3,-14+wf);ctx.quadraticCurveTo(s*0.5-2,-4,s*0.7,0);ctx.fill();
  // Eyes
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.15,s*0.2,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.2,-s*0.15,s*0.2,0,6.28);ctx.fill();
  ctx.fillStyle='#1a0a00';
  ctx.beginPath();ctx.arc(-s*0.15,-s*0.18,s*0.1,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.25,-s*0.18,s*0.1,0,6.28);ctx.fill();
  // Angry brows
  ctx.strokeStyle='#c2410c';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(-s*0.4,-s*0.2);ctx.lineTo(-s*0.05,-s*0.38);ctx.stroke();
  ctx.beginPath();ctx.moveTo(s*0.4,-s*0.2);ctx.lineTo(s*0.05,-s*0.38);ctx.stroke();
  ctx.restore();
}
function drawShooter(en){
  const s=en.sz;
  ctx.save();ctx.translate(en.x,en.y);
  if(en.gDir===-1)ctx.scale(1,-1);
  // Spiky armored body
  ctx.fillStyle='#6b21a8';
  ctx.beginPath();
  for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2;const r=i%2===0?s*1.1:s*0.65;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r-s*0.1);}
  ctx.closePath();ctx.fill();
  // Inner body
  const gr=ctx.createRadialGradient(0,-s*0.1,0,0,-s*0.1,s*0.7);
  gr.addColorStop(0,'#9333ea');gr.addColorStop(1,'#581c87');
  ctx.fillStyle=gr;
  ctx.beginPath();ctx.arc(0,-s*0.1,s*0.6,0,6.28);ctx.fill();
  // Cannon barrel pointing left
  ctx.fillStyle='#4a1080';
  ctx.fillRect(-s*1.1,-s*0.15,s*0.6,s*0.3);
  // Single glowing eye
  ctx.fillStyle='#fbbf24';ctx.shadowColor='#fbbf24';ctx.shadowBlur=8;
  ctx.beginPath();ctx.arc(0,-s*0.2,s*0.28,0,6.28);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle='#1a0a00';
  ctx.beginPath();ctx.arc(s*0.05,-s*0.22,s*0.13,0,6.28);ctx.fill();
  // Cannon muzzle flash when about to shoot
  if(en.shootT<30){
    ctx.globalAlpha=0.5+Math.sin(en.fr*3)*0.5;
    ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(-s*1.1,0,s*0.25,0,6.28);ctx.fill();
    ctx.globalAlpha=1;
  }
  ctx.restore();
}
function drawBomber(en){
  const s=en.sz,t=en.fr;
  ctx.save();ctx.translate(en.x,en.y);
  // Body (green armored turtle-like)
  const gr=ctx.createRadialGradient(0,0,0,0,0,s);
  gr.addColorStop(0,'#22c55e');gr.addColorStop(1,'#166534');
  ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,-s*0.1,s*0.85,0,6.28);ctx.fill();
  // Shell/helmet
  ctx.fillStyle='#15803d';
  ctx.beginPath();ctx.arc(0,-s*0.3,s*0.65,Math.PI,0);ctx.fill();
  ctx.strokeStyle='#0d5a28';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(-s*0.3,-s*0.55);ctx.lineTo(0,-s*0.7);ctx.lineTo(s*0.3,-s*0.55);ctx.stroke();
  // Throwing arm (animated)
  const throwAnim=t<15?Math.sin(t/15*Math.PI):-0.2;
  ctx.strokeStyle='#22c55e';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(-s*0.5,-s*0.1);
  ctx.quadraticCurveTo(-s*0.8,-s*0.5-throwAnim*s*0.8,-s*0.6,-s*0.8-throwAnim*s*0.5);
  ctx.stroke();
  // Bomb in hand (only when about to throw)
  if(en.bombCD<25&&en.bombCD>5){
    ctx.fillStyle='#333';ctx.beginPath();ctx.arc(-s*0.6,-s*0.9,s*0.2,0,6.28);ctx.fill();
    // Fuse spark
    ctx.fillStyle='#ff6600';ctx.beginPath();ctx.arc(-s*0.5,-s*1.05,s*0.08,0,6.28);ctx.fill();
  }
  // Eyes
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.2,s*0.2,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.2,-s*0.2,s*0.2,0,6.28);ctx.fill();
  ctx.fillStyle='#111';
  ctx.beginPath();ctx.arc(-s*0.15,-s*0.22,s*0.1,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.25,-s*0.22,s*0.1,0,6.28);ctx.fill();
  // Mean grin
  ctx.strokeStyle='#0d5a28';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(0,s*0.1,s*0.25,0.2,Math.PI-0.2);ctx.stroke();
  // Feet
  const step=Math.sin(t*0.08)*s*0.08;
  ctx.fillStyle='#166534';
  ctx.fillRect(-s*0.45+step,s*0.45,s*0.25,s*0.15);
  ctx.fillRect(s*0.2-step,s*0.45,s*0.25,s*0.15);
  ctx.restore();
}
function drawVertMover(en){
  const s=en.sz;
  ctx.save();ctx.translate(en.x,en.y);
  // Body (blue-purple bouncing slime)
  const squash=en.pauseT>0?1.2:0.9+Math.abs(Math.sin(en.fr*0.15))*0.2;
  ctx.scale(1/squash,squash);
  const gr=ctx.createRadialGradient(0,0,0,0,0,s);
  gr.addColorStop(0,'#4488ff');gr.addColorStop(1,'#2244aa');
  ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,s*0.9,0,6.28);ctx.fill();
  // Arrow indicator showing movement direction
  ctx.fillStyle='#fff5';
  const arrowY=en.moveDir<0?-s*0.5:s*0.5;
  ctx.beginPath();ctx.moveTo(-s*0.3,arrowY);ctx.lineTo(0,arrowY+en.moveDir*(-s*0.4));ctx.lineTo(s*0.3,arrowY);ctx.closePath();ctx.fill();
  // Eyes
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.15,s*0.2,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.2,-s*0.15,s*0.2,0,6.28);ctx.fill();
  ctx.fillStyle='#111';
  const eyeOff=en.moveDir<0?-s*0.06:s*0.06;
  ctx.beginPath();ctx.arc(-s*0.15,-s*0.15+eyeOff,s*0.1,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.25,-s*0.15+eyeOff,s*0.1,0,6.28);ctx.fill();
  ctx.restore();
}
function drawPhantom(en){
  const s=en.sz;
  // Calculate alpha based on visibility state - nearly invisible when hidden
  let alpha=1;
  if(!en.visible){
    alpha=en.fadeT>0?en.fadeT/20*0.95:0.03; // barely visible when transparent
  } else if(en.fadeT>0){
    alpha=0.03+(1-en.fadeT/20)*0.97; // fade in from nearly invisible
  }
  ctx.save();ctx.translate(en.x,en.y);
  ctx.globalAlpha=alpha;
  // Ghost-like wispy body
  const wobble=Math.sin(en.fr*0.1)*s*0.1;
  ctx.fillStyle='#88ddff';ctx.shadowColor='#88ddff';ctx.shadowBlur=12;
  ctx.beginPath();
  ctx.moveTo(-s*0.7,-s*0.3);
  ctx.quadraticCurveTo(-s*0.8,-s*0.8,0,-s*0.9);
  ctx.quadraticCurveTo(s*0.8,-s*0.8,s*0.7,-s*0.3);
  ctx.quadraticCurveTo(s*0.8,s*0.3,s*0.5+wobble,s*0.8);
  ctx.quadraticCurveTo(s*0.2,s*0.5,0,s*0.7+wobble*0.5);
  ctx.quadraticCurveTo(-s*0.2,s*0.5,-s*0.5-wobble,s*0.8);
  ctx.quadraticCurveTo(-s*0.8,s*0.3,-s*0.7,-s*0.3);
  ctx.closePath();ctx.fill();ctx.shadowBlur=0;
  // Inner glow
  ctx.fillStyle='rgba(200,240,255,0.3)';
  ctx.beginPath();ctx.arc(0,-s*0.2,s*0.4,0,6.28);ctx.fill();
  // Eyes (glowing)
  ctx.fillStyle=en.visible?'#fff':'#fff4';
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.3,s*0.18,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.2,-s*0.3,s*0.18,0,6.28);ctx.fill();
  ctx.fillStyle=en.visible?'#4400aa':'#4400aa44';
  ctx.beginPath();ctx.arc(-s*0.15,-s*0.32,s*0.1,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.25,-s*0.32,s*0.1,0,6.28);ctx.fill();
  ctx.globalAlpha=1;
  ctx.restore();
}
function drawBullet(b){
  ctx.save();ctx.translate(b.x,b.y);
  if(b.bomb){
    // Bomb projectile
    ctx.fillStyle='#333';ctx.beginPath();ctx.arc(0,0,b.sz,0,6.28);ctx.fill();
    ctx.fillStyle='#555';ctx.beginPath();ctx.arc(-b.sz*0.2,-b.sz*0.2,b.sz*0.4,0,6.28);ctx.fill();
    // Fuse
    ctx.strokeStyle='#aa8800';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(0,-b.sz);ctx.quadraticCurveTo(b.sz*0.5,-b.sz*1.5,b.sz*0.3,-b.sz*1.8);ctx.stroke();
    // Spark
    ctx.fillStyle='#ff6600';ctx.shadowColor='#ff6600';ctx.shadowBlur=6;
    ctx.beginPath();ctx.arc(b.sz*0.3,-b.sz*1.8,2+Math.random()*2,0,6.28);ctx.fill();
    ctx.shadowBlur=0;
  } else if(b.wizBullet){
    // Wizard magic bullet - purple energy orb
    ctx.shadowColor='#aa44ff';ctx.shadowBlur=10;
    ctx.fillStyle='#aa44ff';ctx.beginPath();ctx.arc(0,0,b.sz,0,6.28);ctx.fill();
    ctx.fillStyle='#eeccff';ctx.beginPath();ctx.arc(0,0,b.sz*0.4,0,6.28);ctx.fill();
    ctx.shadowBlur=0;
  } else {
    ctx.shadowColor='#ef4444';ctx.shadowBlur=10;
    ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(0,0,b.sz,0,6.28);ctx.fill();
    ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.arc(0,0,b.sz*0.5,0,6.28);ctx.fill();
    ctx.shadowBlur=0;
    // Trail behind bullet (in direction of travel)
    ctx.fillStyle='#ef444444';
    ctx.beginPath();ctx.arc(b.sz+4,0,b.sz*0.6,0,6.28);ctx.fill();
    ctx.beginPath();ctx.arc(b.sz+10,0,b.sz*0.3,0,6.28);ctx.fill();
  }
  ctx.restore();
}

function drawCharacter(x,y,charIdx,r,rot,alpha,face,dmgLevel){
  dmgLevel=dmgLevel||0; // 0=full HP, 1=hurt once, 2=critical
  const ch=CHARS[charIdx];
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.globalAlpha=alpha;
  const gr=ctx.createRadialGradient(0,0,0,0,0,r);
  // Desaturate color with damage
  if(dmgLevel>=2){gr.addColorStop(0,'#888');gr.addColorStop(1,'#555');}
  else if(dmgLevel===1){gr.addColorStop(0,ch.col);gr.addColorStop(1,'#666');}
  else{gr.addColorStop(0,ch.col);gr.addColorStop(1,ch.col2);}

  switch(ch.shape){
    case'cube':
      ctx.fillStyle=gr;rr(-r,-r,r*2,r*2,r*0.3);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.12)';rr(-r*0.75,-r*0.75,r*1.5,r*1.5,r*0.2);ctx.fill();
      break;
    case'ball':
      ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,r,0,6.28);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.15)';ctx.beginPath();ctx.arc(-r*0.2,-r*0.2,r*0.6,0,6.28);ctx.fill();
      break;
    case'tire':
      // Outer tire ring
      ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,r,0,6.28);ctx.fill();
      // Inner hub (lighter)
      ctx.fillStyle=dmgLevel>=2?'#666':'#888';
      ctx.beginPath();ctx.arc(0,0,r*0.5,0,6.28);ctx.fill();
      // Tread pattern (rotating)
      ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=r*0.12;
      for(let i=0;i<6;i++){
        const ta=rot+i*Math.PI/3;
        ctx.beginPath();ctx.moveTo(Math.cos(ta)*r*0.55,Math.sin(ta)*r*0.55);
        ctx.lineTo(Math.cos(ta)*r*0.92,Math.sin(ta)*r*0.92);ctx.stroke();
      }
      // Hub cap highlight
      ctx.fillStyle='rgba(255,255,255,0.1)';ctx.beginPath();ctx.arc(-r*0.15,-r*0.15,r*0.25,0,6.28);ctx.fill();
      break;
    case'ghost':
      ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,-r*0.15,r,Math.PI,0);
      ctx.lineTo(r,r);
      for(let i=0;i<4;i++){const bx=r-i*(r*2/4)-r*2/8;ctx.quadraticCurveTo(bx+r/8,r-r*0.35,bx-r/8,r);}
      ctx.closePath();ctx.fill();
      break;
    case'ninja':
      ctx.fillStyle=gr;rr(-r,-r,r*2,r*2,r*0.25);ctx.fill();
      // headband
      ctx.fillStyle='#1a1a1a';ctx.fillRect(-r*1.1,-r*0.1,r*2.2,r*0.35);
      // tail
      ctx.strokeStyle='#1a1a1a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r*0.8,-r*0.1);ctx.quadraticCurveTo(r*1.4,-r*0.5,r*1.6,-r*0.8);ctx.stroke();
      break;
    case'stone':
      // Rocky angular shape
      ctx.fillStyle=gr;
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

  // Face
  const eY=face==='dead'?0:-r*0.15;
  if(face==='dead'){
    ctx.strokeStyle=ch.eye;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(r*0.05,eY-r*0.15);ctx.lineTo(r*0.35,eY+r*0.15);ctx.stroke();
    ctx.beginPath();ctx.moveTo(r*0.35,eY-r*0.15);ctx.lineTo(r*0.05,eY+r*0.15);ctx.stroke();
  }else{
    ctx.fillStyle=ch.eye;ctx.beginPath();ctx.arc(r*0.2,eY,r*0.28,0,6.28);ctx.fill();
    ctx.fillStyle=ch.pupil;ctx.beginPath();ctx.arc(r*0.28,eY,r*0.14,0,6.28);ctx.fill();
    ctx.fillStyle=ch.eye;ctx.beginPath();ctx.arc(r*0.33,eY-r*0.1,r*0.06,0,6.28);ctx.fill();
    if(face==='happy'){ctx.strokeStyle=ch.eye;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(r*0.15,eY+r*0.3,r*0.15,0.2,Math.PI-0.2);ctx.stroke();}
    if(face==='hurt'){
      // Grimace mouth
      ctx.strokeStyle=ch.eye;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(-r*0.1,eY+r*0.4);
      ctx.lineTo(r*0.05,eY+r*0.3);ctx.lineTo(r*0.2,eY+r*0.45);ctx.lineTo(r*0.35,eY+r*0.3);
      ctx.stroke();
    }
  }

  // Damage overlays (scratches, cracks, soot)
  if(dmgLevel>=1){
    ctx.strokeStyle='rgba(60,20,0,0.5)';ctx.lineWidth=1.5;ctx.lineCap='round';
    // Scratch 1
    ctx.beginPath();ctx.moveTo(-r*0.6,-r*0.3);ctx.lineTo(-r*0.1,r*0.2);ctx.stroke();
    // Scratch 2
    ctx.beginPath();ctx.moveTo(r*0.2,-r*0.5);ctx.lineTo(r*0.5,r*0.1);ctx.stroke();
    // Soot marks
    ctx.fillStyle='rgba(40,20,10,0.2)';
    ctx.beginPath();ctx.arc(-r*0.3,r*0.3,r*0.2,0,6.28);ctx.fill();
  }
  if(dmgLevel>=2){
    ctx.strokeStyle='rgba(80,10,0,0.6)';ctx.lineWidth=2;
    // Big crack
    ctx.beginPath();ctx.moveTo(-r*0.2,-r*0.8);ctx.lineTo(-r*0.05,-r*0.3);
    ctx.lineTo(r*0.2,-r*0.45);ctx.lineTo(r*0.1,0);
    ctx.lineTo(r*0.35,r*0.2);ctx.stroke();
    // More soot
    ctx.fillStyle='rgba(40,20,10,0.3)';
    ctx.beginPath();ctx.arc(r*0.4,-r*0.2,r*0.25,0,6.28);ctx.fill();
    ctx.beginPath();ctx.arc(-r*0.5,r*0.1,r*0.18,0,6.28);ctx.fill();
    // Bandage
    ctx.strokeStyle='rgba(255,255,220,0.6)';ctx.lineWidth=r*0.15;
    ctx.beginPath();ctx.moveTo(-r*0.7,r*0.05);ctx.lineTo(-r*0.3,r*0.05);ctx.stroke();
    ctx.strokeStyle='rgba(200,50,50,0.4)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(-r*0.6,r*0.0);ctx.lineTo(-r*0.6,r*0.1);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-r*0.4,r*0.0);ctx.lineTo(-r*0.4,r*0.1);ctx.stroke();
  }

  ctx.restore();
}

function drawPlayer(){
  const pr=PLAYER_R*ct().sizeMul;
  // Flashing during hurt invincibility
  if(hurtT>0&&Math.floor(hurtT/4)%2===0)return; // blink effect
  let ghostA=1;
  if(hurtT>0)ghostA*=0.7; // slightly transparent during hurt
  // Ghost character transparency phase - visually show the evasion state
  if(ghostInvis){
    ghostA*=0.15+Math.sin(frame*0.3)*0.05; // very transparent + shimmer
  }
  const dmgLv=maxHp()-hp; // 0=full, 1=hurt once, 2=critical

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
    ctx.shadowColor=ic;ctx.shadowBlur=ending?6:12;
    ctx.beginPath();ctx.arc(player.x,player.y,pr+(ending?6+Math.sin(frame*0.6)*4:12),0,6.28);ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=1;
  }
  // Gravity arrow
  ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=2;ctx.lineCap='round';
  const ay=player.gDir===1?pr+6:-pr-6,ad=player.gDir;
  ctx.beginPath();ctx.moveTo(player.x-5,player.y+ay-3*ad);ctx.lineTo(player.x,player.y+ay+3*ad);ctx.lineTo(player.x+5,player.y+ay-3*ad);ctx.stroke();
  ctx.lineCap='butt';

  // Ghost character: always draw upright (don't flip body when gravity reverses)
  const charRot=ct().shape==='ghost'?0:player.rot;
  drawCharacter(player.x,player.y,selChar,pr,charRot,ghostA,player.face,dmgLv);
}

function drawHeart(cx,cy,sz,filled){
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
    ctx.fillStyle='#ff3860';ctx.shadowColor='#ff386066';ctx.shadowBlur=6;ctx.fill();ctx.shadowBlur=0;
    // Highlight
    ctx.fillStyle='rgba(255,255,255,0.3)';
    ctx.beginPath();ctx.arc(-s*0.35,-s*0.35,s*0.2,0,6.28);ctx.fill();
  } else {
    ctx.fillStyle='rgba(255,56,96,0.12)';ctx.fill();
    ctx.strokeStyle='#ff386044';ctx.lineWidth=1.5;ctx.stroke();
  }
  ctx.restore();
}
function drawUI(){
  // === TOP-LEFT: HP hearts (large, prominent) ===
  const hpY=safeTop+18;
  for(let i=0;i<maxHp();i++){
    const hx=10+i*34;
    drawHeart(hx+14,hpY,28,i<hp);
  }

  // === TOP: Pack mode stage info (below HP) ===
  if(isPackMode&&currentPackStage){
    const packTop=hpY+22;
    const prog=Math.min(1,dist/currentPackStage.dist);
    ctx.fillStyle='#ffffff15';ctx.fillRect(0,2,W,4);
    ctx.fillStyle=tc('ply');ctx.shadowColor=tc('ply');ctx.shadowBlur=6;ctx.fillRect(0,2,W*prog,4);ctx.shadowBlur=0;
    const pname=STAGE_PACKS[currentPackIdx].name+' '+currentPackStage.name;
    ctx.fillStyle='#ffd700';ctx.font='bold 14px monospace';ctx.textAlign='left';
    ctx.fillText(pname,10,packTop);
    ctx.fillStyle='#fff8';ctx.font='11px monospace';
    ctx.fillText(Math.floor(dist)+'m / '+currentPackStage.dist+'m',10,packTop+16);
    // Stars collected indicator
    ctx.textAlign='left';
    for(let i=0;i<3;i++){
      const collected=i<stageBigCollected;
      ctx.fillStyle=collected?'#ffd700':'#ffffff22';ctx.font='bold 16px monospace';
      ctx.fillText('\u2605',10+i*20,packTop+34);
    }
  }

  // Combo display (center area)
  if(comboDspT>0&&comboDsp>1){
    const a=comboDspT/55,sc=1+(1-a)*0.25;
    ctx.globalAlpha=a;ctx.save();ctx.translate(W/2,96);ctx.scale(sc,sc);
    ctx.fillStyle='#ff6b35';ctx.font='bold 20px monospace';ctx.textAlign='center';
    ctx.fillText(comboDsp+'x \u30B3\u30F3\u30DC',0,0);ctx.restore();ctx.globalAlpha=1;
  }

  // Pause button (top right, matching hitPauseBtn area)
  const pauseX=W-54,pauseY=safeTop+12,pauseBW=48,pauseBH=40;
  ctx.fillStyle='#ffffff1a';rr(pauseX,pauseY,pauseBW,pauseBH,8);ctx.fill();
  ctx.strokeStyle='#ffffff18';ctx.lineWidth=1;rr(pauseX,pauseY,pauseBW,pauseBH,8);ctx.stroke();
  ctx.fillStyle='#fffa';ctx.fillRect(pauseX+14,pauseY+8,6,24);ctx.fillRect(pauseX+28,pauseY+8,6,24);

  // === BOTTOM AREA (above action panel) ===
  const panelTop=H-PANEL_H;

  // Speed and coins are shown in drawActionPanel (right side of panel)

  // Active item bars (bottom-right, above action panel)
  const activeItems=[];
  if(itemEff.invincible>0)activeItems.push({n:'\u7121\u6575',c:'#ff00ff',t:itemEff.invincible,m:600});
  if(itemEff.magnet>0)activeItems.push({n:'\u5438\u53CE',c:'#f59e0b',t:itemEff.magnet,m:600});
  if(djumpAvailable&&!djumpUsed&&ct().hasDjump)activeItems.push({n:'2\u6BB5\u30B8\u30E3\u30F3\u30D7',c:'#ffaa00',t:1,m:1});

  activeItems.forEach((d,i)=>{
    const y=panelTop-10-i*18,x=W-8,bw=50,r=d.t/d.m;
    ctx.textAlign='right';ctx.fillStyle=d.c;ctx.font='bold 9px monospace';ctx.fillText(d.n,x-bw-4,y+3);
    ctx.fillStyle='#ffffff12';rr(x-bw,y-3,bw,7,3);ctx.fill();
    ctx.fillStyle=d.c;rr(x-bw,y-3,bw*r,7,3);ctx.fill();
    if(d.t<60){ctx.globalAlpha=Math.sin(frame*0.2)*0.5+0.5;ctx.fillStyle=d.c;rr(x-bw,y-3,bw*r,7,3);ctx.fill();ctx.globalAlpha=1;}
  });
}

function drawActionPanel(){
  // Semi-transparent bottom panel for thumb controls
  const py=H-PANEL_H;
  // Panel background
  ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(0,py,W,PANEL_H);
  ctx.fillStyle='rgba(255,255,255,0.06)';ctx.fillRect(0,py,W,1);

  // Item buttons centered in panel
  const btnSz=44,btnGap=12;
  const totalBtnW=btnSz*2+btnGap;
  const btnStartX=W/2-totalBtnW/2;
  const btnY=py+6;
  // Helper to draw an item button
  function drawItemBtn(bx,has,col,icon,count){
    if(has){
      ctx.fillStyle=col+'33';rr(bx,btnY,btnSz,btnSz,10);ctx.fill();
      ctx.strokeStyle=col;ctx.lineWidth=2;rr(bx,btnY,btnSz,btnSz,10);ctx.stroke();
      const pulse=Math.sin(frame*0.1)*0.15+0.85;
      ctx.shadowColor=col;ctx.shadowBlur=8*pulse;
      ctx.strokeStyle=col.slice(0,7)+(Math.round(pulse*128).toString(16).padStart(2,'0'));
      rr(bx,btnY,btnSz,btnSz,10);ctx.stroke();ctx.shadowBlur=0;
    } else {
      ctx.fillStyle='#ffffff0a';rr(bx,btnY,btnSz,btnSz,10);ctx.fill();
      ctx.strokeStyle='#ffffff22';ctx.lineWidth=1;rr(bx,btnY,btnSz,btnSz,10);ctx.stroke();
    }
    ctx.fillStyle=has?'#fff':'#fff3';ctx.font='bold 20px monospace';ctx.textAlign='center';
    ctx.fillText(icon,bx+btnSz/2,btnY+btnSz/2+7);
    if(count>0){
      const badgeX=bx+btnSz-4,badgeY2=btnY+2;
      ctx.fillStyle='#ff3860';ctx.beginPath();ctx.arc(badgeX,badgeY2,9,0,6.28);ctx.fill();
      ctx.fillStyle='#fff';ctx.font='bold 11px monospace';ctx.textAlign='center';
      ctx.fillText(count,badgeX,badgeY2+4);
    }
  }
  // Invincible button (left)
  drawItemBtn(btnStartX,invCount>0,'#ff00ff','\u2605',invCount);
  // Bomb button (right)
  drawItemBtn(btnStartX+btnSz+btnGap,bombCount>0,'#ff4400','\uD83D\uDCA3',bombCount);

  // Score display in panel (left side)
  ctx.fillStyle='#fff';ctx.font='bold 22px monospace';ctx.textAlign='left';
  ctx.fillText(score,12,py+30);
  ctx.fillStyle='#ffd70088';ctx.font='10px monospace';
  ctx.fillText('HI: '+highScore,12,py+44);
  // Speed and coin display (right of score, left of bomb button)
  const infoX=W-btnSz-22;
  ctx.fillStyle='#8899aa';ctx.font='11px monospace';ctx.textAlign='right';
  ctx.fillText('\u901F\u5EA6 '+(speed/SPEED_INIT).toFixed(1),infoX,py+22);
  ctx.fillStyle='#ffd700aa';
  ctx.fillText('\u25CF '+totalCoins,infoX,py+38);
  ctx.textAlign='left';
}

function drawMile(){
  const p=mileT/100;let a,sc;
  if(p>0.85){const t=(p-0.85)/0.15;a=1-t;sc=0.5+a*0.5;}
  else if(p>0.2){a=1;sc=1;}else{a=p/0.2;sc=1+(1-a)*0.25;}
  ctx.save();ctx.globalAlpha=a;ctx.translate(W/2,H*0.5);ctx.scale(sc,sc);
  ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd70077';ctx.shadowBlur=22;
  ctx.font='bold 36px monospace';ctx.textAlign='center';ctx.fillText(mileTxt,0,0);ctx.shadowBlur=0;
  ctx.restore();ctx.globalAlpha=1;
}

function drawDemo(){
  if(!demo.active)return;
  const d=demo,th=THEMES[d.themeIdx],ch=CHARS[d.charIdx];
  const pr=PLAYER_R*ch.sizeMul;
  ctx.save();ctx.globalAlpha=0.35;
  // Floor platforms
  d.plats.forEach(p=>{
    if(p.x+p.w<-10||p.x>W+10)return;
    const sY=H-p.h;
    const gr=ctx.createLinearGradient(0,sY,0,H);
    gr.addColorStop(0,th.gnd);gr.addColorStop(1,th.gnd2||th.gnd);
    ctx.fillStyle=gr;ctx.fillRect(p.x,sY,p.w,p.h);
    ctx.strokeStyle=th.line;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(p.x,sY);ctx.lineTo(p.x+p.w,sY);ctx.stroke();
  });
  // Ceiling platforms
  d.ceilPlats.forEach(p=>{
    if(p.x+p.w<-10||p.x>W+10)return;
    const sY=p.h;
    ctx.fillStyle=th.gnd2||th.gnd;ctx.fillRect(p.x,-10,p.w,sY+10);
    ctx.strokeStyle=th.line;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(p.x,sY);ctx.lineTo(p.x+p.w,sY);ctx.stroke();
  });
  // Coins
  d.coins.forEach(c=>{
    if(c.x<-10||c.x>W+10)return;
    const sc=0.8+Math.sin(c.t)*0.15;
    ctx.fillStyle='#ffd700';ctx.beginPath();ctx.arc(c.x,c.y,c.sz*sc,0,6.28);ctx.fill();
    ctx.fillStyle='#fff4';ctx.beginPath();ctx.arc(c.x-1,c.y-1,c.sz*0.4,0,6.28);ctx.fill();
  });
  // Enemies
  d.enemies.forEach(e=>{
    if(!e.alive||e.x<-20||e.x>W+20)return;
    ctx.fillStyle=th.obs;
    if(e.type===0||e.type===1){
      // Ground walker/cannon: square
      ctx.fillRect(e.x-e.sz,e.y-e.sz,e.sz*2,e.sz*2);
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(e.x+e.sz*0.2,e.y-e.sz*0.2,e.sz*0.3,0,6.28);ctx.fill();
    } else if(e.type===2){
      // Flyer: diamond
      ctx.beginPath();ctx.moveTo(e.x,e.y-e.sz*1.2);ctx.lineTo(e.x+e.sz,e.y);
      ctx.lineTo(e.x,e.y+e.sz*0.6);ctx.lineTo(e.x-e.sz,e.y);ctx.closePath();ctx.fill();
    } else if(e.type===3){
      // Bomber: circle
      ctx.beginPath();ctx.arc(e.x,e.y,e.sz,0,6.28);ctx.fill();
      ctx.fillStyle='#333';ctx.beginPath();ctx.arc(e.x,e.y,e.sz*0.5,0,6.28);ctx.fill();
    } else {
      // Vertical/phantom: triangle
      ctx.beginPath();ctx.moveTo(e.x,e.y-e.sz*1.1);
      ctx.lineTo(e.x+e.sz,e.y+e.sz*0.5);ctx.lineTo(e.x-e.sz,e.y+e.sz*0.5);
      ctx.closePath();ctx.fill();
    }
  });
  // Kill particles
  d.killParts.forEach(p=>{
    const a=p.life/18;
    ctx.globalAlpha=0.35*a;ctx.fillStyle=p.col;
    ctx.beginPath();ctx.arc(p.x,p.y,2+a*2,0,6.28);ctx.fill();
  });
  ctx.globalAlpha=0.35;
  // Trail
  d.trail.forEach(t=>{
    const a=t.life/12;
    ctx.globalAlpha=0.12*a;ctx.fillStyle=ch.col;
    ctx.beginPath();ctx.arc(t.x,t.y,pr*a*0.6,0,6.28);ctx.fill();
  });
  ctx.globalAlpha=0.55;
  // Player
  const dRot=ch.shape==='ghost'?0:d.rot;
  drawCharacter(d.px,d.py,d.charIdx,pr,dRot,0.85,d.face,0);
  // Combo popup
  if(d.comboN>=2&&d.comboT>0){
    ctx.globalAlpha=0.5*(d.comboT/30);
    ctx.fillStyle='#ffd700';ctx.font='bold 14px monospace';ctx.textAlign='center';
    ctx.fillText(d.comboN+' COMBO!',d.px,d.py-pr-15);
  }
  // Demo score display
  ctx.globalAlpha=0.25;ctx.fillStyle='#fff';ctx.font='bold 16px monospace';ctx.textAlign='right';
  ctx.fillText(d.score,W-14,safeTop+24);
  ctx.restore();ctx.globalAlpha=1;
}

function drawTitle(){
  const p=Math.sin(titleT)*0.035+1;
  ctx.save();ctx.translate(W/2,H*0.18);ctx.scale(p,p);
  ctx.shadowColor='#00e5ff44';ctx.shadowBlur=35;ctx.fillStyle='#00e5ff';
  ctx.font='bold 44px monospace';ctx.textAlign='center';ctx.fillText('GRAVITY',0,0);
  ctx.shadowColor='#ff386044';ctx.fillStyle='#ff3860';ctx.fillText('DASH',0,48);ctx.shadowBlur=0;
  ctx.restore();

  ctx.fillStyle='#ffffff33';ctx.font='11px monospace';ctx.textAlign='center';
  ctx.fillText('Gravity-Flip Action Runner',W/2,H*0.18+72);

  // Wallet display
  ctx.fillStyle='#ffd700';ctx.font='bold 13px monospace';ctx.textAlign='center';
  ctx.fillText('\u25CF '+walletCoins,W/2,H*0.38);

  // Character selection: 2 rows x 3 columns
  ctx.fillStyle='#fff8';ctx.font='bold 13px monospace';
  ctx.fillText('\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u9078\u629E',W/2,H*0.42);

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
        ctx.strokeStyle=ch.col;ctx.lineWidth=2;ctx.shadowColor=ch.col;ctx.shadowBlur=8;
        rr(cx-2,cy-2,charW+4,charH+4,8);ctx.stroke();ctx.shadowBlur=0;
      }
      ctx.fillStyle=locked?'#ffffff06':idx===selChar?'#ffffff18':'#ffffff08';
      rr(cx,cy,charW,charH,6);ctx.fill();

      if(locked){
        // Locked: show silhouette and price
        ctx.globalAlpha=0.25;
        drawCharacter(cx+charW/2,cy+charH/2-8,idx,14,0,1,'normal');
        ctx.globalAlpha=1;
        // Lock icon
        ctx.fillStyle='#fff5';ctx.font='bold 16px monospace';ctx.textAlign='center';
        ctx.fillText('\uD83D\uDD12',cx+charW/2,cy+charH/2-4);
        // Price
        ctx.fillStyle='#ffd700';ctx.font='bold 8px monospace';
        ctx.fillText('\u25CF'+ch.price,cx+charW/2,cy+charH-4);
      } else {
        // Unlocked: draw character preview
        drawCharacter(cx+charW/2,cy+charH/2-8,idx,14,0,1,'normal');
        // Name
        ctx.fillStyle=idx===selChar?'#fff':'#fff6';ctx.font='9px monospace';ctx.textAlign='center';
        ctx.fillText(ch.name,cx+charW/2,cy+charH-14);
        // Trait
        ctx.fillStyle=idx===selChar?ch.col:ch.col+'66';ctx.font='7px monospace';
        ctx.fillText(ch.trait,cx+charW/2,cy+charH-4);
      }
    }
  }

  // Long-press hint (below character grid, visible and clear)
  const hintY=gridY+rows*(charH+charGap)+8;
  ctx.fillStyle='#fff5';ctx.font='10px monospace';ctx.textAlign='center';
  ctx.fillText('\u9577\u62BC\u3057\u3067\u30AD\u30E3\u30E9\u8A73\u7D30\u8868\u793A',W/2,hintY);

  // Mode selection buttons (2 buttons: Endless, Stage)
  const btnW=W*0.35,btnH=38,btnGap=12;
  const totalBtnW=btnW*2+btnGap;
  const btnStartX=W/2-totalBtnW/2;
  const btnY=H*0.82;

  // Stats panel (between character grid and mode buttons)
  const statsY=hintY+16;
  if(highScore>0||played>0){
    const statsPanelH=highScore>0&&played>0?36:22;
    ctx.fillStyle='rgba(0,0,0,0.35)';rr(W/2-100,statsY,200,statsPanelH,8);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=1;rr(W/2-100,statsY,200,statsPanelH,8);ctx.stroke();
  }
  if(highScore>0){ctx.fillStyle='#ffd700';ctx.font='bold 13px monospace';ctx.textAlign='center';ctx.fillText('\u30D9\u30B9\u30C8: '+highScore,W/2,statsY+16);}
  if(played>0){ctx.fillStyle='#fff3';ctx.font='11px monospace';ctx.fillText('\u30D7\u30EC\u30A4\u56DE\u6570: '+played,W/2,statsY+(highScore>0?32:16));}

  // Endless mode button
  const ebx=btnStartX;
  ctx.fillStyle='#00e5ff22';rr(ebx,btnY,btnW,btnH,8);ctx.fill();
  ctx.strokeStyle='#00e5ff';ctx.lineWidth=1.5;rr(ebx,btnY,btnW,btnH,8);ctx.stroke();
  ctx.fillStyle='#00e5ff';ctx.font='bold 13px monospace';ctx.textAlign='center';
  ctx.fillText('エンドレス',ebx+btnW/2,btnY+24);
  // Stage mode button
  const sbx=btnStartX+btnW+btnGap;
  ctx.fillStyle='#ffd70022';rr(sbx,btnY,btnW,btnH,8);ctx.fill();
  ctx.strokeStyle='#ffd700';ctx.lineWidth=1.5;rr(sbx,btnY,btnW,btnH,8);ctx.stroke();
  ctx.fillStyle='#ffd700';ctx.font='bold 13px monospace';
  ctx.fillText('ステージ',sbx+btnW/2,btnY+24);
  const ts=getTotalStars();
  if(ts>0){ctx.fillStyle='#ffd700aa';ctx.font='9px monospace';ctx.fillText('★'+ts,sbx+btnW/2,btnY+36);}

  ctx.fillStyle='#667';ctx.font='10px monospace';ctx.textAlign='center';
  ctx.fillText('\u30BF\u30C3\u30D7=\u30B8\u30E3\u30F3\u30D7 / \u30B9\u30EF\u30A4\u30D7=\u91CD\u529B\u53CD\u8EE2',W/2,H*0.93);

  // Settings gear button (top right)
  ctx.fillStyle='#ffffff14';rr(W-44,safeTop+6,36,36,8);ctx.fill();
  ctx.fillStyle='#fff6';ctx.font='18px monospace';ctx.textAlign='center';
  ctx.fillText('\u2699',W-26,safeTop+30);

  // Settings panel overlay
  if(settingsOpen){
    ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(0,0,W,H);
    const pw=Math.min(280,W-30),ph=200,px=W/2-pw/2,py=H/2-ph/2;
    const panGr=ctx.createLinearGradient(px,py,px,py+ph);
    panGr.addColorStop(0,'rgba(15,15,40,0.97)');panGr.addColorStop(1,'rgba(8,8,25,0.97)');
    ctx.fillStyle=panGr;rr(px,py,pw,ph,14);ctx.fill();
    ctx.strokeStyle='#00e5ff44';ctx.lineWidth=1.5;rr(px,py,pw,ph,14);ctx.stroke();
    // Title
    ctx.fillStyle='#fff';ctx.font='bold 16px monospace';ctx.textAlign='center';
    ctx.fillText('\u8A2D\u5B9A',W/2,py+28);
    // BGM volume slider
    const slW=pw-50,slX=px+25,slY1=py+52;
    ctx.fillStyle='#fff8';ctx.font='11px monospace';ctx.textAlign='left';
    ctx.fillText('BGM',slX,slY1);
    const barX=slX+42,barW=slW-42,barY=slY1-8,barH=10;
    ctx.fillStyle='#ffffff12';rr(barX,barY,barW,barH,5);ctx.fill();
    ctx.fillStyle='#00e5ff';rr(barX,barY,barW*bgmVol,barH,5);ctx.fill();
    // Knob
    const knobX=barX+barW*bgmVol;
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(knobX,barY+barH/2,7,0,6.28);ctx.fill();
    ctx.fillStyle='#00e5ff';ctx.beginPath();ctx.arc(knobX,barY+barH/2,5,0,6.28);ctx.fill();
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
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(knobX2,barY2+barH/2,7,0,6.28);ctx.fill();
    ctx.fillStyle='#ff8600';ctx.beginPath();ctx.arc(knobX2,barY2+barH/2,5,0,6.28);ctx.fill();
    ctx.fillStyle='#fff6';ctx.font='10px monospace';ctx.textAlign='right';
    ctx.fillText(Math.round(sfxVol*100)+'%',slX+slW,slY2);
    // Close button
    const closeY=py+ph-42;
    ctx.fillStyle='#00e5ff22';rr(W/2-60,closeY,120,32,8);ctx.fill();
    ctx.strokeStyle='#00e5ff';ctx.lineWidth=1;rr(W/2-60,closeY,120,32,8);ctx.stroke();
    ctx.fillStyle='#00e5ff';ctx.font='bold 13px monospace';ctx.textAlign='center';
    ctx.fillText('\u9589\u3058\u308B',W/2,closeY+22);
  }

  // Character unlock celebration overlay
  if(unlockCelebT>0&&unlockCelebChar>=0){
    const ch=CHARS[unlockCelebChar];
    const p=unlockCelebT/120; // 1→0
    const fadeIn=Math.min(1,(120-unlockCelebT)/15);
    const fadeOut=unlockCelebT<20?unlockCelebT/20:1;
    const a=fadeIn*fadeOut;
    ctx.save();ctx.globalAlpha=a;
    // Dark overlay
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,H);
    // Radial burst lines
    const burstA=p*Math.PI*2;
    ctx.strokeStyle=ch.col+'44';ctx.lineWidth=2;
    for(let i=0;i<12;i++){
      const ba=burstA+i*(Math.PI/6);
      const r1=40+((1-p)*60);const r2=r1+60;
      ctx.beginPath();ctx.moveTo(W/2+Math.cos(ba)*r1,H*0.42+Math.sin(ba)*r1);
      ctx.lineTo(W/2+Math.cos(ba)*r2,H*0.42+Math.sin(ba)*r2);ctx.stroke();
    }
    // Character big
    const sc=1.5+Math.sin((120-unlockCelebT)*0.15)*0.15;
    ctx.save();ctx.translate(W/2,H*0.42);ctx.scale(sc,sc);
    drawCharacter(0,0,unlockCelebChar,22,0,1,'happy');
    ctx.restore();
    // Sparkle particles
    for(let i=0;i<8;i++){
      const sa=(120-unlockCelebT)*0.08+i*0.785;
      const sr=50+Math.sin(sa*3)*15+((120-unlockCelebT)*0.5);
      const sx=W/2+Math.cos(sa)*sr,sy=H*0.42+Math.sin(sa)*sr;
      ctx.fillStyle=i%2===0?'#ffd700':ch.col;
      ctx.beginPath();ctx.arc(sx,sy,3+Math.sin(sa*5),0,6.28);ctx.fill();
    }
    // Text
    ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd70088';ctx.shadowBlur=20;
    ctx.font='bold 22px monospace';ctx.textAlign='center';
    ctx.fillText('\u30B2\u30C3\u30C8\uFF01',W/2,H*0.55);ctx.shadowBlur=0;
    ctx.fillStyle='#fff';ctx.font='bold 18px monospace';
    ctx.fillText(ch.name,W/2,H*0.60);
    ctx.fillStyle=ch.col;ctx.font='13px monospace';
    ctx.fillText(ch.trait+' - '+ch.desc,W/2,H*0.64);
    ctx.restore();ctx.globalAlpha=1;
  }
}

function drawCharModal(){
  if(!charModal.show)return;
  const ch=CHARS[charModal.idx],t=charModal.animT;
  // Dark overlay
  ctx.fillStyle='rgba(0,0,0,0.78)';ctx.fillRect(0,0,W,H);
  // Modal panel
  const mw=Math.min(W*0.85,320),mh=H*0.58,mx=W/2-mw/2,my=H/2-mh/2;
  const panelGr=ctx.createLinearGradient(mx,my,mx,my+mh);
  panelGr.addColorStop(0,'rgba(15,15,40,0.97)');panelGr.addColorStop(1,'rgba(8,8,25,0.97)');
  ctx.fillStyle=panelGr;rr(mx,my,mw,mh,16);ctx.fill();
  ctx.strokeStyle=ch.col+'66';ctx.lineWidth=2;rr(mx,my,mw,mh,16);ctx.stroke();
  // Glow border accent
  ctx.shadowColor=ch.col+'44';ctx.shadowBlur=20;rr(mx,my,mw,mh,16);ctx.stroke();ctx.shadowBlur=0;
  // Character name
  ctx.fillStyle=ch.col;ctx.font='bold 22px monospace';ctx.textAlign='center';
  ctx.fillText(ch.name,W/2,my+34);
  // Trait badge
  ctx.fillStyle=ch.col+'22';rr(W/2-50,my+40,100,20,10);ctx.fill();
  ctx.fillStyle=ch.col;ctx.font='bold 11px monospace';
  ctx.fillText(ch.trait,W/2,my+54);
  // Animated character demo area
  const demoY=my+mh*0.35;
  const bob=Math.sin(t*0.06)*6;
  const rot=Math.sin(t*0.025)*0.08;
  // Demo background circle
  ctx.fillStyle=ch.col+'0a';ctx.beginPath();ctx.arc(W/2,demoY,48,0,6.28);ctx.fill();
  ctx.strokeStyle=ch.col+'22';ctx.lineWidth=1;ctx.beginPath();ctx.arc(W/2,demoY,48,0,6.28);ctx.stroke();
  // Draw character large with animation
  drawCharacter(W/2,demoY+bob,charModal.idx,32,rot,1,'normal');
  // Trait-specific animated demo effects
  drawTraitDemo(ch,charModal.idx,W/2,demoY,t);
  // Description
  ctx.fillStyle='#fff9';ctx.font='12px monospace';ctx.textAlign='center';
  ctx.fillText(ch.desc,W/2,demoY+58);
  // Stats bars
  const barX=mx+20,barY=demoY+72,barW=mw-40,barH=14,gap=20;
  const stats=[
    {name:'\u30B8\u30E3\u30F3\u30D7',val:ch.jumpMul,max:1.5,col:'#00e5ff'},
    {name:'\u30B9\u30D4\u30FC\u30C9',val:ch.speedMul,max:1.2,col:'#34d399'},
    {name:'\u30B5\u30A4\u30BA',val:2-ch.sizeMul,max:1.5,col:'#a855f7'},
    {name:'\u30B3\u30A4\u30F3',val:ch.coinMul,max:1.5,col:'#ffd700'},
  ];
  stats.forEach((s,i)=>{
    const sy=barY+i*gap;
    ctx.fillStyle='#fff6';ctx.font='9px monospace';ctx.textAlign='left';
    ctx.fillText(s.name,barX,sy+10);
    const bx=barX+52,bw=barW-52;
    ctx.fillStyle='#ffffff10';rr(bx,sy,bw,barH,4);ctx.fill();
    const r=Math.min(s.val/s.max,1);
    ctx.fillStyle=s.col+'88';rr(bx,sy,bw*r,barH,4);ctx.fill();
    ctx.fillStyle=s.col;rr(bx,sy,bw*r,barH,4);ctx.fill();
    ctx.globalAlpha=0.3;ctx.fillStyle=s.col;rr(bx,sy,bw*r,barH/2,4);ctx.fill();ctx.globalAlpha=1;
  });
  // Special traits
  const specY=barY+stats.length*gap+8;
  const specials=[];
  if(ch.coinMag>0)specials.push('\u30B3\u30A4\u30F3\u5438\u5F15');
  if(ch.stepTol)specials.push('\u6BB5\u5DEE\u8010\u6027UP');
  if(ch.maxFlip>1)specials.push(ch.maxFlip+'\u56DE\u53CD\u8EE2');
  if(ch.startShield)specials.push('\u521D\u671F\u30B7\u30FC\u30EB\u30C9');
  if(ch.fastKill)specials.push('\u6575\u7834\u58CA');
  if(specials.length>0){
    ctx.fillStyle=ch.col+'aa';ctx.font='bold 10px monospace';ctx.textAlign='center';
    ctx.fillText('\u7279\u6B8A: '+specials.join(' / '),W/2,specY);
  }
  // Close hint
  ctx.fillStyle='#fff3';ctx.font='10px monospace';ctx.textAlign='center';
  ctx.fillText('\u30BF\u30C3\u30D7\u3067\u9589\u3058\u308B',W/2,my+mh-12);
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
        ctx.beginPath();ctx.arc(bx,cy+40-bh,4,0,6.28);ctx.fill();
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
      ctx.beginPath();ctx.arc(tx2,stairY,6,0,6.28);ctx.stroke();
      // Rolling animation
      ctx.strokeStyle=ch.col+'33';ctx.lineWidth=1;
      const ra=t*0.15;
      for(let ri=0;ri<3;ri++){const a2=ra+ri*2.09;ctx.beginPath();ctx.moveTo(tx2+Math.cos(a2)*3,stairY+Math.sin(a2)*3);ctx.lineTo(tx2+Math.cos(a2)*5.5,stairY+Math.sin(a2)*5.5);ctx.stroke();}
      ctx.fillStyle='#fff3';ctx.font='8px monospace';ctx.textAlign='center';
      ctx.fillText('\u6BB5\u5DEE\u4E57\u8D8A+\u5C0F\u6E9D\u901A\u904E',cx,cy+46);
      break;
    case'ghost':
      // Size comparison ring
      ctx.globalAlpha=0.15+Math.sin(t*0.08)*0.1;
      ctx.strokeStyle=ch.col;ctx.lineWidth=1;ctx.setLineDash([3,3]);
      ctx.beginPath();ctx.arc(cx,cy,PLAYER_R*1.0,0,6.28);ctx.stroke();
      ctx.setLineDash([]);ctx.globalAlpha=1;
      // Transparency phase demo - flickering ghost silhouette
      const ghostPhase=Math.floor(t*0.015)%3===0;
      if(ghostPhase){
        ctx.globalAlpha=0.15+Math.sin(t*0.3)*0.05;
        ctx.fillStyle=ch.col;ctx.beginPath();ctx.arc(cx+25,cy-5,8,0,6.28);ctx.fill();
        ctx.globalAlpha=1;
        // Shimmer particles
        ctx.fillStyle='#a855f744';
        for(let i=0;i<3;i++){
          ctx.beginPath();ctx.arc(cx+25+(Math.random()-0.5)*12,cy-5+(Math.random()-0.5)*12,1.5,0,6.28);ctx.fill();
        }
      }
      ctx.fillStyle='#fff3';ctx.font='8px monospace';ctx.textAlign='center';
      ctx.fillText('\u5C0F\u5224\u5B9A+\u900F\u660E\u5316',cx,cy+46);
      break;
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
          ctx.beginPath();ctx.arc(sx,sy,2+Math.random()*2,0,6.28);ctx.fill();
        }
      }
      break;
    default: // cube
      // Balanced indicator
      ctx.fillStyle='#fff2';ctx.font='8px monospace';ctx.textAlign='center';
      ctx.fillText('\u30D0\u30E9\u30F3\u30B9\u578B',cx,cy+46);
      break;
  }
}

function drawCountdown(){
  // Semi-dark overlay
  ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(-20,-20,W+40,H+40);
  const sec=Math.ceil(countdownT/60); // 3, 2, 1
  const frac=(countdownT%60)/60; // 1→0 within each second
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
    ctx.strokeStyle=`rgba(0,229,255,${ringA})`;ctx.lineWidth=4;
    ctx.beginPath();ctx.arc(0,0,ringR,0,6.28);ctx.stroke();
    // Outer expanding ring
    ctx.strokeStyle=`rgba(0,229,255,${ringA*0.4})`;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(0,0,ringR+20*(1-frac),0,6.28);ctx.stroke();
    // Number
    ctx.fillStyle='#fff';ctx.shadowColor='#00e5ff';ctx.shadowBlur=30;
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
      ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd700';ctx.shadowBlur=25;
      ctx.font='bold 64px monospace';ctx.textAlign='center';
      ctx.fillText('GO!',0,22);ctx.shadowBlur=0;ctx.restore();
    }
  }
  // Character preview during countdown
  const ch=CHARS[selChar];
  ctx.fillStyle='#fff6';ctx.font='bold 12px monospace';ctx.textAlign='center';
  ctx.fillText(ch.name,W/2,H*0.58);
  drawCharacter(W/2,H*0.66,selChar,20,0,1,'normal');
}

function drawPause(){
  ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(-20,-20,W+40,H+40);
  ctx.fillStyle='#fff';ctx.font='bold 34px monospace';ctx.textAlign='center';
  ctx.shadowColor='#fff3';ctx.shadowBlur=12;
  ctx.fillText('\u4E00\u6642\u505C\u6B62',W/2,H*0.32);ctx.shadowBlur=0;
  ctx.fillStyle='#fff5';ctx.font='13px monospace';
  ctx.fillText('\u30B9\u30B3\u30A2: '+score,W/2,H*0.37);
  // HP in pause
  for(let i=0;i<maxHp();i++)drawHeart(W/2-((maxHp()-1)*13)+i*26,H*0.41,16,i<hp);
  // Resume button
  ctx.fillStyle='#00e5ff33';rr(W/2-80,H*0.45,160,44,10);ctx.fill();
  ctx.strokeStyle='#00e5ff';ctx.lineWidth=2;rr(W/2-80,H*0.45,160,44,10);ctx.stroke();
  ctx.fillStyle='#00e5ff';ctx.font='bold 18px monospace';ctx.fillText('\u25B6 \u518D\u958B',W/2,H*0.45+28);
  // Quit button
  ctx.fillStyle='#ff386033';rr(W/2-80,H*0.56,160,44,10);ctx.fill();
  ctx.strokeStyle='#ff3860';ctx.lineWidth=2;rr(W/2-80,H*0.56,160,44,10);ctx.stroke();
  ctx.fillStyle='#ff3860';ctx.font='bold 18px monospace';ctx.fillText('\u2716 \u30BF\u30A4\u30C8\u30EB\u3078',W/2,H*0.56+28);
  // Hint
  ctx.fillStyle='#fff3';ctx.font='11px monospace';
  ctx.fillText('ESC\u30AD\u30FC\u3067\u518D\u958B',W/2,H*0.67);
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
  ctx.beginPath();ctx.arc(cx,cy-sz*0.05,sz*0.04,0,6.28);ctx.fill();
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
    ctx.beginPath();ctx.arc(chestFall.x,chestFall.y,ringR,0,6.28);ctx.stroke();
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
  if(chestOpen.phase==='none'||bossChests<=0)return;
  const p=chestOpen.phase,t=chestOpen.t;
  const rw=chestOpen.reward;
  const isChar=rw&&rw.type==='char';
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

  // Header: chest count
  ctx.textAlign='center';ctx.fillStyle='#ffd700';ctx.font='bold 16px monospace';
  ctx.fillText('宝箱開封',cx,mY+30);
  ctx.fillStyle='#fff8';ctx.font='11px monospace';
  ctx.fillText('通算 '+totalChestsOpened+' 個開封',cx,mY+48);
  // Remaining chests this run
  if(bossChests>1){
    ctx.fillStyle='#ffaa00';ctx.font='10px monospace';
    ctx.fillText('残り '+(bossChests-1)+' 個',cx,mY+62);
  }

  // Update and draw chest particles (clipped to modal)
  chestOpen.parts=chestOpen.parts.filter(pp=>{
    pp.x+=pp.vx;pp.y+=pp.vy;pp.vy+=pp.g||0;pp.vx*=0.99;pp.life--;
    if(pp.life<=0)return false;
    const a=pp.life/pp.ml;
    ctx.globalAlpha=a;ctx.fillStyle=pp.col;
    ctx.beginPath();ctx.arc(pp.x,pp.y,pp.sz*a,0,6.28);ctx.fill();
    return true;
  });
  ctx.globalAlpha=1;

  if(p==='waiting'){
    // Pulsing chest
    const pulse=1+Math.sin(t*0.08)*0.05;
    ctx.save();ctx.translate(cx,cy);ctx.scale(pulse,pulse);
    const aura=ctx.createRadialGradient(0,0,chSz*0.5,0,0,chSz*1.5);
    aura.addColorStop(0,'rgba(255,215,0,0.25)');aura.addColorStop(1,'rgba(255,215,0,0)');
    ctx.fillStyle=aura;ctx.fillRect(-chSz*1.5,-chSz*1.5,chSz*3,chSz*3);
    drawChestIcon(0,0,chSz,false);
    ctx.restore();
    // Floating sparkles
    if(t%8===0){
      const a=Math.random()*6.28,r=chSz*0.8+Math.random()*20;
      chestOpen.parts.push({x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r,vx:(Math.random()-0.5)*0.5,vy:-0.5-Math.random(),life:25,ml:25,sz:Math.random()*3+1,col:['#ffd700','#ffffff','#ffaa00'][Math.floor(Math.random()*3)],g:0});
    }
    const ta=0.5+Math.sin(t*0.1)*0.3;
    ctx.globalAlpha=ta;ctx.fillStyle='#ffd700';ctx.font='bold 15px monospace';ctx.textAlign='center';
    ctx.fillText('タップして開封!',cx,mY+mH-30);
    ctx.globalAlpha=1;
  }
  else if(p==='wobble'){
    const wobble=Math.sin(t*0.8)*Math.min(t*0.3,8);
    ctx.save();ctx.translate(cx+wobble,cy);
    const glowA=Math.min(t/40,0.6);
    const aura=ctx.createRadialGradient(0,0,chSz*0.3,0,0,chSz*2);
    aura.addColorStop(0,`rgba(255,215,0,${glowA})`);aura.addColorStop(1,'rgba(255,215,0,0)');
    ctx.fillStyle=aura;ctx.fillRect(-chSz*2,-chSz*2,chSz*4,chSz*4);
    drawChestIcon(0,0,chSz,false);
    ctx.restore();
    if(t%3===0){
      chestOpen.parts.push({x:cx+(Math.random()-0.5)*chSz,y:cy+(Math.random()-0.5)*chSz*0.5,
        vx:(Math.random()-0.5)*4,vy:-2-Math.random()*3,life:20,ml:20,sz:Math.random()*3+1,
        col:['#ffd700','#ff8800','#ffffff'][Math.floor(Math.random()*3)],g:0.1});
    }
  }
  else if(p==='burst'){
    const burstT=Math.min(t/30,1);
    // Light beam
    const beamA=burstT*0.6;
    const beamGr=ctx.createRadialGradient(cx,cy,0,cx,cy,mH*0.8);
    beamGr.addColorStop(0,`rgba(255,230,150,${beamA})`);beamGr.addColorStop(0.4,`rgba(255,215,0,${beamA*0.3})`);beamGr.addColorStop(1,'rgba(255,215,0,0)');
    ctx.fillStyle=beamGr;ctx.fillRect(mX,mY,mW,mH);
    // Light rays
    ctx.save();ctx.translate(cx,cy);
    for(let i=0;i<12;i++){
      const ra=i*Math.PI/6+t*0.02;
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
    if(t===1){
      for(let i=0;i<40;i++){
        const a=(6.28/40)*i,s=2+Math.random()*5;
        chestOpen.parts.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,
          life:45+Math.random()*25,ml:70,sz:Math.random()*5+2,
          col:['#ffd700','#ffaa00','#ff88cc','#88ffff','#ffffff','#ff44ff'][i%6],g:0.04});
      }
    }
  }
  else if(p==='reveal'){
    if(isChar){
      // === SUPER RARE CHARACTER REVEAL ===
      const revealT=Math.min(t/100,1);
      // Rainbow pulsing background
      const hue=(t*3)%360;
      const rbgA=0.15+Math.sin(t*0.05)*0.05;
      ctx.fillStyle=`hsla(${hue},80%,50%,${rbgA})`;ctx.fillRect(mX,mY,mW,mH);
      // Rotating light rays (rainbow)
      ctx.save();ctx.translate(cx,cy-20);
      for(let i=0;i<16;i++){
        const ra=i*Math.PI/8+t*0.03;
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
        ctx.shadowColor=`hsl(${hue},90%,60%)`;ctx.shadowBlur=30;
        ctx.beginPath();ctx.arc(0,0,24,0,6.28);ctx.fill();
        ctx.shadowBlur=0;ctx.restore();
      } else {
        const colorT=Math.min((revealT-0.3)/0.35,1);
        ctx.save();
        ctx.shadowColor=`hsl(${hue},90%,60%)`;ctx.shadowBlur=25+colorT*30;
        drawCharacter(cx,charY,rw.charIdx,charR,0,colorT,'happy',0);
        ctx.shadowBlur=0;ctx.restore();
        if(colorT>=1){
          // "SUPER RARE!" banner
          const bannerA=Math.min((revealT-0.65)/0.15,1);
          const bannerPulse=1+Math.sin(t*0.15)*0.08;
          ctx.globalAlpha=bannerA;
          ctx.save();ctx.translate(cx,charY-charR-20);ctx.scale(bannerPulse,bannerPulse);
          ctx.font='bold 20px monospace';ctx.textAlign='center';
          // Rainbow text
          const tHue=(t*5)%360;
          ctx.fillStyle=`hsl(${tHue},100%,65%)`;
          ctx.shadowColor=`hsl(${tHue},100%,50%)`;ctx.shadowBlur=15;
          ctx.fillText(rw.isNew?'★ SUPER RARE! ★':'★ RARE! ★',0,0);
          ctx.shadowBlur=0;ctx.restore();
          ctx.globalAlpha=1;
          // Name & trait
          const nameA=Math.min((revealT-0.75)/0.15,1);
          ctx.globalAlpha=nameA;
          ctx.fillStyle='#ffd700';ctx.font='bold 18px monospace';ctx.textAlign='center';
          ctx.shadowColor='#ffd70088';ctx.shadowBlur=12;
          ctx.fillText(CHARS[rw.charIdx].name,cx,charY+charR+24);
          ctx.shadowBlur=0;
          ctx.fillStyle='#fff8';ctx.font='12px monospace';
          ctx.fillText(CHARS[rw.charIdx].trait,cx,charY+charR+42);
          if(rw.isNew){
            ctx.fillStyle='#34d399';ctx.font='bold 13px monospace';
            ctx.fillText('NEW! アンロック!',cx,charY+charR+60);
          } else {
            ctx.fillStyle='#ffaa00';ctx.font='12px monospace';
            ctx.fillText('所持済み +50コイン',cx,charY+charR+60);
          }
          ctx.globalAlpha=1;
        }
      }
      // Intense rainbow sparkles
      if(t%2===0){
        const a=Math.random()*6.28,r=20+Math.random()*80;
        const sHue=Math.floor(Math.random()*360);
        chestOpen.parts.push({x:cx+Math.cos(a)*r,y:(charY||cy)+Math.sin(a)*r,vx:(Math.random()-0.5)*2.5,vy:-1.5-Math.random()*1.5,life:35,ml:35,sz:Math.random()*4+2,col:`hsl(${sHue},90%,70%)`,g:-0.02});
      }
      // Glitter falling from top
      if(t%4===0){
        chestOpen.parts.push({x:mX+Math.random()*mW,y:mY,vx:(Math.random()-0.5)*0.5,vy:0.5+Math.random(),life:60,ml:60,sz:Math.random()*3+1,col:['#ffd700','#ff88cc','#88ffff','#ff44ff','#ffffff'][Math.floor(Math.random()*5)],g:0.02});
      }
    } else {
      // === COIN REVEAL ===
      const revealT=Math.min(t/60,1);
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
      ctx.shadowColor='#ffd700';ctx.shadowBlur=15+revealT*10;
      ctx.fillStyle='#ffd700';
      ctx.beginPath();ctx.arc(0,0,coinR,0,6.28);ctx.fill();
      ctx.fillStyle='#ffaa00';
      ctx.beginPath();ctx.arc(0,0,coinR*0.7,0,6.28);ctx.fill();
      ctx.fillStyle='#ffd700';ctx.font='bold '+(coinR*0.9|0)+'px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('¥',0,1);
      ctx.shadowBlur=0;ctx.restore();
      ctx.textBaseline='alphabetic';
      // Amount text
      if(revealT>0.4){
        const amtA=Math.min((revealT-0.4)/0.3,1);
        ctx.globalAlpha=amtA;
        ctx.fillStyle='#ffd700';ctx.font='bold 28px monospace';ctx.textAlign='center';
        ctx.shadowColor='#ffd70088';ctx.shadowBlur=12;
        ctx.fillText('+'+rw.amount,cx,coinY+coinR+30);
        ctx.shadowBlur=0;
        ctx.fillStyle='#fff8';ctx.font='13px monospace';
        ctx.fillText('コイン獲得!',cx,coinY+coinR+50);
        ctx.globalAlpha=1;
      }
      // Coin sparkles
      if(t%4===0){
        const a=Math.random()*6.28,r=25+Math.random()*40;
        chestOpen.parts.push({x:cx+Math.cos(a)*r,y:coinY+Math.sin(a)*r,vx:(Math.random()-0.5)*1.5,vy:-1-Math.random(),life:25,ml:25,sz:Math.random()*3+1,col:['#ffd700','#ffffff','#ffaa00'][Math.floor(Math.random()*3)],g:0});
      }
    }
  }
  else if(p==='done'){
    if(isChar){
      // === SUPER RARE DONE DISPLAY ===
      const charY=cy-40;
      const charR=26;
      const hue=(t*3)%360;
      // Subtle rainbow bg
      ctx.fillStyle=`hsla(${hue},60%,50%,0.05)`;ctx.fillRect(mX,mY,mW,mH);
      // Character display with rainbow glow
      const bounce=Math.sin(t*0.06)*3;
      ctx.save();
      ctx.shadowColor=`hsl(${hue},90%,60%)`;ctx.shadowBlur=25;
      drawCharacter(cx,charY+bounce,rw.charIdx,charR,0,1,'happy',0);
      ctx.shadowBlur=0;ctx.restore();
      // Rainbow "SUPER RARE" text
      const tHue=(t*5)%360;
      ctx.fillStyle=`hsl(${tHue},100%,65%)`;ctx.font='bold 14px monospace';ctx.textAlign='center';
      ctx.fillText(rw.isNew?'★ SUPER RARE! ★':'★ RARE! ★',cx,charY-charR-12);
      // Name and trait
      ctx.fillStyle='#ffd700';ctx.font='bold 18px monospace';
      ctx.fillText(CHARS[rw.charIdx].name,cx,charY+charR+22);
      ctx.fillStyle='#fff8';ctx.font='12px monospace';
      ctx.fillText(CHARS[rw.charIdx].trait,cx,charY+charR+40);
      if(rw.isNew){
        ctx.fillStyle='#34d399';ctx.font='bold 13px monospace';
        ctx.fillText('NEW! アンロック!',cx,charY+charR+58);
      } else {
        ctx.fillStyle='#ffaa00';ctx.font='12px monospace';
        ctx.fillText('所持済み +50コイン',cx,charY+charR+58);
      }
      // Continuous rainbow sparkles
      if(t%4===0){
        const a=Math.random()*6.28,r=40+Math.random()*40;
        const sHue=Math.floor(Math.random()*360);
        chestOpen.parts.push({x:cx+Math.cos(a)*r,y:charY+Math.sin(a)*r,vx:(Math.random()-0.5),vy:-0.5-Math.random()*0.5,life:30,ml:30,sz:Math.random()*3+1,col:`hsl(${sHue},90%,70%)`,g:0});
      }
      if(t%6===0){
        chestOpen.parts.push({x:mX+Math.random()*mW,y:mY,vx:0,vy:0.3+Math.random()*0.5,life:50,ml:50,sz:Math.random()*2+1,col:['#ffd700','#ff88cc','#88ffff'][Math.floor(Math.random()*3)],g:0.01});
      }
    } else {
      // === COIN DONE DISPLAY ===
      const coinY=cy-30;
      const coinR=22;
      // Coin display
      const bounce=Math.sin(t*0.06)*2;
      ctx.save();ctx.translate(cx,coinY+bounce);
      ctx.shadowColor='#ffd700';ctx.shadowBlur=15;
      ctx.fillStyle='#ffd700';ctx.beginPath();ctx.arc(0,0,coinR,0,6.28);ctx.fill();
      ctx.fillStyle='#ffaa00';ctx.beginPath();ctx.arc(0,0,coinR*0.7,0,6.28);ctx.fill();
      ctx.fillStyle='#ffd700';ctx.font='bold 18px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('¥',0,1);
      ctx.shadowBlur=0;ctx.restore();
      ctx.textBaseline='alphabetic';
      // Amount
      ctx.fillStyle='#ffd700';ctx.font='bold 26px monospace';ctx.textAlign='center';
      ctx.fillText('+'+rw.amount,cx,coinY+coinR+28);
      ctx.fillStyle='#fff8';ctx.font='13px monospace';
      ctx.fillText('コイン獲得!',cx,coinY+coinR+48);
      // Sparkle
      if(t%6===0){
        const a=Math.random()*6.28,r=30+Math.random()*25;
        chestOpen.parts.push({x:cx+Math.cos(a)*r,y:coinY+Math.sin(a)*r,vx:(Math.random()-0.5),vy:-0.5-Math.random()*0.5,life:25,ml:25,sz:Math.random()*2+1,col:['#ffd700','#ffffff'][Math.floor(Math.random()*2)],g:0});
      }
    }
    // "Tap to close" at bottom
    const ta=0.4+Math.sin(t*0.1)*0.3;
    ctx.globalAlpha=ta;ctx.fillStyle='#fff6';ctx.font='13px monospace';ctx.textAlign='center';
    ctx.fillText('タップで閉じる',cx,mY+mH-20);
    ctx.globalAlpha=1;
  }
  ctx.restore();
}

function drawDead(){
  const oa=Math.min(deadT/40,0.7);
  ctx.fillStyle=`rgba(0,0,0,${oa})`;ctx.fillRect(-20,-20,W+40,H+40);
  if(deadT<15)return;
  const si=Math.min((deadT-15)/20,1),e=1-Math.pow(1-si,3);
  ctx.save();ctx.translate(0,-50*(1-e));ctx.globalAlpha=e;

  // "GAME OVER" title with glow
  ctx.fillStyle=tc('obs');ctx.font='bold 36px monospace';ctx.textAlign='center';
  ctx.shadowColor=tca('obs',0x66);ctx.shadowBlur=25;
  ctx.fillText('\u30B2\u30FC\u30E0\u30AA\u30FC\u30D0\u30FC',W/2,H*0.16);ctx.shadowBlur=0;

  // Rating comment with color (based on score, 5000 = legendary)
  let rating='',ratingCol='#fff6';
  if(score>=5000){rating='\u4F1D\u8AAC\u7D1A\uFF01 \u2605';ratingCol='#ffd700';}
  else if(score>=3000){rating='\u795E\u696D\uFF01';ratingCol='#ff44ff';}
  else if(score>=2000){rating='\u8D85\u4EBA\u7D1A\uFF01';ratingCol='#00e5ff';}
  else if(score>=1000){rating='\u5320\u306E\u6280\uFF01';ratingCol='#34d399';}
  else if(score>=500){rating='\u7D20\u6674\u3089\u3057\u3044\uFF01';ratingCol='#ff6b35';}
  else if(score>=200){rating='\u306A\u304B\u306A\u304B\uFF01';ratingCol='#a0d0ff';}
  else if(score>=100){rating='\u3044\u3044\u611F\u3058\uFF01';ratingCol='#fff8';}
  else if(score>=50){rating='\u307E\u305A\u307E\u305A';ratingCol='#fff5';}
  else if(score>=10){rating='\u304C\u3093\u3070\u308D\u3046\uFF01';ratingCol='#fff4';}
  if(rating){
    const rp=Math.sin(deadT*0.08)*0.15+0.85;
    ctx.globalAlpha=rp*e;ctx.fillStyle=ratingCol;ctx.font='bold 15px monospace';
    ctx.shadowColor=ratingCol+'66';ctx.shadowBlur=10;
    ctx.fillText(rating,W/2,H*0.21);ctx.shadowBlur=0;ctx.globalAlpha=e;
  }

  // Main result card
  const cardW=Math.min(270,W-30),cardX=W/2-cardW/2;
  const cardY=H*0.24,cardH=210;
  const cardGr=ctx.createLinearGradient(cardX,cardY,cardX,cardY+cardH);
  cardGr.addColorStop(0,'rgba(10,10,30,0.92)');cardGr.addColorStop(1,'rgba(5,5,20,0.92)');
  ctx.fillStyle=cardGr;rr(cardX,cardY,cardW,cardH,14);ctx.fill();
  ctx.strokeStyle='#ffffff12';ctx.lineWidth=1;rr(cardX,cardY,cardW,cardH,14);ctx.stroke();
  // Accent top border
  const accentCol=score>=5000?'#ffd700':score>=1000?'#00e5ff':tc('obs');
  ctx.strokeStyle=accentCol+'66';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(cardX+14,cardY);ctx.lineTo(cardX+cardW-14,cardY);ctx.stroke();

  // New record badge
  if(newHi){const np=Math.sin(deadT*0.12)*0.3+0.7;ctx.globalAlpha=np*e;ctx.fillStyle='#ffd700';ctx.font='bold 14px monospace';ctx.shadowColor='#ffd70066';ctx.shadowBlur=12;ctx.fillText('\u2605 NEW RECORD \u2605',W/2,cardY+18);ctx.shadowBlur=0;ctx.globalAlpha=e;}

  // Character (show fully damaged)
  drawCharacter(W/2,cardY+(newHi?46:38),selChar,16,0,1,'dead',maxHp());

  // Score section
  const scoreY=cardY+(newHi?68:60);
  ctx.fillStyle='#fff6';ctx.font='10px monospace';ctx.fillText('\u30B9\u30B3\u30A2',W/2,scoreY);
  ctx.fillStyle='#fff';ctx.font='bold 38px monospace';
  ctx.shadowColor='#fff2';ctx.shadowBlur=8;ctx.fillText(score,W/2,scoreY+38);ctx.shadowBlur=0;

  // Best score
  ctx.fillStyle='#fff4';ctx.font='11px monospace';
  ctx.fillText('\u30D9\u30B9\u30C8: '+highScore,W/2,scoreY+56);

  // Combo
  if(maxCombo>1){
    ctx.fillStyle='#ff6b3599';ctx.font='10px monospace';
    ctx.fillText('\u6700\u5927\u30B3\u30F3\u30DC: '+maxCombo+'x',W/2,scoreY+72);
  }

  // Divider line
  const divY=scoreY+(maxCombo>1?82:70);
  ctx.strokeStyle='#ffffff0a';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(cardX+20,divY);ctx.lineTo(cardX+cardW-20,divY);ctx.stroke();

  // Coin section: earned coins and wallet
  const coinY=divY+18;
  ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';
  ctx.fillText('\u25CF '+totalCoins+' \u7372\u5F97',W/2-40,coinY);
  ctx.fillStyle='#fff5';ctx.font='11px monospace';
  ctx.fillText('\u6240\u6301: '+walletCoins,W/2+50,coinY);

  // --- Chest opening overlay (blocks buttons while active) ---
  if(chestOpen.phase!=='none'&&bossChests>0){
    drawChestOpen();
    ctx.restore();ctx.globalAlpha=1;
    return;
  }

  // --- Action buttons (below card) ---
  if(deadT>45){
    const btnW2=Math.min(220,W-40),btnH2=38,btnX2=W/2-btnW2/2;
    let btnTop=cardY+cardH+12;

    // Continue button (costs 100 coins) - only in endless mode
    if(!isPackMode){
      const canContinue=walletCoins>=100;
      if(canContinue){
        const pulse=Math.sin(deadT*0.08)*0.08+0.92;
        ctx.globalAlpha=pulse*e;
        ctx.fillStyle='#00e5ff18';rr(btnX2,btnTop,btnW2,btnH2,8);ctx.fill();
        ctx.strokeStyle='#00e5ff';ctx.lineWidth=1.5;rr(btnX2,btnTop,btnW2,btnH2,8);ctx.stroke();
        ctx.fillStyle='#00e5ff';ctx.font='bold 13px monospace';
        ctx.fillText('\u25B6 \u7D9A\u304D\u304B\u3089\u518D\u958B  \u25CF100',W/2,btnTop+24);
        ctx.globalAlpha=e;
      } else {
        ctx.fillStyle='#ffffff06';rr(btnX2,btnTop,btnW2,btnH2,8);ctx.fill();
        ctx.strokeStyle='#ffffff22';ctx.lineWidth=1;rr(btnX2,btnTop,btnW2,btnH2,8);ctx.stroke();
        ctx.fillStyle='#fff3';ctx.font='bold 13px monospace';
        ctx.fillText('\u25B6 \u7D9A\u304D\u304B\u3089\u518D\u958B  \u25CF100',W/2,btnTop+24);
        ctx.fillStyle='#ff444488';ctx.font='9px monospace';
        ctx.fillText('\u30B3\u30A4\u30F3\u4E0D\u8DB3',W/2,btnTop+36);
      }
      btnTop+=btnH2+8;
    }

    // Restart button
    ctx.fillStyle='#ff860018';rr(btnX2,btnTop,btnW2,btnH2,8);ctx.fill();
    ctx.strokeStyle='#ff8600';ctx.lineWidth=1.5;rr(btnX2,btnTop,btnW2,btnH2,8);ctx.stroke();
    ctx.fillStyle='#ff8600';ctx.font='bold 13px monospace';
    ctx.fillText(isPackMode?'\u21BB \u3082\u3046\u4E00\u5EA6':'\u21BB \u306F\u3058\u3081\u304B\u3089',W/2,btnTop+24);
    btnTop+=btnH2+8;

    // Title button
    ctx.fillStyle='#ff386018';rr(btnX2,btnTop,btnW2,btnH2,8);ctx.fill();
    ctx.strokeStyle='#ff3860';ctx.lineWidth=1.5;rr(btnX2,btnTop,btnW2,btnH2,8);ctx.stroke();
    ctx.fillStyle='#ff3860';ctx.font='bold 13px monospace';
    ctx.fillText(isPackMode?'\u2190 \u30B9\u30C6\u30FC\u30B8\u9078\u629E':'\u2190 \u30BF\u30A4\u30C8\u30EB\u3078',W/2,btnTop+24);
  }

  ctx.restore();ctx.globalAlpha=1;
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
  ctx.fillText('ステージ選択',W/2,40+safeTop);
  // Back button
  ctx.fillStyle='#ffffff22';rr(10,22+safeTop,50,30,8);ctx.fill();
  ctx.fillStyle='#fff8';ctx.font='bold 14px monospace';ctx.textAlign='center';
  ctx.fillText('← 戻る',35,42+safeTop);
  // Star total display
  ctx.fillStyle='#ffd700';ctx.font='bold 14px monospace';ctx.textAlign='right';
  ctx.fillText('★'+totalStars,W-12,42+safeTop);
  // Scrollable pack list
  ctx.save();
  ctx.beginPath();ctx.rect(0,60+safeTop,W,H-70-safeTop-safeBot);ctx.clip();
  const startY=70+safeTop+stageSelScroll;
  const cardH=130,cardGap=14,cardW=W-30;
  for(let pi=0;pi<STAGE_PACKS.length;pi++){
    const pack=STAGE_PACKS[pi];
    const cy=startY+pi*(cardH+cardGap);
    if(cy+cardH<60+safeTop||cy>H)continue; // off-screen cull
    const locked=totalStars<pack.unlock;
    const st=STAGE_THEMES[pack.theme];
    const cleared=pack.stages.filter(s=>packProgress[s.id]&&packProgress[s.id].cleared).length;
    // Card background
    const cg=ctx.createLinearGradient(15,cy,15+cardW,cy+cardH);
    cg.addColorStop(0,locked?'#111118':st.bg1+'cc');cg.addColorStop(1,locked?'#0a0a12':st.bg2+'cc');
    ctx.fillStyle=cg;rr(15,cy,cardW,cardH,12);ctx.fill();
    ctx.strokeStyle=locked?'#333':st.line+'88';ctx.lineWidth=1.5;rr(15,cy,cardW,cardH,12);ctx.stroke();
    if(locked){
      // Locked pack overlay
      ctx.fillStyle='#00000088';rr(15,cy,cardW,cardH,12);ctx.fill();
      ctx.fillStyle='#888';ctx.font='bold 28px monospace';ctx.textAlign='center';
      ctx.fillText('🔒',W/2,cy+55);
      ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';
      ctx.fillText('★'+pack.unlock+'個で解放',W/2,cy+82);
      ctx.fillStyle='#fff4';ctx.font='10px monospace';
      ctx.fillText('現在: ★'+totalStars+' / '+pack.unlock,W/2,cy+98);
      // Pack name (dimmed)
      ctx.fillStyle='#fff3';ctx.font='bold 14px monospace';
      ctx.fillText(pack.name,W/2,cy+22);
      continue;
    }
    // Pack name and progress
    ctx.fillStyle=st.ply;ctx.font='bold 16px monospace';ctx.textAlign='left';
    ctx.fillText(pack.name,28,cy+24);
    ctx.fillStyle='#fff6';ctx.font='11px monospace';
    ctx.fillText(cleared+'/5 クリア',28,cy+40);
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
      // Determine if playable: first stage always, or previous cleared with enough stars
      const prevProg=si>0?packProgress[pack.stages[si-1].id]:null;
      const reqStars=pack.starsPerStage||2;
      const canPlay=si===0||(prevProg&&prevProg.cleared&&(prevProg.stars||0)>=reqStars);
      if(isClear){
        // Cleared: gold circle with stars
        ctx.fillStyle='#ffd70033';rr(sx,sbY,sbW,sbH,10);ctx.fill();
        ctx.strokeStyle='#ffd700';ctx.lineWidth=1.5;rr(sx,sbY,sbW,sbH,10);ctx.stroke();
        ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';ctx.textAlign='center';
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
    }
    // Star total indicator at bottom of card
    const bcY=sbY+sbH+8;
    const packStars=pack.stages.reduce((sum,s)=>{const p=packProgress[s.id];return sum+(p?p.stars:0);},0);
    ctx.fillStyle='#ffd700';ctx.font='9px monospace';ctx.textAlign='left';
    ctx.fillText('★ '+packStars+' / 15  ('+cleared+'/5 クリア)',28,bcY+4);
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
}
function handleStageSelTouch(tx,ty){
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
    const locked=totalStars<pack.unlock;
    if(locked){sfx('hurt');vibrate(15);addPop(W/2,ty,'ロック中','#ff4444');return;}
    // Check stage buttons
    const sbW=44,sbH=44,sbGap=8;
    const sbX=15+(cardW-(5*sbW+4*sbGap))/2;
    const sbY=cy+52;
    for(let si=0;si<5;si++){
      const stage=pack.stages[si];
      const sx=sbX+si*(sbW+sbGap);
      if(tx>=sx&&tx<=sx+sbW&&ty>=sbY&&ty<=sbY+sbH){
        const prevProg=si>0?packProgress[pack.stages[si-1].id]:null;
        const reqStars=pack.starsPerStage||2;
        const canPlay=si===0||(prevProg&&prevProg.cleared&&(prevProg.stars||0)>=reqStars);
        if(!canPlay){sfx('hurt');vibrate(10);addPop(sx+sbW/2,sbY-5,'★'+reqStars+'個必要','#ff8844');return;}
        // Start this stage!
        gameMode='pack';isPackMode=true;
        state=ST.PLAY;resetPackStage(pi,si);switchBGM('play');
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

  ctx.fillStyle='#ffd700';ctx.font='bold 36px monospace';ctx.textAlign='center';
  ctx.shadowColor='#ffd70066';ctx.shadowBlur=20;
  ctx.fillText('クリア！',W/2,H*0.25);ctx.shadowBlur=0;

  // Stage clear display (unified - always pack mode)
  const pname=currentPackStage?STAGE_PACKS[currentPackIdx].name+' '+currentPackStage.name:'';
  ctx.fillStyle='#fff8';ctx.font='14px monospace';
  ctx.fillText(pname,W/2,H*0.32);
  const cardY=H*0.36,cardH=170;
  ctx.fillStyle='#0008';rr(W/2-120,cardY,240,cardH,12);ctx.fill();
  ctx.strokeStyle='#ffd70033';ctx.lineWidth=1;rr(W/2-120,cardY,240,cardH,12);ctx.stroke();
  drawCharacter(W/2,cardY+35,selChar,20,0,1,'happy');
  // Score info
  ctx.fillStyle='#fff';ctx.font='bold 24px monospace';ctx.textAlign='center';
  ctx.fillText(Math.floor(dist)+'m',W/2,cardY+72);
  ctx.fillStyle='#fff5';ctx.font='11px monospace';
  ctx.fillText('目標: '+(currentPackStage?currentPackStage.dist:0)+'m  コイン: '+totalCoins,W/2,cardY+92);
  // Stars display (3 stars with animation)
  const starY=cardY+115;
  for(let i=0;i<3;i++){
    const sx=W/2-30+i*30,collected=i<stageBigCollected;
    const delay=i*12,ap=stageClearT>20+delay?Math.min(1,(stageClearT-20-delay)/15):0;
    if(collected){
      const sc=1+Math.sin(stageClearT*0.1+i)*0.1;
      ctx.save();ctx.translate(sx,starY);ctx.scale(sc*ap,sc*ap);
      ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd70088';ctx.shadowBlur=12;
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
  const starsCollected=stageBigCoins?stageBigCoins.filter(bc=>bc.col).length:0;
  const reward=10+starsCollected*5+(gotNewStars>0?10:0);
  ctx.fillStyle='#ffd700';ctx.font='bold 11px monospace';ctx.textAlign='center';
  ctx.fillText('● +'+reward+' コイン獲得',W/2,cardY+cardH-6);
  if(stageClearT>60){
    const ta=Math.sin(stageClearT*0.07)*0.3+0.7;
    ctx.globalAlpha=ta*e;ctx.fillStyle='#fff';ctx.font='bold 15px monospace';
    ctx.fillText('タップでステージ選択へ',W/2,H*0.82);
  }

  parts.forEach(p=>{ctx.globalAlpha=p.life/p.ml;ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(p.x,p.y,p.sz*(p.life/p.ml),0,6.28);ctx.fill();});
  ctx.restore();ctx.globalAlpha=1;
}
