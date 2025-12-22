/**
 * Automation Models
 * 
 * Export all automation-related models and types
 */

export {
  Automation,
  TriggerType,
  AutomationStatus,
  OutputActionType,
  generateAutomationId,
  type IAutomation,
  type IAutomationDocument,
  type ITriggerConfig,
  type IOutputAction
} from './Automation';

export {
  AutomationRun,
  RunStatus,
  generateRunId,
  calculateExpiresAt,
  type IAutomationRun,
  type IAutomationRunDocument,
  type IRunLogEntry
} from './AutomationRun';
