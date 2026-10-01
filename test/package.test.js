import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);

test("single-file packaging embeds cinematic materials and escapes script endings", async () => {
  const directory = await mkdtemp(join(tmpdir(), "parchment-package-"));
  try {
    const bundle = join(directory, "game.js");
    const output = join(directory, "game.html");
    const paths = [
      "assets/map-opening/table-weathered.jpg",
      "assets/map-opening/parchment-weathered.jpg",
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
      assert.ok(
        html.includes(`data:image/jpeg;base64,${bytes.toString("base64")}`),
      );
      assert.ok(!html.includes(`./${path}`));
    }
    assert.ok(html.includes('const ending = "<\\/script>";'));
    assert.ok(!html.includes('src="./src/app.js'));
    assert.ok(!html.includes('href="./styles.css'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
