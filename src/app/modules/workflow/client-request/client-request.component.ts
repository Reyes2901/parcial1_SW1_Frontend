import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';

interface ProcessType {
  id: string;
  name: string;
  description?: string;
  requiredFields?: any[];
}

@Component({
  selector: 'app-client-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="req-page">
      <header class="req-header">
        <div>
          <p class="req-eyebrow">Portal del cliente</p>
          <h1 class="req-title">Nueva solicitud</h1>
        </div>
      </header>

      <!-- Loading -->
      <div class="loading-state" *ngIf="loadingTypes">
        <div class="loader-bar"></div>
        <p>Cargando tipos de proceso...</p>
      </div>

      <!-- Error loading types -->
      <div class="error-state" *ngIf="!loadingTypes && errorTypes">
        <span class="error-icon">⚠</span>
        <p>{{ errorTypes }}</p>
        <button class="btn-primary" (click)="loadProcessTypes()">Reintentar</button>
      </div>

      <!-- Form -->
      <div class="req-form-wrapper" *ngIf="!loadingTypes && !errorTypes">

        <!-- Success message -->
        <div class="success-state" *ngIf="submitted">
          <span class="success-icon">✓</span>
          <h2>Solicitud enviada exitosamente</h2>
          <p>Tu trámite ha sido registrado y será procesado pronto.</p>
          <div class="success-actions">
            <button class="btn-primary" (click)="resetForm()">Nueva solicitud</button>
            <button class="btn-secondary" (click)="goToTracking()">Ver mis solicitudes</button>
          </div>
        </div>

        <form class="req-form" *ngIf="!submitted" (ngSubmit)="submit()">
          <!-- Process type selector -->
          <div class="form-group">
            <label class="form-label">Tipo de trámite</label>
            <div class="select-wrapper">
              <select class="form-select"
                      [(ngModel)]="selectedProcessTypeId"
                      name="processTypeId"
                      (ngModelChange)="onProcessTypeChange()"
                      required>
                <option value="" disabled>Selecciona un tipo de trámite</option>
                <option *ngFor="let pt of processTypes" [value]="pt.id">{{ pt.name }}</option>
              </select>
              <span class="select-arrow">▾</span>
            </div>
            <p class="form-hint" *ngIf="selectedProcessType?.description">
              {{ selectedProcessType?.description }}
            </p>
          </div>

          <!-- Dynamic fields based on process type -->
          <ng-container *ngIf="selectedProcessType?.requiredFields?.length">
            <div class="form-group" *ngFor="let field of selectedProcessType?.requiredFields">
              <label class="form-label">{{ field.label || field.name }}</label>
              <input class="form-input"
                     *ngIf="field.type === 'TEXT' || field.type === 'STRING' || !field.type"
                     type="text"
                     [(ngModel)]="dynamicFields[field.name]"
                     [name]="field.name"
                     [placeholder]="field.placeholder || ''"
                     [required]="field.required !== false">
              <input class="form-input"
                     *ngIf="field.type === 'NUMBER'"
                     type="number"
                     [(ngModel)]="dynamicFields[field.name]"
                     [name]="field.name"
                     [required]="field.required !== false">
              <input class="form-input"
                     *ngIf="field.type === 'DATE'"
                     type="date"
                     [(ngModel)]="dynamicFields[field.name]"
                     [name]="field.name"
                     [required]="field.required !== false">
              <textarea class="form-textarea"
                        *ngIf="field.type === 'TEXTAREA'"
                        [(ngModel)]="dynamicFields[field.name]"
                        [name]="field.name"
                        rows="3"
                        [required]="field.required !== false">
              </textarea>
              <p class="form-hint" *ngIf="field.helpText">{{ field.helpText }}</p>
            </div>
          </ng-container>

          <!-- Submit -->
          <div class="form-actions">
            <button class="btn-primary btn-submit"
                    type="submit"
                    [disabled]="submitting || !selectedProcessTypeId">
              <span *ngIf="!submitting">Enviar solicitud</span>
              <span *ngIf="submitting" class="submitting-text">
                <span class="spin">↻</span> Enviando...
              </span>
            </button>
          </div>

          <!-- Submit error -->
          <div class="submit-error" *ngIf="submitError">
            {{ submitError }}
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    :host {
      display: block;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      --green-dk: #08420c;
      --green-lt: #e1f5a6;
      --green-mid: #1a6b22;
      --surface: #fafaf9;
      --card-bg: #fff;
      --border: rgba(0,0,0,.08);
      --text-1: #1a1a1a;
      --text-2: #555;
      --text-3: #888;
    }

    .req-page {
      padding: 28px 32px;
      max-width: 640px;
      margin: 0 auto;
    }

    .req-header {
      margin-bottom: 28px;
    }

    .req-eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .12em;
      color: var(--green-mid);
      margin: 0 0 4px;
    }

    .req-title {
      font-size: 22px;
      font-weight: 800;
      color: var(--text-1);
      margin: 0;
      letter-spacing: -.02em;
    }

    /* States */
    .loading-state, .error-state {
      text-align: center;
      padding: 56px 24px;
      color: var(--text-3);
    }

    .loader-bar {
      width: 120px;
      height: 3px;
      margin: 0 auto 16px;
      background: rgba(0,0,0,.06);
      border-radius: 2px;
      overflow: hidden;
      position: relative;
    }
    .loader-bar::after {
      content: '';
      position: absolute;
      left: -40%;
      width: 40%;
      height: 100%;
      background: var(--green-mid);
      border-radius: 2px;
      animation: slide 1.2s ease-in-out infinite;
    }
    @keyframes slide {
      0% { left: -40%; }
      100% { left: 100%; }
    }

    .error-icon { font-size: 28px; display: block; margin-bottom: 8px; }
    .error-state { color: #c0392b; }

    .success-state {
      text-align: center;
      padding: 48px 24px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    .success-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      background: #e8f5e9;
      color: #2e7d32;
      border-radius: 50%;
      font-size: 22px;
      font-weight: 800;
      margin-bottom: 16px;
    }
    .success-state h2 {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-1);
      margin: 0 0 8px;
    }
    .success-state p {
      color: var(--text-3);
      margin: 0 0 24px;
      font-size: 14px;
    }
    .success-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
    }

    /* Form */
    .req-form {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-1);
      margin-bottom: 6px;
    }

    .select-wrapper {
      position: relative;
    }

    .form-select, .form-input, .form-textarea {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid rgba(0,0,0,.12);
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      color: var(--text-1);
      background: #fafaf9;
      transition: border-color .15s;
      box-sizing: border-box;
    }

    .form-select {
      appearance: none;
      padding-right: 36px;
      cursor: pointer;
    }

    .select-arrow {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-3);
      pointer-events: none;
      font-size: 12px;
    }

    .form-input:focus, .form-select:focus, .form-textarea:focus {
      outline: none;
      border-color: var(--green-mid);
      box-shadow: 0 0 0 3px rgba(26,107,34,.08);
    }

    .form-textarea {
      resize: vertical;
      min-height: 80px;
    }

    .form-hint {
      font-size: 12px;
      color: var(--text-3);
      margin: 6px 0 0;
    }

    .form-actions {
      margin-top: 24px;
    }

    .btn-primary {
      padding: 10px 24px;
      background: var(--green-mid);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background .15s;
      font-family: inherit;
    }
    .btn-primary:hover { background: var(--green-dk); }
    .btn-primary:disabled { opacity: .5; cursor: default; }

    .btn-secondary {
      padding: 10px 24px;
      background: transparent;
      color: var(--green-mid);
      border: 1px solid var(--green-mid);
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s;
      font-family: inherit;
    }
    .btn-secondary:hover { background: rgba(26,107,34,.06); }

    .btn-submit { width: 100%; }

    .spin { display: inline-block; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .submitting-text { display: inline-flex; align-items: center; gap: 6px; }

    .submit-error {
      margin-top: 12px;
      padding: 10px 14px;
      background: #fce4ec;
      color: #c62828;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }

    @media (max-width: 640px) {
      .req-page { padding: 16px; }
      .req-form { padding: 20px; }
    }
  `]
})
export class ClientRequestComponent implements OnInit {
  processTypes: ProcessType[] = [];
  selectedProcessTypeId = '';
  selectedProcessType: ProcessType | null = null;
  dynamicFields: Record<string, any> = {};

  loadingTypes = true;
  errorTypes: string | null = null;
  submitting = false;
  submitError: string | null = null;
  submitted = false;

  constructor(
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadProcessTypes();
  }

  loadProcessTypes(): void {
    this.loadingTypes = true;
    this.errorTypes = null;

    this.api.get<any>('/api/process-types').subscribe({
      next: (raw) => {
        this.processTypes = this.normalizeProcessTypes(raw);
        this.loadingTypes = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorTypes = err.error?.message || 'Error al cargar los tipos de proceso';
        this.loadingTypes = false;
        this.cdr.detectChanges();
      }
    });
  }

  onProcessTypeChange(): void {
    this.selectedProcessType = this.processTypes.find(p => p.id === this.selectedProcessTypeId) || null;
    this.dynamicFields = {};
    this.submitError = null;
  }

  submit(): void {
    if (!this.selectedProcessTypeId) return;
    this.submitting = true;
    this.submitError = null;

    const payload: any = {
      processTypeId: this.selectedProcessTypeId,
      ...this.dynamicFields,
    };

    this.api.post<any>('/api/workflow/start', payload).subscribe({
      next: () => {
        this.submitting = false;
        this.submitted = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submitting = false;
        this.submitError = err.error?.message || 'Error al enviar la solicitud';
        this.cdr.detectChanges();
      }
    });
  }

  resetForm(): void {
    this.submitted = false;
    this.selectedProcessTypeId = '';
    this.selectedProcessType = null;
    this.dynamicFields = {};
    this.submitError = null;
  }

  goToTracking(): void {
    this.router.navigate(['/workflow/mis-solicitudes']);
  }

  private normalizeProcessTypes(raw: unknown): ProcessType[] {
    const arr = Array.isArray(raw) ? raw :
      (raw && typeof raw === 'object' ? ((raw as any).data || (raw as any).content || (raw as any).items || []) : []);
    if (!Array.isArray(arr)) return [];

    return arr.map((item: any, index: number) => ({
      id: item.id || item.processTypeId || `pt-${index}`,
      name: item.name || item.processName || `Proceso ${index + 1}`,
      description: item.description || '',
      requiredFields: item.requiredFields || item.fields || [],
    }));
  }
}
