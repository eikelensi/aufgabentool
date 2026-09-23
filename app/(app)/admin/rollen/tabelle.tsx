"use client";

import React, { useState, useTransition } from "react";
import { BEREICH_LABEL, ROLLE_LABEL, type AppRole, type Bereich } from "@/lib/types";
import { bereichSetzen, type Ergebnis } from "./aktionen";

const ROLLEN: AppRole[] = ["gf", "qm", "user"];
const BEREICHE = Object.keys(BEREICH_LABEL) as Bereich[];

export default function RollenTabelle({
  stand,
}: {
  stand: Record<string, Record<string, boolean>>;
}) {
  const [werte, setWerte] = useState(stand);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [laeuft, starte] = useTransition();

  const umschalten = (rolle: AppRole, bereich: Bereich, an: boolean) => {
    // Erst auf dem Bildschirm, dann in der Datenbank - ein Haken, der
    // eine halbe Sekunde ueberlegt, fuehlt sich kaputt an.
    setWerte((alt) => ({ ...alt, [rolle]: { ...(alt[rolle] ?? {}), [bereich]: an } }));
    starte(async () => {
      const res = await bereichSetzen(rolle, bereich, an);
      setErgebnis(res);
      if (!res.ok) {
        setWerte((alt) => ({ ...alt, [rolle]: { ...(alt[rolle] ?? {}), [bereich]: !an } }));
      }
    });
  };

  return (
    <div className="panel p-4">
      <h2 className="mb-1 text-sm font-semibold">Wer sieht was</h2>
      <p className="muted mb-3 text-xs leading-relaxed">
        Ein Haken heißt: diese Rolle findet den Bereich im Menü. Der Superadmin
        steht nicht in der Liste – er sieht immer alles, damit sich niemand
        aussperren kann.
      </p>

      <div className="scroll-x">
        <table className="w-full text-xs">
          <thead>
            <tr className="line border-b">
              <th className="py-2 pr-3 text-left font-semibold">Bereich</th>
              {ROLLEN.map((r) => (
                <th key={r} className="px-3 py-2 text-left font-semibold">
                  {ROLLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BEREICHE.map((b) => (
              <tr key={b} className="line border-b">
                <td className="py-2 pr-3">{BEREICH_LABEL[b]}</td>
                {ROLLEN.map((r) => (
                  <td key={r} className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={werte[r]?.[b] ?? false}
                      disabled={laeuft}
                      onChange={(e) => umschalten(r, b, e.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ergebnis ? (
        <p
          className="mt-3 rounded-md px-2.5 py-2 text-[11px]"
          style={
            ergebnis.ok
              ? { background: "var(--ok-bg)", color: "var(--ok-fg)" }
              : { background: "var(--err-bg)", color: "var(--err-fg)" }
          }
          role="status"
        >
          {ergebnis.meldung}
        </p>
      ) : null}

      <p className="muted mt-3 text-[11px] leading-relaxed">
        Sichtbarkeit ist nicht dasselbe wie Recht: an der Verwaltung hängen
        Nutzeranlage und die Schreibschalter nach onOffice, und die bleiben bei
        Geschäftsführung und Superadmin. Wenn das Qualitätsmanagement dort
        wirklich arbeiten soll, sag Bescheid – dann ziehen wir die Rechte nach.
      </p>
    </div>
  );
}
