import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentRepositoryService } from '../../../core/services/document-repository.service';
import { ApiService } from '../../../core/services/api.service';
import {
  RepositoryDocument,
  DocumentFilter,
  DocumentPermissions,
  DOCUMENT_FILTERS
} from '../../../core/models/document.model';

/**
 * Visor del Repositorio Documental de un trámite (instancia) o política.
 * - Lista documentos en tabla con filtros simples.
 * - Permite subir reutilizando el uploader actual (ApiService.uploadFile) + attachDocument.
 * - Muestra permisos (usuarios/roles autorizados) en un modal de solo lectura.
 *
 * Regla AGENTS.md: al cargar datos por HTTP, llamar cdr.detectChanges() en cada
 * rama next:/error: para evitar congelamiento de UI fuera de la zona de Angular.
 */
@Component({
  selector: 'app-repository-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="repo">
      <header class="repo-head">
        <div>
          <h3 class="repo-title">Documentos del trámite</h3>
          <p class="repo-sub">{{ filteredDocs.length }} de {{ documents.length }} documento(s)</p>
        </div>

        <label class="btn-upload" [class.disabled]="uploading">
          <input type="file" hidden (change)="onFileSelected($event)" [disabled]="uploading" />
          <span *ngIf="!uploading">⬆ Subir documento</span>
          <span *ngIf="uploading">Subiendo…</span>
        </label>
      </header>

      <!-- Filtros -->
      <div class="repo-filters">
        <button
          *ngFor="let f of filters"
          type="button"
          class="chip"
          [class.chip--active]="activeFilter === f.value"
          (click)="setFilter(f.value)"
        >
          {{ f.label }}
        </button>
      </div>

      <!-- Loading -->
      <div class="repo-state" *ngIf="loading">
        <div class="loader-bar"></div>
        <p>Cargando documentos…</p>
      </div>

      <!-- Error -->
      <div class="repo-state repo-state--error" *ngIf="!loading && error">
        <span>⚠</span>
        <p>{{ error }}</p>
        <button class="btn-secondary" type="button" (click)="reload()">Reintentar</button>
      </div>

      <!-- Empty -->
      <div class="repo-state" *ngIf="!loading && !error && filteredDocs.length === 0">
        <span class="empty-glyph">◇</span>
        <p>No hay documentos para este filtro.</p>
      </div>

      <!-- Tabla -->
      <div class="repo-table-wrap" *ngIf="!loading && !error && filteredDocs.length > 0">
        <table class="repo-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Tarea asociada</th>
              <th>Usuario</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let doc of filteredDocs">
              <td class="cell-name">
                <a *ngIf="doc.url" [href]="doc.url" target="_blank" rel="noopener">{{ doc.name }}</a>
                <span *ngIf="!doc.url">{{ doc.name }}</span>
              </td>
              <td><span class="type-badge">{{ doc.type || '—' }}</span></td>
              <td>{{ doc.taskName || '—' }}</td>
              <td>{{ doc.uploadedBy || '—' }}</td>
              <td>{{ doc.uploadedAt ? (doc.uploadedAt | date: 'dd/MM/yyyy') : '—' }}</td>
              <td>
                <span class="status" [class.status--signed]="isSigned(doc)">
                  {{ doc.status || '—' }}
                </span>
              </td>
              <td class="cell-actions">
                <button class="btn-link" type="button" (click)="openPermissions(doc)">Permisos</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal de permisos -->
      <div class="modal-backdrop" *ngIf="permissionsDoc" (click)="closePermissions()">
        <div class="modal" (click)="$event.stopPropagation()">
          <header class="modal-head">
            <h4>Permisos · {{ permissionsDoc.name }}</h4>
            <button class="btn-close" type="button" (click)="closePermissions()">✕</button>
          </header>

          <div class="modal-body">
            <div class="repo-state" *ngIf="permissionsLoading">
              <div class="loader-bar"></div>
              <p>Cargando permisos…</p>
            </div>

            <div class="perm-error" *ngIf="!permissionsLoading && permissionsError">
              {{ permissionsError }}
            </div>

            <ng-container *ngIf="!permissionsLoading && !permissionsError && permissions">
              <section class="perm-section">
                <h5>Usuarios autorizados</h5>
                <p class="perm-empty" *ngIf="permissions.users.length === 0">Sin usuarios asignados.</p>
                <ul class="perm-list">
                  <li *ngFor="let u of permissions.users">
                    <span class="perm-name">{{ u.username || u.userId }}</span>
                    <span class="perm-level" *ngIf="u.permission">{{ u.permission }}</span>
                  </li>
                </ul>
              </section>

              <section class="perm-section">
                <h5>Roles autorizados</h5>
                <p class="perm-empty" *ngIf="permissions.roles.length === 0">Sin roles asignados.</p>
                <ul class="perm-list">
                  <li *ngFor="let r of permissions.roles">
                    <span class="perm-name">{{ r.role }}</span>
                    <span class="perm-level" *ngIf="r.permission">{{ r.permission }}</span>
                  </li>
                </ul>
              </section>
            </ng-container>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .repo { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #1f2937; }
    .repo-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
    .repo-title { margin: 0; font-size: 18px; font-weight: 700; }
    .repo-sub { margin: 2px 0 0; font-size: 13px; color: #6b7280; }

    .btn-upload {
      display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
      background: #16a34a; color: #fff; padding: 9px 16px; border-radius: 8px;
      font-size: 14px; font-weight: 600; transition: background .15s ease;
    }
    .btn-upload:hover { background: #15803d; }
    .btn-upload.disabled { opacity: .6; pointer-events: none; }

    .repo-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .chip {
      border: 1px solid #d1d5db; background: #fff; color: #374151;
      padding: 5px 14px; border-radius: 16px; font-size: 13px; cursor: pointer; transition: all .15s ease;
    }
    .chip:hover { border-color: #16a34a; }
    .chip--active { background: #16a34a; border-color: #16a34a; color: #fff; }

    .repo-state { text-align: center; padding: 32px 16px; color: #6b7280; }
    .repo-state--error { color: #dc2626; }
    .empty-glyph { font-size: 28px; display: block; margin-bottom: 8px; color: #9ca3af; }
    .loader-bar { height: 3px; width: 120px; margin: 0 auto 12px; border-radius: 2px; background: linear-gradient(90deg,#bbf7d0,#16a34a,#bbf7d0); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .repo-table-wrap { overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 10px; }
    .repo-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .repo-table thead th { text-align: left; padding: 12px 14px; background: #f0fdf4; color: #166534; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }
    .repo-table tbody td { padding: 12px 14px; border-top: 1px solid #f1f5f9; }
    .repo-table tbody tr:hover { background: #f9fafb; }
    .cell-name a { color: #16a34a; text-decoration: none; font-weight: 600; }
    .cell-name a:hover { text-decoration: underline; }
    .type-badge { background: #eef2ff; color: #4338ca; border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: 600; }
    .status { font-size: 12px; font-weight: 600; color: #6b7280; }
    .status--signed { color: #16a34a; }
    .cell-actions { text-align: right; }
    .btn-link { background: none; border: none; color: #16a34a; font-weight: 600; cursor: pointer; font-size: 13px; }
    .btn-link:hover { text-decoration: underline; }
    .btn-secondary { margin-top: 10px; border: 1px solid #d1d5db; background: #fff; padding: 6px 14px; border-radius: 8px; cursor: pointer; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
    .modal { background: #fff; width: 100%; max-width: 440px; border-radius: 14px; box-shadow: 0 20px 50px rgba(0,0,0,.25); overflow: hidden; }
    .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid #f1f5f9; }
    .modal-head h4 { margin: 0; font-size: 15px; font-weight: 700; }
    .btn-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #6b7280; }
    .modal-body { padding: 18px; max-height: 60vh; overflow-y: auto; }
    .perm-section { margin-bottom: 18px; }
    .perm-section h5 { margin: 0 0 8px; font-size: 13px; color: #166534; text-transform: uppercase; letter-spacing: .03em; }
    .perm-empty { color: #9ca3af; font-size: 13px; margin: 0; }
    .perm-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .perm-list li { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #f9fafb; border-radius: 8px; font-size: 14px; }
    .perm-level { font-size: 12px; background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 6px; font-weight: 600; }
    .perm-error { color: #dc2626; font-size: 14px; }
  `]
})
export class RepositoryViewerComponent implements OnInit, OnChanges {
  @Input() instanceId?: string;
  @Input() policyId?: string;
  /** Tarea opcional para asociar el documento subido. */
  @Input() taskId?: string;

  documents: RepositoryDocument[] = [];
  filters = DOCUMENT_FILTERS;
  activeFilter: DocumentFilter = 'ALL';

  loading = false;
  error = '';
  uploading = false;

  permissionsDoc: RepositoryDocument | null = null;
  permissions: DocumentPermissions | null = null;
  permissionsLoading = false;
  permissionsError = '';

  constructor(
    private repo: DocumentRepositoryService,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['instanceId'] && !changes['instanceId'].firstChange) ||
        (changes['policyId'] && !changes['policyId'].firstChange)) {
      this.reload();
    }
  }

  get filteredDocs(): RepositoryDocument[] {
    if (this.activeFilter === 'ALL') return this.documents;
    return this.documents.filter((d) => this.matchesFilter(d, this.activeFilter));
  }

  setFilter(filter: DocumentFilter): void {
    this.activeFilter = filter;
  }

  reload(): void {
    if (!this.instanceId && !this.policyId) {
      this.documents = [];
      return;
    }

    this.loading = true;
    this.error = '';

    const source$ = this.instanceId
      ? this.repo.getInstanceRepository(this.instanceId)
      : this.repo.getPolicyRepository(this.policyId!);

    source$.subscribe({
      next: (docs) => {
        this.documents = docs;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al cargar los documentos';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading = true;
    this.cdr.detectChanges();

    // 1) Subida con el uploader actual (NO se modifica ApiService.uploadFile).
    this.api.uploadFile('/files/upload', file, 'documentos').subscribe({
      next: (res: any) => {
        const fileUrl = res?.url || res?.fileUrl || '';
        // 2) Asociar el documento al trámite/política.
        this.repo
          .attachDocument({
            instanceId: this.instanceId,
            policyId: this.policyId,
            taskId: this.taskId,
            fileUrl,
            fileName: file.name,
            mimeType: file.type
          })
          .subscribe({
            next: () => {
              this.uploading = false;
              input.value = '';
              // 3) Actualizar la lista.
              this.reload();
              this.cdr.detectChanges();
            },
            error: (err) => {
              this.uploading = false;
              input.value = '';
              this.error = err?.error?.message || 'El archivo se subió pero no se pudo asociar al trámite';
              this.cdr.detectChanges();
            }
          });
      },
      error: (err) => {
        this.uploading = false;
        input.value = '';
        this.error = err?.error?.message || 'Error al subir el archivo';
        this.cdr.detectChanges();
      }
    });
  }

  openPermissions(doc: RepositoryDocument): void {
    this.permissionsDoc = doc;
    this.permissions = null;
    this.permissionsError = '';
    this.permissionsLoading = true;
    this.cdr.detectChanges();

    this.repo.getPermissions(doc.id).subscribe({
      next: (perms) => {
        this.permissions = perms;
        this.permissionsLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.permissionsError = err?.error?.message || 'Error al cargar los permisos';
        this.permissionsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closePermissions(): void {
    this.permissionsDoc = null;
    this.permissions = null;
    this.permissionsError = '';
  }

  isSigned(doc: RepositoryDocument): boolean {
    return (doc.status || '').toUpperCase().includes('SIGN') ||
           (doc.status || '').toUpperCase().includes('FIRMAD');
  }

  private matchesFilter(doc: RepositoryDocument, filter: DocumentFilter): boolean {
    const haystack = `${doc.type || ''} ${doc.mimeType || ''} ${doc.name || ''}`.toLowerCase();
    switch (filter) {
      case 'PDF':
        return haystack.includes('pdf');
      case 'WORD':
        return haystack.includes('word') || /\.docx?(\s|$)/.test(haystack) || haystack.includes('msword');
      case 'EXCEL':
        return haystack.includes('excel') || haystack.includes('sheet') || /\.xlsx?(\s|$)/.test(haystack);
      case 'IMAGE':
        return haystack.includes('image') || haystack.includes('imagen') ||
               /\.(png|jpe?g|gif|webp|bmp|svg)(\s|$)/.test(haystack);
      case 'SIGNED':
        return this.isSigned(doc);
      default:
        return true;
    }
  }
}
