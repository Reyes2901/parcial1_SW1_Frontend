import {
  Component, AfterViewInit, OnDestroy, OnInit, ViewChild, ElementRef,
  ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { Observable, Subject, Subscription } from 'rxjs';
import { debounceTime, throttleTime } from 'rxjs/operators';
import { PolicyService } from '../services/policy.service';
import { OrganizationService } from '../../../core/services/organization.service';
import { NodePropertiesPanelComponent } from '../node-properties-panel/node-properties-panel';
import { AiPromptPanelComponent } from '../ai-prompt-panel/ai-prompt-panel';
import { customModule, customModdleDescriptor } from './bpmn-extensions';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/services/auth.service';
import { BpmnCollaborationService } from '../../../core/services/bpmn-collaboration';
// ────────────────────────────────────────────────────────────────────────────────
// PASO 1 — Payload Colaborativo Discriminado
// Cada mensaje WebSocket lleva un `action` que define su semántica:
//   ELEMENT_DRAG   → coordenadas en tiempo real (~30fps throttled)
//   ELEMENT_LOCK   → bloqueo virtual al iniciar arrastre
//   ELEMENT_UNLOCK → liberación al terminar arrastre
//   ELEMENT_COMMIT → XML final después de soltar el elemento
// ────────────────────────────────────────────────────────────────────────────────
interface CollaborativeMessage {
  action: 'ELEMENT_DRAG' | 'ELEMENT_COMMIT' | 'ELEMENT_LOCK' | 'ELEMENT_UNLOCK';
  policyId: string;
  sender: string;
  elementId: string;
  geometry?: { x: number; y: number; width?: number; height?: number };
  bpmnXml?: string; // SOLO poblado en ELEMENT_COMMIT
}

interface BranchConfig {
  name: string;
  department: string;
}

/** IDs de overlays activos por elemento bloqueado remotamente */
interface RemoteLockInfo {
  overlayId: string;
  sender: string;
}

@Component({
  selector: 'app-diagram-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatStepperModule,
    MatRadioModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    NodePropertiesPanelComponent,
    AiPromptPanelComponent
  ],
  template: `
    <div class="editor-layout">
      <!-- Toolbar -->
      <div class="toolbar">
        <span class="policy-name">{{ policy?.name || 'Nueva política' }}</span>

        <!-- Indicador de usuarios conectados -->
        <div class="collab-indicator" *ngIf="remoteLockedElements.size > 0">
          <mat-icon class="collab-pulse">group</mat-icon>
          <span class="collab-text">{{ remoteLockedElements.size }} elemento(s) bloqueado(s)</span>
        </div>

        <div class="toolbar-actions">
          <button mat-stroked-button (click)="saveDraft()" class="tb-btn">
            <mat-icon>save</mat-icon> Guardar
          </button>
          <button mat-flat-button color="primary" (click)="publish()" class="tb-btn tb-publish">
            <mat-icon>check_circle</mat-icon> Publicar
          </button>
          <div class="tb-divider"></div>
          <button mat-icon-button (click)="toggleAiPanel()"
                  matTooltip="Asistente IA"
                  [class.tb-active]="showAiPanel">
            <mat-icon>auto_awesome</mat-icon>
          </button>
          <button mat-icon-button (click)="toggleFlowAssistant()"
                  matTooltip="Asistente de Flujo Asistido"
                  [class.tb-active]="showFlowAssistant">
            <mat-icon>account_tree</mat-icon>
          </button>
        </div>
      </div>

      <div class="editor-body">
        <div #bpmnCanvas class="bpmn-canvas"></div>

        <!-- AI Panel -->
        @if (showAiPanel) {
          <div class="side-panel">
            <app-ai-prompt-panel
              [policy]="policy"
              (diagramGenerated)="onDiagramGenerated($event)"
              (diagramRefined)="onDiagramRefined($event)">
            </app-ai-prompt-panel>
          </div>
        }

        @if (showFlowAssistant) {
          <div class="glass-panel" [class.panel-enter]="showFlowAssistant">
            <div class="gp-header">
              <mat-icon class="gp-icon primary">account_tree</mat-icon>
              <div>
                <h3>Flujo Asistido</h3>
                <span class="gp-subtitle">Construye flujos paso a paso</span>
              </div>
            </div>

            <!-- Auto-Layout quick button -->
            @if (selectedElement) {
              <button mat-stroked-button class="auto-layout-btn"
                      (click)="autoLayoutChildren()"
                      matTooltip="Alinear hijos del nodo seleccionado">
                <mat-icon>auto_fix_high</mat-icon>
                Auto-Layout
              </button>
            }

            <mat-stepper orientation="vertical" [linear]="true" #stepper
                         class="compact-stepper">

              <!-- Step 1: Source node -->
              <mat-step [completed]="!!selectedElement">
                <ng-template matStepLabel>
                  <span class="step-label-text">Nodo origen</span>
                </ng-template>
                @if (selectedElement) {
                  <div class="origin-card">
                    <div class="origin-icon-wrap"
                         [style.background]="getNodeColor(selectedElement)">
                      <mat-icon>{{ getNodeIcon(selectedElement) }}</mat-icon>
                    </div>
                    <div class="origin-info">
                      <span class="origin-name">{{ getNodeLabel(selectedElement) }}</span>
                      <span class="origin-type">{{ getNodeTypeLabel(selectedElement) }}</span>
                    </div>
                  </div>
                  <button mat-flat-button matStepperNext class="step-next-btn">
                    Continuar <mat-icon>arrow_forward</mat-icon>
                  </button>
                } @else {
                  <div class="empty-state">
                    <mat-icon>touch_app</mat-icon>
                    <p>Seleccione un nodo en el canvas</p>
                  </div>
                }
              </mat-step>

              <!-- Step 2: Flow type -->
              <mat-step [completed]="!!flowType">
                <ng-template matStepLabel>
                  <span class="step-label-text">Tipo de flujo</span>
                </ng-template>
                <div class="flow-grid">
                  @for (opt of flowOptions; track opt.value) {
                    <button class="flow-card"
                            [class.flow-card-active]="flowType === opt.value"
                            (click)="flowType = opt.value">
                      <div class="fc-icon-wrap" [style.background]="opt.color">
                        <mat-icon>{{ opt.icon }}</mat-icon>
                      </div>
                      <div class="fc-text">
                        <strong>{{ opt.label }}</strong>
                        <span>{{ opt.hint }}</span>
                      </div>
                    </button>
                  }
                </div>
                <div class="step-nav">
                  <button mat-button matStepperPrevious class="nav-back">
                    <mat-icon>arrow_back</mat-icon> Atrás
                  </button>
                  <button mat-flat-button matStepperNext class="step-next-btn"
                          [disabled]="!flowType" (click)="onFlowTypeNext()">
                    Continuar <mat-icon>arrow_forward</mat-icon>
                  </button>
                </div>
              </mat-step>

              <!-- Step 3: Configuration -->
              <mat-step>
                <ng-template matStepLabel>
                  <span class="step-label-text">Configurar</span>
                </ng-template>

                <!-- Sequential -->
                @if (flowType === 'sequential') {
                  <div class="config-section">
                    <mat-form-field class="full-w" appearance="outline">
                      <mat-label>Nombre de la tarea</mat-label>
                      <input matInput [(ngModel)]="seqTaskName">
                    </mat-form-field>
                    <mat-form-field class="full-w" appearance="outline">
                      <mat-label>Departamento</mat-label>
                      <mat-select [(ngModel)]="seqTaskDept">
                        @for (dept of departments; track dept) {
                          <mat-option [value]="dept">{{ dept }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </div>
                }

                <!-- Decision (SI / NO) -->
                @if (flowType === 'decision') {
                  <div class="config-section">
                    <p class="config-hint">
                      <mat-icon>info</mat-icon>
                      Decisión con ramas Sí / No configurables.
                    </p>

                    <!-- Rama SÍ -->
                    <div class="branch-card" style="border-left: 3px solid #4caf50;">
                      <div class="bc-header" style="color: #4caf50;">
                        <mat-icon>check_circle</mat-icon>
                        <span>Rama SÍ</span>
                      </div>
                      <mat-form-field class="full-w" appearance="outline">
                        <mat-label>Acción</mat-label>
                        <mat-select [(ngModel)]="decisionYesType">
                          <mat-option value="activity">Actividad</mat-option>
                          <mat-option value="end">Fin de proceso</mat-option>
                        </mat-select>
                      </mat-form-field>
                      @if (decisionYesType === 'activity') {
                        <mat-form-field class="full-w" appearance="outline">
                          <mat-label>Nombre de actividad</mat-label>
                          <input matInput [(ngModel)]="decisionYesName">
                        </mat-form-field>
                        <mat-form-field class="full-w" appearance="outline">
                          <mat-label>Departamento</mat-label>
                          <mat-select [(ngModel)]="decisionYesDept">
                            @for (dept of departments; track dept) {
                              <mat-option [value]="dept">{{ dept }}</mat-option>
                            }
                          </mat-select>
                        </mat-form-field>
                      }
                    </div>

                    <mat-divider></mat-divider>

                    <!-- Rama NO -->
                    <div class="branch-card" style="border-left: 3px solid #f44336;">
                      <div class="bc-header" style="color: #f44336;">
                        <mat-icon>cancel</mat-icon>
                        <span>Rama NO</span>
                      </div>
                      <mat-form-field class="full-w" appearance="outline">
                        <mat-label>Acción</mat-label>
                        <mat-select [(ngModel)]="decisionNoType">
                          <mat-option value="activity">Actividad</mat-option>
                          <mat-option value="end">Fin de proceso</mat-option>
                          <mat-option value="loop">Bucle (volver a Decisión)</mat-option>
                        </mat-select>
                      </mat-form-field>
                      @if (decisionNoType === 'activity') {
                        <mat-form-field class="full-w" appearance="outline">
                          <mat-label>Nombre de actividad</mat-label>
                          <input matInput [(ngModel)]="decisionNoName">
                        </mat-form-field>
                        <mat-form-field class="full-w" appearance="outline">
                          <mat-label>Departamento</mat-label>
                          <mat-select [(ngModel)]="decisionNoDept">
                            @for (dept of departments; track dept) {
                              <mat-option [value]="dept">{{ dept }}</mat-option>
                            }
                          </mat-select>
                        </mat-form-field>
                      }
                    </div>
                  </div>
                }

                <!-- Parallel complete -->
                @if (flowType === 'parallel') {
                  <div class="config-section">
                    <mat-form-field class="full-w" appearance="outline">
                      <mat-label>Ramas paralelas</mat-label>
                      <input matInput type="number" min="2" max="10"
                             [(ngModel)]="branchCount"
                             (ngModelChange)="onBranchCountChange()">
                    </mat-form-field>
                    @for (branch of branches; track $index; let i = $index) {
                      <div class="branch-card">
                        <div class="bc-header">
                          <mat-icon>{{ 'looks_' + (i < 6 ? (i+1) : 'one') }}</mat-icon>
                          <span>Rama {{ i + 1 }}</span>
                        </div>
                        <mat-form-field appearance="outline" class="full-w">
                          <mat-label>Actividad</mat-label>
                          <input matInput [(ngModel)]="branch.name"
                                 [placeholder]="'Tarea ' + (i + 1)">
                        </mat-form-field>
                        <mat-form-field appearance="outline" class="full-w">
                          <mat-label>Departamento</mat-label>
                          <mat-select [(ngModel)]="branch.department">
                            @for (dept of departments; track dept) {
                              <mat-option [value]="dept">{{ dept }}</mat-option>
                            }
                          </mat-select>
                        </mat-form-field>
                      </div>
                    }
                  </div>
                }

                <!-- Retry -->
                @if (flowType === 'retry') {
                  <div class="config-section">
                    <p class="config-hint">
                      <mat-icon>info</mat-icon>
                      Se creará una tarea con un flujo de retorno etiquetado "No cumple".
                    </p>
                    <mat-form-field class="full-w" appearance="outline">
                      <mat-label>Nombre de la tarea de reintento</mat-label>
                      <input matInput [(ngModel)]="retryTaskName">
                    </mat-form-field>
                    <mat-form-field class="full-w" appearance="outline">
                      <mat-label>Departamento</mat-label>
                      <mat-select [(ngModel)]="retryTaskDept">
                        @for (dept of departments; track dept) {
                          <mat-option [value]="dept">{{ dept }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </div>
                }

                <!-- End -->
                @if (flowType === 'end') {
                  <div class="config-section">
                    <p class="config-hint end-msg">
                      <mat-icon>flag</mat-icon>
                      Se creará un Evento de Fin conectado al nodo seleccionado.
                    </p>
                  </div>
                }

                <div class="step-nav">
                  <button mat-button matStepperPrevious class="nav-back">
                    <mat-icon>arrow_back</mat-icon> Atrás
                  </button>
                  <button mat-flat-button class="apply-btn"
                          (click)="executeAutoFlow(stepper)"
                          [disabled]="!canExecute()">
                    <mat-icon>play_arrow</mat-icon>
                    Aplicar al diagrama
                  </button>
                </div>
              </mat-step>
            </mat-stepper>
          </div>
        }

        <!-- Node Properties Panel -->
        @if (selectedElement && !showAiPanel && !showFlowAssistant) {
          <div class="side-panel">
            <app-node-properties-panel
              [element]="selectedElement"
              [nodeData]="getNodeData(selectedElement?.id)"
              [departments]="deptObjects"
              (nodeDataChanged)="onNodeDataChanged($event)"
              (lanePropertyChanged)="updateLaneDepartment($event)">
            </app-node-properties-panel>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    /* ── Layout ── */
    .editor-layout { display: flex; flex-direction: column; height: 100vh; }
    .editor-body { display: flex; flex: 1; overflow: hidden; position: relative; }
    .bpmn-canvas { flex: 1; height: calc(100vh - 56px); }

    /* ── Toolbar ── */
    .toolbar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 16px; background: #1a1f2e;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .policy-name {
      font-size: 15px; font-weight: 600; color: #e0e4ec;
      letter-spacing: 0.02em;
    }
    .toolbar-actions { display: flex; gap: 6px; align-items: center; }
    .tb-btn {
      font-size: 12px !important; font-weight: 500 !important;
      letter-spacing: 0.03em;
    }
    .tb-btn mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
    .tb-publish { background: #2e7d32 !important; color: #fff !important; }
    .tb-divider { width: 1px; height: 24px; background: rgba(255,255,255,0.12); margin: 0 4px; }
    .toolbar button[mat-icon-button] { color: rgba(255,255,255,0.55); transition: all 0.2s; }
    .toolbar button[mat-icon-button]:hover { color: #fff; background: rgba(255,255,255,0.08); }
    .tb-active { color: #66bb6a !important; background: rgba(102,187,106,0.1) !important; }

    /* ── Collaboration Indicator ── */
    .collab-indicator {
      display: flex; align-items: center; gap: 6px;
      padding: 4px 12px; border-radius: 20px;
      background: rgba(255, 152, 0, 0.12);
      border: 1px solid rgba(255, 152, 0, 0.3);
    }
    .collab-pulse {
      font-size: 16px; width: 16px; height: 16px;
      color: #ffa726;
      animation: collabPulse 2s ease-in-out infinite;
    }
    .collab-text {
      font-size: 11px; color: #ffa726; font-weight: 600;
      letter-spacing: 0.03em;
    }
    @keyframes collabPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* ── Glass Panel ── */
    .glass-panel {
      width: 380px; min-width: 380px;
      background: linear-gradient(165deg, rgba(26,31,46,0.97), rgba(22,27,40,0.99));
      border-left: 1px solid rgba(255,255,255,0.06);
      padding: 20px 18px;
      overflow-y: auto; display: flex; flex-direction: column; gap: 14px;
      animation: panelSlide 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
    }
    @keyframes panelSlide {
      from { transform: translateX(20px); opacity: 0; }
      to   { transform: translateX(0); opacity: 1; }
    }

    .gp-header { display: flex; align-items: center; gap: 12px; }
    .gp-header h3 {
      margin: 0; font-size: 16px; font-weight: 700; color: #e0e4ec;
      letter-spacing: 0.01em;
    }
    .gp-subtitle { font-size: 11px; color: rgba(255,255,255,0.4); letter-spacing: 0.04em; }
    .gp-icon {
      width: 36px; height: 36px; font-size: 20px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 10px;
    }
    .gp-icon.accent { background: rgba(255,167,38,0.15); color: #ffa726; }
    .gp-icon.primary { background: rgba(102,187,106,0.15); color: #66bb6a; }

    .gp-textarea {
      width: 100%; padding: 12px; font-size: 13px; font-family: inherit;
      background: rgba(255,255,255,0.04); color: #cdd2dc;
      border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
      resize: vertical; transition: border-color 0.2s;
    }
    .gp-textarea:focus { border-color: rgba(255,167,38,0.5); outline: none; }
    .gp-textarea::placeholder { color: rgba(255,255,255,0.25); }

    .gp-action-btn {
      width: 100%; font-weight: 600 !important; letter-spacing: 0.03em;
      border-radius: 10px !important; padding: 10px !important;
    }
    .accent-bg { background: #f57c00 !important; color: #fff !important; }
    .accent-bg:hover { background: #ef6c00 !important; }
    .accent-bg:disabled { background: rgba(255,255,255,0.08) !important; color: rgba(255,255,255,0.25) !important; }

    /* ── Auto-Layout Button ── */
    .auto-layout-btn {
      width: 100%; border-radius: 8px !important;
      border-color: rgba(102,187,106,0.3) !important;
      color: #66bb6a !important; font-size: 12px !important;
      transition: all 0.2s;
    }
    .auto-layout-btn:hover {
      background: rgba(102,187,106,0.1) !important;
      border-color: rgba(102,187,106,0.5) !important;
    }
    .auto-layout-btn mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 6px; }

    /* ── Compact Stepper ── */
    .compact-stepper { background: transparent !important; }
    ::ng-deep .compact-stepper .mat-step-header {
      padding: 6px 12px !important; border-radius: 8px;
      transition: background 0.2s;
    }
    ::ng-deep .compact-stepper .mat-step-header:hover {
      background: rgba(255,255,255,0.04) !important;
    }
    ::ng-deep .compact-stepper .mat-step-icon {
      background: rgba(102,187,106,0.2) !important; color: #66bb6a !important;
    }
    ::ng-deep .compact-stepper .mat-step-icon-selected {
      background: #2e7d32 !important; color: #fff !important;
    }
    ::ng-deep .compact-stepper .mat-step-label {
      color: rgba(255,255,255,0.5) !important; font-size: 13px !important;
    }
    ::ng-deep .compact-stepper .mat-step-label-selected {
      color: #e0e4ec !important; font-weight: 600 !important;
    }
    ::ng-deep .compact-stepper .mat-stepper-vertical-line::before {
      border-left-color: rgba(255,255,255,0.08) !important;
    }
    ::ng-deep .compact-stepper .mat-vertical-content-container {
      margin-left: 18px !important;
    }
    .step-label-text { font-size: 13px; }

    /* ── Origin Card ── */
    .origin-card {
      display: flex; align-items: center; gap: 12px;
      padding: 12px; border-radius: 10px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
      margin: 8px 0;
    }
    .origin-icon-wrap {
      width: 38px; height: 38px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .origin-icon-wrap mat-icon { color: #fff; font-size: 20px; width: 20px; height: 20px; }
    .origin-name { font-weight: 600; font-size: 14px; color: #e0e4ec; display: block; }
    .origin-type { font-size: 11px; color: rgba(255,255,255,0.4); display: block; margin-top: 2px; }

    .empty-state {
      text-align: center; padding: 28px 12px; color: rgba(255,255,255,0.3);
    }
    .empty-state mat-icon {
      font-size: 36px; width: 36px; height: 36px; margin-bottom: 8px;
      opacity: 0.5;
    }
    .empty-state p { margin: 0; font-size: 13px; }

    /* ── Flow Grid ── */
    .flow-grid {
      display: flex; flex-direction: column; gap: 6px; margin: 8px 0;
    }
    .flow-card {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px; border-radius: 10px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      cursor: pointer; transition: all 0.2s;
      text-align: left; width: 100%;
    }
    .flow-card:hover {
      background: rgba(255,255,255,0.06);
      border-color: rgba(255,255,255,0.12);
    }
    .flow-card-active {
      background: rgba(102,187,106,0.08) !important;
      border-color: rgba(102,187,106,0.4) !important;
      box-shadow: 0 0 0 1px rgba(102,187,106,0.15);
    }
    .fc-icon-wrap {
      width: 34px; height: 34px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .fc-icon-wrap mat-icon { color: #fff; font-size: 18px; width: 18px; height: 18px; }
    .fc-text strong { display: block; font-size: 13px; color: #e0e4ec; font-weight: 600; }
    .fc-text span { display: block; font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 1px; }

    /* ── Step Navigation ── */
    .step-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
    .step-next-btn {
      background: #2e7d32 !important; color: #fff !important;
      border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important;
    }
    .step-next-btn:disabled { background: rgba(255,255,255,0.06) !important; color: rgba(255,255,255,0.2) !important; }
    .step-next-btn mat-icon { font-size: 16px; width: 16px; height: 16px; margin-left: 4px; }
    .nav-back { color: rgba(255,255,255,0.45) !important; font-size: 12px !important; }
    .nav-back mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 2px; }

    /* ── Config Section ── */
    .config-section { display: flex; flex-direction: column; gap: 10px; margin: 8px 0; }
    .config-hint {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; color: rgba(255,255,255,0.45);
      background: rgba(255,255,255,0.03); border-radius: 8px;
      padding: 10px 12px; margin: 0;
    }
    .config-hint mat-icon { font-size: 16px; width: 16px; height: 16px; color: #42a5f5; flex-shrink: 0; }
    .end-msg mat-icon { color: #ef5350 !important; }
    .full-w { width: 100%; }

    /* form field overrides for dark theme */
    ::ng-deep .glass-panel .mat-mdc-form-field {
      --mdc-outlined-text-field-outline-color: rgba(255,255,255,0.1);
      --mdc-outlined-text-field-hover-outline-color: rgba(255,255,255,0.2);
      --mdc-outlined-text-field-focus-outline-color: #66bb6a;
      --mdc-outlined-text-field-label-text-color: rgba(255,255,255,0.45);
      --mdc-outlined-text-field-hover-label-text-color: rgba(255,255,255,0.6);
      --mdc-outlined-text-field-focus-label-text-color: #66bb6a;
      --mdc-outlined-text-field-input-text-color: #e0e4ec;
      --mdc-outlined-text-field-caret-color: #66bb6a;
    }
    ::ng-deep .glass-panel .mat-mdc-select-value { color: #e0e4ec !important; }
    ::ng-deep .glass-panel .mat-mdc-select-arrow { color: rgba(255,255,255,0.3) !important; }
    ::ng-deep .glass-panel .mat-divider { border-top-color: rgba(255,255,255,0.06) !important; }

    /* ── Branch Cards ── */
    .branch-card {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px; padding: 12px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .bc-header {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; color: #66bb6a;
      text-transform: uppercase; letter-spacing: 0.06em;
    }
    .bc-header mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* ── Apply Button ── */
    .apply-btn {
      background: linear-gradient(135deg, #2e7d32, #388e3c) !important;
      color: #fff !important; border-radius: 10px !important;
      font-weight: 700 !important; letter-spacing: 0.03em;
      padding: 10px 20px !important; box-shadow: 0 2px 12px rgba(46,125,50,0.3);
      transition: all 0.2s;
    }
    .apply-btn:hover { box-shadow: 0 4px 20px rgba(46,125,50,0.45); }
    .apply-btn:disabled {
      background: rgba(255,255,255,0.06) !important;
      color: rgba(255,255,255,0.2) !important;
      box-shadow: none !important;
    }
    .apply-btn mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 6px; }

    /* ── Side Panel (light background for child components) ── */
    .side-panel {
      width: 380px; min-width: 380px;
      background: #fff;
      border-left: 1px solid #e0e0e0;
      padding: 16px;
      overflow-y: auto;
      animation: panelSlide 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
    }
  `]
})
export class DiagramEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('bpmnCanvas') canvasRef!: ElementRef;

  policy: any = null;
  showAiPanel = false;
  aiPrompt = '';
  generatingAI = false;
  deptObjects: any[] = [];
  selectedLaneDeptId = '';

  // Flow Assistant state
  showFlowAssistant = false;
  selectedElement: any = null;
  flowType: 'sequential' | 'parallel' | 'decision' | 'retry' | 'end' | '' = '';
  seqTaskName = '';
  seqTaskDept = '';
  branchCount = 2;
  branches: BranchConfig[] = [{ name: '', department: '' }, { name: '', department: '' }];
  departments: string[] = [];
  // Decision (SI/NO) sub-options: 'activity' | 'end' | 'loop'
  decisionYesType: 'activity' | 'end' | '' = '';
  decisionYesName = '';
  decisionYesDept = '';
  decisionNoType: 'activity' | 'end' | 'loop' | '' = '';
  decisionNoName = '';
  decisionNoDept = '';
  retryTaskName = '';
  retryTaskDept = '';

  readonly flowOptions = [
    { value: 'sequential' as const, icon: 'arrow_forward', label: 'Secuencial', hint: 'Agregar una tarea', color: '#2196f3' },
    { value: 'decision' as const, icon: 'alt_route', label: 'Ruta de Decisión', hint: 'Sí / No con opciones', color: '#ff9800' },
    { value: 'parallel' as const, icon: 'call_split', label: 'Paralelo Completo', hint: 'Fork + N tareas + Join', color: '#4caf50' },
    { value: 'retry' as const, icon: 'replay', label: 'Ciclo de Reintento', hint: 'Tarea con retorno', color: '#9c27b0' },
    { value: 'end' as const, icon: 'stop_circle', label: 'Fin de Proceso', hint: 'Evento de fin', color: '#f44336' }
  ];

  private modeler: any;
  private selectionListener: any;
  private readonly GAP_X = 120;
  private readonly GAP_Y = 100;

  // ────────────────────────────────────────────────────────────────────────────
  // COLLABORATIVE STATE
  // ────────────────────────────────────────────────────────────────────────────
  private wsSubscription: any;
  private currentUser = '';
  private policyId!: string;

  /**
   * PASO 2: Bandera que indica si el usuario LOCAL está arrastrando un elemento.
   * Mientras esté true, se ignoran los eventos de `commandStack.changed` para
   * evitar el efecto ping-pong y jittering durante el arrastre.
   */
  private isLocalDragging = false;

  /**
   * PASO 3: Mapa de elementos bloqueados por usuarios remotos.
   * Key = elementId, Value = RemoteLockInfo con el overlayId y el nombre del usuario.
   */
  remoteLockedElements = new Map<string, RemoteLockInfo>();

  /**
   * PASO 2: Subject para emitir coordenadas de arrastre en tiempo real.
   * Se le aplica throttleTime(30) para enviar como máximo cada 30ms (~30-60fps).
   */
  private dragSubject = new Subject<CollaborativeMessage>();

  /**
   * PASO 5: Subject para el pipeline de autoguardado en MongoDB.
   * Se le aplica debounceTime(3000) para esperar 3 segundos de inactividad.
   */
  private autosaveSubject = new Subject<string>();

  /**
   * PASO 4: Bandera que indica si estamos aplicando un ELEMENT_COMMIT remoto
   * vía importXML. Mientras sea true, ignoramos los commandStack.changed locales.
   */
  private isImportingCommit = false;

  /**
   * Bandera adicional: se activa durante applyRemoteDrag para blindar
   * el commandStack.changed contra cualquier efecto colateral de la
   * manipulación gráfica directa.
   */
  private isApplyingRemoteDrag = false;

  /** Interacción transitoria activa (create, connect, drag-init genérico). */
  private isTransientInteraction = false;

  /** Append preview del Context Pad activo (hover sobre opciones de añadir). */
  private isAppendPreviewActive = false;

  /** Timer de debounce para commits estructurales del commandStack. */
  private commandStackCommitTimer: ReturnType<typeof setTimeout> | null = null;

  /** Timer de coalescencia (~0ms) para commits estructurales INMEDIATOS (create/remove). */
  private immediateCommitTimer: ReturnType<typeof setTimeout> | null = null;

  /** Timer para apagar el flag de append preview tras hover (mouseout no dispara contextPad.close). */
  private appendPreviewClearTimer: ReturnType<typeof setTimeout> | null = null;

  /** Marca de tiempo del último log de arrastre remoto huérfano (throttle anti-spam). */
  private lastOrphanDragLog = 0;

  /** Posición OBJETIVO por elemento para interpolar (LERP) el arrastre remoto. */
  private remoteDragTargets = new Map<string, { x: number; y: number }>();

  /** Handle del bucle requestAnimationFrame que suaviza el arrastre remoto a 60fps. */
  private remoteDragRafId: number | null = null;

  /** Factor de suavizado LERP por frame (0–1). Más bajo = más suave/lento. */
  private static readonly REMOTE_DRAG_LERP = 0.35;

  /** Umbral en px bajo el cual se hace el ajuste final exacto y se sale del bucle. */
  private static readonly REMOTE_DRAG_SNAP_PX = 0.75;

  private static readonly COMMIT_DEBOUNCE_MS = 175;

  private static readonly APPEND_PREVIEW_CLEAR_MS = 300;

  private static readonly ORPHAN_DRAG_LOG_THROTTLE_MS = 1500;

  /** Eventos del commandStack que materializan estructura y exigen commit INMEDIATO. */
  private static readonly STRUCTURAL_SYNC_EVENTS = [
    'commandStack.shape.create.executed',
    'commandStack.connection.create.executed',
    'commandStack.shape.delete.executed',
    'commandStack.connection.delete.executed'
  ];

  private static readonly STRUCTURAL_COMMAND_PREFIXES = [
    'shape.create',
    'shape.delete',
    'shape.move',
    'shape.resize',
    'shape.replace',
    'connection.create',
    'connection.delete',
    'connection.layout',
    'connection.reconnect',
    'element.updateProperties',
    'lane.',
    'spaceTool.'
  ];

  private static readonly IGNORED_COMMAND_PREFIXES = ['canvas.', 'preview.'];

  /** True mientras el canal WebSocket colaborativo esté conectado. */
  private isCollaborationActive = false;

  /** Suscripciones RxJS para limpieza en OnDestroy */
  private subscriptions: Subscription[] = [];

  constructor(
    private policyService: PolicyService,
    private orgService: OrganizationService,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private webSocketService: WebSocketService,
    private ngZone: NgZone,
    private collaborationService: BpmnCollaborationService
  ) { }
  // ══════════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.policyId = this.route.snapshot.paramMap.get('id')!;

    // ✅ CORRECCIÓN: Evitamos fugas de memoria usando take(1) si es un login estático,
    // o guardando la suscripción si el usuario puede cambiar en caliente.
    const authSub = this.authService.getCurrentUser().subscribe((user: any) => {
      if (user) {
        this.currentUser = user.sub || user.username || user.email || 'unknown';
      }
    });
    this.subscriptions.push(authSub);

    this.initDragPipeline();
    this.initAutosavePipeline();

    this.webSocketService.connect();
    const connSub = this.webSocketService.isConnected().subscribe((connected: boolean) => {
      this.isCollaborationActive = connected;
      if (connected && this.policyId) {
        console.log(`🔌 WebSocket activo. Conectando al canal colaborativo de la política ${this.policyId}...`);
        this.setupLiveCollaboration();
      } else if (!connected && this.wsSubscription) {
        // Liberar la suscripción al desconectar para re-suscribir limpio al reconectar.
        this.wsSubscription.unsubscribe();
        this.wsSubscription = null;
      }
    });
    this.subscriptions.push(connSub);
  }

  async ngAfterViewInit(): Promise<void> {
    this.loadDepartments();

    try {
      const BpmnModeler = (await import('bpmn-js/lib/Modeler')).default;

      this.modeler = new BpmnModeler({
        container: this.canvasRef.nativeElement,
        additionalModules: [customModule],
        moddleExtensions: {
          custom: customModdleDescriptor
        }
      });

      // ✅ CORRECCIÓN: Eliminamos los listeners redundantes de 'drag.start/end' a nivel global del modeler.
      // Duplicaban la lógica y chocaban con los eventos específicos de 'shape.move'.

      this.setupSelectionListener();
      this.setupTransientInteractionGuards();
      this.setupDragListeners();
      this.setupCommandStackGuard();
      this.setupStructuralSyncListeners();

      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.policyService.getById(id).subscribe({
          next: async (policy) => {
            this.policy = policy;
            await this.renderInitialDiagram(policy);
          },
          error: async (err) => {
            console.error('Error cargando la política inicial:', err);
            if (this.modeler) await this.modeler.createDiagram();
          }
        });
      } else {
        await this.modeler.createDiagram();
      }
    } catch (err) {
      console.error('Error loading bpmn-js:', err);
    }
  }

  /**
   * Renderizado INICIAL del diagrama a partir del estado YA persistido en MongoDB
   * (incluye lo que generó la IA). Esto NO depende del WebSocket: el canal colaborativo
   * solo transporta deltas futuros (ELEMENT_DRAG/LOCK/COMMIT), nunca el estado actual.
   * Por eso el lienzo se hidrata aquí, vía HTTP, sin esperar a un ELEMENT_COMMIT externo.
   */
  private async renderInitialDiagram(policy: any): Promise<void> {
    if (!this.modeler) return;

    // Verificación de datos: ¿llegan los nodos vacíos o con el formato correcto?
    console.log('Datos recibidos en el editor para renderizar:', policy);

    const bpmnXml = this.extractBpmnXml(policy);

    if (bpmnXml) {
      try {
        await this.modeler.importXML(bpmnXml);
        this.modeler.get('canvas').zoom('fit-viewport');
        this.cdr.detectChanges();
        return;
      } catch (xmlErr) {
        console.error('Error importando el BPMN persistido. Se abrirá un diagrama vacío.', xmlErr);
      }
    } else {
      console.warn(
        '⚠️ La política no trae un BPMN renderizable (bpmnXml/xml/diagramXml vacíos o inválidos). ' +
        'Si la IA guardó la estructura en otro campo/formato, el backend debe exponer el XML del layout en getById. ' +
        'Abriendo un diagrama vacío.'
      );
    }

    await this.modeler.createDiagram();
    this.cdr.detectChanges();
  }

  /**
   * Extrae el XML BPMN de la política tolerando distintos nombres de campo que el
   * backend pueda usar (bpmnXml, xml, diagramXml, etc.). Devuelve null si ninguno
   * contiene un XML válido.
   */
  private extractBpmnXml(policy: any): string | null {
    if (!policy) return null;

    const candidates: unknown[] = [
      policy.bpmnXml,
      policy.bpmnXML,
      policy.xml,
      policy.diagramXml,
      policy.bpmn,
      policy.bpmn20Xml,
      policy.diagram?.bpmnXml,
      policy.diagram?.xml,
      policy.layout?.bpmnXml
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && this.isValidBpmnXml(candidate)) {
        return candidate;
      }
    }
    return null;
  }
  ngOnDestroy(): void {
    // Limpiar suscripciones RxJS
    this.subscriptions.forEach(s => s.unsubscribe());

    // Limpiar overlays remotos
    this.remoteLockedElements.forEach((info, elementId) => {
      this.removeRemoteLockOverlay(elementId);
    });

    // Desconectar WS y destruir modeler
    if (this.commandStackCommitTimer) {
      clearTimeout(this.commandStackCommitTimer);
      this.commandStackCommitTimer = null;
    }
    if (this.immediateCommitTimer) {
      clearTimeout(this.immediateCommitTimer);
      this.immediateCommitTimer = null;
    }
    this.cancelRemoteDragAnimation();
    if (this.appendPreviewClearTimer) {
      clearTimeout(this.appendPreviewClearTimer);
      this.appendPreviewClearTimer = null;
    }
    if (this.wsSubscription) this.wsSubscription.unsubscribe();
    if (this.modeler) this.modeler.destroy();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // GUARDIAS DE INTERACCIÓN TRANSITORIA Y COMMIT
  // ══════════════════════════════════════════════════════════════════════════════

  private setupTransientInteractionGuards(): void {
    if (!this.modeler) return;
    const eventBus = this.modeler.get('eventBus');

    eventBus.on('drag.init', () => { this.isTransientInteraction = true; });
    eventBus.on('drag.cleanup', () => { this.isTransientInteraction = false; });

    eventBus.on('create.init', () => { this.isTransientInteraction = true; });
    eventBus.on('create.end', () => { this.isTransientInteraction = false; });
    eventBus.on('create.cancel', () => { this.isTransientInteraction = false; });

    eventBus.on('connect.start', () => { this.isTransientInteraction = true; });
    eventBus.on('connect.end', () => { this.isTransientInteraction = false; });
    eventBus.on('connect.cancel', () => { this.isTransientInteraction = false; });

    eventBus.on('autoPlace', () => {
      this.isAppendPreviewActive = true;
      this.scheduleAppendPreviewClear();
    });

    eventBus.on('contextPad.close', () => {
      if (this.appendPreviewClearTimer) {
        clearTimeout(this.appendPreviewClearTimer);
        this.appendPreviewClearTimer = null;
      }
      this.isAppendPreviewActive = false;
      try {
        this.modeler.get('appendPreview')?.cleanUp?.();
      } catch (_e) { /* appendPreview puede no estar disponible */ }
    });

    eventBus.on('directEditing.activate', () => { this.isTransientInteraction = true; });
    eventBus.on('directEditing.complete', () => { this.isTransientInteraction = false; });
    eventBus.on('directEditing.cancel', () => { this.isTransientInteraction = false; });
  }

  private isDraggingServiceActive(): boolean {
    try {
      const dragging = this.modeler?.get('dragging');
      return !!dragging?.isActive?.();
    } catch (_e) {
      return false;
    }
  }

  private isDirectEditingActive(): boolean {
    try {
      const directEditing = this.modeler?.get('directEditing');
      return !!directEditing?.isActive?.();
    } catch (_e) {
      return false;
    }
  }

  private shouldIgnoreTransientState(): boolean {
    if (this.isImportingCommit) return true;
    if (this.isLocalDragging) return true;
    if (this.isApplyingRemoteDrag) return true;
    if (this.isTransientInteraction) return true;
    if (this.isAppendPreviewActive) return true;
    if (this.isDirectEditingActive()) return true;
    if (this.isDraggingServiceActive()) return true;
    return false;
  }

  private shouldIgnoreCommandStackChange(event: any): boolean {
    if (this.shouldIgnoreTransientState()) return true;
    if (event?.type && event.type !== 'execute') return true;

    const command = event?.command;
    if (!command || !this.isStructuralCommand(command)) return true;

    return false;
  }

  private scheduleAppendPreviewClear(): void {
    if (this.appendPreviewClearTimer) {
      clearTimeout(this.appendPreviewClearTimer);
    }
    this.appendPreviewClearTimer = setTimeout(() => {
      this.appendPreviewClearTimer = null;
      this.isAppendPreviewActive = false;
    }, DiagramEditorComponent.APPEND_PREVIEW_CLEAR_MS);
  }

  private isStructuralCommand(command: any): boolean {
    const commandId = command?.id || '';
    if (!commandId) return false;
    if (DiagramEditorComponent.IGNORED_COMMAND_PREFIXES.some((p) => commandId.startsWith(p))) {
      return false;
    }
    return DiagramEditorComponent.STRUCTURAL_COMMAND_PREFIXES.some((p) => commandId.startsWith(p));
  }

  private extractElementIdFromCommand(command: any): string {
    const ctx = command?.context;
    if (!ctx) return '__non_drag_change__';

    const candidates: (string | undefined)[] = [
      ctx.shape?.id,
      ctx.connection?.id,
      ctx.newShape?.id,
      ctx.newConnection?.id,
      ctx.source?.id,
      ctx.target?.id,
      ...(Array.isArray(ctx.shapes) ? ctx.shapes.map((s: any) => s?.id) : []),
      ...(Array.isArray(ctx.connections) ? ctx.connections.map((c: any) => c?.id) : [])
    ];

    const found = candidates.find((id) => this.isValidElementId(id));
    return found || '__non_drag_change__';
  }

  private isValidElementId(elementId: string | undefined | null): boolean {
    if (!elementId || typeof elementId !== 'string') return false;
    const trimmed = elementId.trim();
    if (!trimmed || trimmed === 'undefined') return false;
    return true;
  }

  private isValidBpmnXml(xml: string | undefined | null): boolean {
    if (!xml || typeof xml !== 'string') return false;
    const trimmed = xml.trim();
    if (!trimmed) return false;
    return trimmed.includes('<bpmn:definitions') || trimmed.includes('<definitions');
  }

  private isValidCollaborativeMessage(msg: CollaborativeMessage): boolean {
    if (!msg?.action || !msg.policyId || !msg.sender) return false;

    switch (msg.action) {
      case 'ELEMENT_COMMIT':
        if (!this.isValidElementId(msg.elementId)) return false;
        return this.isValidBpmnXml(msg.bpmnXml);

      case 'ELEMENT_LOCK':
      case 'ELEMENT_UNLOCK':
      case 'ELEMENT_DRAG':
        if (!this.isValidElementId(msg.elementId)) return false;
        if (msg.action === 'ELEMENT_DRAG' && !msg.geometry) return false;
        return true;

      default:
        return false;
    }
  }

  private isValidRemoteCommit(msg: CollaborativeMessage): boolean {
    // Para reconstruir el lienzo remoto solo necesitamos un XML válido.
    // El elementId es opcional aquí: el backend puede reenviar el commit sin él.
    return msg.action === 'ELEMENT_COMMIT' && this.isValidBpmnXml(msg.bpmnXml);
  }

  private emitLocalCommit(elementId: string, xml: string): void {
    if (!this.isValidElementId(elementId) || !this.isValidBpmnXml(xml)) {
      console.warn('⛔ ELEMENT_COMMIT local bloqueado: payload inválido.', { elementId });
      return;
    }

    this.sendCollaborativeMessage({
      action: 'ELEMENT_COMMIT',
      policyId: this.policyId,
      sender: this.currentUser,
      elementId,
      bpmnXml: xml
    });
    this.autosaveSubject.next(xml);
  }

  private scheduleStructuralCommit(command: any): void {
    const elementId = this.extractElementIdFromCommand(command);

    if (this.commandStackCommitTimer) {
      clearTimeout(this.commandStackCommitTimer);
    }

    this.commandStackCommitTimer = setTimeout(() => {
      this.commandStackCommitTimer = null;

      if (this.shouldIgnoreTransientState()) return;
      if (!this.modeler) return;

      this.modeler.saveXML({ format: true }).then((result: any) => {
        if (!result?.xml) return;
        if (this.shouldIgnoreTransientState()) return;
        this.emitLocalCommit(elementId, result.xml);
      }).catch((err: any) => {
        console.error('Error exportando XML para commit estructural:', err);
      });
    }, DiagramEditorComponent.COMMIT_DEBOUNCE_MS);
  }

  private dismissLocalInteractions(): void {
    if (!this.modeler) return;

    try {
      this.modeler.get('contextPad')?.close?.();
    } catch (_e) { /* context pad puede no estar abierto */ }

    try {
      this.modeler.get('appendPreview')?.cleanUp?.();
    } catch (_e) { /* append preview opcional */ }

    try {
      const directEditing = this.modeler.get('directEditing');
      if (directEditing?.isActive?.()) {
        directEditing.cancel();
      }
    } catch (_e) { /* direct editing opcional */ }

    try {
      this.modeler.get('popupMenu')?.close?.();
    } catch (_e) { /* popup menu opcional */ }

    this.isAppendPreviewActive = false;
    this.isTransientInteraction = false;
  }

  /** @deprecated Ya no se usan transforms SVG manuales; conservado solo por compatibilidad. */
  private resetRemoteDragTransforms(): void {
    if (!this.modeler) return;

    try {
      const elementRegistry = this.modeler.get('elementRegistry');
      for (const element of elementRegistry.getAll()) {
        const gfx = elementRegistry.getGraphics(element);
        if (gfx?.hasAttribute?.('transform')) {
          gfx.removeAttribute('transform');
        }
      }
    } catch (err) {
      console.error('Error limpiando transforms de arrastre remoto:', err);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PASO 2 — CAPTURA DE MOVIMIENTOS EN TIEMPO REAL
  // ══════════════════════════════════════════════════════════════════════════════

  private setupDragListeners(): void {
    if (!this.modeler) return;
    const eventBus = this.modeler.get('eventBus');

    // ── INICIO DEL ARRASTRE ──
    eventBus.on('shape.move.start', (event: any) => {
      const shape = event.shape || event.context?.shape;
      if (!shape) return;

      // ✅ CORRECCIÓN: Cancelación REAL del arrastre si el elemento está bloqueado por otro usuario
      if (this.remoteLockedElements.has(shape.id)) {
        console.warn(`⛔ Elemento ${shape.id} bloqueado por ${this.remoteLockedElements.get(shape.id)?.sender}`);
        try {
          const draggingService = this.modeler.get('dragging');
          draggingService.cancel(); // Cancela la acción inmediatamente en la UI del usuario local
        } catch (e) { /* fallback si el servicio no responde */ }
        return;
      }

      this.isLocalDragging = true;

      this.sendCollaborativeMessage({
        action: 'ELEMENT_LOCK',
        policyId: this.policyId,
        sender: this.currentUser,
        elementId: shape.id
      });
    });

    // ── MOVIMIENTO EN CURSO ──
    eventBus.on('shape.move.move', (event: any) => {
      if (!this.isLocalDragging) return;
      const shape = event.shape || event.context?.shape;
      if (!shape) return;

      this.dragSubject.next({
        action: 'ELEMENT_DRAG',
        policyId: this.policyId,
        sender: this.currentUser,
        elementId: shape.id,
        geometry: {
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height
        }
      });
    });

    // ── FIN DEL ARRASTRE ──
    eventBus.on('shape.move.end', (event: any) => {
      if (!this.isLocalDragging) return;
      const shape = event.shape || event.context?.shape;
      if (!shape) return;

      this.sendCollaborativeMessage({
        action: 'ELEMENT_UNLOCK',
        policyId: this.policyId,
        sender: this.currentUser,
        elementId: shape.id
      });

      this.modeler.saveXML({ format: true }).then((result: any) => {
        if (result?.xml) {
          this.emitLocalCommit(shape.id, result.xml);
        }

        // Bajamos la bandera al final de la resolución asíncrona para que
        // commandStack.changed del drag rebote contra la guardia.
        this.isLocalDragging = false;
      });
    });
  }
  /**
     * Pipeline RxJS: recibe coordenadas del arrastre local y las envía por
     * WebSocket como máximo cada 30ms (throttleTime) para lograr ~30-60fps
     * sin saturar la red.
     */
  private initDragPipeline(): void {
    const sub = this.dragSubject.pipe(
      throttleTime(30) // 30ms ≈ 33fps máximo
    ).subscribe({
      next: (msg) => {
        this.sendCollaborativeMessage(msg);
      }
    });
    this.subscriptions.push(sub);
  }
  private setupCommandStackGuard(): void {
    if (!this.modeler) return;
    const eventBus = this.modeler.get('eventBus');

    eventBus.on('commandStack.changed', (event: any) => {
      if (this.shouldIgnoreCommandStackChange(event)) return;
      this.scheduleStructuralCommit(event.command);
    });
  }

  /**
   * REGLA 1 — Sincronización inmediata de estructura.
   * Escucha la materialización de creaciones/eliminaciones (eventos `*.executed`
   * del commandStack) y dispara un ELEMENT_COMMIT INMEDIATO, sin esperar al
   * debounce. Así el nuevo nodo sale del "limbo" antes de que el usuario lo
   * arrastre, evitando que un ELEMENT_DRAG remoto huérfano lo descarte.
   *
   * REGLA 2 — Aislamiento del viewbox: NO se escucha `canvas.viewbox.changed`
   * ni `canvas.viewbox.changing`. El paneo/zoom es estado local de cámara y
   * jamás debe emitir XML; los comandos `canvas.*` ya están vetados en
   * `IGNORED_COMMAND_PREFIXES`. No agregar listeners de viewbox aquí.
   */
  private setupStructuralSyncListeners(): void {
    if (!this.modeler) return;
    const eventBus = this.modeler.get('eventBus');

    DiagramEditorComponent.STRUCTURAL_SYNC_EVENTS.forEach((evt) => {
      eventBus.on(evt, () => this.emitImmediateStructuralCommit());
    });
  }

  /**
   * Exporta el XML y emite un ELEMENT_COMMIT de inmediato (coalescido al siguiente
   * tick para colapsar ráfagas, p. ej. el Flow Assistant creando fork + tareas + join).
   * Cancela cualquier commit con debounce pendiente para no duplicar el envío.
   */
  private emitImmediateStructuralCommit(): void {
    // Nunca reemitir mientras importamos un commit remoto o aplicamos un drag remoto.
    if (this.isImportingCommit || this.isApplyingRemoteDrag) return;

    if (this.commandStackCommitTimer) {
      clearTimeout(this.commandStackCommitTimer);
      this.commandStackCommitTimer = null;
    }
    if (this.immediateCommitTimer) return; // ya hay un commit inmediato encolado en este tick

    this.immediateCommitTimer = setTimeout(() => {
      this.immediateCommitTimer = null;
      if (this.isImportingCommit || this.isApplyingRemoteDrag || !this.modeler) return;

      this.modeler.saveXML({ format: true }).then((result: any) => {
        if (!result?.xml) return;
        if (this.isImportingCommit || this.isApplyingRemoteDrag) return;
        this.emitLocalCommit('__structural_change__', result.xml);
      }).catch((err: any) => {
        console.error('Error en commit estructural inmediato:', err);
      });
    }, 0);
  }
  // ══════════════════════════════════════════════════════════════════════════════
  // PASO 3 — CONTROL DE CONCURRENCIA (BLOQUEO VIRTUAL)
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Al recibir ELEMENT_LOCK de un usuario remoto:
   *   1. Busca el elemento en el lienzo por su ID
   *   2. Añade un overlay visual (borde rojo + etiqueta con nombre del usuario)
   *   3. Marca el elemento como bloqueado para impedir interacción local
   */
  private applyRemoteLock(msg: CollaborativeMessage): void {
    if (!this.modeler) return;

    try {
      const elementRegistry = this.modeler.get('elementRegistry');
      const overlays = this.modeler.get('overlays');
      const element = elementRegistry.get(msg.elementId);
      if (!element) return;

      // Si ya estaba bloqueado, remover overlay anterior
      if (this.remoteLockedElements.has(msg.elementId)) {
        this.removeRemoteLockOverlay(msg.elementId);
      }

      // Crear overlay visual: borde rojo pulsante + etiqueta con nombre de usuario
      const overlayHtml = document.createElement('div');
      overlayHtml.className = 'remote-lock-overlay';
      overlayHtml.innerHTML = `
        <div style="
          position: absolute;
          top: -4px; left: -4px;
          width: calc(100% + 8px);
          height: calc(100% + 8px);
          border: 2px solid #ff5252;
          border-radius: 6px;
          pointer-events: none;
          animation: lockPulse 1.5s ease-in-out infinite;
          box-shadow: 0 0 12px rgba(255, 82, 82, 0.4);
        "></div>
        <div style="
          position: absolute;
          top: -22px; left: 50%;
          transform: translateX(-50%);
          background: #ff5252;
          color: white;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 10px;
          white-space: nowrap;
          letter-spacing: 0.03em;
          box-shadow: 0 2px 8px rgba(255,82,82,0.5);
        ">🔒 ${msg.sender}</div>
      `;

      const overlayId = overlays.add(msg.elementId, {
        position: { top: 0, left: 0 },
        html: overlayHtml
      });

      // Registrar en el mapa de bloqueos
      this.remoteLockedElements.set(msg.elementId, {
        overlayId,
        sender: msg.sender
      });

      this.cdr.detectChanges();
    } catch (err) {
      console.error('Error applying remote lock overlay:', err);
    }
  }

  /**
   * Al recibir ELEMENT_UNLOCK de un usuario remoto:
   *   1. Remueve el overlay visual
   *   2. Permite interacción local nuevamente
   */
  private applyRemoteUnlock(msg: CollaborativeMessage): void {
    this.removeRemoteLockOverlay(msg.elementId);
    this.cdr.detectChanges();
  }

  /** Remueve el overlay de bloqueo y elimina del mapa */
  private removeRemoteLockOverlay(elementId: string): void {
    const lockInfo = this.remoteLockedElements.get(elementId);
    if (!lockInfo || !this.modeler) return;

    try {
      const overlays = this.modeler.get('overlays');
      overlays.remove(lockInfo.overlayId);
    } catch (_e) {
      // El overlay pudo haberse eliminado al destruir el modeler
    }

    this.remoteLockedElements.delete(elementId);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PASO 4 — RENDERIZADO SUAVE (SIN ALTERAR COORDENADAS INTERNAS NI CORROMPER EL MODELO)
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Al recibir ELEMENT_DRAG de un usuario remoto NO movemos el nodo de inmediato.
   * Los mensajes llegan ~30/s con jitter de red, y aplicar cada uno provoca saltos
   * y "teletransportación". En su lugar guardamos la posición OBJETIVO y dejamos que
   * un único bucle `requestAnimationFrame` interpole (LERP) suavemente hacia ella a
   * 60fps. Esto desacopla el repintado de la cadencia/jitter de la red.
   *
   * El reposicionamiento real sigue haciéndose con `modeling.moveElements` (coords
   * x/y reales + redibujo de conexiones), nunca con transforms SVG manuales. Cada
   * paso del bucle se blinda con `isApplyingRemoteDrag` para que el commandStack.changed
   * resultante NO se reemita por WebSocket ni dispare auto-guardado.
   */
  private applyRemoteDrag(msg: CollaborativeMessage): void {
    if (!this.modeler || !msg.geometry) return;

    const elementRegistry = this.modeler.get('elementRegistry');
    const element = elementRegistry.get(msg.elementId);
    if (!element) {
      // REGLA 3 — Arrastre remoto huérfano: el elemento fue creado por otro usuario
      // y todavía no se materializó localmente. Ignoramos el delta de geometría de
      // forma SEGURA (no tocamos el lienzo) y esperamos el ELEMENT_COMMIT estructural
      // inminente que reconstruirá el árbol con el nodo ya posicionado.
      this.handleOrphanRemoteDrag(msg.elementId);
      return;
    }

    // Registramos/actualizamos el objetivo (el último mensaje gana) y arrancamos el bucle.
    this.remoteDragTargets.set(msg.elementId, { x: msg.geometry.x, y: msg.geometry.y });
    this.startRemoteDragLoop();
  }

  /**
   * Arranca el bucle de interpolación si no está ya corriendo. Se ejecuta FUERA de
   * la zona de Angular: el suavizado a 60fps no debe disparar detección de cambios
   * por frame. Cuando no quedan objetivos pendientes, el bucle se detiene solo.
   */
  private startRemoteDragLoop(): void {
    if (this.remoteDragRafId !== null) return;

    this.ngZone.runOutsideAngular(() => {
      const step = () => {
        const hasPending = this.stepRemoteDragAnimation();
        this.remoteDragRafId = hasPending ? requestAnimationFrame(step) : null;
      };
      this.remoteDragRafId = requestAnimationFrame(step);
    });
  }

  /**
   * Un frame de animación: para cada objetivo pendiente, acerca el elemento un
   * porcentaje (LERP) hacia su posición destino. Al entrar en el umbral de snap
   * hace el ajuste exacto final y lo retira del set. Devuelve `true` si quedan
   * elementos por animar.
   */
  private stepRemoteDragAnimation(): boolean {
    if (!this.modeler || this.remoteDragTargets.size === 0) return false;

    const elementRegistry = this.modeler.get('elementRegistry');
    const modeling = this.modeler.get('modeling');
    const lerp = DiagramEditorComponent.REMOTE_DRAG_LERP;
    const snap = DiagramEditorComponent.REMOTE_DRAG_SNAP_PX;

    // Blindaje anti-rebote durante TODAS las mutaciones del frame.
    this.isApplyingRemoteDrag = true;
    try {
      for (const [elementId, target] of Array.from(this.remoteDragTargets.entries())) {
        const element = elementRegistry.get(elementId);
        if (!element) {
          this.remoteDragTargets.delete(elementId);
          continue;
        }

        const remainingX = target.x - element.x;
        const remainingY = target.y - element.y;

        if (Math.hypot(remainingX, remainingY) <= snap) {
          // Ajuste final exacto y baja del bucle para este elemento.
          if (remainingX !== 0 || remainingY !== 0) {
            modeling.moveElements([element], { x: remainingX, y: remainingY });
          }
          this.remoteDragTargets.delete(elementId);
          continue;
        }

        modeling.moveElements([element], { x: remainingX * lerp, y: remainingY * lerp });
      }
    } catch (err) {
      console.error('Error en interpolación de arrastre remoto:', err);
    } finally {
      this.isApplyingRemoteDrag = false;
    }

    return this.remoteDragTargets.size > 0;
  }

  /**
   * Detiene el bucle de animación y descarta los objetivos pendientes. Se invoca
   * al recibir un ELEMENT_COMMIT (el `importXML` fija la posición autoritativa, así
   * que la interpolación ya no debe pelear con ella) y en `ngOnDestroy`.
   */
  private cancelRemoteDragAnimation(): void {
    if (this.remoteDragRafId !== null) {
      cancelAnimationFrame(this.remoteDragRafId);
      this.remoteDragRafId = null;
    }
    this.remoteDragTargets.clear();
  }

  /**
   * Maneja un ELEMENT_DRAG cuyo elemento aún no existe en el `elementRegistry`.
   * No realiza ninguna mutación del lienzo (evita corromper el estado) y se limita
   * a registrar un aviso con throttle. El elemento se materializará en cuanto llegue
   * el ELEMENT_COMMIT estructural que el emisor envía de forma inmediata al crearlo.
   */
  private handleOrphanRemoteDrag(elementId: string): void {
    const now = Date.now();
    if (now - this.lastOrphanDragLog > DiagramEditorComponent.ORPHAN_DRAG_LOG_THROTTLE_MS) {
      this.lastOrphanDragLog = now;
      console.info(
        `⏳ ELEMENT_DRAG huérfano para ${elementId}: delta ignorado de forma segura. ` +
        `Esperando el ELEMENT_COMMIT estructural para materializar el nodo.`
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PASO 5 — CIERRE DE TRANSACCIÓN (COMMIT) Y AUTOGUARDADO CORREGIDO
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Al recibir ELEMENT_COMMIT de un usuario remoto:
   * Cierra interacciones locales activas y consolida el diagrama vía importXML.
   */
  private async applyRemoteCommit(msg: CollaborativeMessage): Promise<void> {
    if (!this.modeler || !this.policyId) return;
    if (!this.isValidRemoteCommit(msg)) {
      console.warn('⛔ ELEMENT_COMMIT remoto descartado: payload inválido.', msg);
      return;
    }

    this.isImportingCommit = true;

    try {
      // El commit trae la posición autoritativa: detenemos cualquier interpolación
      // en curso para que el importXML no pelee con el bucle de animación.
      this.cancelRemoteDragAnimation();
      this.dismissLocalInteractions();
      await this.modeler.importXML(msg.bpmnXml!);
      this.applyRemoteUnlock(msg);
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Error aplicando ELEMENT_COMMIT remoto:', err);
    } finally {
      this.isImportingCommit = false;
    }
  }
  /**
   * Pipeline de autoguardado: espera 3 segundos de inactividad absoluta
   * antes de persistir en MongoDB. Protegido contra arrastres activos.
   */
  private initAutosavePipeline(): void {
    const sub = this.autosaveSubject.pipe(
      debounceTime(3000)
    ).subscribe({
      next: (xml) => {
        if (!this.policyId) return;

        // ✅ CORRECCIÓN: Usamos la bandera nativa de eventos segura
        if (this.isLocalDragging) {
          console.log('⏳ Guardado automático pospuesto: El usuario sigue arrastrando un elemento.');
          return;
        }

        // Persistencia delegada al ELEMENT_COMMIT del WebSocket: no duplicar con PUT REST.
        // El PUT envía un payload plano que sobrescribiría el XML vivo y deformaría el canvas.
        if (this.isCollaborationActive) {
          console.log('🔁 Auto-guardado HTTP omitido: persistencia delegada al WebSocket (ELEMENT_COMMIT).');
          return;
        }

        console.log(
          '%c⏳ 3 segundos de inactividad. Guardando en la Base de Datos...',
          'color: #00ff00; font-weight: bold;'
        );

        const payload = {
          name: this.policy?.name || 'Política Actualizada',
          description: this.policy?.description || '',
          bpmnXml: xml
        };

        this.policyService.update(this.policyId, payload).subscribe({
          next: () => console.log('💾 Cambios sincronizados con éxito en MongoDB.'),
          error: (err) => console.error('❌ Error en auto-guardado:', err)
        });
      }
    });
    this.subscriptions.push(sub);
  }
  // ══════════════════════════════════════════════════════════════════════════════
  // WEBSOCKET — ENVÍO Y RECEPCIÓN
  // ══════════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════════
  // WEBSOCKET — ENVÍO Y RECEPCIÓN
  // ══════════════════════════════════════════════════════════════════════════════

  /** Envía un mensaje colaborativo por WebSocket al canal de la política */
  private sendCollaborativeMessage(msg: CollaborativeMessage): void {
    if (!this.isValidCollaborativeMessage(msg)) {
      console.warn('⛔ Mensaje colaborativo bloqueado: payload inválido.', msg);
      return;
    }

    this.webSocketService.sendLiveChange(
      `/app/policy/collaborate/${this.policyId}`,
      msg
    );
  }

  /**
   * Configura la escucha del canal WebSocket para recibir mensajes
   * colaborativos remotos y despacharlos según su action.
   */
  private setupLiveCollaboration(): void {
    if (!this.policyId) return;
    if (this.wsSubscription) this.wsSubscription.unsubscribe();

    const topic = `/topic/policy/${this.policyId}`;
    this.wsSubscription = this.webSocketService.subscribeToTopic(
      topic,
      (remotePayload: CollaborativeMessage) => {
        // ── 1. FILTRO DE ECO ──
        // Identificamos al emisor de forma resiliente (sender o userId) e ignoramos
        // nuestros propios mensajes para no procesar/reemitir nuestros movimientos.
        const senderId = remotePayload?.sender ?? (remotePayload as any)?.userId;
        if (!remotePayload || senderId === this.currentUser) return;

        // ── 2. CANDADO DE ARRASTRE LOCAL ──
        // Si el usuario local está arrastrando justo ahora, descartamos el mensaje
        // remoto para evitar colisiones en el DOM del canvas.
        try {
          const draggingService = this.modeler?.get('dragging');
          if (draggingService && draggingService.isActive()) {
            console.warn('⏳ Cambio remoto ignorado temporalmente: arrastre local en ejecución.');
            return;
          }
        } catch (_e) {
          // Salvaguarda por si el módulo dragging no se ha inicializado en el modeler
        }

        // ── 3. RENDERIZADO EN ZONA DE ANGULAR ──
        // Toda mutación visual del lienzo ocurre dentro de ngZone.run para forzar
        // la detección de cambios y el repintado inmediato del navegador.
        this.ngZone.run(() => {
          // ✅ CORRECCIÓN: Usamos 'senderId' que ya lo calculaste arriba con el fallback seguro a (remotePayload as any).userId
          console.log(`📥 Evento remoto [${remotePayload.action}] de ${senderId} sobre ${remotePayload.elementId}`);
          
          switch (remotePayload.action) {
            case 'ELEMENT_LOCK':
              this.applyRemoteLock(remotePayload);
              break;
        
            case 'ELEMENT_DRAG':
              // ✅ INTEGRACIÓN: Aquí cambiamos tu método antiguo por el nuevo servicio de animación fluida
              // Usamos (remotePayload as any) por si tu interfaz estricta no tiene declaradas las propiedades x e y
              this.collaborationService.handleRemoteDrag(
                remotePayload.elementId,
                (remotePayload as any).x,
                (remotePayload as any).y
              );
              break;
        
            case 'ELEMENT_UNLOCK':
              this.applyRemoteUnlock(remotePayload);
              break;
        
            case 'ELEMENT_COMMIT':
              this.applyRemoteCommit(remotePayload);
              break;
        
            default:
              // Compatibilidad: payload antiguo sin action pero con bpmnXml → COMMIT.
              if ((remotePayload as any).bpmnXml) {
                this.applyRemoteCommit({
                  ...remotePayload,
                  action: 'ELEMENT_COMMIT',
                  elementId: '__legacy__'
                });
              }
              break;
          }
          this.cdr.detectChanges();
        });
      }
    );

    if (this.wsSubscription) {
      console.log(`✅ Escucha colaborativa activa en ${topic}`);
    } else {
      console.warn(`⏳ Suscripción a ${topic} diferida: se reintentará al confirmar la conexión.`);
    }
  }
  // ══════════════════════════════════════════════════════════════════════════════
  // SELECTION TRACKING
  // ══════════════════════════════════════════════════════════════════════════════

  private setupSelectionListener(): void {
    const eventBus = this.modeler.get('eventBus');
    this.selectionListener = () => {
      const selection = this.modeler.get('selection');
      const selected = selection.get();
      this.selectedElement = selected.length === 1 ? selected[0] : null;
      if (this.isLaneSelected) {
        const bo = this.selectedElement?.businessObject;
        if (bo && typeof bo.get === 'function') {
          this.selectedLaneDeptId = bo.get('custom:departmentId') || bo.$attrs?.['custom:departmentId'] || '';
        } else {
          this.selectedLaneDeptId = bo?.$attrs?.['custom:departmentId'] || '';
        }
      } else {
        this.selectedLaneDeptId = '';
      }
      this.cdr.detectChanges();
    };
    eventBus.on('selection.changed', this.selectionListener);
  }

  get isLaneSelected(): boolean {
    return this.selectedElement?.type === 'bpmn:Lane';
  }

  updateLaneDepartment(deptId: string): void {
    if (!this.modeler || !this.selectedElement) return;
    const modeling = this.modeler.get('modeling');
    const dept = this.deptObjects.find((d: any) => d.id === deptId);
    const props: any = { 'custom:departmentId': deptId };
    if (dept?.name) props['name'] = dept.name;
    modeling.updateProperties(this.selectedElement, props);
    this.selectedLaneDeptId = deptId;
    this.snackBar.open('Departamento vinculado al carril', 'OK', { duration: 2000 });
  }

  // ── Department loading ──
  private loadDepartments(): void {
    this.orgService.getDepartmentsFromUsers().subscribe({
      next: (deps) => {
        this.departments = deps.length > 0 ? deps : ['General', 'Operaciones', 'Legal'];
      },
      error: () => {
        this.departments = ['General', 'Operaciones', 'Legal'];
      }
    });
    this.orgService.getDepartments().subscribe({
      next: (depts) => { this.deptObjects = depts; },
      error: () => { this.deptObjects = []; }
    });
  }

  // ── Node display helpers ──
  getNodeLabel(el: any): string {
    return el?.businessObject?.name || el?.id || 'Sin nombre';
  }

  getNodeTypeLabel(el: any): string {
    const map: Record<string, string> = {
      'bpmn:StartEvent': 'Evento de inicio',
      'bpmn:EndEvent': 'Evento de fin',
      'bpmn:UserTask': 'Tarea de usuario',
      'bpmn:ExclusiveGateway': 'Decisión',
      'bpmn:ParallelGateway': 'Gateway Paralelo'
    };
    return map[el?.type] || el?.type || '';
  }

  getNodeIcon(el: any): string {
    const map: Record<string, string> = {
      'bpmn:StartEvent': 'play_circle',
      'bpmn:EndEvent': 'stop_circle',
      'bpmn:UserTask': 'person',
      'bpmn:ExclusiveGateway': 'alt_route',
      'bpmn:ParallelGateway': 'call_split'
    };
    return map[el?.type] || 'radio_button_unchecked';
  }

  getNodeColor(el: any): string {
    const map: Record<string, string> = {
      'bpmn:StartEvent': '#4caf50',
      'bpmn:EndEvent': '#f44336',
      'bpmn:UserTask': '#2196f3',
      'bpmn:ExclusiveGateway': '#ff9800',
      'bpmn:ParallelGateway': '#9c27b0'
    };
    return map[el?.type] || '#607d8b';
  }

  // ── Flow type handling ──
  onFlowTypeNext(): void {
    if (this.flowType === 'parallel') {
      this.onBranchCountChange();
    }
  }

  onBranchCountChange(): void {
    const count = Math.max(2, Math.min(10, this.branchCount || 2));
    this.branchCount = count;
    while (this.branches.length < count) {
      this.branches.push({ name: '', department: '' });
    }
    while (this.branches.length > count) {
      this.branches.pop();
    }
  }

  canExecute(): boolean {
    if (!this.selectedElement || !this.flowType) return false;
    if (this.flowType === 'sequential') return this.seqTaskName.trim().length > 0;
    if (this.flowType === 'decision') {
      if (!this.decisionYesType || !this.decisionNoType) return false;
      if (this.decisionYesType === 'activity' && !this.decisionYesName.trim()) return false;
      if (this.decisionNoType === 'activity' && !this.decisionNoName.trim()) return false;
      return true;
    }
    if (this.flowType === 'parallel') return this.branches.every(b => b.name.trim().length > 0);
    if (this.flowType === 'retry') return this.retryTaskName.trim().length > 0;
    return true;
  }

  // ── Auto-flow execution ──

  // ── Builder: Sequential ──
  private buildSequential(c: any): void {
    const task = this.makeTask(c, this.seqTaskName.trim(), this.seqTaskDept, c.sx + this.GAP_X, c.sy);
    c.modeling.connect(c.src, task);
  }

  // ── Builder: Decision (ExclusiveGateway + SI/NO branches) ──
  private buildDecision(c: any): void {
    const gw = this.makeShape(c, 'bpmn:ExclusiveGateway', {}, c.sx + this.GAP_X, c.sy);
    c.modeling.connect(c.src, gw);

    // ── Rama SÍ ──
    const yesX = c.sx + this.GAP_X * 2.5;
    const yesY = c.sy - this.GAP_Y * 0.8;
    let yesTarget: any;
    if (this.decisionYesType === 'activity') {
      yesTarget = this.makeTask(c, this.decisionYesName.trim(), this.decisionYesDept, yesX, yesY);
    } else {
      yesTarget = this.makeShape(c, 'bpmn:EndEvent', {}, yesX, yesY);
    }
    const connYes = c.modeling.connect(gw, yesTarget);
    this.labelConnection(c.modeling, connYes, 'Sí');
    this.colorConnection(connYes, '#4caf50');

    // ── Rama NO ──
    const noX = c.sx + this.GAP_X * 2.5;
    const noY = c.sy + this.GAP_Y * 0.8;
    if (this.decisionNoType === 'activity') {
      const noTarget = this.makeTask(c, this.decisionNoName.trim(), this.decisionNoDept, noX, noY);
      const connNo = c.modeling.connect(gw, noTarget);
      this.labelConnection(c.modeling, connNo, 'No');
      this.colorConnection(connNo, '#f44336');
    } else if (this.decisionNoType === 'end') {
      const noTarget = this.makeShape(c, 'bpmn:EndEvent', {}, noX, noY);
      const connNo = c.modeling.connect(gw, noTarget);
      this.labelConnection(c.modeling, connNo, 'No');
      this.colorConnection(connNo, '#f44336');
    } else if (this.decisionNoType === 'loop') {
      // Loop back to the gateway itself
      const connNo = c.modeling.connect(gw, c.src);
      this.labelConnection(c.modeling, connNo, 'No');
      this.colorConnection(connNo, '#f44336');
    }
  }

  // ── Builder: Parallel Complete (Fork + N tasks + Join) ──
  private buildParallelComplete(c: any): void {
    const forkBo = c.bpmnFactory.create('bpmn:ParallelGateway', { 'custom:forkJoinType': 'FORK' });
    const fork = c.elementFactory.createShape({ type: 'bpmn:ParallelGateway', businessObject: forkBo });
    c.modeling.createShape(fork, { x: c.sx + this.GAP_X, y: c.sy }, c.parent);
    c.modeling.connect(c.src, fork);

    const count = this.branches.length;
    const totalH = (count - 1) * this.GAP_Y;
    const startY = c.sy - totalH / 2;
    const tasks: any[] = [];

    for (let i = 0; i < count; i++) {
      const branch = this.branches[i];
      const posY = this.resolveLaneY(branch.department, startY + i * this.GAP_Y, c.parent);
      const dropParent = this.findLaneByDept(branch.department) || c.parent;
      const task = this.makeTaskIn(c, branch.name.trim() || `Tarea ${i + 1}`,
        c.sx + this.GAP_X * 2.5, posY, dropParent);
      const conn = c.modeling.connect(fork, task);
      this.labelConnection(c.modeling, conn, `Rama ${i + 1}`);
      tasks.push(task);
    }

    // Close with Join
    const joinBo = c.bpmnFactory.create('bpmn:ParallelGateway', { 'custom:forkJoinType': 'JOIN' });
    const join = c.elementFactory.createShape({ type: 'bpmn:ParallelGateway', businessObject: joinBo });
    c.modeling.createShape(join, { x: c.sx + this.GAP_X * 4, y: c.sy }, c.parent);
    for (const t of tasks) {
      c.modeling.connect(t, join);
    }
  }

  // ── Builder: Retry Cycle ──
  private buildRetry(c: any): void {
    const task = this.makeTask(c, this.retryTaskName.trim(), this.retryTaskDept,
      c.sx + this.GAP_X, c.sy);
    c.modeling.connect(c.src, task);
    const returnConn = c.modeling.connect(task, c.src);
    this.labelConnection(c.modeling, returnConn, 'No cumple');
  }

  // ── Builder: End ──
  private buildEnd(c: any): void {
    const endShape = this.makeShape(c, 'bpmn:EndEvent', {}, c.sx + this.GAP_X, c.sy);
    c.modeling.connect(c.src, endShape);
  }

  // ── Shape factory helpers ──
  private makeShape(c: any, type: string, boAttrs: any, x: number, y: number): any {
    const bo = c.bpmnFactory.create(type, boAttrs);
    const shape = c.elementFactory.createShape({ type, businessObject: bo });
    c.modeling.createShape(shape, { x, y }, c.parent);
    return shape;
  }

  private makeTask(c: any, name: string, dept: string, x: number, y: number): any {
    const lane = this.findLaneByDept(dept);
    const dropParent = lane || c.parent;
    const posY = lane ? (lane.y + lane.height / 2 - 40) : y;
    return this.makeTaskIn(c, name, x, posY, dropParent);
  }

  private makeTaskIn(c: any, name: string, x: number, y: number, parent: any): any {
    const bo = c.bpmnFactory.create('bpmn:UserTask', { name });
    const shape = c.elementFactory.createShape({ type: 'bpmn:UserTask', businessObject: bo });
    c.modeling.createShape(shape, { x, y }, parent);
    return shape;
  }

  private labelConnection(modeling: any, conn: any, label: string): void {
    if (conn?.businessObject) {
      modeling.updateProperties(conn, { name: label });
    }
  }

  private colorConnection(conn: any, color: string): void {
    if (!conn || !this.modeler) return;
    try {
      const modeling = this.modeler.get('modeling');
      modeling.setColor([conn], { stroke: color });
    } catch (_e) { /* setColor may not be available in all bpmn-js versions */ }
  }

  // ── Auto-layout children ──
  autoLayoutChildren(): void {
    if (!this.selectedElement || !this.modeler) return;

    const modeling = this.modeler.get('modeling');
    const el = this.selectedElement;
    const outgoing = el.outgoing || [];
    if (outgoing.length === 0) {
      this.snackBar.open('El nodo no tiene conexiones salientes', 'OK', { duration: 2000 });
      return;
    }

    const children = outgoing.map((conn: any) => conn.target).filter(Boolean);
    const baseX = el.x + (el.width || 100) + this.GAP_X;
    const totalH = (children.length - 1) * this.GAP_Y;
    const centerY = el.y + (el.height || 80) / 2;
    const startY = centerY - totalH / 2;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const targetX = baseX;
      const targetY = startY + i * this.GAP_Y - (child.height || 80) / 2;
      const dx = targetX - child.x;
      const dy = targetY - child.y;
      if (dx !== 0 || dy !== 0) {
        modeling.moveElements([child], { x: dx, y: dy });
      }
    }
    this.snackBar.open('Nodos alineados', 'OK', { duration: 1500 });
  }

  // ── Lane finder ──
  private findLaneByDept(deptName: string): any {
    if (!deptName || !this.modeler) return null;
    try {
      const elementRegistry = this.modeler.get('elementRegistry');
      const allElements = elementRegistry.getAll();
      for (const el of allElements) {
        if (el.type === 'bpmn:Lane') {
          const laneName = el.businessObject?.name || '';
          if (laneName.toLowerCase() === deptName.toLowerCase()) {
            return el;
          }
        }
      }
    } catch (_e) { /* no lanes in diagram */ }
    return null;
  }

  private resolveLaneY(dept: string, fallbackY: number, _parent: any): number {
    const lane = this.findLaneByDept(dept);
    return lane ? (lane.y + lane.height / 2 - 40) : fallbackY;
  }

  // ── Reset assistant ──
  private resetFlowAssistant(stepper: any): void {
    this.flowType = '';
    this.seqTaskName = '';
    this.seqTaskDept = '';
    this.branchCount = 2;
    this.branches = [{ name: '', department: '' }, { name: '', department: '' }];
    this.decisionYesType = '';
    this.decisionYesName = '';
    this.decisionYesDept = '';
    this.decisionNoType = '';
    this.decisionNoName = '';
    this.decisionNoDept = '';
    this.retryTaskName = '';
    this.retryTaskDept = '';
    stepper.reset();
  }

  // ── Toggle panels ──
  toggleAiPanel(): void {
    this.showAiPanel = !this.showAiPanel;
    if (this.showAiPanel) this.showFlowAssistant = false;
  }

  toggleFlowAssistant(): void {
    this.showFlowAssistant = !this.showFlowAssistant;
    if (this.showFlowAssistant) this.showAiPanel = false;
  }

  // ── Save / Publish / AI ──

  /** Builds the HTTP save observable (create or update) after exporting XML. */
  private buildSaveObs(): Observable<any> {
    return new Observable(observer => {
      if (!this.modeler) {
        observer.error(new Error('Editor no inicializado'));
        return;
      }
      this.modeler.saveXML({ format: true }).then((result: any) => {
        const bpmnXml = result?.xml;
        if (!bpmnXml) {
          observer.error(new Error('No se pudo capturar el diagrama'));
          return;
        }
        const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
        const draftName = this.policy?.name?.trim() || `Borrador ${timestamp}`;
        const payload: any = {
          name: draftName,
          description: this.policy?.description || '',
          bpmnXml
        };
        if (this.policy) {
          if (this.policy.lanes) payload.lanes = this.policy.lanes;
          if (this.policy.nodes) payload.nodes = this.policy.nodes;
          if (this.policy.transitions) payload.transitions = this.policy.transitions;
        }
        const http$ = this.policy?.id
          ? this.policyService.update(this.policy.id, payload)
          : this.policyService.create(payload);
        http$.subscribe({
          next: (saved: any) => { observer.next(saved); observer.complete(); },
          error: (err: any) => observer.error(err)
        });
      }).catch((err: any) => observer.error(err));
    });
  }

  saveDraft(): void {
    if (!this.modeler) {
      this.snackBar.open('Editor no inicializado', 'OK', { duration: 3000 });
      return;
    }
    this.buildSaveObs().subscribe({
      next: (saved: any) => {
        this.policy = saved;
        this.snackBar.open('Borrador guardado', 'OK', { duration: 2000 });
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error saving:', err);
        const msg = err.error?.message || err.message || 'Error al guardar';
        this.snackBar.open(msg, 'OK', { duration: 4000 });
        this.cdr.detectChanges();
      }
    });
  }

  publish(): void {
    if (!this.modeler) {
      this.snackBar.open('Editor no inicializado', 'OK', { duration: 3000 });
      return;
    }
    this.buildSaveObs().subscribe({
      next: (saved: any) => {
        this.policy = saved;
        this.policyService.publish(saved.id).subscribe({
          next: () => {
            setTimeout(() => {
              this.policy = { ...this.policy, status: 'ACTIVE' };
              this.snackBar.open('Política publicada correctamente', 'OK', { duration: 3000 });
              this.cdr.detectChanges();
            }, 0);
          },
          error: (err: any) => {
            setTimeout(() => {
              const msg = err.error?.message || err.message || 'Error al publicar';
              this.snackBar.open(msg, 'OK', { duration: 4000 });
              this.cdr.detectChanges();
            }, 0);
          }
        });
      },
      error: (err: any) => {
        const msg = err.error?.message || err.message || 'Error al guardar antes de publicar';
        this.snackBar.open(msg, 'OK', { duration: 4000 });
        this.cdr.detectChanges();
      }
    });
  }

  generateWithAI(): void {
    if (!this.aiPrompt.trim()) return;
    this.generatingAI = true;

    this.policyService.generateWithAI(this.aiPrompt).subscribe({
      next: async (generated) => {
        this.policy = generated;
        this.generatingAI = false;
        this.showAiPanel = false;

        if (generated.bpmnXml && this.modeler) {
          try {
            await this.modeler.importXML(generated.bpmnXml);
            this.modeler.get('canvas').zoom('fit-viewport');
          } catch (xmlErr) {
            console.error('Error importing AI XML:', xmlErr);
          }
        }

        this.snackBar.open('Diagrama generado por IA', 'OK', { duration: 3000 });
      },
      error: (err) => {
        console.error('Error generating:', err);
        this.generatingAI = false;
        this.snackBar.open('Error al generar diagrama', 'OK', { duration: 3000 });
      }
    });
  }

  private async exportDiagramJson(): Promise<any> {
    try {
      const { xml } = await this.modeler.saveXML({ format: true });
      return { bpmnXml: xml };
    } catch (err) {
      console.error('Error exporting XML:', err);
      return {};
    }
  }

  getNodeData(elementId: string): any {
    if (!elementId || !this.policy?.nodes) return {};
    return this.policy.nodes.find((n: any) => n.id === elementId) || {};
  }

  onNodeDataChanged(event: { elementId: string; data: any }): void {
    if (!this.policy) this.policy = {};
    if (!this.policy.nodes) this.policy.nodes = [];
    const idx = this.policy.nodes.findIndex((n: any) => n.id === event.elementId);
    if (idx >= 0) {
      this.policy.nodes[idx] = { ...this.policy.nodes[idx], ...event.data };
    } else {
      this.policy.nodes.push({ id: event.elementId, ...event.data });
    }
  }

  async onDiagramGenerated(result: any): Promise<void> {
    this.policy = result;
    this.showAiPanel = false;
    if (result.bpmnXml && this.modeler) {
      try {
        await this.modeler.importXML(result.bpmnXml);
        this.modeler.get('canvas').zoom('fit-viewport');
      } catch (xmlErr) {
        console.error('Error importing AI XML:', xmlErr);
      }
    }
    this.snackBar.open('Diagrama generado por IA', 'OK', { duration: 3000 });
    this.cdr.detectChanges();
  }

  async onDiagramRefined(result: any): Promise<void> {
    await this.onDiagramGenerated(result);
    // Broadcast el diagrama refinado como ELEMENT_COMMIT
    if (result.bpmnXml) {
      this.sendCollaborativeMessage({
        action: 'ELEMENT_COMMIT',
        policyId: this.policyId,
        sender: this.currentUser,
        elementId: '__ai_refine__',
        bpmnXml: result.bpmnXml
      });
    }
  }

  executeAutoFlow(stepper: any): void {
    if (!this.modeler || !this.selectedElement) return;

    const modeling = this.modeler.get('modeling');
    const elementFactory = this.modeler.get('elementFactory');
    const bpmnFactory = this.modeler.get('bpmnFactory');
    const canvas = this.modeler.get('canvas');
    const src = this.selectedElement;
    const sx = src.x + (src.width || 100);
    const sy = src.y + (src.height || 80) / 2;
    const parent = src.parent || canvas.getRootElement();
    const ctx = { modeling, elementFactory, bpmnFactory, src, sx, sy, parent };

    switch (this.flowType) {
      case 'sequential': this.buildSequential(ctx); break;
      case 'decision': this.buildDecision(ctx); break;
      case 'parallel': this.buildParallelComplete(ctx); break;
      case 'retry': this.buildRetry(ctx); break;
      case 'end': this.buildEnd(ctx); break;
    }

    // El commandStack.changed disparará automáticamente el commit
    // porque isLocalDragging es false y isImportingCommit es false

    this.snackBar.open('Flujo aplicado al diagrama', 'OK', { duration: 2500 });
    this.resetFlowAssistant(stepper);
  }
}
