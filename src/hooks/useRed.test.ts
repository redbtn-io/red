import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRed } from "./useRed.js";
import type { RunEvent } from "../types.js";

// ---- Mock EventSource ----

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances: MockEventSource[] = [];

  url: string;
  withCredentials: boolean;
  readyState = MockEventSource.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string, opts?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = !!opts?.withCredentials;
    MockEventSource.instances.push(this);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  emit(event: RunEvent | Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

function lastEs() {
  return MockEventSource.instances[MockEventSource.instances.length - 1];
}

describe("useRed streaming lifecycle", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    (global as { EventSource?: unknown }).EventSource = MockEventSource;
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        conversationId: "conv-1",
        streamUrl: "/api/v1/runs/r1/stream",
      }),
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const config = { apiUrl: "https://app.redbtn.io" };

  it("marks the assistant bubble streaming, then clears it on run_complete", async () => {
    const onResponse = vi.fn();
    const { result } = renderHook(() =>
      useRed({ config, onResponse })
    );

    await act(async () => {
      await result.current.send("hello");
    });

    // user + assistant placeholder present, assistant streaming
    let assistant = result.current.messages.find((m) => m.role === "assistant")!;
    expect(assistant.isStreaming).toBe(true);
    expect(result.current.isStreaming).toBe(true);

    await act(async () => {
      lastEs().emit({ type: "chunk", timestamp: 1, content: "Hi there" });
      lastEs().emit({ type: "run_complete", timestamp: 2 });
    });

    assistant = result.current.messages.find((m) => m.role === "assistant")!;
    expect(assistant.content).toBe("Hi there");
    expect(assistant.isStreaming).toBe(false);
    expect(result.current.isStreaming).toBe(false);
    expect(onResponse).toHaveBeenCalledTimes(1);
  });

  it("clears the message streaming flag when the stream ends via [DONE]", async () => {
    const { result } = renderHook(() => useRed({ config }));

    await act(async () => {
      await result.current.send("hello");
    });

    await act(async () => {
      lastEs().emit({ type: "chunk", timestamp: 1, content: "partial" });
      // Terminal sentinel with no preceding run_complete
      lastEs().onmessage?.({ data: "[DONE]" });
    });

    const assistant = result.current.messages.find(
      (m) => m.role === "assistant"
    )!;
    expect(assistant.isStreaming).toBe(false);
    expect(result.current.isStreaming).toBe(false);
  });

  it("clears the message streaming flag when the SSE connection closes on error", async () => {
    const { result } = renderHook(() => useRed({ config }));

    await act(async () => {
      await result.current.send("hello");
    });

    await act(async () => {
      const es = lastEs();
      es.readyState = MockEventSource.CLOSED;
      es.onerror?.();
    });

    const assistant = result.current.messages.find(
      (m) => m.role === "assistant"
    )!;
    expect(assistant.isStreaming).toBe(false);
    expect(result.current.isStreaming).toBe(false);
  });

  it("does not clear streaming on a transient (non-closed) SSE error", async () => {
    const { result } = renderHook(() => useRed({ config }));

    await act(async () => {
      await result.current.send("hello");
    });

    await act(async () => {
      const es = lastEs();
      es.readyState = MockEventSource.CONNECTING; // auto-reconnecting
      es.onerror?.();
    });

    const assistant = result.current.messages.find(
      (m) => m.role === "assistant"
    )!;
    expect(assistant.isStreaming).toBe(true);
    expect(result.current.isStreaming).toBe(true);
  });

  it("surfaces an error message and stops streaming when the POST fails", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        error: { message: "boom", type: "server", code: "500" },
      }),
    })) as unknown as typeof fetch;
    const onError = vi.fn();
    const { result } = renderHook(() => useRed({ config, onError }));

    await act(async () => {
      await result.current.send("hello");
    });

    const assistant = result.current.messages.find(
      (m) => m.role === "assistant"
    )!;
    expect(assistant.isStreaming).toBe(false);
    expect(assistant.content).toMatch(/something went wrong/i);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.isStreaming).toBe(false);
  });
});
