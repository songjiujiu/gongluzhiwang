require('../公路之王/src/difficulty-config').startTier=1;
'use strict';
// Exercise shipped tuning directly; do not load the legacy regression fixture.
const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../公路之王/src/game-core');
const config=require('../公路之王/src/difficulty-config');
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function steer(g){
 const visible=g.traffic.filter(c=>!c.hit&&!c.escaped&&c.z>=-5&&c.z<=145);
 if(!visible.length)return;
 const nearest=visible.reduce((a,b)=>a.z<b.z?a:b),wave=visible.filter(c=>c.waveId===nearest.waveId);
 const blocked=new Set(wave.map(c=>c.lane));for(const c of wave)if(c.signalDirection)blocked.add(c.targetLane);
 const choices=[-1,0,1].filter(lane=>!blocked.has(lane)).sort((a,b)=>Math.abs(a-g.lane)-Math.abs(b-g.lane));
 if(choices.length&&choices[0]!==g.lane)g.changeLane(Math.sign(choices[0]-g.lane));
}
test('shipped tutorial has no merge or barrier; tier two makes a sharp difficulty jump',()=>{
 const [easy,hard,...later]=config.stages;
 assert.equal(easy.durationSeconds,10);assert.ok(easy.speedEnd<=100);
 assert.equal(easy.mergeChance+easy.doubleChance+easy.barrierChance,0);
 assert.ok(hard.speedStart>=easy.speedEnd*2.5);assert.ok(hard.spawnStart<easy.spawnEnd/3);
 assert.ok(hard.doubleChance>=.7&&hard.barrierChance>0&&hard.mergeChance>=.9);
 let previous=hard;for(const stage of later){
  assert.ok(stage.speedStart>previous.speedEnd);assert.ok(stage.spawnStart<previous.spawnEnd);
  assert.ok(stage.doubleChance>previous.doubleChance);assert.ok(stage.barrierChance>previous.barrierChance);previous=stage;
 }
});
test('tier transition shortens the old spawn wait without resetting collision recovery',()=>{
 const g=new Core().start();g.elapsed=9.95;g._nextTraffic=13;g.collisionStopped=true;
 g.traffic.push(g._car(0,4.7));g.update(.05);
 assert.equal(g.difficulty.tier,2);assert.ok(g._nextTraffic<=10.6+1e-6);
 assert.equal(g.collisionStopped,true);assert.equal(g.speed,0);
});
test('new curve spawns much denser tier-two traffic and keeps navigable waves across seeds',()=>{
 const reports=[];
 for(const seed of [1,23,137,90210,3735928559,12648430]){
  const rows=Array.from({length:4},()=>({waves:0,obstacles:0,barriers:0}));
  let previousSafe=0;
  const g=new Core({random:seeded(seed),onEvent(type,data){if(type!=='wave')return;
   const row=rows[g.difficulty.tier-1];row.waves++;row.obstacles+=data.obstacles;if(data.barrier)row.barriers++;
   assert.ok(Math.abs(data.safeLane-previousSafe)<=1);previousSafe=data.safeLane;
   assert.ok(g.traffic.filter(c=>data.carIds.includes(c.id)).every(c=>c.lane!==data.safeLane));
  }}).start();
  for(let frame=0;frame<2400&&g.mode==='playing';frame++){if(frame%3===0)steer(g);g.update(.05);}
  assert.equal(g.mode,'playing');assert.equal(g.collisions,0,`visible-lane driver seed ${seed}`);
  assert.ok(rows[0].waves<=3);assert.equal(rows[0].barriers,0);
  assert.ok(rows[1].obstacles/30>rows[0].obstacles/10*3,`tier two density seed ${seed}`);
  assert.ok(rows[1].barriers>0);assert.ok(rows[2].waves>15);assert.ok(rows[3].waves>25);
  reports.push({seed,rows});
 }
 console.log('Shipped difficulty 120-second runs:',JSON.stringify(reports));
});
