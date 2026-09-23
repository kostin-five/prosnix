import { triggerTelegramHaptic } from "../../telegram/bridge.js";

export type WakeSoundMode = "off" | "on";
export type TaskFeedbackKind = "start" | "cue" | "success" | "error";

type AudioContextLike = {
  currentTime: number;
  state?: string;
  destination: AudioNode;
  resume?: () => Promise<void>;
  createOscillator: () => OscillatorNode;
  createGain: () => GainNode;
};

type AudioContextConstructor = new () => AudioContextLike;

let audioContext: AudioContextLike | null = null;

function audioContextConstructor(): AudioContextConstructor | undefined {
  const audioWindow = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return (
    (window.AudioContext as unknown as AudioContextConstructor | undefined) ??
    audioWindow.webkitAudioContext
  );
}

export async function enableWakeSoundFromGesture(): Promise<boolean> {
  try {
    const AudioContextClass = audioContextConstructor();
    if (!AudioContextClass) return false;
    audioContext ??= new AudioContextClass();
    if (audioContext.state === "suspended") await audioContext.resume?.();
    return true;
  } catch {
    audioContext = null;
    return false;
  }
}

function playTone(kind: TaskFeedbackKind): void {
  if (!audioContext) return;
  try {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const frequency =
      kind === "error" ? 180 : kind === "success" ? 620 : kind === "cue" ? 760 : 420;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.13);
  } catch {
    // Visual feedback and the wake flow remain available when audio fails.
  }
}

export function signalTaskFeedback(kind: TaskFeedbackKind, soundMode: WakeSoundMode): void {
  triggerTelegramHaptic(kind);
  if (soundMode === "on") playTone(kind);
}

export function resetWakeSoundForTests(): void {
  audioContext = null;
}
