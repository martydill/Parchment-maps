import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { serveGame } from "./automate.mjs";

const output = resolve(".context/harbor-ui-tests");
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
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      localStorage.setItem("gilded-archipelago-graphics", "low");
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    const activate = async (locator) => {
      if (mobile) await locator.tap();
      else {
        await locator.focus();
        await locator.press("Enter");
      }
    };
    const openTab = (tab) =>
      activate(page.locator(`#portPanel .port-tab[data-tab="${tab}"]`));
    const boot = async () => {
      await page.goto(`${server.url}/?automation=step&seed=baseline`);
      await page.waitForFunction(
        () => window.parchmentAutomation?.version === 1,
      );
      await page.evaluate(() => {
        const api = window.parchmentAutomation;
        api.setAutoplay(false);
        api.command({ type: "dock" });
      });
      await openTab("trade");
    };
    const settle = () =>
      page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
    const snapshot = () =>
      page.evaluate(() => window.parchmentAutomation.snapshot());
    const accept = page.getByRole("button", {
      name: "Accept Commission",
      exact: true,
    });

    await boot();
    const board = page.locator("#contractBoard");
    await activate(
      board.getByRole("button", { name: /Catalogue rare ecosystems/ }),
    );
    await settle();
    if (mobile) {
      assert.ok(
        await accept.evaluate((button) => {
          const rect = button.getBoundingClientRect();
          const body = document
            .querySelector("#portPanel .port-body")
            .getBoundingClientRect();
          return rect.top >= body.top && rect.bottom <= body.bottom;
        }),
        "Selecting a commission must reveal its acceptance action above the departure bar",
      );
    }
    const preview = await board.innerText();
    assert.match(preview, /Catalogue rare ecosystems for naturalists/);
    assert.match(preview, /Share with faction/);
    assert.match(preview, /0\/1 sites recorded/);
    await page.screenshot({
      path: resolve(output, `${mobile ? "phone" : "desktop"}-survey.png`),
    });
    await activate(accept);
    assert.match(await page.locator("#message").innerText(), /requirements/);
    const objective = await page.locator("#courseCard").innerText();
    assert.match(objective, /Catalogue rare ecosystems/);
    assert.match(objective, /Share with faction/);
    assert.doesNotMatch(objective, /null|undefined/);
    assert.equal((await snapshot()).game.navigation.destination, null);
    await activate(page.locator("#closePort"));
    await activate(page.locator("#courseCard"));
    assert.ok(
      await page
        .locator('#ledgerPanel .port-panel[data-tab="contracts"]')
        .isVisible(),
    );
    assert.match(
      await page.locator("#activeContractsLedger").innerText(),
      /0\/1 sites recorded/,
    );

    await boot();
    await activate(
      board.getByRole("button", { name: /Cargo commission to Mirelune/ }),
    );
    await activate(accept);
    const course = (await snapshot()).game.navigation.destination;
    assert.equal(course, "Mirelune");
    assert.equal(
      await page.locator("#departureDestination").inputValue(),
      course,
    );
    assert.match(await page.locator("#departureReadiness").innerText(), /days/);
    await activate(
      board.getByRole("button", { name: /Urgent dispatch to Drazh Ovek/ }),
    );
    await activate(accept);
    assert.equal((await snapshot()).game.navigation.destination, course);

    await openTab("market");
    if (mobile) {
      const catalog = await page.locator(".exchange-catalog").boundingBox();
      const order = await page.locator("#marketOrder").boundingBox();
      assert.ok(catalog.y < order.y, "Browse goods before the order form");
    }
    await activate(
      page.getByRole("button", { name: "Preview buy Ship Timber" }),
    );
    await page.locator("#orderQuantity").fill("2");
    await activate(page.locator("#confirmOrder"));
    assert.equal((await snapshot()).game.cargo.timber, 2);
    await page.screenshot({
      path: resolve(output, `${mobile ? "phone" : "desktop"}-market.png`),
    });
    await context.close();
    console.log(
      `✓ ${mobile ? "phone touch" : "desktop keyboard"}: survey instructions, commission courses, and market purchase`,
    );
  }
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem("gilded-archipelago-graphics", "low"),
    );
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(`${server.url}/?automation=step&seed=baseline`);
    await page.waitForFunction(() => window.parchmentAutomation?.version === 1);
    await page.evaluate(() => {
      window.parchmentAutomation.setAutoplay(false);
      window.parchmentAutomation.command({ type: "dock" });
    });
    await page.locator('#portPanel .port-tab[data-tab="trade"]').tap();
    await page
      .locator("#contractBoard")
      .getByRole("button", { name: /Cargo commission to Mirelune/ })
      .tap();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const accept = page.getByRole("button", {
      name: "Accept Commission",
      exact: true,
    });
    assert.ok(
      await accept.evaluate((button) => {
        const r = button.getBoundingClientRect();
        const body = document
          .querySelector("#portPanel .port-body")
          .getBoundingClientRect();
        return (
          r.top >= body.top - 1 &&
          r.bottom <= body.bottom + 1 &&
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) ===
            button
        );
      }),
      `Commission acceptance must be reachable at ${viewport.width}×${viewport.height}`,
    );
    await page.screenshot({
      path: resolve(
        output,
        `commission-${viewport.width}x${viewport.height}.png`,
      ),
    });
    await accept.tap();
    assert.equal(
      await page.evaluate(
        () => window.parchmentAutomation.snapshot().game.activeContracts.length,
      ),
      1,
    );
    await context.close();
    console.log(
      `✓ ${viewport.width}×${viewport.height}: selected commission action remains reachable`,
    );
  }
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await server.close();
}
