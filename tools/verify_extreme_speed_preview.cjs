const fs=require('fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/songx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const report={passed:false,kind:'Controlled extreme-speed rendering, spawning and collision checks in browser; not phone verification',speeds:[]};
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>window.requestAnimationFrame=()=>1);
  await page.goto(process.env.ROAD_KING_PREVIEW_URL||'http://127.0.0.1:4182/');
  await page.waitForFunction(()=>window.roadKingReady,null,{polling:50});
  await page.evaluate(async()=>{await roadKingApp.artReady;await roadKingApp.scene.ready;});
  for(const speed of [1000,1500,20000,40000]){
   const spawned=await page.evaluate(speed=>{
    const a=roadKingApp;Object.assign(a.game.stages[0],{durationSeconds:9999,speedStart:speed,speedEnd:speed,reactionSeconds:4});
    a.start();a.update(1.5);a.draw();return{speed:a.game.speed,waves:a.game.waveCount,traffic:a.game.traffic.map(c=>({x:c.x,z:c.z})),glError:a.scene.gl.getError()};
   },speed);
   assert.equal(spawned.speed,speed);assert.ok(spawned.waves>0);assert.ok(spawned.traffic.some(c=>c.z>0&&c.z<=145));assert.equal(spawned.glError,0);
   await page.screenshot({path:'research/blender-preview/extreme-speed-'+speed+'.png'});
   const crash=await page.evaluate(()=>{const a=roadKingApp,g=a.game;g.lane=g.playerX=g.traffic[0].lane;g._nextTraffic=Infinity;a.update(4);a.draw();return{stopped:g.collisionStopped,collisions:g.collisions,speed:g.speed};});
   assert.equal(crash.stopped,true);assert.equal(crash.collisions,1);assert.equal(crash.speed,0);report.speeds.push({spawned,crash});
  }
  assert.deepEqual(errors,[]);report.errors=errors;report.passed=true;
 }finally{fs.writeFileSync('research/blender-preview/extreme-speed.json',JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
