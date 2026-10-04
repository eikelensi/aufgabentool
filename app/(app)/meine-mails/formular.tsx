"use client";

import { useState, useTransition } from "react";
import { meineMailSetzen, meineMailZuruecksetzen, type Ergebnis } from "./aktionen";

export interface MeineZeile {
  kind: string;
  label: string;
  art: "frist" | "ereignis";
  aktiv: boolean;
  tageBis: number | null;
  wiederholenTage: number;
  stunde: number;
  darfAendern: boolean;
  weichtAb: boolean;
  sortOrder: number;
}

function Zahl({
  wert,
  min,
  max,
  breite = 64,
  titel,
  speichern,
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

export default function MeineMails({ zeilen }: { zeilen: MeineZeile[] }) {
  const [meldung, setMeldung] = useState<Ergebnis | null>(null);
  const [laeuft, starte] = useTransition();

  const setze = (kind: string, werte: Parameters<typeof meineMailSetzen>[1]) =>
    starte(async () => setMeldung(await meineMailSetzen(kind, werte)));

  const meine = zeilen.filter((z) => z.darfAendern);
  const feste = zeilen.filter((z) => !z.darfAendern);

  return (
    <div style={{ maxWidth: 760 }}>
      <header className="mb-4">
        <h1 className="text-lg font-semibold">Meine Mails</h1>
        <p className="muted mt-0.5 text-xs leading-relaxed">
          Welche Mitteilungen du bekommst – und bei den freigegebenen, wann und wie oft.
          Was hier nicht einstellbar ist, legt die Verwaltung für alle fest.
        </p>
      </header>

      <section className="panel mb-4 p-4">
        {meine.length === 0 ? (
          <p className="muted text-xs">
            Zurzeit ist keine Mailart zum Selbsteinstellen freigegeben.
          </p>
        ) : (
          <ul className="space-y-2">
            {meine.map((z) => (
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
                  {z.weichtAb ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: "0 0.4rem" }}
                      disabled={laeuft}
                      onClick={() =>
                        starte(async () => setMeldung(await meineMailZuruecksetzen(z.kind)))
                      }
                      title="Wieder so, wie es das Haus vorgibt"
                    >
                      zurücksetzen
                    </button>
                  ) : null}
                </div>

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
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Das Feste nicht verschweigen: wer nicht weiss, dass es eine
          Eskalationsmail gibt, haelt sie fuer einen Fehler, wenn sie
          kommt. */}
      {feste.length ? (
        <section className="panel p-4">
          <h2 className="mb-1 text-xs font-semibold">Vom Haus festgelegt</h2>
          <p className="muted mb-2 text-[11px] leading-relaxed">
            Diese Mitteilungen gelten für alle gleich und lassen sich hier nicht umstellen.
          </p>
          <ul className="muted space-y-1 text-[11px]">
            {feste.map((z) => (
              <li key={z.kind}>
                {z.aktiv ? "✓" : "✕"} {z.label}
                {z.art === "frist" && z.aktiv ? (
                  <span>
                    {" "}
                    – nach {z.tageBis ?? "–"} Tagen
                    {z.wiederholenTage ? `, danach alle ${z.wiederholenTage} Tage` : ""}, um{" "}
                    {z.stunde} Uhr
                  </span>
                ) : null}
                {!z.aktiv ? " – abgeschaltet" : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {meldung ? (
        <p
          className="mt-2 text-xs"
          style={{ color: meldung.ok ? "var(--ok-fg)" : "var(--err-fg)" }}
          role="status"
        >
          {meldung.meldung}
        </p>
      ) : null}
    </div>
  );
}
