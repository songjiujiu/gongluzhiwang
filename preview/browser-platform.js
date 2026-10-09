'use strict';

(async function boot() {
  const canvas = document.getElementById('game');
  const phone = window.innerWidth <= 480;
  const width = phone ? window.innerWidth : Math.min(395, window.innerWidth - 32);
  const height = phone ? window.innerHeight : Math.max(480, Math.min(852, window.innerHeight - 64));
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const callbacks = { start: null, move: null, end: null, cancel: null, hide: null, show: null };
  const pressed = new Map();
  const held = new Set();
  const sounds = Object.create(null);
  let engine = null, engineIdle = null, engineStarting = false;
  let engineAudio = null;
  const images = Object.create(null);

  function touch(pointer) {
    const bounds = canvas.getBoundingClientRect();
    return {
      identifier: pointer.pointerId,
      clientX: (pointer.clientX - bounds.left) * width / bounds.width,
      clientY: (pointer.clientY - bounds.top) * height / bounds.height
    };
  }
  function dispatch(name, point) {
    if (callbacks[name]) callbacks[name]({ changedTouches: [point] });
  }
  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    const point = touch(event);
    pressed.set(event.pointerId, point);
    dispatch('start', point);
  });
  canvas.addEventListener('pointermove', event => {
    if (!pressed.has(event.pointerId)) return;
    event.preventDefault();
    const point = touch(event);
    pressed.set(event.pointerId, point);
    dispatch('move', point);
  });
  for (const [eventName, callback] of [['pointerup', 'end'], ['pointercancel', 'cancel']])
    canvas.addEventListener(eventName, event => {
      if (!pressed.has(event.pointerId)) return;
      event.preventDefault();
      dispatch(callback, touch(event));
      pressed.delete(event.pointerId);
    });
  canvas.addEventListener('contextmenu', event => event.preventDefault());

  const platform = {
    canvas, width, height, ratio, top: 30, bottom: phone ? 18 : 12,
    createRenderCanvas:()=>document.createElement('canvas'),
    async loadSceneData(){
      const [meta,data]=await Promise.all([fetch('/公路之王/assets/scene/meshes.json'),fetch('/公路之王/assets/scene/meshes.bin')]);
      if(!meta.ok||!data.ok)throw new Error('3D meshes could not be loaded');
      return{manifest:await meta.json(),binary:await data.arrayBuffer()};
    },
    now: () => Date.now(),
    frame: callback => window.requestAnimationFrame(callback),
    touches(start, move, end, cancel) { Object.assign(callbacks, { start, move, end, cancel }); },
    lifecycle(hide, show) { Object.assign(callbacks, { hide, show }); },
    loadImage(src) {
      if (images[src]) return images[src];
      const request = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => { image.onload = image.onerror = null; resolve(image); };
        image.onerror = () => { image.onload = image.onerror = null; reject(new Error('Unable to load ' + src)); };
        image.src = '/公路之王/' + src;
      });
      images[src] = request;
      request.catch(() => { if (images[src] === request) delete images[src]; });
      return request;
    },
    read(key) {
      try { const value = localStorage.getItem(key); return value === null ? null : JSON.parse(value); }
      catch (_) { return null; }
    },
    write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} },
    sound(name) {
      try {
        if (!sounds[name]) {
          sounds[name] = new Audio('/公路之王/audio/' + encodeURIComponent(name) + '.wav');
          sounds[name].volume = name === 'hit' ? .85 : .3;
        }
        sounds[name].pause();
        sounds[name].currentTime = 0;
        const play = sounds[name].play();
        if (play && play.catch) play.catch(() => {});
      } catch (_) {}
    },
    stopSound() {
      for (const audio of Object.values(sounds)) { audio.pause(); audio.currentTime = 0; }
    },
    setEngine({active,volume,rate,idleVolume}) {
      if(!engineAudio){
        engineAudio=modules['engine-audio']({createContext:()=>new AudioContext(),loadBytes:file=>fetch('/公路之王/'+file).then(r=>{if(!r.ok)throw new Error('Missing engine audio');return r.arrayBuffer();})});
        window.roadKingEngine=engineAudio;
      }
      if(engineAudio.set({active,volume,rate,idleVolume}))return;
      try {
        if(!active){if(engine)engine.pause();if(engineIdle)engineIdle.pause();return;}
        if(!engine){engine=new Audio('/公路之王/audio/engine.wav');engine.loop=true;engine.preservesPitch=false;engineIdle=new Audio('/公路之王/audio/engine-idle.wav');engineIdle.loop=true;}
        engine.volume=volume;engine.playbackRate=1.25;engineIdle.volume=idleVolume;
        if((engine.paused||engineIdle.paused)&&!engineStarting){engineStarting=true;Promise.all([engine,engineIdle].filter(a=>a.paused).map(a=>a.play())).catch(()=>{}).finally(()=>{engineStarting=false;});}
      } catch (_) {engineStarting=false;}
    },
    vibrate() { if (navigator.vibrate) navigator.vibrate(18); }
  };
  window.roadKingPlatform = platform;
  platform.clearKeys = () => held.clear();
  let hidden = false;
  function hide() {
    if (hidden) return;
    hidden = true;
    for (const point of pressed.values()) dispatch('cancel', point);
    pressed.clear();
    if (callbacks.hide) callbacks.hide();
    platform.stopSound();
  }
  function show() {
    if (!hidden) return;
    hidden = false;
    if (callbacks.show) callbacks.show();
  }
  window.addEventListener('blur', hide);
  window.addEventListener('focus', show);
  document.addEventListener('visibilitychange', () => document.hidden ? hide() : show());

  // Each untouched CommonJS file receives a private module scope, without a bundler.
  const modules = Object.create(null);
  async function load(name) {
    const url = '/公路之王/src/' + name + '.js';
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('无法加载 ' + url + ' (' + response.status + ')');
    const source = await response.text();
    const module = { exports: {} };
    const require = request => {
      const key = request.replace(/^\.\//, '').replace(/\.js$/, '');
      if (!Object.prototype.hasOwnProperty.call(modules, key)) throw new Error('未加载模块: ' + request);
      return modules[key];
    };
    new Function('module', 'exports', 'require', source + '\n//# sourceURL=' + url)(module, module.exports, require);
    modules[name] = module.exports;
    return module.exports;
  }
  try {
    await load('engine-audio');
    await load('difficulty-config');
    await load('game-core');
    await load('scene-renderer');
    const RoadKingApp = await load('game-app');
    window.roadKingApp = new RoadKingApp(platform);
    window.roadKingReady = true;
  } catch (error) {
    document.getElementById('error').style.display = 'block';
    document.getElementById('error').textContent = '预览未启动。请运行 node preview/serve.js 后访问本地地址。\n\n' + (error.stack || error.message);
    console.error(error);
    return;
  }

  function core() {
    const app = window.roadKingApp;
    return app && (app.core || app.game);
  }
  function updateHeld() {
    const game = core();
    if (!game) return;
    window.roadKingApp.setKeyboardHolds(
      held.has('KeyW') || held.has('ArrowUp')
    );
  }
  window.addEventListener('keydown', event => {
    const game = core();
    if (!game) return;
    const keys = ['KeyA', 'KeyD', 'KeyW', 'KeyF', 'KeyR', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Escape', 'Enter'];
    if (!keys.includes(event.code)) return;
    event.preventDefault();
    held.add(event.code); updateHeld();
    if (event.repeat) return;
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') window.roadKingApp.changeLane(-1);
    else if (event.code === 'KeyD' || event.code === 'ArrowRight') window.roadKingApp.changeLane(1);
    else if (event.code === 'KeyF') game.pulse();
    else if (event.code === 'Escape') {
      window.roadKingApp.releaseHolds();
      game.mode === 'paused' ? game.resume() : game.pause();
    }
    else if (event.code === 'KeyR' || event.code === 'Enter') {
      const app = window.roadKingApp;
      if (event.code === 'Enter' && game.mode === 'paused') { app.releaseHolds(); game.resume(); }
      else if (event.code === 'KeyR' || game.mode === 'menu' || game.mode === 'result') app.start();
    }
  });
  window.addEventListener('keyup', event => { held.delete(event.code); updateHeld(); });
  window.addEventListener('blur', () => { held.clear(); updateHeld(); });
})();
