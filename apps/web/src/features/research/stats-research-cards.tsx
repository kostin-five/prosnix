import { ExperimentFeedbackCard } from "../feedback/experiment-feedback-card.js";
import { ProInterestCard } from "../pro-interest/pro-interest-card.js";

export default function StatsResearchCards({ refreshKey }: { refreshKey: number }) {
  return (
    <>
      <ExperimentFeedbackCard refreshKey={refreshKey} />
      <ProInterestCard refreshKey={refreshKey} />
    </>
  );
}
