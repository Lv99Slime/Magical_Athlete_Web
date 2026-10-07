/** Presentation-only cues: never reads state, rolls dice, or fetches sound assets. */
export type SoundCue =
  "roll" | "result" | "step" | "warp" | "power" | "trip" | "finish";

type Note = {
  frequency: number;
  end?: number;
  at: number;
  duration: number;
  type?: OscillatorType;
};

const cues: Record<SoundCue, Note[]> = {
  roll: [0, 0.07, 0.15, 0.25].map((at, index) => ({
    frequency: 190 + index * 31,
    end: 90,
    at,
    duration: 0.045,
    type: "triangle",
  })),
  result: [
    { frequency: 660, at: 0, duration: 0.11 },
    { frequency: 880, at: 0.09, duration: 0.18 },
  ],
  step: [{ frequency: 290, end: 140, at: 0, duration: 0.045 }],
  warp: [
    { frequency: 220, end: 1040, at: 0, duration: 0.21 },
    { frequency: 1040, end: 520, at: 0.18, duration: 0.17 },
  ],
  power: [
    { frequency: 523.25, at: 0, duration: 0.16 },
    { frequency: 783.99, at: 0.075, duration: 0.21 },
  ],
  trip: [{ frequency: 330, end: 100, at: 0, duration: 0.18, type: "triangle" }],
  finish: [523.25, 659.25, 783.99, 1046.5].map((frequency, index) => ({
    frequency,
    at: index * 0.105,
    duration: index === 3 ? 0.34 : 0.15,
  })),
};

class GameAudio {
  private enabled = false;
  private volume = 0.45;
  private context?: AudioContext;
  private master?: GainNode;
  private voices = new Map<OscillatorNode, GainNode>();

  /** Call directly from a user gesture after enabling sound; no autoplay on load. */
  unlock(): void {
    if (!this.enabled || typeof window === "undefined") return;
    try {
      const AudioContextClass =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;
      if (!this.context || this.context.state === "closed") {
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") {
        void this.context.resume().catch(() => undefined);
      }
    } catch {
      // Unavailable audio must never interrupt a game action.
      this.context = undefined;
      this.master = undefined;
    }
  }

  /** Volume is 0..1. Muting immediately silences active and scheduled notes. */
  configure(enabled: boolean, volume: number): void {
    this.enabled = enabled;
    this.volume = Number.isFinite(volume)
      ? Math.max(0, Math.min(1, volume))
      : 0;
    try {
      this.master?.gain.setValueAtTime(
        enabled ? this.volume : 0,
        this.context?.currentTime ?? 0,
      );
    } catch {
      // A browser may close its audio device between events.
    }
    if (!enabled || this.volume === 0) {
      for (const [oscillator, gain] of this.voices) {
        try {
          oscillator.stop();
          oscillator.disconnect();
          gain.disconnect();
        } catch {
          // Notes that have already ended need no further cleanup.
        }
      }
      this.voices.clear();
    }
  }

  /** Best-effort, bounded synthesis. Suspended contexts drop cues, never backlog them. */
  play(cue: SoundCue): void {
    const context = this.context;
    const master = this.master;
    if (!this.enabled || this.volume === 0 || !context || !master) return;
    if (context.state !== "running") return;
    try {
      for (const note of cues[cue]) {
        if (this.voices.size >= 24) break;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + note.at;
        const end = start + note.duration;
        oscillator.type = note.type ?? "sine";
        oscillator.frequency.setValueAtTime(note.frequency, start);
        if (note.end) {
          oscillator.frequency.exponentialRampToValueAtTime(note.end, end);
        }
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.16, start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.001, end);
        oscillator.connect(gain);
        gain.connect(master);
        this.voices.set(oscillator, gain);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
          this.voices.delete(oscillator);
        };
        oscillator.start(start);
        oscillator.stop(end + 0.015);
      }
    } catch {
      // Sound is optional, including when an audio device disappears mid-cue.
    }
  }
}

export const gameAudio = new GameAudio();
