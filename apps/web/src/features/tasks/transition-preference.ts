export type TransitionPause = 0 | 5 | 10 | 20;
const key = (scope: string) => `prosnix:${scope}:transition-pause`;
export function readTransitionPause(scope: string, handsFree = false): TransitionPause {
  try {
    const value = localStorage.getItem(key(scope));
    if (value !== null && ["0", "5", "10", "20"].includes(value))
      return Number(value) as TransitionPause;
  } catch {
    /* Настройка необязательна при недоступном storage. */
  }
  return handsFree ? 10 : 0;
}
export function saveTransitionPause(scope: string, value: TransitionPause): void {
  try {
    localStorage.setItem(key(scope), String(value));
  } catch {
    /* Сохраняем выбор в UI до закрытия. */
  }
}

export function hasTransitionPreference(scope: string): boolean {
  try {
    return localStorage.getItem(key(scope)) !== null;
  } catch {
    return false;
  }
}

export function clearTransitionPause(scope: string): void {
  try {
    localStorage.removeItem(key(scope));
  } catch {
    /* Storage может быть недоступен. */
  }
}
