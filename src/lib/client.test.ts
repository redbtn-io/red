import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RedClient } from "./client.js";

describe("RedClient", () => {
  const origFetch = globalThis.fetch;
  const origEventSource = (globalThis as { EventSource?: unknown }).EventSource;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    (globalThis as { EventSource?: unknown }).EventSource = origEventSource;
  });

  function mockFetchOk(json: unknown) {
    const fn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => json,
    })) as unknown as typeof fetch;
    globalThis.fetch = fn;
    return fn as unknown as ReturnType<typeof vi.fn>;
  }

  it("joins apiUrl and path, trimming a trailing slash", async () => {
    const fetchFn = mockFetchOk({ conversationId: "c1", streamUrl: "/s" });
    const client = new RedClient({ apiUrl: "https://app.redbtn.io/" });
    await client.sendMessage([{ role: "user", content: "hi" }]);
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toBe("https://app.redbtn.io/api/v1/chat/completions");
  });

  it("honors a custom chatEndpoint", async () => {
    const fetchFn = mockFetchOk({ conversationId: "c1", streamUrl: "/s" });
    const client = new RedClient({
      apiUrl: "https://app.redbtn.io",
      chatEndpoint: "/api/custom/chat",
    });
    await client.sendMessage([{ role: "user", content: "hi" }]);
    expect(fetchFn.mock.calls[0][0]).toBe(
      "https://app.redbtn.io/api/custom/chat"
    );
  });

  it("sends a Bearer header and omits credentials when a token is set", async () => {
    const fetchFn = mockFetchOk({ conversationId: "c1", streamUrl: "/s" });
    const client = new RedClient({
      apiUrl: "https://app.redbtn.io",
      token: "jwt-123",
    });
    await client.sendMessage([{ role: "user", content: "hi" }]);
    const init = fetchFn.mock.calls[0][1] as RequestInit & {
      headers: Record<string, string>;
    };
    expect(init.headers["Authorization"]).toBe("Bearer jwt-123");
    expect(init.credentials).toBe("omit");
  });

  it("falls back to cookie auth (include credentials, no Authorization) without a token", async () => {
    const fetchFn = mockFetchOk({ conversationId: "c1", streamUrl: "/s" });
    const client = new RedClient({ apiUrl: "https://app.redbtn.io" });
    await client.sendMessage([{ role: "user", content: "hi" }]);
    const init = fetchFn.mock.calls[0][1] as RequestInit & {
      headers: Record<string, string>;
    };
    expect(init.headers["Authorization"]).toBeUndefined();
    expect(init.credentials).toBe("include");
  });

  it("defaults the model to Red and forces stream: true", async () => {
    const fetchFn = mockFetchOk({ conversationId: "c1", streamUrl: "/s" });
    const client = new RedClient({ apiUrl: "https://app.redbtn.io" });
    await client.sendMessage([{ role: "user", content: "hi" }], {
      graphId: "g1",
      conversationId: "conv-9",
    });
    const body = JSON.parse(
      (fetchFn.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.model).toBe("Red");
    expect(body.stream).toBe(true);
    expect(body.graphId).toBe("g1");
    expect(body.conversationId).toBe("conv-9");
  });

  it("throws with the server error message on non-ok responses", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        error: { message: "Forbidden", type: "auth", code: "403" },
      }),
    })) as unknown as typeof fetch;
    const client = new RedClient({ apiUrl: "https://app.redbtn.io" });
    await expect(
      client.sendMessage([{ role: "user", content: "hi" }])
    ).rejects.toThrow("Forbidden");
  });

  it("appends a URL-encoded token query param for SSE and disables credentials", () => {
    const ctor = vi.fn();
    (globalThis as { EventSource?: unknown }).EventSource = class {
      url: string;
      opts: unknown;
      constructor(url: string, opts: unknown) {
        this.url = url;
        this.opts = opts;
        ctor(url, opts);
      }
    };
    const client = new RedClient({
      apiUrl: "https://app.redbtn.io",
      token: "a b+/=",
    });
    client.connectStream("/api/v1/runs/r1/stream");
    const [url, opts] = ctor.mock.calls[0];
    expect(url).toBe(
      "https://app.redbtn.io/api/v1/runs/r1/stream?token=a%20b%2B%2F%3D"
    );
    expect((opts as { withCredentials: boolean }).withCredentials).toBe(false);
  });

  it("uses & when the stream URL already has a query string", () => {
    const ctor = vi.fn();
    (globalThis as { EventSource?: unknown }).EventSource = class {
      constructor(url: string, opts: unknown) {
        ctor(url, opts);
      }
    };
    const client = new RedClient({
      apiUrl: "https://app.redbtn.io",
      token: "t",
    });
    client.connectStream("/api/v1/runs/r1/stream?foo=1");
    expect(ctor.mock.calls[0][0]).toBe(
      "https://app.redbtn.io/api/v1/runs/r1/stream?foo=1&token=t"
    );
  });

  it("uses cookie credentials for SSE when no token is present", () => {
    const ctor = vi.fn();
    (globalThis as { EventSource?: unknown }).EventSource = class {
      constructor(url: string, opts: unknown) {
        ctor(url, opts);
      }
    };
    const client = new RedClient({ apiUrl: "https://app.redbtn.io" });
    client.connectStream("/api/v1/runs/r1/stream");
    const [url, opts] = ctor.mock.calls[0];
    expect(url).toBe("https://app.redbtn.io/api/v1/runs/r1/stream");
    expect((opts as { withCredentials: boolean }).withCredentials).toBe(true);
  });
});
