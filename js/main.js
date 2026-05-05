'use strict';
// Accumulator-based game loop: runs update() at fixed 60fps (16.67ms per tick)
// even when actual frame rate drops (power saving mode, throttling, etc.)
// Max catch-up ticks per frame to avoid overloading slow devices.
// If still behind after max ticks, discard leftover time to prevent death spiral.
let _tickAcc=0,_skipDraw=0,_recoveryFrames=0;
let _gcSpikeT=0,_lastBigDt=0;
function loop(ts){
  if(!lastTime){lastTime=ts;_tickAcc=0;_skipDraw=2;}
  const dt=ts-lastTime;
  _updateQuality(dt); // adaptive quality monitoring
  if(dt>0&&dt<500&&dt>40){_gcSpikeT=30;_lastBigDt=Math.round(dt);}
  if(_gcSpikeT>0)_gcSpikeT--;
  // After background return (>500ms gap), reset timing to prevent burst
  if(dt>500){lastTime=ts;_tickAcc=0;_skipDraw=2;_recoveryFrames=5;requestAnimationFrame(loop);return;}
  // Spike recovery: after a large gap, limit catch-up for a few frames to ease back in
  if(dt>50&&!_recoveryFrames)_recoveryFrames=3;
  // In WebView, cap to 2 ticks max to prevent CPU overload on slower devices
  const isRNWebView=!!(window.ReactNativeWebView);
  const maxTicks=isRNWebView?2:(_recoveryFrames>0?2:4);
  _tickAcc+=Math.min(dt,100);
  lastTime=ts;
  let ticks=0;
  while(_tickAcc>=16.67&&ticks<maxTicks){
    try{
      const _u0=performance.now();update();const _ud=performance.now()-_u0;
      if(_ud>8)console.warn('[SPIKE] update '+_ud.toFixed(1)+'ms state='+state+' score='+score+' bgm='+bgmCurrent+' en='+(enemies&&enemies.length)+' bu='+(bullets&&bullets.length)+' pa='+(parts&&parts.length)+' co='+(coins&&coins.length)+' boss='+!!(bossPhase&&bossPhase.active));
    }catch(e){console.error('loop error:',e);}
    _tickAcc-=16.67;
    ticks++;
  }
  if(_recoveryFrames>0)_recoveryFrames--;
  // Cap leftover time to 1 frame instead of discarding — prevents stutter from lost time
  if(_tickAcc>16.67)_tickAcc=16.67;
  // Skip first draws after background return (GPU context warmup)
  if(_skipDraw>0){_skipDraw--;} else {
    try{
      const _d0=performance.now();draw();const _dd=performance.now()-_d0;
      if(_dd>8)console.warn('[SPIKE] draw '+_dd.toFixed(1)+'ms state='+state+' en='+(enemies&&enemies.length)+' pa='+(parts&&parts.length)+' bgm='+bgmCurrent);
    }catch(e){console.error('draw error:',e);}
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
