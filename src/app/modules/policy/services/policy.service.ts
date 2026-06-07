import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class PolicyService {
  constructor(private api: ApiService) {}

  getAll(): Observable<any[]> {
    return this.api.get('/api/policies');
  }

  getActive(): Observable<any[]> {
    return this.api.get('/api/policies/active');
  }

  getMyDrafts(): Observable<any[]> {
    return this.api.get('/api/policies/my-drafts');
  }

  getMyPolicies(): Observable<any[]> {
    return this.api.get('/api/policies/my-policies');
  }

  getById(id: string): Observable<any> {
    return this.api.get(`/api/policies/${id}`);
  }

  create(policy: any): Observable<any> {
    return this.api.post('/api/policies', policy);
  }

  update(id: string, policy: any): Observable<any> {
    return this.api.put(`/api/policies/${id}`, policy);
  }

  publish(id: string): Observable<any> {
    return this.api.post(`/api/policies/${id}/publish`, {});
  }

  generateWithAI(prompt: string, existingLanes?: string[]): Observable<any> {
    return this.api.post('/api/policies/ai/generate', {
      prompt,
      language: 'es',
      existingLanes: existingLanes || [],
      include_forms: true
    });
  }

  refineWithAI(prompt: string, currentDiagram: any): Observable<any> {
    return this.api.post('/api/policies/ai/refine', { prompt, currentDiagram, language: 'es' });
  }

  archive(id: string): Observable<any> {
    return this.api.post(`/api/policies/${id}/archive`, {});
  }

  delete(id: string): Observable<any> {
    return this.api.delete(`/api/policies/${id}`);
  }
}