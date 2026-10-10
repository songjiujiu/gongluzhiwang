'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {chromium}=require('C:/Users/songx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'research/blender-preview');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
(async()=>{
 const files=['公路之王/src/scene-renderer.js','公路之王/assets/scene/meshes.json','公路之王/assets/scene/meshes.bin','公路之王/assets/scene/vehicle-materials.jpg','公路之王/assets/scene/vehicle-materials.json','art/blender/roadking-assets.blend'];
 const report={passed:false,scope:'Actual Chromium WebGL, identical chase camera and fixed traffic; not a phone performance measurement or a pixel-identical Cycles comparison',beforeCommit:'8dacb43',inputs:files.map(file=>({file,sha256:hash(file)})),cases:[]};
 const manifest=JSON.parse(read('公路之王/assets/scene/meshes.json')),binary=fs.readFileSync(path.join(root,'公路之王/assets/scene/meshes.bin'));
 const metadata=JSON.parse(read('公路之王/assets/scene/vehicle-materials.json'));
 assert.equal(metadata.atlasSha256,hash('公路之王/assets/scene/vehicle-materials.jpg'));
 assert.equal(metadata.sourceSha256,hash('art/blender/roadking-assets.blend'));
 assert.equal(metadata.materials.length,8);assert.equal(metadata.rows.length,2);
 for(const batches of Object.values(manifest.models))for(const b of batches){
  assert.ok(b.offset+(b.vertexCount||b.count)*12<=binary.length);
  if(b.indexOffset!=null){assert.ok(b.indexOffset+b.count*2<=binary.length);for(let i=0;i<b.count;i++)assert.ok(binary.readUInt16LE(b.indexOffset+i*2)<b.vertexCount);}
 }
 const triangles=name=>manifest.models[name].reduce((sum,b)=>sum+b.count/3,0);
 assert.ok(triangles('playerHero')>triangles('player'));
 report.geometry={playerTriangles:triangles('player'),heroTriangles:triangles('playerHero'),binaryBytes:binary.length};
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 try{
  for(const variant of ['before','day','night','dawn','missing-material','upload-error']){
   const before=variant==='before',fallback=variant==='missing-material'||variant==='upload-error';
   const tier=variant==='night'?4:variant==='dawn'?9:1;
   const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:3,hasTouch:true});const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(variant=>{
    window.requestAnimationFrame=()=>1;
    if(variant==='upload-error'){
     const upload=WebGLRenderingContext.prototype.texImage2D;
     WebGLRenderingContext.prototype.texImage2D=function(...args){if(args.at(-1)?.src?.includes('vehicle-materials.jpg'))throw new Error('Simulated texture upload failure');return upload.apply(this,args);};
    }
   },variant);
   await page.route('**/preview/browser-platform.js',route=>route.fulfill({contentType:'application/javascript',body:read('preview/browser-platform.js').replace('top: 30, bottom: phone ? 18 : 12','top: 100, bottom: 34')}));
   await page.route('**/src/difficulty-config.js',route=>route.fulfill({contentType:'application/javascript',body:read('公路之王/src/difficulty-config.js').replace(/"startTier":\s*\d+/,`"startTier": ${tier}`)}));
   if(before)for(const file of ['src/scene-renderer.js','assets/scene/meshes.json','assets/scene/meshes.bin']){
    const body=execFileSync('git',['show',`8dacb43:公路之王/${file}`],{cwd:root,maxBuffer:8*1024*1024});
    await page.route(`**/${file}`,route=>route.fulfill({contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':'application/octet-stream',body}));
   }
   if(variant==='missing-material')await page.route('**/assets/scene/vehicle-materials.jpg',route=>route.fulfill({status:404,body:'Simulated missing material'}));
   await page.goto('http://127.0.0.1:4191/');await page.waitForFunction(()=>window.roadKingReady,null,{polling:50});
   const state=await page.evaluate(async()=>{
    const a=roadKingApp;await a.scene.ready;await a.artReady;a.start();a.game._nextTraffic=Infinity;a.update(2);a.game.distance=90;
    for(const [lane,z]of[[-1,18],[0,32],[1,50]])a.game.traffic.push(a.game._car(lane,z));a.draw();
    const s=a.scene;
    return{status:s.status,materialTexture:!!s.materialTexture,materialError:s.materialError||null,hero:!!s.models.playerHero,glError:s.gl.getError(),flipY:s.gl.getParameter(s.gl.UNPACK_FLIP_Y_WEBGL),buffer:[s.canvas.width,s.canvas.height],night:s.night,dawn:s.dawn};
   });
   assert.equal(state.status,'ready');assert.equal(state.glError,0);assert.equal(state.materialTexture,!before&&!fallback);
   if(!before){assert.equal(state.hero,true);assert.equal(state.flipY,false);if(fallback)assert.ok(state.materialError);else assert.equal(state.materialError,null);}
   if(!fallback){
    await page.screenshot({path:path.join(out,`blender-match-${variant}.png`)});
    await page.screenshot({path:path.join(out,`blender-match-car-${variant}.png`),clip:{x:85,y:495,width:225,height:225}});
   }
   const controls=await page.evaluate(()=>{
    const a=roadKingApp;a.game.traffic=[];
    const ev=(x,y)=>({changedTouches:[{identifier:1,clientX:a.ox+x*a.scale,clientY:a.oy+y*a.scale}]});
    a.touchStart(ev(270,a.viewHeight-20));a.touchMove(ev(160,a.viewHeight-20));a.touchEnd(ev(160,a.viewHeight-20));
    a.update(.25);a.draw();return{lane:a.game.lane,mode:a.game.mode,glError:a.scene.gl.getError()};
   });
   assert.deepEqual(controls,{lane:-1,mode:'playing',glError:0});assert.deepEqual(errors,[]);
   report.cases.push({variant,...state,controls,errors});await page.close();
  }
  report.passed=true;fs.writeFileSync(path.join(out,'material-fidelity.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
