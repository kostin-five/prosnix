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
      return { status: "insufficient", evidenceCount, cached: false, insight: null };
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
      return { status: "unavailable", evidenceCount, cached: false, insight: null };
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
      return { status: "unavailable", evidenceCount, cached: false, insight: null };
    }
  }
}
