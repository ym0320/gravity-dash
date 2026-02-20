'use strict';
// ===== DRAW =====
function rr(x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

// ===== LOGIN SCREEN (HTML overlay handles rendering) =====
function drawLogin(){} // Login is HTML overlay, nothing to draw on canvas

// ===== TUTORIAL (course-based) =====
function drawTutorial(){
  // Draw tutorial course platforms relative to scroll
  ctx.save();
  // Floor platforms
  tutCoursePlats.forEach(p=>{
    const sx=p.x-tutScrollX;
    if(sx+p.w<-20||sx>W+20)return;
    const surfY=H-p.h;
    const gr=ctx.createLinearGradient(0,surfY,0,H);
    gr.addColorStop(0,tc('gnd'));gr.addColorStop(1,tc('gnd2'));
    ctx.fillStyle=gr;ctx.fillRect(sx,surfY,p.w,p.h+10);
    ctx.fillStyle=tc('line');ctx.fillRect(sx,surfY,p.w,3);
  });
  // Ceiling platforms
  tutCourseCeil.forEach(p=>{
    const sx=p.x-tutScrollX;
    if(sx+p.w<-20||sx>W+20)return;
    const gr=ctx.createLinearGradient(0,0,0,p.h);
    gr.addColorStop(0,tc('gnd2'));gr.addColorStop(1,tc('gnd'));
    ctx.fillStyle=gr;ctx.fillRect(sx,-10,p.w,p.h+10);
    ctx.fillStyle=tc('line');ctx.fillRect(sx,p.h,p.w,3);
  });
  // Spikes
  tutCourseSpikes.forEach(sp=>{
    const sx=sp.x-tutScrollX;
    if(sx+sp.w<-20||sx>W+20)return;
    const by=H-GROUND_H;
    ctx.fillStyle='#ff4444';
    // Triangle spikes
    for(let i=0;i<3;i++){
      const tx=sx+i*(sp.w/3);
      ctx.beginPath();
      ctx.moveTo(tx,by);ctx.lineTo(tx+sp.w/6,by-sp.h);ctx.lineTo(tx+sp.w/3,by);
      ctx.closePath();ctx.fill();
    }
  });
  // Enemies
  enemies.forEach(en=>{if(!en.alive)return;drawEnemy(en);});
  // Particles & pops
  parts.forEach(pp=>{ctx.globalAlpha=pp.life/pp.ml;ctx.fillStyle=pp.col;ctx.beginPath();ctx.arc(pp.x,pp.y,pp.sz,0,6.28);ctx.fill();});
  ctx.globalAlpha=1;
  pops.forEach(pp=>{ctx.globalAlpha=pp.life/40;ctx.fillStyle=pp.col;ctx.font='bold 14px monospace';ctx.textAlign='center';ctx.fillText(pp.txt,pp.x,pp.y);});
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
        ctx.beginPath();ctx.arc(sx,sy,1.5+Math.sin(i+tutWarpT*0.05)*1,0,6.28);ctx.fill();
      }
      // Title text
      ctx.save();ctx.translate(W/2,H*0.30);
      const ps=1+Math.sin(tutWarpT*0.06)*0.04;ctx.scale(ps*fadeIn,ps*fadeIn);
      ctx.fillStyle='#ffd700';ctx.font='bold 26px monospace';ctx.textAlign='center';
      ctx.shadowColor='#ffd700';ctx.shadowBlur=20;
      ctx.fillText('ようこそ',0,-20);
      ctx.fillText('冒険の世界へ！',0,16);
      ctx.shadowBlur=0;ctx.restore();
      // Tap prompt (blink)
      if(tutWarpT>30){
        const blink=Math.sin(tutWarpT*0.12)*0.4+0.6;
        ctx.globalAlpha=blink*fadeIn;
        ctx.fillStyle='#fff';ctx.font='bold 16px monospace';ctx.textAlign='center';
        ctx.fillText('▶ タップしてスタート',W/2,H*0.55);
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
        ctx.beginPath();ctx.arc(sx,sy,3+prog*4,0,6.28);ctx.fill();
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
    ctx.fillText('チュートリアル完了！',0,0);ctx.restore();
    ctx.fillStyle='#fff';ctx.font='14px monospace';ctx.textAlign='center';
    ctx.fillText('さあ、冒険を始めよう！',W/2,H*0.48);
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
    ctx.beginPath();ctx.arc(dx,barY+3,5,0,6.28);ctx.fill();
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
      ctx.fillText('次のステップへ...',W/2,boxY+80);
    } else {
      // Double-flip sub-step: override message for second flip
      let msgText=cp.msg,subText=cp.sub;
      if(cp.type==='double_flip'&&tutFlipCount>=1){
        msgText='そのまま重力を\n戻そう！';subText='↓ 下にスワイプ！';
      }
      // Main message (supports \n)
      const lines=msgText.split('\n');
      const fontSize=18;
      ctx.fillStyle='#ffd700';ctx.font='bold '+fontSize+'px monospace';ctx.textAlign='center';
      const startY=boxY+32+(lines.length===1?8:0);
      lines.forEach((line,i)=>{
        const pulse=1+Math.sin(tutStepT*0.06)*0.04;
        ctx.save();ctx.translate(W/2,startY+i*24);ctx.scale(pulse,pulse);
        ctx.fillText(line,0,0);ctx.restore();
      });
      // Sub instruction (animated)
      const subY=boxY+76+(lines.length===1?8:0);
      const subPulse=Math.sin(tutStepT*0.1)*0.3+0.7;
      ctx.globalAlpha=0.5+subPulse*0.5;
      ctx.fillStyle='#fff';ctx.font='bold 14px monospace';
      ctx.fillText(subText,W/2,subY);
      ctx.globalAlpha=1;

      // Big visual guide icons
      drawTutorialGuide(cp);
    }
  }

  // Skip button
  ctx.fillStyle='#ffffff22';rr(W-64,safeTop+4,56,24,6);ctx.fill();
  ctx.fillStyle='#fff6';ctx.font='10px monospace';ctx.textAlign='center';
  ctx.fillText('スキップ',W-36,safeTop+20);
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
      ctx.beginPath();ctx.arc(px,cy,rr2,0,6.28);ctx.stroke();
    }
    // Center circle
    ctx.fillStyle='rgba(255,215,0,'+a+')';
    ctx.beginPath();ctx.arc(px,cy,r,0,6.28);ctx.fill();
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
      ctx.beginPath();ctx.arc(b.bombX+b.sz/2,b.y+b.sz/2,rr2,0,6.28);ctx.stroke();
    }
    // Arrow pointing to button
    const arrowX=b.bombX+b.sz/2,arrowY=b.y-20+Math.sin(t*0.12)*8;
    ctx.strokeStyle='#ff4400';ctx.lineWidth=3;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(arrowX,arrowY-20);ctx.lineTo(arrowX,arrowY);ctx.stroke();
    ctx.beginPath();ctx.moveTo(arrowX-6,arrowY-6);ctx.lineTo(arrowX,arrowY+2);ctx.lineTo(arrowX+6,arrowY-6);ctx.stroke();
  }
}

