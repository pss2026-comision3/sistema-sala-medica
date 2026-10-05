import { requireRole } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireRole("ADMIN");
  return children;
}
