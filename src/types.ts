// ---- Config ----

export interface RedConfig {
  /** Base URL of the redbtn API (e.g. "https://app.redbtn.io") */
  apiUrl: string;
  /** Auth token (JWT) — if not provided, falls back to cookie auth */
  token?: string;
  /** Graph ID to use for this Red instance */
  graphId?: string;
  /** Conversation ID to resume — if omitted, a new conversation starts */
  conversationId?: string;
  /** Model name (defaults to "Red") */
  model?: string;
  /** Custom headers to include on every API request */
  headers?: Record<string, string>;
  /** Source identifier for tracking (e.g. "redbtn.io", "redfleet", "redrun") */
  source?: string;
  /** Override the chat completions endpoint path (default: "/api/v1/chat/completions") */
  chatEndpoint?: string;
}

// ---- Messages ----

export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  thinking?: string;
  isStreaming?: boolean;
  toolExecutions?: ToolExecution[];
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  model?: string;
  tokens?: { input?: number; output?: number; total?: number };
  status?: string;
  conversationId?: string;
  runId?: string;
}

// ---- Tool Executions ----

export type ToolStatus = "running" | "completed" | "error";

export interface ToolStep {
  name: string;
  timestamp: number;
  data?: Record<string, unknown>;
  progress?: number;
}

export interface ToolExecution {
  toolId: string;
  toolName: string;
  toolType: string;
  status: ToolStatus;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  steps: ToolStep[];
  result?: unknown;
  error?: string;
}

// ---- SSE Run Events ----

export type RunEventType =
  | "init"
  | "run_start"
  | "chunk"
  | "thinking_complete"
  | "status"
  | "node_start"
  | "node_progress"
  | "node_complete"
  | "node_error"
  | "graph_start"
  | "graph_complete"
  | "graph_error"
  | "tool_start"
  | "tool_progress"
  | "tool_complete"
  | "tool_error"
  | "run_complete"
  | "run_error"
  | "audio_chunk";

export interface RunEvent {
  type: RunEventType;
  timestamp: number;
  [key: string]: unknown;
}

export interface ChunkEvent extends RunEvent {
  type: "chunk";
  content: string;
  thinking?: boolean;
}

export interface InitEvent extends RunEvent {
  type: "init";
  state: unknown;
  existingContent: string;
  existingThinking: string;
}

export interface ToolStartEvent extends RunEvent {
  type: "tool_start";
  toolId: string;
  toolName: string;
  toolType: string;
  input?: unknown;
}

export interface ToolProgressEvent extends RunEvent {
  type: "tool_progress";
  toolId: string;
  step: string;
  progress?: number;
  data?: Record<string, unknown>;
}

export interface ToolCompleteEvent extends RunEvent {
  type: "tool_complete";
  toolId: string;
  result?: unknown;
  metadata?: Record<string, unknown>;
}

export interface ToolErrorEvent extends RunEvent {
  type: "tool_error";
  toolId: string;
  error: string;
}

export interface RunCompleteEvent extends RunEvent {
  type: "run_complete";
  metadata?: {
    model?: string;
    tokens?: { input?: number; output?: number; total?: number };
  };
}

export interface RunErrorEvent extends RunEvent {
  type: "run_error";
  error: string;
}

export interface AudioChunkEvent extends RunEvent {
  type: "audio_chunk";
  /** Base64-encoded audio data */
  audio: string;
  /** Audio format: mp3, wav, ogg */
  format?: "mp3" | "wav" | "ogg";
}

// ---- Chat Completions API ----

export interface ChatRequest {
  model?: string;
  messages: Array<{ role: MessageRole; content: string }>;
  stream?: boolean;
  conversationId?: string;
  graphId?: string;
  source?: string;
  [key: string]: unknown;
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  conversationId: string;
  runId: string;
  messageId: string;
  userMessageId: string;
  streamUrl: string;
}

export interface ChatError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

// ---- Component Props ----

export interface RedDisplayOptions {
  /** Show tool execution indicators (default: true) */
  showTools?: boolean;
  /** Show thinking/reasoning indicators (default: true) */
  showThinking?: boolean;
  /** Show a loading spinner while waiting for first content (default: true) */
  showLoading?: boolean;
  /** Show a clear/reset conversation button (default: false) */
  showClear?: boolean;
}

