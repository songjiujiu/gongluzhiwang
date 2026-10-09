const test=require('node:test'),assert=require('node:assert/strict');
require('./fixtures/default-difficulty');
const Core=require('../公路之王/src/game-core'),defaults=require('../公路之王/src/difficulty-config');
const config=()=>JSON.parse(JSON.stringify(defaults));
test('custom durations advance at cumulative boundaries and final stage remains endless',()=>{
 const c=config();c.stages[0].durationSeconds=10;c.stages[1].durationSeconds=20;c.stages[2].durationSeconds=40;c.stages[3].durationSeconds=5;
 const g=new Core({difficultyConfig:c}).start();g._nextTraffic=Infinity;
 g.update(9.9);assert.equal(g.difficulty.tier,1);g.update(.1);assert.equal(g.difficulty.tier,2);
 g.update(20);assert.equal(g.difficulty.tier,3);g.update(40);assert.equal(g.difficulty.tier,4);
 g.update(5);assert.ok(Math.abs(g.difficulty.cruiseSpeed-(218+10*(1-Math.exp(-1))))<1e-7);
 g.update(100);assert.equal(g.mode,'playing');assert.equal(g.difficulty.tier,4);
});
test('custom speed, spawn density, probability and population limits drive actual waves',()=>{
 const c=config(),s=c.stages[0];Object.assign(s,{speedStart:50,speedEnd:60,spawnStart:8,spawnEnd:6,mergeChance:1,doubleChance:1,barrierChance:0,maxActiveObstacles:2,reactionSeconds:7});
 const g=new Core({difficultyConfig:c,random:()=>.1}).start();assert.equal(g.speed,50);
 g.elapsed=15;g._updateDifficulty();assert.equal(g.difficulty.cruiseSpeed,55);assert.equal(g.difficulty.spawnInterval,7);assert.equal(g.difficulty.reactionTime,7);
 g._spawnTraffic();assert.equal(g.traffic.length,2);assert.ok(g.traffic.some(car=>car.changePending));assert.equal(g._spawnTraffic(),false);
 c.stages[0].speedStart=200;g.start();assert.equal(g.speed,50,'configuration is snapshotted for a run');
});
test('invalid stage settings fail with the field and stage instead of breaking gameplay',()=>{
 for(const [field,value] of [['durationSeconds',0],['mergeChance',1.1],['speedEnd',NaN],['spawnStart',-1],['maxActiveObstacles',1]]){
  const c=config();c.stages[1][field]=value;assert.throws(()=>new Core({difficultyConfig:c}),new RegExp('强度 2.*'+field));
 }
});
test('configured speeds and throttle are not clamped at 240 km/h',()=>{
 const c=config();Object.assign(c.stages[0],{speedStart:400,speedEnd:400});
 const g=new Core({difficultyConfig:c}).start();g._nextTraffic=Infinity;assert.equal(g.speed,400);
 g.setThrottle(true);g.update(1);assert.equal(g.speed,422);
 assert.ok(g._safeGap()>46&&g._safeGap()<64.2);g.setThrottle(false);g.update(1);assert.equal(g.speed,400);
});
test('extreme configured speeds still spawn visible hazards and register collisions',()=>{
 for(const speed of [1000,1500,20000,40000]){
  const c=config();Object.assign(c.stages[0],{speedStart:speed,speedEnd:speed,reactionSeconds:4,doubleChance:1});
  const g=new Core({difficultyConfig:c,random:()=>.1}).start();
  assert.equal(g._spawnTraffic(),true);assert.equal(g.traffic.length,2);
  assert.ok(g.traffic.every(car=>car.z>=55&&car.z<=145));
  g.lane=g.playerX=g.traffic[0].lane;g._nextTraffic=Infinity;
  g.update(6);assert.equal(g.collisions,1);assert.equal(g.collisionStopped,true);assert.equal(g.speed,0);
 }
});
