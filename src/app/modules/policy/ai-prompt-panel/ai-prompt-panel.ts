import { Component, Input, Output, EventEmitter } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { PolicyService } from '../services/policy.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-ai-prompt-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatButtonToggleModule
  ],
  template: `
    <div class="ai-panel-content">
      <div class="ai-header">
        <mat-icon color="primary">auto_awesome</mat-icon>
        <h3>Asistente IA</h3>
      </div>

      <p class="ai-desc">
        Describe el proceso en lenguaje natural. La IA generará el diagrama automáticamente.
      </p>

      <mat-button-toggle-group [(ngModel)]="mode" class="mode-toggle">
        <mat-button-toggle value="generate">✨ Generar nuevo</mat-button-toggle>
        <mat-button-toggle value="refine" [disabled]="!policy?.id">🔧 Refinar actual</mat-button-toggle>
      </mat-button-toggle-group>

      <textarea [(ngModel)]="prompt" class="ai-prompt-input"
                [placeholder]="getPlaceholder()" rows="8">
      </textarea>

      <div class="prompt-examples">
        <p class="examples-title">💡 Ejemplos:</p>
        @for (ex of examples; track ex.label) {
          <button class="example-chip" (click)="useExample(ex)">{{ ex.label }}</button>
        }
      </div>

      <button mat-raised-button color="primary" class="generate-btn"
              (click)="generate()" [disabled]="!prompt.trim() || loading">
        @if (loading) {
          <mat-spinner diameter="16"></mat-spinner>
          <span>Generando...</span>
        } @else {
          <span>{{ mode === 'generate' ? '🚀 Generar diagrama' : '🔧 Aplicar cambios' }}</span>
        }
      </button>

      @if (error) {
        <div class="error-message">{{ error }}</div>
      }

      @if (history.length > 0) {
        <div class="prompt-history">
          <p class="history-title">📝 Historial:</p>
          @for (h of history; track $index) {
            <div class="history-item">
              <span>{{ h | slice:0:60 }}...</span>
              <button mat-icon-button (click)="prompt = h">
                <mat-icon>replay</mat-icon>
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .ai-panel-content { padding: 8px; }
    .ai-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .ai-header h3 { margin: 0; }
    .ai-desc { color: #666; font-size: 13px; margin-bottom: 16px; }
    .mode-toggle { width: 100%; margin-bottom: 12px; }
    .ai-prompt-input {
      width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 8px;
      font-family: inherit; resize: vertical; box-sizing: border-box;
    }
    .prompt-examples { margin: 12px 0; }
    .examples-title { font-size: 12px; color: #888; margin-bottom: 4px; }
    .example-chip {
      display: inline-block; margin: 4px; padding: 4px 10px;
      background: #f0f0f0; border: none; border-radius: 16px;
      font-size: 12px; cursor: pointer;
    }
    .example-chip:hover { background: #e0e0e0; }
    .generate-btn { width: 100%; margin-top: 12px; display: flex; align-items: center; gap: 8px; justify-content: center; }
    .error-message { color: #f44336; margin-top: 8px; font-size: 13px; }
    .prompt-history { margin-top: 16px; border-top: 1px solid #eee; padding-top: 12px; }
    .history-title { font-size: 12px; color: #888; margin-bottom: 8px; }
    .history-item { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  `]
})
export class AiPromptPanelComponent {
  @Input() policy: any = null;
  @Output() diagramGenerated = new EventEmitter<any>();
  @Output() diagramRefined = new EventEmitter<any>();

  mode = 'generate';
  prompt = '';
  loading = false;
  error = '';
  history: string[] = [];

  examples = [
    {
      label: 'Instalación medidor',
      text: 'Proceso instalación medidor eléctrico: cliente solicita, verificar deuda, si debe rechazar, si no inspeccionar y luego instalar con firma'
    },
    {
      label: 'Aprobación de crédito',
      text: 'Crédito: recibir solicitud, verificar historial crediticio, si es malo rechazar, si es bueno aprobar y notificar al cliente'
    },
    {
      label: 'Atención de reclamo',
      text: 'Reclamo: registrar queja del cliente, asignar a técnico, inspeccionar en campo, resolver y notificar resolución al cliente'
    }
  ];

  constructor(private policyService: PolicyService) {}

  getPlaceholder(): string {
    return this.mode === 'generate'
      ? 'Ej: Proceso de instalación de medidor eléctrico: el cliente solicita...'
      : 'Ej: Agrega un paso de revisión documental antes de la inspección...';
  }

  useExample(ex: any): void {
    this.prompt = ex.text;
  }

  generate(): void {
    if (!this.prompt.trim()) return;
    this.loading = true;
    this.error = '';

    if (this.history.length === 0 || this.history[0] !== this.prompt) {
      this.history.unshift(this.prompt);
    }

    if (this.mode === 'generate') {
      this.policyService.generateWithAI(this.prompt)
        .pipe(
          finalize(() => this.loading = false) // 2. Esto se ejecuta SIEMPRE (éxito o fallo)
        )
        .subscribe({
          next: (result) => {
            this.diagramGenerated.emit(result);
          },
          error: (error: HttpErrorResponse) => {
            this.error = this.logHttpError('generar', error);
          }
        });
    } else {
      this.policyService.refineWithAI(this.prompt, this.policy)
      .pipe(
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (result) => {
          this.diagramRefined.emit(result);
        },
        error: (error: HttpErrorResponse) => {
          this.error = this.logHttpError('refinar', error);
        }
      });
    }
  }

  /**
   * Vuelca al console todo el detalle del HttpErrorResponse (status, message y el
   * body que devuelve el backend) y devuelve un mensaje legible para la UI.
   */
  private logHttpError(accion: 'generar' | 'refinar', error: HttpErrorResponse): string {
    // Body crudo devuelto por el backend (puede ser string, ProblemDetail, stacktrace, etc.).
    console.error('Detalle del error del servidor:', error.error);

    console.error(`Error al ${accion} el diagrama:`, {
      status: error.status,
      statusText: error.statusText,
      message: error.message,
      url: error.url,
      body: error.error,
      name: error.name
    });

    // Si el navegador no pudo siquiera contactar al servidor, error.error es un ErrorEvent.
    if (error.error instanceof ErrorEvent) {
      console.error('Error de red/cliente:', error.error.message);
      return error.error.message || `Error de red al ${accion} el diagrama`;
    }

    // Errores de servidor (4xx/5xx): intentamos extraer un mensaje útil del body.
    const body = error.error;
    const serverMessage =
      body?.detail ?? body?.message ?? body?.error ?? (typeof body === 'string' ? body : null);

    return serverMessage || `Error al ${accion} el diagrama (HTTP ${error.status})`;
  }
}