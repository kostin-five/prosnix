export interface DemoWakeChartPoint {
  name: string;
  label: string;
  value: number;
  evidenceCount?: number;
}

function color(value: number): string {
  if (value >= 4) return "bg-green-500";
  if (value >= 2) return "bg-primary";
  if (value >= 0) return "bg-yellow-500";
  return "bg-red-500";
}

export default function DemoWakeChart({ data }: { data: DemoWakeChartPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">
        График появится после первой полностью завершённой сессии с оценкой бодрости до и после.
      </div>
    );
  }
  const maximum = Math.max(1, ...data.map(({ value }) => Math.abs(value)));
  return (
    <div className="space-y-3" aria-label="Средний прирост бодрости по датам">
      {data.map((point) => (
        <div key={point.name} className="grid grid-cols-[54px_1fr_58px] items-center gap-2">
          <span className="text-xs text-muted-foreground">{point.label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${color(point.value)}`}
              style={{ width: `${Math.max(7, (Math.abs(point.value) / maximum) * 100)}%` }}
            />
          </div>
          <span className="text-right text-xs font-semibold">
            {point.value >= 0 ? "+" : ""}
            {point.value.toFixed(1)}
            {point.evidenceCount ? (
              <span className="block text-[10px] font-normal text-muted-foreground">
                n={point.evidenceCount}
              </span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}
