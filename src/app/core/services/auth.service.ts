import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser$ = new BehaviorSubject<any>(null);

  constructor(private http: HttpClient, private router: Router) {
    const token = this.getToken();
    if (token) this.decodeAndSetUser(token);
  }

  login(email: string, password: string): Observable<any> {
    // CORRECCIÓN: Se cambia 'username' por 'email' para emparejar el DTO del backend
    return this.http.post(`${environment.apiUrl}/auth/login`, { 
        email: email,  
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
    return localStorage.getItem('jwt')
        || sessionStorage.getItem('token')
        || localStorage.getItem('token');
  }

  getCurrentUser(): Observable<any> {
    return this.currentUser$.asObservable();
  }

  hasRole(role: string): boolean {
    const user = this.currentUser$.getValue();
    console.log('🔍 Verificando rol:', role, 'Usuario:', user);
    if (user?.role === role) return true;
    if (user?.roles?.includes(role)) return true;
    return false;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  private decodeAndSetUser(token: string): void {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('✅ JWT decodificado:', payload);
        
        if (payload.role && !payload.roles) {
            payload.roles = [payload.role];
        }
        
        this.currentUser$.next(payload);
    } catch {
        this.logout();
    }
  }
}