"use server"

// Asumo que tu cliente Prisma está instanciado en esta ruta
import { prisma } from "@/lib/db/prisma"

// Acción 1: Buscar tutor por DNI para el frontend
export async function buscarTutorPorDni(dni: string) {
  try {
    const paciente = await prisma.paciente.findFirst({
      where: { dni },
      include: { persona: true } // Traemos los datos de Persona para mostrar el nombre
    })

    if (!paciente) {
      return { success: false, error: "No se encontró ningún paciente con ese DNI." }
    }

    return { 
      success: true, 
      tutor: {
        id: paciente.personaId.toString(), // Convertimos BigInt a string
        nombreCompleto: paciente.persona.nombreCompleto,
        dni: paciente.dni
      }
    }
  } catch (error) {
    console.error("Error al buscar tutor:", error)
    return { success: false, error: "Error interno al buscar el tutor." }
  }
}

// Acción 2: Registrar al menor
export async function registrarMenor(prevState: any, formData: FormData) {
  const nombreCompleto = formData.get("nombreCompleto") as string
  const dni = formData.get("dni") as string
  const fechaNacimiento = formData.get("fechaNacimiento") as string
  const telefono = formData.get("telefono") as string
  const tutorId = formData.get("tutorId") as string

  if (!tutorId) {
    return { success: false, error: "Es obligatorio vincular a un tutor válido." }
  }

  try {
    const nuevaPersona = await prisma.persona.create({
      data: {
        nombreCompleto,
        paciente: {
          create: {
            dni,
            fechaNacimiento: new Date(fechaNacimiento),
            telefono,
            tutorId: BigInt(tutorId),
          }
        }
      }
    })

    return { 
      success: true, 
      message: "Menor registrado correctamente.",
      pacienteId: nuevaPersona.id.toString() 
    }
  } catch (error) {
    console.error("Error al registrar menor:", error)
    return { success: false, error: "Ocurrió un error al guardar los datos." }
  }
}