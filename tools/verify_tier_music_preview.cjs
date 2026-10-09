'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/songx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const report={passed:false,kind:'Browser tier transitions and actual music playback, not phone listening'};
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;window.testAudio=[];const Native=window.Audio;window.Audio=function(src){const a=new Native(src);window.testAudio.push(a);return a;};});
  await page.goto(process.env.ROAD_KING_PREVIEW_URL||'http://127.0.0.1:4181/');await page.waitForFunction(()=>window.roadKingReady,null,{polling:50});
  await page.evaluate(()=>{roadKingApp.start();roadKingApp.game._nextTraffic=Infinity;});
  const read=()=>page.evaluate(()=>({tier:roadKingApp.game.difficulty.tier,speed:roadKingApp.game.speed,clips:window.testAudio.filter(a=>a.src.includes('music-')).map(a=>({src:a.src,paused:a.paused,time:a.currentTime,duration:a.duration,ready:a.readyState}))}));
  report.tier1=await read();assert.equal(report.tier1.clips.length,0);
  await page.evaluate(()=>roadKingApp.update(30));report.tier2=await read();assert.equal(report.tier2.clips.length,0);
  await page.evaluate(()=>roadKingApp.update(30));await page.waitForFunction(()=>testAudio.some(a=>a.src.includes('music-build')&&a.currentTime>.1),null,{polling:50});report.tier3=await read();assert.equal(report.tier3.clips[0].paused,false);
  await page.evaluate(()=>roadKingApp.update(30));await page.waitForFunction(()=>testAudio.some(a=>a.src.includes('music-climax')&&a.currentTime>.1),null,{polling:50});report.tier4=await read();assert.equal(report.tier4.clips[0].paused,true);assert.equal(report.tier4.clips[1].paused,false);
  await page.evaluate(()=>roadKingApp.toggleSound());assert.ok((await read()).clips.every(a=>a.paused));
  await page.evaluate(()=>roadKingApp.toggleSound());assert.equal((await read()).clips[1].paused,false);
  await page.evaluate(()=>roadKingApp.game.pause());assert.ok((await read()).clips.every(a=>a.paused));
  await page.evaluate(()=>roadKingApp.game.resume());assert.equal((await read()).clips[1].paused,false);
  await page.evaluate(()=>roadKingApp.start());assert.ok((await read()).clips.every(a=>a.paused));
  assert.deepEqual(errors,[]);report.errors=errors;report.passed=true;
 }finally{fs.writeFileSync('research/blender-preview/tier-music.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
