import { useEffect, useState } from "react";

import { EarlyCalibrationCard } from "./early-calibration-card.js";
import { MorningGoalBanner } from "./morning-goal-card.js";
import { loadLifeGoal } from "./personalization-api.js";
import {
  handleEarlyCalibration,
  readMorningGoal,
  readNextEarlyCalibration,
  scheduleEarlyCalibration,
  type EarlyCalibrationReview,
} from "./morning-preferences.js";

type MorningExperienceSlotProps =
  | { mode: "goal"; storageScope: string; onLoaded?: (ready: boolean) => void }
  | { mode: "due"; storageScope: string; onOpenSettings: () => void }
  | {
      mode: "scheduled";
      storageScope: string;
      sessionNumber: number;
      onOpenSettings: () => void;
    };

export function MorningExperienceSlot(props: MorningExperienceSlotProps) {
  const [goal, setGoal] = useState("");
  const [review, setReview] = useState<EarlyCalibrationReview | null>(null);
  const scheduledSessionNumber = props.mode === "scheduled" ? props.sessionNumber : null;
  const onGoalLoaded = props.mode === "goal" ? props.onLoaded : undefined;

  useEffect(() => {
    if (props.mode !== "goal") return;
    if (props.storageScope === "demo") {
      setGoal(readMorningGoal(props.storageScope));
      onGoalLoaded?.(true);
      return;
    }
    let active = true;
    setGoal("");
    void loadLifeGoal()
      .then((saved) => {
        if (active) {
          setGoal(saved.text);
          onGoalLoaded?.(true);
        }
      })
      .catch(() => {
        if (active) onGoalLoaded?.(true);
      });
    return () => {
      active = false;
    };
  }, [props.mode, props.storageScope, onGoalLoaded]);

  useEffect(() => {
    if (props.mode !== "due") return;
    const nextReview = readNextEarlyCalibration(props.storageScope);
    if (!nextReview) {
      setReview(null);
      return;
    }

    const delay = Math.max(0, Date.parse(nextReview.dueAt) - Date.now());
    if (delay === 0) {
      setReview(nextReview);
      return;
    }

    setReview(null);
    const timer = window.setTimeout(() => setReview(nextReview), delay);
    return () => window.clearTimeout(timer);
  }, [props.mode, props.storageScope]);

  useEffect(() => {
    if (scheduledSessionNumber === null) return;
    scheduleEarlyCalibration(props.storageScope, scheduledSessionNumber);
  }, [props.storageScope, scheduledSessionNumber]);

  if (props.mode === "goal") return <MorningGoalBanner goal={goal} />;

  if (props.mode === "scheduled") {
    return (
      <EarlyCalibrationCard
        mode="scheduled"
        sessionNumber={props.sessionNumber}
        onReview={() => {
          handleEarlyCalibration(props.storageScope, props.sessionNumber);
          props.onOpenSettings();
        }}
      />
    );
  }

  if (!review) return null;
  return (
    <EarlyCalibrationCard
      mode="due"
      sessionNumber={review.sessionNumber}
      onReview={() => {
        handleEarlyCalibration(props.storageScope, review.sessionNumber);
        setReview(null);
        props.onOpenSettings();
      }}
      onDismiss={() => {
        handleEarlyCalibration(props.storageScope, review.sessionNumber);
        setReview(null);
      }}
    />
  );
}

export default MorningExperienceSlot;
