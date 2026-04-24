import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DiagramEditorComponent } from './diagram-editor/diagram-editor.component';

const routes: Routes = [
  { path: 'new', component: DiagramEditorComponent },
  { path: ':id/edit', component: DiagramEditorComponent },
  { path: '', component: DiagramEditorComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PolicyRoutingModule { }