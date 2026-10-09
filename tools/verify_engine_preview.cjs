'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('C:/Users/songx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const file=fs.readFileSync(path.resolve(__dirname,'../公路之王/audio/engine.wav'));
 const idle=fs.readFileSync(path.resolve(__dirname,'../公路之王/audio/engine-idle.wav'));
 const report={kind:'Actual Chromium engine playback, speed-driven pitch/volume and lifecycle checks; not native phone or subjective listening verification',asset:{bytes:file.length,sha256:crypto.createHash('sha256').update(file).digest('hex')},passed:false};
 report.idleAsset={bytes:idle.length,sha256:crypto.createHash('sha256').update(idle).digest('hex')};
 report.recordingSource='wikusv / V8 Lotus / Freesound, CC BY 4.0';
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.requestAnimationFrame=()=>1;window.engineTestAudio=[];window.engineTestErrors=[];
   const NativeAudio=window.Audio;
   window.Audio=function(...args){const a=new NativeAudio(...args);engineTestAudio.push(a);a.addEventListener('error',()=>engineTestErrors.push({src:a.src,code:a.error?.code}));return a;};window.Audio.prototype=NativeAudio.prototype;
  });
  await page.goto(process.env.ROAD_KING_PREVIEW_URL||'http://127.0.0.1:4180/',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.roadKingReady,null,{polling:50,timeout:120000});
  await page.evaluate(async()=>{await roadKingApp.artReady;await roadKingApp.scene.ready;roadKingApp.draw();});
  assert.equal(await page.evaluate(()=>engineTestAudio.length),0);
  const start=await page.evaluate(()=>{const a=roadKingApp,b=a.buttons.find(b=>b.key.includes('开始'));const r=a.p.canvas.getBoundingClientRect();return{x:r.left+a.ox+(b.x+b.w/2)*a.scale,y:r.top+a.oy+(b.y+b.h/2)*a.scale};});
  await page.touchscreen.tap(start.x,start.y);
  await page.waitForFunction(()=>engineTestAudio[0]?.currentTime>.1&&!engineTestAudio[0].paused,null,{polling:50,timeout:30000});
  const read=()=>page.evaluate(()=>{const a=engineTestAudio.find(a=>a.src.endsWith('engine.wav')),idle=engineTestAudio.find(a=>a.src.endsWith('engine-idle.wav'));return{duration:a.duration,loop:a.loop,volume:a.volume,rate:a.playbackRate,preservesPitch:a.preservesPitch,paused:a.paused,speed:roadKingApp.game.speed,idleVolume:idle.volume,idlePaused:idle.paused};});
  report.start=await read();assert.equal(report.start.duration,2.24);assert.equal(report.start.loop,true);assert.equal(report.start.preservesPitch,false);
  // Isolate audio state from random obstacles, then trigger a real core collision.
  await page.evaluate(()=>{roadKingApp.game._nextTraffic=Infinity;roadKingApp.update(80);});
  report.fast=await read();assert.ok(report.fast.rate>report.start.rate);assert.ok(report.fast.volume>report.start.volume);
  await page.evaluate(()=>{const a=engineTestAudio[0];a.currentTime=a.duration-.05;});
  await page.waitForFunction(()=>engineTestAudio[0].currentTime<.5&&!engineTestAudio[0].paused,null,{polling:50,timeout:10000});
  report.loopWrap=true;
  await page.evaluate(()=>{const a=roadKingApp;a.game.traffic.push(a.game._car(0,0));a.update(.01);});
  report.crashIdle=await read();assert.equal(report.crashIdle.speed,0);assert.equal(report.crashIdle.volume,0);assert.equal(report.crashIdle.idleVolume,.2);assert.equal(report.crashIdle.idlePaused,false);
  await page.evaluate(()=>{roadKingApp.changeLane(1);roadKingApp.update(3.2);});
  report.recovery=await read();assert.ok(report.recovery.speed>0);assert.ok(report.recovery.rate>report.crashIdle.rate);
  await page.evaluate(()=>roadKingApp.toggleSound());assert.equal((await read()).paused,true);assert.equal((await read()).idlePaused,true);
  await page.evaluate(()=>roadKingApp.toggleSound());
  await page.waitForFunction(()=>!engineTestAudio[0].paused,null,{polling:50});
  await page.evaluate(()=>roadKingApp.game.pause());assert.equal((await read()).paused,true);
  await page.evaluate(()=>roadKingApp.game.resume());
  await page.waitForFunction(()=>!engineTestAudio[0].paused,null,{polling:50});
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await read()).paused,true);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal((await read()).paused,true);
  await page.evaluate(()=>roadKingApp.game.resume());
  await page.waitForFunction(()=>!engineTestAudio[0].paused,null,{polling:50});
  await page.evaluate(()=>roadKingApp.game._finish(false,'audio verification'));assert.equal((await read()).paused,true);
  report.engineInstances=await page.evaluate(()=>engineTestAudio.filter(a=>a.src.endsWith('engine.wav')).length);assert.equal(report.engineInstances,1);
  report.errors=await page.evaluate(()=>engineTestErrors);assert.deepEqual(report.errors,[]);assert.deepEqual(errors,[]);
  report.passed=true;fs.writeFileSync(path.resolve(__dirname,'../research/blender-preview/engine-playback.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
