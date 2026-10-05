import { requireRole } from "@/lib/auth/guards";

export default async function PacienteLayout({
  children,
}: LayoutProps<"/paciente">) {
  await requireRole("PACIENTE");
  return children;
}
