import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { OrganizationService } from '../../../core/services/organization.service';
import { OrgBreadcrumbComponent, BreadcrumbItem } from '../shared/org-breadcrumb.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { DepartmentFormDialogComponent } from '../shared/department-form-dialog.component';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface DepartmentRow {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  active: boolean;
  userCount: number;
}

export interface AddUserDialogData {
  department: DepartmentRow;
  funcionarios: any[];
}

/* ==========================================================================
   MODAL: ASIGNAR FUNCIONARIO (CORREGIDO CON MENÚ OPACO Y BORDES REDONDEADOS)
   ========================================================================== */
@Component({
  selector: 'app-add-user-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatDialogModule, MatSelectModule, MatFormFieldModule, MatProgressSpinnerModule, MatIconModule],
  template: `
    <div class="add-user-dialog">
      <h2 class="dialog-title">
        <mat-icon class="title-icon">person_add</mat-icon> Agregar funcionario
      </h2>
      <p class="dialog-sub">Departamento: <strong>{{ data.department.name }}</strong></p>

      @if (data.funcionarios.length === 0) {
        <p class="empty-msg">No hay funcionarios disponibles.</p>
      } @else {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Seleccionar funcionario</mat-label>
          <mat-select [(ngModel)]="selectedUserId" panelClass="brand-dropdown-panel">
            @for (u of data.funcionarios; track u.id) {
              <mat-option [value]="u.id">{{ u.username || u.name || u.id }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }

      <div class="dialog-actions">
        <button mat-stroked-button type="button" class="btn-cancel" (click)="cancel()">Cancelar</button>
        <button mat-flat-button class="btn-save" [disabled]="!selectedUserId" (click)="confirm()">Asignar</button>
      </div>
    </div>
  `,
  styles: [`
    * { box-sizing: border-box; }
    .add-user-dialog { padding: 12px; min-width: 380px; max-width: 100%; }
    .dialog-title { font-size: 19px; font-weight: 700; margin: 0 0 4px; color: #111; display: flex; align-items: center; gap: 8px; }
    .title-icon { color: #215524; }
    .dialog-sub { font-size: 13px; color: #4b5563; margin: 0 0 20px; }
    .empty-msg { color: #9ca3af; font-size: 14px; margin: 0 0 16px; }
    .full-width { width: 100%; }
    
    /* Input verde adaptado */
    ::ng-deep .add-user-dialog .mat-mdc-text-field-wrapper {
      background-color: #f0fdf4 !important;
      border-radius: 12px !important;
    }
    ::ng-deep .add-user-dialog .mdc-notched-outline__border {
      border-color: #bbf7d0 !important;
    }
    ::ng-deep .add-user-dialog .mat-focused .mdc-notched-outline__border {
      border-color: #215524 !important;
    }
    ::ng-deep .add-user-dialog .mdc-notched-outline-leading {
      border-radius: 12px 0 0 12px !important;
    }
    ::ng-deep .add-user-dialog .mdc-notched-outline-trailing {
      border-radius: 0 12px 12px 0 !important;
    }

    .dialog-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
    .btn-cancel { border-color: #cbd5e1; color: #475569; border-radius: 12px !important; }
    .btn-save { background-color: #215524 !important; color: #ffffff !important; font-weight: 600; border-radius: 12px !important; padding: 0 20px; }
    .btn-save:hover { background-color: #08420c !important; }
    .btn-save:disabled { background-color: #e2e8f0 !important; color: #94a3b8 !important; }
  `]
})
export class AddUserDialogComponent {
  data: AddUserDialogData = inject(MAT_DIALOG_DATA);
  private dialogRef: MatDialogRef<AddUserDialogComponent> = inject(MatDialogRef);
  selectedUserId: string | null = null;

  cancel(): void { this.dialogRef.close(null); }
  confirm(): void { this.dialogRef.close(this.selectedUserId); }
}

/* ==========================================================================
   COMPONENTE PRINCIPAL: VISTA DE DEPARTAMENTOS
   ========================================================================== */
