export function adminSwitchTarget(pathname: string): { href: "/admin" | "/dashboard"; label: "Admin view" | "Member view" } {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return { href: "/dashboard", label: "Member view" };
  }
  return { href: "/admin", label: "Admin view" };
}
