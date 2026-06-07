import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PolicyService } from '../services/policy.service';

@Component({
  selector: 'app-policy-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatSnackBarModule
  ],
  template: `
    <div class="policy-list">
      <div class="header">
        <div>
          <p class="eyebrow">Políticas</p>
          <h2 class="page-title">Políticas de negocio</h2>
        </div>
        <button mat-raised-button color="primary" (click)="newPolicy()">
          + Nueva política
        </button>
      </div>

      <!-- Borradores -->
      <h3 class="section-title">Borradores</h3>
      <div class="policy-grid">
        @for (p of drafts; track p.id) {
          <mat-card class="policy-card">
            <div class="card-header-row">
              <span class="badge draft">BORRADOR</span>
              <span class="date">{{ p.createdAt | date:'dd/MM/yyyy' }}</span>
            </div>
            <div class="card-name">{{ p.name }}</div>
            <div class="card-meta">
              <span class="meta-item">{{ p.nodes?.length || 0 }} nodos</span>
              <span class="meta-sep">·</span>
              <span class="meta-item">v{{ p.version || '1.0' }}</span>
            </div>
            <div class="card-lanes" *ngIf="getLanes(p).length > 0">
              @for (lane of getLanes(p); track lane) {
                <span class="lane-chip">{{ lane }}</span>
              }
            </div>
            <div class="card-actions">
              <button mat-stroked-button (click)="editPolicy(p.id)">Editar</button>
              <button mat-stroked-button color="primary" (click)="publishPolicy(p.id)">Publicar</button>
              <button mat-stroked-button color="warn" (click)="deletePolicy(p.id)">Eliminar</button>
            </div>
          </mat-card>
        }
        @if (drafts.length === 0) {
          <p class="empty">No hay borradores</p>
        }
      </div>

      <!-- Publicadas -->
      <h3 class="section-title">Publicadas</h3>
      <div class="policy-grid">
        @for (p of published; track p.id) {
          <mat-card class="policy-card published-card">
            <div class="card-header-row">
              <span class="badge published">PUBLICADA</span>
              <span class="date">{{ p.createdAt | date:'dd/MM/yyyy' }}</span>
            </div>
            <div class="card-name">{{ p.name }}</div>
            <div class="card-meta">
              <span class="meta-item">{{ p.nodes?.length || 0 }} nodos</span>
              <span class="meta-sep">·</span>
              <span class="meta-item">v{{ p.version || '1.0' }}</span>
            </div>
            <div class="card-lanes" *ngIf="getLanes(p).length > 0">
              @for (lane of getLanes(p); track lane) {
                <span class="lane-chip">{{ lane }}</span>
              }
            </div>
            <div class="card-actions">
              <button mat-stroked-button (click)="editPolicy(p.id)">Editar</button>
              <button mat-stroked-button color="warn" (click)="archivePolicy(p.id)">Desactivar</button>
              <button mat-stroked-button color="warn" (click)="deletePolicy(p.id)">Eliminar</button>
            </div>
          </mat-card>
        }
        @if (published.length === 0) {
          <p class="empty">No hay políticas publicadas</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .policy-list { padding: 28px 32px; max-width: 1200px; margin: 0 auto; }
    .header {
      display: flex; justify-content: space-between; align-items: flex-end;
      margin-bottom: 24px;
    }
    .eyebrow {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .12em; color: #1a6b22; margin: 0 0 4px;
    }
    .page-title { font-size: 22px; font-weight: 800; color: #1a1a1a; margin: 0; }
    .section-title { margin: 28px 0 16px 0; color: #555; font-size: 16px; font-weight: 700; }
    .policy-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    .policy-card {
      padding: 20px !important;
      transition: box-shadow 0.2s;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .policy-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
    .card-header-row {
      display: flex; justify-content: space-between; align-items: center;
    }
    .card-name { font-size: 17px; font-weight: 700; color: #1a1a1a; }
    .card-meta { font-size: 13px; color: #888; display: flex; gap: 4px; align-items: center; }
    .meta-sep { color: #ccc; }
    .card-lanes { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
    .lane-chip {
      display: inline-block; padding: 2px 10px; border-radius: 12px;
      font-size: 11px; font-weight: 600;
      background: #e3f2fd; color: #1565c0;
    }
    .card-actions { display: flex; gap: 8px; margin-top: 8px; }
    .badge {
      padding: 4px 12px; border-radius: 16px;
      font-size: 11px; font-weight: 600;
    }
    .badge.draft { background: #fff3e0; color: #e65100; }
    .badge.published { background: #e8f5e9; color: #2e7d32; }
    .date { color: #999; font-size: 12px; }
    .empty { color: #999; text-align: center; padding: 24px; }
  `]
})
export class PolicyListComponent implements OnInit {
  drafts: any[] = [];
  published: any[] = [];

  constructor(
    private policyService: PolicyService,
    private router: Router,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadPolicies();
  }

  loadPolicies(): void {
    this.policyService.getMyDrafts().subscribe({
      next: (d) => { this.drafts = d; this.cdr.detectChanges(); },
      error: (e) => { console.error('Error loading drafts:', e); console.error('Detalle:', e.error); this.cdr.detectChanges(); }
    });
    this.policyService.getAll().subscribe({
      next: (p) => {
        this.published = p.filter((x: any) => x.status === 'PUBLISHED' || x.status === 'ACTIVE');
        this.cdr.detectChanges();
      },
      error: (e) => { console.error('Error loading policies:', e); console.error('Detalle:', e.error); this.cdr.detectChanges(); }
    });
  }

  getLanes(policy: any): string[] {
    if (!policy.lanes || !Array.isArray(policy.lanes)) return [];
    return policy.lanes.map((l: any) => l.name || l.id).filter(Boolean);
  }

  newPolicy(): void {
    this.router.navigate(['/policies/new']);
  }

  editPolicy(id: string): void {
    this.router.navigate(['/policies', id, 'edit']);
  }

  publishPolicy(id: string): void {
    this.policyService.publish(id).subscribe({
      next: () => {
        this.snackBar.open('Política publicada', 'OK', { duration: 3000 });
        this.loadPolicies();
        this.cdr.detectChanges();
      },
      error: (e) => { this.snackBar.open(e.error?.message || 'Error al publicar', 'OK', { duration: 4000 }); this.cdr.detectChanges(); }
    });
  }

  archivePolicy(id: string): void {
    if (confirm('¿Desactivar esta política?')) {
      this.policyService.archive(id).subscribe({
        next: () => {
          this.snackBar.open('Política desactivada', 'OK', { duration: 3000 });
          this.loadPolicies();
          this.cdr.detectChanges();
        },
        error: () => { this.snackBar.open('Error al desactivar', 'OK', { duration: 3000 }); this.cdr.detectChanges(); }
      });
    }
  }

  deletePolicy(id: string): void {
    if (confirm('¿Eliminar esta política?')) {
      this.policyService.delete(id).subscribe({
        next: () => { this.loadPolicies(); this.cdr.detectChanges(); },
        error: () => { this.snackBar.open('Error al eliminar', 'OK', { duration: 3000 }); this.cdr.detectChanges(); }
      });
    }
  }
}