@Component({
  selector: 'app-departments',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
    OrgBreadcrumbComponent
  ],
  template: `
    <div class="admin-page">
      <app-org-breadcrumb [items]="breadcrumbs"></app-org-breadcrumb>

      @if (viewMode === 'list') {
        <header class="page-header">
          <div>
            <p class="eyebrow">Organización</p>
            <h1 class="title">Gestión de áreas y equipos del proceso</h1>
          </div>
          <button mat-flat-button class="btn-brand-primary" matTooltip="Crear un departamento nuevo"
                  (click)="openCreateDialog()">
            <mat-icon>add</mat-icon> Nuevo Departamento
          </button>
        </header>

        @if (error) {
          <div class="error-banner">
            <mat-icon>error_outline</mat-icon>
            <span>{{ error }}</span>
            <button mat-stroked-button type="button" (click)="loadData()">Reintentar</button>
          </div>
        }

        <mat-card class="table-card">
          @if (loading) {
            <div class="loading-state">
              <mat-spinner diameter="40"></mat-spinner>
              <p>Cargando departamentos…</p>
            </div>
          } @else if (departments.length === 0) {
            <div class="empty-state">
              <mat-icon>folder_open</mat-icon>
              <p>No hay departamentos registrados</p>
              <button mat-flat-button class="btn-brand-primary" (click)="openCreateDialog()">
                <mat-icon>add</mat-icon> Crear primer departamento
              </button>
            </div>
          } @else {
            <div class="table-wrap">
              <table mat-table [dataSource]="departments" class="admin-table">
                
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef class="custom-header">Área</th>
                  <td mat-cell *matCellDef="let d">
                    <span class="clickable-name" (click)="openDetail(d)">{{ d.name }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="description">
                  <th mat-header-cell *matHeaderCellDef class="hide-mobile custom-header">Descripción</th>
                  <td mat-cell *matCellDef="let d" class="hide-mobile cell-muted">
                    {{ d.description || '—' }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="createdAt">
                  <th mat-header-cell *matHeaderCellDef class="hide-mobile custom-header">Fecha creación</th>
                  <td mat-cell *matCellDef="let d" class="hide-mobile cell-muted">
                    {{ d.createdAt ? (d.createdAt | date:'dd/MM/yyyy') : '—' }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef class="custom-header">Estado</th>
                  <td mat-cell *matCellDef="let d">
                    <span class="chip" [class.chip--success]="d.active" [class.chip--muted]="!d.active">
                      {{ d.active ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="userCount">
                  <th mat-header-cell *matHeaderCellDef class="custom-header">Funcionarios</th>
                  <td mat-cell *matCellDef="let d">
                    <span class="count-badge">{{ d.userCount }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef class="col-actions custom-header">Acciones</th>
                  <td mat-cell *matCellDef="let d" class="col-actions">
                    <button mat-icon-button class="action-btn action-btn--add" matTooltip="Agregar funcionario"
                            (click)="openAddUserModal(d); $event.stopPropagation()">
                      <mat-icon>person_add</mat-icon>
                    </button>
                    <button mat-icon-button class="action-btn action-btn--sync" matTooltip="Cambiar estado"
                            (click)="toggleDepartmentStatus(d); $event.stopPropagation()">
                      <mat-icon>sync</mat-icon>
                    </button>
                    <button mat-icon-button class="action-btn action-btn--edit" matTooltip="Editar" (click)="openEditDialog(d); $event.stopPropagation()">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button class="action-btn action-btn--delete" matTooltip="Eliminar"
                            (click)="confirmDelete(d); $event.stopPropagation()">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>
              </table>
            </div>
          }
        </mat-card>
      }

      @if (viewMode === 'detail' && selectedDepartment) {
        <header class="page-header">
          <div>
            <p class="eyebrow">Organización</p>
            <h1 class="title">{{ selectedDepartment.name }}</h1>
          </div>
          <button mat-stroked-button type="button" class="btn-back" (click)="backToList()">
            <mat-icon>arrow_back</mat-icon> Volver
          </button>
        </header>

        <mat-card class="detail-card">
          <dl class="detail-grid">
            <dt>Nombre</dt><dd>{{ selectedDepartment.name }}</dd>
            <dt>Descripción</dt><dd>{{ selectedDepartment.description || '—' }}</dd>
            <dt>Fecha creación</dt>
            <dd>{{ selectedDepartment.createdAt ? (selectedDepartment.createdAt | date:'dd/MM/yyyy HH:mm') : '—' }}</dd>
            <dt>Estado</dt>
            <dd>
              <span class="chip" [class.chip--success]="selectedDepartment.active" [class.chip--muted]="!selectedDepartment.active">
                {{ selectedDepartment.active ? 'Activo' : 'Inactivo' }}
              </span>
            </dd>
          </dl>

          <h3 class="section-title">Funcionarios</h3>
          @if (detailUsersLoading) {
            <div class="loading-state loading-state--compact">
              <mat-spinner diameter="32"></mat-spinner>
              <p>Cargando funcionarios…</p>
            </div>
          } @else if (detailUsers.length === 0) {
            <p class="empty-inline">Sin funcionarios asociados a este departamento.</p>
          } @else {
            <table mat-table [dataSource]="detailUsers" class="admin-table">
              <ng-container matColumnDef="username">
                <th mat-header-cell *matHeaderRowDef class="custom-header">Usuario</th>
                <td mat-cell *matCellDef="let u">{{ u.username || u.name || '—' }}</td>
              </ng-container>
              <ng-container matColumnDef="role">
                <th mat-header-cell *matHeaderRowDef class="custom-header">Rol</th>
                <td mat-cell *matCellDef="let u">
                  <span class="chip chip--role">{{ u.role || '—' }}</span>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="detailUserColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: detailUserColumns;" class="table-row"></tr>
            </table>
          }
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .admin-page { padding: 24px 32px; max-width: 1200px; margin: 0 auto; }
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      margin-bottom: 20px; flex-wrap: wrap; gap: 16px;
    }
    .eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; color: #215524; margin: 0 0 4px; }
    .title { font-size: 22px; font-weight: 800; color: #111111; margin: 0; }
    .clickable-name { cursor: pointer; color: #215524; font-weight: 600; }
    .clickable-name:hover { text-decoration: underline; }

    /* Botón Nuevo Departamento Redondeado */
    .btn-brand-primary {
      background-color: #215524 !important;
      color: #ffffff !important;
      font-weight: 500;
      border-radius: 12px !important;
    }
    .btn-brand-primary:hover { background-color: #08420c !important; }
    
    .btn-back { border-radius: 12px !important; border-color: #cbd5e1; color: #475569; }

    /* Encabezados de la Tabla */
    .admin-table th.custom-header {
      background-color: #215524 !important; 
      color: #ffffff !important;
      font-size: 11px; 
      font-weight: 700;
      text-transform: uppercase; 
      letter-spacing: .06em;
    }

    .action-btn { margin-left: 4px; }
    .action-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .action-btn--add { color: #215524; }
    .action-btn--sync { color: #4b5563; }
    .action-btn--edit { color: #059669; }
    .action-btn--delete { color: #dc2626; }

    .error-banner {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
      padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; font-size: 14px;
    }
    .error-banner button { border-radius: 12px !important; }

    /* Bordes Redondeados en Tarjetas y Tablas */
    .table-card { padding: 0; overflow: hidden; border-radius: 12px !important; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
    .table-wrap { overflow-x: auto; }
    .admin-table { width: 100%; }
    .table-row:hover { background: #f8fafc; }
    .cell-muted { color: #4b5563; font-size: 13px; }
    .col-actions { text-align: right; white-space: nowrap; padding-right: 16px !important; }

    .chip { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 700; }
    .chip--success { background: #e2fbf0; color: #047857; }
    .chip--muted { background: #f3f4f6; color: #6b7280; }
    .chip--role { background: #f0fdf4; color: #215524; border: 1px solid #bbf7d0; }
    
    .count-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 28px; height: 24px; padding: 0 8px; border-radius: 12px;
      background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 700;
    }

    .loading-state, .empty-state { text-align: center; padding: 56px 24px; color: #6b7280; }
    .loading-state--compact { padding: 32px 24px; }
    .loading-state p, .empty-state p { margin: 12px 0 0; font-size: 14px; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; color: #d1d5db; }
    .empty-inline { color: #9ca3af; font-size: 14px; margin: 0; padding: 8px 0; }

    .detail-card { padding: 24px; border-radius: 12px !important; border-left: 4px solid #215524; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
    .detail-grid { display: grid; grid-template-columns: 140px 1fr; gap: 10px 20px; margin: 0 0 24px; font-size: 14px; }
    .detail-grid dt { color: #6b7280; font-weight: 600; margin: 0; }
    .detail-grid dd { margin: 0; color: #111; }
    .section-title { font-size: 13px; font-weight: 700; color: #215524; margin: 0 0 12px; text-transform: uppercase; letter-spacing: .06em; }

    /* ESTILO GLOBAL PARA MENÚS DESPLEGABLES (EVITA TRANSPARENCIAS) */
    ::ng-deep .brand-dropdown-panel {
      background-color: #ffffff !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 12px !important;
    }
    ::ng-deep .brand-dropdown-panel .mat-mdc-option { color: #1e293b !important; }
    ::ng-deep .brand-dropdown-panel .mat-mdc-option:hover:not(.mat-mdc-option-disabled),
    ::ng-deep .brand-dropdown-panel .mat-mdc-option.mat-mdc-option-active {
      background-color: #f0fdf4 !important;
      color: #215524 !important;
    }

    @media (max-width: 768px) {
      .admin-page { padding: 16px; }
      .hide-mobile { display: none !important; }
      .page-header { flex-direction: column; align-items: flex-start; }
    }
  `]
})
export class DepartmentsComponent implements OnInit {
  viewMode: 'list' | 'detail' = 'list';
  departments: DepartmentRow[] = [];
  loading = true;
  error = '';
  displayedColumns = ['name', 'description', 'createdAt', 'status', 'userCount', 'actions'];
  detailUserColumns = ['username', 'role'];

