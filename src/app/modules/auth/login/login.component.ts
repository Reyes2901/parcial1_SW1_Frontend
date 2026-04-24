import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    MatFormFieldModule
  ],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h1>WBS-IA</h1>
        <h2>Iniciar sesión</h2>
        
        <form [formGroup]="form" (ngSubmit)="login()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Usuario</mat-label>
            <input matInput formControlName="email" placeholder="Ingrese su usuario" type="text">
            @if (form.get('email')?.invalid && form.get('email')?.touched) {
              <mat-error>Usuario requerido</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Contraseña</mat-label>
            <input matInput formControlName="password" placeholder="Ingrese su contraseña" type="password">
            @if (form.get('password')?.invalid && form.get('password')?.touched) {
              <mat-error>Contraseña requerida</mat-error>
            }
          </mat-form-field>

          <button mat-raised-button color="primary" type="submit" 
                  [disabled]="form.invalid || loading" class="full-width">
            {{ loading ? 'Ingresando...' : 'Ingresar' }}
          </button>

          @if (error) {
            <div class="error-message">{{ error }}</div>
          }
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .login-card {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 400px;
    }
    h1 { text-align: center; color: #3f51b5; margin-bottom: 0.5rem; }
    h2 { text-align: center; color: #666; font-weight: 300; margin-bottom: 2rem; }
    .full-width { width: 100%; margin-bottom: 1rem; }
    .error-message {
      color: #f44336; text-align: center; margin-top: 1rem;
      padding: 0.5rem; background: #ffebee; border-radius: 4px;
    }
  `]
})
export class LoginComponent {
  form: FormGroup;
  loading = false;
  error = '';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required]],
      password: ['', Validators.required]
    });
  }

  login(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const { email, password } = this.form.value;

    this.auth.login(email!, password!).subscribe({
      next: () => {
        this.auth.hasRole('ADMIN') 
          ? this.router.navigate(['/dashboard'])
          : this.router.navigate(['/tasks']);
      },
      error: (err) => {
        this.error = err?.error?.message || 'Credenciales incorrectas';
        this.loading = false;
      }
    });
  }
}