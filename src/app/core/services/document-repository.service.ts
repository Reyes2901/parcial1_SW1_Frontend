import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import {
  RepositoryDocument,
  AttachDocumentDto,
  DocumentPermissions,
  GrantUserDto,
  GrantRoleDto
} from '../models/document.model';

/**
 * Servicio del Repositorio Documental.
 *
 * Reglas (AGENTS.md):
 * - Usa exclusivamente ApiService (URLs se construyen con environment.apiUrl + path).
 * - Mantiene la `/` inicial en todos los paths; nunca arma URLs manualmente.
 * - Normaliza respuestas de lista con `toArray()` por si el backend devuelve un
 *   Spring `Page` ({ content: [...] }) en lugar de un array plano.
 *
 * NOTA — endpoints marcados (SUPUESTO) aún no están confirmados contra el backend.
 * Están centralizados aquí para ajustarlos en un único lugar si difieren.
 */
@Injectable({ providedIn: 'root' })
export class DocumentRepositoryService {
  constructor(private api: ApiService) {}

  /** GET /api/files/repository/instance/{instanceId} — documentos de un trámite. */
  getInstanceRepository(instanceId: string): Observable<RepositoryDocument[]> {
    return this.api
      .get<any>(`/api/files/repository/instance/${instanceId}`)
      .pipe(map((res) => this.toArray(res)));
  }

  /** GET /api/files/repository/policy/{policyId} — documentos de una política. (SUPUESTO) */
  getPolicyRepository(policyId: string): Observable<RepositoryDocument[]> {
    return this.api
      .get<any>(`/api/files/repository/policy/${policyId}`)
      .pipe(map((res) => this.toArray(res)));
  }

  /** POST /api/files/repository/attach — asocia un documento ya subido. (SUPUESTO) */
  attachDocument(dto: AttachDocumentDto): Observable<RepositoryDocument> {
    return this.api.post<RepositoryDocument>('/api/files/repository/attach', dto);
  }

  /** POST /api/files/{documentId}/permissions/user — otorga acceso a un usuario. (SUPUESTO) */
  grantUser(documentId: string, dto: GrantUserDto): Observable<any> {
    return this.api.post<any>(`/api/files/${documentId}/permissions/user`, dto);
  }

  /** POST /api/files/{documentId}/permissions/role — otorga acceso a un rol. (SUPUESTO) */
  grantRole(documentId: string, dto: GrantRoleDto): Observable<any> {
    return this.api.post<any>(`/api/files/${documentId}/permissions/role`, dto);
  }

  /** GET /api/files/{documentId}/permissions — usuarios y roles autorizados. */
  getPermissions(documentId: string): Observable<DocumentPermissions> {
    return this.api
      .get<any>(`/api/files/${documentId}/permissions`)
      .pipe(map((res) => this.normalizePermissions(res)));
  }

  /**
   * Normaliza una respuesta del backend a un array plano de documentos.
   * Maneja: array directo, Spring Page ({ content: [] }) o wrapper ({ data: [] }).
   */
  private toArray(res: any): RepositoryDocument[] {
    if (!res) return [];
    const arr = Array.isArray(res)
      ? res
      : Array.isArray(res.content)
        ? res.content
        : Array.isArray(res.data)
          ? res.data
          : [];
    return arr.map((item: any) => this.normalizeDocument(item));
  }

  /** Mapea un documento crudo del backend al modelo RepositoryDocument tolerando alias de campos. */
  private normalizeDocument(item: any): RepositoryDocument {
    const name = item.name || item.fileName || item.originalName || item.filename || 'documento';
    const mimeType = item.mimeType || item.contentType || item.type;
    return {
      id: item.id || item._id || item.documentId || '',
      name,
      type: item.type || item.category || this.deriveType(name, mimeType),
      mimeType,
      taskName: item.taskName || item.nodeLabel || item.taskLabel || item.task,
      uploadedBy: item.uploadedBy || item.userName || item.user || item.createdBy,
      uploadedAt: item.uploadedAt || item.createdAt || item.date || item.timestamp,
      status: item.status || item.state,
      url: item.url || item.fileUrl || item.downloadUrl,
      instanceId: item.instanceId,
      policyId: item.policyId
    };
  }

  /** Deriva una categoría legible a partir del nombre/MIME cuando el backend no la envía. */
  private deriveType(name: string, mimeType?: string): string {
    const lower = (name || '').toLowerCase();
    const mime = (mimeType || '').toLowerCase();
    if (lower.endsWith('.pdf') || mime.includes('pdf')) return 'PDF';
    if (/\.docx?$/.test(lower) || mime.includes('word')) return 'Word';
    if (/\.xlsx?$/.test(lower) || mime.includes('sheet') || mime.includes('excel')) return 'Excel';
    if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lower) || mime.includes('image')) return 'Imagen';
    return 'Archivo';
  }

  private normalizePermissions(res: any): DocumentPermissions {
    if (!res) return { users: [], roles: [] };
    const users = Array.isArray(res.users) ? res.users : Array.isArray(res.userPermissions) ? res.userPermissions : [];
    const roles = Array.isArray(res.roles) ? res.roles : Array.isArray(res.rolePermissions) ? res.rolePermissions : [];
    return {
      users: users.map((u: any) => ({
        userId: u.userId || u.id || u.user || '',
        username: u.username || u.name || u.userName,
        permission: u.permission || u.access || u.level
      })),
      roles: roles.map((r: any) => ({
        role: r.role || r.name || r.roleName || '',
        permission: r.permission || r.access || r.level
      }))
    };
  }
}
