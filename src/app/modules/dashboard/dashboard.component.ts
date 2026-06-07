import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import {
  BottleneckReport,
  DashboardSummary,
  DepartmentLoad,
  PolicyUsage,
} from '../../core/models/analytics.model';
import { ApiService } from '../../core/services/api.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { TaskService } from '../task/services/task.service';

interface DashboardTask {
  id: string;
  title: string;
  assignee: string;
  statusCode: string;
  statusLabel: string;
  dueAt: string | null;
  updatedAt: string | null;
  isOverdue: boolean;
}

interface AdminStats {
  activeWorkflows: number;
  completedToday: number;
  rejectedToday: number;
  pendingRequests: number;
  completionRate: number;
  avgResolutionHours: number;
}

interface DashboardRequest {
  id: string;
  title: string;
  status: string;
  createdAt: string | null;
}

interface PolicyCard {
  id: string;
  name: string;
  activeInstances: number;
  totalInstances: number;
}

interface QuickAction {
  title: string;
  description: string;
  route: string;
  disabled?: boolean;
}

interface AdminCapability {
  route: string;
  title: string;
  capability: string;
  status: 'active' | 'pending';
}

interface KpiCard {
  key: string;
  label: string;
  value: number;
  helper: string;
}

interface PulseItem {
  label: string;
  value: string;
  helper: string;
  highlight?: boolean;
}

interface ChartSlice {
  label: string;
  value: number;
  tone: 'positive' | 'neutral' | 'warning';
}

interface WorkloadPoint {
  label: string;
  value: number;
}

interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  occurredAt: string | null;
  severity: 'critical' | 'warning' | 'neutral';
}

interface WidgetState {
  loading: boolean;
  empty: boolean;
  degraded: boolean;
}

type WidgetKey = 'pulse' | 'kpi' | 'charts' | 'tasks' | 'bottlenecks' | 'activity';
type SourceStatus = 'primary' | 'fallback' | 'empty';

interface SourceResult<T> {
  data: T;
  status: SourceStatus;
}

interface LoadWithFallbackOptions<T> {
  primary$: Observable<T | null>;
  fallback$?: Observable<T | null>;
  empty: T;
}

interface DashboardSources {
  dashboardSource: SourceResult<DashboardSummary>;
  tasksSource: SourceResult<DashboardTask[]>;
  adminStatsSource: SourceResult<AdminStats>;
  policiesSource: SourceResult<PolicyCard[]>;
  requestsSource: SourceResult<DashboardRequest[]>;
  bottlenecksSource: SourceResult<BottleneckReport[]>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, DecimalPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  providers: [DecimalPipe],
})
export class DashboardComponent implements OnInit {
  isLoading = true;
  showGlobalEmpty = false;
  refreshedAt = new Date();

  summary: DashboardSummary = this.emptyDashboard();
  adminStats: AdminStats = this.emptyAdminStats();
  kpiCards: KpiCard[] = [];
  pulseItems: PulseItem[] = [];
  throughputSeries: ChartSlice[] = [];
  workloadSeries: WorkloadPoint[] = [];
  recentTasks: DashboardTask[] = [];
  bottleneckItems: BottleneckReport[] = [];
  requestItems: DashboardRequest[] = [];
  policyItems: PolicyCard[] = [];
  activityFeed: ActivityItem[] = [];

  widgetState: Record<WidgetKey, WidgetState> = {
    pulse: { loading: true, empty: false, degraded: false },
    kpi: { loading: true, empty: false, degraded: false },
    charts: { loading: true, empty: false, degraded: false },
    tasks: { loading: true, empty: false, degraded: false },
    bottlenecks: { loading: true, empty: false, degraded: false },
    activity: { loading: true, empty: false, degraded: false },
  };

  /** Icons for sidebar / quick-actions list (matches quickActions order) */
  readonly navIcons: string[] = ['⊞', '📋', '✚', '✅', '⟳', '👤'];

  /** Icon map for KPI cards */
  readonly kpiIcons: Record<string, string> = {
    tasks:     '✅',
    workflows: '⟳',
    policies:  '📋',
    overdue:   '⚠',
  };

