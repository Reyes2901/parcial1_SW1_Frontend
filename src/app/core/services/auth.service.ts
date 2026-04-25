import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser$ = new BehaviorSubject<any>(null);

  constructor(private http: HttpClient, private router: Router) {
    const token = localStorage.getItem('jwt');
    if (token) this.decodeAndSetUser(token);
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/login`, { 
        username: email,  
        password: password 
    }).pipe(tap((res: any) => {
        localStorage.setItem('jwt', res.token);
        this.decodeAndSetUser(res.token);
    }));
}
  logout(): void {
    localStorage.removeItem('jwt');
    this.currentUser$.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('token') 
        || localStorage.getItem('jwt')
        || sessionStorage.getItem('token');
  }

  getCurrentUser(): Observable<any> {
    return this.currentUser$.asObservable();
  }

  hasRole(role: string): boolean {
    const user = this.currentUser$.getValue();
    return user?.roles?.includes(role) ?? false;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  private decodeAndSetUser(token: string): void {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.currentUser$.next(payload);
    } catch {
      this.logout();
    }
  }
}