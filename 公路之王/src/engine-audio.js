'use strict';
// Persistent in-memory loops: parameter automation never restarts a source.
module.exports = function createEngineAudio({createContext,loadBytes,onFailure}) {
  let context=null,nodes=[],loading=null,failed=false,state={active:false,volume:0,idleVolume:0,rate:1};
  const decode=bytes=>new Promise((resolve,reject)=>{
    try{const result=context.decodeAudioData(bytes,resolve,reject);if(result&&result.then)result.then(resolve,reject);}catch(error){reject(error);}
  });
  function apply(){
    if(!context||nodes.length!==2)return;
    const now=context.currentTime||0;
    nodes.forEach((node,i)=>{
      const volume=state.active?(i===0?state.volume:state.idleVolume):0;
      if(node.volume!==volume){if(node.gain.gain.setTargetAtTime)node.gain.gain.setTargetAtTime(volume,now,.08);else node.gain.gain.value=volume;node.volume=volume;}
      const rate=i===0?state.rate:1;
      if(node.rate!==rate){if(node.source.playbackRate.setTargetAtTime)node.source.playbackRate.setTargetAtTime(rate,now,.12);else node.source.playbackRate.value=rate;node.rate=rate;}
    });
    if(!state.active&&context.state!=='suspended'&&context.suspend){try{const p=context.suspend();if(p&&p.catch)p.catch(()=>{});}catch(_){}}
  }
  function set(next){
    state={...next};if(failed)return false;
    if(!context){
      if(!state.active)return true;
      try{context=createContext();if(!context||!context.createBufferSource||!context.createGain||!context.decodeAudioData){failed=true;return false;}}
      catch(_){failed=true;return false;}
    }
    if(state.active&&context.state!=='running'&&context.resume){try{const p=context.resume();if(p&&p.catch)p.catch(()=>{});}catch(_){}}
    if(!loading){
      loading=Promise.all(['audio/engine.wav','audio/engine-idle.wav'].map(file=>Promise.resolve().then(()=>loadBytes(file)).then(decode))).then(buffers=>{
        nodes=buffers.map(buffer=>{
          const source=context.createBufferSource(),gain=context.createGain();
          source.buffer=buffer;source.loop=true;gain.gain.value=0;
          source.connect(gain);gain.connect(context.destination);source.start();
          return{source,gain,volume:0,rate:1};
        });apply();
      }).catch(error=>{failed=true;if(onFailure)onFailure(state,error);});
    }
    apply();return true;
  }
  return{set,ready:()=>loading||Promise.resolve(),snapshot:()=>({backend:'WebAudio buffer loops',failed,active:state.active,contextState:context&&context.state,time:context&&context.currentTime,sourceCount:nodes.length,durations:nodes.map(n=>n.source.buffer.duration),...state})};
};
