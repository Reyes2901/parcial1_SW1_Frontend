import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';

const routes: Routes = [
  { 
    path: 'login', 
    loadChildren: () => import('./modules/auth/auth.module').then(m => m.AuthModule) 
  },
  { 
    path: 'dashboard', 
    loadChildren: () => import('./modules/dashboard/dashboard.module').then(m => m.DashboardModule),
    canActivate: [AuthGuard, RoleGuard], 
    data: { role: 'ADMIN' } 
  },
  { 
    path: 'policies', 
    loadChildren: () => import('./modules/policy/policy.module').then(m => m.PolicyModule),
    canActivate: [AuthGuard, RoleGuard], 
    data: { role: 'ADMIN' } 
  },
  { 
    path: 'tasks', 
    loadChildren: () => import('./modules/task/task.module').then(m => m.TaskModule),
    canActivate: [AuthGuard] 
  },
  { 
    path: 'workflow', 
    loadChildren: () => import('./modules/workflow/workflow.module').then(m => m.WorkflowModule),
    canActivate: [AuthGuard] 
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }