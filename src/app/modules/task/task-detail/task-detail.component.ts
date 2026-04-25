import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { TaskService } from '../services/task.service';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    MatProgressSpinnerModule, 
    MatSnackBarModule, 
    MatButtonModule,
    DynamicFormComponent
  ],
  template: `
    <div class="task-detail-container">
      <!-- Loading state -->
      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>{{ loadingMessage }}</p>
        </div>
      }

      <!-- Error state -->
      @if (!loading && error) {
        <div class="error-container">
          <h3>❌ Error</h3>
          <p>{{ error }}</p>
          <div class="error-actions">
            <button mat-raised-button color="primary" (click)="retry()">
              🔄 Reintentar
            </button>
            <button mat-button (click)="goBack()">
              ← Volver a tareas
            </button>
          </div>
        </div>
      }

      <!-- Task detail with form -->
      @if (!loading && !error && taskForm) {
        <div class="task-detail">
          <div class="task-header">
            <button class="back-button" (click)="goBack()">
              ← Volver
            </button>
            <h2>{{ taskForm.nodeLabel }}</h2>
            
            <div class="task-info">
              <div class="info-row">
                <span class="label">Cliente:</span>
                <strong>{{ taskForm.clientName }}</strong>
              </div>
              
              @if (taskForm.dueAt) {
                <div class="info-row">
                  <span class="label">Vence:</span>
                  <strong [class.overdue]="isOverdue(taskForm.dueAt)">
                    {{ taskForm.dueAt | date:'dd/MM/yyyy HH:mm' }}
                    @if (isOverdue(taskForm.dueAt)) {
                      <span class="overdue-badge">⚠️ VENCIDA</span>
                    }
                  </strong>
                </div>
              }

              <div class="info-row">
                <span class="label">Estado:</span>
                <span class="status-badge" [class.status-in-progress]="taskForm.status === 'IN_PROGRESS'"
                                           [class.status-pending]="taskForm.status === 'PENDING'">
                  {{ getStatusLabel(taskForm.status) }}
                </span>
              </div>

              @if (taskForm.startedAt) {
                <div class="info-row">
                  <span class="label">Iniciada:</span>
                  <span>{{ taskForm.startedAt | date:'dd/MM/yyyy HH:mm' }}</span>
                </div>
              }
            </div>
          </div>

          <div class="form-container">
            <app-dynamic-form
              [schema]="taskForm.schema"
              [existingData]="taskForm.existingSubmission"
              (submitted)="onComplete($event)"
              (draftSaved)="onDraftSave($event)"
              (rejected)="onReject($event)">
            </app-dynamic-form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .task-detail-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 50vh;
      gap: 16px;
      color: #666;
    }

    .error-container {
      text-align: center;
      padding: 48px 24px;
      background: #fff3e0;
      border-radius: 8px;
      margin: 24px 0;
    }

    .error-container h3 {
      color: #e65100;
      margin: 0 0 12px 0;
    }

    .error-container p {
      color: #666;
      margin-bottom: 24px;
    }

    .error-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .task-detail {
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .task-header {
      background: white;
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      position: relative;
    }

    .back-button {
      background: none;
      border: none;
      color: #1976D2;
      cursor: pointer;
      font-size: 14px;
      padding: 4px 0;
      margin-bottom: 12px;
      display: inline-block;
      transition: color 0.2s;
    }

    .back-button:hover {
      color: #1565C0;
      text-decoration: underline;
    }

    .task-header h2 {
      margin: 0 0 16px 0;
      color: #333;
      font-size: 22px;
    }

    .task-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .label {
      color: #888;
      min-width: 70px;
    }

    .status-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      background: #e3f2fd;
      color: #1565c0;
    }

    .status-badge.status-in-progress {
      background: #fff3e0;
      color: #e65100;
    }

    .status-badge.status-pending {
      background: #f3e5f5;
      color: #6a1b9a;
    }

    .overdue {
      color: #f44336;
    }

    .overdue-badge {
      background: #ffebee;
      color: #c62828;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      margin-left: 8px;
      font-weight: 700;
    }

    .form-container {
      background: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    @media (max-width: 600px) {
      .task-detail-container {
        padding: 16px;
      }

      .task-header {
        padding: 16px;
      }

      .form-container {
        padding: 16px;
      }
    }
  `]
})
export class TaskDetailComponent implements OnInit {
  taskForm: any = null;
  taskId!: string;
  loading = true;
  loadingMessage = 'Cargando formulario...';
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private taskService: TaskService,
    private router: Router,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.taskId = this.route.snapshot.paramMap.get('id')!;
    console.log('📋 TaskDetailComponent iniciado - Task ID:', this.taskId);
    
