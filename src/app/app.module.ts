import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { JwtInterceptor } from './core/interceptors/jwt.interceptor';
import { NgModule } from '@angular/core';

@NgModule({
  // ... otras configuraciones ...
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true }
  ],
  // ...
})
export class AppModule { }