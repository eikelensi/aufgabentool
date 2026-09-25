"use client";

/**
 * Die Verwaltung hat zwei Ebenen, und das ist der Punkt.
 *
 * Vorher standen neun Reiter nebeneinander - ohne Ordnung, ohne
 * Zusammenhang, und wer etwas suchte, musste raten. Jetzt gibt es
 * fuenf Gruppen, die sagen, WORUM es geht, und darunter die Seiten der
 * Gruppe, die man gerade offen hat. Man sieht immer nur das, was zur
 * Sache gehoert.
 *
 * Bewusst ohne Symbole: ein Emoji je Reiter macht die Leiste bunt,
 * nicht verstaendlich. Die Woerter tun die Arbeit.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GRUPPEN, gruppeVon } from "./bereiche";

function Reiter({
  href,
  label,
  aktiv,
  titel,
  klein,
}: {
  href: string;
  label: string;
  aktiv: boolean;
  titel?: string;
  klein?: boolean;
}) {
  return (
    <Link
      href={href}
      className="btn"
      aria-current={aktiv ? "page" : undefined}
      title={titel}
      style={{
        fontSize: klein ? 12 : 13,
        fontWeight: aktiv ? 600 : 400,
        background: aktiv && !klein ? "var(--color-ci-400)" : "transparent",
        borderColor: aktiv && !klein ? "var(--color-ci-400)" : "transparent",
        color: aktiv && !klein ? "var(--auf-akzent)" : undefined,
        ...(klein && aktiv
          ? {
              // Zweite Ebene ruhiger: ein Strich statt einer Fuellung,
              // damit die Gruppe darueber die lautere bleibt.
              borderBottom: "2px solid var(--color-ci-500)",
              borderRadius: 0,
            }
          : {}),
      }}
    >
      {label}
    </Link>
  );
}

export default function AdminNavigation({ istSuperadmin }: { istSuperadmin: boolean }) {
  const pfad = usePathname();
  const aktiveGruppe = gruppeVon(pfad);

  return (
    <div className="line mb-4 border-b pb-2">
      <div className="mb-2 flex items-baseline gap-2">
        <h1 className="text-lg font-semibold">Verwaltung</h1>
        <span className="muted text-[11px]">{istSuperadmin ? "Superadmin" : "Admin"}</span>
      </div>

      <nav className="scroll-x flex items-center gap-1" aria-label="Bereiche der Verwaltung">
        <Reiter
          href="/admin"
          label="Übersicht"
          aktiv={pfad === "/admin"}
          titel="Alle Bereiche auf einen Blick"
        />
        <span className="line mx-1 h-4 border-l" aria-hidden />
        {GRUPPEN.map((g) => (
          <Reiter
            key={g.schluessel}
            href={g.seiten[0].href}
            label={g.label}
            aktiv={aktiveGruppe?.schluessel === g.schluessel}
          />
        ))}
      </nav>

      {aktiveGruppe && aktiveGruppe.seiten.length > 1 ? (
        <nav
          className="scroll-x mt-1.5 flex items-center gap-1"
          aria-label={`Seiten in ${aktiveGruppe.label}`}
        >
          {aktiveGruppe.seiten.map((s) => (
            <Reiter
              key={s.href}
              href={s.href}
              label={s.label}
              titel={s.zweck}
              klein
              aktiv={s.exakt ? pfad === s.href : pfad === s.href || pfad.startsWith(`${s.href}/`)}
            />
          ))}
        </nav>
      ) : null}
    </div>
  );
}
