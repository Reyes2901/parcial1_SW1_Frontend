import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class TaskService {
  constructor(private api: ApiService) {}

  getMyTasks(): Observable<any[]> {
    return this.api.get('/workflow/tasks/my-tasks');
  }

  getForm(taskId: string): Observable<any> {
    return this.api.get(`/tasks/${taskId}/form`);
  }

  startTask(taskId: string): Observable<any> {
    return this.api.post(`/workflow/tasks/${taskId}/start`, {});
  }

  completeTask(id: string, data: any): Observable<any> {
    return this.api.post(`/workflow/tasks/${id}/complete`, data);
  }

  submitForm(id: string, data: any): Observable<any> {
    return this.api.post(`/tasks/${id}/form`, data);
  }

  saveDraft(id: string, data: any): Observable<any> {
    return this.api.put(`/tasks/${id}/form/save-draft`, data);
  }

  rejectTask(id: string, motivo: string): Observable<any> {
    return this.api.post(`/workflow/tasks/${id}/reject`, { motivo });
  }
}