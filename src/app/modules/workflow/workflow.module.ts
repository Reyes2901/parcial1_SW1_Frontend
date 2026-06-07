import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WorkflowRoutingModule } from './workflow-routing.module';

// Standalone components are imported in the routing module directly;
// this module just wires routing.
@NgModule({
  declarations: [],
  imports: [CommonModule, WorkflowRoutingModule],
})
export class WorkflowModule {}
