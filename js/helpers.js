'use strict';
function emitParts(x,y,n,col,szMax,spdMax){
  for(let i=0;i<n;i++){
    const a=(6.28/n)*i;
    parts.push({x,y,vx:Math.cos(a)*(1+Math.random()*spdMax),vy:Math.sin(a)*(1+Math.random()*spdMax),life:15+Math.random()*15,ml:30,sz:Math.random()*szMax+1,col});
  }
}

// ===== INPUT =====