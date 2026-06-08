/**
 * Modelos del Repositorio Documental.
 * Soporta documentos asociados a una instancia de trámite o a una política.
 */

/** Un documento listado en el repositorio de una instancia/política. */
export interface RepositoryDocument {
  id: string;
  /** Nombre visible del archivo (originalName/fileName). */
  name: string;
  /** Categoría/tipo legible (PDF, Word, Excel, Imagen, etc.) o extensión. */
  type?: string;
  /** MIME type real reportado por el backend, si está disponible. */
  mimeType?: string;
  /** Nombre/etiqueta de la tarea asociada (nodeLabel). */
  taskName?: string;
  /** Usuario que subió el documento. */
  uploadedBy?: string;
  /** Fecha de subida (ISO string). */
  uploadedAt?: string;
  /** Estado documental (p.ej. PENDING, SIGNED, APPROVED). */
  status?: string;
  /** URL de descarga/acceso. */
  url?: string;
  instanceId?: string;
  policyId?: string;
}

/** Payload para asociar un documento ya subido a una instancia/política. */
export interface AttachDocumentDto {
  instanceId?: string;
  policyId?: string;
  /** Tarea/nodo al que pertenece el documento. */
  taskId?: string;
  /** URL devuelta por el endpoint de upload. */
  fileUrl: string;
  /** Nombre original del archivo. */
  fileName: string;
  /** MIME type del archivo subido. */
  mimeType?: string;
  /** Categoría/tipo legible. */
  type?: string;
}

/** Permiso de un usuario sobre un documento. */
export interface DocumentUserPermission {
  userId: string;
  username?: string;
  permission?: string;
}

/** Permiso de un rol sobre un documento. */
export interface DocumentRolePermission {
  role: string;
  permission?: string;
}

/** Respuesta de GET /api/files/{id}/permissions. */
export interface DocumentPermissions {
  users: DocumentUserPermission[];
  roles: DocumentRolePermission[];
}

/** Payload para otorgar acceso a un usuario. */
export interface GrantUserDto {
  userId: string;
  permission?: string;
}

/** Payload para otorgar acceso a un rol. */
export interface GrantRoleDto {
  role: string;
  permission?: string;
}

/** Categorías de filtro disponibles en el visor del repositorio. */
export type DocumentFilter = 'ALL' | 'PDF' | 'WORD' | 'EXCEL' | 'IMAGE' | 'SIGNED';

export interface DocumentFilterOption {
  value: DocumentFilter;
  label: string;
}

export const DOCUMENT_FILTERS: DocumentFilterOption[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PDF', label: 'PDF' },
  { value: 'WORD', label: 'Word' },
  { value: 'EXCEL', label: 'Excel' },
  { value: 'IMAGE', label: 'Imagen' },
  { value: 'SIGNED', label: 'Firmados' }
];
