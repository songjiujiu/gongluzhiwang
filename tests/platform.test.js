'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../公路之王/src/platform.js'), 'utf8');

function fixture(info = {}) {
  const events = {}, storage = new Map(), audio = [], images = [], canvas = {}, frames = [];
  const api = {
    createCanvas: () => canvas,
    createImage() { const image = {}; images.push(image); return image; },
    getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 3, safeArea: { top: 47, bottom: 810 }, ...info }),
    getStorageSync: key => storage.has(key) ? storage.get(key) : null,
    setStorageSync: (key, value) => storage.set(key, value),
    createInnerAudioContext() {
      const item = { plays: 0, stops: 0, play() { this.plays++; }, stop() { this.stops++; }, onError(callback) { this.error = callback; } };
      audio.push(item); return item;
    },
    vibrateShort(options) { events.vibration = options; }
  };
  for (const name of ['onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel', 'onHide', 'onShow'])
    api[name] = callback => { events[name] = callback; };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, requestAnimationFrame: callback => { frames.push(callback); return frames.length; }, Date });
  return { platform: module.exports(api), api, events, storage, audio, images, canvas, frames };
}

test('scene files use local native filesystem JSON and binary reads',async()=>{
  const {platform,api}=fixture(),binary=new ArrayBuffer(24),reads=[];
  api.getFileSystemManager=()=>({readFile(options){reads.push(options);options.success({data:options.encoding?'{"models":{},"stride":12}':binary});}});
  const scene=await platform.loadSceneData();
  assert.equal(scene.manifest.stride,12);assert.equal(scene.binary,binary);
  assert.deepEqual(reads.map(r=>r.filePath),['assets/scene/meshes.json','assets/scene/meshes.bin']);
});
test('missing native scene file rejects instead of returning empty geometry',async()=>{
  const {platform,api}=fixture();api.getFileSystemManager=()=>({readFile(options){options.fail(new Error('missing scene'));}});
  await assert.rejects(platform.loadSceneData(),/missing scene/);
});

test('Douyin canvas uses CSS dimensions, caps backing scale at two and respects safe area', () => {
  const { platform, canvas } = fixture();
  assert.equal(platform.width, 390); assert.equal(platform.height, 844); assert.equal(platform.ratio, 2);
  assert.equal(canvas.width, 780); assert.equal(canvas.height, 1688);
  assert.equal(platform.top, 47); assert.equal(platform.bottom, 34);
  const fallback = fixture({ windowWidth: 0, windowHeight: 0, screenWidth: 375, screenHeight: 667, pixelRatio: 1, safeArea: undefined }).platform;
  assert.equal(fallback.width, 375); assert.equal(fallback.height, 667);
  assert.equal(fallback.top, 30); assert.equal(fallback.bottom, 10);
});

test('touch and lifecycle handlers bind directly to all six native callbacks', () => {
  const { platform, events } = fixture();
  const start = () => {}, move = () => {}, end = () => {}, cancel = () => {}, hide = () => {}, show = () => {};
  platform.touches(start, move, end, cancel); platform.lifecycle(hide, show);
  assert.equal(events.onTouchStart, start); assert.equal(events.onTouchMove, move);
  assert.equal(events.onTouchEnd, end); assert.equal(events.onTouchCancel, cancel);
  assert.equal(events.onHide, hide); assert.equal(events.onShow, show);
});

test('storage round trips structured values and unavailable storage is nonfatal', () => {
  const { platform, api } = fixture();
  const result = { score: 1430, stars: 3 };
  platform.write('record', result);
  assert.equal(platform.read('record'), result);
  api.getStorageSync = () => { throw new Error('unavailable'); };
  api.setStorageSync = () => { throw new Error('quota'); };
  assert.equal(platform.read('record'), null);
  assert.doesNotThrow(() => platform.write('record', result));
});

test('audio contexts are cached by sound name, replay safely and stop on request', () => {
  const { platform, audio } = fixture();
  platform.sound('pulse'); platform.sound('pulse'); platform.sound('hit');
  assert.equal(audio.length, 2);
  assert.equal(audio[0].src, 'audio/pulse.wav'); assert.equal(audio[0].volume, 0.3);
  assert.equal(audio[0].plays, 2); assert.equal(audio[0].stops, 2);
  assert.equal(audio[1].plays, 1);
  platform.stopSound();
  assert.equal(audio[0].stops, 3); assert.equal(audio[1].stops, 2);
  assert.equal(typeof audio[0].error, 'function');
});

test('frame schedules the exact callback and optional APIs can be absent', () => {
  const { platform, api, frames, events } = fixture();
  const callback = () => {};
  platform.frame(callback);
  assert.equal(frames[0], callback);
  assert.equal(typeof platform.now(), 'number');
  platform.vibrate(); assert.equal(typeof events.vibration.fail, 'function');
  delete api.vibrateShort; delete api.createInnerAudioContext; delete api.onHide;
  assert.doesNotThrow(() => platform.vibrate());
  assert.doesNotThrow(() => platform.sound('success'));
  assert.doesNotThrow(() => platform.lifecycle(() => {}, () => {}));
});

test('native local images bind loading callbacks before src and cache the decoded resource', async () => {
  const { platform, images } = fixture();
  const first = platform.loadImage('assets/blender/car-player.png');
  const second = platform.loadImage('assets/blender/car-player.png');
  assert.equal(first, second);
  assert.equal(images.length, 1);
  assert.equal(images[0].src, 'assets/blender/car-player.png');
  assert.equal(typeof images[0].onload, 'function');
  images[0].onload();
  assert.equal(await first, images[0]);
  assert.equal(await platform.loadImage('assets/blender/car-player.png'), images[0]);
  assert.equal(images[0].onerror, null);
});

test('missing or unavailable images reject cleanly and a failed image can retry', async () => {
  const { platform, api, images } = fixture();
  const failed = platform.loadImage('assets/blender/missing.png');
  images[0].onerror();
  await assert.rejects(failed, /Unable to load/);
  const retry = platform.loadImage('assets/blender/missing.png');
  assert.equal(images.length, 2);
  images[1].onload();
  assert.equal(await retry, images[1]);
  delete api.createImage;
  await assert.rejects(platform.loadImage('assets/blender/tree.png'), /unavailable/);
});
