// Native Douyin adapter. Does not require a DOM, server, login or network.
const createEngineAudio=require('./engine-audio');
const createSidebar=require('./sidebar');

module.exports = function createPlatform(api) {
  const sidebar=createSidebar(api);
  let showHandler=null;
  // Register synchronously at game startup, before any asset loading.
  if(typeof api.onShow==='function')api.onShow(options=>{sidebar.onShow(options);if(showHandler)showHandler(options);});
  const canvas = api.createCanvas(), info = api.getSystemInfoSync();
  const width = info.windowWidth || info.screenWidth || 375;
  const height = info.windowHeight || info.screenHeight || 667;
  const ratio = Math.min(info.pixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  const safe = info.safeArea || {top:0,bottom:height};
  const bind = (name, cb) => { if (typeof api[name] === 'function') api[name](cb); };
  const audio = {};
  let engine = null, engineIdle = null, enginePlaying = false;
  const engineAudio=createEngineAudio({
    createContext:()=>api.getAudioContext?api.getAudioContext():null,
    loadBytes:filePath=>new Promise((resolve,reject)=>api.getFileSystemManager().readFile({filePath,success:r=>resolve(r.data),fail:reject})),
    onFailure:state=>fallbackEngine(state)
  });
  function fallbackEngine({active,volume,rate,idleVolume}){
    if(!api.createInnerAudioContext)return;
    try{
      if(!active){if(enginePlaying)for(const a of [engine,engineIdle]){if(a){if(a.pause)a.pause();else a.stop();}}enginePlaying=false;return;}
      if(!engine){engine=api.createInnerAudioContext();engine.loop=true;engine.src='audio/engine.wav';if(engine.onError)engine.onError(()=>{enginePlaying=false;});engineIdle=api.createInnerAudioContext();engineIdle.loop=true;engineIdle.src='audio/engine-idle.wav';if(engineIdle.onError)engineIdle.onError(()=>{enginePlaying=false;});}
      if(Math.abs(engine.volume-volume)>.005||engine.volume==null)engine.volume=volume;
      if(Math.abs(engineIdle.volume-idleVolume)>.005||engineIdle.volume==null)engineIdle.volume=idleVolume;
      // Legacy players keep a steady rate; frequent rate setters can interrupt audio.
      if(engine.playbackRate!==1.25){try{engine.playbackRate=1.25;}catch(_){}}
      if(!enginePlaying){enginePlaying=true;engine.play();engineIdle.play();}
    }catch(_){enginePlaying=false;}
  }
  const images = Object.create(null);
  return {
    sidebar,
    canvas,width,height,ratio,top:Math.max(30,safe.top||0),bottom:Math.max(10,height-(safe.bottom||height)),
    createRenderCanvas:()=>api.createCanvas(),
    async loadSceneData(){
      const fs=api.getFileSystemManager();
      const read=(filePath,encoding)=>new Promise((resolve,reject)=>fs.readFile({filePath,encoding,success:r=>resolve(r.data),fail:reject}));
      const [json,binary]=await Promise.all([read('assets/scene/meshes.json','utf8'),read('assets/scene/meshes.bin')]);
      return{manifest:JSON.parse(json),binary};
    },
    now:()=>Date.now(), frame:fn=>requestAnimationFrame(fn),
    touches(start,move,end,cancel) { bind('onTouchStart',start);bind('onTouchMove',move);bind('onTouchEnd',end);bind('onTouchCancel',cancel); },
    lifecycle(hide,show) { bind('onHide',hide);showHandler=show; },
    loadImage(src) {
      if (images[src]) return images[src];
      const request = new Promise((resolve, reject) => {
        try {
          if (typeof api.createImage !== 'function') throw new Error('Image loading is unavailable');
          const image = api.createImage();
          image.onload = () => { image.onload = image.onerror = null; resolve(image); };
          image.onerror = () => { image.onload = image.onerror = null; reject(new Error('Unable to load ' + src)); };
          image.src = src;
        } catch (error) { reject(error); }
      });
      images[src] = request;
      request.catch(() => { if (images[src] === request) delete images[src]; });
      return request;
    },
    read(key) { try{return api.getStorageSync(key);}catch(_){return null;} },
    write(key,value) { try{api.setStorageSync(key,value);}catch(_){} },
    sound(name) {
      if (!api.createInnerAudioContext) return;
      try {
        if (!audio[name]) { const a=api.createInnerAudioContext();a.src='audio/'+name+'.wav';a.volume=name==='hit'?.85:.3;if(a.onError)a.onError(()=>{});audio[name]=a; }
        audio[name].stop();audio[name].play();
      } catch(_) {}
    },
    stopSound(){Object.keys(audio).forEach(k=>{try{audio[k].stop();}catch(_){}});},
    setEngine(state) {if(!engineAudio.set(state))fallbackEngine(state);},
    vibrate(){if(api.vibrateShort)api.vibrateShort({fail:()=>{}});}
  };
};
