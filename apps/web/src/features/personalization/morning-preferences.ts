export const MORNING_GOAL_MAX_LENGTH = 120;

export type EarlyCalibrationReview = {
  sessionNumber: 1 | 2 | 3;
  dueAt: string;
};

type StoredReview = EarlyCalibrationReview & { handled: boolean };
type MorningPreferences = {
  goal: string;
  reviews: StoredReview[];
};

function storageKey(scope: string): string {
  return `prosnix.morning-preferences.v1:${scope}`;
}

function emptyPreferences(): MorningPreferences {
  return { goal: "", reviews: [] };
}

function normalizeGoal(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MORNING_GOAL_MAX_LENGTH);
}

function readPreferences(scope: string): MorningPreferences {
  if (typeof window === "undefined") return emptyPreferences();
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return emptyPreferences();
    const parsed = JSON.parse(raw) as Partial<MorningPreferences>;
    const reviews = Array.isArray(parsed.reviews)
      ? parsed.reviews.filter(
          (review): review is StoredReview =>
            typeof review === "object" &&
            review !== null &&
            (review.sessionNumber === 1 ||
              review.sessionNumber === 2 ||
              review.sessionNumber === 3) &&
            typeof review.dueAt === "string" &&
            Number.isFinite(Date.parse(review.dueAt)) &&
            typeof review.handled === "boolean",
        )
      : [];
    return {
      goal: typeof parsed.goal === "string" ? normalizeGoal(parsed.goal) : "",
      reviews,
    };
  } catch {
    return emptyPreferences();
  }
}

function writePreferences(scope: string, preferences: MorningPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(scope), JSON.stringify(preferences));
  } catch {
    // Local preferences are optional and must never block the wake flow.
  }
}

export function readMorningGoal(scope: string): string {
  return readPreferences(scope).goal;
}

export function saveMorningGoal(scope: string, value: string): string {
  const preferences = readPreferences(scope);
  const goal = normalizeGoal(value);
  writePreferences(scope, { ...preferences, goal });
  return goal;
}

export function scheduleEarlyCalibration(
  scope: string,
  completedSessions: number,
  now = new Date(),
): EarlyCalibrationReview | null {
  if (completedSessions < 1 || completedSessions > 3) return null;
  const sessionNumber = completedSessions as EarlyCalibrationReview["sessionNumber"];
  const preferences = readPreferences(scope);
  const existing = preferences.reviews.find((review) => review.sessionNumber === sessionNumber);
  if (existing) return existing.handled ? null : existing;

  const due = new Date(now);
  due.setHours(18, 0, 0, 0);
  if (due.getTime() < now.getTime()) due.setTime(now.getTime());
  const review: StoredReview = { sessionNumber, dueAt: due.toISOString(), handled: false };
  writePreferences(scope, { ...preferences, reviews: [...preferences.reviews, review] });
  return review;
}

export function readDueEarlyCalibration(
  scope: string,
  now = new Date(),
): EarlyCalibrationReview | null {
  const nowMs = now.getTime();
  return (
    readPreferences(scope)
      .reviews.filter((review) => !review.handled && Date.parse(review.dueAt) <= nowMs)
      .sort((left, right) => left.sessionNumber - right.sessionNumber)[0] ?? null
  );
}

export function readNextEarlyCalibration(scope: string): EarlyCalibrationReview | null {
  return (
    readPreferences(scope)
      .reviews.filter((review) => !review.handled)
      .sort(
        (left, right) =>
          Date.parse(left.dueAt) - Date.parse(right.dueAt) ||
          left.sessionNumber - right.sessionNumber,
      )[0] ?? null
  );
}

export function handleEarlyCalibration(scope: string, sessionNumber: number): void {
  const preferences = readPreferences(scope);
  writePreferences(scope, {
    ...preferences,
    reviews: preferences.reviews.map((review) =>
      review.sessionNumber === sessionNumber ? { ...review, handled: true } : review,
    ),
  });
}

export function clearMorningPreferences(scope: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(scope));
  } catch {
    // Profile deletion still succeeds when local storage is unavailable.
  }
}
