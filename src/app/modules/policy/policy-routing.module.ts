import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PolicyListComponent } from './policy-list/policy-list.component';
import { DiagramEditorComponent } from './diagram-editor/diagram-editor.component';

const routes: Routes = [
  { path: '', component: PolicyListComponent },
  { path: 'new', component: DiagramEditorComponent },
  { path: ':id/edit', component: DiagramEditorComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PolicyRoutingModule { }