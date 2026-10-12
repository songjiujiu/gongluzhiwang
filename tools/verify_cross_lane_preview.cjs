'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('C:/Users/songx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'research/blender-preview');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const source='公路之王/src/game-core.js';
 const report={passed:false,scope:'Actual shared game core and WebGL in Chromium; not a physical phone test',inputs:[{file:source,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,source))).digest('hex')}],cases:[]};
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:2,hasTouch:true});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;});
  const config=fs.readFileSync(path.join(root,'公路之王/src/difficulty-config.js'),'utf8').replace(/"startTier":\s*\d+/, '"startTier": 2');
  await page.route('**/src/difficulty-config.js',route=>route.fulfill({contentType:'application/javascript',body:config}));
  await page.goto('http://127.0.0.1:4191/');await page.waitForFunction(()=>window.roadKingReady,null,{polling:50});
  await page.evaluate(async()=>{await roadKingApp.scene.ready;await roadKingApp.artReady;});
  for(const [from,to]of[[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0]]){
   const spawn=await page.evaluate(([from,to])=>{
    const a=roadKingApp;a.start();const g=a.game;g._nextTraffic=Infinity;let seed=123;
    g.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    let car;
    for(let i=0;i<2000;i++){g.traffic=[];g._spawnTraffic();car=g.traffic.find(c=>c.changePending&&c.lane===from&&c.targetLane===to);if(car)break;}
    if(!car)throw new Error('Requested route never generated');
    g.lane=g.playerX=car.safeLane;window.checkedCar=car;
    for(let i=0;i<1000&&!car.signalDirection;i++)g._updateTraffic(.01);
    a.draw();return{from,to,x:car.x,z:car.z,warning:car.warningTimer,signal:car.signalDirection};
   },[from,to]);
   assert.equal(spawn.x,from);assert.ok(spawn.warning>0);assert.equal(spawn.signal,Math.sign(to-from));
   if(Math.abs(to-from)===2)await page.screenshot({path:path.join(out,`cross-lane-${from}-warning.png`)});
   const crossing=await page.evaluate(()=>{
    const a=roadKingApp,g=a.game,c=checkedCar;let last=c.x,maxStep=0,overlap=false,steps=0;
    while(steps++<500){g._updateTraffic(.01);maxStep=Math.max(maxStep,Math.abs(c.x-last));last=c.x;
     for(let i=0;i<g.traffic.length;i++)for(let j=i+1;j<g.traffic.length;j++){const x=g.traffic[i],y=g.traffic[j];if(Math.abs(x.x-y.x)<.76&&Math.abs(x.z-y.z)<5.5-1e-8)overlap=true;}
     if(!c.changePending&&(Math.abs(c.x)<.02||c.x===c.targetLane))break;
    }
    a.draw();return{x:c.x,lane:c.lane,pending:c.changePending,maxStep,overlap,collisions:g.collisions,glError:a.scene.gl.getError()};
   });
   assert.ok(crossing.maxStep<=.040001);assert.equal(crossing.overlap,false);assert.equal(crossing.collisions,0);assert.equal(crossing.glError,0);
   if(Math.abs(to-from)===2){assert.ok(Math.abs(crossing.x)<.02);await page.screenshot({path:path.join(out,`cross-lane-${from}-middle.png`)});}
   const end=await page.evaluate(()=>{const a=roadKingApp,g=a.game,c=checkedCar;for(let i=0;i<150&&c.x!==c.targetLane;i++)g._updateTraffic(.01);a.draw();return{x:c.x,lane:c.lane,pending:c.changePending,collisions:g.collisions,glError:a.scene.gl.getError()};});
   assert.equal(end.x,to);assert.equal(end.lane,to);assert.equal(end.pending,false);assert.equal(end.collisions,0);assert.equal(end.glError,0);
   if(Math.abs(to-from)===2)await page.screenshot({path:path.join(out,`cross-lane-${from}-complete.png`)});
   report.cases.push({spawn,crossing,end});
  }
  assert.deepEqual(errors,[]);report.errors=errors;report.passed=true;
  fs.writeFileSync(path.join(out,'cross-lane-ui.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
