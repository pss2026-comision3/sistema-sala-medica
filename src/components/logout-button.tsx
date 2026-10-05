import { logout } from "@/app/actions/auth";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button type="submit" className="sigsam-btn-ghost">
        Cerrar sesión
      </button>
    </form>
  );
}
