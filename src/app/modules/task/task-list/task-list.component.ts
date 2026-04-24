import { Component, OnInit, OnDestroy } from '@angular/core';
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
          @if (urgentCount > 0) {
            <span class="badge urgent">{{ urgentCount }} urgentes</span>
          }
          <span class="ws-status" [class.connected]="wsConnected">
            {{ wsConnected ? '🟢 En vivo' : '🔴 Reconectando...' }}
          </span>
        </div>
      </div>

      <div class="task-grid">
        @for (task of tasks; track task.id) {
          <div class="task-card" 
               [class]="getPriorityClass(task)"
               (click)="openTask(task)">
            <div class="task-header">
              <span class="task-title">{{ task.nodeLabel }}</span>
              <span class="status-badge">{{ task.status }}</span>
            </div>
            <div class="task-client">👤 Cliente: {{ task.clientName }}</div>
            <div class="task-due">
              ⏰ Vence: {{ task.dueAt | date:'dd/MM HH:mm' }}
              @if (isOverdue(task)) {
                <span class="overdue-tag">⚠️ VENCIDA</span>
              }
            </div>
            <div class="task-priority" *ngIf="task.priority">
              Prioridad: {{ task.priority }}
            </div>
          </div>
        }

        @if (tasks.length === 0) {
          <div class="empty-state">
            <p>🎉 No tienes tareas pendientes</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .task-list-container {
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .header h2 { margin: 0; color: #333; }
    .header-info { display: flex; gap: 12px; align-items: center; }
    .badge {
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge.urgent {
      background: #ffebee;
      color: #c62828;
    }
    .ws-status {
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      background: #f5f5f5;
    }
    .ws-status.connected {
      background: #e8f5e9;
      color: #2e7d32;
    }
    .task-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .task-card {
      background: white;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      border-left: 4px solid #4caf50;
    }
    .task-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .task-card.priority-urgent {
      border-left-color: #f44336;
      background: #fff8f8;
    }
    .task-card.priority-high {
      border-left-color: #ff9800;
      background: #fffaf5;
    }
    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .task-title { font-weight: 500; color: #333; }
    .status-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      background: #e3f2fd;
      color: #1565c0;
    }
    .task-client { color: #666; margin-bottom: 4px; }
    .task-due { color: #888; font-size: 13px; }
    .overdue-tag {
      color: #f44336;
      font-weight: bold;
      margin-left: 8px;
    }
    .empty-state {
      text-align: center;
      padding: 48px;
      color: #999;
      font-size: 18px;
    }
  `]
})
export class TaskListComponent implements OnInit, OnDestroy {
  tasks: any[] = [];
  wsConnected = false;
  urgentCount = 0;
  private subs: Subscription[] = [];

  constructor(
    private taskService: TaskService,
    private wsService: WebSocketService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Carga inicial desde REST
    this.taskService.getMyTasks().subscribe({
      next: (tasks) => {
        this.tasks = tasks;
        this.updateUrgentCount();
      },
      error: (err) => console.error('Error loading tasks:', err)
    });

    // Conectar WebSocket
    this.wsService.connect();

    // Escuchar nuevas tareas en tiempo real
    this.subs.push(
      this.wsService.taskNotifications$.subscribe(event => {
        if (event?.type === 'NEW_TASK' || event?.nodeLabel) {
          this.tasks.unshift(event);
          this.updateUrgentCount();
        }
      }),
      this.wsService.isConnected().subscribe(c => this.wsConnected = c)
    );
  }

  openTask(task: any): void {
    this.router.navigate(['/tasks', task.taskId || task.id]);
  }

  getPriorityClass(task: any): string {
    if (task.priority === 'URGENT' || this.isOverdue(task)) return 'priority-urgent';
    if (task.priority === 'HIGH') return 'priority-high';
    return 'priority-normal';
  }

  isOverdue(task: any): boolean {
    return task.dueAt && new Date(task.dueAt) < new Date();
  }

  private updateUrgentCount(): void {
    this.urgentCount = this.tasks.filter(
      t => t.priority === 'URGENT' || this.isOverdue(t)
    ).length;
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}