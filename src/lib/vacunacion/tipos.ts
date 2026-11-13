/**
 * Datos serializables del catálogo de vacunas para enviar a componentes cliente.
 * Los identificadores viajan como string para no exponer BigInt al cliente.
 */
export type LoteStock = {
  id: string;
  codigo: string;
  fechaVencimiento: string;
  dosisDisponibles: number;
};

export type VacunaStock = {
  id: string;
  nombre: string;
  descripcion: string | null;
  umbralMinimo: number;
  activa: boolean;
  dosisDisponibles: number;
  lotes: LoteStock[];
};
