'use strict';
// ===== COLLISION =====
// hurt(): take 1 HP damage (walls, enemies, bullets, crush)
// isWall: if true, ghost transparency does NOT block damage (terrain/wall hit)
function hurt(isWall){
  if(hurtT>0)return; // still invincible from previous hit
  if(playerDamageImmune()){shakeI=4;emitParts(player.x,player.y,8,'#ff00ff',3,2);return;}
  // Ghost character: transparent phase evades enemy attacks only, not walls/terrain
  if((ghostInvis||specialGhostActive())&&!isWall){emitParts(player.x,player.y,6,'#a855f7',2,1);return;}
  // Puff pet: transparent phase evades enemy attacks
  if(petPuffInvis&&!isWall){emitParts(player.x,player.y,5,'#88ddff',2,1);return;}
  if(bossPhase.active)bossPhase.noDamage=false;
  hp--;
  if(isSpecialActive('stone')&&specialState.bonusHpCurrent>0)specialState.bonusHpCurrent--;
  if(hp<=0){
    hp=1;
    if(specialState.gauge>=SPECIAL_GAUGE_MAX&&canActivateSpecial(true)){
      _rescueSavedGDir=player.gDir; // capture gDir before any state change
      if(tryActivateSpecialSkill('death-save',true)){
        hurtT=Math.max(hurtT,HURT_INVINCIBLE);
        shakeI=12;sfx('item');vibrate('milestone');
        addPop(player.x,player.y-34,t('specialActivate'),'#22d3ee');
        _rescueSavedGDir=null;
        return;
      }
      _rescueSavedGDir=null;
    }
    hp=0;die();return;
  }
  // Survive with damage
  hurtT=HURT_INVINCIBLE;
  shakeI=10;sfx('hurt');vibrate('hurt');
  if(typeof triggerPetReaction==='function')triggerPetReaction('hurt',42);
  player.face='hurt';setTimeout(()=>{if(player.alive)player.face='normal';},400);
  emitParts(player.x,player.y,12,tc('obs'),4,3);
  addPop(player.x,player.y-25,'HP -1','#ff3860');
}
// die(): instant death
function die(){
  hp=0;
  // Clear mid-game save on death (no longer resumable)
  if(!isPackMode)clearSaveData(isChallengeMode?'challenge':'endless');
  player.alive=false;state=ST.DEAD;deadT=0;shakeI=14;switchBGM('dead');
  if(typeof triggerPetReaction==='function')triggerPetReaction('gameover',150);
  player.face='dead';sfx('death');vibrate('death');
  bossRetry=null; // clear boss retry on death
  bossPhase.active=false;bossPhase.prepare=0; // stop boss alert overlay on death screen
  // Record death position for stage mode marker (up to 10 per stage)
  if(isPackMode&&currentPackStage){
    const sid=currentPackStage.id;
    if(!stageDeathMarks[sid])stageDeathMarks[sid]=[];
    stageDeathMarks[sid].push({dist:rawDist,gDir:player.gDir,py:player.y});
    if(stageDeathMarks[sid].length>10)stageDeathMarks[sid].shift();
    // Firestoreにも保存（他のプレイヤーのゴースト用）
    if(typeof fbSaveDeathMark==='function'){
      fbSaveDeathMark(sid,rawDist,player.y,player.gDir);
    }
  }
  // Transfer earned chests to inventory storage
  runChests=bossChests; // preserve count for dead screen
  if(bossChests>0){
    localStorage.setItem('gd5lastRunChests',bossChests.toString());
    storedChests+=bossChests;localStorage.setItem('gd5storedChests',storedChests.toString());
    bossChests=0;
  } else {
    localStorage.setItem('gd5lastRunChests','0');
  }
  if(gameMode==='endless'||isChallengeMode){
    if(isChallengeMode){
      // Challenge mode: save best kills
      if(challengeKills>challengeBestKills){
        challengeBestKills=challengeKills;
        localStorage.setItem('gd5challBest',challengeBestKills.toString());
        if(typeof syncLiveRankingAppearanceLocally==='function')syncLiveRankingAppearanceLocally();
      }
      fbSaveUserData();
      if(typeof checkNewTitleUnlocks==='function')checkNewTitleUnlocks();
    } else {
      if(score>highScore){highScore=score;newHi=true;localStorage.setItem('gd5hi',highScore.toString());captureRankCosmetics();notifNewHighScore=true;localStorage.setItem('gd5notifHi','1');}
      played++;localStorage.setItem('gd5plays',played.toString());
      walletCoins+=totalCoins;localStorage.setItem('gd5wallet',walletCoins.toString());addLifetimeCoins(totalCoins);
      fbSaveUserData();
      if(typeof checkNewTitleUnlocks==='function')checkNewTitleUnlocks();
    }
  }
  for(let i=0;i<35&&parts.length<MAX_PARTS;i++){const a=(6.28/35)*i,s=2+Math.random()*6;parts.push({x:player.x,y:player.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:35+Math.random()*25,ml:60,sz:Math.random()*6+2,col:i%3===0?CHARS[selChar].col:i%3===1?tc('obs'):'#fff'});}
  if(typeof resetSpecialState==='function')resetSpecialState();
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
    sfx('milestone');shakeI=6;vibrate('milestone');
    for(let i=0;i<30&&parts.length<MAX_PARTS;i++)parts.push({x:W*Math.random(),y:-10,vx:(Math.random()-0.5)*3,vy:Math.random()*3+1,life:60+Math.random()*30,ml:90,sz:Math.random()*5+2,col:['#ff3860','#00e5ff','#ffd700','#a855f7','#34d399'][i%5]});
  }
  // Live highscore check
  if(gameMode==='endless'&&!newHi&&score>highScore&&highScore>0){
    newHi=true;highScore=score;localStorage.setItem('gd5hi',highScore.toString());captureRankCosmetics();notifNewHighScore=true;localStorage.setItem('gd5notifHi','1');
    sfx('newhi');shakeI=8;vibrate('newhi');
    newHiEffT=120;
    addPop(W/2,H*0.35,'NEW RECORD!','#ffd700');
    for(let i=0;i<20&&parts.length<MAX_PARTS;i++)parts.push({x:W*Math.random(),y:H*0.3+Math.random()*40,vx:(Math.random()-0.5)*4,vy:-1-Math.random()*3,life:50+Math.random()*30,ml:80,sz:Math.random()*4+2,col:['#ffd700','#ffaa00','#fff'][i%3]});
  }
}
let newHiEffT=0; // new highscore effect timer

