'use strict';

// Platform-independent endless-driving rules. Distances are metres; lane/x are -1..1.
// Each wave reserves a lane, and neighbouring waves leave time for one lane change.
class RoadKingCore {
  constructor(options = {}) {
    if (typeof options === 'function') options = { random: options };
    this.random = typeof options.random === 'function' ? options.random : Math.random;
    this.onEvent = typeof options.onEvent === 'function' ? options.onEvent : null;
    this.mode = 'menu';
    this.level = 0;
    this._reset();
  }

  _reset() {
    this.level = 0;
    this.elapsed = 0;
    this.distance = 0;
    this.speed = 76;
    this.maxSpeed = 76;
    this.health = 100;
    this.score = 0;
    this.dodged = 0;
    this.waveCount = 0;
    this.clearedEvents = 0;
    this.eventCount = 0;
    this.collisions = 0;
    this.lane = 0;
    this.playerX = 0;
    this.traffic = [];
    this.encounter = null;
    this.signalDirection = 0;
    this.signalTimer = 0;
    this.signalRewardCooldown = 0;
    this.pulseCooldown = 0;
    this.pulseLife = 0;
    this.invulnerability = 0;
    this.collisionStopped = false;
    this.collisionX = 0;
    this.laneChangeCooldown = 0;
    this.message = '';
    this.messageTimer = 0;
    this.won = false;
    this.resultReason = '';
    this.stars = 0;
    this.signalsUsed = 0;
    this.pulsesUsed = 0;
    this.throttle = false;

    this._nextTraffic = 1.4;
    this._nextId = 1;
    this._safeLane = 0;
    this._distanceScore = 0;
    // Compatibility for hosts that previously read the timed-level fields.
    this.duration = Infinity;
    this.requiredEvents = 0;
    this.difficulty = {};
    this._updateDifficulty();
  }

  start() {
    this._reset();
    this.mode = 'playing';
    this._message('无尽公路 · 换道避障，速度会持续提升', 4.5);
    this._emit('start', { level: 0 });
    return this;
  }

