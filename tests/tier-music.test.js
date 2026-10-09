'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../公路之王/src/game-core');
const createMusic=require('../公路之王/src/music-player');
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
test('music switches once at tiers 3 and 4, pauses and resumes without restarting',()=>{
 const clips=[];const music=createMusic((file,volume)=>{const p={file,volume,plays:0,pauses:0,seeks:[],play(){this.plays++},pause(){this.pauses++},seek(t){this.seeks.push(t)}};clips.push(p);return p;});
 for(const tier of [1,2])music.set({active:true,tier});assert.equal(clips.length,0);
 for(let i=0;i<100;i++)music.set({active:true,tier:3});assert.equal(clips[0].plays,1);assert.ok(clips[0].file.includes('build'));
 music.set({active:false,tier:3});assert.equal(clips[0].pauses,1);
 music.set({active:true,tier:3});assert.equal(clips[0].plays,2);assert.deepEqual(clips[0].seeks,[]);
 music.set({active:true,tier:4});assert.equal(clips[0].pauses,2);assert.deepEqual(clips[0].seeks,[0]);assert.ok(clips[1].file.includes('climax'));
 music.set({active:false,tier:0});assert.equal(clips[1].pauses,1);assert.deepEqual(clips[1].seeks,[0]);
 music.set({active:true,tier:3});assert.equal(clips[0].plays,3);assert.equal(clips.length,2);
});
