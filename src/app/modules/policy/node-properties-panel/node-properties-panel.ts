import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-node-properties-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule
  ],
  template: `
    <div class="props-panel-content">
      @if (element) {
        <h3>⚙️ Propiedades del nodo</h3>
        <p class="node-type">Tipo: <strong>{{ nodeType }}</strong></p>

        @if (isLane) {
          <div class="lane-section">
            <p class="lane-label">🏢 Departamento vinculado</p>
            <mat-form-field class="full-width">
              <mat-label>Departamento</mat-label>
              <mat-select [ngModel]="currentDeptId"
                          (ngModelChange)="onDepartmentChange($event)">
                <mat-option value="">— Sin departamento —</mat-option>
                @for (d of departments; track d.id) {
                  <mat-option [value]="d.id">{{ d.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
        }

        @if (isActivity) {
          <mat-form-field class="full-width">
            <mat-label>👤 Rol responsable</mat-label>
            <mat-select [(ngModel)]="localData.assigneeRole" (ngModelChange)="emitChange()">
              <mat-option value="ADMIN">Administrador</mat-option>
              <mat-option value="FUNCIONARIO">Funcionario</mat-option>
              <mat-option value="TECNICO">Técnico de campo</mat-option>
              <mat-option value="INSPECTOR">Inspector</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field class="full-width">
            <mat-label>⏱️ Duración estimada (horas)</mat-label>
            <input matInput type="number" min="1" [(ngModel)]="localData.estimatedDurationHours" (ngModelChange)="emitChange()">
          </mat-form-field>

          <div class="form-schema-section">
            <div class="schema-header">
              <span>📝 Campos del formulario</span>
              <button mat-icon-button (click)="addField()" matTooltip="Agregar campo">
                <mat-icon>add</mat-icon>
              </button>
            </div>

            @for (field of getFields(); track field.name; let i = $index) {
              <div class="field-item">
                <mat-form-field>
                  <mat-label>Etiqueta</mat-label>
                  <input matInput [(ngModel)]="field.label" (ngModelChange)="onFieldChange()">
                </mat-form-field>

                <mat-form-field>
                  <mat-label>Tipo</mat-label>
                  <mat-select [(ngModel)]="field.type" (ngModelChange)="onFieldChange()">
                    <mat-option value="TEXT">📝 Texto</mat-option>
                    <mat-option value="NUMBER">🔢 Número</mat-option>
                    <mat-option value="BOOLEAN">✅ Sí / No</mat-option>
                    <mat-option value="DATE">📅 Fecha</mat-option>
                    <mat-option value="SELECT">📋 Selección</mat-option>
                    <mat-option value="IMAGE">📷 Imagen</mat-option>
                    <mat-option value="SIGNATURE">✍️ Firma digital</mat-option>
                    <mat-option value="GEOLOCATION">📍 Geolocalización</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-checkbox [(ngModel)]="field.required" (ngModelChange)="onFieldChange()">
                  Requerido
                </mat-checkbox>

                <button mat-icon-button color="warn" (click)="removeField(i)" matTooltip="Eliminar campo">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            }

            @if (getFields().length === 0) {
              <p class="no-fields">Sin campos. Haz clic en + para agregar.</p>
            }
          </div>
        }

        @if (nodeType === 'DECISION') {
          <div class="decision-hint">
            <mat-icon>info</mat-icon>
            <span>Las condiciones se configuran en cada flecha de salida del rombo.</span>
          </div>
        }

        @if (nodeType === 'START') {
          <p class="hint">El nodo START no requiere configuración adicional.</p>
        }

        @if (nodeType === 'END') {
          <p class="hint">El nodo END marca el fin del proceso.</p>
        }

        @if (nodeType === 'FORK') {
          <div class="decision-hint">
            <mat-icon>call_split</mat-icon>
            <span>Fork: 1 entrada, múltiples salidas. Divide el flujo en ramas paralelas.</span>
          </div>
        }

        @if (nodeType === 'JOIN') {
          <div class="decision-hint">
            <mat-icon>call_merge</mat-icon>
            <span>Join: múltiples entradas, 1 salida. Sincroniza ramas paralelas.</span>
          </div>
        }
      } @else {
        <p class="select-hint">👆 Selecciona un nodo en la pizarra para ver sus propiedades.</p>
      }
    </div>
  `,
  styles: [`
    .props-panel-content {
      padding: 8px;
    }
    h3 {
      margin: 0 0 8px 0;
      color: #333;
    }
    .node-type {
      color: #666;
      margin-bottom: 16px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 12px;
    }
    .form-schema-section {
      margin-top: 16px;
      border-top: 1px solid #eee;
      padding-top: 12px;
    }
    .schema-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      font-weight: 500;
    }
    .field-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      margin-bottom: 8px;
      background: #f9f9f9;
      border-radius: 8px;
    }
    .no-fields {
      color: #999;
      text-align: center;
      padding: 16px;
    }
    .decision-hint, .hint {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #666;
      font-size: 13px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
      margin-top: 12px;
    }
    .select-hint {
      color: #999;
      text-align: center;
      padding: 24px;
    }
    .lane-section {
      padding: 8px 0;
      border-bottom: 1px solid #eee;
      margin-bottom: 12px;
    }
    .lane-label {
      font-size: 13px;
      font-weight: 600;
      color: #333;
      margin: 0 0 8px 0;
    }
  `]
})
export class NodePropertiesPanelComponent implements OnChanges {
  @Input() element: any = null;
  @Input() nodeData: any = {};
  @Input() departments: any[] = [];
  @Output() nodeDataChanged = new EventEmitter<{ elementId: string; data: any }>();
  @Output() lanePropertyChanged = new EventEmitter<string>();

