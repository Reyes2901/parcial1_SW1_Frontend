import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { 
    path: '', 
    loadComponent: () => import('./task-list/task-list.component').then(m => m.TaskListComponent) 
  },
  { 
    path: ':id', 
    loadComponent: () => import('./task-detail/task-detail.component').then(m => m.TaskDetailComponent) 
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TaskRoutingModule {}