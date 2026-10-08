'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/songx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve(__dirname, '../research/endless-preview');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const errors = [];
  const checks = {};
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
    page.on('pageerror', error => errors.push(error.message));
    // Deterministic simulation while exercising the real Canvas and browser input handlers.
    await page.addInitScript(() => { window.requestAnimationFrame = () => 1; });
    const ready = async () => {
      await page.waitForFunction(() => window.roadKingReady === true);
      await page.evaluate(() => roadKingApp.draw());
    };
    const snapshot = async name => {
      await page.evaluate(() => roadKingApp.draw());
      await page.screenshot({ path: path.join(out, name + '.png') });
    };
    const click = async text => {
      const point = await page.evaluate(text => {
        const app = roadKingApp;
        app.draw();
        const button = app.buttons.find(item => item.key.includes(text) && !item.disabled);
        if (!button) throw new Error('Button not found: ' + text + '; available: ' + app.buttons.map(item => item.key));
        const bounds = app.p.canvas.getBoundingClientRect();
        return { x: bounds.left + app.ox + (button.x + button.w / 2) * app.scale,
          y: bounds.top + app.oy + (button.y + button.h / 2) * app.scale };
      }, text);
      await page.mouse.click(point.x, point.y);
    };
    const advance = async seconds => page.evaluate(seconds => {
      for (let remaining = seconds; remaining > 1e-8; remaining -= .05) {
        roadKingApp.game.update(Math.min(.05, remaining));
        roadKingApp.flushLane();
      }
      roadKingApp.clock += seconds;
      roadKingApp.draw();
    }, seconds);
    const state = async () => page.evaluate(() => {
      const g = roadKingApp.game;
      return { mode: g.mode, elapsed: g.elapsed, lane: g.lane, speed: g.speed, distance: g.distance,
        score: g.score, health: g.health, brake: g.brake, throttle: g.throttle, brakeEnergy: g.brakeEnergy,
        brakeLocked: g.brakeLocked, pulseCooldown: g.pulseCooldown, difficulty: g.difficulty, best: roadKingApp.best };
    });
    await page.goto('http://127.0.0.1:4179/');
    await ready();
    await page.evaluate(() => { localStorage.removeItem('roadking.endless.best.v1'); });
    await page.reload(); await ready();
    await snapshot('menu');
    await click('开始');
    assert.equal((await state()).mode, 'playing');
    await page.keyboard.press('ArrowLeft'); await advance(.5);
    assert.equal((await state()).lane, -1);
    await page.keyboard.press('ArrowRight'); await advance(.5);
    assert.equal((await state()).lane, 0);
    checks.keyboardLaneChange = true;
    // Drag across the road through the platform pointer adapter.
    const swipe = await page.evaluate(() => {
      const a = roadKingApp, r = a.p.canvas.getBoundingClientRect();
      return { x: r.left + a.ox + 270 * a.scale, y: r.top + a.oy + 540 * a.scale, dx: 120 * a.scale };
    });
    await page.mouse.move(swipe.x, swipe.y); await page.mouse.down();
    await page.mouse.move(swipe.x + swipe.dx, swipe.y, { steps: 4 }); await page.mouse.up();
    await advance(.5); assert.equal((await state()).lane, 1);
    checks.roadSwipe = true;
    await page.mouse.move(swipe.x + swipe.dx, swipe.y); await page.mouse.down();
    await page.mouse.move(swipe.x - swipe.dx, swipe.y); await page.mouse.up();
    await advance(.5); assert.equal((await state()).lane, -1);
    checks.fastTwoLaneSwipe = true;
    await page.keyboard.down('Space'); await advance(4);
    const depleted = await state();
    assert.equal(depleted.brakeEnergy, 0);
    assert.equal(depleted.brakeLocked, true);
    await page.keyboard.up('Space'); await advance(2);
    assert.ok((await state()).brakeEnergy > 0);
    checks.brakeEnergy = true;
    await click('气浪'); assert.ok((await state()).pulseCooldown > 0);
    checks.pulse = true;
    await snapshot('gameplay');
    await page.keyboard.press('Escape');
    const beforePause = await state(); await advance(20);
    assert.deepEqual(await state(), beforePause);
    checks.pauseFrozen = true;
    await snapshot('pause');
    await click('继续');
    await page.keyboard.down('Space');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const background = await state();
    assert.equal(background.mode, 'paused'); assert.equal(background.brake, false); assert.equal(background.throttle, false);
    await page.keyboard.up('Space'); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    checks.backgroundReleasesInput = true;
    await click('返回');
    assert.equal((await state()).mode, 'menu');
    await click('开始');
    // Natural no-input run must conclude; no direct edits to health, traffic or outcome.
    const run = await page.evaluate(() => {
      const app = roadKingApp, g = app.game;
      let frames = 0;
      while (g.mode === 'playing' && frames++ < 12000) g.update(.05);
      app.draw();
      return { mode: g.mode, score: g.score, elapsed: g.elapsed, distance: g.distance, health: g.health, best: app.best };
    });
    assert.equal(run.mode, 'result'); assert.equal(run.health, 0); assert.ok(run.score >= 0);
    checks.naturalResult = run;
    await snapshot('result');
    await click('再');
    const retry = await state();
    assert.equal(retry.mode, 'playing'); assert.equal(retry.health, 100); assert.equal(retry.elapsed, 0);
    checks.retry = true;
    await page.reload(); await ready();
    const persisted = await state();
    assert.deepEqual(persisted.best, run.best);
    checks.persistence = true;
    await click('开始');
    checks.lateRun = await page.evaluate(() => {
      const app = roadKingApp, game = app.game;
      for (let frame = 0; frame < 3100 && game.mode === 'playing'; frame++) {
        if (frame % 3 === 0) {
          const visible = game.traffic.filter(car => !car.hit && !car.escaped && car.z >= -5 && car.z <= Math.max(1, (game.speed - car.speed) / 3.6 * .75) * 3 + 8);
          if (visible.length) {
            const nearest = visible.reduce((a, b) => a.z < b.z ? a : b);
            const wave = visible.filter(car => car.waveId === nearest.waveId);
            const occupied = new Set(wave.map(car => car.lane));
            for (const car of wave) if (car.signalDirection) occupied.add(car.targetLane);
            const choices = [-1, 0, 1].filter(lane => !occupied.has(lane)).sort((a, b) => Math.abs(a - game.lane) - Math.abs(b - game.lane));
            if (choices.length && choices[0] !== game.lane) game.changeLane(Math.sign(choices[0] - game.lane));
          }
        }
        game.update(.05);
        app.clock += .05;
      }
      app.draw();
      return { elapsed: game.elapsed, speed: game.speed, health: game.health, tier: game.difficulty.tier, waves: game.waveCount, dodged: game.dodged, mode: game.mode };
    });
    assert.equal(checks.lateRun.mode, 'playing'); assert.equal(checks.lateRun.health, 100);
    assert.ok(checks.lateRun.speed > 195); assert.equal(checks.lateRun.tier, 6);
    await snapshot('high-speed');
    await page.setViewportSize({ width: 320, height: 568 }); await page.reload(); await ready();
    await snapshot('menu-small'); await click('开始'); await advance(3);
    await snapshot('gameplay-small');
    checks.compactViewport = await page.evaluate(() => roadKingApp.buttons.every(button => button.x >= 0 && button.y >= 0 && button.x + button.w <= 540 && button.y + button.h <= 960));
    assert.ok(checks.compactViewport);
    assert.deepEqual(errors, []);
    const report = { date: '2026-10-08', kind: 'Shared-source browser Canvas and input verification; not a Douyin simulator or phone test', viewports: ['390x844', '320x568'], errors, checks, passed: true };
    fs.writeFileSync(path.join(out, 'ui-smoke.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
