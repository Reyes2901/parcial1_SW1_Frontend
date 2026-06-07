import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../core/services/auth.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  disabled?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  adminOnly?: boolean;
  clientOnly?: boolean;
  funcionarioOnly?: boolean;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="shell-root">
      <!-- ══════════════ SIDEBAR ══════════════ -->
      <nav class="shell-sidebar" [class.sidebar--collapsed]="collapsed">
        <!-- Brand -->
        <div class="sidebar-brand">
          <span class="brand-mark">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="1" y="1" width="8" height="8" rx="2" fill="currentColor" opacity=".9"/>
              <rect x="11" y="1" width="8" height="8" rx="2" fill="currentColor" opacity=".45"/>
              <rect x="1" y="11" width="8" height="8" rx="2" fill="currentColor" opacity=".45"/>
              <rect x="11" y="11" width="8" height="8" rx="2" fill="currentColor" opacity=".9"/>
            </svg>
          </span>
          <div class="brand-text" *ngIf="!collapsed">
            <span class="brand-name">WBS<span class="brand-accent">IA</span></span>
            <span class="brand-sub">Admin Panel</span>
          </div>
        </div>

        <!-- Nav groups -->
        <div class="nav-scroll">
          <ng-container *ngFor="let group of visibleGroups">
            <div class="nav-group">
              <span class="nav-group-label" *ngIf="!collapsed">{{ group.title }}</span>
              <div class="nav-group-sep" *ngIf="collapsed"></div>
              <ul class="nav-list">
                <li *ngFor="let item of group.items">
                  <a
                    *ngIf="!item.disabled"
                    class="nav-item"
                    [class.nav-item--active]="isActive(item.route)"
                    [routerLink]="item.route"
                    [title]="item.label">
                    <span class="nav-icon" [innerHTML]="item.icon"></span>
                    <span class="nav-label" *ngIf="!collapsed">{{ item.label }}</span>
                    <span class="nav-indicator" *ngIf="isActive(item.route)"></span>
                  </a>
                  <span *ngIf="item.disabled" class="nav-item nav-item--disabled" [title]="item.label">
                    <span class="nav-icon" [innerHTML]="item.icon"></span>
                    <span class="nav-label" *ngIf="!collapsed">{{ item.label }}</span>
                    <span class="nav-soon" *ngIf="!collapsed">Pronto</span>
                  </span>
                </li>
              </ul>
            </div>
          </ng-container>
        </div>

        <!-- Footer -->
        <div class="sidebar-footer">
          <button class="collapse-btn" (click)="collapsed = !collapsed" type="button"
                  [title]="collapsed ? 'Expandir' : 'Colapsar'">
            {{ collapsed ? '»' : '«' }}
          </button>
          <div class="user-row" *ngIf="!collapsed">
            <span class="user-avatar">{{ userInitial }}</span>
            <div class="user-info">
              <span class="user-name">{{ userName }}</span>
              <span class="user-role">{{ userRole }}</span>
            </div>
          </div>
          <button class="logout-btn" (click)="logout()" type="button" title="Cerrar sesión">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </nav>

      <!-- ══════════════ MAIN ══════════════ -->
      <main class="shell-main">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    :host {
      --sidebar-w: 240px;
      --sidebar-w-collapsed: 56px;
      --c-green-dk:  #08420c;
      --c-green-dk2: #0d5c13;
      --c-green-lt:  #e1f5a6;
      --c-border:    rgba(255,255,255,.1);
      display: block;
      height: 100vh;
      overflow: hidden;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    }

    .shell-root {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* ─── SIDEBAR ─── */
    .shell-sidebar {
      width: var(--sidebar-w);
      height: 100vh;
      background: var(--c-green-dk);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      transition: width .2s ease;
      overflow: hidden;
    }

    .shell-sidebar.sidebar--collapsed {
      width: var(--sidebar-w-collapsed);
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 14px 14px;
      border-bottom: 1px solid var(--c-border);
      min-height: 56px;
    }

    .brand-mark {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: var(--c-green-lt);
      border-radius: 7px;
      color: var(--c-green-dk);
      flex-shrink: 0;
    }

    .brand-text { display: flex; flex-direction: column; }

    .brand-name {
      font-size: 15px;
      font-weight: 800;
      color: #fff;
      letter-spacing: -.01em;
      line-height: 1.15;
    }

    .brand-accent { color: var(--c-green-lt); }

    .brand-sub {
      font-size: 9.5px;
      color: rgba(255,255,255,.3);
      font-weight: 500;
      letter-spacing: .04em;
    }

    /* Nav scroll area */
    .nav-scroll {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 8px 0;
      scrollbar-width: none;
    }
    .nav-scroll::-webkit-scrollbar { display: none; }

    .nav-group {
      padding: 4px 8px 2px;
    }

    .nav-group-label {
      display: block;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .13em;
      color: rgba(255,255,255,.25);
      padding: 8px 8px 5px;
    }

    .nav-group-sep {
      height: 1px;
      background: var(--c-border);
      margin: 4px 8px 6px;
    }

    .nav-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 8px 10px;
      border-radius: 7px;
      font-size: 13px;
      font-weight: 500;
      color: rgba(255,255,255,.55);
      text-decoration: none;
      cursor: pointer;
      position: relative;
      transition: background .12s, color .12s;
      white-space: nowrap;
    }

    .nav-item:hover:not(.nav-item--disabled) {
      background: rgba(255,255,255,.08);
      color: #fff;
    }

    .nav-item--active {
      background: rgba(225,245,166,.12) !important;
      color: var(--c-green-lt) !important;
      font-weight: 600;
    }

    .nav-item--disabled {
      opacity: .35;
      cursor: default;
      pointer-events: none;
    }

    .nav-icon {
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 14px;
      line-height: 1;
    }

    .nav-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }

    .nav-indicator {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--c-green-lt);
      flex-shrink: 0;
    }

    .nav-soon {
      font-size: 9px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 999px;
      background: rgba(255,255,255,.1);
      color: rgba(255,255,255,.35);
      flex-shrink: 0;
    }

    /* ─── FOOTER ─── */
    .sidebar-footer {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-top: 1px solid var(--c-border);
    }

    .collapse-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,.12);
      background: transparent;
      color: rgba(255,255,255,.4);
      cursor: pointer;
      flex-shrink: 0;
      font-size: 14px;
      transition: background .12s;
    }

    .collapse-btn:hover { background: rgba(255,255,255,.08); color: rgba(255,255,255,.7); }

    .user-row { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }

    .user-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--c-green-lt);
      color: var(--c-green-dk);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 800;
      flex-shrink: 0;
    }

    .user-info { display: flex; flex-direction: column; min-width: 0; }

    .user-name {
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,.8);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-role {
      font-size: 9.5px;
      color: rgba(255,255,255,.3);
      font-weight: 500;
    }

    .logout-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,.1);
      background: transparent;
      color: rgba(255,255,255,.4);
      cursor: pointer;
      flex-shrink: 0;
      transition: background .12s, color .12s;
    }

    .logout-btn:hover {
      background: rgba(255,255,255,.1);
      color: rgba(255,255,255,.8);
    }

    /* ─── MAIN ─── */
    .shell-main {
      flex: 1;
      min-width: 0;
      height: 100vh;
      overflow-y: auto;
      background: #fafaf9;
    }

    /* ─── RESPONSIVE ─── */
    @media (max-width: 768px) {
      .shell-sidebar { display: none; }
      .shell-root { flex-direction: column; }
      .shell-main { height: 100vh; }
    }
  `]
})
export class ShellComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  collapsed = false;
  currentRoute = '';
  userName = '';
  userRole = '';
  userInitial = '?';
  isAdmin = false;
  isClient = false;
  isFuncionario = false;

  readonly navGroups: NavGroup[] = [
    // ── ADMIN groups ──
    {
      title: 'General',
      items: [
        { label: 'Dashboard', route: '/dashboard', icon: '⊞' },
      ],
      adminOnly: true,
    },
    {
      title: 'Workflow',
      items: [
        { label: 'Trámites',   route: '/workflow/list',  icon: '⟳' },
        { label: 'Mis Tareas', route: '/workflow/tasks', icon: '✓' },
      ],
      adminOnly: true,
    },
    {
      title: 'Políticas',
      items: [
        { label: 'Listado',     route: '/policies',     icon: '➤' },
        { label: 'Crear Nueva', route: '/policies/new', icon: '✚' },
      ],
      adminOnly: true,
    },
    {
      title: 'Organización',
      items: [
        { label: 'Funcionarios',   route: '/org/users',   icon: '👤' },
        { label: 'Departamentos',  route: '/org/depts',   icon: '◈' },
        { label: 'Clientes',       route: '/org/clients', icon: '◎' },
      ],
      adminOnly: true,
    },
    {
      title: 'Sistema',
      items: [
        { label: 'Monitor',   route: '/monitor',  icon: '⊙' },
        { label: 'Análisis',  route: '/analysis', icon: '▤' },
      ],
      adminOnly: true,
    },
    // ── FUNCIONARIO groups ──
    {
      title: 'Workflow',
      items: [
        { label: 'Mis Tareas', route: '/tasks', icon: '✓' },
      ],
      funcionarioOnly: true,
    },
    // ── CLIENT groups ──
    {
      title: 'Mis trámites',
      items: [
        { label: 'Nueva solicitud',  route: '/workflow/nueva-solicitud',  icon: '✚' },
        { label: 'Mis solicitudes',  route: '/workflow/mis-solicitudes',  icon: '◎' },
      ],
      clientOnly: true,
    },
  ];

  get visibleGroups(): NavGroup[] {
    return this.navGroups.filter(g => {
      if (g.adminOnly)      return this.isAdmin;
      if (g.clientOnly)     return this.isClient;
      if (g.funcionarioOnly) return this.isFuncionario;
      return true;
    });
  }

  ngOnInit(): void {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => { this.currentRoute = e.urlAfterRedirects; });
    this.currentRoute = this.router.url;

    this.auth.getCurrentUser().subscribe(user => {
      if (user) {
        this.userName = user.sub || user.username || user.name || 'Usuario';
        this.userRole = user.role || (user.roles?.[0]) || 'USER';
        this.userInitial = this.userName.charAt(0).toUpperCase();
        this.isAdmin       = this.auth.hasRole('ADMIN');
        this.isClient      = this.auth.hasRole('CLIENT') || this.auth.hasRole('CLIENTE');
        this.isFuncionario = this.auth.hasRole('FUNCIONARIO') || this.auth.hasRole('EMPLOYEE');
        // Fallback: if no recognised role show tasks (funcionario-style)
        if (!this.isAdmin && !this.isClient && !this.isFuncionario) {
          this.isFuncionario = true;
        }
      }
    });
  }

  isActive(route: string): boolean {
    if (route === '/dashboard') {
      return this.currentRoute === '/dashboard';
    }
    return this.currentRoute.startsWith(route);
  }

  logout(): void {
    this.auth.logout();
  }
}
