import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);

test("single-file packaging embeds cinematic/HUD materials and vessel art, and escapes script endings", async () => {
  const directory = await mkdtemp(join(tmpdir(), "parchment-package-"));
  try {
    const bundle = join(directory, "game.js");
    const output = join(directory, "game.html");
    const paths = [
      "assets/map-opening/table-weathered.jpg",
      "assets/map-opening/parchment-weathered.jpg",
      "assets/vessels/cutter.png",
      "assets/vessels/sloop.png",
      "assets/vessels/carrack.png",
      "assets/vessels/barque.png",
      "assets/vessels/brig.png",
      "assets/vessels/dhow.png",
    ];
    await writeFile(
      bundle,
      `const materials = ${JSON.stringify(paths.map((path) => `./${path}`))}; const ending = "</script>";`,
    );
    await run(process.execPath, [
      "scripts/assemble-single-html.mjs",
      bundle,
      output,
    ]);
    const html = await readFile(output, "utf8");
    for (const path of paths) {
      const bytes = await readFile(path);
      const mime = path.endsWith(".png") ? "image/png" : "image/jpeg";
      assert.ok(
        html.includes(`data:${mime};base64,${bytes.toString("base64")}`),
      );
      assert.ok(!html.includes(`./${path}`));
    }
    assert.ok(html.includes('const ending = "<\\/script>";'));
    const stylesheet = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    const paper = await readFile("assets/map-opening/parchment-weathered.jpg");
    assert.ok(
      stylesheet.includes(`data:image/jpeg;base64,${paper.toString("base64")}`),
    );
    assert.ok(!html.includes('src="./src/app.js'));
    assert.ok(!html.includes('href="./styles.css'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
