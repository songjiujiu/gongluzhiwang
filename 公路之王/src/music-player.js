'use strict';
// One stage track at a time. Repeated frame updates never restart playback.
module.exports=function createMusicPlayer(createPlayer){
  const players={};let selected=0,playing=false;
  return {set({active,tier}){
    const next=tier>=4?4:tier>=3?3:0;
    try{
      if(next!==selected){if(players[selected]){players[selected].pause();players[selected].seek(0);}selected=next;playing=false;}
      if(!next)return;
      if(!active){if(playing)players[next].pause();playing=false;return;}
      if(!players[next])players[next]=createPlayer('audio/music-'+(next===3?'build':'climax')+'.mp3',next===3?.24:.32);
      if(!playing){players[next].play();playing=true;}
    }catch(_){playing=false;}
  }};
};
