"use client";

import { useEffect, useRef, useState } from "react";
import type { FiltrosHorarios } from "@/lib/turnos/buscar-horarios";
import { BuscarForm } from "./buscar-form";
import type {
  Beneficiarios,
  Catalogo,
  DatosBusqueda,
} from "./consultar-busqueda";
import { ResultadosBusqueda } from "./resultados-busqueda";
import { ResultadosSkeleton } from "./resultados-skeleton";

export function BusquedaInteractiva({
  beneficiarios,
  catalogo,
  filtros,
  hoy,
  fechaMaxima,
  datosIniciales,
  diaInicial,
  horarioInicial,
}: {
  beneficiarios: Beneficiarios;
  catalogo: Catalogo;
  filtros: FiltrosHorarios;
  hoy: string;
  fechaMaxima: string;
  datosIniciales: DatosBusqueda | null;
  diaInicial: string;
  horarioInicial: string;
}) {
  const [datos, setDatos] = useState(datosIniciales);
  const [buscando, setBuscando] = useState(false);
  const [errorSolicitud, setErrorSolicitud] = useState("");
  const [version, setVersion] = useState(0);
  const solicitud = useRef<AbortController | null>(null);

  useEffect(() => () => solicitud.current?.abort(), []);

  function cambiarFiltros() {
    solicitud.current?.abort();
    solicitud.current = null;
    setBuscando(false);
    setDatos(null);
    setErrorSolicitud("");
    window.history.replaceState(null, "", "/paciente/buscar");
  }

  async function buscar(formulario: FormData) {
    solicitud.current?.abort();
    const controlador = new AbortController();
    solicitud.current = controlador;
    const params = new URLSearchParams();
    for (const [clave, valor] of formulario) {
      if (typeof valor === "string") params.set(clave, valor);
    }
    setBuscando(true);
    setDatos(null);
    setErrorSolicitud("");

    try {
      const respuesta = await fetch(
        `/api/paciente/buscar/resultados?${params}`,
        {
          cache: "no-store",
          signal: controlador.signal,
        },
      );
      if (!respuesta.ok) {
        throw new Error(
          respuesta.status === 401
            ? "Tu sesión venció. Volvé a iniciar sesión para buscar horarios."
            : "No se pudieron cargar los horarios. Intentá de nuevo.",
        );
      }
      const nuevosDatos = (await respuesta.json()) as DatosBusqueda;
      if (controlador.signal.aborted) return;
      setDatos(nuevosDatos);
      setVersion((actual) => actual + 1);
      window.history.replaceState(null, "", `/paciente/buscar?${params}`);
    } catch (error) {
      if (!controlador.signal.aborted) {
        setErrorSolicitud(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los horarios. Intentá de nuevo.",
        );
      }
    } finally {
      if (solicitud.current === controlador) {
        solicitud.current = null;
        setBuscando(false);
      }
    }
  }

  return (
    <>
      <section className="sigsam-card mb-1" aria-labelledby="titulo-filtros">
        <h2 id="titulo-filtros">Encontrá una consulta</h2>
        {beneficiarios.length ? (
          <BuscarForm
            beneficiarios={beneficiarios}
            catalogo={catalogo}
            filtros={filtros}
            hoy={hoy}
            fechaMaxima={fechaMaxima}
            buscando={buscando}
            onBuscar={buscar}
            onCambiarFiltros={cambiarFiltros}
          />
        ) : (
          <p className="sigsam-muted">
            Tu cuenta no tiene un paciente titular ni menores vinculados para
            buscar turnos.
          </p>
        )}
      </section>
      {(datos?.error || errorSolicitud) && (
        <div className="sigsam-alert-error" role="alert">
          {errorSolicitud || datos?.error}
        </div>
      )}
      {buscando ? (
        <ResultadosSkeleton />
      ) : datos?.resultado ? (
        <ResultadosBusqueda
          key={version}
          resultado={datos.resultado}
          beneficiarioNombre={datos.beneficiarioNombre}
          desde={datos.desde}
          hasta={datos.hasta}
          diaInicial={version === 0 ? diaInicial : ""}
          horarioInicial={version === 0 ? horarioInicial : ""}
        />
      ) : null}
    </>
  );
}
