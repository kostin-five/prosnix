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
  return {
    methodVersion: profile.methodVersion,
    averageDelta: safeMetric(profile.averageDelta),
    riseSuccess: safeMetric(profile.riseSuccess),
    protocolEffects: profile.protocolEffects.map(safeMetric),
    factorEffects: profile.factorEffects.map(safeMetric),
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
  status: "insufficient" | "unavailable",
  now: Date,
  refreshAvailableAt: string,
  limitReached = false,
): CoachInsightResponse {
  const evidenceCount = profile.averageDelta.evidenceCount;
  const average = profile.averageDelta.value;
  const summary =
    average === null
      ? `Сохранено ${evidenceCount} из 3 пробуждений, необходимых для первого персонального вывода.`
      : `По ${evidenceCount} подтверждённым сессиям средний прирост бодрости — ${average >= 0 ? "+" : ""}${average.toFixed(1)} балла.`;
  return {
    status,
    evidenceCount,
    cached: false,
    source: "fallback",
    limitReached,
    refreshAvailableAt,
    insight: {
      summary,
      nextExperiment:
        evidenceCount < 3
          ? "Пройди следующий назначенный протокол полностью и оцени бодрость до и после."
          : "Продолжи следующий назначенный протокол: приложение сохранит результат и уточнит вывод.",
      caveat:
        status === "unavailable"
          ? "DeepSeek временно недоступен, поэтому показан воспроизводимый вывод без AI."
          : "Данных пока недостаточно для сравнения протоколов; это описание прогресса, а не закономерность.",
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

  async getInsight(userId: string, now = new Date()): Promise<CoachInsightResponse> {
    const existing = this.inFlightByUser.get(userId);
    if (existing) return existing;

    const request = this.computeInsight(userId, now);
    this.inFlightByUser.set(userId, request);
    try {
      return await request;
    } finally {
      if (this.inFlightByUser.get(userId) === request) this.inFlightByUser.delete(userId);
    }
  }

  private async computeInsight(userId: string, now: Date): Promise<CoachInsightResponse> {
    const timezone = safeTimezone((await this.cache.findTimezoneByUserId?.(userId)) ?? "UTC");
    const refreshAvailableAt = nextLocalMidnight(now, timezone);
    const profile = await this.analytics.recompute(userId, now);
    const evidenceCount = profile.averageDelta.evidenceCount;
    if (evidenceCount < 3) {
      return deterministicFallback(profile, "insufficient", now, refreshAvailableAt);
    }
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
      return {
        status: cached.model === "deterministic-fallback" ? "unavailable" : "ready",
        evidenceCount,
        cached: true,
        source: cached.model === "deterministic-fallback" ? "fallback" : "cache",
        limitReached: true,
        refreshAvailableAt,
        insight: {
          summary: cached.summary,
          nextExperiment: cached.nextExperiment,
          caveat: `${cached.caveat} Новые данные будут учтены после следующего доступного обновления.`,
          confidence: profile.averageDelta.confidence,
          generatedAt: cached.generatedAt.toISOString(),
        },
      };
    }
    if (!this.gateway) {
      return deterministicFallback(profile, "unavailable", now, refreshAvailableAt);
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
      const fallback = deterministicFallback(profile, "unavailable", now, refreshAvailableAt, true);
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
