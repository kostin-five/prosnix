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

function deterministicFallback(
  profile: AnalyticsProfile,
  status: "insufficient" | "unavailable",
  now: Date,
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
  constructor(
    private readonly analytics: AnalyticsRepository,
    private readonly cache: CoachInsightRepository,
    private readonly gateway: CoachGateway | null,
  ) {}

  async getInsight(userId: string, now = new Date()): Promise<CoachInsightResponse> {
    const profile = await this.analytics.recompute(userId, now);
    const evidenceCount = profile.averageDelta.evidenceCount;
    if (evidenceCount < 3) {
      return deterministicFallback(profile, "insufficient", now);
    }
    const payload = coachPayload(profile);
    const evidenceFingerprint = fingerprint(payload);
    const cached = await this.cache.findByUserId(userId);
    if (cached?.evidenceFingerprint === evidenceFingerprint) {
      return {
        status: "ready",
        evidenceCount,
        cached: true,
        insight: {
          summary: cached.summary,
          nextExperiment: cached.nextExperiment,
          caveat: cached.caveat,
          confidence: profile.averageDelta.confidence,
          generatedAt: cached.generatedAt.toISOString(),
        },
      };
    }
    if (!this.gateway) {
      return deterministicFallback(profile, "unavailable", now);
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
        insight: {
          summary: saved.summary,
          nextExperiment: saved.nextExperiment,
          caveat: saved.caveat,
          confidence: profile.averageDelta.confidence,
          generatedAt: saved.generatedAt.toISOString(),
        },
      };
    } catch {
      return deterministicFallback(profile, "unavailable", now);
    }
  }
}
