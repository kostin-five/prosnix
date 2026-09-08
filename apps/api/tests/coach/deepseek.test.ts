import { describe, expect, it, vi } from "vitest";

import { DeepSeekCoachGateway, type CoachAggregatePayload } from "../../src/coach/deepseek.js";

const payload: CoachAggregatePayload = {
  methodVersion: "analytics-v1",
  averageDelta: { key: "average-delta", value: 3, evidenceCount: 4, confidence: "low" },
  riseSuccess: { key: "rise-success", value: 0.75, evidenceCount: 4, confidence: "low" },
  protocolEffects: [],
  factorEffects: [],
  sequenceEffects: [],
  trendSignals: { observedDays: 3, recentDirection: "improving", variability: 0.8 },
};

describe("DeepSeek coach gateway", () => {
  it("sends only aggregate data and validates JSON output", async () => {
    let request: RequestInit | undefined;
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      request = init;
      return Response.json({
        model: "deepseek-v4-flash",
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Подъём удерживается чаще, а дневные результаты становятся стабильнее.",
                nextExperiment: "Повтори текущий протокол ещё два раза и ответь через 15 минут.",
                caveat: "Вывод основан на четырёх сессиях.",
              }),
            },
          },
        ],
      });
    }) as unknown as typeof fetch;
    const gateway = new DeepSeekCoachGateway({
      apiKey: "secret",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      timeoutMs: 1_000,
      fetcher,
    });

    await expect(gateway.generate(payload)).resolves.toMatchObject({
      summary: "Подъём удерживается чаще, а дневные результаты становятся стабильнее.",
      model: "deepseek-v4-flash",
    });
    const sent = JSON.parse(String(request?.body)) as { messages: Array<{ content: string }> };
    expect(JSON.stringify(sent)).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27}/i);
    expect(sent.messages[1]?.content).toContain("average-delta");
    expect(sent.messages[1]?.content).toContain("recentDirection");
    expect(sent.messages[0]?.content).toContain("не пересказывай видимые числа");
    expect(sent.messages[0]?.content).toContain("самый сильный или самый слабый сигнал");
    expect(sent.messages[0]?.content).toContain("не ограничивайся очевидной инструкцией");
  });

  it("rejects untrusted fields", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Текст",
                nextExperiment: "Эксперимент",
                caveat: "Ограничение",
                html: "<script />",
              }),
            },
          },
        ],
      }),
    ) as unknown as typeof fetch;
    const gateway = new DeepSeekCoachGateway({
      apiKey: "secret",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      timeoutMs: 1_000,
      fetcher,
    });
    await expect(gateway.generate(payload)).rejects.toThrow("unsupported fields");
  });

  it("rejects a report that spends its main conclusion on the visible average", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Средний прирост бодрости составил три балла.",
                nextExperiment: "Повтори протокол.",
                caveat: "Выборка небольшая.",
              }),
            },
          },
        ],
      }),
    ) as unknown as typeof fetch;
    const gateway = new DeepSeekCoachGateway({
      apiKey: "secret",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      timeoutMs: 1_000,
      fetcher,
    });
    await expect(gateway.generate(payload)).rejects.toThrow("already visible average");
  });
});
