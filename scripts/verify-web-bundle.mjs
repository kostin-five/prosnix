import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const webDist = resolve(process.cwd(), "apps/web/dist");
const html = await readFile(resolve(webDist, "index.html"), "utf8");
const entryMatch = html.match(/<script[^>]+src="\/assets\/([^"]+\.js)"/);

if (!entryMatch?.[1]) {
  throw new Error("Не удалось определить entry JavaScript в apps/web/dist/index.html");
}

const entryFile = entryMatch[1];
const { size } = await stat(resolve(webDist, "assets", entryFile));
const budgetBytes = 250 * 1024;

if (size > budgetBytes) {
  throw new Error(
    `Начальный web bundle ${entryFile} занимает ${(size / 1024).toFixed(1)} КБ — лимит 250 КБ превышен`,
  );
}

console.log(
  `Начальный web bundle: ${(size / 1024).toFixed(1)} КБ из допустимых 250 КБ (${entryFile}).`,
);
