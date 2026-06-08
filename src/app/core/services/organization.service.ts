import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { User } from '../models/user.model';
import { environment } from 'src/environments/environment';

export interface UserFilters {
  role?: string;
  departmentId?: string;
}

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

  /** POST /api/departments — crea un departamento nuevo (requiere rol ADMIN) */
  createDepartment(data: { name: string; description?: string }): Observable<any> {
    return this.api.post<any>('/api/departments', data);
  }

  /** PUT /api/departments/{id} */
  updateDepartment(id: string, data: { name: string; description?: string }): Observable<any> {
    return this.api.put<any>(`/api/departments/${id}`, data);
  }
  /** PUT /api/departments/{id}/users/{userId} */
  updateUserDepartmentId(departmentId: string, userId: string): Observable<any> {
    return this.api.put<any>(`/users/${userId}/department`, { departmentId });
  }
  /** DELETE /api/departments/{id} — soft delete en backend */
  deleteDepartment(id: string): Observable<any> {
    return this.api.delete<any>(`/api/departments/${id}`);
  }
  /**
   * PUT /users/{userId}/department
   * Altera de forma segura la propiedad de asignación de área en MongoDB.
   */
  updateUserDepartment(userId: string, departmentId: string): Observable<any> {
    const url = `/users/${userId}/department`;
    const body = { departmentId: departmentId };
    
    return this.api.put<any>(url, body);
  }
  /**
   * GET /users  (sin /api — contrato Swagger)
   * Filtros opcionales: role, departmentId.
   * Normaliza respuesta plana o paginada de Spring.
   */
  getUsers(filters?: UserFilters | string): Observable<any[]> {
    const f: UserFilters = typeof filters === 'string' ? { role: filters } : (filters ?? {});
    const params = new URLSearchParams();
    if (f.role) params.set('role', f.role);
    if (f.departmentId) params.set('departmentId', f.departmentId);
    const qs = params.toString();
    const path = qs ? `/users?${qs}` : '/users';
    return this.api.get<any>(path).pipe(
      map(res => this.toArray(res))
    );
  }

  /** GET /users/{id} */
  getUserById(id: string): Observable<any> {
    return this.api.get<any>(`/users/${id}`);
  }

  /** POST /users */
  createUser(dto: User): Observable<any> {
    return this.api.post<any>('/users', dto);
  }

  /** DELETE /users/{id} — compañero REST de GET /users/{id} */
  deleteUser(id: string): Observable<any> {
    return this.api.delete<any>(`/users/${id}`);
  }

  /** GET /users?role=FUNCIONARIO — funcionarios/empleados */
  getFuncionarios(): Observable<any[]> {
    return this.getUsers({ role: 'FUNCIONARIO' });
  }

  /** GET /users?role=CLIENT — clientes */
  getClients(): Observable<any[]> {
    return this.getUsers({ role: 'CLIENT' });
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
