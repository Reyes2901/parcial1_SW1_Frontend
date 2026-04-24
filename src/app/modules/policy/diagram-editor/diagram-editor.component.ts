import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PolicyService } from '../services/policy.service';

@Component({
  selector: 'app-diagram-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  template: `
    <div class="editor-layout">
      <!-- Toolbar -->
      <div class="toolbar">
        <span class="policy-name">{{ policy?.name || 'Nueva política' }}</span>
        <div class="toolbar-actions">
          <button mat-stroked-button (click)="saveDraft()">
            💾 Guardar borrador
          </button>
          <button mat-raised-button color="primary" (click)="publish()">
            ✅ Publicar
          </button>
          <button mat-icon-button (click)="toggleAiPanel()" matTooltip="Asistente IA">
            <span class="ai-icon">🤖</span>
          </button>
        </div>
      </div>

      <div class="editor-body">
        <!-- Canvas bpmn-js -->
        <div #bpmnCanvas class="bpmn-canvas"></div>

        <!-- Panel lateral IA -->
        @if (showAiPanel) {
          <div class="ai-panel">
            <h3>🤖 Asistente IA</h3>
            <textarea [(ngModel)]="aiPrompt"
                      placeholder="Describe el proceso en lenguaje natural...
            Ej: Proceso de instalación de medidor: el cliente solicita,
            se verifica deuda, si debe se rechaza, si no se inspecciona
            y luego se instala con firma."
                      rows="6">
            </textarea>
            <button mat-raised-button color="accent"
                    (click)="generateWithAI()"
                    [disabled]="generatingAI || !aiPrompt.trim()">
              {{ generatingAI ? '⏳ Generando...' : '🚀 Generar diagrama' }}
            </button>
            <p class="ai-hint">
              El diagrama generado se cargará en el canvas. Puedes editarlo antes de publicar.
            </p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .editor-layout {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #fff;
      border-bottom: 1px solid #e0e0e0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .policy-name {
      font-size: 18px;
      font-weight: 500;
      color: #333;
    }
    .toolbar-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .ai-icon {
      font-size: 20px;
    }
    .editor-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    .bpmn-canvas {
      flex: 1;
      height: 100%;
    }
    .ai-panel {
      width: 320px;
      padding: 16px;
      background: #f8f9fa;
      border-left: 1px solid #e0e0e0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .ai-panel h3 {
      margin: 0;
      color: #333;
    }
    .ai-panel textarea {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      resize: vertical;
      font-family: inherit;
    }
    .ai-hint {
      font-size: 12px;
      color: #666;
      margin: 0;
    }
  `]
})
export class DiagramEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('bpmnCanvas') canvasRef!: ElementRef;

  policy: any = null;
  showAiPanel = false;
  aiPrompt = '';
  generatingAI = false;

  private modeler: any;

  constructor(
    private policyService: PolicyService,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {}

  async ngAfterViewInit(): Promise<void> {
    try {
      const BpmnModeler = (await import('bpmn-js/lib/Modeler')).default;

      this.modeler = new BpmnModeler({
        container: this.canvasRef.nativeElement
      });

      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.policyService.getById(id).subscribe(policy => {
          this.policy = policy;
        });
      } else {
        await this.modeler.createDiagram();
      }
    } catch (err) {
      console.error('Error loading bpmn-js:', err);
    }
  }

  async saveDraft(): Promise<void> {
    const diagramJson = await this.exportDiagramJson();
    const payload = {
      name: this.policy?.name || 'Nueva Política',
      description: this.policy?.description || '',
      lanes: [],
      nodes: [],
      transitions: [],
      ...this.policy,
      ...diagramJson
    };

    const obs = this.policy?.id
      ? this.policyService.update(this.policy.id, payload)
      : this.policyService.create(payload);

    obs.subscribe({
      next: (saved) => {
        this.policy = saved;
        this.snackBar.open('✅ Borrador guardado', 'OK', { duration: 2000 });
      },
      error: (err) => {
        console.error('Error saving:', err);
        this.snackBar.open('❌ Error al guardar', 'OK', { duration: 3000 });
      }
    });
  }

  publish(): void {
    if (!this.policy?.id) {
      this.snackBar.open('⚠️ Guarda el borrador primero', 'OK', { duration: 3000 });
      return;
    }
    this.policyService.publish(this.policy.id).subscribe({
      next: () => this.snackBar.open('✅ Política publicada', 'OK', { duration: 3000 }),
      error: (err) => this.snackBar.open(
        err.error?.message || '❌ Error al publicar', 'OK', { duration: 3000 }
      )
    });
  }

  generateWithAI(): void {
    if (!this.aiPrompt.trim()) return;
    this.generatingAI = true;

    this.policyService.generateWithAI(this.aiPrompt).subscribe({
      next: (generated) => {
        this.policy = generated;
        this.generatingAI = false;
        this.showAiPanel = false;
        this.snackBar.open('✅ Diagrama generado por IA', 'OK', { duration: 3000 });
      },
      error: (err) => {
        console.error('Error generating:', err);
        this.generatingAI = false;
        this.snackBar.open('❌ Error al generar diagrama', 'OK', { duration: 3000 });
      }
    });
  }

  toggleAiPanel(): void {
    this.showAiPanel = !this.showAiPanel;
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

  ngOnDestroy(): void {
    this.modeler?.destroy();
  }
}
