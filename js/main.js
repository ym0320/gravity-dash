'use strict';
function loop(ts){
  if(!lastTime)lastTime=ts;
  const dt=Math.min((ts-lastTime)/16.67,3);lastTime=ts;
  try{update(dt);draw();}catch(e){console.error('loop error:',e);}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);