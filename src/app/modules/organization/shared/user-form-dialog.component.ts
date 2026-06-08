import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OrganizationService } from '../../../core/services/organization.service';

export interface UserFormDialogData {
  mode: 'create';
}

const ROLES = [
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'FUNCIONARIO', label: 'FUNCIONARIO' },
  { value: 'CLIENTE', label: 'CLIENTE' }
];

@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule
  ],
  template: `
    <h2 mat-dialog-title>Nuevo Usuario</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Username *</mat-label>
        <input matInput [(ngModel)]="username" name="username" required minlength="3">
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Password *</mat-label>
        <input matInput type="password" [(ngModel)]="password" name="password" required minlength="4">
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Rol *</mat-label>
        <mat-select [(ngModel)]="role" name="role" (selectionChange)="onRoleChange()">
          @for (r of roles; track r.value) {
            <mat-option [value]="r.value">{{ r.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      @if (showDepartment) {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Departamento *</mat-label>
          <mat-select [(ngModel)]="departmentId" name="departmentId" [disabled]="loadingDepts">
            @for (d of departments; track d.id) {
              <mat-option [value]="d.id">{{ d.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      @if (errorMsg) {
        <p class="form-error">{{ errorMsg }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [disabled]="saving" (click)="dialogRef.close(false)">Cancelar</button>
      <button mat-raised-button color="primary" type="button"
              [disabled]="!formValid || saving" (click)="save()">
        @if (saving) { <mat-spinner diameter="18"></mat-spinner> }
        @else { Registrar }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; display: block; margin-bottom: 8px; }
    .form-error { color: #dc2626; font-size: 13px; margin: 8px 0 0; }
  `]
})
export class UserFormDialogComponent implements OnInit {
  username = '';
  password = '';
  role = 'FUNCIONARIO';
  departmentId = '';
  departments: { id: string; name: string }[] = [];
  loadingDepts = true;
  saving = false;
  errorMsg = '';
  roles = ROLES;

  constructor(
    public dialogRef: MatDialogRef<UserFormDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: UserFormDialogData,
    private orgService: OrganizationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.orgService.getDepartments().subscribe({
      next: (depts) => {
        this.departments = depts.map((d: any) => ({
          id: String(d.id || d._id || d.name),
          name: d.name || String(d.id)
        }));
        this.loadingDepts = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingDepts = false;
        this.cdr.detectChanges();
      }
    });
  }

  get showDepartment(): boolean {
    return this.role !== 'ADMIN';
  }

  get formValid(): boolean {
    if (!this.username.trim() || this.password.length < 4) return false;
    if (this.showDepartment && !this.departmentId) return false;
    return true;
  }

  onRoleChange(): void {
    if (this.role === 'ADMIN') {
      this.departmentId = '';
    }
  }

  save(): void {
    if (!this.formValid) return;

    this.saving = true;
    this.errorMsg = '';

    const dto: any = {
      username: this.username.trim(),
      password: this.password,
      role: this.role === 'CLIENTE' ? 'CLIENT' : this.role
    };
    if (this.showDepartment && this.departmentId) {
      dto.departmentId = this.departmentId;
    }

    this.orgService.createUser(dto).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
        this.cdr.detectChanges();
      },
      error: (e: any) => {
        this.errorMsg = e?.error?.message || 'Error al registrar el usuario';
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }
}
