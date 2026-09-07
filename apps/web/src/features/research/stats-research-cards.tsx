import { ExperimentFeedbackCard } from "../feedback/experiment-feedback-card.js";
import { ProInterestCard } from "../pro-interest/pro-interest-card.js";

export default function StatsResearchCards({
  refreshKey,
  showAnalyticsHelp,
}: {
  refreshKey: number;
  showAnalyticsHelp: boolean;
}) {
  return (
    <>
      <ExperimentFeedbackCard refreshKey={refreshKey} />
      <ProInterestCard refreshKey={refreshKey} />
      {showAnalyticsHelp && (
        <details className="mb-5 px-1 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">
            Справка об аналитике
          </summary>
          <p className="mt-2 leading-relaxed">
            Прирост — разница оценок после и до протокола. В среднем участвуют только завершённые
            сессии с обеими оценками; рядом с датой показан размер выборки. Контексты сна не
            смешиваются при сравнении протоколов.
          </p>
        </details>
      )}
    </>
  );
}
