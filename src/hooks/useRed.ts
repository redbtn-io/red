import { useState, useCallback, useRef, useEffect } from "react";
import { RedClient } from "../lib/client.js";
import type {
  RedConfig,
  RedDisplayOptions,
  Message,
  RunEvent,
  ChunkEvent,
  InitEvent,
  ToolStartEvent,
  ToolProgressEvent,
  ToolCompleteEvent,
  ToolErrorEvent,
  ToolExecution,
} from "../types.js";

interface UseRedOptions {
  config: RedConfig;
  systemPrompt?: string;
  /** Control what's visible in the UI */
  display?: RedDisplayOptions;
  /** Pre-populate with existing messages (e.g. from localStorage) */
  initialMessages?: Message[];
  onMessage?: (message: Message) => void;
  onResponse?: (message: Message) => void;
  onError?: (error: Error) => void;
  /** Raw SSE event callback -- fired for every event before internal handling.
   *  Used by voice integration to feed audio_chunk and content events to TTS. */
  onStreamEvent?: (event: RunEvent) => void;
}

interface UseRedReturn {
  messages: Message[];
  isStreaming: boolean;
  isConnected: boolean;
  conversationId: string | undefined;
  /** Resolved display options (with defaults applied) */
  display: Required<RedDisplayOptions>;
  send: (content: string) => Promise<void>;
  clear: () => void;
}

