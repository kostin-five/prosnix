import type {
  AnalyticsProfile,
  CompletedSessionEvidence,
  Confidence,
  DailyWakeTrendPoint,
  Metric,
  TaskCategory,
} from "../model.js";

export function isFactorComparisonPreserved(input: {
  factorKey: string;
  level: "with" | "without";
  actualCategories: readonly TaskCategory[];
  hasSubstitution: boolean;
}): boolean {
  if (!input.hasSubstitution) return true;
  if (
    input.factorKey !== "cognitive" &&
    input.factorKey !== "movement" &&
    input.factorKey !== "behavioral" &&
    input.factorKey !== "environment"
  ) {
    return false;
  }
  return input.actualCategories.includes(input.factorKey) === (input.level === "with");
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const MIN_COMPARABLE_SEQUENCE_REPEATS = 2;

function sequenceMetricKey(
  sequenceKey: string,
  wakeContext: CompletedSessionEvidence["wakeContext"],
  durationMinutes: CompletedSessionEvidence["durationMinutes"],
): string {
  return `sequence:${sequenceKey}|context:${wakeContext ?? "unknown"}|budget:${durationMinutes ?? "unknown"}m`;
}

export function confidenceFor(evidenceCount: number): Confidence {
  if (evidenceCount < 3) return "insufficient";
  if (evidenceCount < 6) return "low";
  if (evidenceCount < 12) return "medium";
  return "high";
}

function metric(
  key: string,
  value: number | null,
  evidence: readonly CompletedSessionEvidence[],
  confidenceCount = evidence.length,
): Metric {
  return {
    key,
    value,
    evidenceCount: confidenceCount,
    evidenceIds: evidence.map(({ sessionId }) => sessionId),
    confidence: confidenceFor(confidenceCount),
  };
}

export function computeAnalyticsProfile(
  evidence: readonly CompletedSessionEvidence[],
  computedAt = "1970-01-01T00:00:00.000Z",
  timezone = "UTC",
): AnalyticsProfile {
  const deltas = evidence.map(({ baseline, postRating }) => postRating - baseline);
  const answeredFollowUps = evidence.filter(({ followUp }) => followUp !== null);

  const protocolGroups = new Map<string, CompletedSessionEvidence[]>();
  for (const item of evidence) {
    const key = `${item.protocolKey}@${item.protocolVersion}`;
    const group = protocolGroups.get(key) ?? [];
    group.push(item);
    protocolGroups.set(key, group);
  }
  const protocolEffects = [...protocolGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, group]) => {
      const value = mean(group.map(({ baseline, postRating }) => postRating - baseline));
      return metric(`protocol:${key}`, value, group);
    });

  const comparisonGroups = new Map<
    string,
    {
      factorKey: string;
      groupKey: string;
      with: CompletedSessionEvidence[];
      without: CompletedSessionEvidence[];
    }
  >();
  for (const item of evidence) {
    if (!item.comparison) continue;
    const { factorKey, groupKey, level } = item.comparison;
    const key = `${factorKey}:${groupKey}`;
    const group = comparisonGroups.get(key) ?? {
      factorKey,
      groupKey,
      with: [],
      without: [],
    };
    group[level].push(item);
    comparisonGroups.set(key, group);
  }
  const factorEffects = [...comparisonGroups.values()]
    .sort((left, right) =>
      `${left.factorKey}:${left.groupKey}`.localeCompare(`${right.factorKey}:${right.groupKey}`),
    )
    .flatMap((group) => {
      const pairCount = Math.min(group.with.length, group.without.length);
      if (pairCount < 3) return [];
      const withMean = mean(group.with.map(({ baseline, postRating }) => postRating - baseline));
      const withoutMean = mean(
        group.without.map(({ baseline, postRating }) => postRating - baseline),
      );
      if (withMean === null || withoutMean === null) return [];
      return [
        metric(
          `factor:${group.factorKey}:${group.groupKey}`,
          withMean - withoutMean,
          [...group.with, ...group.without],
          pairCount,
        ),
      ];
    });
  const comparisonProgress = [...comparisonGroups.values()]
    .sort((left, right) =>
      `${left.factorKey}:${left.groupKey}`.localeCompare(`${right.factorKey}:${right.groupKey}`),
    )
    .map((group) => {
      const pairCount = Math.min(group.with.length, group.without.length);
      return {
        key: `factor:${group.factorKey}:${group.groupKey}`,
        factorKey: group.factorKey,
        groupKey: group.groupKey,
        withCount: group.with.length,
        withoutCount: group.without.length,
        pairCount,
        targetPairs: 3 as const,
        status: pairCount >= 3 ? ("ready" as const) : ("collecting" as const),
      };
    });

  const sequenceGroups = new Map<
    string,
    {
      sequenceKey: string;
      wakeContext: CompletedSessionEvidence["wakeContext"];
      durationMinutes: CompletedSessionEvidence["durationMinutes"];
      evidence: CompletedSessionEvidence[];
    }
  >();
  for (const item of evidence) {
    if (!item.sequenceKey) continue;
    const scopeKey = `${item.sequenceKey}\u001f${item.wakeContext ?? "unknown"}\u001f${item.durationMinutes ?? "unknown"}`;
    const group = sequenceGroups.get(scopeKey) ?? {
      sequenceKey: item.sequenceKey,
      wakeContext: item.wakeContext,
      durationMinutes: item.durationMinutes,
      evidence: [],
    };
    group.evidence.push(item);
    sequenceGroups.set(scopeKey, group);
  }
  const sequenceEffects = [...sequenceGroups.values()]
    .filter(({ evidence: group }) => group.length >= MIN_COMPARABLE_SEQUENCE_REPEATS)
    .sort((left, right) =>
      sequenceMetricKey(left.sequenceKey, left.wakeContext, left.durationMinutes).localeCompare(
        sequenceMetricKey(right.sequenceKey, right.wakeContext, right.durationMinutes),
      ),
    )
    .map(({ sequenceKey, wakeContext, durationMinutes, evidence: group }) =>
      metric(
        sequenceMetricKey(sequenceKey, wakeContext, durationMinutes),
        mean(group.map(({ baseline, postRating }) => postRating - baseline)),
        group,
      ),
    );

  let dateFormatter: Intl.DateTimeFormat;
  try {
    dateFormatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    dateFormatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }
  const dailyGroups = new Map<string, CompletedSessionEvidence[]>();
  for (const item of evidence) {
    if (!item.completedAt) continue;
    const completed = new Date(item.completedAt);
    if (Number.isNaN(completed.getTime())) continue;
    const localDate = dateFormatter.format(completed);
    const group = dailyGroups.get(localDate) ?? [];
    group.push(item);
    dailyGroups.set(localDate, group);
  }
  const dailyTrend: DailyWakeTrendPoint[] = [...dailyGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-30)
    .map(([localDate, group]) => ({
      localDate,
      averageDelta: mean(group.map(({ baseline, postRating }) => postRating - baseline)) ?? 0,
      evidenceCount: group.length,
      sessionIds: group.map(({ sessionId }) => sessionId),
    }));

  return {
    methodVersion: "analytics-v2",
    computedAt,
    averageDelta: metric("average-delta", mean(deltas), evidence),
    riseSuccess: metric(
      "rise-success",
      mean(answeredFollowUps.map(({ followUp }) => (followUp === "up" ? 1 : 0))),
      answeredFollowUps,
    ),
    protocolEffects,
    factorEffects,
    comparisonProgress,
    sequenceEffects,
    dailyTrend,
  };
}
