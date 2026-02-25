'use strict';
// Accumulator-based game loop: runs update() at fixed 60fps (16.67ms per tick)
// even when actual frame rate drops (power saving mode, throttling, etc.)
// Max 4 catch-up ticks per frame to avoid overloading slow devices.
// If still behind after 4 ticks, discard leftover time to prevent death spiral.
let _tickAcc=0;
function loop(ts){
  if(!lastTime)lastTime=ts;
  _tickAcc+=Math.min(ts-lastTime,200);
  lastTime=ts;
  let ticks=0;
  while(_tickAcc>=16.67&&ticks<4){
    try{update();}catch(e){console.error('loop error:',e);}
    _tickAcc-=16.67;
    ticks++;
  }
  // Discard leftover time to prevent accumulation death spiral on slow devices
  if(_tickAcc>16.67)_tickAcc=0;
  try{draw();}catch(e){console.error('draw error:',e);}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
