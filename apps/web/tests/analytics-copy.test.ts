import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("текст персонального отчёта", () => {
  it("не показывает отдельную техническую подпись источника", () => {
    const packagePath = resolve(process.cwd(), "src/app/App.tsx");
    const source = readFileSync(
      existsSync(packagePath) ? packagePath : resolve(process.cwd(), "apps/web/src/app/App.tsx"),
      "utf8",
    );

    expect(source).not.toContain("подтверждённых сессий ·");
    expect(source).not.toContain('coach.insight.source === "provider"');
  });
});
