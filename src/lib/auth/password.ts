import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generarClaveTemporal(): string {
  const bytes = randomBytes(6).toString("base64url");
  return `Tmp${bytes}`.slice(0, 10);
}

export async function hashearPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verificarPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const HASH_DUMMY =
  "$2b$10$OnSHSwbNAFJXd/DmizK7..nuILJyCdNah9UPT6gne/Pa9P/1hFhkW";
