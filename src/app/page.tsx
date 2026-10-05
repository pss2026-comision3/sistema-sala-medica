import { redirect } from "next/navigation";

import { destinoPostLogin } from "@/lib/auth/guards";
import { getSession } from "@/lib/auth/session";

export default async function HomePage() {
  const sesion = await getSession();
  if (!sesion) redirect("/login");
  redirect(destinoPostLogin(sesion));
}
