import { NextResponse } from "next/server";
import { procesarRecordatorios } from "@/lib/agenda/procesar-recordatorios";

export async function GET(request: Request) {
  // 1. Validar que la petición venga de Vercel usando la variable de entorno secreta
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2. Si la clave secreta es correcta, procesar los turnos
  try {
    await procesarRecordatorios();
    return NextResponse.json({ exito: true, mensaje: "Recordatorios procesados" });
  } catch (error) {
    console.error("Fallo cron recordatorios:", error);
    return NextResponse.json({ error: "Error procesando recordatorios" }, { status: 500 });
  }
}