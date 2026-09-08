import type {
  AnalyticsProfileResponse,
  SessionHistoryItemResponse,
} from "../../shared/api/client.js";

function factorLabel(key: string) {
  return key === "movement" || key.split(":")[1] === "movement" ? "движение" : "этот фактор";
}

function gainMeaning(value: number | null) {
  if (value === null) return "Пока недостаточно завершённых сессий, чтобы увидеть общий эффект.";
  if (value >= 2) return "После протокола бодрость обычно становится заметно выше.";
  if (value >= 0.5) return "После протокола обычно появляется небольшой подъём бодрости.";
  if (value > -0.5) return "Мгновенный эффект пока нестабилен и близок к исходному состоянию.";
  return "После протокола бодрость пока чаще ниже исходной — состав заданий стоит пересмотреть.";
}

function riseMeaning(value: number | null) {
  if (value === null) return "Ответов через 15 минут пока мало для оценки устойчивости.";
  if (value >= 0.75) return "После большинства проверок подъём сохраняется и через 15 минут.";
  if (value >= 0.5) return "Примерно в половине проверок подъём сохраняется через 15 минут.";
  return "Через 15 минут эффект часто ослабевает — важна дальнейшая проверка.";
}

function observationMaturity(confidence: AnalyticsProfileResponse["averageDelta"]["confidence"]) {
  if (confidence === "high" || confidence === "medium") {
    return "Данных уже достаточно для рабочего предположения.";
  }
  if (confidence === "low") return "Вывод пока предварительный: полезны новые повторы.";
  return "Пока мало повторов для устойчивого вывода.";
}

function RecentEffectChart({ sessions }: { sessions: SessionHistoryItemResponse[] }) {
  const points = sessions
    .slice(0, 7)
    .reverse()
    .map((session) => ({ id: session.id, value: session.postRating - session.baseline }));
  if (points.length < 2) return null;

  const width = 300;
  const height = 112;
  const padX = 16;
  const padY = 14;
  const values = points.map(({ value }) => value);
  const min = Math.min(-1, ...values);
  const max = Math.max(1, ...values);
  const x = (index: number) => padX + (index * (width - padX * 2)) / Math.max(1, points.length - 1);
  const y = (value: number) =>
    padY + ((max - value) * (height - padY * 2)) / Math.max(1, max - min);

  return (
    <div className="rounded-xl bg-secondary/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Динамика последних пробуждений</p>
        <span className="text-[11px] text-muted-foreground">эффект после протокола</span>
      </div>
      <svg
        aria-label={`Эффект ${points.length} последних пробуждений`}
        className="h-28 w-full"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
      >
        <line
          x1={padX}
          x2={width - padX}
          y1={y(0)}
          y2={y(0)}
          stroke="currentColor"
          strokeDasharray="4 4"
          className="text-border"
        />
        <polyline
          points={points.map(({ value }, index) => `${x(index)},${y(value)}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        />
        {points.map(({ id, value }, index) => (
          <g key={id}>
            <circle
              cx={x(index)}
              cy={y(value)}
              r="4"
              fill="currentColor"
              className={value < 0 ? "text-red-400" : "text-primary"}
            />
            <text
              x={x(index)}
              y={Math.max(10, y(value) - 8)}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {value > 0 ? "+" : ""}
              {value}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Каждая точка — разница между оценкой до и сразу после одной сессии. Линия показывает
        направление, но сама по себе не доказывает причину изменений.
      </p>
    </div>
  );
}

export function WakeProfileSummary({
  profile,
  evidenceCount,
  recentSessions = [],
}: {
  profile: AnalyticsProfileResponse;
  evidenceCount: number;
  recentSessions?: SessionHistoryItemResponse[];
}) {
  const progressByFactor = new Map<
    string,
    NonNullable<AnalyticsProfileResponse["comparisonProgress"]>[number]
  >();
  for (const item of profile.comparisonProgress ?? []) {
    if (item.status !== "collecting") continue;
    const current = progressByFactor.get(item.factorKey);
    if (!current || item.pairCount > current.pairCount) progressByFactor.set(item.factorKey, item);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-secondary/60 p-3">
        <p className="text-sm font-semibold">Как проходит пробуждение</p>
        <p className="mt-1 text-sm leading-relaxed">{gainMeaning(profile.averageDelta.value)}</p>
        <p className="mt-2 text-sm leading-relaxed">{riseMeaning(profile.riseSuccess.value)}</p>
      </div>

      <RecentEffectChart sessions={recentSessions} />

      <p className="text-xs leading-relaxed text-muted-foreground">
        {observationMaturity(profile.averageDelta.confidence)} Основано на {evidenceCount}{" "}
        завершённых сессиях. Это личные наблюдения, а не доказанная причина или медицинский вывод.
      </p>

      {progressByFactor.size > 0 && (
        <details className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Что Prosnix ещё проверяет
          </summary>
          <div className="mt-3 space-y-2">
            {[...progressByFactor.values()].map((item) => (
              <p key={item.factorKey} className="text-xs leading-relaxed text-muted-foreground">
                Проверяем, помогает ли {factorLabel(item.factorKey)} отдельно от остальных заданий:
                готово {item.pairCount} из {item.targetPairs} сопоставимых проверок. Это ход
                эксперимента, а не готовая рекомендация.
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default WakeProfileSummary;
