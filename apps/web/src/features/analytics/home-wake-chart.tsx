export interface HomeWakeChartPoint {
  key: string;
  label: string;
  value: number;
  evidenceCount: number;
}

function barColor(value: number): string {
  if (value > 0) return "bg-gradient-to-t from-primary to-accent";
  if (value < 0) return "bg-red-400/80";
  return "bg-muted-foreground";
}

export function HomeWakeChart({ data }: { data: readonly HomeWakeChartPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-secondary/55 px-3 py-4 text-xs leading-relaxed text-muted-foreground">
        График появится после первой полностью завершённой сессии с оценкой бодрости до и после.
      </div>
    );
  }

  const maximum = Math.max(1, ...data.map(({ value }) => Math.abs(value)));

  return (
    <div
      className="grid min-w-0 gap-1.5"
      style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
      aria-label="Прирост бодрости по дням"
    >
      {data.map((point) => {
        const height = point.value === 0 ? 3 : Math.max(8, (Math.abs(point.value) / maximum) * 42);
        return (
          <div key={point.key} className="min-w-0 text-center">
            <span className="block text-[10px] font-bold text-foreground">
              {point.value >= 0 ? "+" : ""}
              {point.value.toFixed(1)}
            </span>
            <div className="relative mt-1 h-20 overflow-hidden rounded-lg bg-secondary/40">
              <div className="absolute inset-x-0 top-1/2 border-t border-border" />
              <div
                className={`absolute left-1/2 w-[58%] -translate-x-1/2 rounded-sm ${barColor(point.value)}`}
                style={
                  point.value >= 0
                    ? { bottom: "50%", height: `${height}%` }
                    : { top: "50%", height: `${height}%` }
                }
              />
            </div>
            <span className="mt-1 block truncate text-[10px] text-muted-foreground">
              {point.label}
            </span>
            <span className="block text-[9px] text-muted-foreground">n={point.evidenceCount}</span>
          </div>
        );
      })}
    </div>
  );
}
