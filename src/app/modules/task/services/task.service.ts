import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class TaskService {
  constructor(private api: ApiService) {}

  getMyTasks(): Observable<any[]> {
    return this.api.get('/api/workflow/tasks/my-tasks');  // ✅ Ya está bien
  }

  getForm(taskId: string): Observable<any> {
    return this.api.get(`/api/tasks/${taskId}/form`);     // ✅ Ya está bien
  }

  startTask(taskId: string): Observable<any> {
    return this.api.post(`/api/workflow/tasks/${taskId}/start`, {});  // ❌ arreglado
  }

  completeTask(id: string, data: any): Observable<any> {
    return this.api.post(`/api/workflow/tasks/${id}/complete`, data); // ❌ arreglado
  }

  rejectTask(id: string, motivo: string): Observable<any> {
    return this.api.post(`/api/workflow/tasks/${id}/reject`, { motivo }); // ❌ arreglado
  }

  // Estos 2 sí existen en Swagger
  submitForm(id: string, data: any): Observable<any> {
    return this.api.post(`/api/tasks/${id}/form`, data);   // ✅ Ya está bien
  }

  saveDraft(id: string, data: any): Observable<any> {
    return this.api.put(`/api/tasks/${id}/form/save-draft`, data); // ✅ Ya está bien
  }
}