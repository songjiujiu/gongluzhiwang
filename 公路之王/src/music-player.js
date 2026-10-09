'use strict';
// One stage track at a time. Repeated frame updates never restart playback.
module.exports=function createMusicPlayer(createPlayer,now=()=>Date.now()){
  const players={};let selected=0,playing=false,retryAt=0;
  function interrupted(tier){if(selected===tier){playing=false;retryAt=now()+500;}}
  return {set({active,tier}){
    const next=tier>=4?4:tier>=3?3:0;
    try{
      if(next!==selected){if(players[selected]){players[selected].pause();players[selected].seek(0);}selected=next;playing=false;retryAt=0;}
      if(!next)return;
      if(!active){if(playing)players[next].pause();playing=false;return;}
      if(!players[next])players[next]=createPlayer('audio/music-'+(next===3?'build':'climax')+'.mp3',next===3?.24:.48,()=>interrupted(next));
      if(!playing&&now()>=retryAt){playing=true;const result=players[next].play();if(result&&result.catch)result.catch(()=>interrupted(next));}
    }catch(_){interrupted(next);}
  }};
};
