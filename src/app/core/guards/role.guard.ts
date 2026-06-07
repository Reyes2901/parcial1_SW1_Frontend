import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const expectedRole = route.data['role'];
    if (this.authService.hasRole(expectedRole)) {
      return true;
    }
    // Redirect unauthorized users to their role-appropriate home
    if (this.authService.hasRole('CLIENT') || this.authService.hasRole('CLIENTE')) {
      this.router.navigate(['/workflow/mis-solicitudes']);
    } else if (this.authService.hasRole('FUNCIONARIO') || this.authService.hasRole('EMPLOYEE')) {
      this.router.navigate(['/tasks']);
    } else {
      this.router.navigate(['/login']);
    }
    return false;
  }
}