const test=require('node:test');
const assert=require('node:assert/strict');
const App=require('../公路之王/src/game-app');
function fixture(){
 const p={width:540,height:960,top:0,bottom:0,canvas:{getContext:()=>({})},read:()=>null,write(){},now:()=>0,frame(){},loadImage:()=>Promise.resolve({}),touches(...handlers){this.handlers=handlers},lifecycle(...handlers){this.life=handlers},stopSound(){},sound(){},vibrate(){}};
 const a=new App(p);a.start();
 const event=(x,y,id=1)=>({changedTouches:[{clientX:x,clientY:y,identifier:id}]});
 const swipe=(dx,dy,y=540)=>{a.touchStart(event(270,y));a.touchMove(event(270+dx,y+dy));a.touchEnd(event(270+dx,y+dy));};
 return {a,p,event,swipe};
}
test('tap and small diagonal motion do not change lanes',()=>{const {a,swipe}=fixture();swipe(10,10);swipe(60,60);assert.equal(a.game.lane,0);assert.equal(a.game.pulseCooldown,0);});
test('long swipe changes one lane; subsequent swipe can queue next lane',()=>{const {a,event,swipe}=fixture();a.touchStart(event(270,540));a.touchMove(event(180,540));a.touchMove(event(60,540));assert.equal(a.game.lane,-1);a.touchEnd(event(60,540));swipe(100,0);swipe(100,0);a.update(.5);assert.equal(a.game.lane,1);});
test('down swipe does not change speed or lane',()=>{const {a,swipe}=fixture();const speed=a.game.speed;swipe(0,60,850);assert.equal(a.game.speed,speed);assert.equal(a.game.lane,0);assert.equal(a.game.pulseCooldown,0);assert.equal(a.game.setBrake,undefined);});
test('up swipe does not release pulse; skill touch activates it once',()=>{const {a,event,swipe}=fixture();swipe(0,-80);assert.equal(a.game.pulseCooldown,0);a.draw=()=>{};a.buttons=[{x:428,y:619,w:90,h:90,circle:true,key:'气浪技能',action:()=>a.game.pulse()}];assert.equal(a.inside({x:429,y:620},a.buttons[0]),false);assert.equal(a.inside({x:473,y:664},a.buttons[0]),true);a.touchStart(event(473,664));a.touchEnd(event(473,664));assert.equal(a.game.pulseCooldown,10);a.update(.1);a.touchStart(event(473,664));assert.ok(a.game.pulseCooldown<10);});
test('secondary fingers do not issue gestures and cancel clears gestures',()=>{const {a,p,event}=fixture();a.touchStart(event(270,540,1));a.touchStart(event(270,540,2));a.touchMove(event(370,540,2));assert.equal(a.game.lane,0);a.touchMove(event(270,640,1));p.handlers[3]();assert.deepEqual(a.touchMap,{});});
test('background clears queued lane before pausing',()=>{const {a,p,swipe}=fixture();swipe(0,80);p.life[0]();assert.equal(a.game.mode,'paused');assert.equal(a.queuedLane,null);a.update(2);assert.equal(a.game.elapsed,0);});
