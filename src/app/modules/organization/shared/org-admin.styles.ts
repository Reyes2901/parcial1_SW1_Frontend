/** Estilos compartidos para pantallas administrativas de Organización (inline en componentes). */
export const ORG_ADMIN_STYLES = `
  .admin-page { padding: 28px 32px; max-width: 1200px; margin: 0 auto; }
  .page-header {
    display: flex; justify-content: space-between; align-items: flex-end;
    margin-bottom: 20px; flex-wrap: wrap; gap: 16px;
  }
  .eyebrow {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .12em; color: #1a6b22; margin: 0 0 4px;
  }
  .title { font-size: 22px; font-weight: 800; color: #1a1a1a; margin: 0; }
  .table-card { padding: 0; overflow: hidden; }
  .full-width { width: 100%; }
  .center-state { text-align: center; padding: 48px 24px; color: #888; }
  .error-banner {
    background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
    padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .skeleton-table { padding: 16px; }
  .skeleton-row {
    height: 44px; margin-bottom: 8px; border-radius: 6px;
    background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
    background-size: 200% 100%; animation: sk-shimmer 1.2s infinite;
  }
  @keyframes sk-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .admin-table tr.mat-mdc-row:hover { background: #f9fafb; }
  .status-badge {
    display: inline-block; padding: 2px 10px; border-radius: 12px;
    font-size: 11px; font-weight: 600;
  }
  .status-badge--active { background: #dcfce7; color: #166534; }
  .status-badge--inactive { background: #f3f4f6; color: #6b7280; }
  .action-btn { width: 32px; height: 32px; line-height: 32px; }
  .action-btn .mat-icon { font-size: 18px; width: 18px; height: 18px; }
  .detail-card {
    padding: 24px; border-left: 4px solid #16a34a;
  }
  .detail-grid {
    display: grid; grid-template-columns: 160px 1fr; gap: 12px 20px;
    margin-bottom: 24px; font-size: 14px;
  }
  .detail-grid dt { color: #6b7280; font-weight: 600; margin: 0; }
  .detail-grid dd { margin: 0; color: #1f2937; }
  .section-title { font-size: 15px; font-weight: 700; margin: 0 0 12px; color: #1a6b22; }
  .filters-bar {
    display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; align-items: flex-end;
  }
  .filter-field { min-width: 180px; flex: 1; max-width: 260px; }
  @media (max-width: 768px) {
    .admin-page { padding: 16px; }
    .hide-mobile { display: none !important; }
    .page-header { flex-direction: column; align-items: flex-start; }
  }
`;
