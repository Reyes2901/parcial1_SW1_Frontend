export class Analytics {}

export interface DashboardSummary {
  totalActiveInstances: number;
  totalCompletedToday: number;
  totalRejectedToday: number;
  totalOverdueTasks: number;
  globalCompletionRatePct: number;
  avgResolutionHours: number;
  topPolicies: PolicyUsage[];
  activeBottlenecks: BottleneckReport[];
  departmentLoad: DepartmentLoad[];
}

export interface PolicyUsage {
  definitionId: string;
  definitionName: string;
  totalInstances: number;
  activeInstances: number;
}

export interface BottleneckReport {
  taskId: string;
  instanceId: string;
  nodeLabel: string;
  laneName: string;
  assigneeId: string;
  overdueMinutes: number;
  priority: string;
  dueAt: string;
}

export interface DepartmentLoad {
  laneId: string;
  laneName: string;
  pendingTasks: number;
  inProgressTasks: number;
  completedToday: number;
}

export interface NodeStats {
  nodeId: string;
  nodeLabel: string;
  laneId: string;
  laneName: string;
  totalTasks: number;
  avgDurationMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  overdueCount: number;
  overdueRatePct: number;
  estimatedVsRealRatio: number;
}

export interface PolicyStats {
  definitionId: string;
  definitionName: string;
  totalInstances: number;
  completedInstances: number;
  rejectedInstances: number;
  activeInstances: number;
  completionRatePct: number;
  avgTotalDurationHours: number;
  nodeStats: NodeStats[];
  bottleneckNodeId: string;
  bottleneckNodeLabel: string;
}

export interface UserPerformance {
  userId: string;
  totalCompleted: number;
  avgDurationMinutes: number;
  onTimeRatePct: number;
  currentPending: number;
  currentInProgress: number;
}