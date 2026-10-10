'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {chromium}=require('C:/Users/songx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'research/blender-preview');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 const files=['公路之王/src/game-app.js','公路之王/src/platform.js','公路之王/src/scene-renderer.js'];
 const report={passed:false,scope:'Chromium with simulated 393x852 CSS pixels, DPR 3, safe area and native capsule; not a phone performance measurement',inputs:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')})),cases:[]};
 try{
  for(const variant of ['before','night','dawn','fallback-precision','no-derivatives','no-aa','low-limits']){
   const before=variant==='before',tier=variant==='dawn'?9:4;
   const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:3,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(variant=>{
    window.requestAnimationFrame=()=>1;
    if(variant==='fallback-precision'){const get=WebGLRenderingContext.prototype.getShaderPrecisionFormat;WebGLRenderingContext.prototype.getShaderPrecisionFormat=function(shader,type){if(shader===this.FRAGMENT_SHADER&&type===this.HIGH_FLOAT)return{precision:0,rangeMin:0,rangeMax:0};return get.call(this,shader,type);};}
    if(variant==='no-derivatives'){const ext=WebGLRenderingContext.prototype.getExtension;WebGLRenderingContext.prototype.getExtension=function(name){return name==='OES_standard_derivatives'?null:ext.call(this,name);};}
    if(variant==='no-aa')WebGLRenderingContext.prototype.createTexture=()=>null;
    if(variant==='low-limits'){const get=WebGLRenderingContext.prototype.getParameter;WebGLRenderingContext.prototype.getParameter=function(name){return name===this.MAX_TEXTURE_SIZE||name===this.MAX_RENDERBUFFER_SIZE?2048:get.call(this,name);};}
   },variant);
   await page.route('**/preview/browser-platform.js',route=>route.fulfill({contentType:'application/javascript',body:read('preview/browser-platform.js').replace('top: 30, bottom: phone ? 18 : 12','top: 100, bottom: 34').replace('Math.min(window.devicePixelRatio || 1, 3)',before?'Math.min(window.devicePixelRatio || 1, 2)':'Math.min(window.devicePixelRatio || 1, 3)')}));
   await page.route('**/src/difficulty-config.js',route=>route.fulfill({contentType:'application/javascript',body:read('公路之王/src/difficulty-config.js').replace(/"startTier":\s*\d+/,`"startTier": ${tier}`)}));
   if(before)for(const name of ['game-app','scene-renderer']){
    const body=execFileSync('git',['show',`23acaee:公路之王/src/${name}.js`],{cwd:root,encoding:'utf8'});
    await page.route(`**/src/${name}.js`,route=>route.fulfill({contentType:'application/javascript',body}));
   }
   await page.goto('http://127.0.0.1:4191/');await page.waitForFunction(()=>window.roadKingReady,null,{polling:50});
   const state=await page.evaluate(async()=>{
    const a=roadKingApp;await a.scene.ready;await a.artReady;a.start();a.game._nextTraffic=Infinity;a.update(2);a.game.distance=90;
    for(const [lane,z]of[[-1,18],[0,32],[1,50]])a.game.traffic.push(a.game._car(lane,z));a.draw();
    const capsule=document.createElement('div');capsule.style.cssText='position:fixed;right:9px;top:64px;width:76px;height:30px;border-radius:14px;background:#bec8cebb;color:#102332;text-align:center;font:bold 18px sans-serif;line-height:30px';capsule.textContent='···  ◎';document.body.appendChild(capsule);
    return {status:a.scene.status,top:a.oy,hudTop:a.oy+8*a.scale,viewHeight:a.viewHeight,scale:a.scale,buffer:[a.scene.canvas.width,a.scene.canvas.height],glError:a.scene.gl.getError(),night:a.scene.night,dawn:a.scene.dawn,aa:!!(a.scene.aaProgram&&a.scene.aaTexture),derivatives:!!a.scene.derivativeAA};
   });
   assert.equal(state.status,'ready');assert.equal(state.glError,0);
   if(['before','night','dawn','fallback-precision'].includes(variant))await page.screenshot({path:path.join(out,`mobile-${variant}-393.png`)});
   if(variant==='before'||variant==='night')await page.screenshot({path:path.join(out,`quality-car-${variant}.png`),clip:{x:85,y:495,width:225,height:225}});
   if(!before){
    assert.equal(state.aa,variant!=='no-aa');assert.equal(state.derivatives,variant!=='no-derivatives');if(variant==='low-limits')assert.ok(Math.max(...state.buffer)<=2048);
    assert.ok(state.hudTop>94);assert.ok(state.buffer[0]>=780);assert.ok(state.buffer[0]*state.buffer[1]<=2002000);
    const controls=await page.evaluate(()=>{
     const a=roadKingApp;a.game.traffic=[];let b=a.buttons.find(b=>b.key==='Ⅱ');
     const ev=(x,y)=>({changedTouches:[{identifier:1,clientX:a.ox+x*a.scale,clientY:a.oy+y*a.scale}]});
     a.touchStart(ev(b.x+b.w/2,b.y+b.h/2));a.touchEnd(ev(b.x,b.y));const paused=a.game.mode==='paused';a.draw();b=a.buttons.find(b=>b.key==='继续挑战');a.touchStart(ev(b.x+b.w/2,b.y+b.h/2));a.touchEnd(ev(b.x,b.y));
     const y=a.viewHeight-20;a.touchStart(ev(270,y));a.touchMove(ev(160,y));a.touchEnd(ev(160,y));const lane=a.game.lane;
     a.touchStart(ev(270,y));a.update(.35);const throttle=a.game.throttle;a.touchEnd(ev(270,y));a.draw();
     return{paused,resumed:a.game.mode==='playing',lane,throttle,released:!a.game.throttle};
    });
    assert.deepEqual(controls,{paused:true,resumed:true,lane:-1,throttle:true,released:true});state.controls=controls;
    if(variant==='night'){
     report.antialias=await page.evaluate(()=>{const a=roadKingApp,s=a.scene,g=s.gl,w=s.canvas.width,h=s.canvas.height,program=s.aaProgram;const raw=new Uint8Array(w*h*4),filtered=new Uint8Array(raw.length);s.aaProgram=null;s.render(a.game,a.clock);g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,raw);s.aaProgram=program;s.render(a.game,a.clock);g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,filtered);let sum=0,changed=0;for(let i=0;i<raw.length;i+=4){const diff=Math.abs(raw[i]-filtered[i])+Math.abs(raw[i+1]-filtered[i+1])+Math.abs(raw[i+2]-filtered[i+2]);sum+=diff;if(diff>3)changed++;}return{changed,meanChannelDifference:sum/(w*h*3),glError:g.getError()};});
     assert.ok(report.antialias.changed>100);assert.ok(report.antialias.meanChannelDifference<8);assert.equal(report.antialias.glError,0);
     await page.evaluate(()=>{roadKingApp.game.menu();roadKingApp.draw();});await page.screenshot({path:path.join(out,'mobile-menu-393.png')});
    }
   }
   assert.deepEqual(errors,[]);report.cases.push({variant,...state,errors});await page.close();
  }
  report.passed=true;fs.writeFileSync(path.join(out,'mobile-ui.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
