import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  enableWakeSoundFromGesture,
  muteWakeSound,
  playCountdownTick,
  resetWakeSoundForTests,
  signalTaskFeedback,
  startWakeProtocolSound,
  stopWakeProtocolSound,
} from "../src/features/tasks/task-experience-feedback.js";

describe("звук и тактильная обратная связь заданий", () => {
  const createOscillator = vi.fn(() => ({
    type: "sine",
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));
  const createGain = vi.fn(() => ({
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }));
  const audioConstructor = vi.fn(function () {
    return {
      currentTime: 0,
      state: "running",
      destination: {},
      createOscillator,
      createGain,
    };
  });

  beforeEach(() => {
    resetWakeSoundForTests();
    vi.stubGlobal("AudioContext", audioConstructor);
    delete window.Telegram;
  });

  afterEach(() => {
    resetWakeSoundForTests();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    delete window.Telegram;
  });

  it("не создаёт AudioContext и не запускает звук без жеста пользователя", () => {
    signalTaskFeedback("cue", "on");

    expect(audioConstructor).not.toHaveBeenCalled();
    expect(createOscillator).not.toHaveBeenCalled();
  });

  it("разрешает короткий сигнал только после явного включения", async () => {
    await expect(enableWakeSoundFromGesture()).resolves.toBe(true);
    signalTaskFeedback("success", "on");

    expect(audioConstructor).toHaveBeenCalledOnce();
    expect(createOscillator).toHaveBeenCalledOnce();
    expect(createGain).toHaveBeenCalledOnce();
  });

  it("сигнал последних секунд звучит только при включённом звуке", async () => {
    await enableWakeSoundFromGesture();
    playCountdownTick("off");
    expect(createOscillator).not.toHaveBeenCalled();
    playCountdownTick("on");
    expect(createOscillator).toHaveBeenCalledOnce();
  });

  it("повторяет сигнал до остановки протокола", async () => {
    vi.useFakeTimers();
    try {
      expect(startWakeProtocolSound()).toBe(false);
      await enableWakeSoundFromGesture();
      expect(startWakeProtocolSound()).toBe(true);
      expect(createOscillator).toHaveBeenCalledTimes(3);
      vi.advanceTimersByTime(3_000);
      expect(createOscillator).toHaveBeenCalledTimes(6);
      stopWakeProtocolSound();
      vi.advanceTimersByTime(9_000);
      expect(createOscillator).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it("после выключения отменяет текущие сигналы и не запускает новые", async () => {
    await enableWakeSoundFromGesture();
    signalTaskFeedback("start", "on");
    const current = createOscillator.mock.results[0]?.value;
    muteWakeSound();
    expect(current?.stop).toHaveBeenCalled();
    signalTaskFeedback("success", "on");
    playCountdownTick("on");
    expect(createOscillator).toHaveBeenCalledTimes(1);
    expect(startWakeProtocolSound()).toBe(false);
  });

  it("продолжает работу без звука, если AudioContext недоступен", async () => {
    vi.stubGlobal(
      "AudioContext",
      vi.fn(() => {
        throw new Error("audio blocked");
      }),
    );

    await expect(enableWakeSoundFromGesture()).resolves.toBe(false);
    expect(() => signalTaskFeedback("error", "on")).not.toThrow();
  });

  it("использует Telegram haptic независимо от режима звука", () => {
    const notificationOccurred = vi.fn();
    window.Telegram = {
      WebApp: {
        initData: "test",
        ready: vi.fn(),
        expand: vi.fn(),
        HapticFeedback: { notificationOccurred },
      },
    };

    signalTaskFeedback("success", "off");

    expect(notificationOccurred).toHaveBeenCalledWith("success");
  });
});
