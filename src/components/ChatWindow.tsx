import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import type { Message, RedTheme } from "../types.js";

interface ChatWindowProps {
  messages: Message[];
  isStreaming: boolean;
  onSend: (content: string) => void;
  onClose: () => void;
  title: string;
  placeholder: string;
  theme: RedTheme;
  renderMessage?: (message: Message) => React.ReactNode;
}

export function ChatWindow({
  messages,
  isStreaming,
  onSend,
  onClose,
  title,
  placeholder,
  theme,
  renderMessage,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setInput("");
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [input, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Auto-resize textarea
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    },
    []
  );

  const styles = getStyles(theme);

  return (
    <div style={styles.window}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.redDot} />
          <span style={styles.headerTitle}>{title}</span>
        </div>
        <button
          onClick={onClose}
          style={styles.closeButton}
          aria-label="Close chat"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4L12 12M12 4L4 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyDot} />
            <p style={styles.emptyText}>
              Hi, I&apos;m <strong style={{ color: theme.primary }}>Red</strong>.
              How can I help?
            </p>
          </div>
        )}
        {messages.map((msg) =>
          renderMessage ? (
            <div key={msg.id}>{renderMessage(msg)}</div>
          ) : (
            <MessageBubble key={msg.id} message={msg} theme={theme} />
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputArea}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isStreaming}
          rows={1}
          style={styles.textarea}
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          style={{
            ...styles.sendButton,
            opacity: isStreaming || !input.trim() ? 0.4 : 1,
          }}
          aria-label="Send message"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ---- Message Bubble ----

function MessageBubble({
  message,
  theme,
}: {
  message: Message;
  theme: RedTheme;
}) {
  const isUser = message.role === "user";

  const bubbleStyle: React.CSSProperties = {
    maxWidth: "85%",
    padding: "8px 12px",
    borderRadius: "12px",
    fontSize: "14px",
    lineHeight: "1.5",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
    alignSelf: isUser ? "flex-end" : "flex-start",
    backgroundColor: isUser ? theme.primary : theme.surface,
    color: isUser ? "#fff" : theme.text,
    border: isUser ? "none" : `1px solid ${theme.border}`,
  };

  const toolsStyle: React.CSSProperties = {
    fontSize: "12px",
    color: theme.textMuted,
    marginTop: "4px",
    padding: "4px 8px",
    borderRadius: "6px",
    backgroundColor: theme.surface,
    border: `1px solid ${theme.border}`,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: "8px",
      }}
    >
      {/* Tool executions (shown above assistant message) */}
      {!isUser &&
        message.toolExecutions?.map((tool) => (
          <div key={tool.toolId} style={toolsStyle}>
            <span style={{ color: theme.primary }}>
              {tool.status === "running" ? "⟳" : tool.status === "completed" ? "✓" : "✗"}
            </span>{" "}
            {tool.toolName}
            {tool.status === "running" && "..."}
          </div>
        ))}

      {/* Thinking indicator */}
      {!isUser && message.thinking && message.isStreaming && (
        <div
          style={{
            ...toolsStyle,
            fontStyle: "italic",
            marginBottom: "4px",
          }}
        >
          thinking...
        </div>
      )}

      <div style={bubbleStyle}>
        {message.content || (message.isStreaming ? "" : "...")}
        {message.isStreaming && !message.content && (
          <span style={{ opacity: 0.5 }}>●</span>
        )}
      </div>
    </div>
  );
}

// ---- Styles ----

function getStyles(theme: RedTheme) {
  return {
    window: {
      display: "flex",
      flexDirection: "column" as const,
      width: "380px",
      maxWidth: "calc(100vw - 32px)",
      height: "520px",
      maxHeight: "calc(100vh - 100px)",
      backgroundColor: theme.background,
      border: `1px solid ${theme.border}`,
      borderRadius: theme.radius,
      boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
      fontFamily: theme.fontFamily,
      overflow: "hidden",
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 16px",
      borderBottom: `1px solid ${theme.border}`,
      flexShrink: 0 as const,
    },
    headerLeft: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    redDot: {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      backgroundColor: theme.primary,
    },
    headerTitle: {
      fontSize: "14px",
      fontWeight: 600,
      color: theme.text,
    },
    closeButton: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: theme.textMuted,
      padding: "4px",
      display: "flex",
      alignItems: "center",
      borderRadius: "4px",
    },
    messages: {
      flex: 1,
      overflowY: "auto" as const,
      padding: "16px",
      display: "flex",
      flexDirection: "column" as const,
    },
    emptyState: {
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      gap: "12px",
    },
    emptyDot: {
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      backgroundColor: theme.primary,
    },
    emptyText: {
      fontSize: "14px",
      color: theme.textMuted,
      textAlign: "center" as const,
      margin: 0,
    },
    inputArea: {
      display: "flex",
      alignItems: "flex-end",
      gap: "8px",
      padding: "12px 16px",
      borderTop: `1px solid ${theme.border}`,
      flexShrink: 0 as const,
    },
    textarea: {
      flex: 1,
      resize: "none" as const,
      border: `1px solid ${theme.border}`,
      borderRadius: "8px",
      padding: "8px 12px",
      fontSize: "14px",
      lineHeight: "1.5",
      fontFamily: theme.fontFamily,
      backgroundColor: theme.surface,
      color: theme.text,
      outline: "none",
      maxHeight: "120px",
    },
    sendButton: {
      flexShrink: 0 as const,
      width: "32px",
      height: "32px",
      borderRadius: "8px",
      border: "none",
      backgroundColor: theme.primary,
      color: "#fff",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "opacity 0.15s",
    },
  };
}
