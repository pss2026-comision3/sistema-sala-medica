import { requireRole } from "@/lib/auth/guards";

export default async function MedicoLayout({
  children,
}: LayoutProps<"/medico">) {
  await requireRole("MEDICO");
  return children;
}
