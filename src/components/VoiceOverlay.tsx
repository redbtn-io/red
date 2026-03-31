import { useCallback, useMemo } from "react";
import type { VoiceOverlayProps } from "../types.js";

/**
 * VoiceOverlay -- fullscreen voice interaction overlay.
 *
 * Press-and-hold the logo to record. Visual pulse rings react to
 * recording amplitude and voice phase (idle, recording, transcribing,
 * thinking, speaking).
 *
 * All styling is inline + injected keyframes. No external CSS dependencies.
 */
export function VoiceOverlay({
  isOpen,
  onClose,
  voice,
  logoUrl,
  accentColor = "#dc2626",
}: VoiceOverlayProps) {
  const { phase, amplitude, permission, error: voiceError, startRecording, stopRecording } = voice;

  const canRecord =
    permission === "granted" && phase === "idle" && !voiceError;
  const isBusy =
    phase === "thinking" || phase === "speaking" || phase === "transcribing";

  // ---- Pointer handlers ----

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!canRecord) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      startRecording();
    },
    [canRecord, startRecording]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      stopRecording();
    },
    [stopRecording]
  );

  const handlePointerLeave = useCallback(() => {
    if (phase === "recording") stopRecording();
  }, [phase, stopRecording]);

  // ---- Dynamic styles based on phase + amplitude ----

  const ringStyles = useMemo(() => {
    const outerBase = 176; // 11rem
    const innerBase = 128; // 8rem

    if (phase === "recording") {
      const outerScale = 1 + 0.15 + amplitude * 0.6;
      const innerScale = 1 + 0.1 + amplitude * 0.4;
      const outerOpacity = 0.08 + amplitude * 0.35;
      const innerOpacity = 0.15 + amplitude * 0.55;

      return {
        outer: {
          width: outerBase,
          height: outerBase,
          transform: `scale(${outerScale})`,
          opacity: outerOpacity,
          backgroundColor: hexToRgba(accentColor, 0.2),
          transition: "transform 0.08s linear, opacity 0.08s linear",
        },
        inner: {
          width: innerBase,
          height: innerBase,
          transform: `scale(${innerScale})`,
          opacity: innerOpacity,
          backgroundColor: hexToRgba(accentColor, 0.3),
          transition: "transform 0.08s linear, opacity 0.08s linear",
        },
      };
    }

    // For non-recording states, use CSS animations (applied via className/animation)
    return {
      outer: {
        width: outerBase,
        height: outerBase,
        backgroundColor:
          phase === "thinking"
            ? "rgba(251, 146, 60, 0.15)"
            : hexToRgba(accentColor, phase === "speaking" ? 0.2 : 0.1),
        animation:
          phase === "thinking"
            ? "red-voice-outer-thinking 1.8s ease-in-out infinite"
            : phase === "speaking"
              ? "red-voice-outer-speaking 2.2s ease-in-out infinite"
              : "red-voice-outer-idle 2.8s ease-in-out infinite",
      },
      inner: {
        width: innerBase,
        height: innerBase,
        backgroundColor:
          phase === "thinking"
            ? "rgba(251, 146, 60, 0.2)"
            : hexToRgba(accentColor, phase === "speaking" ? 0.25 : 0.15),
        animation:
          phase === "thinking"
            ? "red-voice-inner-thinking 1.8s ease-in-out infinite 0.15s"
            : phase === "speaking"
              ? "red-voice-inner-speaking 2.2s ease-in-out infinite 0.2s"
              : "red-voice-inner-idle 2.8s ease-in-out infinite 0.2s",
      },
    };
  }, [phase, amplitude, accentColor]);

  const logoStyle = useMemo((): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: 96,
      height: 96,
      borderRadius: "50%",
      overflow: "hidden",
      cursor: canRecord ? "pointer" : "default",
      border: "none",
      background: "none",
      padding: 0,
      outline: "none",
      position: "relative",
      userSelect: "none",
      WebkitUserSelect: "none",
      touchAction: "none",
    };

    if (phase === "recording") {
      const scale = 1 + 0.08 + amplitude * 0.25;
      return {
        ...base,
        transform: `scale(${scale})`,
        transition: "transform 0.08s linear",
        boxShadow: `0 0 ${8 + amplitude * 24}px rgba(239,68,68,${0.4 + amplitude * 0.5}), 0 0 0 2px ${hexToRgba(accentColor, 0.6)}`,
      };
    }

    if (phase === "speaking") {
      return {
        ...base,
        animation: "red-voice-logo-speaking 2.2s ease-in-out infinite",
        boxShadow: `0 0 16px ${hexToRgba(accentColor, 0.5)}, 0 0 0 2px ${hexToRgba(accentColor, 0.4)}`,
      };
    }

    if (phase === "thinking") {
      return {
        ...base,
        animation: "red-voice-logo-thinking 1.8s ease-in-out infinite",
        boxShadow: "0 0 12px rgba(251,146,60,0.4)",
      };
    }

    if (!canRecord && !isBusy) {
      return {
        ...base,
        opacity: 0.4,
        cursor: "not-allowed",
        animation: "red-voice-logo-idle 2.8s ease-in-out infinite",
      };
    }

    return {
      ...base,
      animation: "red-voice-logo-idle 2.8s ease-in-out infinite",
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    };
  }, [phase, amplitude, accentColor, canRecord, isBusy]);

  // ---- Status label ----

  const statusLabel = useMemo(() => {
    if (voiceError) return { text: voiceError, color: accentColor };
    if (phase === "speaking")
      return { text: "Speaking...", color: accentColor };
    if (phase === "thinking")
      return { text: "Thinking...", color: "#fb923c" };
    if (phase === "transcribing")
      return { text: "Transcribing...", color: "rgba(255,255,255,0.6)" };
    if (phase === "recording")
      return { text: "Recording...", color: accentColor };
    if (permission === "prompt")
      return {
        text: "Requesting microphone...",
        color: "rgba(255,255,255,0.4)",
      };
    return { text: "Hold to speak", color: "rgba(255,255,255,0.5)" };
  }, [phase, permission, voiceError, accentColor]);

  const statusAnimation = useMemo(() => {
    if (voiceError) return "none";
    if (phase === "speaking")
      return "red-voice-label-pulse 2.2s ease-in-out infinite";
    if (phase === "thinking")
      return "red-voice-label-pulse 1.8s ease-in-out infinite";
    if (phase === "transcribing")
      return "red-voice-label-pulse 1.2s ease-in-out infinite";
    if (phase === "recording")
      return "red-voice-label-pulse 0.9s ease-in-out infinite";
    return "red-voice-label-pulse 2.8s ease-in-out infinite";
  }, [phase, voiceError]);

  if (!isOpen) return null;

  // ---- Permission denied/unavailable fallback ----

  if (permission === "denied" || permission === "unavailable") {
    return (
      <>
        <div style={styles.backdrop}>
          <div style={styles.closeButton} onClick={onClose} role="button" tabIndex={0} aria-label="Close voice overlay">
            <CloseIcon />
          </div>
          <div style={styles.centerContent}>
            <div style={styles.permissionIcon}>
              <MicIcon color="rgba(255,255,255,0.3)" />
            </div>
            <p style={styles.permissionTitle}>
              {permission === "denied"
                ? "Microphone access denied"
                : "Microphone not available"}
            </p>
            <p style={styles.permissionDesc}>
              {permission === "denied"
                ? "Enable microphone access in your browser or system settings, then close and reopen this overlay."
                : "Your browser does not support audio recording or no microphone was found."}
            </p>
            <button onClick={onClose} style={styles.permissionCloseBtn}>
              Close
            </button>
          </div>
        </div>
        <VoiceKeyframes accentColor={accentColor} />
      </>
    );
  }

  // ---- Main recording interface ----

  return (
    <>
      <div style={styles.backdrop}>
        {/* Close button */}
        <div style={styles.closeButton} onClick={onClose} role="button" tabIndex={0} aria-label="Close voice overlay">
          <CloseIcon />
        </div>

        {/* Centered content */}
        <div style={styles.centerContent}>
          {/* Pulse rings + logo */}
          <div style={styles.ringsContainer}>
            {/* Outer ring */}
            <div
              style={{
                ...styles.ring,
                ...ringStyles.outer,
              }}
            />

            {/* Inner ring */}
            <div
              style={{
                ...styles.ring,
                ...ringStyles.inner,
              }}
            />

            {/* Logo button */}
            <button
              style={logoStyle}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              onPointerCancel={handlePointerLeave}
              aria-label={canRecord ? "Hold to record" : phase}
              aria-pressed={phase === "recording"}
              disabled={!canRecord && !isBusy}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Voice assistant"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "50%",
                    pointerEvents: "none",
                  }}
                  draggable={false}
                />
              ) : (
                <DefaultLogo color={accentColor} />
              )}
            </button>
          </div>

          {/* Status label */}
          <p
            style={{
              ...styles.statusLabel,
              color: statusLabel.color,
              animation: statusAnimation,
            }}
          >
            {statusLabel.text}
          </p>
        </div>
      </div>

      <VoiceKeyframes accentColor={accentColor} />
    </>
  );
}