  localData: any = {
    assigneeRole: null,
    estimatedDurationHours: null,
    formSchema: { fields: [] }
  };

  get isLane(): boolean {
    return this.element?.type === 'bpmn:Lane';
  }

  get currentDeptId(): string {
    const bo = this.element?.businessObject;
    if (!bo) return '';
    if (typeof bo.get === 'function') {
      return bo.get('custom:departmentId') || bo.$attrs?.['custom:departmentId'] || '';
    }
    return bo.$attrs?.['custom:departmentId'] || '';
  }

  onDepartmentChange(deptId: string): void {
    this.lanePropertyChanged.emit(deptId);
  }

  get nodeType(): string {
    const type = this.element?.type;
    if (type === 'bpmn:ParallelGateway') {
      const bo = this.element?.businessObject;
      let fjt: string | undefined;
      if (bo && typeof bo.get === 'function') {
        fjt = bo.get('custom:forkJoinType');
      }
      if (!fjt) {
        fjt = bo?.$attrs?.['custom:forkJoinType'];
      }
      return fjt === 'JOIN' ? 'JOIN' : 'FORK';
    }
    const map: Record<string, string> = {
      'bpmn:StartEvent': 'START',
      'bpmn:EndEvent': 'END',
      'bpmn:UserTask': 'ACTIVITY',
      'bpmn:ExclusiveGateway': 'DECISION'
    };
    return map[type] || type || '';
  }

  get isActivity(): boolean {
    return this.nodeType === 'ACTIVITY';
  }

  ngOnChanges(): void {
    if (this.nodeData) {
      this.localData = JSON.parse(JSON.stringify({
        assigneeRole: this.nodeData.assigneeRole || null,
        estimatedDurationHours: this.nodeData.estimatedDurationHours || null,
        formSchema: this.nodeData.formSchema || { title: '', fields: [] }
      }));
    }
  }

  getFields(): any[] {
    return this.localData.formSchema?.fields || [];
  }

  addField(): void {
    if (!this.localData.formSchema) {
      this.localData.formSchema = { fields: [] };
    }
    this.localData.formSchema.fields.push({
      name: 'campo' + Date.now(),
      type: 'TEXT',
      label: 'Nuevo campo',
      required: false
    });
    this.emitChange();
  }

  removeField(index: number): void {
    this.localData.formSchema.fields.splice(index, 1);
    this.emitChange();
  }

  onFieldChange(): void {
    this.localData.formSchema.fields.forEach((f: any) => {
      if (!f.name || f.name.startsWith('campo')) {
        f.name = f.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      }
    });
    this.emitChange();
  }

  emitChange(): void {
    this.nodeDataChanged.emit({
      elementId: this.element?.id,
      data: JSON.parse(JSON.stringify(this.localData))
    });
  }
}