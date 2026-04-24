import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TaskService } from '../services/task.service';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="task-detail">
      <h2>📝 Detalle de Tarea</h2>
      <p>ID: {{ taskId }}</p>
      <p>Componente en construcción...</p>
    </div>
  `
})
export class TaskDetailComponent implements OnInit {
  taskId: string = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.taskId = this.route.snapshot.paramMap.get('id') || '';
  }
}