  selectedDepartment: DepartmentRow | null = null;
  detailUsers: any[] = [];
  detailUsersLoading = false;

  breadcrumbs: BreadcrumbItem[] = [
    { label: 'Organización' },
    { label: 'Departamentos' }
  ];

  constructor(
    private orgService: OrganizationService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = '';
    this.orgService.getDepartments().subscribe({
      next: (depts) => {
        this.departments = depts.map((d: any) => this.normalizeDepartment(d));
        this.loading = false;
        this.cdr.detectChanges();
        
        if (this.departments.length > 0) {
          const userRequests = this.departments.map(dept => 
            this.orgService.getDepartmentUsers(dept.id).pipe(
              catchError(() => of([]))
            )
          );

          forkJoin(userRequests).subscribe((usersByDept) => {
            this.departments = this.departments.map((dept, index) => ({
              ...dept,
              userCount: usersByDept[index] ? usersByDept[index].length : dept.userCount
            }));
            this.cdr.detectChanges();
          });
        }
      },
      error: (e: any) => {
        this.error = e?.error?.message || 'Error al cargar los departamentos';
        this.departments = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private normalizeDepartment(d: any): DepartmentRow {
    const active = d.active !== false && d.status !== 'INACTIVE' && d.status !== 'INACTIVO';
    return {
      id: String(d.id || d._id || ''),
      name: d.name || '—',
      description: d.description || '',
      createdAt: d.createdAt || d.created || '',
      active,
      userCount: d.userCount ?? d.usersCount ?? 0
    };
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(DepartmentFormDialogComponent, {
      width: '440px',
      panelClass: 'custom-rounded-dialog', // Permite aplicar bordes suavizados al contenedor externo
      data: { mode: 'create' }
    });
    ref.afterClosed().subscribe((ok) => {
      if (ok) {
        this.snackBar.open('Departamento creado correctamente', 'OK', { duration: 3000 });
        this.loadData();
      }
    });
  }

  openEditDialog(dept: DepartmentRow): void {
    const ref = this.dialog.open(DepartmentFormDialogComponent, {
      width: '440px',
      panelClass: 'custom-rounded-dialog',
      data: { mode: 'edit', department: dept }
    });
    ref.afterClosed().subscribe((ok) => {
      if (ok) {
        this.snackBar.open('Departamento actualizado', 'OK', { duration: 3000 });
        this.loadData();
      }
    });
  }

  openDetail(dept: DepartmentRow): void {
    setTimeout(() => {
      this.selectedDepartment = dept;
      this.viewMode = 'detail';
      this.breadcrumbs = [
        { label: 'Organización' },
        { label: 'Departamentos', action: () => this.backToList() },
        { label: dept.name }
      ];
      this.loadDetailUsers(dept.id);
      this.cdr.detectChanges();
    }, 0);
  }

  private loadDetailUsers(deptId: string): void {
    this.detailUsersLoading = true;
    this.detailUsers = [];
    this.orgService.getDepartmentUsers(deptId).subscribe({
      next: (users) => {
        this.detailUsers = users;
        this.detailUsersLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.detailUsersLoading = false;
        this.snackBar.open('Error al cargar funcionarios del departamento', 'OK', { duration: 4000 });
        this.cdr.detectChanges();
      }
    });
  }

  backToList(): void {
    this.viewMode = 'list';
    this.selectedDepartment = null;
    this.breadcrumbs = [
      { label: 'Organización' },
      { label: 'Departamentos' }
    ];
    this.cdr.detectChanges();
  }

  confirmDelete(dept: DepartmentRow): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Eliminar departamento',
        message: `¿Confirma eliminar el departamento "${dept.name}"? Esta acción puede desactivarlo en el sistema.`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        danger: true
      }
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.orgService.deleteDepartment(dept.id).subscribe({
        next: () => {
          this.snackBar.open('Departamento eliminado', 'OK', { duration: 3000 });
          this.loadData();
        },
        error: (e: any) => {
          this.snackBar.open(e?.error?.message || 'Error al eliminar el departamento', 'OK', { duration: 4000 });
        }
      });
    });
  }

