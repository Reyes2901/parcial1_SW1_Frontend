import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';

const routes: Routes = [
  // Public routes
  {
    path: 'login',
    loadChildren: () => import('./modules/auth/auth.module').then(m => m.AuthModule)
  },

  // Authenticated shell — sidebar wraps all protected views
  {
    path: '',
    loadComponent: () => import('./shell/shell.component').then(m => m.ShellComponent),
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./modules/dashboard/dashboard.module').then(m => m.DashboardModule),
        canActivate: [RoleGuard],
        data: { role: 'ADMIN' }
      },
      {
        path: 'policies',
        loadChildren: () => import('./modules/policy/policy.module').then(m => m.PolicyModule),
        canActivate: [RoleGuard],
        data: { role: 'ADMIN' }
      },
      {
        path: 'tasks',
        loadChildren: () => import('./modules/task/task.module').then(m => m.TaskModule),
      },
      {
        path: 'workflow',
        loadChildren: () => import('./modules/workflow/workflow.module').then(m => m.WorkflowModule),
      },
      {
        path: 'org',
        loadChildren: () => import('./modules/organization/organization.module').then(m => m.OrganizationModule),
        canActivate: [RoleGuard],
        data: { role: 'ADMIN' }
      },
      {
        path: 'monitor',
        loadComponent: () => import('./modules/monitor/monitor.component').then(m => m.MonitorComponent),
        canActivate: [RoleGuard],
        data: { role: 'ADMIN' }
      },
      {
        path: 'analysis',
        loadComponent: () => import('./modules/analysis/analysis.component').then(m => m.AnalysisComponent),
        canActivate: [RoleGuard],
        data: { role: 'ADMIN' }
      },
      { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
    ]
  },

  // Fallback
  { path: '**', redirectTo: '/login' }
];


@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }