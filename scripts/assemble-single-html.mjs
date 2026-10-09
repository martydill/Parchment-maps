import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const [, , bundlePath, outputPath] = process.argv;

if (!bundlePath || !outputPath) {
  throw new Error(
    "Usage: node scripts/assemble-single-html.mjs <bundle> <output>",
  );
}

const [html, css, javascript] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("styles.css", "utf8"),
  readFile(bundlePath, "utf8"),
]);

const stylesheetTag =
  /^(\s*)<link rel="stylesheet" href="\.\/styles\.css(?:\?[^"]*)?" \/>$/m;
const moduleTag =
  /^(\s*)<script type="module" src="\.\/src\/app\.js(?:\?[^"]*)?"><\/script>$/m;

if (!stylesheetTag.test(html) || !moduleTag.test(html)) {
  throw new Error("Could not find the expected stylesheet and module tags");
}

// Embed the cinematic/HUD materials and vessel paintings in the downloadable game.
let embeddedJavascript = javascript;
let embeddedCss = css;
for (const path of [
  "assets/map-opening/table-weathered.jpg",
  "assets/map-opening/parchment-weathered.jpg",
  "assets/vessels/cutter.png",
  "assets/vessels/sloop.png",
  "assets/vessels/carrack.png",
  "assets/vessels/barque.png",
  "assets/vessels/brig.png",
  "assets/vessels/dhow.png",
]) {
  const data = await readFile(path);
  const mime = path.endsWith(".png") ? "image/png" : "image/jpeg";
  const dataUrl = `data:${mime};base64,${data.toString("base64")}`;
  embeddedJavascript = embeddedJavascript.replaceAll(`./${path}`, dataUrl);
  embeddedCss = embeddedCss.replaceAll(`./${path}`, dataUrl);
}

const packagedHtml = html
  .replace(
    stylesheetTag,
    (_, indentation) =>
      `${indentation}<style>\n${embeddedCss.replaceAll("</style", "<\\/style")}\n${indentation}</style>`,
  )
  .replace(
    moduleTag,
    (_, indentation) =>
      `${indentation}<script>\n${embeddedJavascript.replaceAll("</script", "<\\/script")}\n${indentation}</script>`,
  );

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, packagedHtml);

console.log(`Created ${outputPath}`);
