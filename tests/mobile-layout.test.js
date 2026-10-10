const test=require('node:test'),assert=require('node:assert/strict');
const App=require('../公路之王/src/game-app');
const Scene=require('../公路之王/src/scene-renderer');
test('tall phone uses safe-area top and bottom with working bottom-area gestures',()=>{
 const p={width:393,height:852,ratio:2,top:100,bottom:34,canvas:{getContext:()=>({})},read:()=>null,write(){},now:()=>0,frame(){},loadImage:()=>Promise.resolve({}),touches(){},lifecycle(){},stopSound(){},sound(){},vibrate(){}};
 const a=new App(p);a.start();a.game._nextTraffic=Infinity;
 assert.equal(a.oy,100);assert.ok(Math.abs(a.oy+a.viewHeight*a.scale-818)<1e-6);
 const event=(x,y)=>({changedTouches:[{identifier:1,clientX:a.ox+x*a.scale,clientY:a.oy+y*a.scale}]});
 const y=a.viewHeight-20;
 a.touchStart(event(270,y));a.touchMove(event(180,y));a.touchEnd(event(180,y));assert.equal(a.game.lane,-1);
 a.touchStart(event(270,y));a.update(.35);assert.equal(a.game.throttle,true);a.touchEnd(event(270,y));assert.equal(a.game.throttle,false);
});
test('render buffer follows phone pixels and retains a mobile pixel budget',()=>{
 for(const [width,height,ratio]of[[393,852,3],[430,932,3],[768,1024,2]]){
  const s=new Scene({width,height,ratio});s.canvas={};s.setView(540,height/width*540,50);
  assert.ok(s.canvas.width>540);assert.ok(s.canvas.width<=1080);assert.ok(s.canvas.width*s.canvas.height<2002000);
  assert.ok(Math.abs(s.canvas.width/s.canvas.height-width/height)<.002);
 }
});
