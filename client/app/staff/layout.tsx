"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/app/providers";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={
        "text-sm rounded-md px-3 py-2 border " +
        (active ? "border-foreground/30" : "border-transparent hover:border-foreground/15")
      }
    >
      {label}
    </Link>
  );
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { auth, isLoaded, logout } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    if (!auth) router.replace("/login");
  }, [auth, isLoaded, router]);

  if (!isLoaded) {
    return <div className="p-6 text-sm opacity-70">Loading…</div>;
  }

  if (!auth) {
    return <div className="p-6 text-sm opacity-70">Redirecting…</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-foreground/10">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="font-semibold">Hostel Staff</div>
            <div className="text-xs opacity-70">{auth.user.role}</div>
          </div>

          <nav className="flex items-center gap-2">
            <NavLink href="/staff/students" label="Students" />
            <NavLink href="/staff/outpasses" label="Outpasses" />
            <NavLink href="/staff/messconcessions" label="Mess" />
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-sm opacity-80">{auth.user.username}</div>
            <button
              className="text-sm rounded-md px-3 py-2 border border-foreground/15 hover:border-foreground/30"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
