import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatFormFieldModule
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="dynamic-form">
      @if (schema?.title) {
        <h3>{{ schema.title }}</h3>
      }
      @if (schema?.description) {
        <p class="form-description">{{ schema.description }}</p>
      }

      @for (field of schema?.fields; track field.name) {
        <!-- TEXT -->
        @if (field.type === 'TEXT') {
          <mat-form-field class="full-width">
            <mat-label>{{ field.label }}</mat-label>
            <input matInput [formControlName]="field.name" 
                   [placeholder]="field.placeholder || ''">
            @if (field.helpText) {
              <mat-hint>{{ field.helpText }}</mat-hint>
            }
            @if (form.get(field.name)?.invalid && form.get(field.name)?.touched) {
              <mat-error>{{ field.label }} es requerido</mat-error>
            }
          </mat-form-field>
        }

        <!-- NUMBER -->
        @if (field.type === 'NUMBER') {
          <mat-form-field class="full-width">
            <mat-label>{{ field.label }}</mat-label>
            <input matInput type="number" [formControlName]="field.name">
            @if (form.get(field.name)?.invalid && form.get(field.name)?.touched) {
              <mat-error>{{ field.label }} es requerido</mat-error>
            }
          </mat-form-field>
        }

        <!-- BOOLEAN -->
        @if (field.type === 'BOOLEAN') {
          <div class="checkbox-field">
            <mat-checkbox [formControlName]="field.name">
              {{ field.label }}
            </mat-checkbox>
          </div>
        }

        <!-- SELECT -->
        @if (field.type === 'SELECT') {
          <mat-form-field class="full-width">
            <mat-label>{{ field.label }}</mat-label>
            <mat-select [formControlName]="field.name">
              @for (opt of field.options; track opt.value) {
                <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        <!-- IMAGE -->
        @if (field.type === 'IMAGE') {
          <div class="file-field">
            <label>{{ field.label }}</label>
            <input type="file" accept="image/*" (change)="onFileChange($event, field.name)">
            @if (previews[field.name]) {
              <img [src]="previews[field.name]" class="preview" alt="Preview">
            }
          </div>
        }

        <!-- SIGNATURE -->
        @if (field.type === 'SIGNATURE') {
          <div class="signature-field">
            <label>{{ field.label }}</label>
            <canvas #sigCanvas width="400" height="150" class="sig-canvas"></canvas>
            <button type="button" mat-stroked-button (click)="clearSignature(field.name)">
              Borrar firma
            </button>
          </div>
        }

        <!-- GEOLOCATION -->
        @if (field.type === 'GEOLOCATION') {
          <div class="geo-field">
            <label>{{ field.label }}</label>
            <button type="button" mat-stroked-button (click)="captureLocation(field.name)">
              📍 Capturar ubicación GPS
            </button>
            @if (form.get(field.name)?.value) {
              <span class="geo-coords">
                Lat: {{ form.get(field.name)?.value?.lat | number:'1.4-4' }},
                Lng: {{ form.get(field.name)?.value?.lng | number:'1.4-4' }}
              </span>
            }
          </div>
        }

        <!-- DATE -->
        @if (field.type === 'DATE') {
          <mat-form-field class="full-width">
            <mat-label>{{ field.label }}</mat-label>
            <input matInput type="date" [formControlName]="field.name">
          </mat-form-field>
        }
      }

      <!-- Botones de acción -->
      <div class="form-actions">
        <button mat-stroked-button type="button" (click)="saveDraft()">
          💾 Guardar borrador
        </button>
        <button mat-raised-button color="warn" type="button" (click)="reject()">
          ❌ Rechazar
        </button>
        <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid">
          ✅ Completar tarea
        </button>
      </div>
    </form>
  `,
  styles: [`
    .dynamic-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 24px;
      max-width: 600px;
      margin: 0 auto;
    }
    .full-width {
      width: 100%;
    }
    .form-description {
      color: #666;
      margin: 0 0 16px 0;
    }
    .checkbox-field {
      margin: 8px 0;
    }
    .file-field, .signature-field, .geo-field {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .file-field label, .signature-field label, .geo-field label {
      font-weight: 500;
      color: #333;
    }
    .preview {
      max-width: 200px;
      border-radius: 4px;
      border: 1px solid #ddd;
    }
    .sig-canvas {
      border: 2px solid #ccc;
      border-radius: 4px;
      background: white;
    }
    .geo-coords {
      font-size: 12px;
      color: #666;
    }
    .form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }
  `]
})
export class DynamicFormComponent implements OnInit {
  @Input() schema: any = null;
  @Input() existingData: any = null;
  @Output() submitted = new EventEmitter<any>();
  @Output() draftSaved = new EventEmitter<any>();
  @Output() rejected = new EventEmitter<string>();

  form!: FormGroup;
  previews: Record<string, string> = {};

  constructor(private fb: FormBuilder, private api: ApiService) {}

  ngOnInit(): void {
    this.buildForm();
    if (this.existingData) {
      this.form.patchValue(this.existingData);
    }
  }

  private buildForm(): void {
    const controls: Record<string, any> = {};
    
    this.schema?.fields?.forEach((f: any) => {
      const validators = f.required ? [Validators.required] : [];
      controls[f.name] = [this.existingData?.[f.name] ?? f.defaultValue ?? null, validators];
    });
    
    this.form = this.fb.group(controls);
  }

  onFileChange(event: Event, fieldName: string): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.api.uploadFile('/files/upload', file, 'tareas').subscribe({
      next: (res: any) => {
        this.form.patchValue({ [fieldName]: res.url });
        const reader = new FileReader();
        reader.onload = e => this.previews[fieldName] = e.target?.result as string;
        reader.readAsDataURL(file);
      },
      error: (err) => console.error('Error uploading file:', err)
    });
  }

  captureLocation(fieldName: string): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.form.patchValue({
            [fieldName]: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            }
          });
        },
        (err) => console.error('Error getting location:', err)
      );
    } else {
      alert('Geolocalización no soportada en este navegador');
    }
  }

  clearSignature(fieldName: string): void {
    this.form.patchValue({ [fieldName]: null });
  }

  submit(): void {
    if (this.form.valid) {
      this.submitted.emit(this.form.value);
    }
  }

  saveDraft(): void {
    this.draftSaved.emit(this.form.value);
  }

  reject(): void {
    const motivo = prompt('Motivo del rechazo:');
    if (motivo) {
      this.rejected.emit(motivo);
    }
  }
}