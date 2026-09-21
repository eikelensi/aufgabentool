"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PUNKTE = [
  { href: "/admin", label: "Übersicht", exakt: true },
  { href: "/admin/nutzer", label: "Nutzerverwaltung" },
  { href: "/admin/kollegen", label: "Mitarbeiterverwaltung" },
  { href: "/admin/einstellungen", label: "Einstellungen" },
  { href: "/admin/protokoll", label: "Protokolle" },
  { href: "/admin/handbuch", label: "Handbuch" },
];

export default function AdminNavigation({ istSuperadmin }: { istSuperadmin: boolean }) {
  const pfad = usePathname();

  return (
    <div className="line mb-4 border-b pb-2">
      <div className="mb-1.5 flex items-baseline gap-2">
        <h1 className="text-lg font-semibold">Verwaltung</h1>
        <span className="muted text-[11px]">
          {istSuperadmin ? "Superadmin" : "Admin"}
        </span>
      </div>
      <nav className="scroll-x flex items-center gap-0.5">
        {PUNKTE.map((p) => {
          const aktiv = p.exakt ? pfad === p.href : pfad.startsWith(p.href);
          return (
            <Link
              key={p.href}
              href={p.href}
              className="rounded-md px-2.5 py-1.5 text-[13px] font-medium transition"
              style={
                aktiv
                  ? { background: "var(--color-ci-400)", color: "#10200a" }
                  : { color: "var(--muted)" }
              }
            >
              {p.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
