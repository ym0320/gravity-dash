'use strict';
// In-place array filter to avoid GC pressure from creating new arrays every frame
function fip(arr,fn){let j=0;for(let i=0;i<arr.length;i++){if(fn(arr[i]))arr[j++]=arr[i];}arr.length=j;}
const MAX_PARTS=150;
const MAX_AMBIENT=50;
function emitParts(x,y,n,col,szMax,spdMax){
  for(let i=0;i<n;i++){
    const a=(6.28/n)*i;
    if(parts.length>=MAX_PARTS)break;
    parts.push({x,y,vx:Math.cos(a)*(1+Math.random()*spdMax),vy:Math.sin(a)*(1+Math.random()*spdMax),life:15+Math.random()*15,ml:30,sz:Math.random()*szMax+1,col});
  }
}

// ===== INPUT =====