import assert from "node:assert/strict";
import { mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { runAutomation, serveGame } from "./automate.mjs";

const output = resolve(".context/automation-tests");
await mkdir(output, { recursive: true });
const server = await serveGame();
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "no-preference",
  });
  const stored = {
    "gilded-archipelago-save": JSON.stringify({
      version: 1,
      game: { coins: 999999 },
      ship: {},
      merchants: [],
      worldEvents: {},
      gameStarted: true,
    }),
    "gilded-archipelago-map-seed": "existing-player-world",
    "gilded-archipelago-debug-settings": JSON.stringify({ paused: true }),
    "gilded-archipelago-graphics": "low",
  };
  await context.addInitScript((stored) => {
    for (const [key, value] of Object.entries(stored))
      localStorage.setItem(key, value);
  }, stored);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const boot = async (seed = "automation-smoke") => {
    await page.goto(
      `${server.url}/?automation=step&seed=${encodeURIComponent(seed)}`,
    );
    await page.waitForFunction(() => window.parchmentAutomation?.version === 1);
  };
  const storage = () =>
    page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await boot();
  const before = await storage();
  assert.deepEqual(before, stored);
  assert.equal(
    await page.evaluate(() => window.parchmentAutomation.snapshot().game.coins),
    120,
  );
  assert.equal(
    await page.evaluate(
      () => window.parchmentAutomation.snapshot().game.mapSeed,
    ),
    "automation-smoke",
  );
  const originalPorts = await page.evaluate(
    () => window.parchmentAutomation.snapshot().ports,
  );
  // Wait across animation frames; step mode must remain fully paused.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.equal(
    await page.evaluate(() => window.parchmentAutomation.snapshot().ticks),
    0,
  );
  const run = async (chunk, render) => {
    for (let tick = 0; tick < 3600; tick += chunk) {
      await page.evaluate(
        ({ chunk, render }) => {
          window.parchmentAutomation.step(chunk);
          if (render) window.parchmentAutomation.render();
        },
        { chunk, render },
      );
    }
    return page.evaluate(() => window.parchmentAutomation.snapshot());
  };
  const first = await run(150, true);
  assert.ok(Object.keys(first.metrics.visits).length >= 2);
  assert.ok(first.metrics.completedContracts >= 1);
  assert.ok(first.counts.trade > 0);
  assert.equal(first.counts.rejected, undefined);
  assert.equal(first.error, null);
  assert.deepEqual(await storage(), before);
  await page.screenshot({ path: resolve(output, "voyage.png") });
  await boot();
  const second = await run(1800, false);
  assert.deepEqual(
    second,
    first,
    "seeded runs must match regardless of chunk size and rendering cadence",
  );
  console.log(
    "✓ deterministic 120-second voyages, trade/contracts, and player-save isolation",
  );

  // This world used to send the pilot around a continent for two passages
  // quoted as one day, missing both deadlines before 180 seconds.
  await boot("coastal-stress");
  for (let tick = 0; tick < 6000; tick += 300)
    await page.evaluate(() => window.parchmentAutomation.step(300));
  const coastal = await page.evaluate(() =>
    window.parchmentAutomation.snapshot(),
  );
  assert.ok(coastal.metrics.visits.Mirravel >= 1);
  assert.ok(coastal.metrics.completedContracts >= 5);
  assert.equal(coastal.metrics.failedContracts, 0);
  assert.equal(coastal.error, null);
  console.log("✓ narrow-strait commissions arrive before their deadlines");

  await boot("another-world");
  assert.notDeepEqual(
    await page.evaluate(() => window.parchmentAutomation.snapshot().ports),
    originalPorts,
  );
  const results = await page.evaluate(() => {
    const api = window.parchmentAutomation;
    api.setAutoplay(false);
    const reject = [
      null,
      { type: "unknown" },
      { type: "steer", angle: NaN, power: 1 },
      { type: "steer", angle: 0, power: 2 },
      { type: "depart" },
      { type: "supply" },
      { type: "trade", key: "iron", direction: "buy", quantity: 1 },
      { type: "contract", id: "missing" },
      { type: "combat", action: "fight" },
      { type: "course", port: "missing" },
    ].map((action) => api.command(action));
    api.command({ type: "dock" });
    const noDock = api.command({ type: "dock" });
    api.command({ type: "supply" });
    const badContract = api.command({ type: "contract", id: "missing" });
    const badTrade = api.command({
      type: "trade",
      key: "missing",
      direction: "buy",
      quantity: 1,
    });
    const badQuantity = api.command({
      type: "trade",
      key: "iron",
      direction: "buy",
      quantity: -1,
    });
    const name = api
      .snapshot()
      .ports.find((port) => port.name !== api.snapshot().currentPort).name;
    const course = api.command({ type: "course", port: name });
    const depart = api.command({ type: "depart" });
    const steer = api.command({ type: "steer", angle: Math.PI, power: 1 });
    const before = api.snapshot().ship;
    api.step(30);
    return {
      reject,
      noDock,
      badContract,
      badTrade,
      badQuantity,
      course,
      depart,
      steer,
      before,
      after: api.snapshot().ship,
    };
  });
  for (const result of [
    ...results.reject,
    results.noDock,
    results.badContract,
    results.badTrade,
    results.badQuantity,
  ])
    assert.equal(result.ok, false);
  for (const result of [results.course, results.depart, results.steer])
    assert.equal(result.ok, true);
  assert.notEqual(results.before.x, results.after.x);
  assert.deepEqual(await storage(), before);
  console.log("✓ custom control, action validation, and alternate world seeds");

  // Closing panels must return keyboard steering to the sailing surface,
  // while controls inside the panels retain their own arrow-key behavior.
  for (const panel of ["register", "harbor"]) {
    await boot();
    await page.evaluate(() => window.parchmentAutomation.setAutoplay(false));
    await page
      .locator(panel === "register" ? "#shipButton" : "#dockButton")
      .click();
    await page.keyboard.down("ArrowRight");
    await page.evaluate(() => window.parchmentAutomation.step(30));
    await page.keyboard.up("ArrowRight");
    assert.equal(
      await page.evaluate(
        () => window.parchmentAutomation.snapshot().ship.anchored,
      ),
      true,
    );
    if (panel === "register") await page.locator("#closeShip").click();
    else await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.id), "game");
    await page.keyboard.down(panel === "register" ? "ArrowRight" : "d");
    await page.evaluate(() => window.parchmentAutomation.step(30));
    await page.keyboard.up(panel === "register" ? "ArrowRight" : "d");
    const ship = await page.evaluate(
      () => window.parchmentAutomation.snapshot().ship,
    );
    assert.equal(ship.anchored, false);
    assert.ok(ship.speed > 0);
  }
  console.log(
    "✓ keyboard sailing resumes after closing the register and leaving port with Escape",
  );

  // Normal play still starts and accepts keyboard input without publishing API.
  const normal = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const manual = await normal.newPage();
  manual.on("pageerror", (error) => errors.push(String(error)));
  await manual.goto(server.url);
  await manual.waitForFunction(() => !document.getElementById("hud").inert);
  assert.equal(
    await manual.evaluate(() => typeof window.parchmentAutomation),
    "undefined",
  );
  const saved = await manual.evaluate(() =>
    JSON.parse(localStorage.getItem("gilded-archipelago-save")),
  );
  assert.equal(saved.gameStarted, true);
  await manual.keyboard.down("ArrowRight");
  await manual.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await manual.keyboard.up("ArrowRight");
  await manual.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const moved = await manual.evaluate(() =>
    JSON.parse(localStorage.getItem("gilded-archipelago-save")),
  );
  assert.equal(moved.ship.anchored, false);
  assert.deepEqual(errors, []);
  await normal.close();
  await context.close();
  console.log("✓ ordinary play, keyboard controls, and saving");

  const video = await runAutomation({
    mode: "demo",
    record: true,
    seconds: 3,
    output: resolve(output, "recording"),
    url: server.url,
  });
  assert.ok((await stat(video.video)).size > 0);
  assert.ok(video.final.seconds >= 3);
  console.log("✓ real-time playback and playable video artifact");
} finally {
  await browser?.close();
  await server.close();
}
