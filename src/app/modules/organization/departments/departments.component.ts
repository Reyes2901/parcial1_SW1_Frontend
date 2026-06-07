import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OrganizationService } from '../../../core/services/organization.service';

interface DepartmentRow {
  name: string;
  source: string;
  userCount: number;
}

@Component({
  selector: 'app-departments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule
  ],
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Organización</p>
          <h1 class="title">Departamentos</h1>
        </div>
        <button mat-raised-button color="primary" (click)="onNewDepartment()">
          <mat-icon>add</mat-icon> Nuevo Departamento
        </button>
      </header>

      @if (showForm) {
        <mat-card class="create-card">
          <h3 class="form-title">Nuevo Departamento</h3>
          <div class="form-row">
            <mat-form-field appearance="outline" class="form-field">
              <mat-label>Nombre *</mat-label>
              <input matInput [(ngModel)]="newName" placeholder="Ej. Tecnología">
            </mat-form-field>
            <mat-form-field appearance="outline" class="form-field">
              <mat-label>Descripción</mat-label>
              <input matInput [(ngModel)]="newDescription" placeholder="Opcional">
            </mat-form-field>
          </div>
          <div class="form-actions">
            <button mat-button (click)="cancelForm()">Cancelar</button>
            <button mat-raised-button color="primary"
                    [disabled]="!newName.trim() || saving"
                    (click)="saveNewDepartment()">
              {{ saving ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </mat-card>
      }

      <mat-card class="table-card">
        @if (loading) {
          <div class="center-state">
            <mat-spinner diameter="32"></mat-spinner>
            <p>Cargando departamentos...</p>
          </div>
        } @else if (departments.length === 0) {
          <div class="center-state">
            <p>No se encontraron departamentos.</p>
          </div>
        } @else {
          <table mat-table [dataSource]="departments" class="full-width">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Nombre</th>
              <td mat-cell *matCellDef="let d">{{ d.name }}</td>
            </ng-container>

            <ng-container matColumnDef="source">
              <th mat-header-cell *matHeaderCellDef>Fuente</th>
              <td mat-cell *matCellDef="let d">
                <span class="source-chip" [class]="'src-' + d.source">
                  {{ d.source === 'lane' ? 'Lane (Política)' : 'Usuario' }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="userCount">
              <th mat-header-cell *matHeaderCellDef>Usuarios</th>
              <td mat-cell *matCellDef="let d">{{ d.userCount }}</td>
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
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      margin-bottom: 24px;
    }
    .eyebrow {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .12em; color: #1a6b22; margin: 0 0 4px;
    }
    .title { font-size: 22px; font-weight: 800; color: #1a1a1a; margin: 0; }
    .table-card { padding: 0; overflow: hidden; }
    .full-width { width: 100%; }
    .center-state { text-align: center; padding: 48px 24px; color: #888; }
    .source-chip {
      display: inline-block; padding: 2px 10px; border-radius: 12px;
      font-size: 11px; font-weight: 600;
    }
    .src-lane { background: #e3f2fd; color: #1565c0; }
    .src-user { background: #f3e5f5; color: #6a1b9a; }
    .create-card {
      padding: 20px 24px; margin-bottom: 20px;
      border-left: 4px solid #1976d2;
    }
    .form-title { font-size: 15px; font-weight: 700; margin: 0 0 16px; color: #1a1a1a; }
    .form-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .form-field { flex: 1; min-width: 200px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
  `]
})
export class DepartmentsComponent implements OnInit {
  departments: DepartmentRow[] = [];
  loading = true;
  displayedColumns = ['name', 'source', 'userCount'];
  showForm = false;
  newName = '';
  newDescription = '';
  saving = false;

  constructor(
    private orgService: OrganizationService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.loading = true;
    forkJoin({
      depts: this.orgService.getDepartments(),
      users: this.orgService.getUsers().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ depts, users }) => {
        // Build a count map: departmentId/name → userCount
        const countMap = new Map<string, number>();
        for (const user of users) {
          const key = user.departmentId ?? user.department;
          if (key) countMap.set(String(key), (countMap.get(String(key)) || 0) + 1);
        }

        // Primary source: /api/departments
        const deptMap = new Map<string, DepartmentRow>();
        for (const d of depts) {
          const name = d.name || d.id || String(d);
          const key = d.id ? String(d.id) : name;
          deptMap.set(name, {
            name,
            source: 'lane',
            userCount: countMap.get(key) ?? countMap.get(name) ?? 0
          });
        }

        // Supplement with any department values found only in users
        for (const user of users) {
          const dept = user.department || user.departmentId;
          if (dept && !deptMap.has(String(dept))) {
            deptMap.set(String(dept), { name: String(dept), source: 'user', userCount: countMap.get(String(dept)) || 1 });
          }
        }

        this.departments = Array.from(deptMap.values());
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (e: any) => {
        console.error('Error loading departments:', e);
        console.error('Detalle:', e.error);
        this.departments = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onNewDepartment(): void {
    this.showForm = !this.showForm;
    if (this.showForm) {
      this.newName = '';
      this.newDescription = '';
    }
  }

  cancelForm(): void {
    this.showForm = false;
    this.newName = '';
    this.newDescription = '';
  }

  saveNewDepartment(): void {
    if (!this.newName.trim()) return;
    this.saving = true;
    this.orgService.createDepartment({ name: this.newName.trim(), description: this.newDescription.trim() || undefined })
      .subscribe({
        next: () => {
          setTimeout(() => {
            this.showForm = false;
            this.newName = '';
            this.newDescription = '';
            this.saving = false;
            this.snackBar.open('Departamento creado correctamente', 'OK', { duration: 3000 });
            this.loadData();
            this.cdr.detectChanges();
          }, 0);
        },
        error: (e: any) => {
          this.snackBar.open(e?.error?.message || 'Error al crear el departamento', 'OK', { duration: 4000 });
          this.saving = false;
          this.cdr.detectChanges();
        }
      });
  }
}