// --- Menu icon drawing functions (canvas-drawn, no emoji) ---
function drawIconPodium(cx,cy,col){
  // Podium / 表彰台: three blocks (1st tall center, 2nd left, 3rd right)
  ctx.save();ctx.translate(cx,cy);
  const s=0.9;
  // 2nd place (left)
  ctx.fillStyle=col+'99';
  ctx.fillRect(-11*s,-2*s,7*s,10*s);
  // 1st place (center, taller)
  ctx.fillStyle=col;
  ctx.fillRect(-3*s,-8*s,7*s,16*s);
  // 3rd place (right)
  ctx.fillStyle=col+'66';
  ctx.fillRect(5*s,2*s,7*s,6*s);
  // Base line
  ctx.strokeStyle=col;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(-12*s,8*s);ctx.lineTo(13*s,8*s);ctx.stroke();
  // Numbers
  ctx.fillStyle='#000';ctx.font='bold 6px monospace';ctx.textAlign='center';
  ctx.fillText('2',-7.5*s,5*s);
  ctx.fillText('1',0.5*s,-1*s);
  ctx.fillText('3',8.5*s,7*s);
  ctx.restore();
}
function drawIconChest(cx,cy,col){
  // Treasure chest / 宝箱
  ctx.save();ctx.translate(cx,cy);
  const s=1.0;
  // Chest body (bottom half)
  ctx.fillStyle=col+'cc';
  rr(-10*s,-1*s,20*s,10*s,2);ctx.fill();
  // Chest lid (top dome)
  ctx.fillStyle=col;
  ctx.beginPath();
  ctx.moveTo(-10*s,-1*s);
  ctx.lineTo(-10*s,-4*s);
  ctx.quadraticCurveTo(-10*s,-9*s,0,-9*s);
  ctx.quadraticCurveTo(10*s,-9*s,10*s,-4*s);
  ctx.lineTo(10*s,-1*s);
  ctx.closePath();ctx.fill();
  // Metal band (horizontal stripe)
  ctx.strokeStyle='#000';ctx.lineWidth=1.2;
  ctx.beginPath();ctx.moveTo(-10*s,-1*s);ctx.lineTo(10*s,-1*s);ctx.stroke();
  // Keyhole / latch
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,3*s,2.5*s,0,6.28);ctx.fill();
  ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,3*s,1.2*s,0,6.28);ctx.fill();
  // Outline
  ctx.strokeStyle=col;ctx.lineWidth=1;
  rr(-10*s,-1*s,20*s,10*s,2);ctx.stroke();
  ctx.restore();
}
function drawIconCart(cx,cy,col){
  // Shopping cart
  ctx.save();ctx.translate(cx,cy);
  ctx.strokeStyle=col;ctx.lineWidth=1.8;ctx.lineCap='round';ctx.lineJoin='round';
  // Cart body
  ctx.beginPath();
  ctx.moveTo(-9,-4);ctx.lineTo(-6,-4);ctx.lineTo(-3,5);ctx.lineTo(8,5);ctx.lineTo(10,-1);ctx.lineTo(-4,-1);
  ctx.stroke();
  // Handle
  ctx.beginPath();ctx.moveTo(-9,-4);ctx.lineTo(-11,-7);ctx.stroke();
  // Wheels
  ctx.fillStyle=col;
  ctx.beginPath();ctx.arc(-1,8,2,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(6,8,2,0,6.28);ctx.fill();
  ctx.restore();
}
function drawIconHanger(cx,cy,col){
  // Clothes hanger / 着せ替え
  ctx.save();ctx.translate(cx,cy);
  ctx.strokeStyle=col;ctx.lineWidth=1.8;ctx.lineCap='round';ctx.lineJoin='round';
  // Hook at top
  ctx.beginPath();ctx.arc(0,-8,3,Math.PI,0);ctx.stroke();
  // Hanger body (triangle shape)
  ctx.beginPath();
  ctx.moveTo(0,-5);ctx.lineTo(-11,5);ctx.lineTo(11,5);ctx.closePath();
  ctx.stroke();
  // Bar at bottom
  ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(-11,5);ctx.lineTo(11,5);ctx.stroke();
  ctx.restore();
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
      ctx.restore();return;
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
    const isDown=(g.dir||1)===1; // blue=down, pink=up
    const r1=isDown?'0,130,255':'255,80,160';
    const r2=isDown?'80,180,255':'255,130,190';
    const r3=isDown?'100,200,255':'255,160,210';
    ctx.save();ctx.globalAlpha=alpha;
    // Aura gradient
    const gr=ctx.createLinearGradient(g.x,0,g.x+g.w,0);
    gr.addColorStop(0,'rgba('+r1+',0)');
    gr.addColorStop(0.3,'rgba('+r1+',0.12)');
    gr.addColorStop(0.5,'rgba('+r2+',0.18)');
    gr.addColorStop(0.7,'rgba('+r1+',0.12)');
    gr.addColorStop(1,'rgba('+r1+',0)');
    ctx.fillStyle=gr;
    ctx.fillRect(g.x,0,g.w,H);
    // Flowing stream lines
    const t=frame*0.05;
    ctx.strokeStyle='rgba('+r3+','+0.25*alpha+')';
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
    // Particles flowing in the forced direction
    const flowDir=isDown?1:-1;
    ctx.fillStyle='rgba('+r3+','+0.5*alpha+')';
    for(let i=0;i<6;i++){
      const px=g.x+((frame*2+i*40)%Math.max(1,Math.floor(g.w)));
      const py=((frame*3*flowDir+i*70))%H;
      const ppy=py<0?py+H:py;
      ctx.beginPath();ctx.arc(px,ppy,2+Math.sin(frame*0.1+i)*1,0,6.28);ctx.fill();
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

  // Login screen
  if(state===ST.LOGIN){drawLogin();ctx.restore();return;}
  // Tutorial
  if(state===ST.TUTORIAL){drawTutorial();ctx.restore();return;}
  // Title and stage select: draw early, before game objects, to avoid leftover stage bleed
  if(state===ST.TITLE){drawDemo();drawTitle();drawCharModal();drawInventory();drawShop();drawCosmeticMenu();
    // Screen transition fade-in (white overlay fading out to reveal title)
    if(screenFadeIn>0){ctx.fillStyle='rgba(255,255,255,'+(screenFadeIn/90)+')';ctx.fillRect(0,0,W,H);}
    ctx.restore();return;}
  if(state===ST.STAGE_SEL){drawStageSel();ctx.restore();return;}

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
  if(state===ST.DEAD){drawDead();if(deadChestOpen&&chestOpen.phase!=='none')drawChestOpen();}
  if(state===ST.PAUSE)drawPause();
  if(state===ST.STAGE_CLEAR)drawStageClear();
  // Debug boss victory overlay
  if(debugBossVictoryT>0){
    const fadeIn=Math.min(1,debugBossVictoryT/30);
    ctx.fillStyle='rgba(0,0,0,'+(0.75*fadeIn)+')';ctx.fillRect(0,0,W,H);
    // Gold particles
    for(let i=0;i<15;i++){
      const sx=(Math.sin(i*4.1+debugBossVictoryT*0.02)*0.4+0.5)*W;
      const sy=(Math.cos(i*2.7+debugBossVictoryT*0.015)*0.4+0.3)*H;
      const sa=Math.sin(debugBossVictoryT*0.08+i)*0.3+0.3;
      ctx.fillStyle='rgba(255,215,0,'+sa*fadeIn+')';
      ctx.beginPath();ctx.arc(sx,sy,2+Math.sin(i+debugBossVictoryT*0.05),0,6.28);ctx.fill();
    }
    // Title
    const ps=1+Math.sin(debugBossVictoryT*0.04)*0.03;
    ctx.save();ctx.translate(W/2,H*0.30);ctx.scale(ps*fadeIn,ps*fadeIn);
    ctx.fillStyle='#ffd700';ctx.font='bold 24px monospace';ctx.textAlign='center';
    ctx.shadowColor='#ffd700';ctx.shadowBlur=20;
    ctx.fillText('BOSS DEFEATED!',0,0);
    ctx.shadowBlur=0;ctx.restore();
    ctx.fillStyle='#fff8';ctx.font='12px monospace';ctx.textAlign='center';
    ctx.fillText((debugLastBossType||'').toUpperCase()+' Lv.'+debugBossBc,W/2,H*0.36);
    // Buttons (show after fade in)
    if(debugBossVictoryT>30){
      const btnA=Math.min(1,(debugBossVictoryT-30)/20);
      ctx.globalAlpha=btnA;
      const bw=160,bh=40,bx=W/2-bw/2;
      // Retry button
      const retryY=H*0.50;
      ctx.fillStyle='#ff386022';rr(bx,retryY,bw,bh,10);ctx.fill();
      ctx.strokeStyle='#ff3860';ctx.lineWidth=2;rr(bx,retryY,bw,bh,10);ctx.stroke();
      ctx.fillStyle='#ff3860';ctx.font='bold 14px monospace';ctx.textAlign='center';
      ctx.fillText('\u30EA\u30C8\u30E9\u30A4',W/2,retryY+26);
      // Home button
      const homeY=H*0.60;
      ctx.fillStyle='#00e5ff22';rr(bx,homeY,bw,bh,10);ctx.fill();
      ctx.strokeStyle='#00e5ff';ctx.lineWidth=2;rr(bx,homeY,bw,bh,10);ctx.stroke();
      ctx.fillStyle='#00e5ff';ctx.font='bold 14px monospace';ctx.textAlign='center';
      ctx.fillText('\u30DB\u30FC\u30E0\u306B\u623B\u308B',W/2,homeY+26);
      ctx.globalAlpha=1;
    }
  }
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
  if(en.bossType==='guardian'){drawBossGuardian(en);return;}
  if(en.bossType==='wizard'){drawBossWizard(en);return;}
  if(en.type===1){drawShooter(en);return;}
  if(en.type===2){drawFlyer(en);return;}
  if(en.type===3){drawBomber(en);return;}
  if(en.type===4){drawVertMover(en);return;}
  if(en.type===5){drawPhantom(en);return;}
  if(en.type===6){drawDasher(en);return;}
  if(en.type===7){drawShielder(en);return;}
  if(en.type===8){drawSplitter(en);return;}
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
function drawDasher(en){
  const s=en.sz,ds=en.dashState;
  ctx.save();ctx.translate(en.x,en.y);
  // Shake during warning
  if(ds==='warn'){
    const shake=Math.sin(en.warnT*1.5)*(3-en.warnT*0.05);
    ctx.translate(shake,0);
  }
  // Body (red-orange aggressive wolf-like)
  const stretch=ds==='dash'?1.3:1;
  ctx.scale(stretch,1/stretch);
  const gr=ctx.createRadialGradient(0,0,0,0,0,s);
  gr.addColorStop(0,ds==='dash'?'#ff2222':'#e63946');gr.addColorStop(1,ds==='dash'?'#aa0000':'#9d0208');
  ctx.fillStyle=gr;
  ctx.beginPath();ctx.arc(0,-s*0.1,s*0.85,0,6.28);ctx.fill();
  // Speed lines during dash (behind the dash direction)
  if(ds==='dash'){
    ctx.strokeStyle='#ff444466';ctx.lineWidth=2;
    for(let i=0;i<3;i++){
      const ly=-s*0.5+i*s*0.4;
      ctx.beginPath();ctx.moveTo(-en.dashDir*s*1.2,ly);ctx.lineTo(-en.dashDir*s*2.5,ly);ctx.stroke();
    }
  }
  // Ears (pointed)
  ctx.fillStyle=ds==='warn'||ds==='dash'?'#ff4444':'#c1121f';
  ctx.beginPath();ctx.moveTo(-s*0.55,-s*0.5);ctx.lineTo(-s*0.35,-s*1.1);ctx.lineTo(-s*0.1,-s*0.5);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(s*0.55,-s*0.5);ctx.lineTo(s*0.35,-s*1.1);ctx.lineTo(s*0.1,-s*0.5);ctx.closePath();ctx.fill();
  // Eyes (glow red during warn/dash)
  const eyeCol=ds==='warn'||ds==='dash'?'#ff0':'#fff';
  ctx.fillStyle=eyeCol;
  ctx.beginPath();ctx.arc(-s*0.25,-s*0.2,s*0.2,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.25,-s*0.2,s*0.2,0,6.28);ctx.fill();
  if(ds==='warn'||ds==='dash'){
    ctx.shadowColor='#ff0';ctx.shadowBlur=8;
    ctx.fillStyle='#ff0000';
  } else {
    ctx.fillStyle='#1a0a00';
  }
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.22,s*0.1,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.3,-s*0.22,s*0.1,0,6.28);ctx.fill();
  ctx.shadowBlur=0;
  // Angry mouth
  ctx.strokeStyle=ds==='dash'?'#ffaa00':'#780000';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(-s*0.3,s*0.15);ctx.lineTo(-s*0.15,s*0.25);ctx.lineTo(0,s*0.15);
  ctx.lineTo(s*0.15,s*0.25);ctx.lineTo(s*0.3,s*0.15);ctx.stroke();
  // Feet (fast animation during dash)
  const stepSpd=ds==='dash'?6:2;
  const step=Math.sin(en.fr*stepSpd)*s*0.2;
  ctx.fillStyle='#780000';
  ctx.fillRect(-s*0.5+step,s*0.4,s*0.28,s*0.2);
  ctx.fillRect(s*0.22-step,s*0.4,s*0.28,s*0.2);
  // Warning indicator (! above head)
  if(ds==='warn'){
    const wa=Math.sin(en.warnT*0.3)*0.3+0.7;
    ctx.globalAlpha=wa;ctx.fillStyle='#ff0';ctx.font='bold 14px monospace';ctx.textAlign='center';
    ctx.fillText('!',0,-s*1.4);ctx.globalAlpha=1;
  }
  ctx.restore();
}
function drawShielder(en){
  const s=en.sz,flip=en.gDir;
  ctx.save();ctx.translate(en.x,en.y);
  if(flip===-1)ctx.scale(1,-1);
  // Body (armored blue-gray)
  const gr=ctx.createRadialGradient(0,0,0,0,0,s);
  gr.addColorStop(0,'#5577aa');gr.addColorStop(1,'#334466');
  ctx.fillStyle=gr;
  ctx.beginPath();ctx.arc(0,-s*0.1,s*0.85,0,6.28);ctx.fill();
  // Shield (on facing side)
  const sf=en.shieldFacing||(-1);
  ctx.fillStyle='#4488ff';
  ctx.strokeStyle='#aaccff';ctx.lineWidth=2;
  const shx=sf*s*0.65;
  ctx.beginPath();
  ctx.ellipse(shx,-s*0.05,s*0.25,s*0.7,0,0,6.28);ctx.fill();ctx.stroke();
  // Shield highlight
  ctx.fillStyle='#aaddff44';
  ctx.beginPath();ctx.ellipse(shx-sf*s*0.05,-s*0.25,s*0.08,s*0.3,0,0,6.28);ctx.fill();
  // Shield bolt
  ctx.fillStyle='#ffdd44';
  ctx.beginPath();ctx.arc(shx,-s*0.05,s*0.1,0,6.28);ctx.fill();
  // Eyes (peeking over shield)
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.25,s*0.18,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.2,-s*0.25,s*0.18,0,6.28);ctx.fill();
  ctx.fillStyle='#1a1a44';
  ctx.beginPath();ctx.arc(-s*0.15,-s*0.28,s*0.09,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.25,-s*0.28,s*0.09,0,6.28);ctx.fill();
  // Helmet
  ctx.fillStyle='#445588';
  ctx.beginPath();ctx.arc(0,-s*0.5,s*0.55,Math.PI,0);ctx.fill();
  ctx.fillStyle='#556699';
  ctx.beginPath();ctx.arc(0,-s*0.55,s*0.2,0,6.28);ctx.fill();
  // Feet
  const step=Math.sin(en.fr*2)*s*0.15;
  ctx.fillStyle='#2a3355';
  ctx.fillRect(-s*0.45+step,s*0.4,s*0.28,s*0.18);
  ctx.fillRect(s*0.17-step,s*0.4,s*0.28,s*0.18);
  ctx.restore();
}
function drawSplitter(en){
  const s=en.sz,flip=en.gDir;
  ctx.save();ctx.translate(en.x,en.y);
  if(flip===-1)ctx.scale(1,-1);
  // Body (green slime-like, slightly larger)
  const gr=ctx.createRadialGradient(0,-s*0.1,0,0,-s*0.1,s);
  gr.addColorStop(0,'#88cc44');gr.addColorStop(0.6,'#55aa22');gr.addColorStop(1,'#338811');
  ctx.fillStyle=gr;
  // Slime blob shape (wobbly)
  const wobble=Math.sin(en.fr*0.8)*s*0.08;
  ctx.beginPath();
  ctx.moveTo(-s*0.8-wobble,s*0.3);
  ctx.quadraticCurveTo(-s*0.9,s*-0.3,-s*0.4-wobble,-s*0.7);
  ctx.quadraticCurveTo(0,-s*1.0+wobble,s*0.4+wobble,-s*0.7);
  ctx.quadraticCurveTo(s*0.9,s*-0.3,s*0.8+wobble,s*0.3);
  ctx.quadraticCurveTo(s*0.4,s*0.5,0,s*0.4);
  ctx.quadraticCurveTo(-s*0.4,s*0.5,-s*0.8-wobble,s*0.3);
  ctx.closePath();ctx.fill();
  // Shine
  ctx.fillStyle='#bbff6644';
  ctx.beginPath();ctx.ellipse(-s*0.2,-s*0.3,s*0.15,s*0.25,0.3,0,6.28);ctx.fill();
  // Eyes
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(-s*0.25,-s*0.15,s*0.2,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.25,-s*0.15,s*0.2,0,6.28);ctx.fill();
  ctx.fillStyle='#1a3300';
  ctx.beginPath();ctx.arc(-s*0.2,-s*0.18,s*0.1,0,6.28);ctx.fill();
  ctx.beginPath();ctx.arc(s*0.3,-s*0.18,s*0.1,0,6.28);ctx.fill();
  // Split line (visual hint that this enemy splits)
  ctx.strokeStyle='#44660044';ctx.lineWidth=1.5;ctx.setLineDash([3,3]);
  ctx.beginPath();ctx.moveTo(0,-s*0.7);ctx.lineTo(0,s*0.35);ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
function drawBullet(b){
  ctx.save();ctx.translate(b.x,b.y);
  if(b.shockwave){
    // Shockwave: vertical energy wave traveling along floor
    const alpha=Math.min(1,b.life/20);
    ctx.globalAlpha=alpha;
    const waveH=30+Math.sin(b.life*0.3)*5;
    const gr=ctx.createLinearGradient(0,0,0,-waveH);
    gr.addColorStop(0,'#ffaa00');gr.addColorStop(0.5,'#ff660088');gr.addColorStop(1,'#ff660000');
    ctx.fillStyle=gr;
    ctx.beginPath();ctx.moveTo(-b.sz*0.6,0);ctx.lineTo(-b.sz*0.2,-waveH);
    ctx.lineTo(b.sz*0.2,-waveH);ctx.lineTo(b.sz*0.6,0);ctx.closePath();ctx.fill();
    // Bright core
    ctx.fillStyle='#ffdd44';ctx.beginPath();
    ctx.moveTo(-b.sz*0.3,0);ctx.lineTo(0,-waveH*0.7);ctx.lineTo(b.sz*0.3,0);ctx.closePath();ctx.fill();
    ctx.globalAlpha=1;ctx.restore();return;
  }
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

function drawCharacter(x,y,charIdx,r,rot,alpha,face,dmgLevel,showCosmetics){
  dmgLevel=dmgLevel||0; // 0=full HP, 1=hurt once, 2=critical
  if(showCosmetics===undefined)showCosmetics=(charIdx===selChar);
  const ch=CHARS[charIdx];
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.globalAlpha=alpha;
  // Apply skin color override (always, even when damaged)
  const skinData=showCosmetics?getEquippedSkinData():null;
  let bodyCol=ch.col,bodyCol2=ch.col2;
  if(skinData){
    if(skinData.col==='rainbow'){
      bodyCol=`hsl(${(frame*3)%360},90%,60%)`;bodyCol2=`hsl(${((frame*3)+40)%360},80%,40%)`;
    } else {bodyCol=skinData.col;bodyCol2=skinData.col2;}
  }
  const gr=ctx.createRadialGradient(0,0,0,0,0,r);
  // Keep skin color intact even when damaged (damage shown via overlays only)
  gr.addColorStop(0,bodyCol);gr.addColorStop(1,bodyCol2);

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
        // Happy smiling eyes (^_^)
        ctx.strokeStyle=ch.eye;ctx.lineWidth=2;ctx.lineCap='round';
        ctx.beginPath();ctx.arc(ex,ey2,es*0.8,Math.PI+0.3,2*Math.PI-0.3);ctx.stroke();
        ctx.fillStyle=ch.eye;ctx.beginPath();ctx.arc(ex-es*0.3,ey2-es*0.2,es*0.12,0,6.28);ctx.fill();
        break;
      case'angry':
        // Angry eyes with angled brows
        ctx.fillStyle='#ff2200';ctx.beginPath();ctx.arc(ex,ey2,es,0,6.28);ctx.fill();
        ctx.fillStyle='#ffcc00';ctx.beginPath();ctx.arc(ex+r*0.06,ey2,es*0.45,0,6.28);ctx.fill();
        ctx.fillStyle='#111';ctx.beginPath();ctx.arc(ex+r*0.08,ey2,es*0.2,0,6.28);ctx.fill();
        // Angry brow
        ctx.strokeStyle='#ff2200';ctx.lineWidth=2.5;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(ex-es*0.8,ey2-es*1.1);ctx.lineTo(ex+es*0.5,ey2-es*0.7);ctx.stroke();
        break;
      case'star':
        ctx.fillStyle=ch.eye;
        for(let si=0;si<5;si++){const a=-Math.PI/2+si*Math.PI*2/5,a2=a+Math.PI/5;
          if(si===0)ctx.beginPath();
          ctx.lineTo(ex+Math.cos(a)*es,ey2+Math.sin(a)*es);
          ctx.lineTo(ex+Math.cos(a2)*es*0.45,ey2+Math.sin(a2)*es*0.45);
        }ctx.closePath();ctx.fill();
        ctx.fillStyle=ch.pupil;ctx.beginPath();ctx.arc(ex+r*0.06,ey2,es*0.35,0,6.28);ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex+r*0.12,ey2-es*0.2,es*0.15,0,6.28);ctx.fill();
        break;
      case'heart':
        ctx.fillStyle='#ff4488';
        ctx.save();ctx.translate(ex,ey2);
        const hs=es*0.7;ctx.beginPath();ctx.moveTo(0,hs*0.5);
        ctx.bezierCurveTo(-hs*0.1,hs*0.2,-hs,0,-hs,-hs*0.4);
        ctx.bezierCurveTo(-hs,-hs*0.8,0,-hs*0.6,0,-hs*0.2);
        ctx.bezierCurveTo(0,-hs*0.6,hs,-hs*0.8,hs,-hs*0.4);
        ctx.bezierCurveTo(hs,0,hs*0.1,hs*0.2,0,hs*0.5);ctx.fill();ctx.restore();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex-es*0.15,ey2-es*0.15,es*0.12,0,6.28);ctx.fill();
        break;
      case'fire':
        ctx.fillStyle='#ff2200';ctx.beginPath();ctx.arc(ex,ey2,es,0,6.28);ctx.fill();
        ctx.fillStyle='#ff6600';ctx.beginPath();ctx.arc(ex+r*0.04,ey2,es*0.65,0,6.28);ctx.fill();
        ctx.fillStyle='#ffcc00';ctx.beginPath();ctx.arc(ex+r*0.08,ey2,es*0.3,0,6.28);ctx.fill();
        break;
      case'cat':
        ctx.fillStyle='#ccff44';ctx.beginPath();ctx.ellipse(ex,ey2,es,es*0.9,0,0,6.28);ctx.fill();
        ctx.fillStyle='#111';
        ctx.beginPath();ctx.ellipse(ex+r*0.06,ey2,es*0.12,es*0.7,0,0,6.28);ctx.fill();
        break;
      case'spiral':
        ctx.fillStyle=ch.eye;ctx.beginPath();ctx.arc(ex,ey2,es,0,6.28);ctx.fill();
        ctx.strokeStyle=ch.pupil;ctx.lineWidth=1.5;ctx.beginPath();
        for(let si=0;si<20;si++){const sa=si*0.8,sr=es*0.1+si*es*0.035;
          const sx=ex+Math.cos(sa+(typeof frame!=='undefined'?frame*0.1:0))*sr;
          const sy=ey2+Math.sin(sa+(typeof frame!=='undefined'?frame*0.1:0))*sr;
          if(si===0)ctx.moveTo(sx,sy);else ctx.lineTo(sx,sy);
        }ctx.stroke();
        break;
      case'cyber':
        ctx.fillStyle='#00ff88';ctx.beginPath();ctx.arc(ex,ey2,es,0,6.28);ctx.fill();
        ctx.strokeStyle='#003322';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(ex-es,ey2);ctx.lineTo(ex+es,ey2);ctx.stroke();
        ctx.beginPath();ctx.moveTo(ex,ey2-es);ctx.lineTo(ex,ey2+es);ctx.stroke();
        ctx.fillStyle='#003322';ctx.beginPath();ctx.arc(ex+r*0.06,ey2,es*0.25,0,6.28);ctx.fill();
        ctx.fillStyle='#00ff88';ctx.beginPath();ctx.arc(ex+r*0.08,ey2,es*0.1,0,6.28);ctx.fill();
        break;
      case'diamond':
        ctx.fillStyle='#aaeeff';
        ctx.beginPath();ctx.moveTo(ex,ey2-es);ctx.lineTo(ex+es*0.7,ey2);
        ctx.lineTo(ex,ey2+es);ctx.lineTo(ex-es*0.7,ey2);ctx.closePath();ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.6)';
        ctx.beginPath();ctx.moveTo(ex,ey2-es);ctx.lineTo(ex+es*0.3,ey2);ctx.lineTo(ex,ey2*0.5);ctx.closePath();ctx.fill();
        break;
      case'void':
        ctx.fillStyle='#111';ctx.beginPath();ctx.arc(ex,ey2,es,0,6.28);ctx.fill();
        ctx.fillStyle='#330044';ctx.beginPath();ctx.arc(ex,ey2,es*0.7,0,6.28);ctx.fill();
        ctx.fillStyle='#220033';ctx.beginPath();ctx.arc(ex,ey2,es*0.4,0,6.28);ctx.fill();
        // Tiny white dot
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex+r*0.04,ey2-es*0.1,es*0.08,0,6.28);ctx.fill();
        break;
      case'galaxy':
        ctx.fillStyle='#0a0a2e';ctx.beginPath();ctx.arc(ex,ey2,es,0,6.28);ctx.fill();
        // Swirling galaxy dots
        for(let gi=0;gi<6;gi++){const ga=gi*1.047+(typeof frame!=='undefined'?frame*0.04:0),gd=es*(0.3+gi*0.1);
          ctx.fillStyle=`hsla(${(gi*60+200)%360},80%,70%,0.7)`;
          ctx.beginPath();ctx.arc(ex+Math.cos(ga)*gd,ey2+Math.sin(ga)*gd,es*0.08,0,6.28);ctx.fill();}
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey2,es*0.12,0,6.28);ctx.fill();
        break;
      case'glitch':
        ctx.fillStyle=ch.eye;ctx.beginPath();ctx.arc(ex,ey2,es,0,6.28);ctx.fill();
        ctx.fillStyle=ch.pupil;ctx.beginPath();ctx.arc(ex+r*0.08,ey2,es*0.5,0,6.28);ctx.fill();
        // Glitch offset slices
        const gt=typeof frame!=='undefined'?frame:0;
        if(gt%30<5){ctx.fillStyle='#ff004488';ctx.fillRect(ex-es,ey2-es*0.3,es*2,es*0.2);
          ctx.fillStyle='#00ff4488';ctx.fillRect(ex-es+2,ey2+es*0.1,es*2,es*0.15);}
        break;
      default:
        ctx.fillStyle=ch.eye;ctx.beginPath();ctx.arc(ex,ey2,es,0,6.28);ctx.fill();
        ctx.fillStyle=ch.pupil;ctx.beginPath();ctx.arc(ex+r*0.08,ey2,es*0.5,0,6.28);ctx.fill();
    }
    if(face==='happy'){ctx.strokeStyle=ch.eye;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(r*0.15,eY+r*0.3,r*0.15,0.2,Math.PI-0.2);ctx.stroke();}
    if(face==='hurt'){ctx.strokeStyle=ch.eye;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-r*0.1,eY+r*0.4);ctx.lineTo(r*0.05,eY+r*0.3);ctx.lineTo(r*0.2,eY+r*0.45);ctx.lineTo(r*0.35,eY+r*0.3);ctx.stroke();}
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
    ctx.beginPath();ctx.arc(player.x,player.y,pr*1.2,0,6.28);ctx.fill();
  }
  // Ghost character: always draw upright (don't flip body when gravity reverses)
  const charRot=ct().shape==='ghost'?0:player.rot;
  // Draw equipped effect behind character
  const fxData=getEquippedEffectData();
  if(fxData)drawPlayerEffect(player.x,player.y,pr,fxData.type,ghostA);
  drawCharacter(player.x,player.y,selChar,pr,charRot,ghostA,player.face,dmgLv);
}