    if (!this.taskId) {
      this.error = 'ID de tarea no encontrado en la URL';
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    // Cargar el formulario directamente, sin intentar iniciar la tarea
    // El startTask ya se hizo desde la lista o la tarea ya está IN_PROGRESS
    this.loadFormOnly();
  }

  private loadFormOnly(): void {
    this.loading = true;
    this.loadingMessage = 'Cargando formulario...';
    this.error = null;
    
    console.log('📄 Cargando formulario para tarea:', this.taskId);
    
    this.taskService.getForm(this.taskId).subscribe({
      next: (form) => {
        console.log('✅ Formulario cargado exitosamente:', form);
        this.taskForm = form;
        this.loading = false;
        this.cdr.detectChanges();
        console.log('🎯 Estado final - loading:', this.loading, 'taskForm:', !!this.taskForm);
      },
      error: (err) => {
        console.error('❌ Error al cargar formulario:', err);
        this.loading = false;
        
        if (err.status === 401 || err.status === 403) {
          this.error = 'No tienes permisos para ver este formulario.';
        } else if (err.status === 404) {
          this.error = 'La tarea no fue encontrada.';
        } else {
          this.error = 'Error al cargar el formulario. Intenta nuevamente.';
        }
        
        this.cdr.detectChanges();
        
        this.snackBar.open(
          'Error al cargar el formulario', 
          'OK', 
          { duration: 4000 }
        );
      }
    });
  }

  retry(): void {
    console.log('🔄 Reintentando carga...');
    this.loadFormOnly();
  }

  goBack(): void {
    this.router.navigate(['/tasks']);
  }

  isOverdue(dueAt: string): boolean {
    if (!dueAt) return false;
    try {
      return new Date(dueAt) < new Date();
    } catch {
      return false;
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'IN_PROGRESS': return 'En Progreso';
      case 'PENDING': return 'Pendiente';
      case 'COMPLETED': return 'Completada';
      case 'CANCELLED': return 'Cancelada';
      default: return status || 'Desconocido';
    }
  }

  onComplete(formData: any): void {
    console.log('✅ Completando tarea:', this.taskId);
    
    this.taskService.submitForm(this.taskId, formData).subscribe({
      next: () => {
        this.snackBar.open('✅ Tarea completada exitosamente', 'OK', { 
          duration: 3000
        });
        setTimeout(() => {
          this.router.navigate(['/tasks']);
        }, 1500);
      },
      error: (e) => {
        console.error('❌ Error al completar tarea:', e);
        const msg = e.error?.errors?.join(', ') || 
                    e.error?.message || 
                    'Error al completar la tarea';
        this.snackBar.open('❌ ' + msg, 'OK', { 
          duration: 5000
        });
      }
    });
  }

  onDraftSave(data: any): void {
    console.log('💾 Guardando borrador:', this.taskId);
    
    this.taskService.saveDraft(this.taskId, data).subscribe({
      next: () => {
        this.snackBar.open('💾 Borrador guardado correctamente', 'OK', { 
          duration: 2000 
        });
      },
      error: (err) => {
        console.error('❌ Error al guardar borrador:', err);
        this.snackBar.open('Error al guardar el borrador', 'OK', { 
          duration: 3000 
        });
      }
    });
  }

  onReject(motivo: string): void {
    console.log('❌ Rechazando tarea:', this.taskId);
    
    this.taskService.rejectTask(this.taskId, motivo).subscribe({
      next: () => {
        this.snackBar.open('❌ Tarea rechazada', 'OK', { 
          duration: 2000 
        });
        setTimeout(() => {
          this.router.navigate(['/tasks']);
        }, 1500);
      },
      error: (err) => {
        console.error('❌ Error al rechazar tarea:', err);
        this.snackBar.open('Error al rechazar la tarea', 'OK', { 
          duration: 3000 
        });
      }
    });
  }
}