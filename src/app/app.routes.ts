import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { 
    path: 'login', 
    loadComponent: () => import('./modules/auth/login/login.component')
      .then(m => m.LoginComponent)
  },
  { 
    path: 'dashboard', 
    loadComponent: () => import('./modules/dashboard/dashboard.component')
      .then(m => m.DashboardComponent),
    canActivate: [AuthGuard, RoleGuard], 
    data: { role: 'ADMIN' } 
  },
  { 
    path: 'policies', 
    loadChildren: () => import('./modules/policy/policy.module')
      .then(m => m.PolicyModule),
    canActivate: [AuthGuard, RoleGuard], 
    data: { role: 'ADMIN' } 
  },
  // ✅ Ruta principal de tareas (lista)
  { 
    path: 'tasks', 
    loadComponent: () => import('./modules/task/task-list/task-list.component')
      .then(m => m.TaskListComponent),
    canActivate: [AuthGuard] 
  },
  // ✅ Ruta de detalle de tarea
  { 
    path: 'tasks/:id', 
    loadComponent: () => import('./modules/task/task-detail/task-detail.component')
      .then(m => m.TaskDetailComponent),
    canActivate: [AuthGuard] 
  },
  { 
    path: 'workflow', 
    loadChildren: () => import('./modules/workflow/workflow.module')
      .then(m => m.WorkflowModule),
    canActivate: [AuthGuard] 
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];