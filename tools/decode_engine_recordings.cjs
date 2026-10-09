'use strict';
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/songx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage();
  for(const name of ['lotus-idle','lotus-rev']){
   const file=path.resolve(__dirname,'../art/audio/'+name+'.mp3');
   const decoded=await page.evaluate(async base64=>{
    const context=new AudioContext({sampleRate:22050});
    const input=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),buffer=await context.decodeAudioData(input.buffer);
    const mono=new Int16Array(buffer.length);
    for(let i=0;i<mono.length;i++){let v=0;for(let c=0;c<buffer.numberOfChannels;c++)v+=buffer.getChannelData(c)[i]/buffer.numberOfChannels;mono[i]=Math.round(Math.max(-1,Math.min(1,v))*32767);}
    const bytes=new Uint8Array(mono.buffer);let raw='';for(let i=0;i<bytes.length;i+=32768)raw+=String.fromCharCode(...bytes.subarray(i,i+32768));
    await context.close();return{pcm:btoa(raw),duration:buffer.duration,channels:buffer.numberOfChannels};
   },fs.readFileSync(file).toString('base64'));
   const pcm=Buffer.from(decoded.pcm,'base64'),head=Buffer.alloc(44);
   head.write('RIFF',0);head.writeUInt32LE(pcm.length+36,4);head.write('WAVEfmt ',8);head.writeUInt32LE(16,16);head.writeUInt16LE(1,20);head.writeUInt16LE(1,22);head.writeUInt32LE(22050,24);head.writeUInt32LE(44100,28);head.writeUInt16LE(2,32);head.writeUInt16LE(16,34);head.write('data',36);head.writeUInt32LE(pcm.length,40);
   fs.writeFileSync(file.replace('.mp3','.wav'),Buffer.concat([head,pcm]));delete decoded.pcm;console.log(name,decoded);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
