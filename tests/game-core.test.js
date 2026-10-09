'use strict';
require('./fixtures/default-difficulty');
const test = require('node:test');
const assert = require('node:assert/strict');
const RoadKingCore = require('../公路之王/src/game-core.js');

function seeded(seed = 137) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function fresh(seed = 137, onEvent) { return new RoadKingCore({ random: seeded(seed), onEvent }).start(); }
// Unit tests isolate spawning; the integration runs below use only public inputs.
function noSpawns(game) { game._nextTraffic = Infinity; }
function car(game, lane = 0, z = 0) {
  const value = game._car(lane, z);
  game.traffic.push(value);
  return value;
}
function close(actual, expected, epsilon = 1e-7) {
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} should be close to ${expected}`);
}

// A modest driver: decisions every 150 ms, only three seconds of visible road,
// and no use of safeLane, random state, future spawns or private mutation.
// It reacts to occupied lanes and the turn signal shown by orange traffic.
function steerAroundVisibleTraffic(game) {
  const visible = game.traffic.filter(item => {
    const closing = Math.max(1, (game.speed - item.speed) / 3.6 * 0.75);
    return !item.hit && !item.escaped && item.z >= -5 && item.z <= closing * 3 + 8;
  });
  if (!visible.length) return;
  const nearest = visible.reduce((a, b) => a.z < b.z ? a : b);
  const wave = visible.filter(item => item.waveId === nearest.waveId);
  const occupied = new Set(wave.map(item => item.lane));
  for (const item of wave) if (item.signalDirection) occupied.add(item.targetLane);
  const choices = [-1, 0, 1].filter(lane => !occupied.has(lane));
  choices.sort((a, b) => Math.abs(a - game.lane) - Math.abs(b - game.lane));
  if (choices.length && choices[0] !== game.lane) game.changeLane(Math.sign(choices[0] - game.lane));
}

test('every start enters the same endless road and lane boundaries remain responsive', () => {
  const game = new RoadKingCore({ random: seeded() });
  assert.equal(game.mode, 'menu');
  for (const oldLevel of [-1, 0, 1, 2, 99]) {
    game.start(oldLevel);
    assert.equal(game.level, 0);
    assert.equal(game.duration, Infinity);
    assert.equal(game.requiredEvents, 0);
    assert.equal(game.encounter, null);
  }
  noSpawns(game);
  assert.equal(game.lane, 0);
  assert.equal(game.changeLane(-1), true);
  game.update(0.5);
  assert.equal(game.changeLane(-1), false);
  assert.equal(game.playerX, -1);
  game.changeLane(1); game.update(0.5); game.changeLane(1); game.update(0.5);
  assert.equal(game.lane, 1);
  assert.equal(game.changeLane(1), false);
});

test('75 seconds and six minutes do not finish a healthy run or create old encounters', () => {
  const events = [];
  const game = fresh(137, (type, data) => events.push({ type, data }));
  noSpawns(game);
  game.update(76);
  assert.equal(game.mode, 'playing');
  close(game.elapsed, 76);
  game.update(284);
  close(game.elapsed, 360);
  assert.equal(game.mode, 'playing');
  assert.equal(game.health, 100);
  assert.equal(game.encounter, null);
  assert.equal(game.eventCount, 0);
  assert.equal(events.filter(event => event.type === 'result').length, 0);
  assert.equal(events.filter(event => event.type === 'event-start').length, 0);
  assert.ok(game.distance > 10000);
  assert.ok(game.score > 0);
});

test('difficulty raises cruising speed and obstacle density, with bounded reaction time', () => {
  const game = fresh(); noSpawns(game);
  const samples = [{ ...game.difficulty }];
  for (let i = 0; i < 6; i++) {
    game.update(30);
    samples.push({ ...game.difficulty });
  }
  for (let i = 1; i < samples.length; i++) {
    assert.ok(samples[i].cruiseSpeed > samples[i - 1].cruiseSpeed, `cruise at ${i * 30}s`);
    assert.ok(samples[i].spawnInterval < samples[i - 1].spawnInterval, `spawn at ${i * 30}s`);
    assert.ok(samples[i].reactionTime <= samples[i - 1].reactionTime);
    assert.ok(samples[i].tier >= samples[i - 1].tier);
    assert.ok(samples[i].label.length > 0);
  }
  assert.ok(samples[0].cruiseSpeed >= 70 && samples[0].cruiseSpeed <= 85);
  assert.ok(game.speed > 180);
  assert.ok(samples.at(-1).reactionTime >= 2.5);
  game.update(3600);
  assert.ok(game.speed <= 230);
  assert.ok(game.difficulty.spawnInterval >= 1);
  assert.ok(game.difficulty.reactionTime >= 2.5);
  assert.ok(game.difficulty.tier <= 6);
  assert.ok(game.maxSpeed >= game.speed - 0.01);
});

test('collision removes 26 health and grants 2.1 seconds of protection', () => {
  const game = fresh(); noSpawns(game);
  game.score = 200;
  car(game);
  game._updateTraffic(0.001);
  assert.equal(game.health, 74);
  assert.equal(game.score, 80);
  assert.equal(game.invulnerability, 2.1);
  assert.equal(game.collisions, 1);
  const second = car(game);
  game._updateTraffic(0.001);
  assert.equal(game.health, 74);
  assert.equal(game.collisions, 1);
  assert.equal(second.hit, false);
  game.update(5);
  assert.equal(game.speed, 0);
  assert.equal(game.health, 74);
  assert.equal(game.collisionStopped, true);
  const distance = game.distance;
  game.changeLane(1);
  game.update(.2);
  assert.equal(game.collisionStopped, false);
  assert.equal(game.speed, 0);
  assert.equal(game.distance, distance);
  game.update(1);
  assert.ok(game.speed > 0 && game.speed <= 24.01);
});

test('a run settles once on the fourth hit and retry resets all challenge resources', () => {
  const events = [];
  const game = fresh(137, (type, data) => events.push({ type, data }));
  noSpawns(game);
  game.update(80); game.pulse(); game.setSignal(1); game.update(0.5);
  for (let i = 0; i < 4; i++) { game.traffic = []; game.collisionStopped = false; game.invulnerability = 0; car(game); game._updateTraffic(0.001); }
  game.update(0.01);
  assert.equal(game.mode, 'result');
  assert.equal(game.health, 0);
  assert.equal(game.won, false);
  const result = JSON.stringify(game);
  game.update(100); game._finish(true, 'repeated');
  assert.equal(JSON.stringify(game), result);
  assert.equal(events.filter(event => event.type === 'result').length, 1);
  game.start(2);
  for (const name of ['score', 'elapsed', 'distance', 'collisions', 'dodged', 'waveCount', 'clearedEvents', 'eventCount', 'pulseCooldown', 'signalRewardCooldown'])
    assert.equal(game[name], 0, name);
  assert.equal(game.level, 0);
  assert.equal(game.health, 100);
  assert.equal(game.braking, undefined);
  assert.equal(game.lane, 0);
  assert.equal(game.playerX, 0);
  assert.equal(game.mode, 'playing');
  assert.equal(game.encounter, null);
  assert.equal(game.traffic.length, 0);
  assert.ok(game.difficulty.cruiseSpeed < 85);
});

test('pause freezes clocks and cars; resume and menu obey mode guards', () => {
  const game = fresh(); noSpawns(game);
  car(game, 1, 15);
  game.setSignal(-1); game.pulse(); game.update(0.5);
  game.setThrottle(true); game.pause();
  const before = JSON.stringify(game);
  game.update(25);
  assert.equal(JSON.stringify(game), before);
  assert.equal(game.changeLane(-1), false);
  assert.equal(game.pulse(), false);
  assert.equal(game.setSignal(1), false);
  assert.equal(game.throttle, false);
  assert.equal(game.resume(), true);
  game.update(0.1);
  assert.ok(game.elapsed > 0.5);
  game.menu();
  assert.equal(game.mode, 'menu');
  assert.equal(game.resume(), false);
});

test('signal reward still requires a full second, correct direction and a clear lane', () => {
  for (const scenario of ['early', 'wrong', 'blocked', 'good']) {
    const game = fresh(); noSpawns(game);
    game.setSignal(scenario === 'wrong' ? -1 : 1);
    game.update(scenario === 'early' ? 0.99 : 1);
    if (scenario === 'blocked') car(game, 1, 8);
    const before = game.score;
    game.changeLane(1);
    assert.equal(game.score - before, scenario === 'good' ? 30 : 0, scenario);
    if (scenario === 'good') {
      assert.equal(game.signalRewardCooldown, 5);
      game.setSignal(-1); game.update(1);
      const secondScore = game.score;
      game.changeLane(-1);
      assert.equal(game.score, secondScore, 'cooldown prevents another signal bonus');
    }
  }
});

test('pulse has a ten-second cooldown and affects only cars in its visible range', () => {
  const game = fresh(); noSpawns(game);
  const near = car(game, 1, 20);
  const far = car(game, -1, 50);
  assert.equal(game.pulse(), true);
  assert.equal(game.pulseCooldown, 10);
  assert.equal(near.escaped, true);
  assert.equal(near.z, 32);
  assert.equal(far.escaped, false);
  assert.equal(game.pulse(), false);
  assert.equal(game.pulsesUsed, 1);
  game.update(9.99);
  assert.equal(game.pulse(), false);
  game.update(0.02);
  assert.equal(game.pulse(), true);
  assert.equal(game.pulsesUsed, 2);
});

test('brake API and energy reserve are removed', () => {
  const game = fresh();
  assert.equal(game.setBrake, undefined);
  assert.equal(game.brakeEnergy, undefined);
});

test('the same seed reproduces traffic across normal frame chunk sizes', () => {
  const a = fresh(), b = fresh();
  for (let i = 0; i < 100; i++) a.update(0.05);
  for (let i = 0; i < 20; i++) b.update(0.25);
  assert.equal(a.waveCount, b.waveCount);
  assert.equal(a.traffic.length, b.traffic.length);
  for (let i = 0; i < a.traffic.length; i++) {
    assert.equal(a.traffic[i].lane, b.traffic[i].lane);
    close(a.traffic[i].z, b.traffic[i].z);
  }
  close(a.score, b.score);
  close(a.distance, b.distance);
});

test('visible lane choices support six-minute runs across seeds as real traffic grows', () => {
  const summaries = [];
  for (const seed of [1, 23, 137, 90210, 0xdeadbeef, 0xc0ffee]) {
    const waves = [];
    const warnings = [];
    let previousSafeLane = 0;
    const game = fresh(seed, (type, data) => {
      if (type === 'wave') {
        assert.ok(Math.abs(data.safeLane - previousSafeLane) <= 1, `seed ${seed}: reachable next exit`);
        previousSafeLane = data.safeLane;
        const obstacles = game.traffic.filter(item => data.carIds.includes(item.id));
        assert.equal(obstacles.length, data.obstacles);
        assert.ok(obstacles.length >= 1 && obstacles.length <= 2);
        const occupied = new Set();
        for (const item of obstacles) {
          occupied.add(item.lane);
          if (item.changePending) occupied.add(item.targetLane);
          assert.ok(item.z >= 35 && item.z <= 155, `seed ${seed}: obstacles appear ahead within the visible road`);
          assert.notEqual(item.lane, data.safeLane);
          if (item.changePending) assert.notEqual(item.targetLane, data.safeLane);
        }
        assert.ok(occupied.size < 3, `seed ${seed}: a full wave must leave an exit`);
        waves.push({ elapsed: game.elapsed, ...data });
      }
      if (type === 'threat-warning') {
        const threat = game.traffic.find(item => item.id === data.carId);
        assert.ok(threat.warningTimer >= 1, 'lane changes give a visible warning');
        warnings.push(data.carId);
      }
    });
    for (let frame = 0; frame < 7200 && game.mode === 'playing'; frame++) {
      if (frame % 3 === 0) steerAroundVisibleTraffic(game);
      game.update(0.05);
      for (let i = 0; i < game.traffic.length; i++) {
        for (let j = i + 1; j < game.traffic.length; j++) {
          const a = game.traffic[i], b = game.traffic[j];
          assert.ok(Math.abs(a.x - b.x) >= .76 || Math.abs(a.z - b.z) >= 5.5 - 1e-8,
            `seed ${seed}: traffic ${a.id}/${b.id} overlap during a merge`);
        }
      }
      for (const item of game.traffic) {
        assert.ok(Number.isFinite(item.z) && Number.isFinite(item.x), 'traffic coordinates remain finite');
        if (!item.hit && !item.escaped) assert.ok(Math.abs(item.x - item.safeLane) >= 0.9, 'moving traffic does not cross its reserved exit');
      }
    }
    assert.equal(game.mode, 'playing', `seed ${seed}: ended at ${game.elapsed}s with ${game.collisions} hits`);
    close(game.elapsed, 360);
    assert.equal(game.health, 100, `seed ${seed}: readable traffic should be avoidable`);
    assert.equal(game.collisions, 0);
    assert.equal(game.pulsesUsed, 0, 'basic survival does not require an emergency ability');
    assert.ok(game.dodged > 100);
    const early = waves.filter(wave => wave.elapsed < 30);
    const late = waves.filter(wave => wave.elapsed >= 300 && wave.elapsed < 330);
    assert.ok(late.length > early.length * 1.5, `seed ${seed}: actual late waves are more frequent`);
    assert.ok(late.reduce((count, wave) => count + wave.obstacles, 0) > early.reduce((count, wave) => count + wave.obstacles, 0) * 2);
    assert.ok(waves.some(wave => wave.barrier));
    assert.ok(warnings.length > 0);
    summaries.push({ seed, waves: waves.length, dodged: game.dodged, early: early.length, late: late.length });
  }
  console.log('Six-minute public-input runs:', JSON.stringify(summaries));
});

test('an unattended car stays stopped after its first crash without farming distance score', () => {
  for (const seed of [1, 23, 137, 90210, 0xdeadbeef]) {
    const events = [];
    const game = fresh(seed, type => events.push(type));
    game.update(360);
    assert.equal(game.mode, 'playing');
    assert.equal(game.health, 74);
    assert.equal(game.collisions, 1);
    assert.equal(game.collisionStopped, true);
    assert.equal(game.speed, 0);
    assert.equal(events.filter(type => type === 'result').length, 0);
    const score = game.score;
    game.update(1000);
    assert.equal(game.score, score);
  }
});

test('rear cars queue without crossing the stopped player and drive on after it changes lanes', () => {
  const game = fresh(); noSpawns(game);
  car(game);
  game.update(.01);
  const rear = car(game, 0, -12), following = car(game, 0, -20);
  const otherLane = car(game, -1, -12);
  game.update(12);
  assert.ok(rear.z <= -4.7);
  assert.ok(following.z <= rear.z - 5.5);
  assert.ok(otherLane.z > 0);
  assert.equal(game.collisions, 1);
  game.changeLane(1); game.update(.2);
  assert.equal(game.collisionStopped, false);
  game.update(1);
  assert.ok(rear.z > -4.7);
});

test('changing into a blocked neighbouring lane keeps the car stopped', () => {
  const game = fresh(); noSpawns(game);
  car(game); game.update(.01);
  const blocker = car(game, 1, 4.7);
  blocker.kind = 'barrier'; blocker.speed = blocker.baseSpeed = 0;
  game.changeLane(1); game.update(3);
  assert.equal(game.playerX, 1);
  assert.equal(game.speed, 0);
  assert.equal(game.collisionStopped, true);
  game.changeLane(-1); game.update(.2);
  assert.equal(game.collisionStopped, true);
  game.changeLane(-1); game.update(.2);
  assert.equal(game.collisionStopped, false);
});

test('a crash halfway through a lane change resumes in the clear destination',()=>{
  const game=fresh();noSpawns(game);
  game.lane=1;game.playerX=.5;
  car(game,0,0);game._updateTraffic(.001);
  assert.equal(game.collisionStopped,true);
  assert.ok(game.collisionX>.49&&game.collisionX<.51);
  game.update(.2);
  assert.equal(game.playerX,1);assert.equal(game.collisionStopped,false);
  game.update(1);assert.ok(game.speed>0);assert.equal(game.collisions,1);
});

test('rear queues in all lanes do not lock a clear recovery lane',()=>{
  const game=fresh();noSpawns(game);car(game);game.update(.01);
  for(const lane of [-1,0,1]){const rear=car(game,lane,-4.7);rear.speed=rear.baseSpeed=0;}
  game.changeLane(1);game.update(.2);
  assert.equal(game.collisionStopped,false);
  game.update(1);assert.ok(game.speed>0);
  const rear=game.traffic.find(c=>c.lane===1);assert.ok(rear.z<=-4.7);
  assert.equal(game.collisions,1);
});

test('signalled traffic waits for an occupied destination, then merges when it clears', () => {
  for (const kind of ['car', 'barrier']) {
    const game = fresh(); noSpawns(game);
    const merging = car(game, 0, 30), blocking = car(game, 1, 30);
    blocking.kind = kind;
    Object.assign(merging, { changePending: true, targetLane: 1, signalDirection: 1, warningTimer: .01 });
    game.update(.5);
    assert.equal(merging.lane, 0); assert.equal(merging.x, 0);
    assert.equal(merging.changePending, true);
    assert.equal(merging.signalDirection, 1);
    assert.ok(merging.warningTimer > 0);
    blocking.z = merging.z + 30;
    game.update(.5);
    assert.equal(merging.lane, 1); assert.equal(merging.x, 1);
    assert.equal(merging.changePending, false);
  }
});

test('a two-lane traffic change cannot cross a car in the intermediate lane', () => {
  const game = fresh(); noSpawns(game);
  const merging = car(game, -1, 30);
  car(game, 0, 30);
  Object.assign(merging, { changePending: true, targetLane: 1, signalDirection: 1, warningTimer: .01 });
  game.update(1);
  assert.equal(merging.lane, -1); assert.equal(merging.x, -1);
});

test('traffic reserves the merge corridor against a fast approaching neighbour', () => {
  const game = fresh(); noSpawns(game);
  const merging = car(game, 0, 30), approaching = car(game, 1, 20);
  approaching.speed = approaching.baseSpeed = 100;
  Object.assign(merging, { changePending: true, targetLane: 1, signalDirection: 1, warningTimer: .01 });
  game.update(.05);
  assert.equal(merging.lane, 0); assert.equal(merging.x, 0);
});

test('opposing simultaneous traffic changes never overlap at any simulation step', () => {
  const game = fresh(); noSpawns(game);
  const left = car(game, -1, 30), right = car(game, 1, 30);
  Object.assign(left, { changePending: true, targetLane: 1, signalDirection: 1, warningTimer: .01 });
  Object.assign(right, { changePending: true, targetLane: -1, signalDirection: -1, warningTimer: .01 });
  for (let n = 0; n < 40; n++) {
    game.update(.05);
    assert.ok(Math.abs(left.x - right.x) >= .76 || Math.abs(left.z - right.z) >= 5.5);
  }
});

test('fast following traffic cannot reorder itself through a stationary obstacle', () => {
  const game = fresh(); noSpawns(game); game.lane = game.playerX = -1;
  const obstacle = car(game, 0, 30), following = car(game, 0, 24.5);
  obstacle.kind = 'barrier'; obstacle.speed = obstacle.baseSpeed = 0;
  following.speed = following.baseSpeed = 700;
  game.update(.05);
  assert.ok(following.z <= obstacle.z - 5.5);
  assert.equal(following.speed, 0);
});
