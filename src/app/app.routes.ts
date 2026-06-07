import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';
import { PolicyDiagramComponent } from './components/policy-diagram.component'; // 👈 Asegúrate de que apunte a tu archivo real

export const routes: Routes = [
  // 1️⃣ PRIMERO LAS RUTAS EXPLICITAS DEL DIAGRAMA (Para que no las secuestre el módulo de abajo)
  {
    path: 'policy/editor/:id',
    component: PolicyDiagramComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'policies/design/:id',
    component: PolicyDiagramComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'policy/design/:id',
    component: PolicyDiagramComponent,
    canActivate: [AuthGuard]
  },

  // 2️⃣ LUEGO LAS RUTAS GENERALES Y MÓDULOS LAZY LOADED
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
  {
    path: 'tasks',
    loadComponent: () => import('./modules/task/task-list/task-list.component')
      .then(m => m.TaskListComponent),
    canActivate: [AuthGuard]
  },
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

  // 3️⃣ SIEMPRE AL FINAL: Redirecciones y Wildcard
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];