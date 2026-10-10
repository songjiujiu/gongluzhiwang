'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {chromium}=require('C:/Users/songx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'research/blender-preview');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const files=['公路之王/src/difficulty-config.js','公路之王/src/scene-renderer.js','公路之王/assets/scene/meshes.json','公路之王/assets/scene/meshes.bin','art/blender/night-road.blend'];
 const inputs=files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}));
 const report={passed:false,scope:'Actual WebGL scene in Chromium; not phone performance verification',inputs,screens:[]};
 try{
  for(const [width,height] of [[390,844],[320,568]]){
   const page=await browser.newPage({viewport:{width,height},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;});
   await page.route('**/src/difficulty-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(path.join(root,'公路之王/src/difficulty-config.js'),'utf8').replace(/"startTier":\s*\d+/, '"startTier": 1')}));
   await page.goto(process.env.ROAD_KING_PREVIEW_URL||'http://127.0.0.1:4191/');
   await page.waitForFunction(()=>window.roadKingReady,null,{polling:50});
   const initial=await page.evaluate(async()=>{
    const a=roadKingApp;await a.scene.ready;await a.artReady;a.start();a.game._nextTraffic=Infinity;
    a.game.update(69);a.game.distance=60;
    for(const [lane,z,kind] of [[-1,16,'car'],[1,28,'barrier'],[0,48,'car']]){const car=a.game._car(lane,z);car.kind=kind;a.game.traffic.push(car);}
    a.draw();return {status:a.scene.status,night:a.scene.night,vertices:a.scene.models.streetlamp.reduce((n,b)=>n+b.count,0)};
   });
   assert.equal(initial.status,'ready');assert.equal(initial.night,0);assert.ok(initial.vertices>500);
   await page.screenshot({path:path.join(out,`night-before-${width}.png`)});
   // Keep the same visible obstacles/camera to compare lighting alone.
   const night=await page.evaluate(()=>{const a=roadKingApp;a.game.elapsed=73;a.game._updateDifficulty();a.draw();const gl=a.scene.gl,pixels=new Uint8Array(540*960*4);gl.readPixels(0,0,540,960,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let lit=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>180)lit++;return{amount:a.scene.night,error:gl.getError(),litFraction:lit/(540*960)};});
   assert.equal(night.amount,1);assert.equal(night.error,0);assert.ok(night.litFraction>.05);
   await page.screenshot({path:path.join(out,`night-game-${width}.png`)});
   const dawn=[];
   for(const tier of [6,7,8,9]){
    const state=await page.evaluate(tier=>{const a=roadKingApp;a.game.elapsed=a.game.stages.slice(0,tier-1).reduce((sum,s)=>sum+s.durationSeconds,0)+3;a.game._updateDifficulty();a.draw();return{tier:a.game.difficulty.tier,night:a.scene.night,dawn:a.scene.dawn,fog:a.scene.fog,error:a.scene.gl.getError()};},tier);
    assert.equal(state.tier,tier);assert.equal(state.night,0);assert.equal(state.dawn,1);assert.ok(state.fog>0);assert.equal(state.error,0);dawn.push(state);
    if(tier===6||tier===9)await page.screenshot({path:path.join(out,`dawn-tier${tier}-${width}.png`)});
   }
   const reset=await page.evaluate(()=>{roadKingApp.start();roadKingApp.draw();return roadKingApp.scene.night;});assert.equal(reset,0);
   assert.deepEqual(errors,[]);report.screens.push({width,height,initial,night,dawn,errors});await page.close();
  }
  const direct=await browser.newPage({viewport:{width:390,height:844}});
  await direct.addInitScript(()=>{window.requestAnimationFrame=()=>1;});
  await direct.route('**/src/difficulty-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(path.join(root,'公路之王/src/difficulty-config.js'),'utf8').replace(/"startTier":\s*\d+/, '"startTier": 4')}));
  await direct.goto(process.env.ROAD_KING_PREVIEW_URL||'http://127.0.0.1:4191/');
  await direct.waitForFunction(()=>window.roadKingReady,null,{polling:50});
  report.selectedStart=await direct.evaluate(async()=>{const a=roadKingApp;await a.scene.ready;a.start();a.draw();return{tier:a.game.difficulty.tier,elapsed:a.game.elapsed,score:a.game.score,night:a.scene.night,glError:a.scene.gl.getError()};});
  assert.deepEqual(report.selectedStart,{tier:4,elapsed:0,score:0,night:1,glError:0});
  await direct.screenshot({path:path.join(out,'night-start-tier4.png')});await direct.close();
  report.passed=true;fs.writeFileSync(path.join(out,'night-scene.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
