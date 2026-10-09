'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require('C:/Users/songx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve(__dirname, '../research/blender-preview');
const assetNames = ['car-player', 'car-silver', 'car-blue', 'car-orange', 'barrier', 'tree', 'rock', 'hero'];
const url = process.env.ROAD_KING_PREVIEW_URL || 'http://127.0.0.1:4179/';
fs.mkdirSync(out, { recursive: true });

function renderInputs() {
  return assetNames.map(name => {
    const filename = path.resolve(__dirname, '../公路之王/assets/blender/' + name + '.png');
    const bytes = fs.readFileSync(filename);
    return { name, file: filename, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  });
}

// Advance the real game with public lane-change controls only. No assignment to
// health, traffic, elapsed time, score, invulnerability, or result state.
function driveSafely({ seconds, seekMixedHazards = false }) {
  const app = window.roadKingApp, game = app.game;
  const target = game.elapsed + seconds;
  for (let frame = 0; game.elapsed < target - 1e-8 && game.mode === 'playing'; frame++) {
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
    const visible = game.traffic.filter(car => !car.hit && !car.escaped && car.z >= 3 && car.z <= 120);
    if (seekMixedHazards && visible.some(car => car.kind === 'barrier') && visible.some(car => car.threat)) break;
  }
  app.draw();
  return { elapsed: game.elapsed, speed: game.speed, health: game.health, tier: game.difficulty.tier,
    waves: game.waveCount, dodged: game.dodged, mode: game.mode,
    visibleTraffic: game.traffic.filter(car => car.z >= -7 && car.z <= 175).map(car => ({ kind: car.kind, threat: car.threat, z: car.z, lane: car.lane })) };
}

async function initializePage(browser, viewport, failedAsset) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true });
  if (failedAsset) await context.route('**/assets/blender/' + failedAsset + '.png', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'Deliberate asset-failure test' }));
  const page = await context.newPage();
  const issues = { pageErrors: [], consoleErrors: [], failedRequests: [], badResponses: [] };
  page.on('pageerror', error => issues.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') issues.consoleErrors.push(message.text()); });
  page.on('requestfailed', request => issues.failedRequests.push({ url: request.url(), failure: request.failure() }));
  page.on('response', response => { if (response.status() >= 400) issues.badResponses.push({ url: response.url(), status: response.status() }); });
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 1;
    // Reproducible traffic; the production RNG and game rules are unchanged.
    let seed = 20261022;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    window.blenderDrawCalls = {};
    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
      if (image && typeof image.src === 'string' && image.src.includes('/assets/blender/')) {
        const name = image.src.split('/').pop();
        window.blenderDrawCalls[name] = (window.blenderDrawCalls[name] || 0) + 1;
      }
      return originalDrawImage.call(this, image, ...args);
    };
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  try {
    // RAF is deliberately frozen for deterministic simulation, so readiness must
    // poll by timer rather than Playwright's default animation-frame polling.
    await page.waitForFunction(() => window.roadKingReady === true && !!window.roadKingApp && !!window.roadKingApp.artReady, null, { polling: 50 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({ ready: window.roadKingReady, app: !!window.roadKingApp, errorText: document.querySelector('#error')?.textContent, readyState: document.readyState }));
    console.error(JSON.stringify({ viewport, initializationFailure: diagnostic, issues }));
    throw error;
  }
  await page.evaluate(async () => { await Promise.all([roadKingApp.artReady,roadKingApp.scene.ready]); roadKingApp.draw(); });
  assert.equal(await page.evaluate(()=>roadKingApp.scene.status),'ready');
  const assets = await page.evaluate(() => ({ loaded: roadKingApp.artLoaded, errors: roadKingApp.artErrors,
    images: Object.fromEntries(Object.entries(roadKingApp.art).filter(([, image]) => image).map(([key, image]) => [key, {
      width: image.naturalWidth || image.width, height: image.naturalHeight || image.height, source: image.src,
      complete: image.complete
    }])) }));
  return { context, page, issues, assets };
}

async function click(page, key) {
  const point = await page.evaluate(key => {
    const app = roadKingApp;
    app.draw();
    const button = app.buttons.find(item => item.key.includes(key) && !item.disabled);
    if (!button) throw new Error('Button not found: ' + key + '; available: ' + app.buttons.map(item => item.key));
    const bounds = app.p.canvas.getBoundingClientRect();
    return { x: bounds.left + app.ox + (button.x + button.w / 2) * app.scale,
      y: bounds.top + app.oy + (button.y + button.h / 2) * app.scale };
  }, key);
  await page.mouse.click(point.x, point.y);
}

async function snapshot(page, name) {
  await page.evaluate(() => roadKingApp.draw());
  await page.screenshot({ path: path.join(out, name + '.png') });
  return name + '.png';
}

