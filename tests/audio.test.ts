import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const parameter = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
});
const makeGain = () => ({
  gain: parameter(),
  connect: vi.fn(),
  disconnect: vi.fn(),
});
const makeOscillator = () => ({
  type: "sine",
  frequency: parameter(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  onended: undefined as (() => void) | undefined,
});

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state = "running";
  currentTime = 10;
  destination = {};
  gains: ReturnType<typeof makeGain>[] = [];
  oscillators: ReturnType<typeof makeOscillator>[] = [];
  resume = vi.fn(async () => {
    this.state = "running";
  });
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createGain() {
    const gain = makeGain();
    this.gains.push(gain);
    return gain;
  }
  createOscillator() {
    const oscillator = makeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }
}

describe("optional presentation audio", () => {
  beforeEach(() => {
    vi.resetModules();
    FakeAudioContext.instances = [];
    vi.stubGlobal("window", { AudioContext: FakeAudioContext });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("starts muted and never creates an audio device just to play a cue", async () => {
    const { gameAudio } = await import("../apps/web/src/gameAudio");
    gameAudio.unlock();
    gameAudio.play("roll");
    expect(FakeAudioContext.instances).toHaveLength(0);
    gameAudio.configure(true, 0.5);
    gameAudio.play("roll");
    expect(FakeAudioContext.instances).toHaveLength(0);
    gameAudio.unlock();
    gameAudio.play("roll");
    expect(FakeAudioContext.instances[0].oscillators).toHaveLength(4);
  });

  it("clamps volume, immediately stops pending notes on mute, and never resumes old cues", async () => {
    const { gameAudio } = await import("../apps/web/src/gameAudio");
    gameAudio.configure(true, 3);
    gameAudio.unlock();
    const context = FakeAudioContext.instances[0];
    expect(context.gains[0].gain.value).toBe(1);
    gameAudio.play("finish");
    const voices = [...context.oscillators];
    expect(voices).toHaveLength(4);
    gameAudio.configure(false, 0.5);
    for (const voice of voices) {
      expect(voice.stop).toHaveBeenCalledTimes(2);
      expect(voice.disconnect).toHaveBeenCalledOnce();
    }
    gameAudio.play("step");
    expect(context.oscillators).toHaveLength(4);
    gameAudio.configure(true, -1);
    gameAudio.play("step");
    expect(context.oscillators).toHaveLength(4);
    gameAudio.configure(true, Number.NaN);
    gameAudio.play("step");
    expect(context.oscillators).toHaveLength(4);
  });

  it("drops suspended cues, resumes only on unlock, and caps concurrent voices", async () => {
    const { gameAudio } = await import("../apps/web/src/gameAudio");
    gameAudio.configure(true, 0.4);
    gameAudio.unlock();
    const context = FakeAudioContext.instances[0];
    context.state = "suspended";
    gameAudio.play("finish");
    expect(context.oscillators).toHaveLength(0);
    gameAudio.unlock();
    expect(context.resume).toHaveBeenCalledOnce();
    for (let i = 0; i < 10; i++) gameAudio.play("finish");
    expect(context.oscillators).toHaveLength(24);
    context.oscillators[0].onended?.();
    gameAudio.play("step");
    expect(context.oscillators).toHaveLength(25);
  });

  it("safely ignores unavailable or denied browser audio", async () => {
    vi.stubGlobal("window", {
      AudioContext: class {
        constructor() {
          throw new Error("denied");
        }
      },
    });
    const { gameAudio } = await import("../apps/web/src/gameAudio");
    expect(() => {
      gameAudio.configure(true, 0.5);
      gameAudio.unlock();
      gameAudio.play("power");
      gameAudio.configure(false, 0.5);
    }).not.toThrow();
    vi.stubGlobal("window", {});
    expect(() => gameAudio.unlock()).not.toThrow();
  });
});
