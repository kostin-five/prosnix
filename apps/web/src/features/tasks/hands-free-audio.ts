import type { TaskId } from "./task-icon.js";

const GUIDANCE: Partial<Record<TaskId, string>> = {
  breathing:
    "Сядь удобно. Дыши мягко в своём ритме, без задержек и глубоких вдохов через силу. При дискомфорте остановись.",
  steps: "Пройдись по комнате в спокойном темпе.",
  squats:
    "Делай приседания плавно: опускайся и выпрямляйся без рывков. Остановись при дискомфорте.",
  shake: "Мягко разомни руки, плечи и шею. Без резких движений.",
  water: "Налей и выпей воду в удобном темпе, если тебе это подходит.",
  window: "Открой шторы или включи свет. Не смотри прямо на солнце.",
  curtains: "Открой шторы и побудь при свете. Если темно, включи свет в комнате.",
  sit_edge: "Сядь на край кровати и поставь обе стопы на пол.",
  cool_wash: "Умойся комфортно прохладной водой. Не используй ледяную воду.",
  pushups: "Сделай отжимания от пола или с колен. Двигайся спокойно и остановись при дискомфорте.",
  notice_three: "Оглянись и назови про себя три предмета рядом. Вслух говорить не нужно.",
  find_color: "Выбери цвет и найди пять предметов этого цвета вокруг себя.",
};

function storageKey(scope: string): string {
  return `prosnix:hands-free-guidance:${scope}`;
}

function preferredRussianVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  const russian = voices.filter((voice) => voice.lang.toLowerCase().startsWith("ru"));
  return (
    russian.find((voice) =>
      /(?:milena|katya|tatyana|daria|alena|anna|irina|natalia|maria|yana|female|женск)/i.test(
        voice.name,
      ),
    ) ?? russian[0]
  );
}

function seenTasks(scope: string): TaskId[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(scope)) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is TaskId => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function resetHandsFreeGuidance(scope: string): void {
  try {
    localStorage.removeItem(storageKey(scope));
  } catch {
    // Storage can be unavailable in private WebViews.
  }
}

export function stopSpeech(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // The visual task remains available.
  }
}

export function primeHandsFreeSpeech(): void {
  try {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    const utterance = new SpeechSynthesisUtterance("Начинаем протокол.");
    utterance.lang = "ru-RU";
    utterance.voice = preferredRussianVoice() ?? null;
    window.speechSynthesis.speak(utterance);
  } catch {
    // The visible instructions are the fallback.
  }
}

export function speakTask(
  taskId: TaskId,
  title: string,
  scope: string,
  preparing = false,
  seconds?: number,
): boolean {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
  try {
    const seen = seenTasks(scope);
    const firstTime = !seen.includes(taskId);
    const duration =
      seconds ?? (taskId === "find_color" ? 25 : taskId === "notice_three" ? 15 : undefined);
    const instruction = firstTime
      ? `${title}. ${duration ? `${duration} секунд. ` : ""}${GUIDANCE[taskId] ?? "Выполни задание в удобном темпе."}`
      : `${title}. ${duration ? `${duration} секунд.` : "Следуй таймеру."}`;
    const utterance = new SpeechSynthesisUtterance(
      preparing ? `Приготовься. Следующее задание: ${instruction}` : instruction,
    );
    utterance.lang = "ru-RU";
    utterance.voice = preferredRussianVoice() ?? null;
    utterance.rate = 1;
    stopSpeech();
    window.speechSynthesis.speak(utterance);
    if (firstTime) localStorage.setItem(storageKey(scope), JSON.stringify([...seen, taskId]));
    return true;
  } catch {
    return false;
  }
}
