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
          <mat-form-field appearance="outline" class="full-width custom-inputs">
            <mat-label>Correo Electrónico</mat-label>
            <input matInput formControlName="email" placeholder="Ingrese su correo" type="text" autocomplete="username">
            @if (form.get('email')?.invalid && form.get('email')?.touched) {
              <mat-error>El correo es requerido</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width custom-inputs">
            <mat-label>Contraseña</mat-label>
            <input matInput formControlName="password" placeholder="Ingrese su contraseña" type="password" autocomplete="current-password">
            @if (form.get('password')?.invalid && form.get('password')?.touched) {
              <mat-error>Contraseña requerida</mat-error>
            }
          </mat-form-field>

          <button mat-flat-button type="submit" 
                  [disabled]="form.invalid || loading" class="full-width login-btn">
            {{ loading ? 'Ingresando...' : 'Login' }}
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
      background-color: #2e7d32;
    }
    .login-card {
      background: white;
      padding: 2.5rem 2rem;
      border-radius: 20px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      width: 100%;
      max-width: 400px;
    }
    h1 { text-align: center; color: #2e7d32; margin-bottom: 0.5rem; font-weight: bold; }
    h2 { text-align: center; color: #555; font-weight: 300; margin-bottom: 2rem; font-size: 1.2rem; }
    .full-width { width: 100%; margin-bottom: 1.2rem; }
    
    /* Botón con bordes redondeados al 10% */
    .login-btn {
      background-color: #2e7d32 !important;
      color: white !important;
      padding: 1.5rem 0 !important;
      font-size: 1rem;
      font-weight: bold;
      border-radius: 25px !important;
    }
    .login-btn[disabled] {
      background-color: #cccccc !important;
      color: #666666 !important;
    }
    
    /* Inputs con bordes redondeados al 10% */
    ::ng-deep .custom-inputs .mat-mdc-text-field-wrapper {
      border-radius: 25px !important;
    }
    ::ng-deep .custom-inputs .mdc-notched-outline-leading {
      border-radius: 25px 0 0 25px !important;
      width: 20px !important;
    }
    ::ng-deep .custom-inputs .mdc-notched-outline-trailing {
      border-radius: 0 25px 25px 0 !important;
    }
    
    ::ng-deep .mat-form-field-appearance-outline.mat-focused .mdc-notched-outline__border {
      border-color: #2e7d32 !important;
      border-width: 2px !important;
    }
    ::ng-deep .mat-form-field-appearance-outline.mat-focused .mat-mdc-form-field-label {
      color: #2e7d32 !important;
    }

    .error-message {
      color: #d32f2f; text-align: center; margin-top: 1rem;
      padding: 0.6rem; background: #ffebee; border-radius: 8px;
      font-size: 0.9rem; border: 1px solid #ffcdd2;
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
    
    // Enviamos el objeto completo del formulario al servicio
    this.auth.login(this.form.value.email, this.form.value.password).subscribe({
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