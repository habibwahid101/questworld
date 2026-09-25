const MEMBER_PATHS = [
  "/dashboard",
  "/investments",
  "/profit-history",
  "/referrals/dashboard",
  "/wallet",
  "/withdraw",
  "/transactions",
  "/profile",
] as const;

export function isMemberPath(pathname: string): boolean {
  return MEMBER_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isProtectedPath(pathname: string): boolean {
  return isMemberPath(pathname) || isAdminPath(pathname);
}
