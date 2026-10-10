const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../公路之王/src/game-core');
const {atmosphere}=require('../公路之王/src/scene-renderer');
const config=()=>JSON.parse(JSON.stringify(require('../公路之王/src/difficulty-config')));
test('nine stages advance at configured boundaries and the ninth remains endless',()=>{
 const c=config();c.startTier=1;const g=new Core({difficultyConfig:c}).start();
 let elapsed=0;
 for(let i=0;i<9;i++){
  g.elapsed=elapsed;g._updateDifficulty();assert.equal(g.difficulty.tier,i+1);
  g.elapsed=elapsed+c.stages[i].durationSeconds-.001;g._updateDifficulty();assert.equal(g.difficulty.tier,i+1);
  elapsed+=c.stages[i].durationSeconds;
 }
 g.elapsed=100000;g._updateDifficulty();assert.equal(g.difficulty.tier,9);assert.equal(g.difficulty.cruiseSpeed,c.stages[8].speedEnd);
});
test('night persists through tier five then fades to dawn using configured duration',()=>{
 const c=config();c.startTier=5;c.stages[4].durationSeconds=5;
 const g=new Core({difficultyConfig:c}).start();g._nextTraffic=Infinity;
 assert.equal(atmosphere(g).night,1);g.update(5);assert.equal(g.difficulty.tier,6);assert.equal(atmosphere(g).night,1);
 g.update(1.25);assert.deepEqual(atmosphere(g),{night:.5,dawn:.5,fog:c.stages[5].fogDensity*.5});
 g.pause();g.update(20);assert.equal(atmosphere(g).dawn,.5);g.resume();g.update(1.25);
 assert.deepEqual(atmosphere(g),{night:0,dawn:1,fog:c.stages[5].fogDensity});
 g.start();assert.deepEqual(atmosphere(g),{night:1,dawn:0,fog:0});
});
test('dawn density blends between stages and scene can be configured independently',()=>{
 const c=config();c.startTier=6;const g=new Core({difficultyConfig:c}).start();g._nextTraffic=Infinity;
 g.update(61.25);assert.equal(atmosphere(g).dawn,1);assert.ok(Math.abs(atmosphere(g).fog-.016)<1e-8);
 c.stages[5].scene='sunset';assert.deepEqual(atmosphere(new Core({difficultyConfig:c}).start()),{night:0,dawn:0,fog:0});
 for(const [field,value]of[['scene','unknown'],['fogDensity',-.1],['fogDensity',.1]]){const bad=config();bad.stages[5][field]=value;assert.throws(()=>new Core({difficultyConfig:bad}),new RegExp(field));}
});
test('all new high-speed tiers spawn visible vehicles and barriers with a safe lane',()=>{
 for(let tier=5;tier<=9;tier++){
  const c=config();c.startTier=tier;let seed=tier;const g=new Core({difficultyConfig:c,random:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}}).start();
  let cars=0,barriers=0;
  for(let wave=0;wave<80;wave++){
   g.traffic=[];g._spawnTraffic();assert.ok(g.traffic.length>0);
   assert.ok(new Set(g.traffic.map(car=>car.lane)).size<3);
   for(const car of g.traffic){assert.ok(car.z>=0&&car.z<=145);car.kind==='barrier'?barriers++:cars++;}
  }
  assert.ok(cars>0&&barriers>0);
 }
});
