require('../公路之王/src/difficulty-config').startTier=1;
const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../公路之王/src/game-core');
const {nightAmount}=require('../公路之王/src/scene-renderer');
test('night fades in only at tier four and survives pause without restarting its transition',()=>{
 const game=new Core().start();game._nextTraffic=Infinity;
 game.update(69.9);assert.equal(nightAmount(game),0);
 game.update(1.35);assert.ok(Math.abs(nightAmount(game)-.5)<1e-6);
 game.pause();game.update(10);assert.ok(Math.abs(nightAmount(game)-.5)<1e-6);
 game.resume();game.update(1.25);assert.equal(nightAmount(game),1);
 game._finish(false,'test');assert.equal(nightAmount(game),1);
 game.menu();assert.equal(nightAmount(game),0);game.start();assert.equal(nightAmount(game),0);
});
test('night threshold follows edited stage durations rather than a hard-coded clock',()=>{
 const config=JSON.parse(JSON.stringify(require('../公路之王/src/difficulty-config')));
 [2,3,4].forEach((duration,i)=>config.stages[i].durationSeconds=duration);
 const game=new Core({difficultyConfig:config}).start();game._nextTraffic=Infinity;
 game.update(8.9);assert.equal(nightAmount(game),0);
 game.update(1.35);assert.ok(Math.abs(nightAmount(game)-.5)<1e-6);
 game.update(1.25);assert.equal(nightAmount(game),1);
});
