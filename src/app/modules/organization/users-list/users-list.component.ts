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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { OrganizationService } from '../../../core/services/organization.service';
import { OrgBreadcrumbComponent, BreadcrumbItem } from '../shared/org-breadcrumb.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

interface UserRow {
  id: string;
  username: string;
  role: string;
  departmentLabel: string;
  active: boolean;
}

/* ==========================================================================
   MODAL: NUEVO USUARIO (REDONDEADO, CON CONTRASEÑA Y MENÚS OPACOS)
   ========================================================================== */
@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatButtonModule, 
    MatDialogModule, 
    MatSelectModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatIconModule
  ],
  template: `
    <div class="user-dialog-container">
      <h2 class="dialog-title">
        <mat-icon class="title-icon">person_add</mat-icon> Nuevo Usuario
      </h2>
      <p class="dialog-sub">Asigne credenciales válidas y defina el rol operativo del nuevo funcionario.</p>

      <form #userForm="ngForm" class="dialog-form">
        <div class="form-row">
          <mat-form-field appearance="outline" class="form-col">
            <mat-label>Nombre de usuario</mat-label>
            <input matInput name="username" [(ngModel)]="userModel.username" required placeholder="ej. jdoe">
            <mat-icon matSuffix>account_circle</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-col">
            <mat-label>Contraseña</mat-label>
            <input matInput [type]="hidePassword ? 'password' : 'text'" name="password" [(ngModel)]="userModel.password" required placeholder="••••••••">
            <button mat-icon-button matSuffix type="button" (click)="hidePassword = !hidePassword" [attr.aria-label]="'Ocultar contraseña'">
              <mat-icon>{{hidePassword ? 'visibility_off' : 'visibility'}}</mat-icon>
            </button>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-col">
            <mat-label>Rol del Sistema</mat-label>
            <mat-select name="role" [(ngModel)]="userModel.role" required panelClass="brand-dropdown-panel">
              <mat-option value="ADMIN">ADMIN</mat-option>
              <mat-option value="FUNCIONARIO">FUNCIONARIO</mat-option>
              <mat-option value="CLIENT">CLIENTE</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-col">
            <mat-label>Departamento</mat-label>
            <mat-select name="departmentId" [(ngModel)]="userModel.departmentId" panelClass="brand-dropdown-panel">
              <mat-option value="">Ninguno (Sin Área)</mat-option>
              @for (d of data.departments; track d.id) {
                <mat-option [value]="d.id">{{ d.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </form>

      <div class="dialog-actions">
        <button mat-stroked-button type="button" class="btn-cancel" (click)="cancel()">Cancelar</button>
        <button mat-flat-button class="btn-save" [disabled]="!userForm.form.valid" (click)="save()">
          Registrar Funcionario
        </button>
      </div>
    </div>
  `,
  styles: [`
    * { box-sizing: border-box; }
    .user-dialog-container { padding: 8px; width: 100%; max-width: 520px; }
    .dialog-title { font-size: 20px; font-weight: 700; margin: 0 0 4px; color: #111; display: flex; align-items: center; gap: 8px; }
    .title-icon { color: #215524; }
    .dialog-sub { font-size: 12.5px; color: #4b5563; margin: 0 0 20px; line-height: 1.4; }
    
    .dialog-form { display: flex; flex-direction: column; gap: 4px; }
    .form-row { display: flex; gap: 16px; width: 100%; flex-wrap: wrap; }
    .form-col { flex: 1; min-width: 220px; }

    /* Inputs redondeados y verdes para el modal */
    ::ng-deep .user-dialog-container .mat-mdc-text-field-wrapper {
      background-color: #f0fdf4 !important;
      border-radius: 12px !important;
    }
    ::ng-deep .user-dialog-container .mdc-notched-outline__border {
      border-color: #bbf7d0 !important;
    }
    ::ng-deep .user-dialog-container .mat-focused .mdc-notched-outline__border {
      border-color: #215524 !important;
      border-width: 2px !important;
    }
    ::ng-deep .user-dialog-container .mdc-notched-outline-leading { border-radius: 12px 0 0 12px !important; }
    ::ng-deep .user-dialog-container .mdc-notched-outline-trailing { border-radius: 0 12px 12px 0 !important; }
    ::ng-deep .user-dialog-container .mat-mdc-form-field.mat-focused .mat-mdc-select-arrow,
    ::ng-deep .user-dialog-container .mat-mdc-form-field.mat-focused .mat-mdc-form-field-label {
      color: #215524 !important;
    }
    
    .dialog-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
    .btn-cancel { border-color: #cbd5e1; color: #475569; border-radius: 12px !important; }
    .btn-save { background-color: #215524 !important; color: #ffffff !important; font-weight: 600; padding: 0 20px; border-radius: 12px !important; }
    .btn-save:hover { background-color: #08420c !important; }
    .btn-save:disabled { background-color: #e2e8f0 !important; color: #94a3b8 !important; }
  `]
})
export class UserFormDialogComponent {
  data = inject(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<UserFormDialogComponent>);
  
