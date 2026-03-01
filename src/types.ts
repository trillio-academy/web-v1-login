export interface LoginCredentials {
  login: string;
  senha: string;
}

export interface User {
  id: number;
  email?: string;
  roles: string[];
  cliente_id?: number;
}
