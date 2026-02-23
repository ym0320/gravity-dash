'use strict';
// Accumulator-based game loop: runs update() at fixed 60fps (16.67ms per tick)
// even when actual frame rate drops (power saving mode, throttling, etc.)
let _tickAcc=0;
function loop(ts){
  if(!lastTime)lastTime=ts;
  _tickAcc+=Math.min(ts-lastTime,250); // cap delta at 250ms (handles down to ~4fps)
  lastTime=ts;
  let ticks=0;
  while(_tickAcc>=16.67&&ticks<10){
    try{update();}catch(e){console.error('loop error:',e);}
    _tickAcc-=16.67;
    ticks++;
  }
  try{draw();}catch(e){console.error('draw error:',e);}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
