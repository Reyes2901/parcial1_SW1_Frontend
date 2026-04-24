import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicFormComponent } from './components/dynamic-form/dynamic-form.component';

@NgModule({
  imports: [CommonModule, DynamicFormComponent],
  exports: [DynamicFormComponent]
})
export class SharedModule { }