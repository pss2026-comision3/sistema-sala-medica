import { createHash } from "node:crypto";

/** Compara el resultado mostrado con el recalculado al solicitar la descarga. */
export function huellaReporte(resultado: unknown): string {
  return createHash("sha256").update(JSON.stringify(resultado)).digest("hex");
}
