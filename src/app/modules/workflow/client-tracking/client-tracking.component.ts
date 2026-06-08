import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { WebSocketService } from '../../../core/services/websocket.service';

interface TaskView {
  name: string;
  status: string;
  assignedUserId: string;
}

interface DepartmentView {
  departmentName: string;
  tasks: TaskView[];
}

interface InstanceView {
  instanceId: string;
  status: string;
  createdAt: string;
  policyName?: string;
  departments: DepartmentView[];
}

@Component({
  selector: 'app-client-tracking',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="trk-page">
      <header class="trk-header">
        <div>
          <p class="trk-eyebrow">Portal del cliente</p>
          <h1 class="trk-title">Mis solicitudes</h1>
        </div>
        <div class="trk-header-right">
          <span class="ws-dot" [class.ws-dot--on]="wsConnected"
                [title]="wsConnected ? 'Actualizaciones en vivo' : 'Sin conexión en vivo'"></span>
          <button class="btn-refresh" type="button" (click)="load()" [disabled]="loading">
            <span [class.spin]="loading">↻</span> Refrescar
          </button>
          <a class="btn-new" routerLink="/workflow/nueva-solicitud">+ Nueva solicitud</a>
        </div>
      </header>

      <!-- Loading -->
      <div class="loading-state" *ngIf="loading">
        <div class="loader-bar"></div>
        <p>Cargando tus solicitudes...</p>
      </div>

      <!-- Error -->
      <div class="error-state" *ngIf="!loading && error">
        <span class="error-icon">⚠</span>
        <p>{{ error }}</p>
        <button class="btn-primary" (click)="load()">Reintentar</button>
      </div>

      <!-- Empty -->
      <div class="empty-state" *ngIf="!loading && !error && instances.length === 0">
        <span class="empty-glyph">◇</span>
        <h3>No tienes solicitudes</h3>
        <p>Inicia tu primer trámite desde el portal.</p>
        <a class="btn-primary" routerLink="/workflow/nueva-solicitud">Crear solicitud</a>
      </div>

      <!-- Instance list -->
      <div class="instance-list" *ngIf="!loading && !error && instances.length > 0">
        <div class="instance-card" *ngFor="let inst of instances; let i = index"
             [class.instance-card--expanded]="expandedIndex === i">
          <div class="instance-hdr" (click)="toggleExpand(i)">
            <div class="instance-hdr-left">
              <span class="instance-id">#{{ shortId(inst.instanceId) }}</span>
              <span class="instance-policy" *ngIf="inst.policyName">{{ inst.policyName }}</span>
            </div>
            <div class="instance-hdr-right">
              <span class="status-pill"
                    [class.sp--active]="inst.status === 'ACTIVE' || inst.status === 'IN_PROGRESS'"
                    [class.sp--completed]="inst.status === 'COMPLETED'"
                    [class.sp--rejected]="inst.status === 'REJECTED'"
                    [class.sp--pending]="inst.status === 'PENDING'">
                {{ statusLabel(inst.status) }}
              </span>
              <span class="instance-date">{{ inst.createdAt | date:'dd/MM/yy HH:mm' }}</span>
              <span class="chevron">{{ expandedIndex === i ? '▾' : '▸' }}</span>
            </div>
          </div>

          <div class="instance-body" *ngIf="expandedIndex === i">
            <!-- Progress indicator -->
            <div class="progress-track" *ngIf="inst.departments.length > 0">
              <div class="progress-step" *ngFor="let dept of inst.departments; let di = index">
                <span class="step-dot"
                      [class.step-dot--done]="isDeptDone(dept)"
                      [class.step-dot--active]="isDeptActive(dept)"></span>
                <span class="step-label">{{ dept.departmentName }}</span>
              </div>
            </div>

            <div class="dept-section" *ngFor="let dept of inst.departments">
              <div class="dept-hdr">
                <span class="dept-icon">◈</span>
                <span class="dept-name">{{ dept.departmentName }}</span>
                <span class="dept-count">{{ dept.tasks.length }} tarea{{ dept.tasks.length !== 1 ? 's' : '' }}</span>
              </div>
              <div class="task-rows">
                <div class="task-row" *ngFor="let task of dept.tasks">
                  <span class="task-name">{{ task.name }}</span>
                  <span class="task-status"
                        [class.ts--progress]="task.status === 'IN_PROGRESS'"
                        [class.ts--completed]="task.status === 'COMPLETED'"
                        [class.ts--pending]="task.status === 'PENDING'">
                    {{ statusLabel(task.status) }}
                  </span>
                </div>
              </div>
            </div>
            <div class="no-depts" *ngIf="inst.departments.length === 0">
              Tu solicitud está siendo procesada
            </div>
            <div class="instance-footer">
              <a class="btn-open" [routerLink]="['/workflow', inst.instanceId]">
                Ver documentos →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    :host {
      display: block;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      --green-dk: #08420c;
      --green-lt: #e1f5a6;
      --green-mid: #1a6b22;
      --surface: #fafaf9;
      --card-bg: #fff;
      --border: rgba(0,0,0,.08);
      --text-1: #1a1a1a;
      --text-2: #555;
      --text-3: #888;
    }

    .trk-page {
      padding: 28px 32px;
      max-width: 960px;
      margin: 0 auto;
    }

    .trk-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 28px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .trk-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .12em;
      color: var(--green-mid);
      margin: 0 0 4px;
    }

    .trk-title {
      font-size: 22px;
      font-weight: 800;
      color: var(--text-1);
      margin: 0;
      letter-spacing: -.02em;
    }

    .trk-header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .ws-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ccc;
      flex-shrink: 0;
    }
    .ws-dot--on {
      background: #4caf50;
      box-shadow: 0 0 6px rgba(76,175,80,.4);
    }

    .btn-refresh {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 7px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text-2);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s;
      font-family: inherit;
    }
    .btn-refresh:hover { border-color: var(--green-mid); color: var(--green-mid); }
    .btn-refresh:disabled { opacity: .5; cursor: default; }

    .btn-new {
      display: inline-flex;
      align-items: center;
      padding: 8px 16px;
      border-radius: 7px;
      background: var(--green-mid);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: background .15s;
    }
    .btn-new:hover { background: var(--green-dk); }

    .spin { display: inline-block; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* States */
    .loading-state, .error-state, .empty-state {
      text-align: center;
      padding: 56px 24px;
      color: var(--text-3);
    }

    .loader-bar {
      width: 120px;
      height: 3px;
      margin: 0 auto 16px;
      background: rgba(0,0,0,.06);
      border-radius: 2px;
      overflow: hidden;
      position: relative;
    }
    .loader-bar::after {
      content: '';
      position: absolute;
      left: -40%;
      width: 40%;
      height: 100%;
      background: var(--green-mid);
      border-radius: 2px;
      animation: slide 1.2s ease-in-out infinite;
    }
    @keyframes slide {
      0% { left: -40%; }
      100% { left: 100%; }
    }

    .error-icon { font-size: 28px; display: block; margin-bottom: 8px; }
    .error-state { color: #c0392b; }
    .empty-glyph { font-size: 36px; display: block; margin-bottom: 12px; opacity: .3; }
    .empty-state h3 { font-size: 16px; color: var(--text-1); margin: 0 0 6px; }
    .empty-state p { font-size: 14px; margin: 0 0 20px; }

    .btn-primary {
      display: inline-block;
      padding: 10px 24px;
      background: var(--green-mid);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      font-family: inherit;
    }
    .btn-primary:hover { background: var(--green-dk); }

    /* Instance cards */
    .instance-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .instance-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      transition: box-shadow .15s;
    }
    .instance-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,.06); }

    .instance-hdr {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      cursor: pointer;
      user-select: none;
      gap: 12px;
    }

    .instance-hdr-left { display: flex; align-items: center; gap: 10px; min-width: 0; }

    .instance-id {
      font-size: 12px;
      font-weight: 700;
      color: var(--green-mid);
      background: rgba(26,107,34,.08);
      padding: 3px 8px;
      border-radius: 5px;
      white-space: nowrap;
    }

    .instance-policy {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-1);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .instance-hdr-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .instance-date { font-size: 12px; color: var(--text-3); font-variant-numeric: tabular-nums; }
    .chevron { font-size: 12px; color: var(--text-3); width: 16px; text-align: center; }

    .status-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 999px;
      background: #f0f0f0;
      color: var(--text-2);
    }
    .sp--active { background: #e8f5e9; color: #2e7d32; }
    .sp--completed { background: #e3f2fd; color: #1565c0; }
    .sp--rejected { background: #fce4ec; color: #c62828; }
    .sp--pending { background: #fff8e1; color: #f57f17; }

    .instance-body {
      border-top: 1px solid var(--border);
      padding: 16px 18px;
      background: #fcfcfb;
      animation: fadeIn .2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Progress track */
    .progress-track {
      display: flex;
      align-items: center;
      gap: 0;
      margin-bottom: 20px;
      padding: 12px 0;
    }

    .progress-step {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      position: relative;
    }

    .progress-step::before {
      content: '';
      position: absolute;
      top: 5px;
      left: -50%;
      right: 50%;
      height: 2px;
      background: rgba(0,0,0,.08);
    }
    .progress-step:first-child::before { display: none; }

    .step-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #e0e0e0;
      border: 2px solid #fff;
      box-shadow: 0 0 0 1px rgba(0,0,0,.08);
      position: relative;
      z-index: 1;
    }
    .step-dot--done { background: var(--green-mid); }
    .step-dot--active {
      background: #fff;
      border-color: var(--green-mid);
      box-shadow: 0 0 0 1px var(--green-mid), 0 0 8px rgba(26,107,34,.2);
    }

    .step-label {
      font-size: 10px;
      color: var(--text-3);
      margin-top: 6px;
      text-align: center;
      max-width: 80px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dept-section { margin-bottom: 16px; }
    .dept-section:last-child { margin-bottom: 0; }

    .dept-hdr { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .dept-icon { color: var(--green-mid); font-size: 12px; }
    .dept-name { font-size: 13px; font-weight: 700; color: var(--text-1); }
    .dept-count { font-size: 11px; color: var(--text-3); margin-left: auto; }

    .task-rows { display: flex; flex-direction: column; gap: 4px; padding-left: 20px; }

    .task-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
    }

    .task-name {
      flex: 1;
      font-weight: 500;
      color: var(--text-1);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .task-status {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      background: #f0f0f0;
      color: var(--text-2);
      white-space: nowrap;
    }
    .ts--progress { background: #fff3e0; color: #e65100; }
    .ts--completed { background: #e8f5e9; color: #2e7d32; }
    .ts--pending { background: #f3e5f5; color: #6a1b9a; }

    .no-depts {
      font-size: 13px;
      color: var(--text-3);
      padding: 12px;
      text-align: center;
    }

    .instance-footer {
      display: flex;
      justify-content: flex-end;
      padding: 12px;
      border-top: 1px solid rgba(0,0,0,.06);
    }
    .btn-open {
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      color: #16a34a;
      padding: 6px 14px;
      border: 1px solid #16a34a;
      border-radius: 8px;
      transition: all .15s ease;
    }
    .btn-open:hover { background: #16a34a; color: #fff; }

    @media (max-width: 640px) {
      .trk-page { padding: 16px; }
      .trk-header { flex-direction: column; align-items: flex-start; }
      .instance-hdr { flex-direction: column; align-items: flex-start; gap: 8px; }
      .instance-hdr-right { width: 100%; justify-content: flex-start; flex-wrap: wrap; }
      .progress-track { display: none; }
    }
  `]
})
export class ClientTrackingComponent implements OnInit, OnDestroy {
  instances: InstanceView[] = [];
  loading = true;
  error: string | null = null;
  expandedIndex: number | null = null;
  wsConnected = false;
  private subs: Subscription[] = [];

  constructor(
    private api: ApiService,
    private wsService: WebSocketService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
    this.setupWebSocket();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.api.get<any>('/api/workflow/instances/my-requests/overview').subscribe({
      next: (raw) => {
        this.instances = this.normalize(raw);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err.error?.message || 'Error al cargar tus solicitudes';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private setupWebSocket(): void {
    this.wsService.connect();
    this.subs.push(
      this.wsService.isConnected().subscribe(c => {
        this.wsConnected = c;
        this.cdr.detectChanges();
      }),
      this.wsService.instanceUpdates$.subscribe(() => {
        // Reload on instance status change
        this.load();
      })
    );
  }

  toggleExpand(index: number): void {
    this.expandedIndex = this.expandedIndex === index ? null : index;
  }

  shortId(id: string): string {
    if (!id) return '—';
    return id.length > 8 ? id.substring(0, 8) : id;
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      'ACTIVE': 'Activo',
      'IN_PROGRESS': 'En curso',
      'COMPLETED': 'Completado',
      'REJECTED': 'Rechazado',
      'PENDING': 'Pendiente',
      'CANCELLED': 'Cancelado',
    };
    return map[status] || status || 'Desconocido';
  }

  isDeptDone(dept: DepartmentView): boolean {
    return dept.tasks.length > 0 && dept.tasks.every(t =>
      t.status === 'COMPLETED' || t.status === 'DONE'
    );
  }

  isDeptActive(dept: DepartmentView): boolean {
    return dept.tasks.some(t => t.status === 'IN_PROGRESS');
  }

  private normalize(raw: unknown): InstanceView[] {
    const arr = this.extractArray(raw);
    return arr.map((item: any) => ({
      instanceId: item.instanceId || item.id || '',
      status: item.status || 'PENDING',
      createdAt: item.createdAt || item.startedAt || '',
      policyName: item.policyName || item.definitionName || item.processName || '',
      departments: this.normalizeDepartments(item.departments || item.lanes || []),
    }));
  }

  private normalizeDepartments(raw: unknown): DepartmentView[] {
    const arr = this.extractArray(raw);
    return arr.map((dept: any) => ({
      departmentName: dept.departmentName || dept.laneName || dept.name || 'Sin departamento',
      tasks: this.normalizeTasks(dept.tasks || []),
    }));
  }

  private normalizeTasks(raw: unknown): TaskView[] {
    const arr = this.extractArray(raw);
    return arr.map((t: any) => ({
      name: t.name || t.nodeLabel || t.taskName || 'Tarea',
      status: t.status || 'PENDING',
      assignedUserId: t.assignedUserId || t.assigneeId || t.assignee || '',
    }));
  }

  private extractArray(value: unknown): any[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;
      for (const key of ['items', 'content', 'data', 'instances', 'results']) {
        if (Array.isArray(record[key])) return record[key] as any[];
      }
    }
    return [];
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
  }
}
