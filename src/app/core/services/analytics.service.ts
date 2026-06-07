import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { DashboardSummary, BottleneckReport } from '../models/analytics.model';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  constructor(private api: ApiService) {}

  /** GET /api/analytics/department-load */
  getDepartmentLoad(): Observable<any[]> {
    return this.api.get<any>('/api/analytics/department-load');
  }

  /** GET /api/analytics/users/{userId}/performance */
  getUserPerformance(userId: string): Observable<any> {
    return this.api.get<any>(`/api/analytics/users/${userId}/performance`);
  }

  /** @deprecated – endpoint removed from Swagger; kept for backwards compat guard */
  getDashboard(): Observable<DashboardSummary> {
    return this.api.get<DashboardSummary>('/api/analytics/department-load');
  }

  /** @deprecated – bottlenecks endpoint removed from Swagger; returns department-load data */
  getBottlenecks(): Observable<BottleneckReport[]> {
    return this.api.get<BottleneckReport[]>('/api/analytics/department-load');
  }

  /** @deprecated – bottlenecks by policy removed from Swagger; returns department-load data */
  getBottlenecksByPolicy(_definitionId: string): Observable<BottleneckReport[]> {
    return this.api.get<BottleneckReport[]>('/api/analytics/department-load');
  }
}