export interface RedProps {
  /** Configuration for the Red instance */
  config: RedConfig;
  /** Initial system prompt to prepend to conversations */
  systemPrompt?: string;
  /** Placeholder text for the input field */
  placeholder?: string;
  /** Title shown in the chat header */
  title?: string;
  /** Whether the chat starts open */
  defaultOpen?: boolean;
  /** Position of the floating button */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Custom CSS class for the container */
  className?: string;
  /** Display options for tools, thinking, loading indicators */
  display?: RedDisplayOptions;
  /** Callback when a message is sent */
  onMessage?: (message: Message) => void;
  /** Callback when a response completes */
  onResponse?: (message: Message) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Callback when chat is opened/closed */
  onToggle?: (open: boolean) => void;
  /** Custom render for the trigger button (replaces default red button) */
  renderTrigger?: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  /** Custom render for message bubbles */
  renderMessage?: (message: Message) => React.ReactNode;
  /** Theme overrides */
  theme?: Partial<RedTheme>;
  /** Enable voice input/output (mic button + voice overlay) */
  enableVoice?: boolean;
  /** Voice endpoint configuration */
  voiceConfig?: VoiceConfig;
}

export interface RedTheme {
  /** Primary accent color (default: #dc2626) */
  primary: string;
  /** Background color */
  background: string;
  /** Surface/card color */
  surface: string;
  /** Text color */
  text: string;
  /** Muted text color */
  textMuted: string;
  /** Border color */
  border: string;
  /** Border radius for the chat window */
  radius: string;
  /** Font family */
  fontFamily: string;
}

// ---- Voice ----

export type VoicePhase = "idle" | "recording" | "transcribing" | "thinking" | "speaking";

export type VoicePermission = "prompt" | "granted" | "denied" | "unavailable";

export interface VoiceConfig {
  /** API endpoint for speech-to-text (default: "/api/v1/voice/transcribe") */
  transcribeUrl?: string;
  /** API endpoint for text-to-speech (default: "/api/v1/voice/synthesize") */
  synthesizeUrl?: string;
}

export interface UseVoiceOptions {
  /** Base URL for API calls (from RedConfig.apiUrl) */
  apiUrl?: string;
  /** Auth token for API calls */
  token?: string;
  /** API endpoint for STT (default: "/api/v1/voice/transcribe") */
  transcribeUrl?: string;
  /** API endpoint for TTS (default: "/api/v1/voice/synthesize") */
  synthesizeUrl?: string;
  /** Called when transcription completes */
  onTranscription?: (text: string) => void;
  /** Called when voice phase changes */
  onPhaseChange?: (phase: VoicePhase) => void;
  /** Called on errors */
  onError?: (error: Error) => void;
}

export interface UseVoiceReturn {
  /** Current voice phase */
  phase: VoicePhase;
  /** True when phase is not idle */
  isActive: boolean;
  /** Call on pointerdown to start recording (also unlocks AudioContext for iOS) */
  startRecording: () => void;
  /** Call on pointerup to stop recording and begin transcription */
  stopRecording: () => void;
  /** Feed streaming text content for progressive TTS chunking + synthesis */
  pushTtsText: (text: string) => void;
  /** Feed a pre-synthesized audio blob for direct playback (server-side TTS) */
  pushTtsAudio: (blob: Blob) => void;
  /** Flush remaining TTS text buffer (call when stream completes) */
  flushTts: () => void;
  /** Set phase externally (e.g. "thinking" after sending a message) */
  setPhase: (phase: VoicePhase) => void;
  /** Stop everything and reset to idle */
  reset: () => void;
  /** Current recording amplitude (0-1) for visualizations */
  amplitude: number;
  /** Microphone permission state */
  permission: VoicePermission;
  /** Any error message */
  error: string | null;
}

export interface VoiceOverlayProps {
  /** Whether the overlay is open */
  isOpen: boolean;
  /** Close the overlay */
  onClose: () => void;
  /** Voice hook return value */
  voice: UseVoiceReturn;
  /** Logo image URL (defaults to a red circle) */
  logoUrl?: string;
  /** Accent color for pulses (defaults to theme primary / #dc2626) */
  accentColor?: string;
}
