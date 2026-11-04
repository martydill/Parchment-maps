import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { serveGame } from "./automate.mjs";

const output = resolve(".context/gameplay-tests");
await mkdir(output, { recursive: true });
const server = await serveGame();
let browser;
const errors = [];
try {
  browser = await chromium.launch();
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 },
      hasTouch: mobile,
      isMobile: mobile,
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem("gilded-archipelago-graphics", "low"),
    );
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(server.url);
    await page.waitForFunction(() => !document.getElementById("hud").inert);
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.addInitScript((mobile) => {
      const key = "gilded-archipelago-save";
      const saved = JSON.parse(localStorage.getItem(key));
      saved.game.operations.morale = 20;
      for (const group of Object.values(saved.game.operations.crew.groups))
        group.fatigue = 85;
      saved.game.coins = 500;
      saved.game.activeContracts = [
        {
          id: "ui-deadline",
          title: "Urgent pouch",
          cargoName: "pouch",
          cargoUnits: 1,
          destination: mobile ? null : "Narthkel",
          kind: mobile ? "survey" : "delivery",
          survey: mobile
            ? {
                description: "Survey the coast.",
                target: "exploration",
                required: 2,
                completed: [],
              }
            : undefined,
          faction: "Lantern League",
          reward: 100,
          deadline: 2,
        },
      ];
      // Exercise migration from saves made before receipts and market memory.
      delete saved.game.voyageLedger;
      delete saved.game.marketNotes;
      localStorage.setItem(key, JSON.stringify(saved));
    }, mobile);
    await page.reload();
    await page.waitForFunction(() => !document.getElementById("hud").inert);
    await page.locator("#crewReadiness").waitFor({ state: "visible" });
    await page.locator("#crewReadiness").click();
    assert.ok(await page.locator("#portPanel").isVisible());
    assert.match(
      await page.locator("#departureReadiness").innerText(),
      /Rest advised/,
    );
    const preview = await page
      .locator("#passageWorkspace .reading-body")
      .innerText();
    assert.match(preview, /28 morale · 57 fatigue/);
    assert.match(preview, /Deadline warning: Urgent pouch/);
    const prefix = mobile ? "phone" : "desktop";
    await page.screenshot({
      path: resolve(output, `${prefix}-shore-leave.png`),
    });
    await page.locator("#grantShoreLeave").click();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("gilded-archipelago-save")),
    );
    assert.equal(saved.game.day, 2);
    assert.equal(saved.game.coins, 489);
    assert.equal(saved.game.operations.morale, 28);
    assert.equal(saved.game.operations.crew.groups.deck.fatigue, 57);
    assert.equal(saved.game.voyageLedger.pending.leave, 11);
    assert.ok(Object.keys(saved.game.marketNotes).length > 0);
    await page.locator(".harbor-suggestion").click();
    assert.ok(
      await page
        .locator('#portPanel .port-panel[data-tab="vessel"]')
        .isVisible(),
    );
    assert.match(
      await page.locator("#vesselCatalog .collection-detail h3").innerText(),
      mobile ? /Survey barque/ : /Courier sloop/,
    );
    await context.close();
    console.log(
      `✓ ${prefix}: crew warnings, leave preview/action, deadline warning, upgrade suggestion, and legacy save migration`,
    );
  }

  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.addInitScript(() =>
    localStorage.setItem("gilded-archipelago-graphics", "low"),
  );
  await page.goto(`${server.url}/?automation=step&seed=gameplay-receipts`);
  await page.waitForFunction(() => window.parchmentAutomation?.version === 1);
  const receipt = await page.evaluate(() => {
    const api = window.parchmentAutomation;
    let s;
    for (let i = 0; i < 900; i++) {
      s = api.step(10);
      if (s.currentPort && s.game.voyageLedger.history.length) break;
    }
    api.setAutoplay(false);
    api.render();
    return s;
  });
  assert.ok(receipt.currentPort && receipt.game.voyageLedger.history.length);
  const result = await page.evaluate(() => {
    const api = window.parchmentAutomation;
    const before = api.snapshot().game.voyageLedger.history[0].entries;
    const buy = api.command({
      type: "trade",
      key: "grain",
      direction: "buy",
      quantity: 1,
    });
    const sell = api.command({
      type: "trade",
      key: "grain",
      direction: "sell",
      quantity: 1,
    });
    const rest = api.command({ type: "rest" });
    return {
      before,
      buy,
      sell,
      rest,
      after: api.snapshot().game.voyageLedger.history[0].entries,
    };
  });
  assert.equal(result.buy.ok, true);
  assert.equal(result.sell.ok, true);
  assert.equal(result.rest.ok, true);
  assert.equal(result.after.sales - result.before.sales, result.sell.total);
  assert.ok(result.after.cargoCost > result.before.cargoCost);
  assert.equal(result.after.leave - result.before.leave, result.rest.cost);
  await page.locator("#arrivalReceipt").click();
  assert.ok(
    await page
      .locator('#ledgerPanel .port-panel[data-tab="voyages"]')
      .isVisible(),
  );
  assert.match(await page.locator("#voyageLedger").innerText(), /Cargo sales/);
  assert.match(
    await page.locator("#voyageLedger").innerText(),
    /Realized profit/,
  );
  assert.match(await page.locator("#marketNotesLedger").innerText(), /Today/);
  await page.screenshot({ path: resolve(output, "voyage-receipt.png") });
  await page
    .locator("#voyageLedger")
    .screenshot({ path: resolve(output, "receipt-detail.png") });
  assert.deepEqual(errors, []);
  console.log(
    "✓ actual voyage: arrival receipt, post-arrival sale and rest accounting, remembered prices",
  );
} finally {
  await browser?.close();
  await server.close();
}
