// Components
export { Red } from "./components/Red.js";
export { ChatWindow } from "./components/ChatWindow.js";

// Hooks
export { useRed } from "./hooks/useRed.js";

// Client
export { RedClient } from "./lib/client.js";

// Types
export type {
  RedConfig,
  RedProps,
  RedTheme,
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
  ChatRequest,
  ChatResponse,
  ChatError,
} from "./types.js";
