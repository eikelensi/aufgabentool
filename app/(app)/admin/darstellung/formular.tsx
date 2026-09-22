"use client";

/**
 * Farbwahl mit Sofortwirkung.
 *
 * Waehrend des Einstellens werden die Werte direkt auf das Dokument
 * geschrieben - man sieht also die echte Oberflaeche, nicht eine
 * nachgebaute Vorschau. Beim Verlassen ohne Speichern wird das wieder
 * entfernt.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import {
  DUNKEL_VOREINSTELLUNG,
  FARB_FELDER,
  GRUPPEN,
  VARIABLE,
  VORLAGEN,
  kontrast,
  type Dunkelfarben,
  type FarbFeld,
} from "@/lib/design/farben";
import { farbenSpeichern, farbenZuruecksetzen, type Ergebnis } from "./aktionen";

export default function FarbFormular({ gespeichert }: { gespeichert: Dunkelfarben }) {
  const [farben, setFarben] = useState<Dunkelfarben>(gespeichert);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [laeuft, starte] = useTransition();
  const [dunkel, setDunkel] = useState(false);
  const gesichert = useRef(false);

  useEffect(() => {
    setDunkel(document.documentElement.dataset.theme === "dark");
  }, []);

  useEffect(() => {
    const wurzel = document.documentElement;
    for (const { schluessel } of FARB_FELDER) {
      wurzel.style.setProperty(VARIABLE[schluessel], farben[schluessel]);
    }
    return () => {
      if (gesichert.current) return;
      for (const { schluessel } of FARB_FELDER) {
        wurzel.style.removeProperty(VARIABLE[schluessel]);
      }
    };
  }, [farben]);

  const setze = (schluessel: keyof Dunkelfarben, wert: string) =>
    setFarben((f) => ({ ...f, [schluessel]: wert }));

  const geaendert = FARB_FELDER.some(
    ({ schluessel }) => farben[schluessel] !== gespeichert[schluessel],
  );

  // Alles, was aufeinander gelesen wird, einmal durchrechnen.
  const pruefungen = FARB_FELDER.filter((f) => f.gegen).map((f) => ({
    label: f.label,
    wert: kontrast(farben[f.schluessel], farben[f.gegen!]),
  }));
  const schwach = pruefungen.filter((p) => p.wert < 4.5);

  return (
    <div className="max-w-[78ch]">
      {!dunkel ? (
        <p
          className="mb-4 rounded-md px-2.5 py-2 text-xs leading-relaxed"
          style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}
        >
          Du bist gerade im hellen Modus – von den Änderungen siehst du hier
          nichts. Schalte oben rechts auf 🌙 um, dann ändert sich die Seite
          direkt beim Einstellen.
        </p>
      ) : null}

      {ergebnis ? (
        <p
          className="mb-4 rounded-md px-2.5 py-2 text-xs leading-relaxed"
          style={
            ergebnis.ok
              ? { background: "var(--ok-bg)", color: "var(--ok-fg)" }
              : { background: "var(--err-bg)", color: "var(--err-fg)" }
          }
          role={ergebnis.ok ? "status" : "alert"}
        >
          {ergebnis.meldung}
        </p>
      ) : null}

      <div className="panel mb-4 p-3">
        <h2 className="mb-1 text-sm font-semibold">Vorlagen</h2>
        <p className="muted mb-2 text-[11px]">
          Ein Ausgangspunkt – danach lässt sich jede Farbe einzeln nachziehen.
        </p>
        <div className="flex flex-wrap gap-2">
          {VORLAGEN.map((v) => (
            <button
              key={v.name}
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 12 }}
              title={v.text}
              onClick={() => setFarben(v.farben)}
            >
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: v.farben.bg,
                  border: `1px solid ${v.farben.line}`,
                  display: "inline-block",
                  marginRight: 4,
                }}
              />
              {v.name}
            </button>
          ))}
        </div>
      </div>

      <form
        action={(formData) =>
          starte(async () => {
            const r = await farbenSpeichern(formData);
            setErgebnis(r);
            if (r.ok) gesichert.current = true;
          })
        }
      >
        {GRUPPEN.map((gruppe) => (
          <div key={gruppe.titel} className="panel mb-3">
            <div className="line border-b p-3">
              <h2 className="text-sm font-semibold">{gruppe.titel}</h2>
              <p className="muted text-[11px]">{gruppe.text}</p>
            </div>
            {gruppe.felder.map((feld) => (
              <Zeile
                key={feld.schluessel}
                feld={feld}
                farben={farben}
                onSetze={setze}
              />
            ))}
          </div>
        ))}

        <div className="panel mb-3 p-3">
          <h2 className="mb-1.5 text-sm font-semibold">Lesbarkeit</h2>
          {schwach.length === 0 ? (
            <p className="text-[11px]" style={{ color: "var(--ok-fg)" }}>
              ✓ Alle {pruefungen.length} Kombinationen erreichen mindestens 4.5:1.
            </p>
          ) : (
            <>
              <ul className="space-y-1 text-[11px] leading-relaxed">
                {schwach.map((p) => (
                  <li key={p.label}>
                    <span style={{ color: "var(--warn-fg)" }}>!</span>{" "}
                    <span className="font-medium">{p.label}</span>: {p.wert.toFixed(1)}:1
                  </li>
                ))}
              </ul>
              <p className="muted mt-1.5 text-[11px] leading-relaxed">
                Unter 4.5:1 wird Text für manche Augen mühsam – bei kleiner Schrift
                schneller, als man selbst merkt. Speichern kannst du trotzdem; es
                ist ein Hinweis, keine Sperre.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" type="submit" disabled={laeuft || !geaendert}>
            {laeuft ? "Speichere…" : "Speichern"}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={laeuft || !geaendert}
            onClick={() => setFarben(gespeichert)}
          >
            Änderungen verwerfen
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={laeuft}
            onClick={() =>
              starte(async () => {
                const r = await farbenZuruecksetzen();
                setErgebnis(r);
                if (r.ok) {
                  gesichert.current = true;
                  setFarben(DUNKEL_VOREINSTELLUNG);
                }
              })
            }
          >
            Auf Auslieferungszustand
          </button>
        </div>
      </form>
    </div>
  );
}

function Zeile({
  feld,
  farben,
  onSetze,
}: {
  feld: FarbFeld;
  farben: Dunkelfarben;
  onSetze: (s: keyof Dunkelfarben, w: string) => void;
}) {
  const { schluessel, label, erklaerung, gegen } = feld;
  const wert = farben[schluessel];
  const abweichend = wert !== DUNKEL_VOREINSTELLUNG[schluessel];
  const verhaeltnis = gegen ? kontrast(wert, farben[gegen]) : null;

  return (
    <div className="line flex items-center gap-3 border-b p-3 last:border-0">
      <input
        type="color"
        aria-label={label}
        value={wert}
        onChange={(e) => onSetze(schluessel, e.target.value)}
        style={{
          width: 40,
          height: 32,
          padding: 0,
          border: "1px solid var(--line)",
          borderRadius: 6,
          background: "transparent",
          cursor: "pointer",
          flexShrink: 0,
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{label}</div>
        {erklaerung ? <div className="muted text-[11px]">{erklaerung}</div> : null}
      </div>
      {verhaeltnis !== null ? (
        <span
          className="chip"
          style={
            verhaeltnis >= 4.5
              ? { background: "var(--ok-bg)", color: "var(--ok-fg)" }
              : { background: "var(--warn-bg)", color: "var(--warn-fg)" }
          }
          title={`Kontrast zur zugehörigen Fläche: ${verhaeltnis.toFixed(2)}:1`}
        >
          {verhaeltnis.toFixed(1)}
        </span>
      ) : null}
      <input
        name={schluessel}
        className="field"
        style={{ width: 100, fontFamily: "ui-monospace, monospace", fontSize: "0.72rem" }}
        value={wert}
        onChange={(e) => onSetze(schluessel, e.target.value)}
        spellCheck={false}
      />
      <button
        type="button"
        className="btn btn-ghost"
        style={{ fontSize: 11, visibility: abweichend ? "visible" : "hidden" }}
        title={`Zurück auf ${DUNKEL_VOREINSTELLUNG[schluessel]}`}
        onClick={() => onSetze(schluessel, DUNKEL_VOREINSTELLUNG[schluessel])}
      >
        ↺
      </button>
    </div>
  );
}