// ---- Internal sub-components ----

function DefaultLogo({ color }: { color: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        backgroundColor: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6L18 18M18 6L6 18" />
    </svg>
  );
}

function MicIcon({ color }: { color: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

/**
 * Inject CSS keyframe animations for voice overlay.
 * Rendered only when the overlay is open.
 */
function VoiceKeyframes({ accentColor }: { accentColor: string }) {
  return (
    <style>{`
      @keyframes red-voice-overlay-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes red-voice-outer-idle {
        0%, 100% { transform: scale(1); opacity: 0.35; }
        50% { transform: scale(1.14); opacity: 0.12; }
      }

      @keyframes red-voice-inner-idle {
        0%, 100% { transform: scale(1); opacity: 0.55; }
        50% { transform: scale(1.08); opacity: 0.25; }
      }

      @keyframes red-voice-outer-thinking {
        0%, 100% { transform: scale(1); opacity: 0.2; }
        25% { transform: scale(1.18); opacity: 0.35; }
        50% { transform: scale(1.06); opacity: 0.15; }
        75% { transform: scale(1.18); opacity: 0.35; }
      }

      @keyframes red-voice-inner-thinking {
        0%, 100% { transform: scale(1); opacity: 0.35; }
        25% { transform: scale(1.12); opacity: 0.5; }
        50% { transform: scale(1.04); opacity: 0.25; }
        75% { transform: scale(1.12); opacity: 0.5; }
      }

      @keyframes red-voice-outer-speaking {
        0%, 100% { transform: scale(1); opacity: 0.25; }
        25% { transform: scale(1.2); opacity: 0.45; }
        50% { transform: scale(1.08); opacity: 0.2; }
        75% { transform: scale(1.2); opacity: 0.45; }
      }

      @keyframes red-voice-inner-speaking {
        0%, 100% { transform: scale(1); opacity: 0.4; }
        25% { transform: scale(1.14); opacity: 0.6; }
        50% { transform: scale(1.05); opacity: 0.3; }
        75% { transform: scale(1.14); opacity: 0.6; }
      }

      @keyframes red-voice-logo-idle {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.04); }
      }

      @keyframes red-voice-logo-thinking {
        0%, 100% { transform: scale(1); }
        25% { transform: scale(1.06); }
        50% { transform: scale(1.02); }
        75% { transform: scale(1.06); }
      }

      @keyframes red-voice-logo-speaking {
        0%, 100% { transform: scale(1); }
        25% { transform: scale(1.08); }
        50% { transform: scale(1.03); }
        75% { transform: scale(1.08); }
      }

      @keyframes red-voice-label-pulse {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
      }

      /* Ensure the close button has hover effect without external CSS */
      [data-red-voice-close]:hover {
        color: rgba(255,255,255,0.9) !important;
        background-color: rgba(255,255,255,0.1) !important;
      }
    `}</style>
  );
}

// ---- Utility ----

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(220, 38, 38, ${alpha})`;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---- Static styles ----

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 100000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    animation: "red-voice-overlay-in 0.2s ease-out",
  },
  closeButton: {
    position: "absolute",
    top: 20,
    right: 20,
    padding: 8,
    borderRadius: "50%",
    color: "rgba(255,255,255,0.4)",
    cursor: "pointer",
    transition: "color 0.15s, background-color 0.15s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  centerContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 32,
    userSelect: "none",
  },
  ringsContainer: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 200,
    height: 200,
  },
  ring: {
    position: "absolute",
    borderRadius: "50%",
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: "0.05em",
    margin: 0,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  permissionIcon: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: 500,
    margin: 0,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  permissionDesc: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    lineHeight: 1.6,
    margin: 0,
    maxWidth: 280,
    textAlign: "center",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  permissionCloseBtn: {
    marginTop: 8,
    padding: "8px 20px",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "white",
    border: "none",
    fontSize: 14,
    cursor: "pointer",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
};
