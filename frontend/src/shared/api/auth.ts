import { apiRequest } from './client';
import type { ApiUser, LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from './types';

export async function loginRequest(payload: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    data: payload,
  });
}

export async function registerRequest(payload: RegisterRequest): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    data: payload,
  });
}

export function toApiUser(user: RegisterResponse | ApiUser): ApiUser {
  return user;
}
