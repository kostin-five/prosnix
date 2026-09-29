import { ExperimentFeedbackCard } from "../feedback/experiment-feedback-card.js";
import { ProInterestCard } from "../pro-interest/pro-interest-card.js";

export default function StatsResearchCards({ refreshKey }: { refreshKey: number }) {
  return (
    <div className="ps-stats-research">
      <ExperimentFeedbackCard refreshKey={refreshKey} />
      <ProInterestCard refreshKey={refreshKey} />
    </div>
  );
}
