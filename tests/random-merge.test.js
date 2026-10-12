require('../公路之王/src/difficulty-config').startTier=1;
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../公路之王/src/game-core');
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('paired traffic really merges in both directions from either position with varied timing',()=>{
 const reports=[];
 for(const elapsed of [10,40,70]){
  const g=new Core({random:seeded(137+elapsed)}).start();g.elapsed=elapsed;g._updateDifficulty();g.speed=g.difficulty.cruiseSpeed;
  const directions=new Set(),routes=new Set(),positions=new Set(),warnings=new Set(),starts=new Set();let completed=0,planned=0;
  for(let wave=0;wave<180;wave++){
   g.traffic=[];assert.equal(g._spawnTraffic(),true);
   const merging=g.traffic.find(c=>c.changePending);if(!merging)continue;
   planned++;const originalLane=merging.lane,originalIndex=g.traffic.indexOf(merging);
   g.lane=g.playerX=merging.safeLane;
   warnings.add(merging.mergeWarningSeconds.toFixed(3));
   assert.ok(merging.mergeWarningSeconds>=g.difficulty.mergeWarningMin&&merging.mergeWarningSeconds<=g.difficulty.mergeWarningMax);
   for(let step=0;step<300&&g.traffic.includes(merging)&&merging.z>0;step++){
    const previousX=merging.x;g._updateTraffic(.01);
    assert.ok(Math.abs(merging.x-previousX)<=.040001,'lane changes remain continuous');
    for(let i=0;i<g.traffic.length;i++)for(let j=i+1;j<g.traffic.length;j++){
     const a=g.traffic[i],b=g.traffic[j];assert.ok(Math.abs(a.x-b.x)>=.76||Math.abs(a.z-b.z)>=5.5-1e-8);
    }
    assert.notEqual(merging.lane,merging.safeLane,'starting and final lanes leave an exit');
    if(Math.abs(merging.x-merging.safeLane)<.9)assert.ok(merging.z>3.5,'middle crossing completes ahead of the player');
    if(previousX!==merging.targetLane&&merging.x===merging.targetLane){
     completed++;directions.add(Math.sign(merging.lane-originalLane));
     routes.add(originalLane+'>'+merging.targetLane);
     if(g.traffic.length===2)positions.add(originalIndex);
     starts.add(Math.round(merging.z));
    }
   }
  }
  assert.deepEqual([...directions].sort(),[-1,1]);assert.deepEqual([...positions].sort(),[0,1]);
  assert.deepEqual([...routes].sort(),['-1>0','-1>1','0>-1','0>1','1>-1','1>0']);
  assert.ok(warnings.size>25);assert.ok(starts.size>5);assert.ok(completed>planned*.8,`${completed}/${planned} actual merges`);
  reports.push({tier:g.difficulty.tier,planned,completed,warningVariants:warnings.size,startDistances:starts.size});
 }
 console.log('Random merging traffic:',JSON.stringify(reports));
});
test('both cross-road directions wait for cars or roadblocks in the middle, then traverse continuously',()=>{
 for(const from of [-1,1])for(const kind of ['car','barrier']){
  const g=new Core().start();g.speed=22;g.lane=g.playerX=0;g._nextTraffic=Infinity;
  const moving=g._car(from,50,true),blocker=g._car(0,50);
  Object.assign(moving,{changePending:true,targetLane:-from,signalDirection:-from,warningTimer:.01,speed:22,baseSpeed:22});
  Object.assign(blocker,{kind,speed:22,baseSpeed:22});g.traffic=[moving,blocker];
  for(let i=0;i<30;i++)g._updateTraffic(.01);
  assert.equal(moving.x,from);assert.equal(moving.changePending,true);
  blocker.z=moving.z+30;let throughMiddle=false;
  for(let i=0;i<80;i++){const x=moving.x;g._updateTraffic(.01);assert.ok(Math.abs(moving.x-x)<=.040001);if(Math.abs(moving.x)<.02)throughMiddle=true;}
  assert.ok(throughMiddle);assert.equal(moving.x,-from);assert.equal(moving.changePending,false);assert.equal(g.collisions,0);
 }
});
test('a cross-road car held past its crossing window cancels instead of cutting across the player',()=>{
 for(const from of [-1,1]){
  const g=new Core().start();g.speed=240;g.lane=g.playerX=0;
  const moving=g._car(from,34,true),blocker=g._car(0,34);
  Object.assign(moving,{changePending:true,targetLane:-from,signalDirection:-from,warningTimer:.01});g.traffic=[moving,blocker];
  for(let i=0;i<20;i++)g._updateTraffic(.01);
  assert.equal(moving.x,from);assert.equal(moving.changePending,false);assert.equal(moving.signalDirection,0);
  blocker.z+=40;g._updateTraffic(.1);assert.equal(moving.x,from);assert.equal(g.collisions,0);
 }
});
test('zero merge chance disables adjacent and cross-road plans alike',()=>{
 const g=new Core({random:seeded(76)}).start();g.difficulty.mergeChance=0;g.difficulty.barrierChance=0;
 for(let i=0;i<100;i++){g.traffic=[];assert.equal(g._spawnTraffic(),true);assert.ok(g.traffic.every(c=>!c.changePending&&!c.threat));}
});
test('short reaction configuration actually spawns close instead of using the old 55m floor',()=>{
 for(const elapsed of [10,40,70]){
  const g=new Core({random:seeded(9)}).start();g.elapsed=elapsed;g._updateDifficulty();g.speed=g.difficulty.cruiseSpeed;
  const speed=g.speed<=240?g.speed:240+36*Math.log1p((g.speed-240)/36);
  g._spawnTraffic();const nearest=g.traffic.reduce((a,b)=>a.z<b.z?a:b);
  const seconds=nearest.z/((speed-nearest.speed)/3.6*.75);
  assert.ok(nearest.z<55);assert.ok(seconds<=g.difficulty.reactionTime+1e-6);
  assert.ok(seconds>=g.difficulty.reactionTime*.8-1e-6);
 }
});
test('invalid merge warning ranges reject configuration before play',()=>{
 const defaults=require('../公路之王/src/difficulty-config');
 for(const range of [{mergeWarningMin:0},{mergeWarningMax:.1},{mergeWarningMax:Infinity}]){
  const config=JSON.parse(JSON.stringify(defaults));Object.assign(config.stages[1],range);
  assert.throws(()=>new Core({difficultyConfig:config}),/强度 2.*mergeWarning/);
 }
});
