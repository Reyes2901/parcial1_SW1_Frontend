import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { PolicyService } from '../services/policy.service';

@Component({
  selector: 'app-policy-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule
  ],
  template: `
    <div class="policy-list-container">
      <div class="header">
        <h1>Políticas de Negocio</h1>
        <button mat-raised-button color="primary" routerLink="new">
          ➕ Nueva Política
        </button>
      </div>

      <div class="table-container">
        <table mat-table [dataSource]="policies" class="policy-table">
          <!-- Nombre -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Nombre</th>
            <td mat-cell *matCellDef="let policy">{{ policy.name }}</td>
          </ng-container>

          <!-- Estado -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Estado</th>
            <td mat-cell *matCellDef="let policy">
              <span class="status-chip" [class]="policy.status?.toLowerCase()">
                {{ policy.status }}
              </span>
            </td>
          </ng-container>

          <!-- Versión -->
          <ng-container matColumnDef="version">
            <th mat-header-cell *matHeaderCellDef>Versión</th>
            <td mat-cell *matCellDef="let policy">{{ policy.version || '1.0' }}</td>
          </ng-container>

          <!-- Fecha -->
          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef>Creado</th>
            <td mat-cell *matCellDef="let policy">
              {{ policy.createdAt | date:'short' }}
            </td>
          </ng-container>

          <!-- Acciones -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Acciones</th>
            <td mat-cell *matCellDef="let policy">
              <button mat-icon-button [routerLink]="[policy.id, 'edit']" matTooltip="Editar">
                ✏️
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" 
              (click)="editPolicy(row)" class="clickable-row"></tr>
        </table>
      </div>

      @if (policies.length === 0) {
        <div class="empty-state">
          <p>📋 No hay políticas creadas</p>
          <button mat-raised-button color="primary" routerLink="new">
            Crear primera política
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .policy-list-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      color: #333;
    }
    .table-container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .policy-table {
      width: 100%;
    }
    .clickable-row {
      cursor: pointer;
    }
    .clickable-row:hover {
      background: #f5f5f5;
    }
    .status-chip {
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
    }
    .status-chip.draft {
      background: #fff3e0;
      color: #e65100;
    }
    .status-chip.active {
      background: #e8f5e9;
      color: #2e7d32;
    }
    .status-chip.archived {
      background: #f5f5f5;
      color: #666;
    }
    .empty-state {
      text-align: center;
      padding: 48px;
      color: #666;
    }
  `]
})
export class PolicyListComponent implements OnInit {
  policies: any[] = [];
  displayedColumns = ['name', 'status', 'version', 'createdAt', 'actions'];

  constructor(
    private policyService: PolicyService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPolicies();
  }

  loadPolicies(): void {
    this.policyService.getAll().subscribe({
      next: (data) => this.policies = data,
      error: (err) => console.error('Error loading policies:', err)
    });
  }

  editPolicy(policy: any): void {
    this.router.navigate(['/policies', policy.id, 'edit']);
  }
}