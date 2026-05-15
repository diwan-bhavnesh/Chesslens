import { api } from "./api";
import type { TokenPair, User } from "../types";

export async function loginWithPassword(email: string, password: string): Promise<TokenPair> {
  const { data } = await api.post<TokenPair>("/auth/login", { email, password });
  return data;
}

export async function register(email: string, password: string, full_name?: string): Promise<User> {
  const { data } = await api.post<User>("/auth/register", { email, password, full_name });
  return data;
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>("/users/me");
  return data;
}

export function saveTokens(pair: TokenPair) {
  localStorage.setItem("access_token", pair.access_token);
  localStorage.setItem("refresh_token", pair.refresh_token);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function getGoogleOAuthUrl(): string {
  return `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"}/auth/google`;
}
