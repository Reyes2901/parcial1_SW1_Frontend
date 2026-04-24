export class User {
}
export interface User {
  id?: string;
  username: string;
  password?: string;
  email?: string;
  role: string;
  departmentId?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  role: string;
}