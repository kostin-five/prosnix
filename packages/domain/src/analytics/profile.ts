import type {
  AnalyticsProfile,
  CompletedSessionEvidence,
  Confidence,
  Metric,
} from "../model.js";

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
): AnalyticsProfile {
  const deltas = evidence.map(
    ({ baseline, postRating }) => postRating - baseline,
  );
  const answeredFollowUps = evidence.filter(
    ({ followUp }) => followUp !== null,
  );

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
      const value =
        group.length < 3
          ? null
          : mean(
              group.map(
                ({ baseline, postRating }) => postRating - baseline,
              ),
            );
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
      `${left.factorKey}:${left.groupKey}`.localeCompare(
        `${right.factorKey}:${right.groupKey}`,
      ),
    )
    .flatMap((group) => {
      const pairCount = Math.min(group.with.length, group.without.length);
      if (pairCount < 3) return [];
      const withMean = mean(
        group.with.map(
          ({ baseline, postRating }) => postRating - baseline,
        ),
      );
      const withoutMean = mean(
        group.without.map(
          ({ baseline, postRating }) => postRating - baseline,
        ),
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

  return {
    methodVersion: "analytics-v1",
    computedAt,
    averageDelta: metric("average-delta", mean(deltas), evidence),
    riseSuccess: metric(
      "rise-success",
      mean(
        answeredFollowUps.map(({ followUp }) =>
          followUp === "up" ? 1 : 0,
        ),
      ),
      answeredFollowUps,
    ),
    protocolEffects,
    factorEffects,
  };
}