function drawPlayerEffect(px,py,pr,fxType,alpha){
  ctx.save();ctx.globalAlpha=alpha*0.8;
  const t=frame||0;
  switch(fxType){
    case'sparkle':
      for(let i=0;i<5;i++){
        const a=t*0.08+i*1.256,d=pr*1.3+Math.sin(t*0.12+i)*4;
        const sx=px+Math.cos(a)*d,sy=py+Math.sin(a)*d;
        const ss=2+Math.sin(t*0.15+i*2)*1.5;
        ctx.fillStyle=`hsla(${(t*4+i*60)%360},100%,80%,${0.7+Math.sin(t*0.2+i)*0.3})`;
        ctx.beginPath();ctx.arc(sx,sy,ss,0,6.28);ctx.fill();
      }break;
    case'fire_aura':
      for(let i=0;i<6;i++){
        const a=t*0.06+i*1.047,d=pr*1.1+Math.sin(t*0.1+i*0.7)*3;
        const fx=px+Math.cos(a)*d,fy=py+Math.sin(a)*d-Math.abs(Math.sin(t*0.15+i))*6;
        ctx.fillStyle=`rgba(${200+Math.floor(Math.sin(t*0.1+i)*55)},${60+Math.floor(i*15)},0,${0.5+Math.sin(t*0.2+i)*0.2})`;
        ctx.beginPath();ctx.arc(fx,fy,3+Math.sin(t*0.12+i)*1.5,0,6.28);ctx.fill();
      }break;
    case'ice_aura':
      for(let i=0;i<6;i++){
        const a=t*0.05+i*1.047,d=pr*1.1+Math.sin(t*0.08+i*0.7)*3;
        const fx=px+Math.cos(a)*d,fy=py+Math.sin(a)*d;
        ctx.fillStyle=`rgba(${100+Math.floor(i*20)},${200+Math.floor(Math.sin(t*0.1+i)*40)},255,${0.4+Math.sin(t*0.15+i)*0.2})`;
        ctx.beginPath();ctx.arc(fx,fy,2.5+Math.sin(t*0.1+i)*1,0,6.28);ctx.fill();
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
      for(let i=0;i<3;i++){
        const hy=py-pr*1.5-((t*1.5+i*30)%50),hx=px+Math.sin(t*0.05+i*2)*pr*0.8;
        const ha=1-((t*1.5+i*30)%50)/50;
        if(ha>0){ctx.globalAlpha=alpha*ha*0.7;ctx.fillStyle='#ff6688';ctx.font=(8+i*2)+'px monospace';ctx.textAlign='center';ctx.fillText('\u2665',hx,hy);}
      }ctx.globalAlpha=alpha*0.8;break;
    case'shadow':
      const sg=ctx.createRadialGradient(px,py,pr*0.5,px,py,pr*1.8);
      sg.addColorStop(0,'rgba(30,0,50,0)');sg.addColorStop(0.5,`rgba(60,0,80,${0.15+Math.sin(t*0.08)*0.05})`);
      sg.addColorStop(1,'rgba(30,0,50,0)');
      ctx.fillStyle=sg;ctx.beginPath();ctx.arc(px,py,pr*1.8,0,6.28);ctx.fill();
      break;
    case'rainbow':
      const rg=ctx.createRadialGradient(px,py,pr*0.8,px,py,pr*1.6);
      rg.addColorStop(0,'rgba(255,255,255,0)');
      rg.addColorStop(0.5,`hsla(${(t*5)%360},100%,70%,0.15)`);
      rg.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=rg;ctx.beginPath();ctx.arc(px,py,pr*1.6,0,6.28);ctx.fill();
      for(let i=0;i<4;i++){const a=t*0.07+i*1.57,d=pr*1.3;
        ctx.fillStyle=`hsla(${(t*6+i*90)%360},100%,70%,0.6)`;
        ctx.beginPath();ctx.arc(px+Math.cos(a)*d,py+Math.sin(a)*d,2.5,0,6.28);ctx.fill();
      }break;
    case'sakura':
      for(let i=0;i<4;i++){
        const sy2=py-pr*1.2-((t*0.8+i*25)%60),sx2=px+Math.sin(t*0.04+i*1.5)*pr*1.2;
        const sa2=1-((t*0.8+i*25)%60)/60;
        if(sa2>0){ctx.globalAlpha=alpha*sa2*0.8;ctx.fillStyle='#ffb7c5';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('\u273f',sx2,sy2);}
      }ctx.globalAlpha=alpha*0.8;break;
    case'star_trail':
      for(let i=0;i<4;i++){
        const sd=pr*0.8+i*4,sa3=t*0.06-i*0.3;
        const stx=px+Math.cos(sa3)*sd*0.5-sd*0.3,sty=py+Math.sin(sa3)*sd*0.3;
        ctx.globalAlpha=alpha*(0.7-i*0.15);ctx.fillStyle='#ffd700';
        ctx.beginPath();
        for(let si=0;si<5;si++){const a5=-Math.PI/2+si*Math.PI*2/5,a5b=a5+Math.PI/5,sr=2.5-i*0.3;
          ctx.lineTo(stx+Math.cos(a5)*sr,sty+Math.sin(a5)*sr);
          ctx.lineTo(stx+Math.cos(a5b)*sr*0.4,sty+Math.sin(a5b)*sr*0.4);
        }ctx.closePath();ctx.fill();
      }ctx.globalAlpha=alpha*0.8;break;
    case'plasma_trail':
      for(let i=0;i<5;i++){
        const a=t*0.09+i*1.256,d=pr*1.2+Math.sin(t*0.14+i)*5;
        const ptx=px+Math.cos(a)*d,pty=py+Math.sin(a)*d;
        ctx.fillStyle=`hsla(${280+Math.sin(t*0.05+i)*40},100%,${60+Math.sin(t*0.1+i)*20}%,${0.5+Math.sin(t*0.2+i)*0.3})`;
        ctx.beginPath();ctx.arc(ptx,pty,3+Math.sin(t*0.12+i)*1.5,0,6.28);ctx.fill();
      }break;
    case'void_aura':
      const vg=ctx.createRadialGradient(px,py,pr*0.3,px,py,pr*2.0);
      vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(0.4,`rgba(10,0,20,${0.2+Math.sin(t*0.06)*0.08})`);
      vg.addColorStop(0.8,`rgba(20,0,40,${0.1+Math.sin(t*0.08)*0.05})`);vg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=vg;ctx.beginPath();ctx.arc(px,py,pr*2.0,0,6.28);ctx.fill();
      for(let i=0;i<3;i++){const va=t*0.04+i*2.09,vd=pr*1.5;
        ctx.fillStyle=`rgba(40,0,60,${0.4+Math.sin(t*0.1+i)*0.2})`;
        ctx.beginPath();ctx.arc(px+Math.cos(va)*vd,py+Math.sin(va)*vd,2,0,6.28);ctx.fill();
      }break;
  }
  ctx.restore();
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

  // Player name
  if(playerName){
    ctx.fillStyle='#fff8';ctx.font='bold 14px monospace';ctx.textAlign='center';
    ctx.fillText(playerName,W/2,H*0.18+92);
  }

  // Character selection: 2 rows x 3 columns
  ctx.fillStyle='#fff8';ctx.font='bold 13px monospace';ctx.textAlign='center';
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
        // Secret: black silhouette only (design completely hidden)
        ctx.save();
        // Draw character to get shape, then cover with black
        ctx.globalAlpha=0.6;
        // Black silhouette: draw character shape filled with black
        const sx=cx+charW/2,sy=cy+charH/2-8,sr=14;
        ctx.fillStyle='#111118';
        // Draw the character shape as a black blob silhouette
        const shape=CHARS[idx].shape;
        if(shape==='cube'){ctx.fillRect(sx-sr,sy-sr,sr*2,sr*2);}
        else if(shape==='ball'){ctx.beginPath();ctx.arc(sx,sy,sr,0,6.28);ctx.fill();}
        else if(shape==='tire'){ctx.beginPath();ctx.arc(sx,sy,sr,0,6.28);ctx.fill();ctx.fillStyle='#0a0a12';ctx.beginPath();ctx.arc(sx,sy,sr*0.5,0,6.28);ctx.fill();}
        else if(shape==='ghost'){ctx.beginPath();ctx.arc(sx,sy-sr*0.2,sr,0,Math.PI,true);ctx.lineTo(sx-sr,sy+sr*0.8);for(let wi=0;wi<4;wi++){const wx=sx-sr+wi*(sr*2/4)+sr*2/8;ctx.quadraticCurveTo(wx,sy+sr*1.1,wx+sr*2/8,sy+sr*0.8);}ctx.closePath();ctx.fill();}
        else if(shape==='ninja'){ctx.beginPath();ctx.moveTo(sx,sy-sr);ctx.lineTo(sx+sr,sy+sr*0.6);ctx.lineTo(sx-sr,sy+sr*0.6);ctx.closePath();ctx.fill();ctx.beginPath();ctx.arc(sx,sy-sr*0.1,sr*0.7,0,6.28);ctx.fill();}
        else if(shape==='stone'){ctx.beginPath();ctx.moveTo(sx,sy-sr);ctx.lineTo(sx+sr*0.9,sy-sr*0.3);ctx.lineTo(sx+sr,sy+sr*0.5);ctx.lineTo(sx+sr*0.5,sy+sr);ctx.lineTo(sx-sr*0.5,sy+sr);ctx.lineTo(sx-sr,sy+sr*0.5);ctx.lineTo(sx-sr*0.9,sy-sr*0.3);ctx.closePath();ctx.fill();}
        else{ctx.beginPath();ctx.arc(sx,sy,sr,0,6.28);ctx.fill();}
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
  {
    let statLines=0;
    if(highScore>0) statLines++;
    statLines++; // coins always shown
    if(played>0) statLines++;
    const statsPanelH=statLines*16+6;
    ctx.fillStyle='rgba(0,0,0,0.35)';rr(W/2-100,statsY,200,statsPanelH,8);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=1;rr(W/2-100,statsY,200,statsPanelH,8);ctx.stroke();
    let lineIdx=0;
    if(highScore>0){ctx.fillStyle='#ffd700';ctx.font='bold 13px monospace';ctx.textAlign='center';ctx.fillText('\u30D9\u30B9\u30C8: '+highScore,W/2,statsY+16+lineIdx*16);lineIdx++;}
    ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText('\u25CF '+walletCoins,W/2,statsY+16+lineIdx*16);lineIdx++;
    if(played>0){ctx.fillStyle='#fff3';ctx.font='11px monospace';ctx.fillText('\u30D7\u30EC\u30A4\u56DE\u6570: '+played,W/2,statsY+16+lineIdx*16);}
  }

  // Endless mode button
  const ebx=btnStartX;
  ctx.fillStyle='#00e5ff22';rr(ebx,btnY,btnW,btnH,8);ctx.fill();
  ctx.strokeStyle='#00e5ff';ctx.lineWidth=1.5;rr(ebx,btnY,btnW,btnH,8);ctx.stroke();
  ctx.fillStyle='#00e5ff';ctx.font='bold 13px monospace';ctx.textAlign='center';
  ctx.fillText('エンドレス',ebx+btnW/2,btnY+24);
  // Stage mode button (disabled - coming soon)
  const sbx=btnStartX+btnW+btnGap;
  ctx.fillStyle='#ffffff08';rr(sbx,btnY,btnW,btnH,8);ctx.fill();
  ctx.strokeStyle='#ffffff33';ctx.lineWidth=1.5;rr(sbx,btnY,btnW,btnH,8);ctx.stroke();
  ctx.fillStyle='#ffffff44';ctx.font='bold 13px monospace';
  ctx.fillText('\u30B9\u30C6\u30FC\u30B8',sbx+btnW/2,btnY+20);
  ctx.fillStyle='#ffffff33';ctx.font='9px monospace';
  ctx.fillText('\u8FD1\u65E5\u516C\u958B',sbx+btnW/2,btnY+34);

  ctx.fillStyle='#667';ctx.font='10px monospace';ctx.textAlign='center';
  ctx.fillText('\u30BF\u30C3\u30D7=\u30B8\u30E3\u30F3\u30D7 / \u30B9\u30EF\u30A4\u30D7=\u91CD\u529B\u53CD\u8EE2',W/2,H*0.93);

  // Ranking button (top left, row 1)
  ctx.fillStyle='#ffffff14';rr(8,safeTop+6,36,36,8);ctx.fill();
  ctx.strokeStyle='#ffd70044';ctx.lineWidth=1;rr(8,safeTop+6,36,36,8);ctx.stroke();
  ctx.fillStyle='#ffd700';ctx.font='16px monospace';ctx.textAlign='center';
  ctx.fillText('\uD83C\uDFC6',26,safeTop+30);

  // Inventory button (top left, row 2) - chest icon with ! badge
  ctx.fillStyle='#ffffff14';rr(8,safeTop+44,36,36,8);ctx.fill();
  ctx.fillStyle='#ffd700';ctx.font='18px monospace';ctx.textAlign='center';
  ctx.fillText('\uD83D\uDCE6',26,safeTop+68);
  if(storedChests>0){
    const bp=Math.sin(titleT*2)*0.15+1;
    ctx.save();ctx.translate(38,safeTop+48);ctx.scale(bp,bp);
    ctx.fillStyle='#ff3860';ctx.beginPath();ctx.arc(0,0,8,0,6.28);ctx.fill();
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

  // Debug button (top right, left of settings)
  ctx.fillStyle='#ff386014';rr(W-84,safeTop+6,36,36,8);ctx.fill();
  ctx.strokeStyle='#ff386044';ctx.lineWidth=1;rr(W-84,safeTop+6,36,36,8);ctx.stroke();
  ctx.fillStyle='#ff3860aa';ctx.font='bold 9px monospace';ctx.textAlign='center';
  ctx.fillText('DEBUG',W-66,safeTop+28);

  // Settings gear button (top right)
  ctx.fillStyle='#ffffff14';rr(W-44,safeTop+6,36,36,8);ctx.fill();
  ctx.fillStyle='#fff6';ctx.font='18px monospace';ctx.textAlign='center';
  ctx.fillText('\u2699',W-26,safeTop+30);

  // Settings panel overlay
  if(settingsOpen){
    ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(0,0,W,H);
    const pw=Math.min(280,W-30),ph=330,px=W/2-pw/2,py=H/2-ph/2;
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
    // Player name display
    ctx.fillStyle='#fff6';ctx.font='10px monospace';ctx.textAlign='left';
    ctx.fillText('\u30D7\u30EC\u30A4\u30E4\u30FC: '+playerName,slX,slY2+32);
    // Tutorial replay button
    const tutBtnY=slY2+44;
    ctx.fillStyle='#ffd70022';rr(px+20,tutBtnY,pw-40,30,6);ctx.fill();
    ctx.strokeStyle='#ffd70066';ctx.lineWidth=1;rr(px+20,tutBtnY,pw-40,30,6);ctx.stroke();
    ctx.fillStyle='#ffd700';ctx.font='12px monospace';ctx.textAlign='center';
    ctx.fillText('\u30C1\u30E5\u30FC\u30C8\u30EA\u30A2\u30EB\u3092\u3084\u308A\u76F4\u3059',W/2,tutBtnY+20);
    // Data reset button
    const resetBtnY=tutBtnY+38;
    if(resetConfirmStep===0){
      ctx.fillStyle='#ff444422';rr(px+20,resetBtnY,pw-40,30,6);ctx.fill();
      ctx.strokeStyle='#ff444466';ctx.lineWidth=1;rr(px+20,resetBtnY,pw-40,30,6);ctx.stroke();
      ctx.fillStyle='#ff4444';ctx.font='12px monospace';ctx.textAlign='center';
      ctx.fillText('\u30C7\u30FC\u30BF\u521D\u671F\u5316',W/2,resetBtnY+20);
    } else if(resetConfirmStep===1){
      ctx.fillStyle='#ff444444';rr(px+20,resetBtnY,pw-40,30,6);ctx.fill();
      ctx.strokeStyle='#ff4444';ctx.lineWidth=2;rr(px+20,resetBtnY,pw-40,30,6);ctx.stroke();
      ctx.fillStyle='#ff4444';ctx.font='bold 12px monospace';ctx.textAlign='center';
      ctx.fillText('\u672C\u5F53\u306B\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F',W/2,resetBtnY+20);
    } else if(resetConfirmStep===2){
      const blink=Math.sin(Date.now()*0.01)*0.3+0.7;
      ctx.fillStyle='rgba(255,68,68,'+(0.3*blink)+')';rr(px+20,resetBtnY,pw-40,30,6);ctx.fill();
      ctx.strokeStyle='#ff0000';ctx.lineWidth=2;rr(px+20,resetBtnY,pw-40,30,6);ctx.stroke();
      ctx.fillStyle='#ff0000';ctx.font='bold 12px monospace';ctx.textAlign='center';
      ctx.fillText('\u6700\u7D42\u78BA\u8A8D: \u30BF\u30C3\u30D7\u3067\u5B8C\u5168\u524A\u9664',W/2,resetBtnY+20);
    }
    // Close button
    const closeY=py+ph-42;
    ctx.fillStyle='#00e5ff22';rr(W/2-60,closeY,120,32,8);ctx.fill();
    ctx.strokeStyle='#00e5ff';ctx.lineWidth=1;rr(W/2-60,closeY,120,32,8);ctx.stroke();
    ctx.fillStyle='#00e5ff';ctx.font='bold 13px monospace';ctx.textAlign='center';
    ctx.fillText('\u9589\u3058\u308B',W/2,closeY+22);
  }

  // Debug test panel
  if(debugMenuOpen){
    ctx.fillStyle='rgba(0,0,0,0.85)';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#ff3860';ctx.font='bold 16px monospace';ctx.textAlign='center';
    ctx.fillText('DEBUG MENU',W/2,safeTop+36);
    // Difficulty selector
    ctx.fillStyle='#fff8';ctx.font='11px monospace';
    ctx.fillText('\u96E3\u6613\u5EA6: '+debugBossBc,W/2,safeTop+54);
    const bcBtnW=36,bcBtnH=26;
    const bcY=safeTop+60;
    ctx.fillStyle='#ffffff18';rr(W/2-60,bcY,bcBtnW,bcBtnH,6);ctx.fill();
    ctx.strokeStyle='#fff4';ctx.lineWidth=1;rr(W/2-60,bcY,bcBtnW,bcBtnH,6);ctx.stroke();
    ctx.fillStyle='#fff';ctx.font='bold 14px monospace';ctx.fillText('-',W/2-42,bcY+19);
    ctx.fillStyle='#ffffff18';rr(W/2+24,bcY,bcBtnW,bcBtnH,6);ctx.fill();
    ctx.strokeStyle='#fff4';ctx.lineWidth=1;rr(W/2+24,bcY,bcBtnW,bcBtnH,6);ctx.stroke();
    ctx.fillStyle='#fff';ctx.fillText('+',W/2+42,bcY+19);
    // Boss section
    ctx.fillStyle='#ff3860aa';ctx.font='bold 11px monospace';
    ctx.fillText('--- BOSS ---',W/2,bcY+bcBtnH+14);
    const bosses=[
      {id:'guardian',name:'\u30AC\u30FC\u30C7\u30A3\u30A2\u30F3',col:'#4488cc'},
      {id:'bruiser',name:'\u30D6\u30EB\u30FC\u30B6\u30FC',col:'#9333ea'},
      {id:'wizard',name:'\u30A6\u30A3\u30B6\u30FC\u30C9',col:'#aa44ff'},
      {id:'dodge',name:'\u30C9\u30C3\u30B8',col:'#8a6a4a'}
    ];
    const bbW=Math.min(180,W-40),bbH=32,bbGap=5;
    const bbX=W/2-bbW/2;
    let bbY=bcY+bcBtnH+22;
    bosses.forEach(b=>{
      ctx.fillStyle=b.col+'22';rr(bbX,bbY,bbW,bbH,6);ctx.fill();
      ctx.strokeStyle=b.col;ctx.lineWidth=1.5;rr(bbX,bbY,bbW,bbH,6);ctx.stroke();
      ctx.fillStyle=b.col;ctx.font='bold 12px monospace';ctx.textAlign='center';
      ctx.fillText(b.name,W/2,bbY+22);
      bbY+=bbH+bbGap;
    });
    // Enemy section
    bbY+=6;
    ctx.fillStyle='#34d399aa';ctx.font='bold 11px monospace';
    ctx.fillText('--- \u30B6\u30B3\u654C ---',W/2,bbY);
    bbY+=8;
    const enemyTypes=[
      {id:0,name:'\u30A6\u30A9\u30FC\u30AB\u30FC',col:'#34d399'},
      {id:1,name:'\u30AD\u30E3\u30CE\u30F3',col:'#ef4444'},
      {id:2,name:'\u30D5\u30E9\u30A4\u30E4\u30FC',col:'#60a5fa'},
      {id:3,name:'\u30DC\u30DE\u30FC',col:'#f59e0b'},
      {id:4,name:'\u30D0\u30A6\u30F3\u30B5\u30FC',col:'#a78bfa'},
      {id:5,name:'\u30D5\u30A1\u30F3\u30C8\u30E0',col:'#e879f9'},
      {id:6,name:'\u30C0\u30C3\u30B7\u30E3\u30FC',col:'#ff4444'}
    ];
    enemyTypes.forEach(e=>{
      ctx.fillStyle=e.col+'22';rr(bbX,bbY,bbW,bbH,6);ctx.fill();
      ctx.strokeStyle=e.col;ctx.lineWidth=1.5;rr(bbX,bbY,bbW,bbH,6);ctx.stroke();
      ctx.fillStyle=e.col;ctx.font='bold 12px monospace';ctx.textAlign='center';
      ctx.fillText(e.name,W/2,bbY+22);
      bbY+=bbH+bbGap;
    });
    // Close button
    const clY=bbY+6;
    ctx.fillStyle='#ffffff12';rr(W/2-50,clY,100,30,8);ctx.fill();
    ctx.strokeStyle='#fff4';ctx.lineWidth=1;rr(W/2-50,clY,100,30,8);ctx.stroke();
    ctx.fillStyle='#fff8';ctx.font='bold 12px monospace';
    ctx.fillText('\u9589\u3058\u308B',W/2,clY+20);
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
    const hdrH=52;
    ctx.fillStyle='#1a1a2e';rr(mX,mY,mW,hdrH,12);ctx.fill();
    ctx.fillStyle='#ffd700';ctx.font='bold 18px monospace';ctx.textAlign='center';
    ctx.fillText('\uD83C\uDFC6 \u30E9\u30F3\u30AD\u30F3\u30B0',W/2,mY+22);
    ctx.fillStyle='#fff6';ctx.font='10px monospace';
    ctx.fillText('TOP 100 \u30D7\u30EC\u30A4\u30E4\u30FC',W/2,mY+40);
    // List area
    const listY=mY+hdrH+4;
    const listH=mH-hdrH-50;
    ctx.save();
    ctx.beginPath();ctx.rect(mX,listY,mW,listH);ctx.clip();
    const rowH=36;
    const scrollOff=-rankingScroll;
    RANKING_DATA.forEach((entry,i)=>{
      const ry=listY+i*rowH+scrollOff;
      if(ry+rowH<listY||ry>listY+listH)return; // skip offscreen
      const rank=entry.rank;
      // Row background
      if(entry.isPlayer){
        // Highlight player's own entry
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
        ctx.shadowColor='#ffd700';ctx.shadowBlur=8;
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
      // Character icon (exact drawCharacter with actual shape)
      const cix=mX+42,ciy=ry+16;
      drawCharacter(cix,ciy,entry.charIdx,9,0,1,'normal',0);
      // Name
      const nameX=mX+58;
      if(entry.isPlayer){ctx.fillStyle='#00e5ff';ctx.font='bold 12px monospace';}
      else if(rank===1){ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';}
      else if(rank===2){ctx.fillStyle='#e0e0e0';ctx.font='bold 12px monospace';}
      else if(rank===3){ctx.fillStyle='#dda060';ctx.font='bold 12px monospace';}
      else{ctx.fillStyle='#ccca';ctx.font='11px monospace';}
      ctx.textAlign='left';
      ctx.fillText(entry.name+(entry.isPlayer?' \u25C0':''),nameX,ry+22);
      // Score (right-aligned)
      const scX=mX+mW-14;
      if(entry.isPlayer){ctx.fillStyle='#00e5ff';ctx.font='bold 13px monospace';}
      else if(rank===1){ctx.fillStyle='#ffd700';ctx.font='bold 13px monospace';}
      else if(rank===2){ctx.fillStyle='#e0e0e0';ctx.font='bold 12px monospace';}
      else if(rank===3){ctx.fillStyle='#dda060';ctx.font='bold 12px monospace';}
      else{ctx.fillStyle='#fff6';ctx.font='11px monospace';}
      ctx.textAlign='right';
      ctx.fillText(entry.score.toLocaleString(),scX,ry+22);
    });
    ctx.restore();
    // Scroll indicator
    const totalH=RANKING_DATA.length*rowH;
    if(totalH>listH){
      const scrollRatio=rankingScroll/Math.max(1,totalH-listH);
      const thumbH=Math.max(20,listH*(listH/totalH));
      const thumbY=listY+scrollRatio*(listH-thumbH);
      ctx.fillStyle='#ffffff22';rr(mX+mW-6,thumbY,4,thumbH,2);ctx.fill();
    }
    // Footer
    const ftY=mY+mH-40;
    ctx.fillStyle='#ffffff12';rr(W/2-50,ftY,100,30,8);ctx.fill();
    ctx.strokeStyle='#fff2';ctx.lineWidth=1;rr(W/2-50,ftY,100,30,8);ctx.stroke();
    ctx.fillStyle='#fff8';ctx.font='bold 12px monospace';ctx.textAlign='center';
    ctx.fillText('\u9589\u3058\u308B',W/2,ftY+20);
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
  // Character traits display (clear, icon-based)
  const traitY=demoY+80;
  const traits=[];
  // Core stats differences from default
  if(ch.jumpMul>1)traits.push({icon:'\u2B06',text:'\u30B8\u30E3\u30F3\u30D7\u529B UP',col:'#00e5ff'});
  if(ch.jumpMul<1)traits.push({icon:'\u2B07',text:'\u30B8\u30E3\u30F3\u30D7\u529B DOWN',col:'#ff6b6b'});
  if(ch.speedMul>1)traits.push({icon:'\u26A1',text:'\u79FB\u52D5\u901F\u5EA6 UP',col:'#34d399'});
  if(ch.speedMul<1)traits.push({icon:'\u26A1',text:'\u79FB\u52D5\u901F\u5EA6 DOWN',col:'#ff6b6b'});
  if(ch.sizeMul<1)traits.push({icon:'\u25C6',text:'\u5C0F\u578B\u5224\u5B9A (\u5F53\u305F\u308A\u306B\u304F\u3044)',col:'#a855f7'});
  if(ch.sizeMul>1)traits.push({icon:'\u25C6',text:'\u5927\u578B\u5224\u5B9A',col:'#ff6b6b'});
  if(ch.gravMul>1)traits.push({icon:'\u2B07',text:'\u91CD\u529B UP (\u843D\u4E0B\u304C\u901F\u3044)',col:'#8B8B8B'});
  if(ch.hasDjump)traits.push({icon:'\u21C8',text:'\u5E38\u66422\u6BB5\u30B8\u30E3\u30F3\u30D7',col:'#ff6b6b'});
  if(ch.maxFlip>=3)traits.push({icon:'\u21BB',text:ch.maxFlip+'\u56DE\u53CD\u8EE2\u53EF\u80FD',col:'#34d399'});
  if(ch.startShield)traits.push({icon:'\u25CE',text:'\u521D\u671F\u30B7\u30FC\u30EB\u30C9\u4ED8\u304D',col:'#00e5ff'});
  if(ch.hpBonus)traits.push({icon:'\u2665',text:'HP +'+ch.hpBonus+' (\u8010\u4E45\u529B UP)',col:'#ff4444'});
  if(ch.stepTol)traits.push({icon:'\u2587',text:'\u6BB5\u5DEE\u4E57\u8D8A+\u5C0F\u6E9D\u901A\u904E',col:'#555555'});
  if(ch.shape==='ghost')traits.push({icon:'\u25CC',text:'\u5468\u671F\u7684\u306B\u900F\u660E\u5316 (\u653B\u6483\u56DE\u907F)',col:'#a855f7'});
  if(ch.shape==='tire')traits.push({icon:'\u2587',text:'\u6BB5\u5DEE\u4E57\u8D8A+\u5C0F\u6E9D\u901A\u904E',col:'#555555'});
  if(traits.length===0)traits.push({icon:'\u2605',text:'\u30D0\u30E9\u30F3\u30B9\u578B \u2015 \u30AF\u30BB\u306E\u306A\u3044\u6A19\u6E96\u6027\u80FD',col:'#00e5ff'});
  // Draw traits as list
  const tGap=18;
  const startY=traitY-((traits.length-1)*tGap)/2;
  traits.forEach((tr,i)=>{
    const ty2=startY+i*tGap;
    ctx.fillStyle=tr.col;ctx.font='bold 11px monospace';ctx.textAlign='center';
    ctx.fillText(tr.icon+' '+tr.text,W/2,ty2);
  });
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
  ctx.fillText('\uD83D\uDCE6 \u5B9D\u7BB1',W/2,mY+36);
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
    ctx.fillText('\u30BF\u30C3\u30D7\u3067\u958B\u5C01',cx,cy+72);
    // Batch open button (if 2+ chests)
    if(storedChests>=2){
      const boW=160,boH=34,boX=cx-boW/2,boY=cy+82;
      ctx.fillStyle='#ffd70018';rr(boX,boY,boW,boH,8);ctx.fill();
      ctx.strokeStyle='#ffd700';ctx.lineWidth=1.5;rr(boX,boY,boW,boH,8);ctx.stroke();
      ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';ctx.textAlign='center';
      ctx.fillText('\uD83D\uDCE6 \u307E\u3068\u3081\u3066\u958B\u5C01 ('+storedChests+')',cx,boY+22);
    }
    // Total opened
    ctx.fillStyle='#fff4';ctx.font='10px monospace';
    ctx.fillText('\u901A\u7B97 '+totalChestsOpened+' \u500B\u958B\u5C01',cx,mY+mH-48);
  } else {
    // No chests
    ctx.globalAlpha=0.3;
    ctx.save();ctx.translate(cx,cy);
    drawChestIcon(0,0,40,false);
    ctx.restore();
    ctx.globalAlpha=1;
    ctx.fillStyle='#fff4';ctx.font='14px monospace';ctx.textAlign='center';
    ctx.fillText('\u5B9D\u7BB1\u304C\u3042\u308A\u307E\u305B\u3093',cx,cy+48);
    ctx.fillStyle='#fff3';ctx.font='10px monospace';
    ctx.fillText('\u30DC\u30B9\u3092\u5012\u3057\u3066\u5B9D\u7BB1\u3092\u7372\u5F97\u3057\u3088\u3046',cx,cy+66);
    if(totalChestsOpened>0){
      ctx.fillStyle='#fff3';ctx.font='10px monospace';
      ctx.fillText('\u901A\u7B97 '+totalChestsOpened+' \u500B\u958B\u5C01',cx,mY+mH-48);
    }
  }
  // Footer close button
  const invCloseY=mY+mH-38;
  ctx.fillStyle='#ffffff12';rr(W/2-50,invCloseY,100,30,8);ctx.fill();
  ctx.strokeStyle='#fff2';ctx.lineWidth=1;rr(W/2-50,invCloseY,100,30,8);ctx.stroke();
  ctx.fillStyle='#fff8';ctx.font='bold 12px monospace';ctx.textAlign='center';
  ctx.fillText('\u9589\u3058\u308B',W/2,invCloseY+20);
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
  if(chestOpen.phase==='none')return;
  const p=chestOpen.phase,t=chestOpen.t;
  const rw=chestOpen.reward;
  const isChar=rw&&rw.type==='char';
  const isCosmetic=rw&&rw.type==='cosmetic';
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
  // Remaining chests in inventory
  if(storedChests>0){
    ctx.fillStyle='#ffaa00';ctx.font='10px monospace';
    ctx.fillText('残り '+storedChests+' 個',cx,mY+62);
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
    } else if(isCosmetic){
      // === COSMETIC REVEAL ===
      const revealT=Math.min(t/80,1);
      const ri=rw.item;
      const isRareItem=ri.rarity==='rare';
      const hue=isRareItem?(t*3)%360:200;
      const rbgA=isRareItem?0.12+Math.sin(t*0.05)*0.04:0.06;
      ctx.fillStyle=isRareItem?`hsla(${hue},70%,50%,${rbgA})`:`rgba(100,200,255,${rbgA})`;ctx.fillRect(mX,mY,mW,mH);
      // Open chest
      ctx.save();ctx.translate(cx,cy+40);ctx.scale(0.5,0.5);
      drawChestIcon(0,0,chSz,true);
      ctx.restore();
      // Item icon rising
      const itemY=cy-10-revealT*40;
      const itemScale=0.5+revealT*0.5;
      ctx.save();ctx.translate(cx,itemY);ctx.scale(itemScale,itemScale);
      ctx.shadowColor=isRareItem?`hsl(${hue},90%,60%)`:'#00aaff';ctx.shadowBlur=20;
      // Draw cosmetic preview
      if(ri.tab===0){
        if(ri.col==='rainbow'){const rg=ctx.createLinearGradient(-20,-20,20,20);rg.addColorStop(0,'#ff0000');rg.addColorStop(0.33,'#00ff00');rg.addColorStop(0.66,'#0000ff');rg.addColorStop(1,'#ff0000');ctx.fillStyle=rg;}
        else ctx.fillStyle=ri.col;
        ctx.beginPath();ctx.arc(0,0,24,0,6.28);ctx.fill();
      } else {
        ctx.fillStyle='#fff';ctx.font='40px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
        const allIcons={smile:'\u263A',angry:'\uD83D\uDE20',star:'\u2605',heart:'\u2665',fire:'\uD83D\uDD25',cat:'\uD83D\uDC31',spiral:'\uD83C\uDF00',cyber:'\u26A1',diamond:'\uD83D\uDC8E',void:'\uD83D\uDD73',galaxy:'\uD83C\uDF0C',glitch:'\u26A0',sparkle:'\u2728',fire_aura:'\uD83D\uDD25',ice_aura:'\u2744',electric:'\u26A1',hearts:'\u2665',shadow:'\uD83C\uDF11',rainbow:'\uD83C\uDF08',sakura:'\uD83C\uDF38',star_trail:'\u2B50',plasma_trail:'\uD83D\uDD2E',void_aura:'\u26AB'};
        ctx.fillText(allIcons[ri.type]||'?',0,4);ctx.textBaseline='alphabetic';
      }
      ctx.shadowBlur=0;ctx.restore();
      if(revealT>0.5){
        const nameA=Math.min((revealT-0.5)/0.3,1);
        ctx.globalAlpha=nameA;
        if(isRareItem){
          const tHue=(t*5)%360;
          ctx.fillStyle=`hsl(${tHue},100%,65%)`;ctx.font='bold 16px monospace';ctx.textAlign='center';
          ctx.shadowColor=`hsl(${tHue},100%,50%)`;ctx.shadowBlur=12;
          ctx.fillText('\u2605 SECRET ITEM! \u2605',cx,itemY-36);
        } else {
          ctx.fillStyle='#00e5ff';ctx.font='bold 14px monospace';ctx.textAlign='center';
          ctx.shadowColor='#00e5ff';ctx.shadowBlur=8;
          ctx.fillText('\u2606 NEW ITEM! \u2606',cx,itemY-36);
        }
        ctx.shadowBlur=0;
        ctx.fillStyle='#fff';ctx.font='bold 16px monospace';
        ctx.fillText(ri.name,cx,itemY+36);
        ctx.fillStyle='#fff8';ctx.font='11px monospace';
        ctx.fillText(ri.desc,cx,itemY+54);
        ctx.globalAlpha=1;
      }
      if(t%3===0){const a=Math.random()*6.28,r=20+Math.random()*60;const sHue=Math.floor(Math.random()*360);
        chestOpen.parts.push({x:cx+Math.cos(a)*r,y:itemY+Math.sin(a)*r,vx:(Math.random()-0.5)*2,vy:-1-Math.random(),life:30,ml:30,sz:Math.random()*3+2,col:`hsl(${sHue},90%,70%)`,g:0});}
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
    } else if(isCosmetic){
      // === COSMETIC DONE DISPLAY ===
      const hue=(t*3)%360;
      ctx.fillStyle=`hsla(${hue},60%,50%,0.04)`;ctx.fillRect(mX,mY,mW,mH);
      const bounce=Math.sin(t*0.06)*3;
      const ri=rw.item;
      ctx.save();ctx.translate(cx,cy-30+bounce);
      ctx.shadowColor=`hsl(${hue},90%,60%)`;ctx.shadowBlur=20;
      if(ri.tab===0){
        if(ri.col==='rainbow'){const rg=ctx.createLinearGradient(-22,-22,22,22);rg.addColorStop(0,'#ff0000');rg.addColorStop(0.33,'#00ff00');rg.addColorStop(0.66,'#0000ff');rg.addColorStop(1,'#ff0000');ctx.fillStyle=rg;}
        else ctx.fillStyle=ri.col;
        ctx.beginPath();ctx.arc(0,0,22,0,6.28);ctx.fill();
      } else {
        ctx.fillStyle='#fff';ctx.font='36px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
        const allIcons={smile:'\u263A',angry:'\uD83D\uDE20',star:'\u2605',heart:'\u2665',fire:'\uD83D\uDD25',cat:'\uD83D\uDC31',spiral:'\uD83C\uDF00',cyber:'\u26A1',diamond:'\uD83D\uDC8E',void:'\uD83D\uDD73',galaxy:'\uD83C\uDF0C',glitch:'\u26A0',sparkle:'\u2728',fire_aura:'\uD83D\uDD25',ice_aura:'\u2744',electric:'\u26A1',hearts:'\u2665',shadow:'\uD83C\uDF11',rainbow:'\uD83C\uDF08',sakura:'\uD83C\uDF38',star_trail:'\u2B50',plasma_trail:'\uD83D\uDD2E',void_aura:'\u26AB'};
        ctx.fillText(allIcons[ri.type]||'?',0,4);ctx.textBaseline='alphabetic';
      }
      ctx.shadowBlur=0;ctx.restore();
      if(ri.rarity==='rare'){
        const tHue=(t*5)%360;
        ctx.fillStyle=`hsl(${tHue},100%,65%)`;ctx.font='bold 14px monospace';ctx.textAlign='center';
        ctx.fillText('\u2605 SECRET ITEM! \u2605',cx,cy-70);
      } else {
        ctx.fillStyle='#00e5ff';ctx.font='bold 14px monospace';ctx.textAlign='center';
        ctx.fillText('\u2606 NEW ITEM! \u2606',cx,cy-70);
      }
      ctx.fillStyle='#ffd700';ctx.font='bold 16px monospace';
      ctx.fillText(ri.name,cx,cy+10);
      ctx.fillStyle='#fff8';ctx.font='11px monospace';
      ctx.fillText(ri.desc,cx,cy+28);
      ctx.fillStyle='#34d399';ctx.font='bold 13px monospace';
      ctx.fillText('NEW! \u30B2\u30C3\u30C8!',cx,cy+48);
      if(t%5===0){const a=Math.random()*6.28,r=30+Math.random()*40;const sHue=Math.floor(Math.random()*360);
        chestOpen.parts.push({x:cx+Math.cos(a)*r,y:cy-30+Math.sin(a)*r,vx:(Math.random()-0.5),vy:-0.5-Math.random()*0.5,life:25,ml:25,sz:Math.random()*3+1,col:`hsl(${sHue},90%,70%)`,g:0});}
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
    ctx.fillText(storedChests>0?'タップで次の宝箱':'タップで閉じる',cx,mY+mH-20);
    ctx.globalAlpha=1;
  }
  else if(p==='batchDone'){
    // === BATCH OPEN SUMMARY ===
    ctx.fillStyle='#ffd700';ctx.font='bold 18px monospace';ctx.textAlign='center';
    ctx.fillText('開封結果',cx,mY+70);
    // Tally results
    let totalCoinsGot=0,charsGot=[],cosmeticsGot=[];
    chestBatchResults.forEach(r=>{
      if(!r)return;
      if(r.type==='coin')totalCoinsGot+=r.amount;
      else if(r.type==='char')charsGot.push(r);
      else if(r.type==='cosmetic')cosmeticsGot.push(r);
    });
    // Also count the last chest reward (not yet in batchResults)
    if(rw){
      if(rw.type==='coin')totalCoinsGot+=rw.amount;
      else if(rw.type==='char')charsGot.push(rw);
      else if(rw.type==='cosmetic')cosmeticsGot.push(rw);
    }
    let sumY=mY+100;
    // Total coins
    if(totalCoinsGot>0){
      ctx.fillStyle='#ffd700';ctx.font='bold 22px monospace';
      ctx.fillText('+'+totalCoinsGot+' コイン',cx,sumY);
      sumY+=30;
    }
    // Characters obtained
    if(charsGot.length>0){
      ctx.fillStyle='#ff88cc';ctx.font='bold 14px monospace';
      ctx.fillText('キャラクター \u00D7'+charsGot.length,cx,sumY);
      sumY+=8;
      charsGot.forEach((cr,i)=>{
        if(i>=5)return; // max 5 shown
        const cy2=sumY+i*36+20;
        drawCharacter(cx-60,cy2,cr.charIdx,14,0,1,'happy',0);
        ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';ctx.textAlign='left';
        ctx.fillText(CHARS[cr.charIdx].name,cx-40,cy2+5);
        ctx.fillStyle=cr.isNew?'#34d399':'#ffaa00';ctx.font='10px monospace';
        ctx.fillText(cr.isNew?'NEW!':'+50コイン',cx-40,cy2+18);
        ctx.textAlign='center';
      });
      sumY+=Math.min(charsGot.length,5)*36+10;
    }
    // Cosmetic items obtained
    if(cosmeticsGot.length>0){
      ctx.fillStyle='#a855f7';ctx.font='bold 14px monospace';ctx.textAlign='center';
      ctx.fillText('\u2605 SECRET \u00D7'+cosmeticsGot.length,cx,sumY);
      sumY+=8;
      cosmeticsGot.forEach((cr,i)=>{
        if(i>=3)return;
        const cy2=sumY+i*28+16;
        ctx.fillStyle='#a855f7';ctx.font='bold 12px monospace';ctx.textAlign='center';
        ctx.fillText(cr.item.name,cx,cy2+5);
      });
      sumY+=Math.min(cosmeticsGot.length,3)*28+10;
    }
    // Count
    ctx.fillStyle='#fff6';ctx.font='11px monospace';
    ctx.fillText(chestBatchResults.length+1+' 個開封',cx,sumY+10);
    // Tap to close
    const ta2=0.4+Math.sin(t*0.1)*0.3;
    ctx.globalAlpha=ta2;ctx.fillStyle='#fff6';ctx.font='13px monospace';
    ctx.fillText('タップで閉じる',cx,mY+mH-20);
    ctx.globalAlpha=1;
    // Sparkles
    if(t%5===0){
      const a=Math.random()*6.28,r2=40+Math.random()*40;
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
  const cardY=H*0.24,cardH=210+(storedChests>0?56:0);
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

  // Chest acquisition display + open button
  if(storedChests>0){
    const chestY=coinY+20;
    ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';ctx.textAlign='center';
    ctx.fillText('\uD83D\uDCE6 宝箱 \u00D7'+storedChests,W/2,chestY);
    // "Open chests" button
    const ocW=140,ocH=28,ocX=W/2-ocW/2,ocY=chestY+6;
    ctx.fillStyle='#ffd70018';rr(ocX,ocY,ocW,ocH,6);ctx.fill();
    ctx.strokeStyle='#ffd700';ctx.lineWidth=1;rr(ocX,ocY,ocW,ocH,6);ctx.stroke();
    ctx.fillStyle='#ffd700';ctx.font='bold 11px monospace';
    ctx.fillText('\u958B\u5C01\u3059\u308B',W/2,ocY+19);
  }

  // --- Action buttons (below card) ---
  if(deadT>45){
    const btnW2=Math.min(220,W-40),btnH2=38,btnX2=W/2-btnW2/2;
    let btnTop=cardY+cardH+12;

    // Continue button (costs 100 coins, 1 time only) - only in endless mode
    if(!isPackMode){
      const canContinue=walletCoins>=100&&!usedContinue;
      if(usedContinue){
        ctx.fillStyle='#ffffff06';rr(btnX2,btnTop,btnW2,btnH2,8);ctx.fill();
        ctx.strokeStyle='#ffffff22';ctx.lineWidth=1;rr(btnX2,btnTop,btnW2,btnH2,8);ctx.stroke();
        ctx.fillStyle='#fff3';ctx.font='bold 13px monospace';
        ctx.fillText('\u25B6 \u7D9A\u304D\u304B\u3089\u518D\u958B  \u25CF100',W/2,btnTop+24);
        ctx.fillStyle='#ff444488';ctx.font='9px monospace';
        ctx.fillText('\u4F7F\u7528\u6E08\u307F',W/2,btnTop+36);
      } else if(canContinue){
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

// ===== EYE PREVIEW (for shop/cosmetic menu) =====
function drawEyePreview(x,y,type,sz){
  ctx.save();
  const es=sz;
  switch(type){
    case'smile':
      ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(1.5,sz*0.2);ctx.lineCap='round';
      ctx.beginPath();ctx.arc(x,y-es*0.1,es*0.6,Math.PI+0.4,Math.PI*2-0.4);ctx.stroke();
      break;
    case'angry':
      ctx.fillStyle='#ff2200';ctx.beginPath();ctx.arc(x,y,es,0,6.28);ctx.fill();
      ctx.fillStyle='#ffcc00';ctx.beginPath();ctx.arc(x+es*0.1,y,es*0.45,0,6.28);ctx.fill();
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(x+es*0.15,y,es*0.2,0,6.28);ctx.fill();
      ctx.strokeStyle='#ff2200';ctx.lineWidth=Math.max(1.5,sz*0.18);ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(x-es*0.8,y-es*1.1);ctx.lineTo(x+es*0.5,y-es*0.7);ctx.stroke();
      break;
    case'star':
      ctx.fillStyle='#ffd700';
      for(let si=0;si<5;si++){const a=-Math.PI/2+si*Math.PI*2/5,a2=a+Math.PI/5;
        if(si===0)ctx.beginPath();
        ctx.lineTo(x+Math.cos(a)*es,y+Math.sin(a)*es);
        ctx.lineTo(x+Math.cos(a2)*es*0.45,y+Math.sin(a2)*es*0.45);
      }ctx.closePath();ctx.fill();
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(x+es*0.1,y,es*0.3,0,6.28);ctx.fill();
      break;
    case'heart':
      ctx.fillStyle='#ff4488';
      ctx.save();ctx.translate(x,y);
      const hs2=es*0.7;ctx.beginPath();ctx.moveTo(0,hs2*0.5);
      ctx.bezierCurveTo(-hs2*0.1,hs2*0.2,-hs2,0,-hs2,-hs2*0.4);
      ctx.bezierCurveTo(-hs2,-hs2*0.8,0,-hs2*0.6,0,-hs2*0.2);
      ctx.bezierCurveTo(0,-hs2*0.6,hs2,-hs2*0.8,hs2,-hs2*0.4);
      ctx.bezierCurveTo(hs2,0,hs2*0.1,hs2*0.2,0,hs2*0.5);ctx.fill();ctx.restore();
      break;
    case'fire':
      ctx.fillStyle='#ff2200';ctx.beginPath();ctx.arc(x,y,es,0,6.28);ctx.fill();
      ctx.fillStyle='#ff6600';ctx.beginPath();ctx.arc(x+es*0.1,y,es*0.65,0,6.28);ctx.fill();
      ctx.fillStyle='#ffcc00';ctx.beginPath();ctx.arc(x+es*0.15,y,es*0.3,0,6.28);ctx.fill();
      break;
    case'cat':
      ctx.fillStyle='#ccff44';ctx.beginPath();ctx.ellipse(x,y,es,es*0.9,0,0,6.28);ctx.fill();
      ctx.fillStyle='#111';ctx.beginPath();ctx.ellipse(x+es*0.1,y,es*0.12,es*0.7,0,0,6.28);ctx.fill();
      break;
    case'spiral':
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,es,0,6.28);ctx.fill();
      ctx.strokeStyle='#333';ctx.lineWidth=Math.max(1,sz*0.12);ctx.beginPath();
      for(let si=0;si<16;si++){const sa=si*0.8,sr=es*0.1+si*es*0.05;
        const sx=x+Math.cos(sa)*sr,sy=y+Math.sin(sa)*sr;
        if(si===0)ctx.moveTo(sx,sy);else ctx.lineTo(sx,sy);
      }ctx.stroke();
      break;
    case'cyber':
      ctx.fillStyle='#00ff88';ctx.beginPath();ctx.arc(x,y,es,0,6.28);ctx.fill();
      ctx.strokeStyle='#003322';ctx.lineWidth=Math.max(0.8,sz*0.08);
      ctx.beginPath();ctx.moveTo(x-es,y);ctx.lineTo(x+es,y);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x,y-es);ctx.lineTo(x,y+es);ctx.stroke();
      ctx.fillStyle='#003322';ctx.beginPath();ctx.arc(x+es*0.1,y,es*0.25,0,6.28);ctx.fill();
      ctx.fillStyle='#00ff88';ctx.beginPath();ctx.arc(x+es*0.1,y,es*0.1,0,6.28);ctx.fill();
      break;
    case'diamond':
      ctx.fillStyle='#aaeeff';
      ctx.beginPath();ctx.moveTo(x,y-es);ctx.lineTo(x+es*0.7,y);
      ctx.lineTo(x,y+es);ctx.lineTo(x-es*0.7,y);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.5)';
      ctx.beginPath();ctx.moveTo(x,y-es);ctx.lineTo(x+es*0.3,y);ctx.lineTo(x,y);ctx.closePath();ctx.fill();
      break;
    case'void':
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(x,y,es,0,6.28);ctx.fill();
      ctx.fillStyle='#330044';ctx.beginPath();ctx.arc(x,y,es*0.7,0,6.28);ctx.fill();
      ctx.fillStyle='#220033';ctx.beginPath();ctx.arc(x,y,es*0.4,0,6.28);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x+es*0.05,y-es*0.1,es*0.08,0,6.28);ctx.fill();
      break;
    case'galaxy':
      ctx.fillStyle='#0a0a2e';ctx.beginPath();ctx.arc(x,y,es,0,6.28);ctx.fill();
      for(let gi=0;gi<6;gi++){const ga=gi*1.047+(typeof frame!=='undefined'?frame*0.04:0),gd=es*(0.3+gi*0.1);
        ctx.fillStyle=`hsla(${(gi*60+200)%360},80%,70%,0.7)`;
        ctx.beginPath();ctx.arc(x+Math.cos(ga)*gd,y+Math.sin(ga)*gd,es*0.08,0,6.28);ctx.fill();}
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,es*0.12,0,6.28);ctx.fill();
      break;
    case'glitch':
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,es,0,6.28);ctx.fill();
      ctx.fillStyle='#333';ctx.beginPath();ctx.arc(x+es*0.15,y,es*0.5,0,6.28);ctx.fill();
      const gt2=typeof frame!=='undefined'?frame:0;
      if(gt2%30<5){ctx.fillStyle='#ff004488';ctx.fillRect(x-es,y-es*0.3,es*2,es*0.2);
        ctx.fillStyle='#00ff4488';ctx.fillRect(x-es+1,y+es*0.1,es*2,es*0.15);}
      break;
    default:
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,es,0,6.28);ctx.fill();
      ctx.fillStyle='#333';ctx.beginPath();ctx.arc(x+es*0.15,y,es*0.45,0,6.28);ctx.fill();
  }
  ctx.restore();
}
// ===== SHOP DRAW =====
function drawShop(){
  if(!shopOpen)return;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.88)';ctx.fillRect(0,0,W,H);
  const mW=Math.min(320,W-16),mH=Math.min(500,H-30);
  const mX=(W-mW)/2,mY=(H-mH)/2;
  const mgr=ctx.createLinearGradient(mX,mY,mX,mY+mH);
  mgr.addColorStop(0,'#1a1a2e');mgr.addColorStop(0.5,'#16213e');mgr.addColorStop(1,'#0f0f23');
  ctx.fillStyle=mgr;rr(mX,mY,mW,mH,16);ctx.fill();
  ctx.strokeStyle='#ff69b444';ctx.lineWidth=2;rr(mX,mY,mW,mH,16);ctx.stroke();
  ctx.strokeStyle='#ff69b4';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(mX+16,mY);ctx.lineTo(mX+mW-16,mY);ctx.stroke();
  // Title
  ctx.fillStyle='#ff69b4';ctx.font='bold 18px monospace';ctx.textAlign='center';
  ctx.fillText('\uD83D\uDED2 \u30B7\u30E7\u30C3\u30D7',W/2,mY+30);
  // Wallet
  ctx.fillStyle='#ffd700';ctx.font='bold 12px monospace';
  ctx.fillText('\u25CF '+walletCoins,W/2,mY+48);
  // Tabs
  const tabNames=['\u30B9\u30AD\u30F3','\u76EE','\u30A8\u30D5\u30A7\u30AF\u30C8'];
  const tabCols=['#ff69b4','#00e5ff','#ffd700'];
  const tabW=(mW-20)/3;
  for(let i=0;i<3;i++){
    const tx=mX+10+i*tabW,ty=mY+56;
    ctx.fillStyle=shopTab===i?tabCols[i]+'33':'#ffffff08';
    rr(tx,ty,tabW-4,26,6);ctx.fill();
    ctx.strokeStyle=shopTab===i?tabCols[i]:tabCols[i]+'44';ctx.lineWidth=1;rr(tx,ty,tabW-4,26,6);ctx.stroke();
    ctx.fillStyle=shopTab===i?tabCols[i]:'#fff6';ctx.font=shopTab===i?'bold 11px monospace':'11px monospace';
    ctx.fillText(tabNames[i],tx+tabW/2-2,ty+18);
  }
  // Items list
  const listY=mY+90,listH=mH-140;
  const items=shopSorted(shopTab===0?SHOP_ITEMS.skins:shopTab===1?SHOP_ITEMS.eyes:SHOP_ITEMS.effects);
  const rowH=54;
  ctx.save();ctx.beginPath();ctx.rect(mX+1,listY,mW-2,listH);ctx.clip();
  for(let i=0;i<items.length;i++){
    const item=items[i];
    const iy=listY+i*rowH-shopScroll;
    if(iy+rowH<listY||iy>listY+listH)continue;
    const owned=ownsItem(item.id);
    const isSecret=item.rarity==='rare'&&!owned;
    const equipped=(shopTab===0&&equippedSkin===item.id)||(shopTab===1&&equippedEyes===item.id)||(shopTab===2&&equippedEffect===item.id);
    // Row bg
    ctx.fillStyle=equipped?'#ffffff15':owned?'#ffffff08':isSecret?'#ffffff02':'#ffffff04';
    rr(mX+8,iy+2,mW-16,rowH-4,8);ctx.fill();
    if(equipped){ctx.strokeStyle='#ffd700';ctx.lineWidth=1.5;rr(mX+8,iy+2,mW-16,rowH-4,8);ctx.stroke();}
    if(isSecret){ctx.strokeStyle='#a855f722';ctx.lineWidth=1;rr(mX+8,iy+2,mW-16,rowH-4,8);ctx.stroke();}
    if(isSecret){
      // Secret item: show mystery appearance
      ctx.fillStyle='#a855f733';ctx.font='20px monospace';ctx.textAlign='center';
      ctx.fillText('?',mX+33,iy+rowH/2+7);
      ctx.fillStyle='#a855f7';ctx.font='bold 12px monospace';ctx.textAlign='left';
      ctx.fillText('??? \u30B7\u30FC\u30AF\u30EC\u30C3\u30C8',mX+56,iy+20);
      ctx.fillStyle='#a855f766';ctx.font='9px monospace';
      ctx.fillText('\u30AC\u30C1\u30E3\u3067\u306E\u307F\u5165\u624B\u53EF\u80FD',mX+56,iy+34);
      ctx.textAlign='right';
      ctx.fillStyle='#a855f7';ctx.font='bold 11px monospace';
      ctx.fillText('\uD83D\uDD12 SECRET',mX+mW-16,iy+20);
      ctx.fillStyle='#a855f766';ctx.font='9px monospace';
      ctx.fillText('\u5B9D\u7BB1\u304B\u3089\u51FA\u73FE',mX+mW-16,iy+34);
    } else {
    // Preview
    if(shopTab===0){
      // Skin color swatch (border as filled ring to avoid clip bleed)
      ctx.fillStyle=item.col2==='rainbow'?'#888':item.col2;
      ctx.beginPath();ctx.arc(mX+33,iy+rowH/2,14,0,6.28);ctx.fill();
      if(item.col==='rainbow'){
        const rg=ctx.createLinearGradient(mX+20,iy+10,mX+46,iy+36);
        rg.addColorStop(0,'#ff0000');rg.addColorStop(0.33,'#00ff00');rg.addColorStop(0.66,'#0000ff');rg.addColorStop(1,'#ff0000');
        ctx.fillStyle=rg;
      } else ctx.fillStyle=item.col;
      ctx.beginPath();ctx.arc(mX+33,iy+rowH/2,12,0,6.28);ctx.fill();
    } else if(shopTab===1){
      drawEyePreview(mX+33,iy+rowH/2,item.type,10);
    } else {
      ctx.fillStyle='#fff';ctx.font='20px monospace';ctx.textAlign='center';
      const fxIcons={sparkle:'\u2728',fire_aura:'\uD83D\uDD25',ice_aura:'\u2744',electric:'\u26A1',hearts:'\u2665',shadow:'\uD83C\uDF11',rainbow:'\uD83C\uDF08',sakura:'\uD83C\uDF38',star_trail:'\u2B50',plasma_trail:'\uD83D\uDD2E',void_aura:'\u26AB'};
      ctx.fillText(fxIcons[item.type]||'?',mX+33,iy+rowH/2+7);
    }
    // Name & desc
    ctx.fillStyle='#fff';ctx.font='bold 12px monospace';ctx.textAlign='left';
    ctx.fillText(item.name,mX+56,iy+20);
    ctx.fillStyle='#fff6';ctx.font='9px monospace';
    ctx.fillText(item.desc,mX+56,iy+34);
    // Price / owned / equipped
    ctx.textAlign='right';
    if(equipped){
      ctx.fillStyle='#ffd700';ctx.font='bold 11px monospace';
      ctx.fillText('\u88C5\u5099\u4E2D',mX+mW-16,iy+20);
    } else if(owned){
      ctx.fillStyle='#34d399';ctx.font='bold 11px monospace';
      ctx.fillText('\u6240\u6709',mX+mW-16,iy+27);
    } else {
      ctx.fillStyle=walletCoins>=item.price?'#ffd700':'#ff4444';ctx.font='bold 12px monospace';
      ctx.fillText('\u25CF '+item.price,mX+mW-16,iy+20);
      ctx.fillStyle=walletCoins>=item.price?'#fff6':'#ff444488';ctx.font='9px monospace';
      ctx.fillText('\u30BF\u30C3\u30D7\u3067\u8CFC\u5165',mX+mW-16,iy+34);
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
  ctx.fillStyle='#ffffff12';rr(W/2-50,shopCloseY,100,30,8);ctx.fill();
  ctx.strokeStyle='#fff2';ctx.lineWidth=1;rr(W/2-50,shopCloseY,100,30,8);ctx.stroke();
  ctx.fillStyle='#fff8';ctx.font='bold 12px monospace';ctx.textAlign='center';
  ctx.fillText('\u9589\u3058\u308B',W/2,shopCloseY+20);
  // Purchase confirmation dialog with preview
  if(shopConfirm){
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,H);
    const dlgW=Math.min(270,W-30),dlgH=260;
    const dlgX=W/2-dlgW/2,dlgY=H/2-dlgH/2;
    const dgr=ctx.createLinearGradient(dlgX,dlgY,dlgX,dlgY+dlgH);
    dgr.addColorStop(0,'#1e1e3a');dgr.addColorStop(1,'#0f0f23');
    ctx.fillStyle=dgr;rr(dlgX,dlgY,dlgW,dlgH,14);ctx.fill();
    ctx.strokeStyle='#ffd700';ctx.lineWidth=2;rr(dlgX,dlgY,dlgW,dlgH,14);ctx.stroke();
    // Title
    ctx.fillStyle='#ffd700';ctx.font='bold 14px monospace';ctx.textAlign='center';
    ctx.fillText('\u8CFC\u5165\u78BA\u8A8D',W/2,dlgY+26);
    // Character preview with item applied
    const prevY2=dlgY+80;
    ctx.save();
    // Temporarily apply the item for preview
    const origSkin=equippedSkin,origEyes=equippedEyes,origFx=equippedEffect;
    if(shopConfirm.tab===0)equippedSkin=shopConfirm.item.id;
    else if(shopConfirm.tab===1)equippedEyes=shopConfirm.item.id;
    else equippedEffect=shopConfirm.item.id;
    drawCharacter(W/2,prevY2,selChar,26,0,1,'normal',0,true);
    const fxPrev=getEquippedEffectData();
    if(fxPrev)drawPlayerEffect(W/2,prevY2,26,fxPrev.type,1);
    equippedSkin=origSkin;equippedEyes=origEyes;equippedEffect=origFx;
    ctx.restore();
    // Item name
    ctx.fillStyle='#fff';ctx.font='bold 13px monospace';ctx.textAlign='center';
    ctx.fillText(shopConfirm.item.name,W/2,prevY2+42);
    ctx.fillStyle='#fff6';ctx.font='10px monospace';
    ctx.fillText(shopConfirm.item.desc,W/2,prevY2+58);
    // Price
    const canBuy=walletCoins>=shopConfirm.item.price;
    ctx.fillStyle='#ffd700';ctx.font='bold 16px monospace';
    ctx.fillText('\u25CF '+shopConfirm.item.price,W/2,prevY2+82);
    // Balance after purchase
    const after=walletCoins-shopConfirm.item.price;
    if(canBuy){
      ctx.fillStyle='#fff6';ctx.font='10px monospace';
      ctx.fillText('\u6240\u6301: '+walletCoins+' \u2192 '+after,W/2,prevY2+98);
    } else {
      ctx.fillStyle='#ff4444';ctx.font='bold 10px monospace';
      ctx.fillText('\u30B3\u30A4\u30F3\u4E0D\u8DB3 (\u6240\u6301: '+walletCoins+')',W/2,prevY2+98);
    }
    // Buttons
    const btnW2=100,btnH2=36;
    if(canBuy){
      ctx.fillStyle='#ffd70022';rr(W/2-btnW2-6,dlgY+dlgH-52,btnW2,btnH2,8);ctx.fill();
      ctx.strokeStyle='#ffd700';ctx.lineWidth=1.5;rr(W/2-btnW2-6,dlgY+dlgH-52,btnW2,btnH2,8);ctx.stroke();
      ctx.fillStyle='#ffd700';ctx.font='bold 13px monospace';ctx.textAlign='center';
      ctx.fillText('\u8CFC\u5165',W/2-btnW2/2-6,dlgY+dlgH-28);
    } else {
      ctx.fillStyle='#ffffff08';rr(W/2-btnW2-6,dlgY+dlgH-52,btnW2,btnH2,8);ctx.fill();
      ctx.strokeStyle='#ff444466';ctx.lineWidth=1;rr(W/2-btnW2-6,dlgY+dlgH-52,btnW2,btnH2,8);ctx.stroke();
      ctx.fillStyle='#ff444488';ctx.font='bold 13px monospace';ctx.textAlign='center';
      ctx.fillText('\u8CFC\u5165',W/2-btnW2/2-6,dlgY+dlgH-28);
    }
    ctx.fillStyle='#ffffff0a';rr(W/2+6,dlgY+dlgH-52,btnW2,btnH2,8);ctx.fill();
    ctx.strokeStyle='#fff4';ctx.lineWidth=1;rr(W/2+6,dlgY+dlgH-52,btnW2,btnH2,8);ctx.stroke();
    ctx.fillStyle='#fff8';ctx.font='bold 13px monospace';
    ctx.fillText('\u3084\u3081\u308B',W/2+btnW2/2+6,dlgY+dlgH-28);
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
      ctx.fillText(a.item.name,0,0);
      ctx.fillStyle='#fff8';ctx.font='11px monospace';
      ctx.fillText(a.item.desc,0,22);
      ctx.restore();
      // Particles
      for(const p of a.parts){
        p.x+=p.vx;p.y+=p.vy;p.vy+=0.15;p.vx*=0.98;p.life--;
        if(p.life>0){
          ctx.globalAlpha=alpha*Math.min(1,p.life/20);
          ctx.fillStyle=p.col;
          ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,6.28);ctx.fill();
        }
      }
      // Tap to dismiss hint
      if(a.t>30){
        ctx.globalAlpha=alpha*0.5;
        ctx.fillStyle='#fff';ctx.font='10px monospace';ctx.textAlign='center';
        ctx.fillText('\u30BF\u30C3\u30D7\u3067\u9589\u3058\u308B',W/2,H/2+60);
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

// ===== COSMETIC EQUIP MENU =====
function drawCosmeticMenu(){
  if(!cosmeticMenuOpen)return;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.88)';ctx.fillRect(0,0,W,H);
  const mW=Math.min(320,W-16),mH=Math.min(500,H-30);
  const mX=(W-mW)/2,mY=(H-mH)/2;
  const mgr=ctx.createLinearGradient(mX,mY,mX,mY+mH);
  mgr.addColorStop(0,'#1a1a2e');mgr.addColorStop(0.5,'#16213e');mgr.addColorStop(1,'#0f0f23');
  ctx.fillStyle=mgr;rr(mX,mY,mW,mH,16);ctx.fill();
  ctx.strokeStyle='#a855f744';ctx.lineWidth=2;rr(mX,mY,mW,mH,16);ctx.stroke();
  ctx.strokeStyle='#a855f7';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(mX+16,mY);ctx.lineTo(mX+mW-16,mY);ctx.stroke();
  // Title
  ctx.fillStyle='#a855f7';ctx.font='bold 18px monospace';
  ctx.fillText('\uD83D\uDC57 \u7740\u305B\u66FF\u3048',W/2,mY+30);
  // Character preview
  const prevX=W/2,prevY=mY+75;
  drawCharacter(prevX,prevY,selChar,22,0,1,'normal',0,true);
  const fxD=getEquippedEffectData();
  if(fxD)drawPlayerEffect(prevX,prevY,22,fxD.type,1);
  // Tabs
  const tabNames=['\u30B9\u30AD\u30F3','\u76EE','\u30A8\u30D5\u30A7\u30AF\u30C8'];
  const tabCols=['#ff69b4','#00e5ff','#ffd700'];
  const tabW=(mW-20)/3;
  for(let i=0;i<3;i++){
    const tx=mX+10+i*tabW,ty=mY+100;
    ctx.fillStyle=cosmeticTab===i?tabCols[i]+'33':'#ffffff08';
    rr(tx,ty,tabW-4,26,6);ctx.fill();
    ctx.strokeStyle=cosmeticTab===i?tabCols[i]:tabCols[i]+'44';ctx.lineWidth=1;rr(tx,ty,tabW-4,26,6);ctx.stroke();
    ctx.fillStyle=cosmeticTab===i?tabCols[i]:'#fff6';ctx.font=cosmeticTab===i?'bold 11px monospace':'11px monospace';
    ctx.fillText(tabNames[i],tx+tabW/2-2,ty+18);
  }
  // Item list (only owned items + "none" option)
  const listY=mY+134,listH=mH-184;
  const allItems=cosmeticTab===0?SHOP_ITEMS.skins:cosmeticTab===1?SHOP_ITEMS.eyes:SHOP_ITEMS.effects;
  const ownedList=[{id:'',name:'\u306A\u3057',desc:'\u30C7\u30D5\u30A9\u30EB\u30C8'}].concat(allItems.filter(it=>ownsItem(it.id)));
  const rowH=48;
  ctx.save();ctx.beginPath();ctx.rect(mX,listY,mW,listH);ctx.clip();
  for(let i=0;i<ownedList.length;i++){
    const item=ownedList[i];
    const iy=listY+i*rowH-cosmeticScroll;
    if(iy+rowH<listY||iy>listY+listH)continue;
    const isNone=item.id==='';
    const equipped=(cosmeticTab===0&&equippedSkin===item.id)||(cosmeticTab===1&&equippedEyes===item.id)||(cosmeticTab===2&&equippedEffect===item.id);
    ctx.fillStyle=equipped?'#ffffff18':'#ffffff06';
    rr(mX+8,iy+2,mW-16,rowH-4,8);ctx.fill();
    if(equipped){ctx.strokeStyle='#ffd700';ctx.lineWidth=1.5;rr(mX+8,iy+2,mW-16,rowH-4,8);ctx.stroke();}
    // Preview
    if(!isNone){
      if(cosmeticTab===0){
        if(item.col==='rainbow'){const rg=ctx.createLinearGradient(mX+20,iy+8,mX+46,iy+34);rg.addColorStop(0,'#ff0000');rg.addColorStop(0.33,'#00ff00');rg.addColorStop(0.66,'#0000ff');rg.addColorStop(1,'#ff0000');ctx.fillStyle=rg;}
        else ctx.fillStyle=item.col;
        ctx.beginPath();ctx.arc(mX+33,iy+rowH/2,11,0,6.28);ctx.fill();
      } else {
        ctx.fillStyle='#fff';ctx.font='18px monospace';ctx.textAlign='center';
        if(cosmeticTab===1){drawEyePreview(mX+33,iy+rowH/2,item.type,9);}
        else{const fxIcons={sparkle:'\u2728',fire_aura:'\uD83D\uDD25',ice_aura:'\u2744',electric:'\u26A1',hearts:'\u2665',shadow:'\uD83C\uDF11',rainbow:'\uD83C\uDF08',sakura:'\uD83C\uDF38',star_trail:'\u2B50',plasma_trail:'\uD83D\uDD2E',void_aura:'\u26AB'};ctx.fillText(fxIcons[item.type]||'?',mX+33,iy+rowH/2+6);}
      }
    } else {
      ctx.fillStyle='#fff4';ctx.font='18px monospace';ctx.textAlign='center';
      ctx.fillText('\u2013',mX+33,iy+rowH/2+6);
    }
    // Name
    ctx.fillStyle=equipped?'#ffd700':'#fff';ctx.font='bold 11px monospace';ctx.textAlign='left';
    ctx.fillText(item.name,mX+56,iy+20);
    ctx.fillStyle='#fff5';ctx.font='9px monospace';
    ctx.fillText(item.desc||'',mX+56,iy+34);
    // Status
    ctx.textAlign='right';
    if(equipped){ctx.fillStyle='#ffd700';ctx.font='bold 10px monospace';ctx.fillText('\u88C5\u5099\u4E2D',mX+mW-16,iy+24);}
    else{ctx.fillStyle='#fff5';ctx.font='9px monospace';ctx.fillText('\u30BF\u30C3\u30D7\u3067\u88C5\u5099',mX+mW-16,iy+24);}
  }
  ctx.restore();
  // Footer close button
  const cosCloseY=mY+mH-42;
  ctx.fillStyle='#ffffff12';rr(W/2-50,cosCloseY,100,30,8);ctx.fill();
  ctx.strokeStyle='#fff2';ctx.lineWidth=1;rr(W/2-50,cosCloseY,100,30,8);ctx.stroke();
  ctx.fillStyle='#fff8';ctx.font='bold 12px monospace';ctx.textAlign='center';
  ctx.fillText('\u9589\u3058\u308B',W/2,cosCloseY+20);
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
    ctx.fillText(isUnequip?'\u89E3\u9664\u78BA\u8A8D':'\u88C5\u5099\u78BA\u8A8D',W/2,dlgY+26);
    ctx.fillStyle='#fff';ctx.font='bold 13px monospace';
    ctx.fillText(cosmeticConfirm.item.name,W/2,dlgY+56);
    ctx.fillStyle='#fff6';ctx.font='10px monospace';
    ctx.fillText(isUnequip?'\u30C7\u30D5\u30A9\u30EB\u30C8\u306B\u623B\u3057\u307E\u3059\u304B\uFF1F':'\u3053\u306E\u30A2\u30A4\u30C6\u30E0\u3092\u88C5\u5099\u3057\u307E\u3059\u304B\uFF1F',W/2,dlgY+76);
    const btnW2=90,btnH2=34;
    ctx.fillStyle='#a855f722';rr(W/2-btnW2-6,dlgY+dlgH-48,btnW2,btnH2,8);ctx.fill();
    ctx.strokeStyle='#a855f7';ctx.lineWidth=1.5;rr(W/2-btnW2-6,dlgY+dlgH-48,btnW2,btnH2,8);ctx.stroke();
    ctx.fillStyle='#a855f7';ctx.font='bold 13px monospace';ctx.textAlign='center';
    ctx.fillText('OK',W/2-btnW2/2-6,dlgY+dlgH-26);
    ctx.fillStyle='#ffffff0a';rr(W/2+6,dlgY+dlgH-48,btnW2,btnH2,8);ctx.fill();
    ctx.strokeStyle='#fff4';ctx.lineWidth=1;rr(W/2+6,dlgY+dlgH-48,btnW2,btnH2,8);ctx.stroke();
    ctx.fillStyle='#fff8';ctx.font='bold 13px monospace';
    ctx.fillText('\u3084\u3081\u308B',W/2+btnW2/2+6,dlgY+dlgH-26);
  }
  ctx.restore();
}
