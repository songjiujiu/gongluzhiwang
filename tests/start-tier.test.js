const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../公路之王/src/game-core');
const {nightAmount}=require('../公路之王/src/scene-renderer');
const config=()=>JSON.parse(JSON.stringify(require('../公路之王/src/difficulty-config')));
test('each starting tier begins at its own speed with zero time, distance and score',()=>{
 for(let tier=1;tier<=4;tier++){
  const c=config();c.startTier=tier;const g=new Core({difficultyConfig:c}).start();
  assert.equal(g.difficulty.tier,tier);assert.equal(g.difficulty.progress,0);
  assert.equal(g.speed,c.stages[tier-1].speedStart);
  for(const key of ['elapsed','distance','score'])assert.equal(g[key],0);
  assert.equal(nightAmount(g),tier===4?1:0);
  g._nextTraffic=Infinity;g.update(2);g.start();assert.equal(g.difficulty.tier,tier);assert.equal(g.elapsed,0);
 }
});
test('selected tier uses its full duration and relative spawn clock then transitions to night',()=>{
 const c=config();c.startTier=3;c.stages[2].durationSeconds=4;
 const g=new Core({difficultyConfig:c}).start();g._nextTraffic=Infinity;
 g.update(3.95);assert.equal(g.difficulty.tier,3);assert.equal(nightAmount(g),0);
 g._nextTraffic=20;g.update(.05);assert.equal(g.difficulty.tier,4);assert.ok(g._nextTraffic<=4.6+1e-6);
 g._nextTraffic=Infinity;g.update(1.25);assert.ok(Math.abs(nightAmount(g)-.5)<1e-6);
 g.update(1.25);assert.equal(nightAmount(g),1);
});
test('invalid initial tiers fail clearly and omitted setting defaults to one',()=>{
 for(const value of [0,5,-1,2.5,'4',null]){const c=config();c.startTier=value;assert.throws(()=>new Core({difficultyConfig:c}),/startTier/);}
 const c=config();delete c.startTier;assert.equal(new Core({difficultyConfig:c}).startTier,1);
});
