import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { findBreakPoint, useVoice } from "./useVoice.js";

describe("findBreakPoint", () => {
  it("returns -1 when the buffer is shorter than minChars", () => {
    expect(findBreakPoint("short", 30)).toBe(-1);
  });

  it("breaks after a sentence end followed by a space", () => {
    const buf = "This is the first sentence. And here is more text following it.";
    const idx = findBreakPoint(buf, 10);
    // Split point is right after the period+space of the first sentence.
    expect(buf.slice(0, idx)).toBe("This is the first sentence.");
  });

  it("prefers a paragraph break over a sentence break", () => {
    const buf = "First line here.\n\nSecond paragraph starts here now.";
    const idx = findBreakPoint(buf, 5);
    expect(buf.slice(0, idx)).toBe("First line here.\n\n");
  });

  it("does not split inside a decimal number", () => {
    const buf = "The value is 3.5 and it keeps going for a while longer here.";
    const idx = findBreakPoint(buf, 10);
    // Must not break at the '.' of 3.5
    expect(buf.slice(0, idx)).not.toBe("The value is 3.");
    expect(buf.slice(0, idx).includes("3.5")).toBe(true);
  });

  it("falls back to a clause break (comma + space) when no sentence end exists", () => {
    const buf = "one two three four five, six seven eight nine ten eleven";
    const idx = findBreakPoint(buf, 10);
    expect(buf.slice(0, idx)).toBe("one two three four five, ");
  });

  it("force-splits at a space once the buffer is very long", () => {
    // No sentence/clause/newline breaks; only spaces.
    const buf = "word ".repeat(40); // 200 chars, all word+space
    const idx = findBreakPoint(buf, 30);
    expect(idx).toBeGreaterThan(0);
    // The split lands on a space boundary at or after minChars.
    expect(idx).toBeGreaterThanOrEqual(30);
  });
});

describe("useVoice.requestPermission", () => {
  let getUserMedia: ReturnType<typeof vi.fn>;
  const trackStop = vi.fn();

  beforeEach(() => {
    getUserMedia = vi.fn(async () => ({
      getTracks: () => [{ stop: trackStop, kind: "audio" }],
    }));
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    (globalThis as { AudioContext?: unknown }).AudioContext = class {
      state = "running";
      destination = {};
      createMediaStreamSource() {
        return { connect() {} };
      }
      createAnalyser() {
        return {
          fftSize: 0,
          smoothingTimeConstant: 0,
          frequencyBinCount: 128,
          getByteFrequencyData() {},
          connect() {},
        };
      }
      resume() {
        return Promise.resolve();
      }
      close() {}
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("grants permission and only calls getUserMedia once for concurrent requests", async () => {
    const { result } = renderHook(() => useVoice({ apiUrl: "" }));

    await act(async () => {
      // Simulate a StrictMode-style double-invoke: two concurrent requests.
      await Promise.all([
        result.current.requestPermission(),
        result.current.requestPermission(),
      ]);
    });

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(result.current.permission).toBe("granted");
  });

  it("reports denied when getUserMedia rejects with NotAllowedError", async () => {
    getUserMedia.mockRejectedValueOnce(
      Object.assign(new Error("no"), { name: "NotAllowedError" })
    );
    const { result } = renderHook(() => useVoice({ apiUrl: "" }));

    await act(async () => {
      const ok = await result.current.requestPermission();
      expect(ok).toBe(false);
    });

    expect(result.current.permission).toBe("denied");
  });
});

describe("useVoice TTS AudioContext lifecycle", () => {
  // Track every AudioContext created during a test so we can assert whether the
  // TTS playback context is released on unmount.
  let contexts: MockAudioContext[];

  class MockAudioContext {
    state = "running";
    destination = {};
    close = vi.fn(() => {
      this.state = "closed";
      return Promise.resolve();
    });
    resume = vi.fn(() => Promise.resolve());
    createBuffer() {
      return {};
    }
    createBufferSource() {
      const src: {
        buffer: unknown;
        connect: () => void;
        start: () => void;
        onended: (() => void) | null;
      } = {
        buffer: null,
        connect() {},
        start() {
          // Fire completion synchronously so the playback promise resolves and
          // the hook returns to idle within the test's act() flush.
          src.onended?.();
        },
        onended: null,
      };
      return src;
    }
    decodeAudioData() {
      return Promise.resolve({});
    }
    constructor() {
      contexts.push(this);
    }
  }

  beforeEach(() => {
    contexts = [];
    (globalThis as { AudioContext?: unknown }).AudioContext = MockAudioContext;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("closes the TTS AudioContext on unmount (no leaked hardware audio context)", async () => {
    const { result, unmount } = renderHook(() => useVoice({ apiUrl: "" }));

    // Feed a pre-synthesized audio chunk through the playback pipeline. This is
    // what lazily constructs the TTS AudioContext via getTtsAudioContext().
    const fakeBlob = {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as unknown as Blob;

    await act(async () => {
      result.current.pushTtsAudio(fakeBlob);
      await flush();
    });

    // The TTS AudioContext must have been created exactly once and still be open.
    expect(contexts).toHaveLength(1);
    const ttsCtx = contexts[0];
    expect(ttsCtx.close).not.toHaveBeenCalled();

    // Unmounting must release the audio context, not just stop playback.
    unmount();

    expect(ttsCtx.close).toHaveBeenCalledTimes(1);
    expect(ttsCtx.state).toBe("closed");
  });
});