  toggleDepartmentStatus(dept: DepartmentRow): void {
    const updated = { ...dept, active: !dept.active };
    this.orgService.updateDepartment(dept.id, updated as any).subscribe({
      next: (res) => {
        const idx = this.departments.findIndex(d => d.id === dept.id);
        if (idx !== -1) {
          this.departments[idx] = this.normalizeDepartment(res ?? updated);
          this.departments = [...this.departments];
        }
        this.snackBar.open(
          `Estado cambiado a ${updated.active ? 'Activo' : 'Inactivo'}`,
          'OK',
          { duration: 3000 }
        );
        this.loadData();
      },
      error: (e: any) => {
        this.snackBar.open(e?.error?.message || 'Error al cambiar estado', 'OK', { duration: 4000 });
      }
    });
  }

  openAddUserModal(dept: DepartmentRow): void {
    this.orgService.getFuncionarios().subscribe({
      next: (funcionarios) => {
        const ref = this.dialog.open(AddUserDialogComponent, {
          width: '400px',
          data: { department: dept, funcionarios } as AddUserDialogData
        });
        ref.afterClosed().subscribe((selectedUserId: string | null) => {
          if (!selectedUserId) return;

          this.orgService.updateUserDepartment(selectedUserId, dept.id).subscribe({
            next: () => {
              this.snackBar.open('Funcionario asignado correctamente', 'OK', { duration: 3000 });
              setTimeout(() => {
                this.loadData();
              }, 0);
            },
            error: (e: any) => {
              this.snackBar.open(e?.error?.message || 'Error al asignar funcionario', 'OK', { duration: 4000 });
              setTimeout(() => {
                this.cdr.detectChanges();
              }, 0);
            }
          });
        });
      },
      error: (e: any) => {
        this.snackBar.open(e?.error?.message || 'Error al cargar funcionarios', 'OK', { duration: 4000 });
      }
    });
  }
}