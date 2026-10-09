'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {chromium}=require('C:/Users/songx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve(__dirname,'../research/blender-preview');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const meshInputs=()=>['meshes.json','meshes.bin'].map(name=>{const bytes=fs.readFileSync(path.resolve(__dirname,'../公路之王/assets/scene',name));return{name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
 const report={date:'2026-10-09',kind:'Actual game WebGL scene composited with Canvas HUD; not Douyin IDE or phone verification',meshInputs:meshInputs(),viewports:{},passed:false};
 try{
  for(const [width,height]of[[390,844],[320,568]]){
   const page=await browser.newPage({viewport:{width,height},hasTouch:true}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;});
   await page.goto('http://127.0.0.1:4179/',{waitUntil:'domcontentloaded',timeout:120000});
   await page.waitForFunction(()=>window.roadKingReady,{},{polling:50,timeout:120000});
   await page.evaluate(()=>roadKingApp.scene.ready);
   const status=await page.evaluate(()=>({status:roadKingApp.scene.status,error:roadKingApp.scene.error}));
   assert.equal(status.status,'ready',JSON.stringify(status));
   await page.evaluate(()=>roadKingApp.draw());
   await page.screenshot({path:path.join(out,`realtime-menu-${width}x${height}.png`)});
   await page.evaluate(()=>{roadKingApp.start();roadKingApp.draw();});
   await page.screenshot({path:path.join(out,`realtime-game-${width}x${height}.png`)});
   const checks=await page.evaluate(()=>{
    const a=roadKingApp,g=a.game,s=a.scene,gl=s.gl;
    const vertices=Object.fromEntries(Object.entries(s.models).map(([k,b])=>[k,b.reduce((n,x)=>n+x.count,0)]));
    const point=s.project([0,1,0]);
    return{status:s.status,vertices,playerScreenPoint:point,glError:gl.getError(),mode:g.mode};
   });
   assert.equal(checks.glError,0);assert.ok(checks.vertices.player>10000);assert.ok(checks.playerScreenPoint.y>300&&checks.playerScreenPoint.y<844);
   const input=await page.evaluate(()=>{
    const a=roadKingApp,evt=(x,y)=>({changedTouches:[{identifier:1,clientX:a.ox+x*a.scale,clientY:a.oy+y*a.scale}]});
    a.touchStart(evt(270,540));a.touchMove(evt(170,540));a.touchEnd(evt(170,540));a.update(.3);a.draw();
    const lane=a.game.lane,b=a.buttons.find(b=>b.key==='气浪技能');
    a.touchStart(evt(b.x+b.w/2,b.y+b.h/2));a.touchEnd(evt(b.x+b.w/2,b.y+b.h/2));a.draw();
    const left=s=>a.scene.project([a.game.playerX*3.1+s,1,1.8]);
    return{lane,pulse:a.game.pulseCooldown,disabled:a.buttons.find(b=>b.key==='气浪技能').disabled,carBounds:[left(-1.05).x,left(1.05).x]};
   });
   assert.equal(input.lane,-1);assert.ok(input.pulse>0);assert.equal(input.disabled,true);
   assert.ok(input.carBounds[0]>=0&&input.carBounds[1]<=540,'Entire player car must remain on screen after swiping');
   await page.screenshot({path:path.join(out,`realtime-pulse-${width}x${height}.png`)});
   const paused=await page.evaluate(()=>{const a=roadKingApp;a.releaseHolds();a.game.pause();const elapsed=a.game.elapsed;a.update(2);a.draw();return a.game.elapsed===elapsed;});
   assert.ok(paused);assert.deepEqual(errors,[]);
   report.viewports[`${width}x${height}`]={...checks,input,paused,errors};await page.close();
  }
  const failure=await browser.newPage({viewport:{width:390,height:844}});
  await failure.addInitScript(()=>{window.requestAnimationFrame=()=>1;});
  await failure.route('**/assets/scene/meshes.bin',route=>route.fulfill({status:404,body:'Expected missing geometry'}));
  await failure.goto('http://127.0.0.1:4179/',{waitUntil:'domcontentloaded'});
  await failure.waitForFunction(()=>window.roadKingReady,null,{polling:50});
  report.geometryFailure=await failure.evaluate(async()=>{const a=roadKingApp;await a.scene.ready;a.start();a.draw();return{status:a.scene.status,error:a.scene.error,mode:a.game.mode};});
  assert.equal(report.geometryFailure.status,'failed');assert.equal(report.geometryFailure.mode,'playing');
  await failure.screenshot({path:path.join(out,'realtime-load-error.png')});await failure.close();
  assert.deepEqual(meshInputs(),report.meshInputs,'Geometry changed during verification');report.passed=true;
 }finally{await browser.close();fs.writeFileSync(path.join(out,'realtime-ui-smoke.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
