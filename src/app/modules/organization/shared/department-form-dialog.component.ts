import { Component, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OrganizationService } from '../../../core/services/organization.service';

export interface DepartmentFormDialogData {
  mode: 'create' | 'edit';
  department?: { id: string; name: string; description?: string };
}

@Component({
  selector: 'app-department-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.mode === 'create' ? 'Nuevo Departamento' : 'Editar Departamento' }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Nombre *</mat-label>
        <input matInput [(ngModel)]="name" name="name" minlength="3" maxlength="100" required>
        @if (nameTouched && !nameValid) {
          <mat-error>El nombre es obligatorio (3–100 caracteres).</mat-error>
        }
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Descripción *</mat-label>
        <textarea matInput [(ngModel)]="description" name="description" rows="3"
                  minlength="3" maxlength="100" required></textarea>
        @if (descTouched && !descValid) {
          <mat-error>La descripción es obligatoria (3–100 caracteres).</mat-error>
        }
      </mat-form-field>
      @if (errorMsg) {
        <p class="form-error">{{ errorMsg }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [disabled]="saving" (click)="dialogRef.close(false)">Cancelar</button>
      <button mat-raised-button color="primary" type="button"
              [disabled]="!formValid || saving" (click)="save()">
        @if (saving) { <mat-spinner diameter="18"></mat-spinner> }
        @else { Guardar }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; display: block; margin-bottom: 8px; }
    .form-error { color: #dc2626; font-size: 13px; margin: 8px 0 0; }
  `]
})
export class DepartmentFormDialogComponent {
  name = '';
  description = '';
  saving = false;
  errorMsg = '';
  nameTouched = false;
  descTouched = false;

  constructor(
    public dialogRef: MatDialogRef<DepartmentFormDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: DepartmentFormDialogData,
    private orgService: OrganizationService,
    private cdr: ChangeDetectorRef
  ) {
    if (data.department) {
      this.name = data.department.name || '';
      this.description = data.department.description || '';
    }
  }

  get nameValid(): boolean {
    const t = this.name.trim();
    return t.length >= 3 && t.length <= 100;
  }

  get descValid(): boolean {
    const t = this.description.trim();
    return t.length >= 3 && t.length <= 100;
  }

  get formValid(): boolean {
    return this.nameValid && this.descValid;
  }

  save(): void {
    this.nameTouched = true;
    this.descTouched = true;
    if (!this.formValid) return;

    this.saving = true;
    this.errorMsg = '';
    const payload = { name: this.name.trim(), description: this.description.trim() };

    const req$ = this.data.mode === 'create'
      ? this.orgService.createDepartment(payload)
      : this.orgService.updateDepartment(this.data.department!.id, payload);

    req$.subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
        this.cdr.detectChanges();
      },
      error: (e: any) => {
        this.errorMsg = e?.error?.message || 'Error al guardar el departamento';
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }
}
