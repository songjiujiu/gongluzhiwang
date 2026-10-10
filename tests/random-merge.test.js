require('../公路之王/src/difficulty-config').startTier=1;
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../公路之王/src/game-core');
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('paired traffic really merges in both directions from either position with varied timing',()=>{
 const reports=[];
 for(const elapsed of [10,40,70]){
  const g=new Core({random:seeded(137+elapsed)}).start();g.elapsed=elapsed;g._updateDifficulty();g.speed=g.difficulty.cruiseSpeed;
  const directions=new Set(),positions=new Set(),warnings=new Set(),starts=new Set();let completed=0,planned=0;
  for(let wave=0;wave<180;wave++){
   g.traffic=[];assert.equal(g._spawnTraffic(),true);
   const merging=g.traffic.find(c=>c.changePending);if(!merging)continue;
   planned++;const originalLane=merging.lane,originalIndex=g.traffic.indexOf(merging);
   g.lane=g.playerX=merging.safeLane;
   warnings.add(merging.mergeWarningSeconds.toFixed(3));
   assert.ok(merging.mergeWarningSeconds>=g.difficulty.mergeWarningMin&&merging.mergeWarningSeconds<=g.difficulty.mergeWarningMax);
   for(let step=0;step<300&&g.traffic.includes(merging)&&merging.z>0;step++){
    const pending=merging.changePending;g._updateTraffic(.01);
    for(let i=0;i<g.traffic.length;i++)for(let j=i+1;j<g.traffic.length;j++){
     const a=g.traffic[i],b=g.traffic[j];assert.ok(Math.abs(a.x-b.x)>=.76||Math.abs(a.z-b.z)>=5.5-1e-8);
    }
    assert.ok(Math.abs(merging.x-merging.safeLane)>=.9,'reserved lane remains clear');
    if(pending&&!merging.changePending){
     completed++;directions.add(Math.sign(merging.lane-originalLane));
     if(g.traffic.length===2)positions.add(originalIndex);
     starts.add(Math.round(merging.z));
    }
   }
  }
  assert.deepEqual([...directions].sort(),[-1,1]);assert.deepEqual([...positions].sort(),[0,1]);
  assert.ok(warnings.size>25);assert.ok(starts.size>5);assert.ok(completed>planned*.8,`${completed}/${planned} actual merges`);
  reports.push({tier:g.difficulty.tier,planned,completed,warningVariants:warnings.size,startDistances:starts.size});
 }
 console.log('Random merging traffic:',JSON.stringify(reports));
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
