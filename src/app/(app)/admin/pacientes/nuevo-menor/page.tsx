import { FormNuevoMenor } from "@/components/form-nuevo-menor"

export default function NuevoMenorPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Registrar Menor</h1>
        <p className="text-gray-500 mt-1">
          Complete los datos del paciente menor de edad y vincúlelo a un tutor registrado.
        </p>
      </div>
      
      <FormNuevoMenor />
    </div>
  )
}