function assertAssets(assets) {
  assert.equal(assets.loaded, assetNames.length, 'All eight Blender renders must load');
  assert.deepEqual(assets.errors, []);
  assert.deepEqual(Object.keys(assets.images).sort(), [...assetNames].sort());
  for (const name of assetNames) {
    const image = assets.images[name];
    assert.ok(image.width > 0 && image.height > 0 && image.complete, name + ' must be decoded');
    assert.ok(image.source.endsWith('/assets/blender/' + name + '.png'), name + ' must be a Blender PNG');
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader'] });
  const report = { date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()), kind: 'Real-time WebGL Blender geometry and Canvas HUD; legacy PNG/menu assets also checked. Not a Douyin simulator or phone test.', source: url, renderInputs: renderInputs(), viewports: {}, passed: false };
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
      const size = viewport.width + 'x' + viewport.height;
      console.log('Verifying Blender sprites at ' + size);
      const { context, page, issues, assets } = await initializePage(browser, viewport);
      assertAssets(assets);
      const checks = { assets, screenshots: [] };
      checks.screenshots.push(await snapshot(page, 'menu-' + size));
      await click(page, '开始');
      checks.recoveryWithRearQueues=await page.evaluate(()=>{
        const app=roadKingApp,g=app.game;g._nextTraffic=Infinity;g.lane=1;g.playerX=.5;
        g.traffic=[g._car(0,0)];g._updateTraffic(.001);
        for(const lane of [-1,0,1]){const rear=g._car(lane,-4.7);rear.speed=rear.baseSpeed=0;g.traffic.push(rear);}
        app.update(1);app.draw();
        return {stopped:g.collisionStopped,speed:g.speed,lane:g.lane,x:g.playerX,collisions:g.collisions};
      });
      assert.equal(checks.recoveryWithRearQueues.stopped,false);
      assert.ok(checks.recoveryWithRearQueues.speed>0);
      assert.equal(checks.recoveryWithRearQueues.collisions,1);
      checks.screenshots.push(await snapshot(page,'recovery-rear-queues-'+size));
      await page.evaluate(()=>roadKingApp.start());
      // Controlled reproduction of the reported cross-lane clipping. The long
      // natural run below restarts afterward and uses only public driving inputs.
      checks.blockedMerge = await page.evaluate(() => {
        const app = roadKingApp, game = app.game;
        game._nextTraffic = Infinity;
        game.speed=0; // Isolate the neighbouring-car merge from user-configured starting speed.
        const moving = game._car(-1, 32, true), neighbour = game._car(0, 32);
        Object.assign(moving, { changePending: true, targetLane: 1, signalDirection: 1, warningTimer: .01 });
        game.traffic = [moving, neighbour];
        game.update(.5); app.draw();
        return { x: moving.x, lane: moving.lane, pending: moving.changePending, signal: moving.signalDirection };
      });
      assert.equal(checks.blockedMerge.x, -1);
      assert.equal(checks.blockedMerge.pending, true);
      checks.screenshots.push(await snapshot(page, 'merge-waits-for-neighbour-' + size));
      checks.clearMerge = await page.evaluate(() => {
        const app = roadKingApp, game = app.game;
        const [moving, neighbour] = game.traffic;
        neighbour.z = moving.z + 18;
        let overlaps = 0;
        for (let n = 0; n < 16; n++) {
          game.update(.05);
          if (Math.abs(moving.x - neighbour.x) < .76 && Math.abs(moving.z - neighbour.z) < 5.5) overlaps++;
        }
        app.draw(); return { x: moving.x, lane: moving.lane, overlaps };
      });
      assert.equal(checks.clearMerge.x, 1);
      assert.equal(checks.clearMerge.overlaps, 0);
      checks.screenshots.push(await snapshot(page, 'merge-after-neighbour-clears-' + size));
      await page.evaluate(() => { roadKingApp.game.start(); roadKingApp.draw(); });
      checks.normalRun = await page.evaluate(driveSafely, { seconds: 12 });
      assert.equal(checks.normalRun.mode, 'playing');
      checks.screenshots.push(await snapshot(page, 'gameplay-' + size));
      checks.lateRun = await page.evaluate(driveSafely, { seconds: 143 });
      assert.equal(checks.lateRun.mode, 'playing');
      assert.equal(checks.lateRun.health, 100);
      assert.equal(checks.lateRun.tier, 4);
      assert.ok(checks.lateRun.speed > 195);
      assert.ok(Math.abs(checks.lateRun.elapsed - 155) < .1);
      checks.screenshots.push(await snapshot(page, 'high-speed-155-' + size));
      checks.mixedHazards = await page.evaluate(driveSafely, { seconds: 40, seekMixedHazards: true });
      assert.equal(checks.mixedHazards.mode, 'playing');
      assert.equal(checks.mixedHazards.health, 100);
      assert.ok(checks.mixedHazards.visibleTraffic.some(car => car.kind === 'barrier'));
      assert.ok(checks.mixedHazards.visibleTraffic.some(car => car.threat));
      checks.screenshots.push(await snapshot(page, 'high-speed-' + size));
      // Stop steering: a natural collision must stop the car until lane recovery.
      checks.collisionStop = await page.evaluate(() => {
        const app = roadKingApp, game = app.game;
        for (let n = 0; n < 12000 && !game.collisionStopped; n++) game.update(.05);
        const distance = game.distance, health = game.health;
        game.update(10); app.draw();
        return { stopped: game.collisionStopped, speed: game.speed, distanceFrozen: game.distance === distance, healthUnchanged: game.health === health };
      });
      assert.equal(checks.collisionStop.stopped, true);
      assert.equal(checks.collisionStop.speed, 0);
      assert.equal(checks.collisionStop.distanceFrozen, true);
      assert.equal(checks.collisionStop.healthUnchanged, true);
      checks.screenshots.push(await snapshot(page, 'collision-stop-' + size));
      // Recover by public lane inputs between crashes, until durability runs out.
      checks.result = await page.evaluate(() => {
        const app = roadKingApp, game = app.game;
        let frames = 0;
        while (game.mode === 'playing' && frames++ < 12000) {
          if (game.collisionStopped && Math.abs(game.playerX - game.lane) < .01) {
            const target = [-1, 0, 1].find(lane => Math.abs(lane - game.lane) === 1 &&
              !game.traffic.some(car => Math.abs(car.x - lane) < .65 && Math.abs(car.z) < 12));
            if (target !== undefined) game.changeLane(target - game.lane);
          }
          game.update(.05); app.clock += .05;
        }
        app.draw();
        return { mode: game.mode, elapsed: game.elapsed, health: game.health, score: game.score, collisions: game.collisions };
      });
      assert.equal(checks.result.mode, 'result');
      assert.equal(checks.result.health, 0);
      assert.ok(checks.result.collisions >= 4);
      checks.screenshots.push(await snapshot(page, 'result-' + size));
      checks.drawCalls = await page.evaluate(() => window.blenderDrawCalls);
      assert.ok(checks.drawCalls['hero.png']>0,'Menu hero must actually be drawn');
      checks.runtimeScene=await page.evaluate(()=>({status:roadKingApp.scene.status,models:Object.keys(roadKingApp.scene.models),glError:roadKingApp.scene.gl.getError()}));
      assert.equal(checks.runtimeScene.status,'ready');assert.equal(checks.runtimeScene.glError,0);
      checks.buttonsInsideViewport = await page.evaluate(() => roadKingApp.buttons.every(button => button.x >= 0 && button.y >= 0 && button.x + button.w <= 540 && button.y + button.h <= 960));
      assert.ok(checks.buttonsInsideViewport);
      assert.deepEqual(issues, { pageErrors: [], consoleErrors: [], failedRequests: [], badResponses: [] });
      checks.issues = issues;
      report.viewports[size] = checks;
      console.log('Passed ' + size + ': all rendered assets, natural gameplay, late obstacles, and result');
      await context.close();
    }
    const fallback = await initializePage(browser, { width: 390, height: 844 }, 'car-player');
    assert.equal(fallback.assets.loaded, assetNames.length - 1);
    assert.equal(fallback.assets.errors.length, 1);
    assert.ok(fallback.assets.errors.some(error => String(error).includes('car-player')));
    await click(fallback.page, '开始');
    const fallbackRun = await fallback.page.evaluate(driveSafely, { seconds: 12 });
    assert.equal(fallbackRun.mode, 'playing');
    assert.ok(fallbackRun.elapsed >= 11.9);
    assert.deepEqual(fallback.issues.pageErrors, []);
    assert.deepEqual(fallback.issues.failedRequests, []);
    assert.ok(fallback.issues.consoleErrors.every(message => message.includes('404')), 'No unrelated console error is allowed during the deliberate 404 test');
    assert.equal(fallback.issues.badResponses.length, 1);
    assert.ok(fallback.issues.badResponses[0].url.endsWith('/assets/blender/car-player.png'));
    assert.equal(fallback.issues.badResponses[0].status, 404);
    const fallbackScreenshot = await snapshot(fallback.page, 'fallback-missing-player-390x844');
    report.missingAssetFallback = { injectedFailure: 'car-player.png returns HTTP 404', assets: fallback.assets,
      run: fallbackRun, screenshot: fallbackScreenshot, issues: fallback.issues,
      expectedNetworkError: 'Only the deliberately missing legacy car-player.png request may fail; gameplay continues using real-time geometry.' };
    await fallback.context.close();
    report.renderInputsAtFinish = renderInputs();
    assert.deepEqual(report.renderInputsAtFinish, report.renderInputs, 'Rendered PNG files changed during verification; rerun against the final files');
    report.passed = true;
  } finally {
    fs.writeFileSync(path.join(out, 'blender-ui-smoke.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });
