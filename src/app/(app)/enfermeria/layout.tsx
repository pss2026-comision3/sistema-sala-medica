import { requireRole } from "@/lib/auth/guards";

export default async function EnfermeriaLayout({
  children,
}: LayoutProps<"/enfermeria">) {
  await requireRole("ENFERMERIA");
  return children;
}
