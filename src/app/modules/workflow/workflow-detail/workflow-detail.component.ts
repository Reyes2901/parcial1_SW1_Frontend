import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { RepositoryViewerComponent } from '../repository-viewer/repository-viewer.component';

type TabId = 'info' | 'history' | 'tasks' | 'documents' | 'audit';

/**
 * Vista de detalle de un trámite (instancia) con pestañas simples.
 *
 * ESTABILIDAD (parcial): la única pestaña completamente funcional es "Documentos",
 * que aloja el Repositorio Documental (RepositoryViewerComponent) consumiendo
 * endpoints reales. Las pestañas Información/Historial/Tareas/Auditoría son
 * placeholders intencionales: NO dependen de endpoints inciertos ni de datos
 * simulados, para no introducir riesgo arquitectónico.
 *
 * Tabs custom (botones + *ngIf). NO se usa Angular Material / MatTabs.
 */
@Component({
  selector: 'app-workflow-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, RepositoryViewerComponent],
  template: `
    <div class="wd-page">
      <header class="wd-header">
        <div>
          <a class="wd-back" routerLink="/workflow">← Volver a trámites</a>
          <h1 class="wd-title">Detalle del trámite</h1>
          <p class="wd-id">ID: {{ instanceId }}</p>
        </div>
      </header>

      <!-- Tabs -->
      <nav class="wd-tabs">
        <button
          *ngFor="let t of tabs"
          type="button"
          class="wd-tab"
          [class.wd-tab--active]="activeTab === t.id"
          (click)="activeTab = t.id"
        >
          {{ t.label }}
        </button>
      </nav>

      <section class="wd-body">
        <!-- Información (placeholder) -->
        <div *ngIf="activeTab === 'info'" class="tab-panel">
          <dl class="info-grid">
            <dt>ID del trámite</dt><dd>{{ instanceId || '—' }}</dd>
          </dl>
          <p class="placeholder">La información detallada del trámite estará disponible próximamente.</p>
        </div>

        <!-- Historial (placeholder) -->
        <div *ngIf="activeTab === 'history'" class="tab-panel">
          <p class="placeholder">El historial del proceso estará disponible próximamente.</p>
        </div>

        <!-- Tareas (placeholder) -->
        <div *ngIf="activeTab === 'tasks'" class="tab-panel">
          <p class="placeholder">El detalle de tareas estará disponible próximamente.</p>
        </div>

        <!-- Documentos (funcional) -->
        <div *ngIf="activeTab === 'documents'" class="tab-panel">
          <app-repository-viewer [instanceId]="instanceId"></app-repository-viewer>
        </div>

        <!-- Auditoría (placeholder) -->
        <div *ngIf="activeTab === 'audit'" class="tab-panel">
          <p class="placeholder">El registro de auditoría estará disponible próximamente.</p>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .wd-page { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #1f2937; padding: 24px; max-width: 1100px; margin: 0 auto; }
    .wd-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
    .wd-back { color: #16a34a; text-decoration: none; font-size: 13px; font-weight: 600; }
    .wd-back:hover { text-decoration: underline; }
    .wd-title { margin: 6px 0 2px; font-size: 24px; font-weight: 700; }
    .wd-id { margin: 0; font-size: 12px; color: #9ca3af; }

    .wd-tabs { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px; }
    .wd-tab { border: none; background: none; padding: 10px 16px; font-size: 14px; font-weight: 600; color: #6b7280; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all .15s ease; }
    .wd-tab:hover { color: #16a34a; }
    .wd-tab--active { color: #16a34a; border-bottom-color: #16a34a; }

    .tab-panel { animation: fade .2s ease; }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    .placeholder { color: #9ca3af; font-size: 14px; padding: 16px 0; }

    .info-grid { display: grid; grid-template-columns: 160px 1fr; gap: 10px 16px; margin: 0 0 8px; font-size: 14px; }
    .info-grid dt { color: #6b7280; font-weight: 600; }
    .info-grid dd { margin: 0; }
  `]
})
export class WorkflowDetailComponent implements OnInit {
  instanceId = '';
  activeTab: TabId = 'documents';

  tabs: { id: TabId; label: string }[] = [
    { id: 'info', label: 'Información' },
    { id: 'history', label: 'Historial' },
    { id: 'tasks', label: 'Tareas' },
    { id: 'documents', label: 'Documentos' },
    { id: 'audit', label: 'Auditoría' }
  ];

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.instanceId = this.route.snapshot.paramMap.get('instanceId') || '';
  }
}
