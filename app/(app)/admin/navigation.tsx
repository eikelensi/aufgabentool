"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PUNKTE = [
  { href: "/admin", label: "Übersicht", icon: "⚙️", exakt: true },
  { href: "/admin/nutzer", label: "Nutzerverwaltung", icon: "👤" },
  { href: "/admin/kollegen", label: "Mitarbeiterverwaltung", icon: "👥" },
  { href: "/admin/einstellungen", label: "Einstellungen", icon: "🎛️" },
  { href: "/admin/darstellung", label: "Darstellung", icon: "🎨" },
  { href: "/admin/protokoll", label: "Protokolle", icon: "📋" },
  // Nachschlagewerkzeug, kein Arbeitsplatz: was in onOffice wirklich
  // steht, sieht man hier - aber nicht im Tagesmenue.
  { href: "/admin/rollen", label: "Rollen", icon: "🔑" },
  { href: "/admin/onoffice", label: "onOffice-Eingang", icon: "🔌" },
  { href: "/admin/handbuch", label: "Handbuch", icon: "📖" },
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
      <nav className="scroll-x flex items-center gap-1">
        {PUNKTE.map((p) => {
          const aktiv = p.exakt ? pfad === p.href : pfad.startsWith(p.href);
          return (
            <Link
              key={p.href}
              href={p.href}
              className="btn"
              aria-current={aktiv ? "page" : undefined}
              title={p.label}
              style={
                aktiv
                  ? {
                      background: "var(--color-ci-400)",
                      borderColor: "var(--color-ci-400)",
                      color: "var(--auf-akzent)",
                      fontWeight: 600,
                    }
                  : { background: "transparent", borderColor: "transparent" }
              }
            >
              <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>
                {p.icon}
              </span>
              <span className="hidden sm:inline">{p.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
