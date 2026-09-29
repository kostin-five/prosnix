import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetHandsFreeGuidance,
  speakTask,
  stopSpeech,
} from "../src/features/tasks/hands-free-audio.js";

describe("голосовые подсказки без телефона", () => {
  const speak = vi.fn();
  const cancel = vi.fn();
  const utterances: string[] = [];

  beforeEach(() => {
    localStorage.clear();
    speak.mockClear();
    cancel.mockClear();
    utterances.length = 0;
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        lang = "";
        rate = 1;
        constructor(public text: string) {
          utterances.push(text);
        }
      },
    );
    vi.stubGlobal("speechSynthesis", { speak, cancel });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("первый раз объясняет упражнение, затем говорит кратко, а сброс возвращает объяснение", () => {
    expect(speakTask("squats", "Приседания", "user-1")).toBe(true);
    expect(utterances[0]).toContain("опускайся и выпрямляйся");
    expect(speakTask("squats", "Приседания", "user-1", true)).toBe(true);
    expect(utterances[1]).toContain("Приготовься");
    expect(utterances[1]).not.toContain("опускайся");
    resetHandsFreeGuidance("user-1");
    expect(speakTask("squats", "Приседания", "user-1")).toBe(true);
    expect(utterances[2]).toContain("опускайся");
    stopSpeech();
    expect(cancel).toHaveBeenCalled();
  });

  it("не запрашивает микрофон и продолжает без API озвучки", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    expect(speakTask("notice_three", "Назови три предмета", "user-2")).toBe(false);
    expect(speak).not.toHaveBeenCalled();
  });
});
