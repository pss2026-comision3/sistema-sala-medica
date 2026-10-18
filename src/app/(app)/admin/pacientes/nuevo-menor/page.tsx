import { FormNuevoMenor } from "@/components/form-nuevo-menor"

/** Fecha de hoy en la sala (Argentina) como YYYY-MM-DD. */
function hoyEnLaSala(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/**
 * Primera fecha de nacimiento que todavía corresponde a un menor:
 * el día siguiente a "hoy hace 18 años" (quien cumple 18 hoy ya es adulto).
 */
function fechaMinimaMenor(hoy: string): string {
  const [anio, mes, dia] = hoy.split("-").map(Number)
  // Si hoy es 29/02 y hace 18 años no hubo 29/02, el menor más grande nació el 01/03.
  if (mes === 2 && dia === 29) return `${anio - 18}-03-01`
  const d = new Date(Date.UTC(anio - 18, mes - 1, dia + 1))
  return d.toISOString().slice(0, 10)
}

export default function NuevoMenorPage() {
  const fechaMaxima = hoyEnLaSala()
  const fechaMinima = fechaMinimaMenor(fechaMaxima)

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Registrar Menor</h1>
        <p className="text-gray-500 mt-1">
          Complete los datos del paciente menor de edad y vincúlelo a un tutor registrado.
        </p>
      </div>

      <FormNuevoMenor fechaMinima={fechaMinima} fechaMaxima={fechaMaxima} />
    </div>
  )
}