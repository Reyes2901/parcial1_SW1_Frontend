import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PolicyService } from '../policy/services/policy.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { BottleneckReport } from '../../core/models/analytics.model';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTableModule,
    MatCardModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="page">
      <header class="page-header">
        <p class="eyebrow">Sistema</p>
        <h1 class="title">Análisis de Cuellos de Botella</h1>
      </header>

      <!-- Filtro por política -->
      <mat-card class="filter-card">
        <mat-form-field appearance="outline" class="policy-select">
          <mat-label>Seleccionar política</mat-label>
          <mat-select [(ngModel)]="selectedPolicyId" (selectionChange)="onPolicyChange()">
            @for (p of policies; track p.id) {
              <mat-option [value]="p.id">{{ p.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </mat-card>

      <!-- Resultados -->
      @if (loadingBottlenecks) {
        <div class="center-state">
          <mat-spinner diameter="32"></mat-spinner>
          <p>Cargando análisis...</p>
        </div>
      } @else if (!selectedPolicyId) {
        <div class="center-state">
          <p>Seleccione una política para ver el reporte de cuellos de botella.</p>
        </div>
      } @else if (bottlenecks.length === 0) {
        <div class="center-state">
          <p>No se detectaron cuellos de botella para esta política.</p>
        </div>
      } @else {
        <mat-card class="table-card">
          <table mat-table [dataSource]="bottlenecks" class="full-width">
            <ng-container matColumnDef="nodeLabel">
              <th mat-header-cell *matHeaderCellDef>Nodo</th>
              <td mat-cell *matCellDef="let b">{{ b.nodeLabel }}</td>
            </ng-container>

            <ng-container matColumnDef="laneName">
              <th mat-header-cell *matHeaderCellDef>Departamento (Lane)</th>
              <td mat-cell *matCellDef="let b">{{ b.laneName || '—' }}</td>
            </ng-container>

            <ng-container matColumnDef="assigneeId">
              <th mat-header-cell *matHeaderCellDef>Asignado a</th>
              <td mat-cell *matCellDef="let b">{{ b.assigneeId || 'Sin asignar' }}</td>
            </ng-container>

            <ng-container matColumnDef="overdueMinutes">
              <th mat-header-cell *matHeaderCellDef>Minutos de retraso</th>
              <td mat-cell *matCellDef="let b">
                <span class="overdue-val" [class.critical]="b.overdueMinutes > 120">
                  {{ b.overdueMinutes }} min
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="priority">
              <th mat-header-cell *matHeaderCellDef>Prioridad</th>
              <td mat-cell *matCellDef="let b">
                <span class="priority-chip" [class]="'prio-' + (b.priority || 'NORMAL').toLowerCase()">
                  {{ b.priority || 'NORMAL' }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="dueAt">
              <th mat-header-cell *matHeaderCellDef>Vencimiento</th>
              <td mat-cell *matCellDef="let b">{{ b.dueAt | date:'dd/MM/yy HH:mm' }}</td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .page { padding: 28px 32px; max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: 20px; }
    .eyebrow {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .12em; color: #1a6b22; margin: 0 0 4px;
    }
    .title { font-size: 22px; font-weight: 800; color: #1a1a1a; margin: 0; }
    .filter-card { padding: 16px 20px; margin-bottom: 20px; }
    .policy-select { width: 100%; max-width: 400px; }
    .center-state { text-align: center; padding: 48px 24px; color: #888; }
    .table-card { padding: 0; overflow: hidden; }
    .full-width { width: 100%; }
    .overdue-val { font-weight: 600; }
    .overdue-val.critical { color: #c62828; }
    .priority-chip {
      display: inline-block; padding: 2px 10px; border-radius: 12px;
      font-size: 11px; font-weight: 600;
    }
    .prio-high, .prio-urgent { background: #fce4ec; color: #c62828; }
    .prio-normal { background: #fff8e1; color: #f57f17; }
    .prio-low { background: #e8f5e9; color: #2e7d32; }
  `]
})
export class AnalysisComponent implements OnInit {
  policies: any[] = [];
  selectedPolicyId = '';
  bottlenecks: BottleneckReport[] = [];
  loadingBottlenecks = false;
  displayedColumns = ['nodeLabel', 'laneName', 'assigneeId', 'overdueMinutes', 'priority', 'dueAt'];

  constructor(
    private policyService: PolicyService,
    private analyticsService: AnalyticsService
  ) {}

  ngOnInit(): void {
    this.policyService.getActive().subscribe({
      next: (data) => this.policies = data,
      error: () => this.policies = []
    });
  }

  onPolicyChange(): void {
    if (!this.selectedPolicyId) {
      this.bottlenecks = [];
      return;
    }
    this.loadingBottlenecks = true;
    this.analyticsService.getBottlenecksByPolicy(this.selectedPolicyId).subscribe({
      next: (data) => {
        this.bottlenecks = Array.isArray(data) ? data : [];
        this.loadingBottlenecks = false;
      },
      error: () => {
        this.bottlenecks = [];
        this.loadingBottlenecks = false;
      }
    });
  }
}
