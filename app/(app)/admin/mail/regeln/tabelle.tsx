"use client";

import { useState, useTransition } from "react";
import { regelSetzen, type Ergebnis } from "./aktionen";

export interface RegelZeile {
  kind: string;
  label: string;
  art: "frist" | "ereignis";
  aktiv: boolean;
  tageBis: number | null;
  wiederholenTage: number;
  stunde: number;
  nutzerDarfAendern: boolean;
  abweichend: number;
}

/** Zahlenfeld, das erst beim Verlassen speichert - wie bei den Verlinkungen. */
function Zahl({
  wert,
  min,
  max,
  breite = 64,
  speichern,
  titel,
}: {
  wert: number;
  min: number;
  max: number;
  breite?: number;
  titel?: string;
  speichern: (n: number) => void;
}) {
  const [entwurf, setEntwurf] = useState(String(wert));
  return (
    <input
      type="number"
      className="field"
      style={{ width: breite }}
      min={min}
      max={max}
      title={titel}
      value={entwurf}
      onChange={(e) => setEntwurf(e.target.value)}
      onBlur={() => {
        const n = Number(entwurf);
        if (!Number.isFinite(n)) return setEntwurf(String(wert));
        const begrenzt = Math.min(max, Math.max(min, Math.round(n)));
        setEntwurf(String(begrenzt));
        if (begrenzt !== wert) speichern(begrenzt);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEntwurf(String(wert));
      }}
    />
  );
}

export default function RegelTabelle({ zeilen }: { zeilen: RegelZeile[] }) {
  const [meldung, setMeldung] = useState<Ergebnis | null>(null);
  const [laeuft, starte] = useTransition();

  const setze = (kind: string, werte: Parameters<typeof regelSetzen>[1]) =>
    starte(async () => setMeldung(await regelSetzen(kind, werte)));

  return (
    <section className="panel p-4" style={{ maxWidth: 900 }}>
      <ul className="space-y-2">
        {zeilen.map((z) => (
          <li key={z.kind} className="line rounded-lg border p-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={z.aktiv}
                  disabled={laeuft}
                  onChange={(e) => setze(z.kind, { aktiv: e.target.checked })}
                />
                {z.label}
              </label>
              <span className="chip" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
                {z.art === "frist" ? "nach Frist" : "bei Ereignis"}
              </span>
              {!z.aktiv ? (
                <span className="chip" style={{ background: "var(--err-bg)", color: "var(--err-fg)" }}>
                  geht nicht raus
                </span>
              ) : null}
            </div>

            {/* Wann und wie oft gibt es nur bei fristgesteuerten Arten.
                Bei einem Ereignis waere die Frage sinnlos: es geht
                raus, wenn es passiert. */}
            {z.art === "frist" && z.aktiv ? (
              <div className="muted mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
                <label className="flex items-center gap-1.5">
                  nach
                  <Zahl
                    wert={z.tageBis ?? 3}
                    min={0}
                    max={365}
                    speichern={(n) => setze(z.kind, { tageBis: n })}
                  />
                  Tagen
                </label>
                <label className="flex items-center gap-1.5">
                  danach alle
                  <Zahl
                    wert={z.wiederholenTage}
                    min={0}
                    max={365}
                    titel="0 = nur einmal"
                    speichern={(n) => setze(z.kind, { wiederholenTage: n })}
                  />
                  Tage {z.wiederholenTage === 0 ? "(0 = nur einmal)" : "erneut"}
                </label>
                <label className="flex items-center gap-1.5">
                  um
                  <Zahl
                    wert={z.stunde}
                    min={0}
                    max={23}
                    breite={56}
                    titel="Volle Stunde, deutsche Zeit"
                    speichern={(n) => setze(z.kind, { stunde: n })}
                  />
                  Uhr
                </label>
              </div>
            ) : null}

            {/* Ohne diese Zahl bliebe offen, ob die Vorgabe fuer alle
                gilt - und die Antwort gehoert neben die Vorgabe. Wer
                genau, steht unten bei den Ausnahmen. */}
            {z.abweichend > 0 && z.aktiv ? (
              <p className="muted mt-2 text-[11px]">
                bei {z.abweichend} {z.abweichend === 1 ? "Person" : "Personen"} abgeschaltet –
                siehe Ausnahmen unten
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="muted mt-3 text-[11px] leading-relaxed">
        Abgeschaltet heißt: die Mail geht an niemanden raus, der Text bleibt erhalten. Einzelne
        Mitarbeiter nimmst du unten bei den Ausnahmen heraus.
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