  update(dt) {
    if (this.mode !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    // Simulate all elapsed time in small steps, including on slow devices.
    let remaining = dt;
    while (remaining > 1e-8 && this.mode === 'playing') {
      const step = Math.min(remaining, 0.05);
      this._step(step);
      remaining -= step;
    }
  }

  _updateDifficulty() {
    const elapsed = this.elapsed;
    const tier = Math.min(6, Math.floor((elapsed + 1e-8) / 30) + 1);
    const labels = ['轻松起步', '车流渐密', '高速穿行', '连续闪避', '极限反应', '无尽挑战'];
    const previousTier = this.difficulty.tier;
    Object.assign(this.difficulty, {
      tier,
      label: labels[Math.min(tier - 1, labels.length - 1)],
      progress: clamp((elapsed - (tier - 1) * 30) / 30, 0, 1),
      cruiseSpeed: 76 + 152 * (1 - Math.exp(-elapsed / 85)),
      spawnInterval: 1.1 + 2.7 * Math.exp(-elapsed / 70),
      reactionTime: 2.6 + 2.4 * Math.exp(-elapsed / 80)
    });
    if (previousTier && previousTier !== tier) {
      this._message('强度 ' + tier + ' · ' + this.difficulty.label, 2.8);
      this._emit('difficulty', { ...this.difficulty });
    }
  }

  _step(dt) {
    if (this.health <= 0) { this._finish(false, '车辆耐久耗尽'); return; }
    this.elapsed += dt;
    this._updateDifficulty();
    for (const key of ['invulnerability', 'laneChangeCooldown', 'signalRewardCooldown', 'pulseCooldown', 'pulseLife', 'messageTimer'])
      this[key] = Math.max(0, this[key] - dt);
    if (this.signalDirection !== 0) {
      this.signalTimer += dt;
      if (this.signalTimer > 6) { this.signalDirection = 0; this.signalTimer = 0; }
    }
    const cruise = this.difficulty.cruiseSpeed;
    const desired = Math.min(240, cruise + (this.throttle ? 22 : 0));
    this.speed = this.collisionStopped ? 0 : moveTowards(this.speed, desired, dt * (this.throttle ? 45 : 24));
    this.maxSpeed = Math.max(this.maxSpeed, this.speed);
    this.distance += this.speed / 3.6 * dt;
    const distanceScore = Math.floor(this.distance * 1.5);
    this.score += distanceScore - this._distanceScore;
    this._distanceScore = distanceScore;
    this.playerX = moveTowards(this.playerX, this.lane, dt * 5);
    this._updateTraffic(dt);
    if (this.collisionStopped && Math.abs(this.playerX - this.collisionX) >= 0.8 && Math.abs(this.playerX - this.lane) < 0.01 &&
        !this.traffic.some(car => Math.abs(car.x - this.playerX) < 0.65 && Math.abs(car.z) < 5.5)) {
      this.collisionStopped = false;
      this._message('已避开碰撞 · 从静止重新加速', 2.5);
      this._emit('collision-recovered', { lane: this.lane });
    }
    if (this.health <= 0) { this._finish(false, '车辆耐久耗尽'); return; }
    if (!this.collisionStopped && this.elapsed + 1e-8 >= this._nextTraffic) {
      const spawned = this._spawnTraffic();
      this._nextTraffic = this.elapsed + (spawned ? this.difficulty.spawnInterval : 0.15);
    }
  }

  changeLane(direction) {
    if (this.mode !== 'playing' || this.laneChangeCooldown > 1e-8) return false;
    const dir = Math.sign(direction);
    if (!dir) return false;
    const next = clamp(this.lane + dir, -1, 1);
    if (next === this.lane) return false;
    const safe = !this.traffic.some(car => !car.escaped && Math.abs(car.x - next) < 2 / 3.35 && Math.abs(car.z) < 12);
    const reward = this.signalDirection === dir && this.signalTimer + 1e-8 >= 1 && this.signalRewardCooldown <= 1e-8 && safe;
    if (reward) {
      this.score += 30;
      this.signalRewardCooldown = 5;
      this._message('提前打灯 +30 · 漂亮的变线', 2.4);
    }
    this.lane = next;
    this.laneChangeCooldown = 0.2;
    this.signalDirection = 0;
    this.signalTimer = 0;
    this._emit('lane', { lane: next, direction: dir, reward: reward ? 30 : 0, safe });
    return true;
  }

  setSignal(direction) {
    if (this.mode !== 'playing') return false;
    const dir = Math.sign(direction);
    if (!dir) return false;
    this.signalDirection = dir;
    this.signalTimer = 0;
    this.signalsUsed++;
    this._emit('signal', { direction: dir });
    return true;
  }

  pulse() {
    if (this.mode !== 'playing' || this.pulseCooldown > 1e-8) return false;
    this.pulseCooldown = 10;
    this.pulseLife = 0.8;
    this.pulsesUsed++;
    const carIds = [];
    for (const car of this.traffic) {
      if (car.kind === 'barrier' || car.hit || car.escaped || car.z < -4 || car.z > 36) continue;
      car.z += 12;
      car.speed = Math.max(150, this.speed + 70);
      car.escaped = true;
      car.signalDirection = 0;
      car.warningTimer = 0;
      carIds.push(car.id);
    }
    this._emit('pulse', { countered: carIds.length > 0, carIds, cooldown: 10 });
    this._message(carIds.length ? '气浪已推开近处车辆 · 路障仍需换道' : '气浪已释放 · 近处车辆可推开，路障需避让', 2.8);
    return true;
  }

  setThrottle(held) { this.throttle = this.mode === 'playing' && !!held; }
  pause() {
    if (this.mode !== 'playing') return false;
    this.setThrottle(false);
    this.mode = 'paused';
    this._emit('mode', { mode: this.mode });
    return true;
  }
  resume() {
    if (this.mode !== 'paused') return false;
    this.mode = 'playing';
    this._emit('mode', { mode: this.mode });
    return true;
  }
  menu() {
    this.setThrottle(false);
    this.mode = 'menu';
    this._emit('mode', { mode: this.mode });
  }

  _car(lane, z, threat = false) {
    return {
      id: this._nextId++, lane, x: lane, z, speed: 28, baseSpeed: 28,
      kind: 'car', threat, hit: false, escaped: false, passed: false,
      signalDirection: 0, warningTimer: 0, changePending: false
    };
  }

  _pick(items) { return items[Math.min(items.length - 1, Math.floor(clamp(this.random(), 0, 1) * items.length))]; }
  _safeGap() { return 22 + Math.min(240, this.difficulty.cruiseSpeed + 22) * 0.1; }

  _trafficLaneClear(car, nextX, seconds) {
    // Reserve the entire swept width, including the middle lane on a two-lane
    // crossing. Predict relative motion so a closing car cannot enter mid-merge.
    const left = Math.min(car.x, nextX), right = Math.max(car.x, nextX);
    return !this.traffic.some(other => {
      if (other === car) return false;
      const otherLeft = Math.min(other.x, other.lane), otherRight = Math.max(other.x, other.lane);
      if (otherRight < left - 0.76 || otherLeft > right + 0.76) return false;
      const separation = other.z - car.z;
      const predicted = separation + (other.speed - car.speed) / 3.6 * 0.75 * seconds;
      return Math.min(separation, predicted) < 6.5 && Math.max(separation, predicted) > -6.5;
    });
  }

  _spawnTraffic() {
    const active = this.traffic.filter(car => !car.escaped && !car.hit && car.z > -8);
    if (active.length >= 10) return false;
    const safeLane = this._pick([-1, 0, 1].filter(lane => Math.abs(lane - this._safeLane) <= 1));
    const blocked = [-1, 0, 1].filter(lane => lane !== safeLane);
    const double = this.elapsed >= 18 && this.random() < Math.min(0.82, 0.3 + (this.elapsed - 18) / 125);
    const barrier = this.elapsed >= 25 && this.random() < 0.3;
    const waveSpeed = barrier ? 0 : 22 + Math.min(12, this.elapsed * 0.06);
    const approachSpeed = Math.min(240, this.difficulty.cruiseSpeed + 22);
    const closing = (approachSpeed - waveSpeed) / 3.6 * 0.75;
    const farthest = active.reduce((z, car) => Math.max(z, car.z), -Infinity);
    const z = Math.max(55, closing * this.difficulty.reactionTime, farthest + this._safeGap());
    // Defer crowded spawns instead of placing hazards outside the visible road.
    if (z > 145) return false;
    const lanes = double ? blocked : [this._pick(blocked)];
    const waveId = ++this.waveCount;
    const stagger = double && this.elapsed >= 55 ? 7 : 0;
    const canChange = !barrier && this.elapsed >= 40 && safeLane !== 0 && this.random() < 0.5;
    const carIds = [];
    lanes.forEach((lane, index) => {
      const car = this._car(lane, z + index * stagger, canChange && index === 0);
      Object.assign(car, {
        waveId, safeLane, kind: barrier ? 'barrier' : 'car',
        speed: waveSpeed, baseSpeed: waveSpeed,
        changePending: canChange && index === 0,
        targetLane: blocked.find(other => other !== lane)
      });
      carIds.push(car.id);
      this.traffic.push(car);
    });
    this._safeLane = safeLane;
    this._emit('wave', { number: waveId, safeLane, obstacles: lanes.length, barrier, carIds });
    return true;
  }

  _updateTraffic(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Preserve longitudinal order from before movement: sorting after movement
    // would let a fast following vehicle jump through the one in front.
    const trafficOrder = [...this.traffic].sort((a, b) => b.z - a.z);
    // Moving traffic slows behind the next wave. This preserves the spacing
    // around stationary roadblocks.
    const waves = new Map();
    for (const car of this.traffic) {
      if (car.escaped || car.hit || car.passed || !car.waveId) continue;
      if (!waves.has(car.waveId)) waves.set(car.waveId, { cars: [], minZ: car.z, maxZ: car.z, speed: car.baseSpeed });
      const wave = waves.get(car.waveId);
      wave.cars.push(car);
      wave.minZ = Math.min(wave.minZ, car.z);
      wave.maxZ = Math.max(wave.maxZ, car.z);
    }
    let ahead = null;
    for (const wave of Array.from(waves.values()).sort((a, b) => b.minZ - a.minZ)) {
      if (ahead) {
        const available = Math.max(0, ahead.minZ - wave.maxZ - this._safeGap());
        wave.speed = Math.min(wave.speed, ahead.speed + available * 3.6 / (0.75 * dt));
      }
      for (const car of wave.cars) car.speed = wave.speed;
      ahead = wave;
    }
    for (let index = this.traffic.length - 1; index >= 0; index--) {
      const car = this.traffic[index];
      if (car.changePending && !car.hit && !car.escaped) {
        const warningDistance = Math.max(36, (this.speed - car.speed) / 3.6 * 0.75 * 2.1);
        if (!car.signalDirection && car.z <= warningDistance) {
          car.signalDirection = Math.sign(car.targetLane - car.lane);
          car.warningTimer = 1.1;
          this._emit('threat-warning', { carId: car.id, direction: car.signalDirection });
        } else if (car.signalDirection) {
          car.warningTimer = Math.max(0, car.warningTimer - dt);
          if (car.warningTimer <= 1e-8 && this._trafficLaneClear(car, car.targetLane, Math.abs(car.targetLane - car.x) / 4 + 0.1)) {
            car.lane = car.targetLane;
            car.changePending = false;
            car.signalDirection = 0;
          } else if (car.warningTimer <= 1e-8) {
            car.warningTimer = 0.1;
          }
        }
      }
      if (car.hit) car.speed = this.collisionStopped || car.kind === 'barrier' ? 0 : car.baseSpeed;
      const previousZ = car.z;
      car.z += (car.speed - this.speed) / 3.6 * dt * 0.75;
      const nextX = moveTowards(car.x, car.lane, dt * 4);
      if (nextX === car.x || this._trafficLaneClear(car, nextX, dt)) car.x = nextX;
      // Rear traffic queues behind the player instead of passing through it.
      // Damage immunity also keeps approaching traffic physically separated.
      if (Math.abs(car.x - this.playerX) < 0.65) {
        if (previousZ <= -3.5 && car.z > -4.7) car.z = -4.7;
        if (previousZ >= 3.5 && car.z < 4.7 && (this.collisionStopped || this.invulnerability > 1e-8)) car.z = 4.7;
      }
      if (!this.collisionStopped && !car.escaped && !car.hit && this.invulnerability <= 1e-8 && Math.abs(car.x - this.playerX) < 1.72 / 3.35 && Math.abs(car.z) < 3.5) {
        car.hit = true;
        this.health = Math.max(0, this.health - 26);
        this.score = Math.max(0, this.score - 120);
        this.collisions++;
        this.invulnerability = 2.1;
        this.speed = 0;
        this.collisionStopped = true;
        this.collisionX = this.playerX;
        car.speed = 0;
        car.z = previousZ < 0 ? -4.7 : 4.7;
        car.changePending = false;
        car.signalDirection = 0;
        this._message('碰撞停车 −26 耐久 · 左右滑动换道后重新加速', 6);
        this._emit('collision', { carId: car.id, health: this.health, damage: 26, invulnerability: 2.1 });
      }
      if (!car.passed && car.z < -7) {
        car.passed = true;
        if (!car.hit && !car.escaped) {
          this.dodged++;
          const reward = 20 + Math.min(40, this.difficulty.tier * 5);
          this.score += reward;
          this._emit('dodge', { carId: car.id, reward, dodged: this.dodged });
        }
      }
      if (car.z < -32 || car.z > 175) this.traffic.splice(index, 1);
    }
    // Keep a bumper gap through queues, including behind the stopped crash car.
    const ordered = trafficOrder.filter(car => this.traffic.includes(car));
    for (let i = 0; i < ordered.length; i++) {
      for (let j = 0; j < i; j++) {
        if (Math.abs(ordered[i].x - ordered[j].x) < 0.76 && ordered[i].z > ordered[j].z - 5.5) {
          ordered[i].z = ordered[j].z - 5.5;
          ordered[i].speed = Math.min(ordered[i].speed, ordered[j].speed);
        }
      }
      if (Math.abs(ordered[i].x - this.playerX) < 0.65 && ordered[i].z <= 0 && ordered[i].z > -4.7) ordered[i].z = -4.7;
    }
  }

  _finish(success, reason) {
    if (this.mode !== 'playing') return;
    this.won = false;
    this.resultReason = reason;
    this.mode = 'result';
    this.stars = 0;
    this.throttle = false;
    this._emit('result', {
      level: 0, won: false, reason, stars: 0, score: this.score,
      health: this.health, clearedEvents: 0, eventCount: 0,
      collisions: this.collisions, distance: this.distance, elapsed: this.elapsed,
      maxSpeed: this.maxSpeed, dodged: this.dodged, waveCount: this.waveCount,
      tier: this.difficulty.tier
    });
  }
  _message(text, seconds) {
    this.message = text; this.messageTimer = seconds;
    this._emit('message', { text, seconds });
  }
  _emit(type, data) { if (this.onEvent) this.onEvent(type, data); }
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function moveTowards(value, target, delta) {
  return Math.abs(target - value) <= delta ? target : value + Math.sign(target - value) * delta;
}

module.exports = RoadKingCore;
module.exports.RoadKingCore = RoadKingCore;

