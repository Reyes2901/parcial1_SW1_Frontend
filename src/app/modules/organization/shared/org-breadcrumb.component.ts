import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface BreadcrumbItem {
  label: string;
  action?: () => void;
}

@Component({
  selector: 'app-org-breadcrumb',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="org-breadcrumb" aria-label="Breadcrumb">
      @for (item of items; track item.label; let last = $last; let i = $index) {
        @if (i > 0) {
          <span class="sep">›</span>
        }
        @if (item.action && !last) {
          <button type="button" class="crumb crumb--link" (click)="item.action!()">{{ item.label }}</button>
        } @else {
          <span class="crumb" [class.crumb--current]="last">{{ item.label }}</span>
        }
      }
    </nav>
  `,
  styles: [`
    .org-breadcrumb {
      display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
      font-size: 13px; color: #6b7280; margin-bottom: 16px;
    }
    .sep { color: #d1d5db; user-select: none; }
    .crumb { font-weight: 500; }
    .crumb--current { color: #1a6b22; font-weight: 700; }
    .crumb--link {
      background: none; border: none; padding: 0; cursor: pointer;
      color: #16a34a; font: inherit; font-weight: 600;
    }
    .crumb--link:hover { text-decoration: underline; }
  `]
})
export class OrgBreadcrumbComponent {
  @Input() items: BreadcrumbItem[] = [];
}
