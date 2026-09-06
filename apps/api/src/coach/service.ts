import { createHash } from "node:crypto";

import type { CoachInsightResponse } from "@awc/contracts";
import type {
  AnalyticsProfile,
  AnalyticsRepository,
  CoachInsightRepository,
  Metric,
} from "@awc/domain";
import type { CoachAggregateMetric, CoachAggregatePayload, CoachGateway } from "./deepseek.js";

function safeMetric(metric: Metric): CoachAggregateMetric {
  return {
    key: metric.key,
    value: metric.value,
    evidenceCount: metric.evidenceCount,
    confidence: metric.confidence,
  };
}

export function coachPayload(profile: AnalyticsProfile): CoachAggregatePayload {
  const points = profile.dailyTrend ?? [];
  const values = points.map(({ averageDelta }) => averageDelta);
  const center =
    values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
  const variability =
    center === null
      ? null
      : Math.round(
          (values.reduce((sum, value) => sum + Math.abs(value - center), 0) / values.length) * 10,
        ) / 10;
  const change = values.length >= 2 ? values.at(-1)! - values[0]! : null;
  const recentDirection =
    change === null
      ? "unknown"
      : change > 0.5
        ? "improving"
        : change < -0.5
          ? "declining"
          : "stable";
  return {
    methodVersion: profile.methodVersion,
    averageDelta: safeMetric(profile.averageDelta),
    riseSuccess: safeMetric(profile.riseSuccess),
    protocolEffects: profile.protocolEffects.map(safeMetric),
    factorEffects: profile.factorEffects.map(safeMetric),
    trendSignals: {
      observedDays: points.length,
      recentDirection,
      variability,
    },
  };
}

function fingerprint(payload: CoachAggregatePayload): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function safeTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "UTC";
  }
}

function localDateKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: safeTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function nextLocalMidnight(date: Date, timezone: string): string {
  const zone = safeTimezone(timezone);
  const local = localDateKey(date, zone).split("-").map(Number);
  const target = new Date(Date.UTC(local[0]!, local[1]! - 1, local[2]! + 1));
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  let guess = targetUtc;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let index = 0; index < 3; index += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(guess))
        .filter(({ type }) => type !== "literal")
        .map(({ type, value }) => [type, Number(value)]),
    );
    const represented = Date.UTC(
      parts.year!,
      parts.month! - 1,
      parts.day!,
      parts.hour!,
      parts.minute!,
      parts.second!,
    );
    guess -= represented - targetUtc;
  }
  return new Date(guess).toISOString();
}

function deterministicFallback(
  profile: AnalyticsProfile,
  now: Date,
  refreshAvailableAt: string,
  limitReached = false,
): CoachInsightResponse {
  const evidenceCount = profile.averageDelta.evidenceCount;
  const signals = coachPayload(profile).trendSignals;
  const rise = profile.riseSuccess.value;
  const stability =
    rise === null
      ? "Проверок через 15 минут пока недостаточно, чтобы оценить устойчивость подъёма."
      : `Через 15 минут подъём сохранялся в ${Math.round(rise * 100)}% отвеченных проверок.`;
  const direction =
    signals.recentDirection === "improving"
      ? "Последние дневные результаты улучшаются."
      : signals.recentDirection === "declining"
        ? "Последние дневные результаты слабее первых; стоит проверить условия пробуждения."
        : signals.recentDirection === "stable"
          ? "Дневные результаты пока остаются примерно на одном уровне."
          : "Для оценки динамики нужны результаты хотя бы за два дня.";
  const spread =
    signals.variability === null
      ? ""
      : signals.variability <= 0.75
        ? " Результат между днями достаточно ровный."
        : ` Разброс между днями заметный (${signals.variability.toFixed(1)} балла), поэтому вывод пока нестабилен.`;
  return {
    status: "unavailable",
    evidenceCount,
    cached: false,
    source: "fallback",
    limitReached,
    refreshAvailableAt,
    insight: {
      summary: `${stability} ${direction}${spread}`,
      nextExperiment:
        "В следующей сессии пройди назначенный протокол полностью и ответь на проверку через 15 минут. Так мы сравним не только мгновенную бодрость, но и устойчивость результата.",
      caveat: `Базовый отчёт основан на ${evidenceCount} ${evidenceCount === 1 ? "сессии" : "сессиях"}. Это предварительные наблюдения, а не доказанная причина или медицинский вывод.`,
      confidence: profile.averageDelta.confidence,
      generatedAt: now.toISOString(),
    },
  };
}

