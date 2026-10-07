import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const failures = [];
async function check(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", "dist-demo", "migrations"].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await check(path);
    else if (/\.(?:ts|tsx|js|mjs|css)$/.test(path)) {
      const content = await readFile(path, "utf8");
      const lines = content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
      if (lines > 1000) failures.push(`${path}: ${lines}`);
    }
  }
}
for (const dir of ["apps", "packages", "scripts", "tests"]) await check(dir);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Исходные модули не превышают 1000 строк; generated migrations исключены.");
