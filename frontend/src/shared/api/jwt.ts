import { jwtDecode } from 'jwt-decode';
import type { User } from '../types';

export interface JwtClaims {
  sub?: string;
  id?: string;
  email?: string;
  name?: string;
  role?: User['role'];
  [key: string]: unknown;
}

export function decodeUserFromToken(token: string): User | null {
  try {
    const claims = jwtDecode<JwtClaims>(token);
    const email = claims.email ?? '';
    const id = claims.sub ?? claims.id ?? email ?? 'user';
    const name = claims.name ?? (email ? email.split('@')[0] : 'User');
    const role = claims.role ?? 'client';

    if (!id || !name) return null;

    return { id, email, name, role };
  } catch {
    return null;
  }
}
