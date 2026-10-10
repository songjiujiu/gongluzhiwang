'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require('C:/Users/songx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=spawn(process.execPath,[path.join(root,'preview/serve.js'),'4190'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let browser;
 try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Preview exited '+code)));});
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
  const results=[];
  for(const [width,height] of [[390,844],[320,568]]){
   const page=await browser.newPage({viewport:{width,height},hasTouch:true}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;});
   await page.goto('http://127.0.0.1:4190/');await page.waitForFunction(()=>window.roadKingReady,null,{polling:50});
   await page.evaluate(async source=>{
    const module={exports:{}};new Function('module',source)(module);
    window.sidebarCalls=0;window.sidebarFail=true;
    roadKingApp.p.sidebar=module.exports({checkScene:o=>o.success({isExist:true}),navigateToScene(o){sidebarCalls++;if(sidebarFail)o.fail({});else o.success({});}});
    await roadKingApp.artReady;await roadKingApp.scene.ready;roadKingApp.draw();
   },fs.readFileSync(path.join(root,'公路之王/src/sidebar.js'),'utf8'));
   const tap=async key=>{
    const point=await page.evaluate(key=>{const a=roadKingApp,b=a.buttons.find(b=>b.key===key);if(!b)throw Error('Missing button '+key);const r=a.p.canvas.getBoundingClientRect();return{x:r.left+a.ox+(b.x+b.w/2)*a.scale,y:r.top+a.oy+(b.y+b.h/2)*a.scale};},key);
    await page.touchscreen.tap(point.x,point.y);
   };
   await page.screenshot({path:path.join(root,`research/blender-preview/sidebar-home-${width}.png`)});
   await tap('侧边栏再来玩');assert.equal(await page.evaluate(()=>sidebarCalls),0);
   await page.screenshot({path:path.join(root,`research/blender-preview/sidebar-guide-${width}.png`)});
   await tap('去首页侧边栏');assert.equal(await page.evaluate(()=>roadKingApp.sidebarGuide),true);
   assert.match(await page.evaluate(()=>roadKingApp.sidebarMessage),/稍后重试/);
   await page.evaluate(()=>{sidebarFail=false;});await tap('去首页侧边栏');
   assert.equal(await page.evaluate(()=>sidebarCalls),2);assert.equal(await page.evaluate(()=>roadKingApp.sidebarGuide),false);
   await page.evaluate(()=>{roadKingApp.p.sidebar.onShow({launch_from:'homepage',location:'sidebar_card'});});
   await tap('侧边栏再来玩');assert.equal(await page.evaluate(()=>roadKingApp.p.sidebar.state.fromSidebar),true);
   await tap('返回游戏');await tap('开始挑战  →');assert.equal(await page.evaluate(()=>roadKingApp.game.mode),'playing');
   await page.evaluate(()=>{roadKingApp.game.menu();roadKingApp.p.sidebar.state.supported=false;roadKingApp.draw();});
   assert.equal(await page.evaluate(()=>roadKingApp.buttons.some(b=>b.key==='侧边栏再来玩')),false);
   assert.deepEqual(errors,[]);results.push({width,height,passed:true});await page.close();
  }
  const report={passed:true,scope:'Browser UI with mocked Douyin APIs; native IDE upload and phone navigation not verified',results};
  fs.writeFileSync(path.join(root,'research/blender-preview/sidebar-ui.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{server.kill();server.stdout.destroy();server.stderr.destroy();server.unref();if(browser)await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