export class CoachService {
  private readonly inFlightByUser = new Map<string, Promise<CoachInsightResponse>>();

  constructor(
    private readonly analytics: AnalyticsRepository,
    private readonly cache: CoachInsightRepository,
    private readonly gateway: CoachGateway | null,
  ) {}

  async getInsight(
    userId: string,
    now = new Date(),
    options: { confirmEarly?: boolean } = {},
  ): Promise<CoachInsightResponse> {
    const inFlightKey = `${userId}:${options.confirmEarly === true ? "confirmed" : "standard"}`;
    const existing = this.inFlightByUser.get(inFlightKey);
    if (existing) return existing;

    const request = this.computeInsight(userId, now, options.confirmEarly === true);
    this.inFlightByUser.set(inFlightKey, request);
    try {
      return await request;
    } finally {
      if (this.inFlightByUser.get(inFlightKey) === request) this.inFlightByUser.delete(inFlightKey);
    }
  }

  private async computeInsight(
    userId: string,
    now: Date,
    confirmEarly: boolean,
  ): Promise<CoachInsightResponse> {
    const timezone = safeTimezone((await this.cache.findTimezoneByUserId?.(userId)) ?? "UTC");
    const refreshAvailableAt = nextLocalMidnight(now, timezone);
    const profile = await this.analytics.recompute(userId, now);
    const evidenceCount = profile.averageDelta.evidenceCount;
    const payload = coachPayload(profile);
    const evidenceFingerprint = fingerprint(payload);
    const cached = await this.cache.findByUserId(userId);
    const generatedToday =
      cached !== null && localDateKey(cached.generatedAt, timezone) === localDateKey(now, timezone);
    if (cached?.evidenceFingerprint === evidenceFingerprint) {
      return {
        status: cached.model === "deterministic-fallback" ? "unavailable" : "ready",
        evidenceCount,
        cached: true,
        source: cached.model === "deterministic-fallback" ? "fallback" : "cache",
        limitReached: generatedToday,
        refreshAvailableAt,
        insight: {
          summary: cached.summary,
          nextExperiment: cached.nextExperiment,
          caveat: cached.caveat,
          confidence: profile.averageDelta.confidence,
          generatedAt: cached.generatedAt.toISOString(),
        },
      };
    }
    if (cached && generatedToday) {
      return deterministicFallback(profile, now, refreshAvailableAt, true);
    }
    if (evidenceCount < 3 && !confirmEarly) {
      return {
        status: "confirmation_required",
        evidenceCount,
        cached: false,
        source: "fallback",
        limitReached: false,
        refreshAvailableAt,
        insight: null,
      };
    }
    if (!this.gateway) {
      return deterministicFallback(profile, now, refreshAvailableAt);
    }
    try {
      const generated = await this.gateway.generate(payload);
      const saved = await this.cache.save(
        {
          userId,
          evidenceFingerprint,
          summary: generated.summary,
          nextExperiment: generated.nextExperiment,
          caveat: generated.caveat,
          model: generated.model,
          evidenceCount,
          generatedAt: now,
        },
        now,
      );
      return {
        status: "ready",
        evidenceCount,
        cached: false,
        source: "provider",
        limitReached: true,
        refreshAvailableAt,
        insight: {
          summary: saved.summary,
          nextExperiment: saved.nextExperiment,
          caveat: saved.caveat,
          confidence: profile.averageDelta.confidence,
          generatedAt: saved.generatedAt.toISOString(),
        },
      };
    } catch {
      const fallback = deterministicFallback(profile, now, refreshAvailableAt, true);
      if (fallback.insight) {
        await this.cache.save(
          {
            userId,
            evidenceFingerprint,
            summary: fallback.insight.summary,
            nextExperiment: fallback.insight.nextExperiment,
            caveat: fallback.insight.caveat,
            model: "deterministic-fallback",
            evidenceCount,
            generatedAt: now,
          },
          now,
        );
      }
      return fallback;
    }
  }
}
