import { Routes } from '@angular/router';
import { AuthGuard } from '../../core/guards/auth.guard';

export const TASK_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./task-list/task-list.component')
      .then(m => m.TaskListComponent),
    canActivate: [AuthGuard]
  },
  {
    path: ':id',
    loadComponent: () => import('./task-detail/task-detail.component')
      .then(m => m.TaskDetailComponent),
    canActivate: [AuthGuard]
  }
];