import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  constructor(private api: ApiService) {}

  /** GET /api/departments — fuente canónica de departamentos */
  getDepartments(): Observable<any[]> {
    return this.api.get<any>('/api/departments').pipe(
      map(res => this.toArray(res))
    );
  }

  /** GET /api/departments/{id}/users */
  getDepartmentUsers(id: string): Observable<any[]> {
    return this.api.get<any>(`/api/departments/${id}/users`).pipe(
      map(res => this.toArray(res))
    );
  }

  /**
   * GET /users  (sin /api — contrato Swagger)
   * Acepta filtro opcional por rol para reducir tráfico.
   * Normaliza respuesta plana o paginada de Spring.
   */
  getUsers(role?: string): Observable<any[]> {
    const path = role ? `/users?role=${encodeURIComponent(role)}` : '/users';
    return this.api.get<any>(path).pipe(
      map(res => this.toArray(res))
    );
  }

  /** GET /users?role=FUNCIONARIO — funcionarios/empleados */
  getFuncionarios(): Observable<any[]> {
    return this.getUsers('FUNCIONARIO');
  }

  /** GET /users?role=CLIENT — clientes */
  getClients(): Observable<any[]> {
    return this.getUsers('CLIENT');
  }

  /** POST /api/departments — crea un departamento nuevo (requiere rol ADMIN) */
  createDepartment(data: { name: string; description?: string }): Observable<any> {
    return this.api.post<any>('/api/departments', data);
  }

  getDepartmentsFromUsers(): Observable<string[]> {
    return this.getUsers().pipe(
      map(users => {
        const depts = new Set<string>();
        users.forEach(u => {
          if (u.department) depts.add(u.department);
          if (u.departmentId) depts.add(u.departmentId);
        });
        return Array.from(depts).filter(Boolean);
      })
    );
  }

  /**
   * Normaliza una respuesta del backend a un array plano.
   * Maneja: array directo, Spring Page ({ content: [] }),
   * o wrapper genérico ({ data: [] }).
   */
  private toArray(res: any): any[] {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.content)) return res.content;
    if (Array.isArray(res.data)) return res.data;
    return [];
  }
}
