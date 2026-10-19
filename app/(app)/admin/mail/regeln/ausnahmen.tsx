"use client";

import { useState, useTransition } from "react";
import { personMailSetzen, type Ergebnis } from "./aktionen";

export interface AusnahmeSpalte {
  kind: string;
  label: string;
  /** Vom Haus abgeschaltet - dann ist es fuer alle aus, der Haken zaehlt nicht. */
  hausAus: boolean;
}

export interface AusnahmePerson {
  id: string;
  name: string;
  /** Mailarten, die diese Person NICHT bekommt, weil der Admin sie abgeschaltet hat. */
  aus: string[];
  /** Mailarten, die diese Person gar nicht erreichen koennen (etwa: kein Makler). */
  nichtZutreffend: string[];
}

/**
 * Ausnahmen je Mitarbeiter: eine Zeile je Person, eine Spalte je Mailart.
 *
 * Haken gesetzt heisst "bekommt die Mail", wie oben bei der Hausregel.
 * Die Pool-Meldung fehlt absichtlich - sie geht an eine feste Adresse,
 * nicht an eine Person.
 */
export default function Ausnahmen({
  spalten,
  personen,
}: {
  spalten: AusnahmeSpalte[];
  personen: AusnahmePerson[];
}) {
  const [meldung, setMeldung] = useState<Ergebnis | null>(null);
  const [laeuft, starte] = useTransition();

  const setze = (profileId: string, kind: string, aktiv: boolean) =>
    starte(async () => setMeldung(await personMailSetzen(profileId, kind, aktiv)));

  return (
    <section className="panel mt-4 p-4" style={{ maxWidth: 900 }}>
      <h2 className="text-sm font-semibold">Ausnahmen je Mitarbeiter</h2>
      <p className="muted mb-3 mt-0.5 text-[11px] leading-relaxed">
        Haken weg: Diese Person bekommt die Mail nicht mehr, alle anderen weiterhin. Ist eine
        Mailart oben für das ganze Haus abgeschaltet, geht sie an niemanden – egal, was hier
        steht.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="muted text-left text-[11px]">
              <th className="py-1.5 pr-3 font-medium">Mitarbeiter</th>
              {spalten.map((s) => (
                <th key={s.kind} className="px-2 py-1.5 text-center font-medium">
                  {s.label}
                  {s.hausAus ? <div className="font-normal">(für alle aus)</div> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personen.map((p) => (
              <tr key={p.id} className="line border-t">
                <td className="py-1.5 pr-3">
                  {p.name}
                  {p.aus.length ? (
                    <span className="muted"> · {p.aus.length} aus</span>
                  ) : null}
                </td>
                {spalten.map((s) => {
                  if (p.nichtZutreffend.includes(s.kind)) {
                    return (
                      <td
                        key={s.kind}
                        className="muted px-2 py-1.5 text-center"
                        title="Diese Mail erreicht diese Person nicht"
                      >
                        –
                      </td>
                    );
                  }
                  const bekommt = !p.aus.includes(s.kind);
                  return (
                    <td key={s.kind} className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={bekommt}
                        disabled={laeuft || s.hausAus}
                        aria-label={`${s.label} für ${p.name}`}
                        onChange={(e) => setze(p.id, s.kind, e.target.checked)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted mt-3 text-[11px] leading-relaxed">
        „Aufgabe erledigt“ geht nur an den beauftragenden Makler. Wer hier nicht als Makler
        hinterlegt ist, bekommt sie nie – dort steht ein Strich. Makler ohne Zugang zum Tool
        stehen nicht in dieser Liste und lassen sich nicht einzeln abschalten.
      </p>

      {meldung ? (
        <p
          className="mt-2 text-xs"
          style={{ color: meldung.ok ? "var(--ok-fg)" : "var(--err-fg)" }}
          role="status"
        >
          {meldung.meldung}
        </p>
      ) : null}
    </section>
  );
}
