// Plantillas de los avisos de la US-SIG-031.
// CA5: solo datos necesarios de la cita + link al detalle.
// NO incluir diagnósticos, archivos clínicos, pagos ni resultados médicos.

export type DatosCita = {
  beneficiario: string; // nombre del paciente (puede ser el menor)
  prestacion: string;
  fecha: Date;
  detalleUrl: string; // link al detalle de la cita dentro del sistema
};

export type MensajeEmail = { subject: string; text: string; html: string };

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function formatearFecha(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
}

function layout(titulo: string, cuerpoHtml: string, detalleUrl: string) {
  return `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222">
  <h2 style="color:#0b5ed7">${esc(titulo)}</h2>
  ${cuerpoHtml}
  <p><a href="${esc(detalleUrl)}" style="background:#0b5ed7;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Ver detalle del turno</a></p>
  <hr style="border:none;border-top:1px solid #ddd;margin-top:24px">
  <p style="font-size:12px;color:#777">Sistema de Sala Médica. Este es un aviso automático, no responda a este mensaje.</p>
</div>`;
}

function filaCita(c: DatosCita) {
  return `<ul>
    <li><b>Paciente:</b> ${esc(c.beneficiario)}</li>
    <li><b>Prestación:</b> ${esc(c.prestacion)}</li>
    <li><b>Fecha y hora:</b> ${esc(formatearFecha(c.fecha))}</li>
  </ul>`;
}

function textoCita(c: DatosCita) {
  return `Paciente: ${c.beneficiario}\nPrestación: ${c.prestacion}\nFecha y hora: ${formatearFecha(c.fecha)}`;
}

export function emailConfirmacion(c: DatosCita): MensajeEmail {
  const titulo = "Turno confirmado";
  return {
    subject: `Turno confirmado - ${formatearFecha(c.fecha)}`,
    text: `${titulo}\n\n${textoCita(c)}\n\nVer detalle: ${c.detalleUrl}`,
    html: layout(titulo, `<p>Tu turno fue confirmado.</p>${filaCita(c)}`, c.detalleUrl),
  };
}

export function emailCancelacion(c: DatosCita): MensajeEmail {
  const titulo = "Turno cancelado";
  return {
    subject: `Turno cancelado - ${formatearFecha(c.fecha)}`,
    text: `${titulo}\n\n${textoCita(c)}\n\nVer detalle: ${c.detalleUrl}`,
    html: layout(titulo, `<p>El siguiente turno fue cancelado.</p>${filaCita(c)}`, c.detalleUrl),
  };
}

// CA2: la jornada fue suspendida. NO es una cancelación ni hay nuevo horario todavía.
export function emailSuspension(c: DatosCita): MensajeEmail {
  const titulo = "Tu atención está afectada";
  return {
    subject: `Jornada suspendida: tu turno requiere gestión - ${formatearFecha(c.fecha)}`,
    text:
      `${titulo}\n\nLa jornada médica fue suspendida y tu turno requiere resolución. ` +
      `Todavía no hay un nuevo horario asignado.\n\n${textoCita(c)}\n\nVer detalle: ${c.detalleUrl}`,
    html: layout(
      titulo,
      `<p>La jornada médica fue <b>suspendida</b> y tu turno <b>requiere resolución</b>.
       Todavía no se asignó un nuevo horario.</p>${filaCita(c)}`,
      c.detalleUrl,
    ),
  };
}

// CA3: reprogramación = cancelación del turno anterior + confirmación del nuevo.
// Se envían como dos mails (uno por evento), cada uno con su fecha.
