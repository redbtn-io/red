import type {
  RedConfig,
  ChatRequest,
  ChatResponse,
  ChatError,
  MessageRole,
} from "../types.js";

export class RedClient {
  private config: RedConfig;

  constructor(config: RedConfig) {
    this.config = config;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.config.headers,
    };
    if (this.config.token) {
      h["Authorization"] = `Bearer ${this.config.token}`;
    }
    return h;
  }

  private url(path: string): string {
    const base = this.config.apiUrl.replace(/\/$/, "");
    return `${base}${path}`;
  }

  /**
   * Send a chat message and get back the run metadata for streaming.
   */
  async sendMessage(
    messages: Array<{ role: MessageRole; content: string }>,
    options?: {
      conversationId?: string;
      graphId?: string;
    }
  ): Promise<ChatResponse> {
    const body: ChatRequest = {
      model: this.config.model ?? "Red",
      messages,
      stream: true,
      conversationId:
        options?.conversationId ?? this.config.conversationId,
      graphId: options?.graphId ?? this.config.graphId,
      source: this.config.source,
    };

    const endpoint = this.config.chatEndpoint ?? "/api/v1/chat/completions";
    const res = await fetch(this.url(endpoint), {
      method: "POST",
      headers: this.headers,
      credentials: this.config.token ? "omit" : "include",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as ChatError | null;
      throw new Error(
        err?.error?.message ?? `Chat request failed: ${res.status}`
      );
    }

    return (await res.json()) as ChatResponse;
  }

  /**
   * Open an SSE connection to a run stream.
   * Returns an EventSource that emits RunEvent objects.
   */
  connectStream(streamUrl: string): EventSource {
    // streamUrl is relative (e.g. /api/v1/runs/{runId}/stream)
    const fullUrl = this.url(streamUrl);

    // EventSource doesn't support custom headers, so if we need auth
    // we rely on cookies. If a token is provided, append it as a query param.
    const url = this.config.token
      ? `${fullUrl}${fullUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(this.config.token)}`
      : fullUrl;

    return new EventSource(url, {
      withCredentials: !this.config.token,
    });
  }
}
