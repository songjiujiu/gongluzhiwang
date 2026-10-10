'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('C:/Users/songx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const bytes=fs.readFileSync(path.resolve(__dirname,'../公路之王/audio/hit.wav'));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--autoplay-policy=no-user-gesture-required']});
 try{
  const page=await browser.newPage();
  const report=await page.evaluate(async base64=>{
   const context=new AudioContext(),raw=Uint8Array.from(atob(base64),v=>v.charCodeAt(0));
   const buffer=await context.decodeAudioData(raw.buffer),samples=buffer.getChannelData(0);
   let peak=0,energy=0,firstAudible=-1;
   for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));energy+=samples[i]**2;if(firstAudible<0&&Math.abs(samples[i])>.01)firstAudible=i/buffer.sampleRate;}
   // Exercise the same HTMLAudio path as browser-platform.js through completion.
   const audio=new Audio('data:audio/wav;base64,'+base64);audio.volume=.85;
   await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Impact playback timed out')),5000);
    audio.onended=()=>{clearTimeout(timeout);resolve()};audio.onerror=()=>{clearTimeout(timeout);reject(new Error('Impact decoding/playback failed'))};
    audio.play().catch(error=>{clearTimeout(timeout);reject(error)});
   });
   await context.close();
   return{duration:buffer.duration,channels:buffer.numberOfChannels,peak,rms:Math.sqrt(energy/samples.length),firstAudible,playbackEnded:audio.ended};
  },bytes.toString('base64'));
  assert.ok(report.duration>.3&&report.duration<.65);assert.equal(report.channels,1);
  assert.ok(report.peak>.7&&report.peak<.99);assert.ok(report.rms>.02);assert.ok(report.firstAudible<.02);assert.equal(report.playbackEnded,true);
  report.sha256=crypto.createHash('sha256').update(bytes).digest('hex');report.passed=true;
  report.scope='Chromium decoding, signal levels and playback completion; not subjective listening or phone verification';
  fs.writeFileSync(path.resolve(__dirname,'../research/blender-preview/collision-audio.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
