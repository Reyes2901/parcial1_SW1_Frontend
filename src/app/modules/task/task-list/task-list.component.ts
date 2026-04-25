import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TaskService } from '../services/task.service';
import { WebSocketService } from '../../../core/services/websocket.service';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  
  template: `
    <div class="task-list-container">
      <div class="header">
        <h2>📋 Mis Tareas</h2>
        <div class="header-info">
          <span class="badge urgent" *ngIf="urgentCount > 0">{{ urgentCount }} urgentes</span>
          <span class="ws-status" [class.connected]="wsConnected">
            {{ wsConnected ? '🟢 En vivo' : '🔴 Reconectando...' }}
          </span>
        </div>
      </div>

      <!-- Loading state -->
      <div *ngIf="loading" class="loading-state">
        <p>⏳ Cargando tareas...</p>
      </div>

      <!-- Error state -->
      <div *ngIf="error" class="error-state">
        <p>❌ {{ error }}</p>
        <button (click)="retryLoad()">Reintentar</button>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading && !error && tasks && tasks.length === 0" class="empty-state">
        <p>🎉 No tienes tareas pendientes</p>
      </div>

      <!-- Task grid -->
      <div *ngIf="!loading && !error && tasks && tasks.length > 0" class="task-grid">
        <div 
          class="task-card" 
          *ngFor="let task of tasks; trackBy: trackByTaskId"
          [class.priority-urgent]="getPriorityClass(task) === 'priority-urgent'"
          [class.priority-high]="getPriorityClass(task) === 'priority-high'"
          (click)="openTask(task)">
          
          <div class="task-header">
            <div class="task-title">{{ task.nodeLabel }}</div>
            <span class="status-badge" [class.status-in-progress]="task.status === 'IN_PROGRESS'"
                                         [class.status-pending]="task.status === 'PENDING'"
                                         [class.status-completed]="task.status === 'COMPLETED'">
              {{ getStatusLabel(task.status) }}
            </span>
          </div>
          
          <div class="task-client" *ngIf="task.clientName">
            👤 Cliente: {{ task.clientName }}
          </div>
          
          <div class="task-due" *ngIf="task.dueAt">
            📅 Vence: {{ task.dueAt | date:'dd/MM/yyyy HH:mm' }}
            <span class="overdue-tag" *ngIf="isOverdue(task)">⚠️ VENCIDA</span>
          </div>

          <div class="task-actions">
            <button 
              class="btn-start" 
              *ngIf="canStartTask(task)"
              (click)="startTask(task); $event.stopPropagation()">
              ▶️ Iniciar Tarea
            </button>
            <button 
              class="btn-continue" 
              *ngIf="task.status === 'IN_PROGRESS'"
              (click)="continueTask(task); $event.stopPropagation()">
              📝 Continuar Tarea
            </button>
            <span class="task-info-text" *ngIf="task.startedAt && task.status === 'IN_PROGRESS'">
              Iniciada: {{ task.startedAt | date:'dd/MM/yyyy HH:mm' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
  
  styles: [`
    .task-list-container {
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e0e0e0;
    }
    
    .header h2 { 
      margin: 0; 
      color: #333;
      font-size: 24px;
    }
    
    .header-info { 
      display: flex; 
      gap: 12px; 
      align-items: center; 
    }
    
    .badge {
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .badge.urgent {
      background: #ffebee;
      color: #c62828;
    }
    
    .ws-status {
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 16px;
      background: #f5f5f5;
      font-weight: 500;
    }
    
    .ws-status.connected {
      background: #e8f5e9;
      color: #2e7d32;
    }
    
    .loading-state,
    .error-state,
    .empty-state {
      text-align: center;
      padding: 48px 20px;
      color: #666;
      font-size: 18px;
      background: #fafafa;
      border-radius: 8px;
      margin: 20px 0;
    }
    
    .error-state {
      color: #c62828;
      background: #ffebee;
    }
    
    .error-state button {
      margin-top: 12px;
      padding: 8px 16px;
      background: #c62828;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    
    .error-state button:hover {
      background: #b71c1c;
    }
    
    .task-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .task-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      border-left: 4px solid #4caf50;
      position: relative;
    }
    
    .task-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    }
    
    .task-card:active {
      transform: translateY(0);
    }
    
    .task-card.priority-urgent {
      border-left-color: #f44336;
      background: #fff8f8;
      box-shadow: 0 2px 8px rgba(244,67,54,0.1);
    }
    
    .task-card.priority-high {
      border-left-color: #ff9800;
      background: #fffaf5;
      box-shadow: 0 2px 8px rgba(255,152,0,0.1);
    }
    
    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    
    .task-title { 
      font-weight: 600; 
      color: #333;
      font-size: 16px;
      flex: 1;
    }
    
    .status-badge {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 8px;
      white-space: nowrap;
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
    
    .status-badge.status-completed {
      background: #e8f5e9;
      color: #2e7d32;
    }
    
    .task-client { 
      color: #666;
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .task-due { 
      color: #888;
      font-size: 13px;
      margin-bottom: 8px;
    }
    
    .overdue-tag {
      color: #f44336;
      font-weight: 700;
      margin-left: 8px;
    }
    
    .task-actions {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #f0f0f0;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    
    .btn-start,
    .btn-continue {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background 0.2s;
      color: white;
    }
    
    .btn-start {
      background: #4caf50;
    }
    
    .btn-start:hover {
      background: #388e3c;
    }
    
    .btn-continue {
      background: #ff9800;
    }
    
    .btn-continue:hover {
      background: #f57c00;
    }
    
    .task-info-text {
      font-size: 12px;
      color: #888;
      margin-left: 8px;
    }

    @media (max-width: 600px) {
      .task-list-container {
        padding: 16px;
      }
      
      .header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
      
      .task-card {
        padding: 16px;
      }
    }
  `]
})
export class TaskListComponent implements OnInit, OnDestroy, AfterViewInit {
  tasks: any[] | null = null;
  loading = true;
  error: string | null = null;
  wsConnected = false;
  urgentCount = 0;
  private subs: Subscription[] = [];

  constructor(
    private taskService: TaskService,
    private wsService: WebSocketService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('🚀 TaskListComponent inicializado');
    this.loadInitialTasks();
    this.setupWebSocket();
  }

  ngAfterViewInit(): void {
    console.log('🎨 Vista renderizada');
  }

  private loadInitialTasks(): void {
    this.loading = true;
    this.error = null;
    
    this.taskService.getMyTasks().subscribe({
      next: (tasks) => {
        console.log('✅ Tareas recibidas:', tasks?.length || 0, 'tareas');
        
        if (Array.isArray(tasks)) {
          this.tasks = [...tasks];
        } else if (tasks && typeof tasks === 'object') {
          const possibleArray = (tasks as any).data || (tasks as any).content || (tasks as any).tasks;
          this.tasks = Array.isArray(possibleArray) ? possibleArray : [];
        } else {
          this.tasks = [];
        }
        
        this.updateUrgentCount();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error al cargar tareas:', err);
        this.error = 'No se pudieron cargar las tareas. Verifica tu conexión.';
        this.tasks = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private setupWebSocket(): void {
    this.wsService.connect();

    this.subs.push(
      this.wsService.taskNotifications$.subscribe(event => {
        if (event?.type === 'NEW_TASK' || event?.nodeLabel) {
          if (!this.tasks) {
            this.tasks = [];
          }
          const exists = this.tasks.some(t => t.id === event.id);
          if (!exists) {
            this.tasks.unshift(event);
            this.updateUrgentCount();
            this.cdr.detectChanges();
          }
        }
      }),
      
      this.wsService.isConnected().subscribe(connected => {
        this.wsConnected = connected;
        this.cdr.detectChanges();
      })
    );
  }

  retryLoad(): void {
    this.loadInitialTasks();
  }

  trackByTaskId(index: number, task: any): string {
    return task.id || task.taskId || index.toString();
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

  canStartTask(task: any): boolean {
    return task.status === 'PENDING' && !task.startedAt;
  }

  getPriorityClass(task: any): string {
    if (task.priority === 'URGENT' || this.isOverdue(task)) return 'priority-urgent';
    if (task.priority === 'HIGH') return 'priority-high';
    return 'priority-normal';
  }

  isOverdue(task: any): boolean {
    if (!task.dueAt) return false;
    try {
      return new Date(task.dueAt) < new Date();
    } catch {
      return false;
    }
  }

  openTask(task: any): void {
    const taskId = task.id || task.taskId;
    console.log('👆 Click en tarea:', taskId, '| Estado:', task.status);
    
    if (!taskId) {
      console.warn('⚠️ Tarea sin ID');
      return;
    }

    // SIEMPRE navegar al detalle de la tarea, sin intentar iniciarla automáticamente
    // El componente de detalle decidirá si necesita iniciarla o mostrar el formulario
    console.log('🧭 Navegando a:', '/tasks/' + taskId);
    this.router.navigate(['/tasks', taskId]).then(
      success => console.log('✅ Navegación exitosa:', success),
      error => console.error('❌ Error de navegación:', error)
    );
  }

  startTask(task: any): void {
    const taskId = task.id || task.taskId;
    if (!taskId) return;
    
    console.log('▶️ Iniciando tarea:', taskId);
    
    this.taskService.startTask(taskId).subscribe({
      next: (updatedTask) => {
        console.log('✅ Tarea iniciada:', updatedTask);
        
        // Actualizar la tarea en la lista local
        if (this.tasks) {
          const index = this.tasks.findIndex(t => (t.id || t.taskId) === taskId);
          if (index !== -1) {
            this.tasks[index] = { 
              ...this.tasks[index], 
              ...updatedTask, 
              status: 'IN_PROGRESS',
              startedAt: new Date().toISOString()
            };
            this.updateUrgentCount();
            this.cdr.detectChanges();
          }
        }
        
        // Después de iniciar exitosamente, navegar al detalle
        console.log('🧭 Navegando al detalle de la tarea iniciada');
        this.router.navigate(['/tasks', taskId]).then(
          success => console.log('✅ Navegación exitosa:', success),
          error => console.error('❌ Error de navegación:', error)
        );
      },
      error: (err) => {
        console.error('❌ Error al iniciar tarea:', err);
        
        if (err.status === 422) {
          // La tarea ya está iniciada, navegar al detalle de todos modos
          console.log('⚠️ Tarea ya iniciada, navegando al detalle');
          this.router.navigate(['/tasks', taskId]);
        } else if (err.status === 401 || err.status === 403) {
          console.error('🔒 Error de autenticación/autorización');
          alert('No tienes permisos para iniciar esta tarea.');
        } else {
          alert('Error al iniciar la tarea. Por favor intenta nuevamente.');
        }
      }
    });
  }

  continueTask(task: any): void {
    const taskId = task.id || task.taskId;
    if (taskId) {
      console.log('📝 Continuando tarea:', taskId);
      this.router.navigate(['/tasks', taskId]).then(
        success => console.log('✅ Navegación exitosa:', success),
        error => console.error('❌ Error de navegación:', error)
      );
    }
  }

  private updateUrgentCount(): void {
    if (!this.tasks) {
      this.urgentCount = 0;
      return;
    }
    this.urgentCount = this.tasks.filter(
      t => t.priority === 'URGENT' || this.isOverdue(t)
    ).length;
  }

  ngOnDestroy(): void {
    console.log('🧹 Limpiando suscripciones...');
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
  }
}