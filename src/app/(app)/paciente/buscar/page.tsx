import { requireRole } from "@/lib/auth/guards";
import {
  buscarHorariosDia,
  cargarBeneficiarios,
  cargarCatalogoMedico,
  fechaIsoValida,
  hoySala,
  listarFechasAtencion,
  type FiltrosHorarios,
} from "@/lib/turnos/buscar-horarios";
import { BuscarForm } from "./buscar-form";
import styles from "./buscar.module.css";

type Parametros = Record<string, string | string[] | undefined>;
const leer = (params: Parametros, clave: string) =>
  typeof params[clave] === "string" ? (params[clave] as string) : "";

function fechaLegible(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

function diaSemana(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

function enlace(filtros: FiltrosHorarios, extra: Record<string, string>) {
  const params = new URLSearchParams();
  params.set("buscar", "1");
  params.set("beneficiario", filtros.beneficiario ?? "");
  params.set("especialidad", filtros.especialidad ?? "");
  if (filtros.medico) params.set("medico", filtros.medico);
  params.set("fecha", filtros.fecha ?? "");
  for (const [clave, valor] of Object.entries(extra)) params.set(clave, valor);
  return `/paciente/buscar?${params.toString()}`;
}

export default async function PacienteBuscarPage({
  searchParams,
}: {
  searchParams: Promise<Parametros>;
}) {
  const sesion = await requireRole("PACIENTE");
  const params = await searchParams;
  const ahora = new Date();
  const hoy = hoySala(ahora);
  const [beneficiarios, catalogo] = await Promise.all([
    cargarBeneficiarios(BigInt(sesion.usuarioId), ahora),
    cargarCatalogoMedico(),
  ]);
  const filtros: FiltrosHorarios = {
    beneficiario: leer(params, "beneficiario"),
    especialidad: leer(params, "especialidad"),
    medico: leer(params, "medico"),
    fecha: leer(params, "fecha") || hoy,
  };
  const busco = leer(params, "buscar") === "1";
  const beneficiario = beneficiarios.find((b) => b.id === filtros.beneficiario);
  const especialidad = catalogo.find((e) => e.id === filtros.especialidad);
  const medico = especialidad?.medicos.find((m) => m.id === filtros.medico);
  let error = "";
  let fechas: string[] = [];
  let dia = "";
  let resultado: Awaited<ReturnType<typeof buscarHorariosDia>> | null = null;

  if (busco) {
    if (!beneficiario) error = "Seleccioná un beneficiario válido para buscar.";
    else if (!especialidad) error = "Seleccioná una especialidad válida.";
    else if (filtros.medico && !medico)
      error = "El profesional no pertenece a la especialidad elegida.";
    else if (
      !fechaIsoValida(filtros.fecha ?? "") ||
      (filtros.fecha ?? "") < hoy
    )
      error = "Seleccioná una fecha válida desde hoy.";
    else {
      const fechaMinima = hoySala(new Date(ahora.getTime() + 86_400_000));
      const desde =
        (filtros.fecha ?? hoy) > fechaMinima ? filtros.fecha! : fechaMinima;
      fechas = await listarFechasAtencion(
        BigInt(especialidad.id),
        medico ? BigInt(medico.id) : null,
        desde,
      );
      const diaSolicitado = leer(params, "dia");
      if (fechas.includes(diaSolicitado)) {
        dia = diaSolicitado;
        resultado = await buscarHorariosDia(
          BigInt(beneficiario.id),
          BigInt(especialidad.id),
          medico ? BigInt(medico.id) : null,
          dia,
          ahora,
        );
      }
    }
  }

  const horarios = resultado?.horarios ?? [];
  const horarioElegido = horarios.find(
    (h) => h.clave === leer(params, "horario") && !h.superpuesto,
  );

  return (
    <div className={styles.pagina}>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Buscar un turno médico</h1>
          <p>
            Filtrá por especialidad, profesional y fecha. La reserva se confirma
            en el siguiente paso.
          </p>
        </div>
      </div>
      <div className={styles.pasos} aria-label="Pasos de la reserva">
        <span className={styles.pasoActivo}>1 · Elegir horario</span>
        <span className={styles.paso}>2 · Confirmar</span>
      </div>
      <section
        className={`sigsam-card ${styles.filtros}`}
        aria-labelledby="titulo-filtros"
      >
        <h2 id="titulo-filtros">Encontrá una consulta</h2>
        {beneficiarios.length ? (
          <BuscarForm
            key={`${filtros.beneficiario}:${filtros.especialidad}:${filtros.medico}:${filtros.fecha}`}
            beneficiarios={beneficiarios}
            catalogo={catalogo}
            filtros={filtros}
            hoy={hoy}
          />
        ) : (
          <p className="sigsam-muted">
            Tu cuenta no tiene un paciente titular ni menores vinculados para
            buscar turnos.
          </p>
        )}
      </section>
      {error && (
        <div className="sigsam-alert-error" role="alert">
          {error}
        </div>
      )}
      {busco && !error && (
        <>
          <section aria-labelledby="titulo-fechas">
            <div className="sigsam-section-head">
              <h2 id="titulo-fechas">Fechas con atención</h2>
            </div>
            {fechas.length ? (
              <div className={`sigsam-card ${styles.fechas}`}>
                {fechas.map((fecha) => (
                  <a
                    key={fecha}
                    href={enlace(filtros, { dia: fecha })}
                    className={`${styles.fecha} ${fecha === dia ? styles.fechaActiva : ""}`}
                    aria-current={fecha === dia ? "date" : undefined}
                  >
                    <strong>
                      {fecha.slice(8)}/{fecha.slice(5, 7)}
                    </strong>
                    <span>{diaSemana(fecha)}</span>
                    <small>Ver horarios</small>
                  </a>
                ))}
              </div>
            ) : (
              <div className="sigsam-empty">
                <p>
                  No hay fechas con atención para estos filtros en los próximos
                  60 días. Cambiá la especialidad, el profesional o la fecha y
                  volvé a buscar.
                </p>
              </div>
            )}
          </section>
          {dia && resultado && (
            <section aria-labelledby="titulo-horarios">
              <div className="sigsam-section-head">
                <h2 id="titulo-horarios">Horarios del {fechaLegible(dia)}</h2>
              </div>
              {resultado.citaMismaEspecialidad && (
                <div className="sigsam-notice warning" role="status">
                  <span className="sigsam-notice-symbol" aria-hidden="true">
                    !
                  </span>
                  <div>
                    <strong>Ya hay una cita futura de esta especialidad</strong>
                    <p>
                      Revisá los turnos de {beneficiario?.nombre} antes de
                      elegir otro horario.
                    </p>
                  </div>
                </div>
              )}
              {horarios.length ? (
                <div className={`sigsam-card ${styles.horarios}`}>
                  <div className={styles.grillaHorarios}>
                    {horarios.map((horario) =>
                      horario.superpuesto ? (
                        <div
                          key={horario.clave}
                          className={`${styles.horario} ${styles.superpuesto}`}
                          aria-disabled="true"
                        >
                          <strong>{horario.hora}</strong>
                          <small>Se superpone con otra atención</small>
                        </div>
                      ) : (
                        <a
                          key={horario.clave}
                          href={enlace(filtros, {
                            dia,
                            horario: horario.clave,
                          })}
                          className={`${styles.horario} ${horarioElegido?.clave === horario.clave ? styles.horarioActivo : ""}`}
                          aria-current={
                            horarioElegido?.clave === horario.clave
                              ? "true"
                              : undefined
                          }
                        >
                          <strong>{horario.hora}</strong>
                          <small>
                            {horario.medico} · {horario.especialidad}
                          </small>
                          <small>
                            {fechaLegible(horario.fecha)} ·{" "}
                            {horario.duracionMin} min
                          </small>
                          <small>
                            Arancel particular: $
                            {Number(horario.arancel).toLocaleString("es-AR")}
                          </small>
                        </a>
                      ),
                    )}
                  </div>
                  <p className={styles.avisoCupo}>
                    Los horarios pueden cambiar. Visualizar o elegir uno no
                    garantiza el cupo.
                  </p>
                </div>
              ) : (
                <div className="sigsam-empty">
                  <p>
                    No hay horarios libres para este día que cumplan las 24
                    horas de anticipación. Elegí otra fecha o cambiá los
                    filtros.
                  </p>
                </div>
              )}
              {horarioElegido && (
                <div className={`sigsam-card ${styles.resumen}`} role="status">
                  <h3>Horario elegido</h3>
                  <p>
                    <strong>Beneficiario:</strong> {beneficiario?.nombre}
                  </p>
                  <p>
                    <strong>Médico:</strong> {horarioElegido.medico}
                  </p>
                  <p>
                    <strong>Especialidad:</strong> {horarioElegido.especialidad}
                  </p>
                  <p>
                    <strong>Fecha e inicio:</strong>{" "}
                    {fechaLegible(horarioElegido.fecha)} a las{" "}
                    {horarioElegido.hora}
                  </p>
                  <p>
                    <strong>Duración:</strong> {horarioElegido.duracionMin}{" "}
                    minutos
                  </p>
                  <p>
                    <strong>Arancel particular:</strong> $
                    {Number(horarioElegido.arancel).toLocaleString("es-AR")}
                  </p>
                  <small>La selección no reserva el turno.</small>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
