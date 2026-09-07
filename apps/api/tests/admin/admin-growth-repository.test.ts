import { describe, expect, it, vi } from "vitest";

import { PostgresAdminGrowthRepository } from "@awc/db";

describe("admin growth repository", () => {
  it("не читает billing-таблицы при выключенной монетизации", async () => {
    const execute = vi.fn().mockResolvedValue([]);
    const repository = new PostgresAdminGrowthRepository({ execute } as never, {
      billingEnabled: false,
    });

    const summary = await repository.summarize(
      new Date("2026-09-01T00:00:00.000Z"),
      new Date("2026-09-08T00:00:00.000Z"),
    );

    expect(execute).toHaveBeenCalledTimes(13);
    expect(summary.billing).toEqual({ activeSubscriptions: 0, grossStars: 0 });
  });
});
