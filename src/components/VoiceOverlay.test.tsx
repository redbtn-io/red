import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { VoiceOverlay, hexToRgba } from "./VoiceOverlay.js";
import type { UseVoiceReturn, VoicePermission, VoicePhase } from "../types.js";

afterEach(cleanup);

function makeVoice(over: Partial<UseVoiceReturn> = {}): UseVoiceReturn {
  return {
    phase: "idle" as VoicePhase,
    isActive: false,
    requestPermission: vi.fn(async () => true),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    pushTtsText: vi.fn(),
    pushTtsAudio: vi.fn(),
    flushTts: vi.fn(),
    setPhase: vi.fn(),
    reset: vi.fn(),
    amplitude: 0,
    permission: "prompt" as VoicePermission,
    error: null,
    ...over,
  };
}

describe("VoiceOverlay permission bootstrap", () => {
  it("requests microphone permission when opened with permission === 'prompt'", () => {
    const voice = makeVoice({ permission: "prompt" });
    render(<VoiceOverlay isOpen onClose={() => {}} voice={voice} />);
    expect(voice.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("does NOT request permission when the overlay is closed", () => {
    const voice = makeVoice({ permission: "prompt" });
    render(<VoiceOverlay isOpen={false} onClose={() => {}} voice={voice} />);
    expect(voice.requestPermission).not.toHaveBeenCalled();
  });

  it("does NOT re-request permission once it is granted", () => {
    const voice = makeVoice({ permission: "granted" });
    render(<VoiceOverlay isOpen onClose={() => {}} voice={voice} />);
    expect(voice.requestPermission).not.toHaveBeenCalled();
  });

  it("closes the overlay on Escape", () => {
    const onClose = vi.fn();
    const voice = makeVoice();

    render(<VoiceOverlay isOpen onClose={onClose} voice={voice} />);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("removes the Escape listener when the overlay closes", () => {
    const onClose = vi.fn();
    const voice = makeVoice();

    const result = render(<VoiceOverlay isOpen onClose={onClose} voice={voice} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    result.rerender(<VoiceOverlay isOpen={false} onClose={onClose} voice={voice} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps its Escape listener and focus stable when onClose changes", () => {
    const firstOnClose = vi.fn();
    const nextOnClose = vi.fn();
    const voice = makeVoice();
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const addEventListener = vi.spyOn(window, "addEventListener");

    const result = render(<VoiceOverlay isOpen onClose={firstOnClose} voice={voice} />);
    expect(addEventListener).toHaveBeenCalledTimes(1);

    result.rerender(<VoiceOverlay isOpen onClose={nextOnClose} voice={voice} />);

    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(firstOnClose).not.toHaveBeenCalled();
    expect(nextOnClose).toHaveBeenCalledTimes(1);

    trigger.remove();
  });

  it("shows the denied fallback and does not request permission when denied", () => {
    const voice = makeVoice({ permission: "denied" });
    render(<VoiceOverlay isOpen onClose={() => {}} voice={voice} />);
    expect(voice.requestPermission).not.toHaveBeenCalled();
    expect(screen.getByText(/Microphone access denied/i)).toBeTruthy();
  });

  it("enables the record button once permission is granted", () => {
    const voice = makeVoice({ permission: "granted", phase: "idle" });
    render(<VoiceOverlay isOpen onClose={() => {}} voice={voice} />);
    const btn = screen.getByRole("button", { name: /hold to record/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("hexToRgba", () => {
  it("parses 6-digit hex with a leading #", () => {
    expect(hexToRgba("#dc2626", 0.5)).toBe("rgba(220, 38, 38, 0.5)");
  });

  it("parses 6-digit hex without a leading #", () => {
    expect(hexToRgba("dc2626", 1)).toBe("rgba(220, 38, 38, 1)");
  });

  it("expands 3-digit shorthand", () => {
    expect(hexToRgba("#f00", 0.3)).toBe("rgba(255, 0, 0, 0.3)");
  });

  it("accepts 8-digit hex, ignoring the alpha channel", () => {
    expect(hexToRgba("#dc262680", 0.2)).toBe("rgba(220, 38, 38, 0.2)");
  });

  it("falls back to red on invalid input instead of producing garbage", () => {
    expect(hexToRgba("not-a-color", 0.4)).toBe("rgba(220, 38, 38, 0.4)");
    expect(hexToRgba("rgb(1,2,3)", 0.4)).toBe("rgba(220, 38, 38, 0.4)");
  });
});
