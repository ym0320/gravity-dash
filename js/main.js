'use strict';
// Accumulator-based game loop: runs update() at fixed 60fps (16.67ms per tick)
// even when actual frame rate drops (power saving mode, throttling, etc.)
// Max 4 catch-up ticks per frame to avoid overloading slow devices.
// If still behind after 4 ticks, discard leftover time to prevent death spiral.
let _tickAcc=0,_skipDraw=0;
function loop(ts){
  if(!lastTime){lastTime=ts;_tickAcc=0;}
  const dt=ts-lastTime;
  // After background return (>500ms gap), reset timing to prevent burst
  if(dt>500){lastTime=ts;_tickAcc=0;_skipDraw=2;requestAnimationFrame(loop);return;}
  _tickAcc+=Math.min(dt,200);
  lastTime=ts;
  let ticks=0;
  while(_tickAcc>=16.67&&ticks<4){
    try{update();}catch(e){console.error('loop error:',e);}
    _tickAcc-=16.67;
    ticks++;
  }
  // Discard leftover time to prevent accumulation death spiral on slow devices
  if(_tickAcc>16.67)_tickAcc=0;
  // Skip first 2 draws after background return (GPU context warmup)
  if(_skipDraw>0){_skipDraw--;} else {try{draw();}catch(e){console.error('draw error:',e);}}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
