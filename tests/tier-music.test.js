'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../公路之王/src/game-core');

test('four tiers gate merges and roadblocks while increasing speed and density',()=>{
 const rows=[];
 for(const elapsed of [0,30,60,90]){
  const game=new Core({random:()=>.1}).start();game.elapsed=elapsed;game._updateDifficulty();
  let merges=0,barriers=0,count=0;
  for(let i=0;i<50;i++){game.traffic=[];game._spawnTraffic();merges+=game.traffic.filter(c=>c.changePending).length;barriers+=game.traffic.filter(c=>c.kind==='barrier').length;count+=game.traffic.length;}
  rows.push({...game.difficulty,merges,barriers,count});
 }
 assert.deepEqual(rows.map(r=>r.tier),[1,2,3,4]);
 assert.equal(rows[0].merges,0);assert.equal(rows[0].barriers,0);assert.equal(rows[0].count,50);
 assert.ok(rows[1].merges>0);assert.equal(rows[1].barriers,0);
 assert.ok(rows[2].barriers>0);assert.ok(rows[2].count>rows[0].count);
 for(let i=1;i<4;i++){assert.ok(rows[i].cruiseSpeed>rows[i-1].cruiseSpeed);assert.ok(rows[i].spawnInterval<rows[i-1].spawnInterval);}
});
