import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { WebSocketService } from '../../core/services/websocket.service';

interface MonitorInstance {
  id: string;
  clientName: string;
  definitionName: string;
  status: string;
  currentNodeLabel: string;
  progressPct: number;
  startedAt: string;
  elapsedMinutes: number;
}

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    FormsModule
  ],
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Sistema</p>
          <h1 class="title">Monitor de Procesos</h1>
        </div>
        <span class="auto-refresh">Auto-refresh cada 30s</span>
      </header>

      <!-- Filtros -->
      <mat-button-toggle-group [(ngModel)]="statusFilter" (change)="applyFilter()" class="filter-bar">
        <mat-button-toggle value="ALL">Todos</mat-button-toggle>
        <mat-button-toggle value="STARTING">Iniciando</mat-button-toggle>
        <mat-button-toggle value="IN_PROGRESS">En Proceso</mat-button-toggle>
        <mat-button-toggle value="OVERDUE">Demorado</mat-button-toggle>
        <mat-button-toggle value="COMPLETED">Completo</mat-button-toggle>
      </mat-button-toggle-group>

      @if (loading && instances.length === 0) {
        <div class="center-state">
          <mat-spinner diameter="32"></mat-spinner>
          <p>Cargando procesos...</p>
        </div>
      } @else if (filtered.length === 0) {
        <div class="center-state">
          <p>No hay procesos que coincidan con el filtro.</p>
        </div>
      } @else {
        <div class="card-grid">
          @for (inst of filtered; track inst.id) {
            <mat-card class="process-card">
              <div class="card-top">
                <span class="process-id">#{{ shortId(inst.id) }}</span>
                <span class="status-pill" [class]="'sp--' + statusClass(inst)">
                  {{ statusLabel(inst) }}
                </span>
              </div>
              <div class="card-client">{{ inst.clientName || 'Cliente desconocido' }}</div>
              <div class="card-policy">{{ inst.definitionName || 'Sin política' }}</div>
              <div class="card-activity">
                <span class="activity-label">Actividad actual:</span>
                <span class="activity-value">{{ inst.currentNodeLabel || 'N/A' }}</span>
              </div>
              <div class="card-time">
                <span>Tiempo transcurrido:</span>
                <strong>{{ formatElapsed(inst.elapsedMinutes) }}</strong>
              </div>
              <mat-progress-bar
                mode="determinate"
                [value]="inst.progressPct"
                [color]="inst.progressPct >= 100 ? 'primary' : 'accent'">
              </mat-progress-bar>
              <div class="card-progress-label">{{ inst.progressPct }}% completado</div>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 28px 32px; max-width: 1200px; margin: 0 auto; }
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      margin-bottom: 20px;
    }
    .eyebrow {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .12em; color: #1a6b22; margin: 0 0 4px;
    }
    .title { font-size: 22px; font-weight: 800; color: #1a1a1a; margin: 0; }
    .auto-refresh {
      font-size: 12px; color: #888; background: #f5f5f5;
      padding: 4px 12px; border-radius: 12px;
    }
    .filter-bar { margin-bottom: 24px; }
    .center-state { text-align: center; padding: 48px 24px; color: #888; }
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    .process-card {
      padding: 20px !important;
      transition: box-shadow .15s;
    }
    .process-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.1); }
    .card-top {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px;
    }
    .process-id {
      font-size: 12px; font-weight: 700; color: #1a6b22;
      background: rgba(26,107,34,.08); padding: 3px 8px; border-radius: 5px;
    }
    .status-pill {
      font-size: 11px; font-weight: 600; padding: 3px 10px;
      border-radius: 999px; background: #f0f0f0; color: #555;
    }
    .sp--active { background: #e8f5e9; color: #2e7d32; }
    .sp--completed { background: #e3f2fd; color: #1565c0; }
    .sp--overdue { background: #fce4ec; color: #c62828; }
    .sp--starting { background: #fff8e1; color: #f57f17; }
    .card-client { font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 2px; }
    .card-policy { font-size: 13px; color: #888; margin-bottom: 12px; }
    .card-activity {
      display: flex; gap: 6px; font-size: 13px; margin-bottom: 8px;
    }
    .activity-label { color: #888; }
    .activity-value { font-weight: 600; color: #333; }
    .card-time {
      display: flex; justify-content: space-between; font-size: 13px;
      color: #555; margin-bottom: 10px;
    }
    .card-progress-label {
      font-size: 11px; color: #888; margin-top: 4px; text-align: right;
    }
  `]
})
export class MonitorComponent implements OnInit, OnDestroy {
  instances: MonitorInstance[] = [];
  filtered: MonitorInstance[] = [];
  loading = true;
  statusFilter = 'ALL';

  private pollSub?: Subscription;
  private wsSub?: Subscription;

  constructor(
    private api: ApiService,
    private wsService: WebSocketService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.pollSub = interval(30000).pipe(
      startWith(0),
      switchMap(() => this.api.get<any>('/api/workflow/instances/overview'))
    ).subscribe({
      next: (raw) => {
        this.instances = this.normalize(raw);
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
      }
    });

    this.wsService.connect();
    this.wsSub = this.wsService.instanceUpdates$.subscribe((update) => {
      const normalized = this.normalizeSingle(update);
      if (normalized) {
        const idx = this.instances.findIndex(i => i.id === normalized.id);
        if (idx >= 0) {
          this.instances[idx] = normalized;
        } else {
          this.instances = [normalized, ...this.instances];
        }
        this.applyFilter();
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.wsSub?.unsubscribe();
  }

  applyFilter(): void {
    if (this.statusFilter === 'ALL') {
      this.filtered = [...this.instances];
    } else if (this.statusFilter === 'OVERDUE') {
      this.filtered = this.instances.filter(i =>
        i.elapsedMinutes > 480 && i.status !== 'COMPLETED'
      );
    } else if (this.statusFilter === 'STARTING') {
      this.filtered = this.instances.filter(i =>
        i.status === 'PENDING' || i.progressPct < 10
      );
    } else {
      this.filtered = this.instances.filter(i => i.status === this.statusFilter);
    }
  }

  shortId(id: string): string {
    return id?.length > 8 ? id.substring(0, 8) : (id || '—');
  }

  statusClass(inst: MonitorInstance): string {
    if (inst.status === 'COMPLETED') return 'completed';
    if (inst.elapsedMinutes > 480 && inst.status !== 'COMPLETED') return 'overdue';
    if (inst.progressPct < 10) return 'starting';
    return 'active';
  }

  statusLabel(inst: MonitorInstance): string {
    const cls = this.statusClass(inst);
    const map: Record<string, string> = {
      completed: 'Completo',
      overdue: 'Demorado',
      starting: 'Iniciando',
      active: 'En Proceso'
    };
    return map[cls] || inst.status;
  }

  formatElapsed(minutes: number): string {
    if (!minutes || minutes <= 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  private normalize(raw: unknown): MonitorInstance[] {
    const arr = this.extractArray(raw);
    return arr.map(item => this.normalizeSingle(item)).filter(Boolean) as MonitorInstance[];
  }

  private normalizeSingle(item: any): MonitorInstance | null {
    if (!item) return null;
    const startedAt = item.startedAt || item.createdAt || '';
    let elapsed = 0;
    if (startedAt) {
      elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
    }
    return {
      id: item.id || item.instanceId || '',
      clientName: item.clientName || '',
      definitionName: item.definitionName || item.policyName || '',
      status: item.status || 'PENDING',
      currentNodeLabel: item.currentNodeLabel || '',
      progressPct: item.progressPct ?? this.estimateProgress(item),
      startedAt,
      elapsedMinutes: elapsed
    };
  }

  private estimateProgress(item: any): number {
    if (item.status === 'COMPLETED') return 100;
    if (item.status === 'REJECTED' || item.status === 'CANCELLED') return 100;
    const audit = item.auditLog || [];
    const nodes = item.totalNodes || 5;
    return Math.min(Math.round((audit.length / nodes) * 100), 99);
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
