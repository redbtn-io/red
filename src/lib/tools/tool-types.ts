/**
 * Frontend Tool Execution State Management
 * 
 * Tracks tool executions for each message, mirroring the backend event protocol.
 */

export type ToolEventType = 
  | 'tool_start'
  | 'tool_progress'
  | 'tool_complete'
  | 'tool_error';

export type ToolType = 
  | 'thinking'
  | 'web_search'
  | 'database_query'
  | 'code_execution'
  | 'file_operation'
  | 'api_call'
  | 'memory_retrieval'
  | 'custom';

export interface ToolExecution {
  toolId: string;
  toolType: ToolType;
  toolName: string;
  status: 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  duration?: number;
  
  // Progress tracking
  steps: ToolStep[];
  currentStep?: string;
  progress?: number;
  
  // Streaming content (for thinking, code output, etc.)
  streamingContent?: string;
  
  // Results and metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface ToolStep {
  step: string;
  timestamp: number;
  progress?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

/**
 * Get icon and color for tool type
 */
export function getToolDisplay(toolType: ToolType): {
  icon: string;
  color: string;
  bgColor: string;
} {
  const displays = {
    thinking: {
      icon: '🧠',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    web_search: {
      icon: '🔍',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    database_query: {
      icon: '💾',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    code_execution: {
      icon: '⚡',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
    file_operation: {
      icon: '📁',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
    api_call: {
      icon: '🌐',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
    },
    memory_retrieval: {
      icon: '🗂️',
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/10',
    },
    custom: {
      icon: '🔧',
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
    },
  };

  return displays[toolType] || displays.custom;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