  readonly quickActions: QuickAction[] = [
    {
      title: 'Abrir dashboard',
      description: 'Resumen ejecutivo del estado operativo.',
      route: '/dashboard',
    },
    {
      title: 'Gestionar politicas',
      description: 'Administrar politicas publicadas y borradores.',
      route: '/policies',
    },
    {
      title: 'Crear politica',
      description: 'Abrir editor de nuevas politicas.',
      route: '/policies/new',
    },
    {
      title: 'Ver bandeja de tareas',
      description: 'Revisar tareas activas y vencimientos.',
      route: '/tasks',
    },
    {
      title: 'Monitor de workflow',
      description: 'Ruta reservada hasta habilitar modulo visual.',
      route: '/workflow',
      disabled: true,
    },
    {
      title: 'Gestion de usuarios',
      description: 'Ruta no implementada en el proyecto actual.',
      route: '/users',
      disabled: true,
    },
  ];

  readonly adminCapabilities: AdminCapability[] = [
    {
      route: '/dashboard',
      title: 'Dashboard admin',
      capability: 'Monitoreo integral de metricas y alertas.',
      status: 'active',
    },
    {
      route: '/policies',
      title: 'Politicas',
      capability: 'Gestionar politicas y revisar borradores.',
      status: 'active',
    },
    {
      route: '/policies/new',
      title: 'Nueva politica',
      capability: 'Disenar y publicar nuevas politicas.',
      status: 'active',
    },
    {
      route: '/policies/:id/edit',
      title: 'Editar politica',
      capability: 'Ajustar definiciones y republicar.',
      status: 'active',
    },
    {
      route: '/tasks',
      title: 'Bandeja de tareas',
      capability: 'Control y seguimiento de tareas operativas.',
      status: 'active',
    },
    {
      route: '/tasks/:id',
      title: 'Detalle de tarea',
      capability: 'Completar, rechazar o auditar tarea.',
      status: 'active',
    },
    {
      route: '/workflow',
      title: 'Workflow',
      capability: 'Ruta configurada sin vista implementada.',
      status: 'pending',
    },
    {
      route: '/users',
      title: 'Usuarios',
      capability: 'Ruta no disponible en este release.',
      status: 'pending',
    },
  ];

  private readonly api = inject(ApiService);
  private readonly wsService = inject(WebSocketService);
  private readonly taskService = inject(TaskService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.loadDashboard();
    this.listenToRealtimeBottlenecks();
  }

  refresh(): void {
    this.loadDashboard();
  }

  get maxWorkloadValue(): number {
    if (!this.workloadSeries.length) {
      return 1;
    }

    return Math.max(...this.workloadSeries.map((item) => item.value), 1);
  }

  workloadWidth(value: number): string {
    return `${Math.min(Math.max((value / this.maxWorkloadValue) * 100, 8), 100)}%`;
  }

  get maxThroughputValue(): number {
    if (!this.throughputSeries.length) {
      return 1;
    }

    return Math.max(...this.throughputSeries.map((item) => item.value), 1);
  }

  throughputWidth(value: number): string {
    return `${Math.min(Math.max((value / this.maxThroughputValue) * 100, 8), 100)}%`;
  }

  toneClass(severity: ActivityItem['severity']): string {
    if (severity === 'critical') {
      return 'tone-critical';
    }

    if (severity === 'warning') {
      return 'tone-warning';
    }

    return 'tone-neutral';
  }

