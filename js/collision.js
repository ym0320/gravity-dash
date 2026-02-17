'use strict';
// ===== COLLISION =====
// hurt(): take 1 HP damage (walls, enemies, bullets, crush)
function hurt(){
  if(hurtT>0)return; // still invincible from previous hit
  if(itemEff.invincible>0){shakeI=4;emitParts(player.x,player.y,8,'#ff00ff',3,2);return;}
  // Ghost character: transparent phase evades attacks
  if(ghostInvis){emitParts(player.x,player.y,6,'#a855f7',2,1);return;}
  hp--;
  if(hp<=0){die();return;}
  // Survive with damage
  hurtT=HURT_INVINCIBLE;
  shakeI=10;sfx('hurt');vibrate([20,10,30]);
  player.face='hurt';setTimeout(()=>{if(player.alive)player.face='normal';},400);
  emitParts(player.x,player.y,12,tc('obs'),4,3);
  addPop(player.x,player.y-25,'HP -1','#ff3860');
}
// die(): instant death (void fall = lose all HP, even when invincible)
function die(){
  hp=0;
  player.alive=false;state=ST.DEAD;deadT=0;shakeI=14;switchBGM('dead');
  player.face='dead';sfx('death');vibrate([30,20,50]);
  if(gameMode==='endless'){
    if(score>highScore){highScore=score;newHi=true;localStorage.setItem('gd5hi',highScore.toString());}
    played++;localStorage.setItem('gd5plays',played.toString());
    walletCoins+=totalCoins;localStorage.setItem('gd5wallet',walletCoins.toString());
  }
  for(let i=0;i<35;i++){const a=(6.28/35)*i,s=2+Math.random()*6;parts.push({x:player.x,y:player.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:35+Math.random()*25,ml:60,sz:Math.random()*6+2,col:i%3===0?CHARS[selChar].col:i%3===1?tc('obs'):'#fff'});}
}

const MILE_MSGS=['Nice!','Great!','Awesome!','Fantastic!','Incredible!','Unstoppable!','Legendary!','GODLIKE!','BEYOND!','INFINITE!'];
function checkMile(){
  // 1000pt intervals with English praise
  const nextMile=Math.ceil(score/1000)*1000;
  const prevMile=nextMile-1000;
  if(score>=nextMile&&lastMile<nextMile&&nextMile>0){
    lastMile=nextMile;
    const idx=Math.min(Math.floor(nextMile/1000)-1,MILE_MSGS.length-1);
    mileTxt=nextMile+' - '+MILE_MSGS[idx];
    mileT=120;
    sfx('milestone');shakeI=6;vibrate(40);
    for(let i=0;i<30;i++)parts.push({x:W*Math.random(),y:-10,vx:(Math.random()-0.5)*3,vy:Math.random()*3+1,life:60+Math.random()*30,ml:90,sz:Math.random()*5+2,col:['#ff3860','#00e5ff','#ffd700','#a855f7','#34d399'][i%5]});
  }
  // Live highscore check
  if(gameMode==='endless'&&!newHi&&score>highScore&&highScore>0){
    newHi=true;highScore=score;localStorage.setItem('gd5hi',highScore.toString());
    sfx('newhi');shakeI=8;vibrate([20,10,30,10,50]);
    newHiEffT=120;
    addPop(W/2,H*0.35,'NEW RECORD!','#ffd700');
    for(let i=0;i<20;i++)parts.push({x:W*Math.random(),y:H*0.3+Math.random()*40,vx:(Math.random()-0.5)*4,vy:-1-Math.random()*3,life:50+Math.random()*30,ml:80,sz:Math.random()*4+2,col:['#ffd700','#ffaa00','#fff'][i%3]});
  }
}
let newHiEffT=0; // new highscore effect timer

function useBomb(){
  if(bombCount<=0||state!==ST.PLAY)return;
  bombCount--;sfx('bomb');vibrate([30,20,50]);shakeI=15;bombFlashT=20;
  // Kill all on-screen enemies
  let kills=0;
  enemies.forEach(en=>{
    if(en.alive&&en.x>-30&&en.x<W+30){
      en.alive=false;kills++;
      emitParts(en.x,en.y,12,'#ff4400',4,3);
    }
  });
  // Also destroy bullets
  bullets.forEach(b=>{emitParts(b.x,b.y,6,'#ff4400',2,2);});
  bullets=[];
  if(kills>0)addPop(W/2,H*0.4,'BOOM! ×'+kills,'#ff4400');
  else addPop(W/2,H*0.4,'BOOM!','#ff4400');
  // Explosion ring particles
  for(let i=0;i<30;i++){const a=(6.28/30)*i;parts.push({x:player.x+Math.cos(a)*40,y:player.y+Math.sin(a)*40,vx:Math.cos(a)*5,vy:Math.sin(a)*5,life:30,ml:30,sz:4+Math.random()*3,col:['#ff4400','#ff6600','#ffaa00'][i%3]});}
}
function applyItem(type){
  vibrate(25);
  switch(type){
    case 0:sfx('item');itemEff.invincible=600;switchBGM('fever');break; // 10 seconds invincible
    case 1:sfx('item');itemEff.magnet=600;break; // 10 seconds coin magnet
    case 2:sfx('item');bombCount++;break; // bomb: store for manual use
    case 3: // Heart: recover 1 HP
      if(hp<maxHp()){hp++;sfx('heal');addPop(player.x,player.y-25,'HP +1','#ff3860');emitParts(player.x,player.y,10,'#ff3860',3,2);}
      else{sfx('coin');addPop(player.x,player.y-25,'HP MAX','#ff3860');}
      break;
  }
}
