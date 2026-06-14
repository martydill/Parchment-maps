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

const stylesheetTag = '    <link rel="stylesheet" href="./styles.css" />';
const moduleTag = '    <script type="module" src="./src/app.js"></script>';

if (!html.includes(stylesheetTag) || !html.includes(moduleTag)) {
  throw new Error("Could not find the expected stylesheet and module tags");
}

const packagedHtml = html
  .replace(
    stylesheetTag,
    `    <style>\n${css.replaceAll("</style", "<\\/style")}\n    </style>`,
  )
  .replace(
    moduleTag,
    `    <script>\n${javascript.replaceAll("</script", "<\\/script")}\n    </script>`,
  );

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, packagedHtml);

console.log(`Created ${outputPath}`);
