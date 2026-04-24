import { FormSchema } from "./policy.model";

export class Instance {}

export interface AuditEntry {
  nodeId: string;
  nodeLabel: string;
  action: string; // NODE_STARTED, NODE_COMPLETED, REJECTED
  userId: string;
  timestamp: string;
  durationMinutes?: number;
  transitionTaken?: string;
  formData?: any;
}

export interface ProcessInstance {
  id?: string;
  definitionId: string;
  definitionName?: string;
  definitionVersion?: string;
  status: string; // IN_PROGRESS, COMPLETED, REJECTED, CANCELLED
  currentNodeId?: string;
  currentNodeLabel?: string;
  clientId?: string;
  clientName: string;
  clientData?: any;
  variables?: any;
  auditLog: AuditEntry[];
  startedAt?: string;
  completedAt?: string;
  dueDate?: string;
}

export interface TaskInstance {
  id?: string;
  instanceId: string;
  definitionId?: string;
  nodeId: string;
  nodeLabel: string;
  laneId?: string;
  assigneeId?: string;
  assigneeRole?: string;
  status: string; // PENDING, IN_PROGRESS, COMPLETED, REJECTED
  priority?: string; // LOW, NORMAL, HIGH, URGENT
  formSchema?: FormSchema;
  formSubmission?: any;
  formSubmissionId?: string;
  clientName?: string;
  createdAt?: string;
  dueAt?: string;
  startedAt?: string;
  completedAt?: string;
  durationMinutes?: number;
}

export interface StartProcessRequest {
  definitionId: string;
  clientName: string;
  clientData?: any;
}

export interface ProcessHistoryResponse {
  instanceId: string;
  definitionName: string;
  status: string;
  clientName: string;
  startedAt: string;
  completedAt?: string;
  progressPct: number;
  auditLog: AuditEntry[];
  tasks: TaskSummary[];
}

export interface TaskSummary {
  nodeLabel: string;
  status: string;
  assigneeId: string;
  durationMinutes: number;
  completedAt: string;
  formData: any;
}