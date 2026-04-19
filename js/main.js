'use strict';
// Accumulator-based game loop: runs update() at fixed 60fps (16.67ms per tick)
// even when actual frame rate drops (power saving mode, throttling, etc.)
// Max catch-up ticks per frame to avoid overloading slow devices.
// If still behind after max ticks, discard leftover time to prevent death spiral.
let _tickAcc=0,_skipDraw=0,_recoveryFrames=0;
// --- FPS meter (diagnostic overlay) ---
// Toggle with 5 quick taps on top-left corner. Persisted in localStorage.
let _fpsSmooth=60,_fpsMin=60,_fpsMinResetT=0,_gcSpikeT=0,_lastBigDt=0;
function loop(ts){
  if(!lastTime){lastTime=ts;_tickAcc=0;_skipDraw=2;}
  const dt=ts-lastTime;
  _updateQuality(dt); // adaptive quality monitoring
  // FPS telemetry
  if(dt>0&&dt<500){
    const fps=1000/dt;
    _fpsSmooth=_fpsSmooth*0.9+fps*0.1;
    _fpsMinResetT++;
    if(_fpsMinResetT>90){_fpsMin=fps;_fpsMinResetT=0;}
    else if(fps<_fpsMin)_fpsMin=fps;
    // Detect GC-like spike (single long frame)
    if(dt>40){_gcSpikeT=30;_lastBigDt=Math.round(dt);}
  }
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
    try{update();}catch(e){console.error('loop error:',e);}
    _tickAcc-=16.67;
    ticks++;
  }
  if(_recoveryFrames>0)_recoveryFrames--;
  // Cap leftover time to 1 frame instead of discarding — prevents stutter from lost time
  if(_tickAcc>16.67)_tickAcc=16.67;
  // Skip first draws after background return (GPU context warmup)
  if(_skipDraw>0){_skipDraw--;} else {try{draw();}catch(e){console.error('draw error:',e);}}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
