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
  | "run_error";

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