let idCounter = 0;
function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++idCounter}`;
}

export function useRed(options: UseRedOptions): UseRedReturn {
  const { config, systemPrompt, onMessage, onResponse, onError, onStreamEvent } = options;

  const resolvedDisplay: Required<RedDisplayOptions> = {
    showTools: options.display?.showTools ?? true,
    showThinking: options.display?.showThinking ?? true,
    showLoading: options.display?.showLoading ?? true,
    showClear: options.display?.showClear ?? false,
  };

  const [messages, setMessages] = useState<Message[]>(options.initialMessages ?? []);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(
    config.conversationId
  );

  const clientRef = useRef<RedClient>(new RedClient(config));
  const eventSourceRef = useRef<EventSource | null>(null);
  const contentRef = useRef("");
  const thinkingRef = useRef("");
  const toolsRef = useRef<Map<string, ToolExecution>>(new Map());
  const assistantIdRef = useRef("");

  // Update client when config changes
  useEffect(() => {
    clientRef.current = new RedClient(config);
  }, [config]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const updateAssistantMessage = useCallback(
    (updates: Partial<Message>) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantIdRef.current ? { ...m, ...updates } : m
        )
      );
    },
    []
  );

  const handleEvent = useCallback(
    (event: RunEvent) => {
      switch (event.type) {
        case "init": {
          const e = event as InitEvent;
          if (e.existingContent) {
            contentRef.current = e.existingContent;
            updateAssistantMessage({ content: e.existingContent });
          }
          if (e.existingThinking) {
            thinkingRef.current = e.existingThinking;
            updateAssistantMessage({ thinking: e.existingThinking });
          }
          break;
        }

        case "chunk": {
          const e = event as ChunkEvent;
          if (e.thinking) {
            thinkingRef.current += e.content;
            updateAssistantMessage({ thinking: thinkingRef.current });
          } else {
            contentRef.current += e.content;
            updateAssistantMessage({
              content: contentRef.current,
              isStreaming: true,
            });
          }
          break;
        }

        case "thinking_complete": {
          updateAssistantMessage({ thinking: thinkingRef.current });
          break;
        }

        case "tool_start": {
          const e = event as ToolStartEvent;
          const tool: ToolExecution = {
            toolId: e.toolId,
            toolName: e.toolName,
            toolType: e.toolType,
            status: "running",
            startedAt: e.timestamp,
            steps: [],
          };
          toolsRef.current.set(e.toolId, tool);
          updateAssistantMessage({
            toolExecutions: Array.from(toolsRef.current.values()),
          });
          break;
        }

        case "tool_progress": {
          const e = event as ToolProgressEvent;
          const tool = toolsRef.current.get(e.toolId);
          if (tool) {
            tool.steps.push({
              name: e.step,
              timestamp: e.timestamp,
              progress: e.progress,
              data: e.data,
            });
            toolsRef.current.set(e.toolId, { ...tool });
            updateAssistantMessage({
              toolExecutions: Array.from(toolsRef.current.values()),
            });
          }
          break;
        }

        case "tool_complete": {
          const e = event as ToolCompleteEvent;
          const tool = toolsRef.current.get(e.toolId);
          if (tool) {
            tool.status = "completed";
            tool.completedAt = e.timestamp;
            tool.duration = e.timestamp - tool.startedAt;
            tool.result = e.result;
            toolsRef.current.set(e.toolId, { ...tool });
            updateAssistantMessage({
              toolExecutions: Array.from(toolsRef.current.values()),
            });
          }
          break;
        }

        case "tool_error": {
          const e = event as ToolErrorEvent;
          const tool = toolsRef.current.get(e.toolId);
          if (tool) {
            tool.status = "error";
            tool.completedAt = e.timestamp;
            tool.error = e.error;
            toolsRef.current.set(e.toolId, { ...tool });
            updateAssistantMessage({
              toolExecutions: Array.from(toolsRef.current.values()),
            });
          }
          break;
        }

        case "run_complete": {
          const finalMessage: Message = {
            id: assistantIdRef.current,
            role: "assistant",
            content: contentRef.current,
            thinking: thinkingRef.current || undefined,
            timestamp: new Date(),
            isStreaming: false,
            toolExecutions: Array.from(toolsRef.current.values()),
          };
          updateAssistantMessage({ isStreaming: false });
          setIsStreaming(false);
          setIsConnected(false);
          eventSourceRef.current?.close();
          onResponse?.(finalMessage);
          break;
        }

        case "run_error": {
          const e = event as { error: string } & RunEvent;
          setIsStreaming(false);
          setIsConnected(false);
          eventSourceRef.current?.close();
          updateAssistantMessage({ isStreaming: false });
          onError?.(new Error(e.error));
          break;
        }
      }
    },
    [updateAssistantMessage, onResponse, onError]
  );

  const send = useCallback(
    async (content: string) => {
      if (isStreaming || !content.trim()) return;

      // Create user message
      const userMsg: Message = {
        id: genId("usr"),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      // Build messages array for API
      const apiMessages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];

      if (systemPrompt) {
        apiMessages.push({ role: "system", content: systemPrompt });
      }

      // Include conversation history
      for (const m of messages) {
        apiMessages.push({ role: m.role, content: m.content });
      }

      apiMessages.push({ role: "user", content: userMsg.content });

      // Create placeholder assistant message
      const assistantMsg: Message = {
        id: genId("ast"),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      assistantIdRef.current = assistantMsg.id;
      contentRef.current = "";
      thinkingRef.current = "";
      toolsRef.current.clear();

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      onMessage?.(userMsg);

      try {
        const res = await clientRef.current.sendMessage(apiMessages, {
          conversationId,
        });

        // Update conversation ID from response
        if (res.conversationId) {
          setConversationId(res.conversationId);
        }

        // Connect to SSE stream
        const es = clientRef.current.connectStream(res.streamUrl);
        eventSourceRef.current = es;

        es.onopen = () => setIsConnected(true);

        es.onmessage = (evt) => {
          if (evt.data === "[DONE]") {
            es.close();
            setIsStreaming(false);
            setIsConnected(false);
            return;
          }
          try {
            const runEvent = JSON.parse(evt.data) as RunEvent;
            onStreamEvent?.(runEvent);
            handleEvent(runEvent);
          } catch {
            // Ignore unparseable events
          }
        };

        es.onerror = () => {
          // EventSource auto-reconnects; only handle if closed
          if (es.readyState === EventSource.CLOSED) {
            setIsStreaming(false);
            setIsConnected(false);
          }
        };
      } catch (err) {
        setIsStreaming(false);
        updateAssistantMessage({
          content: "Sorry, something went wrong. Please try again.",
          isStreaming: false,
        });
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [
      isStreaming,
      messages,
      conversationId,
      systemPrompt,
      handleEvent,
      updateAssistantMessage,
      onMessage,
      onError,
      onStreamEvent,
    ]
  );

  const clear = useCallback(() => {
    eventSourceRef.current?.close();
    setMessages([]);
    setIsStreaming(false);
    setIsConnected(false);
    setConversationId(undefined);
    contentRef.current = "";
    thinkingRef.current = "";
    toolsRef.current.clear();
  }, []);

  return { messages, isStreaming, isConnected, conversationId, display: resolvedDisplay, send, clear };
}
