import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class PolicyService {
  constructor(private api: ApiService) {}

  getAll(): Observable<any[]> {
    return this.api.get('/policies');
  }

  getById(id: string): Observable<any> {
    return this.api.get(`/policies/${id}`);
  }

  create(policy: any): Observable<any> {
    return this.api.post('/policies', policy);
  }

  update(id: string, policy: any): Observable<any> {
    return this.api.put(`/policies/${id}`, policy);
  }

  publish(id: string): Observable<any> {
    return this.api.post(`/policies/${id}/publish`, {});
  }

  generateWithAI(prompt: string): Observable<any> {
    return this.api.post('/policies/ai/generate', { prompt, language: 'es' });
  }

  getDrafts(): Observable<any[]> {
    return this.api.get('/policies/my-drafts');
  }

  getActive(): Observable<any[]> {
    return this.api.get('/policies/active');
  }
}