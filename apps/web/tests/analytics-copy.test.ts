import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("текст персонального отчёта", () => {
  it("показывает понятный источник без технического подвала о числе сессий", () => {
    const packagePath = resolve(process.cwd(), "src/app/App.tsx");
    const source = readFileSync(
      existsSync(packagePath) ? packagePath : resolve(process.cwd(), "apps/web/src/app/App.tsx"),
      "utf8",
    );

    expect(source).not.toContain("подтверждённых сессий ·");
    expect(source).toContain('coach.insight.source === "provider"');
    expect(source).toContain('"AI-разбор"');
  });
});
