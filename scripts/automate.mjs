import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

export async function serveGame() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
      const path = resolve(
        root,
        `.${pathname === "/" ? "/index.html" : pathname}`,
      );
      if (!path.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const bytes = await readFile(path);
      response.writeHead(200, {
        "Content-Type": mime[extname(path)] || "application/octet-stream",
      });
      response.end(bytes);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export async function runAutomation({
  seed = "parchment-automation",
  seconds = 180,
  mode = "step",
  speed = 1,
  record = false,
  headed = false,
  output = resolve(root, ".context/automation"),
  url,
  assertProgress = false,
} = {}) {
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 86400)
    throw new RangeError("seconds must be from 1 to 86400");
  if (!["step", "demo"].includes(mode) || (record && mode !== "demo"))
    throw new RangeError("Use step or demo mode; recording requires demo mode");
  if (!Number.isFinite(speed) || speed < 0.25 || speed > 32)
    throw new RangeError("speed must be from 0.25 to 32");
  if (!seed || seed.length > 128)
    throw new RangeError("seed must contain 1 to 128 characters");
  await mkdir(output, { recursive: true });
  let server;
  let browser;
  let context;
  let page;
  const report = {
    version: 1,
    seed,
    mode,
    speed,
    requestedSeconds: seconds,
    samples: [],
    errors: [],
  };
  let failure;
  try {
    if (!url) server = await serveGame();
    browser = await chromium.launch({ headless: !headed });
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: "no-preference",
      ...(record
        ? {
            recordVideo: {
              dir: resolve(output, "video"),
              size: { width: 1280, height: 800 },
            },
          }
        : {}),
    });
    await context.addInitScript(() => {
      localStorage.setItem("gilded-archipelago-graphics", "low");
    });
    page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("404"))
        report.errors.push(message.text());
    });
    const target = new URL(url || server.url);
    target.searchParams.set("automation", mode);
    target.searchParams.set("seed", seed);
    target.searchParams.set("speed", speed);
    await page.goto(target.href, { waitUntil: "load" });
    await page.waitForFunction(
      () => window.parchmentAutomation?.version === 1,
      null,
      { timeout: 60000 },
    );
    const sample = (snapshot) => {
      report.samples.push({
        tick: snapshot.ticks,
        seconds: snapshot.seconds,
        destination: snapshot.destination,
        metrics: snapshot.metrics,
        counts: snapshot.counts,
      });
      if (snapshot.error) throw new Error(snapshot.error);
      if (report.errors.length) throw new Error(report.errors.join("\n"));
    };
    let snapshot = await page.evaluate(() =>
      window.parchmentAutomation.snapshot(),
    );
    sample(snapshot);
    if (mode === "step") {
      const ticks = Math.ceil(seconds / snapshot.dt);
      while (snapshot.ticks < ticks) {
        snapshot = await page.evaluate(
          (frames) => window.parchmentAutomation.step(frames),
          Math.min(300, ticks - snapshot.ticks),
        );
        sample(snapshot);
      }
    } else {
      const deadline = Date.now() + ((seconds / speed) * 5 + 120) * 1000;
      while (snapshot.seconds < seconds) {
        if (Date.now() > deadline)
          throw new Error("Demo exceeded its wall-clock timeout");
        await new Promise((resolve) => setTimeout(resolve, 250));
        snapshot = await page.evaluate(() =>
          window.parchmentAutomation.snapshot(),
        );
        sample(snapshot);
      }
    }
    await page.evaluate(() => {
      window.parchmentAutomation.pause();
      window.parchmentAutomation.render();
    });
    report.final = snapshot;
    if (
      assertProgress &&
      (Object.keys(snapshot.metrics.visits).length < 2 ||
        snapshot.metrics.completedContracts < 1 ||
        !snapshot.counts.trade)
    )
      throw new Error(
        "Expected calls at two ports, a completed commission, and market trading",
      );
  } catch (error) {
    failure = error;
    report.errors.push(String(error));
  } finally {
    try {
      if (page && !page.isClosed()) {
        report.final = await page
          .evaluate(() => window.parchmentAutomation?.snapshot())
          .catch(() => report.final);
        await page.screenshot({ path: resolve(output, "final.png") });
      }
    } catch (error) {
      report.errors.push(`Screenshot failed: ${error}`);
    }
    await context?.close();
    if (record && page) report.video = await page.video()?.path();
    await browser?.close();
    await server?.close();
    report.ok = !failure && report.errors.length === 0;
    await writeFile(
      resolve(output, "report.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
  }
  if (!report.ok)
    throw new Error(
      `Automation failed. See ${resolve(output, "report.json")}: ${report.errors.join("; ")}`,
    );
  return report;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values } = parseArgs({
    options: {
      seed: { type: "string" },
      seconds: { type: "string" },
      mode: { type: "string" },
      speed: { type: "string" },
      output: { type: "string" },
      url: { type: "string" },
      record: { type: "boolean" },
      headed: { type: "boolean" },
      assert: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "npm run automate -- [--seed NAME] [--seconds 180] [--mode step|demo] [--speed 1] [--record] [--headed] [--output DIR] [--url URL] [--assert]\nOutputs report.json, final.png, and optional video. Times are simulation seconds.",
    );
  } else {
    try {
      const report = await runAutomation({
        ...values,
        seconds: Number(values.seconds ?? 180),
        speed: Number(values.speed ?? 1),
        mode: values.mode || (values.record ? "demo" : "step"),
        assertProgress: values.assert,
      });
      console.log(
        JSON.stringify(
          {
            ok: report.ok,
            seed: report.seed,
            metrics: report.final.metrics,
            output: values.output || ".context/automation",
            video: report.video,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
