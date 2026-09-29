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
let protocolInterval: ReturnType<typeof setInterval> | null = null;

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
    return audioContext.state === undefined || audioContext.state === "running";
  } catch {
    audioContext = null;
    return false;
  }
}

function playProtocolCue(ambient = false): boolean {
  if (!audioContext || (audioContext.state && audioContext.state !== "running")) return false;
  try {
    const now = audioContext.currentTime;
    for (const [offset, frequency] of ambient
      ? [
          [0, 220],
          [0.04, 330],
        ]
      : [
          [0, 440],
          [0.22, 554],
          [0.44, 659],
        ]) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(ambient ? 0.012 : 0.045, now + offset + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + (ambient ? 2.8 : 0.18));
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + (ambient ? 2.9 : 0.19));
    }
    return true;
  } catch {
    return false;
  }
}

export function startWakeProtocolSound(ambient = false): boolean {
  if (protocolInterval) return true;
  if (!audioContext || (audioContext.state && audioContext.state !== "running")) return false;
  if (!playProtocolCue(ambient)) return false;
  protocolInterval = setInterval(
    () => {
      if (!playProtocolCue(ambient)) stopWakeProtocolSound();
    },
    ambient ? 8_000 : 3_000,
  );
  return true;
}

export function stopWakeProtocolSound(): void {
  if (protocolInterval) clearInterval(protocolInterval);
  protocolInterval = null;
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

export function playCountdownTick(soundMode: WakeSoundMode): void {
  if (soundMode !== "on" || !audioContext) return;
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  } catch {
    // A missing audio device does not block the timer.
  }
}

export function resetWakeSoundForTests(): void {
  stopWakeProtocolSound();
  audioContext = null;
}
