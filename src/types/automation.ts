/**
 * Shared Automation Types
 * 
 * These types are used by both frontend pages and backend API routes
 * to ensure consistency between the two.
 */

/**
 * Trigger types for automations
 */
export type TriggerType = 'webhook' | 'schedule' | 'event' | 'manual';

/**
 * Automation status
 */
export type AutomationStatus = 'active' | 'paused' | 'disabled' | 'error';

/**
 * Run status
 */
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

/**
 * Output action types
 */
export type OutputActionType = 'webhook' | 'email' | 'store' | 'log';

/**
 * Trigger configuration
 */
export interface TriggerConfig {
  // For schedule triggers
  cron?: string;
  timezone?: string;
  
  // For webhook triggers
  secret?: string;
  allowedIps?: string[];
  
  // For event triggers
  eventType?: string;
  filters?: Record<string, unknown>;
}

/**
 * Trigger definition
 */
export interface Trigger {
  type: TriggerType;
  config?: TriggerConfig;
}

/**
 * Output action
 */
export interface OutputAction {
  type: OutputActionType;
  config: {
    url?: string;
    email?: string;
    headers?: Record<string, string>;
  };
  enabled: boolean;
}

/**
 * Automation stats
 */
export interface AutomationStats {
  runCount: number;
  successCount: number;
  failureCount: number;
  lastError?: string;
}

/**
 * Full automation object (returned by detail endpoints)
 */
export interface Automation {
  automationId: string;
  name: string;
  description?: string;
  graphId: string;
  trigger: Trigger;
  inputMapping?: Record<string, unknown>;
  outputActions?: OutputAction[];
  status: AutomationStatus;
  isEnabled: boolean;
  stats: AutomationStats;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Automation summary (returned by list endpoints)
 */
export interface AutomationSummary {
  automationId: string;
  name: string;
  description?: string;
  graphId: string;
  trigger: Trigger;
  status: AutomationStatus;
  isEnabled: boolean;
  stats: AutomationStats;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Automation run object
 */
export interface AutomationRun {
  runId: string;
  automationId: string;
  status: RunStatus;
  triggeredBy: TriggerType | 'chat';
  input?: Record<string, unknown>;
  output?: string | Record<string, unknown>;
  error?: string;
  durationMs?: number;
  startedAt: string;
  completedAt?: string;
}

/**
 * Create automation request
 */
export interface CreateAutomationRequest {
  name: string;
  description?: string;
  graphId: string;
  trigger: Trigger;
  inputMapping?: Record<string, unknown>;
  outputActions?: OutputAction[];
}

/**
 * Update automation request
 */
export interface UpdateAutomationRequest {
  name?: string;
  description?: string;
  trigger?: Trigger;
  inputMapping?: Record<string, unknown>;
  outputActions?: OutputAction[];
  isEnabled?: boolean;
}

/**
 * Pagination info
 */
export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * List automations response
 */
export interface ListAutomationsResponse {
  success: boolean;
  automations: AutomationSummary[];
  pagination: Pagination;
}

/**
 * Get automation response
 */
export interface GetAutomationResponse {
  success: boolean;
  automation: Automation;
}

/**
 * List runs response
 */
export interface ListRunsResponse {
  success: boolean;
  runs: AutomationRun[];
  pagination: Pagination;
}