function useBomb(){
  if(bombCount<=0||(state!==ST.PLAY&&state!==ST.TUTORIAL))return;
  if(bossPhase.active){sfx('hurt');vibrate(10);addPop(player.x,player.y-30,t('popBossNoItem'),'#ff4444');return;}
  bombCount--;
  if(state===ST.PLAY)consumeStoredRunItem('item_bomb');
  if(typeof triggerPetReaction==='function')triggerPetReaction('bomb',54);
  sfx('bomb');vibrate('bomb');shakeI=15;bombFlashT=20;
  // Kill all on-screen enemies
  let kills=0;
  enemies.forEach(en=>{
    if(en.alive&&en.x>-30&&en.x<W+30){
      en.alive=false;kills++;
      const bon=Math.floor(10+Math.min(score*0.1,20));
      dist+=bon;
      addPop(en.x,en.y-en.sz*en.gDir,'+'+bon,'#ff4400');
      emitParts(en.x,en.y,12,'#ff4400',4,3);
    }
  });
  // Also destroy bullets
  bullets.forEach(b=>{emitParts(b.x,b.y,6,'#ff4400',2,2);});
  bullets=[];
  if(kills>0)addPop(W/2,H*0.4,'BOOM! ×'+kills,'#ff4400');
  else addPop(W/2,H*0.4,'BOOM!','#ff4400');
  // Explosion ring particles
  for(let i=0;i<30&&parts.length<MAX_PARTS;i++){const a=(6.28/30)*i;parts.push({x:player.x+Math.cos(a)*40,y:player.y+Math.sin(a)*40,vx:Math.cos(a)*5,vy:Math.sin(a)*5,life:30,ml:30,sz:4+Math.random()*3,col:['#ff4400','#ff6600','#ffaa00'][i%3]});}
}
function useInvincible(){
  if(magnetCount<=0||state!==ST.PLAY||isPackMode||isChallengeMode)return;
  if(itemEff.magnet>0)return; // locked while current magnet is still active
  magnetCount--;
  consumeStoredRunItem('item_magnet');
  itemEff.magnet=ITEM_MAGNET_DURATION;
  if(typeof triggerPetReaction==='function')triggerPetReaction('magnet',ITEM_MAGNET_DURATION);
  sfx('item');vibrate('item');
  addPop(player.x,player.y-25,t('popMagnetActivate'),'#f59e0b');
}
function applyItem(type){
  vibrate('item');
  switch(type){
    case 0:sfx('coin');addPop(player.x,player.y-25,'SPECIAL +','#22d3ee');addSpecialGaugeReward(SPECIAL_ITEM_GAIN);break; // retired invincible fallback
    case 1:sfx('item');itemEff.magnet=ITEM_MAGNET_DURATION;break; // 10 seconds coin magnet
    case 2:sfx('item');bombCount++;break; // bomb: store for manual use
    case 3: // Heart: recover 1 HP
      if(hp<maxHp()){hp++;sfx('heal');addPop(player.x,player.y-25,'HP +1','#ff3860');emitParts(player.x,player.y,10,'#ff3860',3,2);}
      else{sfx('coin');addPop(player.x,player.y-25,'HP MAX','#ff3860');}
      break;
  }
}
