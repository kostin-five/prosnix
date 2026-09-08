import type { AnalyticsProfileResponse } from "../../shared/api/client.js";

const CONFIDENCE = {
  insufficient: "Недостаточно данных",
  low: "Низкая уверенность",
  medium: "Средняя уверенность",
  high: "Высокая уверенность",
} as const;

function factorLabel(key: string) {
  return key.split(":")[1] === "movement" ? "Движение" : "Фактор протокола";
}

export function WakeProfileSummary({
  profile,
  evidenceCount,
}: {
  profile: AnalyticsProfileResponse;
  evidenceCount: number;
}) {
  const progress = profile.comparisonProgress ?? [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-secondary/60 p-3">
          <p className="text-xs text-muted-foreground">Типичный прирост</p>
          <p className="mt-1 text-lg font-black">
            {profile.averageDelta.value === null
              ? "—"
              : `${profile.averageDelta.value >= 0 ? "+" : ""}${profile.averageDelta.value.toFixed(1)}`}
          </p>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3">
          <p className="text-xs text-muted-foreground">Подъём сохранился</p>
          <p className="mt-1 text-lg font-black">
            {profile.riseSuccess.value === null
              ? "—"
              : `${Math.round(profile.riseSuccess.value * 100)}%`}
          </p>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {CONFIDENCE[profile.averageDelta.confidence]} · {evidenceCount} завершённых сессий. Это твои
        наблюдения, а не доказанная причина или медицинский вывод.
      </p>
      {profile.factorEffects.map((metric) => {
        const value = metric.value ?? 0;
        return (
          <div key={metric.key} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{factorLabel(metric.key)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {CONFIDENCE[metric.confidence]} · {metric.evidenceCount} парных сравнения
                </p>
              </div>
              <span className={value >= 0 ? "text-green-400" : "text-red-400"}>
                {value >= 0 ? "+" : ""}
                {value.toFixed(1)}
              </span>
            </div>
          </div>
        );
      })}
      {progress.length > 0 ? (
        progress
          .filter(({ status }) => status === "collecting")
          .map((item) => (
            <div key={item.key} className="rounded-xl bg-secondary/60 p-3">
              <p className="text-sm font-medium">{factorLabel(item.key)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Сопоставимых пар: {item.pairCount}/{item.targetPairs}. С движением {item.withCount},
                без — {item.withoutCount}.
              </p>
            </div>
          ))
      ) : (
        <p className="rounded-xl bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">
          Отдельных сопоставимых пар пока нет: ограничения или разные условия могли изменить состав
          протоколов. Общий профиль выше уже рассчитан по всем завершённым сессиям.
        </p>
      )}
    </div>
  );
}

export default WakeProfileSummary;
