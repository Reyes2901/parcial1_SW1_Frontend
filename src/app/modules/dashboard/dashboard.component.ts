import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WebSocketService } from '../../core/services/websocket.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  template: `
    <div class="dashboard">
      <h2>📊 Panel de Administración</h2>

      <!-- Tarjetas de métricas -->
      <div class="metrics-grid">
        <mat-card class="metric">
          <span class="metric-value">{{ summary?.totalActiveInstances || 0 }}</span>
          <span class="metric-label">Trámites activos</span>
        </mat-card>
        <mat-card class="metric green">
          <span class="metric-value">{{ summary?.totalCompletedToday || 0 }}</span>
          <span class="metric-label">Completados hoy</span>
        </mat-card>
        <mat-card class="metric red">
          <span class="metric-value">{{ summary?.totalOverdueTasks || 0 }}</span>
          <span class="metric-label">Tareas vencidas</span>
        </mat-card>
        <mat-card class="metric blue">
          <span class="metric-value">
            {{ summary?.globalCompletionRatePct | number:'1.1-1' }}%
          </span>
          <span class="metric-label">Tasa de completación</span>
        </mat-card>
      </div>

      <!-- Alertas de cuellos de botella (tiempo real) -->
      @if (bottlenecks.length > 0) {
        <mat-card class="bottlenecks">
          <h3>⚠️ Cuellos de botella activos</h3>
          @for (b of bottlenecks; track b.taskId) {
            <div class="bottleneck-item">
              <span class="node-label">{{ b.nodeLabel }}</span>
              <span class="overdue">{{ b.overdueMinutes }} min vencida</span>
              <span class="assignee">Asignada a: {{ b.assigneeId }}</span>
            </div>
          }
        </mat-card>
      }

      <!-- Top políticas -->
      <mat-card class="top-policies">
        <h3>🏆 Políticas más usadas</h3>
        @if (summary?.topPolicies?.length) {
          @for (p of summary.topPolicies; track p.definitionId) {
            <div class="policy-item">
              <span class="policy-name">{{ p.definitionName }}</span>
              <span class="policy-stats">
                {{ p.totalInstances }} trámites
                ({{ p.activeInstances }} activos)
              </span>
            </div>
          }
        } @else {
          <p class="no-data">No hay datos disponibles</p>
        }
      </mat-card>
    </div>
  `,
  styles: [`
    .dashboard {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    h2 { margin-bottom: 24px; color: #333; }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .metric {
      text-align: center;
      padding: 24px;
    }
    .metric-value {
      font-size: 36px;
      font-weight: bold;
      display: block;
    }
    .metric-label {
      font-size: 14px;
      color: #666;
      margin-top: 8px;
    }
    .metric.green .metric-value { color: #2e7d32; }
    .metric.red .metric-value { color: #c62828; }
    .metric.blue .metric-value { color: #1565c0; }
    .bottlenecks {
      margin-bottom: 24px;
      padding: 16px;
      background: #fff8f8;
    }
    .bottleneck-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #eee;
    }
    .bottleneck-item:last-child { border-bottom: none; }
    .node-label { font-weight: 500; }
    .overdue { color: #c62828; font-weight: bold; }
    .assignee { color: #666; font-size: 13px; }
    .top-policies { padding: 16px; }
    .policy-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
    }
    .policy-name { font-weight: 500; }
    .policy-stats { color: #666; }
    .no-data { color: #999; text-align: center; }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  summary: any = null;
  bottlenecks: any[] = [];
  private sub!: Subscription;

  constructor(
    private api: ApiService,
    private wsService: WebSocketService
  ) {}

  ngOnInit(): void {
    // Carga inicial del dashboard
    this.api.get('/analytics/dashboard').subscribe({
      next: (data) => {
        this.summary = data;
        this.bottlenecks = (data as any).activeBottlenecks || [];
      },
      error: (err) => console.error('Error loading dashboard:', err)
    });

    // Escuchar nuevas alertas de cuellos de botella por WebSocket
    this.wsService.connect();
    this.sub = this.wsService.bottleneckAlerts$.subscribe(alert => {
      const exists = this.bottlenecks.find(b => b.taskId === alert.taskId);
      if (!exists) {
        this.bottlenecks.unshift(alert);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}