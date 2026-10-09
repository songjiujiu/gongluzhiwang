'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('C:/Users/songx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const asset=name=>{const b=fs.readFileSync(path.resolve(__dirname,'../公路之王/audio/'+name));return{bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};};
 const report={kind:'Persistent WebAudio playback and 15-second rendered PCM continuity; not native phone or subjective listening verification',asset:asset('engine.wav'),idleAsset:asset('engine-idle.wav'),recordingSource:'wikusv / V8 Lotus / Freesound, CC BY 4.0',passed:false};
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;});
  await page.goto(process.env.ROAD_KING_PREVIEW_URL||'http://127.0.0.1:4180/',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.roadKingReady,null,{polling:50,timeout:120000});
  await page.evaluate(async()=>{await roadKingApp.artReady;await roadKingApp.scene.ready;roadKingApp.draw();});
  const start=await page.evaluate(()=>{const a=roadKingApp,b=a.buttons.find(b=>b.key.includes('开始'));const r=a.p.canvas.getBoundingClientRect();return{x:r.left+a.ox+(b.x+b.w/2)*a.scale,y:r.top+a.oy+(b.y+b.h/2)*a.scale};});
  await page.touchscreen.tap(start.x,start.y);await page.evaluate(()=>roadKingEngine.ready());
  await page.waitForFunction(()=>roadKingEngine.snapshot().contextState==='running',null,{polling:50});
  const read=()=>page.evaluate(()=>({...roadKingEngine.snapshot(),speed:roadKingApp.game.speed}));
  report.start=await read();assert.equal(report.start.sourceCount,2);assert.ok(Math.abs(report.start.durations[0]-6.08)<.01);
  await page.evaluate(()=>{roadKingApp.game._nextTraffic=Infinity;roadKingApp.update(80);});
  report.fast=await read();assert.ok(report.fast.rate>report.start.rate);assert.ok(report.fast.volume>report.start.volume);
  await page.evaluate(()=>{const a=roadKingApp;a.game.traffic.push(a.game._car(0,0));a.update(.01);});
  report.crashIdle=await read();assert.equal(report.crashIdle.speed,0);assert.equal(report.crashIdle.volume,0);assert.equal(report.crashIdle.idleVolume,.2);
  await page.evaluate(()=>{roadKingApp.changeLane(1);roadKingApp.update(3.2);});
  report.recovery=await read();assert.ok(report.recovery.speed>0);
  await page.evaluate(()=>roadKingApp.toggleSound());
  await page.waitForFunction(()=>roadKingEngine.snapshot().contextState==='suspended',null,{polling:50});
  await page.evaluate(()=>roadKingApp.toggleSound());
  await page.waitForFunction(()=>roadKingEngine.snapshot().contextState==='running',null,{polling:50});
  await page.evaluate(()=>roadKingApp.game.pause());
  await page.waitForFunction(()=>roadKingEngine.snapshot().contextState==='suspended',null,{polling:50});
  await page.evaluate(()=>roadKingApp.game.resume());
  await page.waitForFunction(()=>roadKingEngine.snapshot().contextState==='running',null,{polling:50});
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(()=>roadKingEngine.snapshot().contextState==='suspended',null,{polling:50});
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal((await read()).active,false);
  await page.evaluate(()=>roadKingApp.game.resume());
  await page.waitForFunction(()=>roadKingEngine.snapshot().contextState==='running',null,{polling:50});
  assert.equal((await read()).sourceCount,2);
  report.continuity=await page.evaluate(async()=>{
   const context=new OfflineAudioContext(1,22050*15,22050),source=context.createBufferSource();
   source.buffer=await context.decodeAudioData(await fetch('/公路之王/audio/engine.wav').then(r=>r.arrayBuffer()));source.loop=true;source.playbackRate.value=1.4;source.connect(context.destination);source.start();
   const result=await context.startRendering(),samples=result.getChannelData(0),size=1102,rms=[];
   for(let i=0;i+size<=samples.length;i+=size){let energy=0;for(let j=0;j<size;j++)energy+=samples[i+j]**2;rms.push(Math.sqrt(energy/size));}
   return{seconds:15,loopPasses:15*1.4/source.buffer.duration,minRms:Math.min(...rms),maxRms:Math.max(...rms),silentWindows:rms.filter(v=>v<.005).length};
  });
  assert.equal(report.continuity.silentWindows,0);assert.ok(report.continuity.minRms/report.continuity.maxRms>.4);
  await page.evaluate(()=>roadKingApp.game._finish(false,'audio verification'));
  await page.waitForFunction(()=>roadKingEngine.snapshot().contextState==='suspended',null,{polling:50});
  assert.deepEqual(errors,[]);report.errors=errors;report.passed=true;
  fs.writeFileSync(path.resolve(__dirname,'../research/blender-preview/engine-playback.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
