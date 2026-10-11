"use client"
 
import { useEffect, useState, useActionState } from "react"
import { registrarMenor, buscarTutorPorDni } from "@/app/actions/pacientes"
 
type Props = {
  /** Primera fecha de nacimiento permitida (todavía menor de 18). YYYY-MM-DD */
  fechaMinima: string
  /** Hoy en la sala: no se permiten fechas futuras. YYYY-MM-DD */
  fechaMaxima: string
}
 
export function FormNuevoMenor({ fechaMinima, fechaMaxima }: Props) {
  const [state, formAction, isPending] = useActionState(registrarMenor, null)
  
  // Estados para el buscador del tutor
  const [dniBusqueda, setDniBusqueda] = useState("")
  // DNI del menor: se descartan letras y símbolos mientras se escribe.
  const [dniMenor, setDniMenor] = useState("")
 
  // Al registrar con éxito el formulario se limpia; el DNI es controlado y se limpia acá.
  useEffect(() => {
    if (state?.success) setDniMenor("")
  }, [state])
  const [tutorEncontrado, setTutorEncontrado] = useState<{ id: string; nombreCompleto: string } | null>(null)
  const [errorBuscador, setErrorBuscador] = useState("")
  const [buscando, setBuscando] = useState(false)
 
  const handleBuscarTutor = async () => {
    if (!dniBusqueda) return
    setBuscando(true)
    setErrorBuscador("")
    
    const resultado = await buscarTutorPorDni(dniBusqueda)
    
    if (resultado.success && resultado.tutor) {
      setTutorEncontrado(resultado.tutor)
    } else {
      setTutorEncontrado(null)
      setErrorBuscador(resultado.error || "Tutor no encontrado")
    }
    setBuscando(false)
  }
 
  return (
    <form action={formAction} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      
      {/* SECCIÓN 1: Búsqueda del Tutor */}
      <div className="border-b pb-6">
        <h3 className="text-lg font-semibold mb-4">1. Vincular Tutor</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">DNI del Tutor registrado</label>
            <input 
              type="text" 
              value={dniBusqueda}
              onChange={(e) => setDniBusqueda(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ej: 20123456"
            />
          </div>
          <button 
            type="button"
            onClick={handleBuscarTutor}
            disabled={buscando}
            className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </div>
 
        {errorBuscador && <p className="text-red-500 text-sm mt-2">{errorBuscador}</p>}
        
        {tutorEncontrado && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800 text-sm font-medium">✓ Tutor vinculado: {tutorEncontrado.nombreCompleto}</p>
            {/* Input oculto que envía el ID del tutor al Server Action */}
            <input type="hidden" name="tutorId" value={tutorEncontrado.id} />
          </div>
        )}
      </div>
 
      {/* SECCIÓN 2: Datos del Menor */}
      <div className="pt-2">
        <h3 className="text-lg font-semibold mb-4">2. Datos del Menor</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="menor-nombre" className="block text-sm font-medium text-gray-700 mb-1">Nombre/s *</label>
            <input id="menor-nombre" name="nombre" required type="text" maxLength={120} autoComplete="off" className="w-full border border-gray-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label htmlFor="menor-apellido" className="block text-sm font-medium text-gray-700 mb-1">Apellido/s *</label>
            <input id="menor-apellido" name="apellido" required type="text" maxLength={120} autoComplete="off" className="w-full border border-gray-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label htmlFor="menor-dni" className="block text-sm font-medium text-gray-700 mb-1">DNI del Menor *</label>
            <input
              id="menor-dni"
              name="dni"
              required
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              pattern="\d{6,8}"
              title="Solo números, entre 6 y 8 dígitos."
              value={dniMenor}
              onChange={(e) => setDniMenor(e.target.value.replace(/\D/g, "").slice(0, 8))}
              className="w-full border border-gray-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-gray-500 text-xs mt-1">Solo números, entre 6 y 8 dígitos, sin puntos.</p>
          </div>
          <div>
            <label htmlFor="menor-fecha" className="block text-sm font-medium text-gray-700 mb-1">Fecha de Nacimiento *</label>
            <input id="menor-fecha" name="fechaNacimiento" required type="date" min={fechaMinima} max={fechaMaxima} className="w-full border border-gray-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>
 
      {/* Feedback del Server Action */}
      {state?.error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{state.error}</div>}
      {state?.success && <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">{state.message}</div>}
 
      <button 
        type="submit" 
        disabled={isPending || !tutorEncontrado}
        className="w-full bg-blue-600 text-white font-medium py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
      >
        {isPending ? "Guardando..." : "Registrar Paciente"}
      </button>
    </form>
  )
}