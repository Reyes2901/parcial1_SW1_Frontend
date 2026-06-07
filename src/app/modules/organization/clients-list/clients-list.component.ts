import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OrganizationService } from '../../../core/services/organization.service';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatCardModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="page">
      <header class="page-header">
        <p class="eyebrow">Organización</p>
        <h1 class="title">Clientes</h1>
      </header>

      <mat-card class="table-card">
        @if (loading) {
          <div class="center-state">
            <mat-spinner diameter="32"></mat-spinner>
            <p>Cargando clientes...</p>
          </div>
        } @else if (clients.length === 0) {
          <div class="center-state">
            <p>No se encontraron clientes.</p>
          </div>
        } @else {
          <table mat-table [dataSource]="clients" class="full-width">
            <ng-container matColumnDef="username">
              <th mat-header-cell *matHeaderCellDef>Nombre</th>
              <td mat-cell *matCellDef="let u">{{ u.username || u.name || '—' }}</td>
            </ng-container>

            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef>Correo</th>
              <td mat-cell *matCellDef="let u">{{ u.email || '—' }}</td>
            </ng-container>

            <ng-container matColumnDef="department">
              <th mat-header-cell *matHeaderCellDef>Departamento</th>
              <td mat-cell *matCellDef="let u">{{ u.department || u.departmentId || '—' }}</td>
            </ng-container>

            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef>Rol</th>
              <td mat-cell *matCellDef="let u">
                <span class="role-chip">{{ u.role || '—' }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Estado</th>
              <td mat-cell *matCellDef="let u">
                <span class="status-dot" [class.active]="u.active !== false"></span>
                {{ u.active !== false ? 'Activo' : 'Inactivo' }}
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
        }
      </mat-card>
    </div>
  `,
  styles: [`
    .page { padding: 28px 32px; max-width: 1100px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    .eyebrow {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .12em; color: #1a6b22; margin: 0 0 4px;
    }
    .title { font-size: 22px; font-weight: 800; color: #1a1a1a; margin: 0; }
    .table-card { padding: 0; overflow: hidden; }
    .full-width { width: 100%; }
    .center-state { text-align: center; padding: 48px 24px; color: #888; }
    .role-chip {
      display: inline-block; padding: 2px 10px; border-radius: 12px;
      font-size: 11px; font-weight: 600;
      background: #fff3e0; color: #e65100;
    }
    .status-dot {
      display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      background: #ccc; margin-right: 6px; vertical-align: middle;
    }
    .status-dot.active { background: #4caf50; }
  `]
})
export class ClientsListComponent implements OnInit {
  clients: any[] = [];
  loading = true;
  displayedColumns = ['username', 'email', 'department', 'role', 'status'];

  constructor(private orgService: OrganizationService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.orgService.getClients().subscribe({
      next: (data) => {
        this.clients = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (e: any) => {
        console.error('Error loading clients:', e);
        console.error('Detalle:', e.error);
        this.clients = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