  hidePassword = true;
  userModel = {
    username: this.data?.user?.username || '',
    password: '',
    role: this.data?.user?.role || 'FUNCIONARIO',
    departmentId: this.data?.user?.departmentId || ''
  };

  cancel(): void { this.dialogRef.close(null); }
  save(): void { this.dialogRef.close(this.userModel); }
}

/* ==========================================================================
   COMPONENTE PRINCIPAL: VISTA DE FUNCIONARIOS
   ========================================================================== */
@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
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
            <h1 class="title">Funcionarios y Cuentas</h1>
            <p class="subtitle">Búsqueda, asignación de áreas y control operacional del personal</p>
          </div>
          <button mat-flat-button class="btn-brand-primary" matTooltip="Registrar un usuario nuevo"
                  (click)="openCreateDialog()">
            <mat-icon>person_add</mat-icon> Nuevo Usuario
          </button>
        </header>

        <div class="filters-container">
          <mat-form-field appearance="outline" class="compact-filter filter-search">
            <mat-label>Buscar por username</mat-label>
            <input matInput [(ngModel)]="searchUsername" (ngModelChange)="applyClientFilters()" placeholder="Escriba un nombre...">
            <mat-icon matSuffix class="brand-icon">search</mat-icon>
          </mat-form-field>
          
          <mat-form-field appearance="outline" class="compact-filter">
            <mat-label>Rol</mat-label>
            <mat-select [(ngModel)]="filterRole" (selectionChange)="onServerFilterChange()" panelClass="brand-dropdown-panel">
              <mat-option value="">Todos los Roles</mat-option>
              <mat-option value="ADMIN">ADMIN</mat-option>
              <mat-option value="FUNCIONARIO">FUNCIONARIO</mat-option>
              <mat-option value="CLIENT">CLIENTE</mat-option>
            </mat-select>
          </mat-form-field>
          
          <mat-form-field appearance="outline" class="compact-filter">
            <mat-label>Departamento</mat-label>
            <mat-select [(ngModel)]="filterDepartmentId" (selectionChange)="onServerFilterChange()" panelClass="brand-dropdown-panel">
              <mat-option value="">Todos los Deptos</mat-option>
              @for (d of departmentOptions; track d.id) {
                <mat-option [value]="d.id">{{ d.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        @if (error) {
          <div class="error-banner">
            <mat-icon>error_outline</mat-icon>
            <span>{{ error }}</span>
            <button mat-stroked-button type="button" class="btn-retry" (click)="loadUsers()">Reintentar</button>
          </div>
        }

        <mat-card class="table-card">
          @if (loading) {
            <div class="loading-state">
              <mat-spinner diameter="40"></mat-spinner>
              <p>Cargando registros de funcionarios…</p>
            </div>
          } @else if (filteredUsers.length === 0) {
            <div class="empty-state">
              <mat-icon>person_off</mat-icon>
              <p>No se encontraron funcionarios coincidentes con la búsqueda.</p>
            </div>
          } @else {
            <div class="table-wrap">
              <table mat-table [dataSource]="pagedUsers" class="admin-table">
                
                <ng-container matColumnDef="username">
                  <th mat-header-cell *matHeaderCellDef class="custom-header">Usuario</th>
                  <td mat-cell *matCellDef="let u">
                    <span class="cell-primary" (click)="openDetail(u)">{{ u.username }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="role">
                  <th mat-header-cell *matHeaderCellDef class="custom-header">Rol asignado</th>
                  <td mat-cell *matCellDef="let u">
                    <span class="chip" [ngClass]="roleChipClass(u.role)">
                      {{ displayRole(u.role) }}
                    </span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="department">
                  <th mat-header-cell *matHeaderCellDef class="hide-mobile custom-header">Área / Departamento</th>
                  <td mat-cell *matCellDef="let u" class="hide-mobile cell-muted">
                    {{ u.departmentLabel || '—' }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef class="custom-header">Estado</th>
                  <td mat-cell *matCellDef="let u">
                    <span class="chip" [class.chip--success]="u.active" [class.chip--muted]="!u.active">
                      {{ u.active ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef class="col-actions custom-header">Acciones</th>
                  <td mat-cell *matCellDef="let u" class="col-actions">
                    <button mat-icon-button class="action-btn action-btn--view" matTooltip="Ver expediente" (click)="openDetail(u)">
                      <mat-icon>visibility</mat-icon>
                    </button>
                    <button mat-icon-button class="action-btn action-btn--delete" matTooltip="Dar de baja" (click)="confirmDelete(u)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>
              </table>
            </div>

            <mat-paginator
              [length]="filteredUsers.length"
              [pageSize]="pageSize"
              [pageIndex]="pageIndex"
              (page)="onPage($event)"
              class="custom-paginator">
            </mat-paginator>
          }
        </mat-card>
      }

      @if (viewMode === 'detail' && selectedUser) {
        <header class="page-header">
          <div>
            <p class="eyebrow">Expediente de Funcionario</p>
            <h1 class="title">{{ selectedUser.username }}</h1>
          </div>
          <button mat-stroked-button type="button" class="btn-back" (click)="backToList()">
            <mat-icon>arrow_back</mat-icon> Volver a la lista
          </button>
        </header>

        <mat-card class="detail-card">
          <div class="detail-header">
            <div class="avatar">{{ selectedUser.username.charAt(0).toUpperCase() }}</div>
            <div>
              <h2 class="detail-name">{{ selectedUser.username }}</h2>
              <span class="chip" [ngClass]="roleChipClass(selectedUser.role)">
                {{ displayRole(selectedUser.role) }}
              </span>
            </div>
          </div>
          <dl class="detail-grid">
            <dt>Identificador único</dt><dd>{{ selectedUser.id }}</dd>
            <dt>Nombre de cuenta</dt><dd>{{ selectedUser.username }}</dd>
            <dt>Rol de seguridad</dt><dd>{{ displayRole(selectedUser.role) }}</dd>
            <dt>Departamento</dt><dd>{{ selectedUser.departmentLabel || 'Sin área asignada' }}</dd>
            <dt>Estado Operativo</dt>
            <dd>
              <span class="chip" [class.chip--success]="selectedUser.active" [class.chip--muted]="!selectedUser.active">
                {{ selectedUser.active ? 'Cuenta Activa' : 'Cuenta Suspendida' }}
              </span>
            </dd>
          </dl>
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
    .subtitle { font-size: 13px; color: #6b7280; margin: 4px 0 0; }

    /* Botones principales redondeados al 12px */
    .btn-brand-primary { background-color: #215524 !important; color: #ffffff !important; font-weight: 500; border-radius: 12px !important; }
    .btn-brand-primary:hover { background-color: #08420c !important; }
    .btn-back, .btn-retry { border-radius: 12px !important; border-color: #cbd5e1; color: #475569; }

    /* Filtros compactos horizontales con radio redondeado */
    .filters-container {
      display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; align-items: center;
      background: #ffffff; padding: 10px 14px; border-radius: 12px; border: 1px solid #e2e8f0;
    }
    .compact-filter { min-width: 150px; flex: 1; }
    .compact-filter.filter-search { flex: 2; min-width: 200px; }
    .brand-icon { color: #215524; }

    ::ng-deep .compact-filter .mat-mdc-text-field-wrapper {
      background-color: #f0fdf4 !important;
      height: 48px !important;
      padding: 0 12px !important;
      border-radius: 12px !important;
    }
    ::ng-deep .compact-filter .mdc-notched-outline__border { border-color: #bbf7d0 !important; }
    ::ng-deep .compact-filter .mat-focused .mdc-notched-outline__border { border-color: #215524 !important; }
    ::ng-deep .compact-filter .mdc-notched-outline-leading { border-radius: 12px 0 0 12px !important; }
    ::ng-deep .compact-filter .mdc-notched-outline-trailing { border-radius: 0 12px 12px 0 !important; }
    ::ng-deep .compact-filter .mat-mdc-form-field-infix { padding-top: 12px !important; padding-bottom: 12px !important; min-height: 48px !important; }
    ::ng-deep .compact-filter .mat-mdc-form-field-label { top: 24px !important; }

    /* Estilización de paneles desplegables opacos */
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

    /* Estructura redondeada de la tabla contenedora */
    .table-card { padding: 0; overflow: hidden; border-radius: 12px !important; border: 1px solid rgba(0,0,0,.05); box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
    .table-wrap { overflow-x: auto; }
    .admin-table { width: 100%; }
    .admin-table th.custom-header {
      background-color: #215524 !important; color: #ffffff !important;
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: 14px 16px;
    }
    .table-row:hover { background: #f8fafc; }
    .cell-primary { font-weight: 600; color: #215524; cursor: pointer; }
    .cell-primary:hover { text-decoration: underline; }
    .cell-muted { color: #4b5563; font-size: 13px; }
    .col-actions { text-align: right; white-space: nowrap; padding-right: 20px !important; }
    .action-btn { margin-left: 4px; }
    .action-btn--view { color: #215524; }
    .action-btn--delete { color: #dc2626; }

    .chip { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 700; }
    .chip--success { background: #e2fbf0; color: #047857; }
    .chip--muted { background: #f3f4f6; color: #6b7280; }
    .chip--admin { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .chip--funcionario { background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; }
    .chip--cliente { background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; }

    ::ng-deep .custom-paginator .mat-mdc-paginator-page-size { display: none !important; }
    ::ng-deep .custom-paginator .mat-mdc-paginator-container { justify-content: flex-end; padding: 4px 16px; }

    .loading-state, .empty-state { text-align: center; padding: 64px 24px; color: #6b7280; }
    .loading-state p, .empty-state p { margin: 12px 0 0; font-size: 14px; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; color: #cbd5e1; }

    /* Detalle de expediente redondeado */
    .detail-card { padding: 24px; border-radius: 12px !important; border-left: 4px solid #215524; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
    .detail-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9; }
    .avatar { width: 52px; height: 52px; border-radius: 50%; background: #e2fbf0; color: #215524; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; }
    .detail-name { margin: 0 0 6px; font-size: 18px; font-weight: 700; color: #111; }
    .detail-grid { display: grid; grid-template-columns: 160px 1fr; gap: 14px 20px; font-size: 14px; }
    .detail-grid dt { color: #6b7280; font-weight: 600; margin: 0; }
    .detail-grid dd { margin: 0; color: #111; }

    @media (max-width: 768px) {
      .admin-page { padding: 16px; }
      .hide-mobile { display: none !important; }
      .page-header { flex-direction: column; align-items: flex-start; }
      .filters-container { flex-direction: column; align-items: stretch; padding: 12px; }
      .compact-filter { max-width: 100%; }
    }
  `]
})
export class UsersListComponent implements OnInit {
  viewMode: 'list' | 'detail' = 'list';
  users: UserRow[] = [];
  filteredUsers: UserRow[] = [];
  pagedUsers: UserRow[] = [];
  loading = true;
  error = '';
  displayedColumns = ['username', 'role', 'department', 'status', 'actions'];

  searchUsername = '';
  filterRole = '';
  filterDepartmentId = '';
  departmentOptions: { id: string; name: string }[] = [];

  pageIndex = 0;
  pageSize = 10;

  selectedUser: UserRow | null = null;

  breadcrumbs: BreadcrumbItem[] = [
    { label: 'Organización' },
    { label: 'Usuarios' }
  ];

  private deptNameMap = new Map<string, string>();

  constructor(
    private orgService: OrganizationService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDepartments();
    this.loadUsers();
  }

  private loadDepartments(): void {
    this.orgService.getDepartments().subscribe({
      next: (depts) => {
        this.departmentOptions = depts.map((d: any) => {
          const id = String(d.id || d._id || d.name);
          const name = d.name || id;
          this.deptNameMap.set(id, name);
          return { id, name };
        });
        this.cdr.detectChanges();
      },
      error: () => { this.cdr.detectChanges(); }
    });
  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';
    const filters: { role?: string; departmentId?: string } = {};
    if (this.filterRole) filters.role = this.filterRole;
    if (this.filterDepartmentId) filters.departmentId = this.filterDepartmentId;

    this.orgService.getUsers(Object.keys(filters).length ? filters : undefined).subscribe({
      next: (data) => {
        this.users = data.map((u: any) => this.normalizeUser(u));
        this.applyClientFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (e: any) => {
        this.error = e?.error?.message || 'Error al cargar usuarios';
        this.users = [];
        this.filteredUsers = [];
        this.pagedUsers = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onServerFilterChange(): void {
    this.pageIndex = 0;
    this.loadUsers();
  }

  applyClientFilters(): void {
    const q = this.searchUsername.trim().toLowerCase();
    this.filteredUsers = q
      ? this.users.filter(u => u.username.toLowerCase().includes(q))
      : [...this.users];
    this.updatePage();
  }

  onPage(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.updatePage();
  }

  private updatePage(): void {
    const start = this.pageIndex * this.pageSize;
    this.pagedUsers = this.filteredUsers.slice(start, start + this.pageSize);
    this.cdr.detectChanges();
  }

  private normalizeUser(u: any): UserRow {
    const deptId = u.departmentId || u.department;
    const deptLabel = u.departmentName || (deptId ? this.deptNameMap.get(String(deptId)) || String(deptId) : '');
    return {
      id: String(u.id || u._id || u.username),
      username: u.username || u.name || '—',
      role: u.role || '—',
      departmentLabel: deptLabel,
      active: u.active !== false && u.status !== 'INACTIVE'
    };
  }

  displayRole(role: string): string {
    if (role === 'CLIENT') return 'CLIENTE';
    return role || '—';
  }

  roleChipClass(role: string): string {
    const r = (role || '').toUpperCase();
    if (r === 'ADMIN') return 'chip--admin';
    if (r === 'FUNCIONARIO' || r === 'EMPLOYEE') return 'chip--funcionario';
    if (r === 'CLIENT' || r === 'CLIENTE') return 'chip--cliente';
    return 'chip--muted';
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(UserFormDialogComponent, {
      width: '520px',
      panelClass: 'custom-rounded-dialog',
      disableClose: true,
      data: { mode: 'create', departments: this.departmentOptions }
    });
    
    ref.afterClosed().subscribe((result) => {
      if (result) {
        const payload = { ...result };
        if (payload.role === 'FUNCIONARIO') {
          payload.role = 'EMPLOYEE';
        }

        this.orgService.createUser(payload).subscribe({
          next: () => {
            this.snackBar.open('Usuario registrado correctamente', 'OK', { duration: 3000 });
            this.loadUsers();
          },
          error: (e) => {
            this.snackBar.open(e?.error?.message || 'Error al guardar el usuario en el servidor', 'OK', { duration: 4000 });
          }
        });
      }
    });
  }

  openDetail(user: UserRow): void {
    this.selectedUser = user;
    this.viewMode = 'detail';
    this.breadcrumbs = [
      { label: 'Organización' },
      { label: 'Usuarios', action: () => this.backToList() },
      { label: user.username }
    ];
    this.cdr.detectChanges();
  }

  backToList(): void {
    this.viewMode = 'list';
    this.selectedUser = null;
    this.breadcrumbs = [
      { label: 'Organización' },
      { label: 'Usuarios' }
    ];
    this.cdr.detectChanges();
  }

  confirmDelete(user: UserRow): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Eliminar usuario',
        message: `¿Confirma eliminar al usuario "${user.username}"?`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        danger: true
      }
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.orgService.deleteUser(user.id).subscribe({
        next: () => {
          this.snackBar.open('Usuario eliminado', 'OK', { duration: 3000 });
          this.loadUsers();
        },
        error: (e: any) => {
          this.snackBar.open(e?.error?.message || 'Error al eliminar el usuario', 'OK', { duration: 4000 });
        }
      });
    });
  }
}