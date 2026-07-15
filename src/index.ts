// Components
export { Red } from "./components/Red.js";
export { ChatWindow } from "./components/ChatWindow.js";
export { VoiceOverlay } from "./components/VoiceOverlay.js";

// Hooks
export { useRed } from "./hooks/useRed.js";
export { useVoice } from "./hooks/useVoice.js";

// Client
export { RedClient } from "./lib/client.js";

// Types
export type {
  RedConfig,
  RedProps,
  RedTheme,
  RedDisplayOptions,
  Message,
  MessageRole,
  MessageMetadata,
  ToolExecution,
  ToolStep,
  ToolStatus,
  RunEvent,
  RunEventType,
  ChunkEvent,
  InitEvent,
  ToolStartEvent,
  ToolProgressEvent,
  ToolCompleteEvent,
  ToolErrorEvent,
  RunCompleteEvent,
  RunErrorEvent,
  AudioChunkEvent,
  ChatRequest,
  ChatResponse,
  ChatError,
  VoicePhase,
  VoicePermission,
  VoiceConfig,
  UseVoiceOptions,
  UseVoiceReturn,
  VoiceOverlayProps,
} from "./types.js";