  private loadDashboard(): void {
    this.markWidgetsLoading();
    this.showGlobalEmpty = false;
    this.isLoading = true;

    this.loadWithFallback<DashboardSummary>({
      primary$: this.api.get<unknown>('/api/analytics/dashboard').pipe(
        map((raw) => this.normalizeDashboard(raw))
      ),
      fallback$: this.api.get<unknown>('/api/workflow/admin/stats').pipe(
        map((raw) => {
          const stats = this.normalizeAdminStats(raw);
          return stats ? this.dashboardFromAdminStats(stats) : null;
        })
      ),
      empty: this.emptyDashboard(),
    })
      .pipe(
        switchMap((dashboardSource) => {
          return forkJoin({
            dashboardSource: of(dashboardSource),
            tasksSource: this.loadWithFallback<DashboardTask[]>({
              primary$: this.taskService
                .getMyTasks()
                .pipe(map((raw) => this.normalizeTasks(raw))),
              empty: [],
            }),
            adminStatsSource: this.loadWithFallback<AdminStats>({
              primary$: this.api.get<unknown>('/api/workflow/admin/stats').pipe(
                map((raw) => this.normalizeAdminStats(raw))
              ),
              fallback$: of(this.adminStatsFromDashboard(dashboardSource.data)),
              empty: this.emptyAdminStats(),
            }),
            policiesSource: this.loadWithFallback<PolicyCard[]>({
              primary$: this.api
                .get<unknown>('/api/policies/active')
                .pipe(map((raw) => this.normalizePolicies(raw))),
              fallback$: of(this.policiesFromTopPolicies(dashboardSource.data.topPolicies)),
              empty: [],
            }),
            requestsSource: this.loadWithFallback<DashboardRequest[]>({
              primary$: this.api
                .get<unknown>('/api/workflow/instances/my-requests')
                .pipe(map((raw) => this.normalizeRequests(raw))),
              fallback$: of(this.deriveRequestsFromDashboard(dashboardSource.data)),
              empty: [],
            }),
            bottlenecksSource: this.loadWithFallback<BottleneckReport[]>({
              primary$: this.api
                .get<unknown>('/api/analytics/bottlenecks')
                .pipe(map((raw) => this.normalizeBottlenecks(raw))),
              fallback$: of(this.normalizeBottlenecks(dashboardSource.data.activeBottlenecks)),
              empty: [],
            }),
          });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (sources) => {
          this.applySources(sources);
          this.refreshedAt = new Date();
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.markWidgetsEmpty();
          this.showGlobalEmpty = true;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  private applySources(sources: DashboardSources): void {
    const tasks = sources.tasksSource.data;
    const workload = this.buildWorkloadSeries(sources.dashboardSource.data.departmentLoad, tasks);
    const overdueTasks = tasks.filter((task) => task.isOverdue).length;
    const overdueCount = Math.max(
      overdueTasks,
      sources.dashboardSource.data.totalOverdueTasks,
      sources.bottlenecksSource.data.length
    );

    this.summary = sources.dashboardSource.data;
    this.adminStats = sources.adminStatsSource.data;
    this.policyItems = sources.policiesSource.data.slice(0, 6);
    this.requestItems = sources.requestsSource.data.slice(0, 6);
    this.bottleneckItems = sources.bottlenecksSource.data.slice(0, 6);
    this.recentTasks = tasks
      .slice()
      .sort((a, b) => this.toTimestamp(b.updatedAt ?? b.dueAt) - this.toTimestamp(a.updatedAt ?? a.dueAt))
      .slice(0, 8);
    this.workloadSeries = workload.slice(0, 6);

    this.kpiCards = [
      {
        key: 'tasks',
        label: 'Total tareas',
        value: tasks.length,
        helper: `${tasks.filter((task) => task.statusCode === 'IN_PROGRESS').length} en curso`,
      },
      {
        key: 'workflows',
        label: 'Workflows activos',
        value: this.adminStats.activeWorkflows,
        helper: `${this.adminStats.completedToday} completados hoy`,
      },
      {
        key: 'policies',
        label: 'Politicas activas',
        value: this.policyItems.length,
        helper: `${this.policyItems.reduce((sum, item) => sum + item.totalInstances, 0)} instancias`,
      },
      {
        key: 'overdue',
        label: 'Tareas vencidas',
        value: overdueCount,
        helper: `${this.bottleneckItems.length} cuellos detectados`,
      },
    ];

    this.pulseItems = [
      {
        label: 'Entrada',
        value: `${tasks.length}`,
        helper: 'Tareas registradas',
      },
      {
        label: 'Flujo',
        value: `${this.adminStats.activeWorkflows}`,
        helper: 'Workflows en ejecucion',
      },
      {
        label: 'Cola',
        value: `${Math.max(this.requestItems.length, this.adminStats.pendingRequests)}`,
        helper: 'Solicitudes pendientes',
      },
      {
        label: 'Riesgo',
        value: `${overdueCount}`,
        helper: 'Eventos que requieren accion',
        highlight: overdueCount > 0,
      },
      {
        label: 'Cumplimiento',
        value: `${this.adminStats.completionRate.toFixed(1)}%`,
        helper: 'Tasa de completacion global',
      },
    ];

    this.throughputSeries = [
      {
        label: 'Completados',
        value: this.adminStats.completedToday,
        tone: 'positive',
      },
      {
        label: 'Pendientes',
        value: Math.max(this.requestItems.length, this.adminStats.pendingRequests),
        tone: 'neutral',
      },
      {
        label: 'Rechazados',
        value: this.adminStats.rejectedToday,
        tone: 'warning',
      },
    ];

    this.activityFeed = this.buildActivityFeed(this.recentTasks, this.bottleneckItems, this.requestItems);

    this.widgetState.pulse = this.resolveWidgetState(
      [sources.dashboardSource, sources.adminStatsSource, sources.requestsSource],
      this.pulseItems.length === 0
    );
    this.widgetState.kpi = this.resolveWidgetState(
      [sources.dashboardSource, sources.adminStatsSource, sources.policiesSource, sources.tasksSource],
      this.kpiCards.length === 0
    );
    this.widgetState.charts = this.resolveWidgetState(
      [sources.dashboardSource, sources.adminStatsSource, sources.tasksSource],
      this.throughputSeries.length === 0 && this.workloadSeries.length === 0
    );
    this.widgetState.tasks = this.resolveWidgetState([sources.tasksSource], this.recentTasks.length === 0);
    this.widgetState.bottlenecks = this.resolveWidgetState(
      [sources.bottlenecksSource],
      this.bottleneckItems.length === 0
    );
    this.widgetState.activity = this.resolveWidgetState(
      [sources.requestsSource, sources.tasksSource, sources.bottlenecksSource],
      this.activityFeed.length === 0
    );

    this.showGlobalEmpty =
      this.widgetState.pulse.empty &&
      this.widgetState.kpi.empty &&
      this.widgetState.charts.empty &&
      this.widgetState.tasks.empty &&
      this.widgetState.bottlenecks.empty &&
      this.widgetState.activity.empty;
  }

  private listenToRealtimeBottlenecks(): void {
    this.wsService.connect();
    this.wsService.bottleneckAlerts$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((alert) => {
      const normalized = this.normalizeSingleBottleneck(alert);
      if (!normalized) {
        return;
      }

      const current = this.bottleneckItems.filter((item) => item.taskId !== normalized.taskId);
      this.bottleneckItems = [normalized, ...current].slice(0, 6);
      const realtimeEvent: ActivityItem = {
        id: `ws-${normalized.taskId}`,
        title: 'Alerta de cuello de botella',
        detail: `${normalized.nodeLabel} en ${normalized.laneName}`,
        occurredAt: normalized.dueAt || null,
        severity: 'critical',
      };

      this.activityFeed = [realtimeEvent, ...this.activityFeed].slice(0, 10);
      this.cdr.detectChanges();
    });
  }

  private loadWithFallback<T>(options: LoadWithFallbackOptions<T>): Observable<SourceResult<T>> {
    return options.primary$.pipe(
      map((data) => {
        if (data === null) {
          return null;
        }

        return { data, status: 'primary' as const };
      }),
      catchError(() => of(null)),
      switchMap((primaryResult) => {
        if (primaryResult) {
          return of(primaryResult);
        }

        if (!options.fallback$) {
          return of({ data: options.empty, status: 'empty' as const });
        }

        return options.fallback$.pipe(
          map((fallbackData) => {
            if (fallbackData === null) {
              return { data: options.empty, status: 'empty' as const };
            }

            return { data: fallbackData, status: 'fallback' as const };
          }),
          catchError(() => of({ data: options.empty, status: 'empty' as const }))
        );
      })
    );
  }

  private resolveWidgetState(sources: SourceResult<unknown>[], isEmpty: boolean): WidgetState {
    return {
      loading: false,
      empty: isEmpty,
      degraded: sources.some((source) => source.status !== 'primary'),
    };
  }

  private markWidgetsLoading(): void {
    for (const key of Object.keys(this.widgetState) as WidgetKey[]) {
      this.widgetState[key] = { loading: true, empty: false, degraded: false };
    }
  }

  private markWidgetsEmpty(): void {
    for (const key of Object.keys(this.widgetState) as WidgetKey[]) {
      this.widgetState[key] = { loading: false, empty: true, degraded: true };
    }
  }

  private buildWorkloadSeries(
    departments: DepartmentLoad[],
    tasks: DashboardTask[]
  ): WorkloadPoint[] {
    if (departments.length > 0) {
      return departments
        .map((department) => ({
          label: department.laneName,
          value: department.pendingTasks + department.inProgressTasks,
        }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value);
    }

    const grouped = new Map<string, number>();
    for (const task of tasks) {
      const key = task.assignee || 'Sin asignar';
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }

    return Array.from(grouped.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  private buildActivityFeed(
    tasks: DashboardTask[],
    bottlenecks: BottleneckReport[],
    requests: DashboardRequest[]
  ): ActivityItem[] {
    const taskEvents: ActivityItem[] = tasks.slice(0, 4).map((task) => ({
      id: `task-${task.id}`,
      title: task.isOverdue ? 'Tarea vencida detectada' : 'Actualizacion de tarea',
      detail: `${task.title} · ${task.statusLabel}`,
      occurredAt: task.updatedAt ?? task.dueAt,
      severity: task.isOverdue ? 'warning' : 'neutral',
    }));

    const bottleneckEvents: ActivityItem[] = bottlenecks.slice(0, 4).map((item) => ({
      id: `bottleneck-${item.taskId}`,
      title: 'Cuello de botella activo',
      detail: `${item.nodeLabel} · ${item.overdueMinutes} min`,
      occurredAt: item.dueAt || null,
      severity: 'critical',
    }));

    const requestEvents: ActivityItem[] = requests.slice(0, 4).map((request) => ({
      id: `request-${request.id}`,
      title: 'Solicitud en seguimiento',
      detail: `${request.title} · ${request.status}`,
      occurredAt: request.createdAt,
      severity: 'neutral',
    }));

    return [...bottleneckEvents, ...taskEvents, ...requestEvents]
      .sort((a, b) => this.toTimestamp(b.occurredAt) - this.toTimestamp(a.occurredAt))
      .slice(0, 10);
  }

  private normalizeDashboard(raw: unknown): DashboardSummary | null {
    const record = this.asRecord(raw);
    if (!record) {
      return null;
    }

    return {
      totalActiveInstances: this.readNumber(record, [
        'totalActiveInstances',
        'activeWorkflows',
        'activeInstances',
      ]),
      totalCompletedToday: this.readNumber(record, ['totalCompletedToday', 'completedToday']),
      totalRejectedToday: this.readNumber(record, ['totalRejectedToday', 'rejectedToday']),
      totalOverdueTasks: this.readNumber(record, ['totalOverdueTasks', 'overdueTasks']),
      globalCompletionRatePct: this.readNumber(record, [
        'globalCompletionRatePct',
        'completionRate',
      ]),
      avgResolutionHours: this.readNumber(record, ['avgResolutionHours', 'avgResolutionTime']),
      topPolicies: this.normalizeTopPolicies(record['topPolicies']),
      activeBottlenecks: this.normalizeBottlenecks(record['activeBottlenecks']),
      departmentLoad: this.normalizeDepartmentLoad(record['departmentLoad']),
    };
  }

  private normalizeAdminStats(raw: unknown): AdminStats | null {
    const record = this.asRecord(raw);
    if (!record) {
      return null;
    }

    return {
      activeWorkflows: this.readNumber(record, [
        'activeWorkflows',
        'totalActiveInstances',
        'activeInstances',
      ]),
      completedToday: this.readNumber(record, ['completedToday', 'totalCompletedToday']),
      rejectedToday: this.readNumber(record, ['rejectedToday', 'totalRejectedToday']),
      pendingRequests: this.readNumber(record, ['pendingRequests', 'pendingCount']),
      completionRate: this.readNumber(record, ['completionRate', 'globalCompletionRatePct']),
      avgResolutionHours: this.readNumber(record, ['avgResolutionHours', 'avgResolutionTime']),
    };
  }

  private normalizeTopPolicies(raw: unknown): PolicyUsage[] {
    return this.extractArray(raw)
      .map((item, index) => {
        const record = this.asRecord(item);
        if (!record) {
          return null;
        }

        const definitionName =
          this.readString(record, ['definitionName', 'name', 'policyName']) ?? `Politica ${index + 1}`;
        const definitionId =
          this.readString(record, ['definitionId', 'id', 'policyId']) ?? `policy-${index}`;

        return {
          definitionId,
          definitionName,
          totalInstances: this.readNumber(record, ['totalInstances', 'instances']),
          activeInstances: this.readNumber(record, ['activeInstances', 'active']),
        };
      })
      .filter((item): item is PolicyUsage => item !== null);
  }

  private normalizePolicies(raw: unknown): PolicyCard[] {
    return this.extractArray(raw)
      .map((item, index) => {
        const record = this.asRecord(item);
        if (!record) {
          return null;
        }

        const id = this.readString(record, ['id', 'definitionId', 'policyId']) ?? `policy-${index}`;
        const name = this.readString(record, ['name', 'definitionName']) ?? 'Politica sin nombre';

        return {
          id,
          name,
          activeInstances: this.readNumber(record, ['activeInstances', 'active']),
          totalInstances: this.readNumber(record, ['totalInstances', 'instances']),
        };
      })
      .filter((item): item is PolicyCard => item !== null);
  }

  private policiesFromTopPolicies(policies: PolicyUsage[]): PolicyCard[] {
    return policies.map((policy) => ({
      id: policy.definitionId,
      name: policy.definitionName,
      activeInstances: policy.activeInstances,
      totalInstances: policy.totalInstances,
    }));
  }

  private normalizeTasks(raw: unknown): DashboardTask[] {
    return this.extractArray(raw)
      .map((item, index) => {
        const record = this.asRecord(item);
        if (!record) {
          return null;
        }

        const statusCode = this.readStatus(record).toUpperCase();
        const dueAt = this.readString(record, ['dueAt', 'deadline', 'dueDate']);
        const updatedAt = this.readString(record, ['updatedAt', 'lastUpdatedAt', 'createdAt']);

        return {
          id:
            this.readString(record, ['taskId', 'id', 'workflowTaskId']) ??
            `task-${index}`,
          title:
            this.readString(record, ['title', 'taskName', 'nodeLabel']) ??
            'Tarea sin titulo',
          assignee:
            this.readString(record, ['assigneeName', 'assigneeId', 'owner']) ??
            'Sin asignar',
          statusCode,
          statusLabel: this.statusLabel(statusCode),
          dueAt,
          updatedAt,
          isOverdue: this.isOverdue(dueAt, statusCode),
        };
      })
      .filter((item): item is DashboardTask => item !== null);
  }

  private normalizeRequests(raw: unknown): DashboardRequest[] {
    return this.extractArray(raw)
      .map((item, index) => {
        const record = this.asRecord(item);
        if (!record) {
          return null;
        }

        return {
          id: this.readString(record, ['id', 'instanceId']) ?? `request-${index}`,
          title:
            this.readString(record, ['title', 'name', 'subject']) ??
            'Solicitud en proceso',
          status: this.readString(record, ['status', 'state']) ?? 'PENDING',
          createdAt: this.readString(record, ['createdAt', 'requestedAt', 'updatedAt']),
        };
      })
      .filter((item): item is DashboardRequest => item !== null);
  }

  private deriveRequestsFromDashboard(summary: DashboardSummary): DashboardRequest[] {
    const pendingCount = Math.max(summary.totalActiveInstances - summary.totalCompletedToday, 0);
    if (pendingCount === 0) {
      return [];
    }

    return [
      {
        id: 'derived-pending',
        title: 'Solicitudes pendientes estimadas',
        status: 'PENDING',
        createdAt: null,
      },
    ];
  }

  private normalizeBottlenecks(raw: unknown): BottleneckReport[] {
    return this.extractArray(raw)
      .map((item) => this.normalizeSingleBottleneck(item))
      .filter((item): item is BottleneckReport => item !== null)
      .sort((a, b) => b.overdueMinutes - a.overdueMinutes);
  }

  private normalizeSingleBottleneck(raw: unknown): BottleneckReport | null {
    const record = this.asRecord(raw);
    if (!record) {
      return null;
    }

    const taskId = this.readString(record, ['taskId', 'id']);
    if (!taskId) {
      return null;
    }

    return {
      taskId,
      instanceId: this.readString(record, ['instanceId']) ?? 'N/A',
      nodeLabel: this.readString(record, ['nodeLabel', 'nodeName']) ?? 'Nodo sin nombre',
      laneName: this.readString(record, ['laneName', 'departmentName']) ?? 'Sin area',
      assigneeId: this.readString(record, ['assigneeId', 'assignee']) ?? 'Sin asignar',
      overdueMinutes: this.readNumber(record, ['overdueMinutes', 'delayMinutes']),
      priority: this.readString(record, ['priority']) ?? 'MEDIA',
      dueAt: this.readString(record, ['dueAt']) ?? '',
    };
  }

  private normalizeDepartmentLoad(raw: unknown): DepartmentLoad[] {
    return this.extractArray(raw)
      .map((item, index) => {
        const record = this.asRecord(item);
        if (!record) {
          return null;
        }

        return {
          laneId: this.readString(record, ['laneId', 'id']) ?? `lane-${index}`,
          laneName: this.readString(record, ['laneName', 'name']) ?? 'Area sin nombre',
          pendingTasks: this.readNumber(record, ['pendingTasks', 'pending']),
          inProgressTasks: this.readNumber(record, ['inProgressTasks', 'inProgress']),
          completedToday: this.readNumber(record, ['completedToday']),
        };
      })
      .filter((item): item is DepartmentLoad => item !== null);
  }

  private dashboardFromAdminStats(stats: AdminStats): DashboardSummary {
    return {
      totalActiveInstances: stats.activeWorkflows,
      totalCompletedToday: stats.completedToday,
      totalRejectedToday: stats.rejectedToday,
      totalOverdueTasks: 0,
      globalCompletionRatePct: stats.completionRate,
      avgResolutionHours: stats.avgResolutionHours,
      topPolicies: [],
      activeBottlenecks: [],
      departmentLoad: [],
    };
  }

  private adminStatsFromDashboard(summary: DashboardSummary): AdminStats {
    const pendingApprox = Math.max(
      summary.totalActiveInstances - summary.totalCompletedToday - summary.totalRejectedToday,
      0
    );

    return {
      activeWorkflows: summary.totalActiveInstances,
      completedToday: summary.totalCompletedToday,
      rejectedToday: summary.totalRejectedToday,
      pendingRequests: pendingApprox,
      completionRate: summary.globalCompletionRatePct,
      avgResolutionHours: summary.avgResolutionHours,
    };
  }

  private emptyDashboard(): DashboardSummary {
    return {
      totalActiveInstances: 0,
      totalCompletedToday: 0,
      totalRejectedToday: 0,
      totalOverdueTasks: 0,
      globalCompletionRatePct: 0,
      avgResolutionHours: 0,
      topPolicies: [],
      activeBottlenecks: [],
      departmentLoad: [],
    };
  }

  private emptyAdminStats(): AdminStats {
    return {
      activeWorkflows: 0,
      completedToday: 0,
      rejectedToday: 0,
      pendingRequests: 0,
      completionRate: 0,
      avgResolutionHours: 0,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private extractArray(value: unknown): unknown[] {
    if (Array.isArray(value)) {
      return value;
    }

    const record = this.asRecord(value);
    if (!record) {
      return [];
    }

    const candidateKeys = ['items', 'content', 'data', 'results', 'tasks', 'requests'];
    for (const key of candidateKeys) {
      const candidate = record[key];
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }

    return [];
  }

  private readString(source: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string') {
        const normalized = value.trim();
        if (normalized.length > 0) {
          return normalized;
        }
      }
    }

    return null;
  }

  private readNumber(source: Record<string, unknown>, keys: string[]): number {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return 0;
  }

  private readStatus(source: Record<string, unknown>): string {
    return (
      this.readString(source, ['status', 'state', 'taskStatus']) ??
      'PENDING'
    );
  }

  private statusLabel(statusCode: string): string {
    if (statusCode === 'IN_PROGRESS') {
      return 'En curso';
    }

    if (statusCode === 'ASSIGNED') {
      return 'Asignada';
    }

    if (statusCode === 'COMPLETED' || statusCode === 'DONE') {
      return 'Completada';
    }

    if (statusCode === 'REJECTED') {
      return 'Rechazada';
    }

    return 'Pendiente';
  }

  private isClosedStatus(statusCode: string): boolean {
    return ['COMPLETED', 'DONE', 'REJECTED', 'CANCELLED', 'CLOSED'].includes(statusCode);
  }

  private isOverdue(dueAt: string | null, statusCode: string): boolean {
    if (!dueAt || this.isClosedStatus(statusCode)) {
      return false;
    }

    const dueTime = new Date(dueAt).getTime();
    if (Number.isNaN(dueTime)) {
      return false;
    }

    return dueTime < Date.now();
  }

  private toTimestamp(value: string | null): number {
    if (!value) {
      return 0;
    }

    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) {
      return 0;
    }

    return timestamp;
  }
}
