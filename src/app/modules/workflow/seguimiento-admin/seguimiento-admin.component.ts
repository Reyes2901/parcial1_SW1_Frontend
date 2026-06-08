import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

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
  selector: 'app-seguimiento-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="seg-page">
      <header class="seg-header">
        <div>
          <p class="seg-eyebrow">Administración</p>
          <h1 class="seg-title">Seguimiento de trámites</h1>
        </div>
        <button class="btn-refresh" type="button" (click)="load()" [disabled]="loading">
          <span [class.spin]="loading">↻</span> Refrescar
        </button>
      </header>

      <!-- Loading -->
      <div class="loading-state" *ngIf="loading">
        <div class="loader-bar"></div>
        <p>Cargando trámites...</p>
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
        <p>No hay trámites disponibles</p>
      </div>

      <!-- Instance list -->
      <div class="instance-list" *ngIf="!loading && !error && instances.length > 0">
        <div class="instance-card" *ngFor="let inst of instances; let i = index"
             [class.instance-card--expanded]="expandedIndex === i">
          <!-- Instance header -->
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

          <!-- Expanded departments -->
          <div class="instance-body" *ngIf="expandedIndex === i">
            <div class="dept-section" *ngFor="let dept of inst.departments">
              <div class="dept-hdr">
                <span class="dept-icon">◈</span>
                <span class="dept-name">{{ dept.departmentName }}</span>
                <span class="dept-count">{{ dept.tasks.length }} tarea{{ dept.tasks.length !== 1 ? 's' : '' }}</span>
              </div>
              <div class="task-rows">
                <div class="task-row" *ngFor="let task of dept.tasks">
                  <span class="task-name">{{ task.name }}</span>
                  <span class="task-assignee">{{ task.assignedUserId || 'Sin asignar' }}</span>
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
              Sin departamentos registrados
            </div>
            <div class="instance-footer">
              <a class="btn-open" [routerLink]="['/workflow', inst.instanceId]">
                Abrir trámite →
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

    .seg-page {
      padding: 28px 32px;
      max-width: 960px;
      margin: 0 auto;
    }

    .seg-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 28px;
    }

    .seg-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .12em;
      color: var(--green-mid);
      margin: 0 0 4px;
    }

    .seg-title {
      font-size: 22px;
      font-weight: 800;
      color: var(--text-1);
      margin: 0;
      letter-spacing: -.02em;
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
    }
    .btn-refresh:hover { border-color: var(--green-mid); color: var(--green-mid); }
    .btn-refresh:disabled { opacity: .5; cursor: default; }

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
    .empty-glyph { font-size: 32px; display: block; margin-bottom: 8px; opacity: .4; }

    .btn-primary {
      padding: 8px 20px;
      background: var(--green-mid);
      color: #fff;
      border: none;
      border-radius: 7px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 12px;
    }

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
    .instance-card:hover {
      box-shadow: 0 2px 12px rgba(0,0,0,.06);
    }

    .instance-hdr {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      cursor: pointer;
      user-select: none;
      gap: 12px;
    }

    .instance-hdr-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

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

    .instance-date {
      font-size: 12px;
      color: var(--text-3);
      font-variant-numeric: tabular-nums;
    }

    .chevron {
      font-size: 12px;
      color: var(--text-3);
      width: 16px;
      text-align: center;
    }

    /* Status pills */
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

    /* Expanded body */
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

    .dept-section {
      margin-bottom: 16px;
    }
    .dept-section:last-child { margin-bottom: 0; }

    .dept-hdr {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .dept-icon {
      color: var(--green-mid);
      font-size: 12px;
    }

    .dept-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-1);
    }

    .dept-count {
      font-size: 11px;
      color: var(--text-3);
      margin-left: auto;
    }

    .task-rows {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-left: 20px;
    }

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
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .task-assignee {
      font-size: 12px;
      color: var(--text-3);
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
      .seg-page { padding: 16px; }
      .instance-hdr { flex-direction: column; align-items: flex-start; gap: 8px; }
      .instance-hdr-right { width: 100%; justify-content: flex-start; flex-wrap: wrap; }
      .task-row { flex-direction: column; align-items: flex-start; gap: 4px; }
    }
  `]
})
export class SeguimientoAdminComponent implements OnInit {
  instances: InstanceView[] = [];
  loading = true;
  error: string | null = null;
  expandedIndex: number | null = null;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.api.get<any>('/api/workflow/instances/overview').subscribe({
      next: (raw) => {
        this.instances = this.normalize(raw);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err.error?.message || 'Error al cargar los trámites';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
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
}
