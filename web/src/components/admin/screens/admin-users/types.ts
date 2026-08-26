export interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  permissions: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminForm {
  name: string;
  email: string;
  password?: string;
  role: string;
  permissions: string[];
}
