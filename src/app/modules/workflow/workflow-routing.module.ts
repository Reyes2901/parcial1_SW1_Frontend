import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SeguimientoAdminComponent } from './seguimiento-admin/seguimiento-admin.component';
import { ClientRequestComponent } from './client-request/client-request.component';
import { ClientTrackingComponent } from './client-tracking/client-tracking.component';

const routes: Routes = [
  { path: '', component: SeguimientoAdminComponent },
  { path: 'list', component: SeguimientoAdminComponent },
  { path: 'seguimiento', component: SeguimientoAdminComponent },
  {
    path: 'tasks',
    loadChildren: () => import('../task/task.module').then(m => m.TaskModule)
  },
  { path: 'nueva-solicitud', component: ClientRequestComponent },
  { path: 'mis-solicitudes', component: ClientTrackingComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WorkflowRoutingModule {}
