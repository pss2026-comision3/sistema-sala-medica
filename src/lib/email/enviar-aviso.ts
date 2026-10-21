import { mailer, MAIL_FROM } from "./mailer";
import type { MensajeEmail } from "./templates";

export type ResultadoEmail = {
  estado: "ENVIADO" | "FALLIDO" | "OMITIDO";
  intento: 1 | 2;
  error?: string;
};

type Params = {
  destinatario: string;
  mensaje: MensajeEmail;
  /**
   * CA6: se llama justo antes del reintento (5 min después).
   * Debe devolver el email del destinatario vigente, o null si el evento
   * ya no es vigente (ej: la cita ya fue cancelada) y no hay que reenviar.
   */
  verificarVigencia: () => Promise<{ destinatario: string } | null>;
  /** Guarda en BD el resultado (enviado / fallido / omitido). */
  registrarResultado: (r: ResultadoEmail) => Promise<void>;
};

// Para la demo podés poner EMAIL_RETRY_DELAY_MS=10000 y ver el reintento en 10 s.
const RETRY_DELAY_MS = Number(process.env.EMAIL_RETRY_DELAY_MS ?? 5 * 60 * 1000);

async function enviar(to: string, m: MensajeEmail) {
  await mailer.sendMail({
    from: MAIL_FROM,
    to,
    subject: m.subject,
    text: m.text,
    html: m.html,
  });
}

/**
 * Envía el email SIN lanzar nunca una excepción hacia afuera (CA6):
 * un fallo de mail no debe revertir la operación original.
 * Llamala sin `await` desde la operación principal (fire-and-forget),
 * y siempre DESPUÉS de haber confirmado la transacción de BD.
 */
export async function enviarAvisoEmail(p: Params): Promise<void> {
  try {
    await enviar(p.destinatario, p.mensaje);
    await safe(() => p.registrarResultado({ estado: "ENVIADO", intento: 1 }));
  } catch (e) {
    console.error("[email] fallo intento 1:", e);
    await safe(() =>
      p.registrarResultado({ estado: "FALLIDO", intento: 1, error: msg(e) }),
    );
    programarReintento(p);
  }
}

function programarReintento(p: Params) {
  setTimeout(async () => {
    try {
      const vigente = await p.verificarVigencia();
      if (!vigente) {
        await safe(() =>
          p.registrarResultado({
            estado: "OMITIDO",
            intento: 2,
            error: "Evento ya no vigente o sin destinatario",
          }),
        );
        return;
      }
      await enviar(vigente.destinatario, p.mensaje);
      await safe(() => p.registrarResultado({ estado: "ENVIADO", intento: 2 }));
    } catch (e) {
      console.error("[email] fallo intento 2 (definitivo):", e);
      await safe(() =>
        p.registrarResultado({ estado: "FALLIDO", intento: 2, error: msg(e) }),
      );
    }
  }, RETRY_DELAY_MS);
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
async function safe(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.error("[email] no se pudo registrar el resultado:", e);
  }
}
