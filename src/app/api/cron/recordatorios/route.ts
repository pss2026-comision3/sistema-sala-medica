import { NextResponse } from "next/server";

import { procesarRecordatorios } from "@/lib/agenda/procesar-recordatorios";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    console.error("[CRON Recordatorios] Falta CRON_SECRET en el entorno.");
    return NextResponse.json(
      { error: "Configuración incompleta" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    await procesarRecordatorios();
    return NextResponse.json({
      exito: true,
      mensaje: "Recordatorios procesados",
    });
  } catch (error) {
    console.error("Fallo cron recordatorios:", error);
    return NextResponse.json(
      { error: "Error procesando recordatorios" },
      { status: 500 },
    );
  }
}
