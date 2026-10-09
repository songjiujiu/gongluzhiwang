const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../公路之王/src/engine-audio');
function fixture(){
 const sources=[],gains=[],reads=[];
 const param=()=>({value:0,events:[],setTargetAtTime(value,time,smooth){this.events.push({value,time,smooth});}});
 const context={state:'suspended',currentTime:0,destination:{},resume(){this.state='running';return Promise.resolve();},suspend(){this.state='suspended';return Promise.resolve();},decodeAudioData(bytes,done){done({duration:6.08});},createBufferSource(){const node={playbackRate:param(),starts:0,connect(){},start(){this.starts++;}};sources.push(node);return node;},createGain(){const node={gain:param(),connect(){}};gains.push(node);return node;}};
 const controller=create({createContext:()=>context,loadBytes:file=>{reads.push(file);return new ArrayBuffer(8);}});
 return{controller,context,sources,gains,reads};
}
test('speed changes automate persistent buffer loops without restarting or reloading',async()=>{
 const {controller,context,sources,gains,reads}=fixture();
 controller.set({active:true,volume:.2,idleVolume:.04,rate:1.2});await controller.ready();
 for(let n=0;n<100;n++){context.currentTime=n*.05;controller.set({active:true,volume:.2+n*.001,idleVolume:0,rate:1.2+n*.005});}
 assert.equal(sources.length,2);assert.deepEqual(sources.map(s=>s.starts),[1,1]);assert.equal(reads.length,2);
 assert.ok(sources.every(s=>s.loop));assert.ok(gains[0].gain.events.every(e=>e.smooth===.08));
 assert.ok(sources[0].playbackRate.events.every(e=>e.smooth===.12));
 controller.set({active:false,volume:.3,idleVolume:0,rate:1.7});assert.equal(context.state,'suspended');
 controller.set({active:true,volume:.3,idleVolume:0,rate:1.7});assert.equal(context.state,'running');
 assert.deepEqual(sources.map(s=>s.starts),[1,1]);
});
test('muting while audio is loading prevents delayed playback becoming audible',async()=>{
 const {controller,context,gains}=fixture();
 controller.set({active:true,volume:.3,idleVolume:.1,rate:1.4});
 controller.set({active:false,volume:.3,idleVolume:.1,rate:1.4});await controller.ready();
 assert.equal(context.state,'suspended');assert.ok(gains.every(g=>g.gain.value===0));
});
test('unsupported WebAudio signals a legacy-player fallback',()=>{
 const controller=create({createContext:()=>null,loadBytes:()=>new ArrayBuffer(0)});
 assert.equal(controller.set({active:true,volume:.2,idleVolume:.1,rate:1}),false);
});
