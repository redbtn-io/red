import { useState, useCallback, useMemo } from "react";
import { useRed } from "../hooks/useRed.js";
import { ChatWindow } from "./ChatWindow.js";
import type { RedProps, RedTheme } from "../types.js";

const DEFAULT_THEME: RedTheme = {
  primary: "#dc2626",
  background: "#ffffff",
  surface: "#f5f5f5",
  text: "#171717",
  textMuted: "#737373",
  border: "#e5e5e5",
  radius: "16px",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const DARK_THEME: Partial<RedTheme> = {
  background: "#0a0a0a",
  surface: "#1a1a1a",
  text: "#ededed",
  textMuted: "#a3a3a3",
  border: "#333333",
};

const POSITIONS = {
  "bottom-right": { bottom: "16px", right: "16px" },
  "bottom-left": { bottom: "16px", left: "16px" },
  "top-right": { top: "16px", right: "16px" },
  "top-left": { top: "16px", left: "16px" },
} as const;

const WINDOW_POSITIONS = {
  "bottom-right": { bottom: "72px", right: "16px" },
  "bottom-left": { bottom: "72px", left: "16px" },
  "top-right": { top: "72px", right: "16px" },
  "top-left": { top: "72px", left: "16px" },
} as const;

export function Red({
  config,
  systemPrompt,
  placeholder = "Ask Red anything...",
  title = "Red",
  defaultOpen = false,
  position = "bottom-right",
  className,
  onMessage,
  onResponse,
  onError,
  onToggle,
  renderTrigger,
  renderMessage,
  theme: themeOverrides,
}: RedProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Detect dark mode via media query
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches;

  const theme = useMemo<RedTheme>(() => {
    const base = prefersDark
      ? { ...DEFAULT_THEME, ...DARK_THEME }
      : DEFAULT_THEME;
    return { ...base, ...themeOverrides };
  }, [prefersDark, themeOverrides]);

  const { messages, isStreaming, send, clear } = useRed({
    config,
    systemPrompt,
    onMessage,
    onResponse,
    onError,
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      onToggle?.(next);
      return next;
    });
  }, [onToggle]);

  const handleClose = useCallback(() => {
    setOpen(false);
    onToggle?.(false);
  }, [onToggle]);

  // Allow parent to clear conversation
  void clear;

  return (
    <div
      className={className}
      style={{
        position: "fixed",
        zIndex: 99999,
        ...POSITIONS[position],
      }}
    >
      {/* Chat window */}
      {open && (
        <div
          style={{
            position: "fixed",
            ...WINDOW_POSITIONS[position],
            zIndex: 99999,
            animation: "red-fade-in 0.15s ease-out",
          }}
        >
          <ChatWindow
            messages={messages}
            isStreaming={isStreaming}
            onSend={send}
            onClose={handleClose}
            title={title}
            placeholder={placeholder}
            theme={theme}
            renderMessage={renderMessage}
          />
        </div>
      )}

      {/* Trigger button */}
      {renderTrigger ? (
        renderTrigger({ open, toggle })
      ) : (
        <button
          onClick={toggle}
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor: theme.primary,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: open
              ? `0 0 0 3px ${theme.primary}33`
              : "0 2px 8px rgba(0,0,0,0.15)",
            transition: "box-shadow 0.2s, transform 0.15s",
            transform: open ? "scale(0.95)" : "scale(1)",
          }}
          aria-label={open ? "Close Red" : "Open Red"}
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5L15 15M15 5L5 15"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 5H17M3 10H13M3 15H17"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      )}

      {/* Inject keyframe animation */}
      <style>{`
        @keyframes red-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
