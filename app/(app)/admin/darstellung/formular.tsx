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
  kontrast,
  type Dunkelfarben,
} from "@/lib/design/farben";
import { farbenSpeichern, farbenZuruecksetzen, type Ergebnis } from "./aktionen";

const VARIABLE: Record<keyof Dunkelfarben, string> = {
  bg: "--bg",
  panel: "--panel",
  panel2: "--panel-2",
  line: "--line",
  text: "--text",
  muted: "--muted",
  ci400: "--color-ci-400",
  ci500: "--color-ci-500",
};

export default function FarbFormular({ gespeichert }: { gespeichert: Dunkelfarben }) {
  const [farben, setFarben] = useState<Dunkelfarben>(gespeichert);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [laeuft, starte] = useTransition();
  const [dunkel, setDunkel] = useState(false);
  const gesichert = useRef(false);

  useEffect(() => {
    setDunkel(document.documentElement.dataset.theme === "dark");
  }, []);

  // Vorschau schreiben und beim Verlassen wieder abraeumen.
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

  const textKontrast = kontrast(farben.text, farben.panel);
  const nebenKontrast = kontrast(farben.muted, farben.panel);
  const akzentKontrast = kontrast("#10200a", farben.ci400);

  const geaendert = FARB_FELDER.some(
    ({ schluessel }) => farben[schluessel] !== gespeichert[schluessel],
  );

  return (
    <div className="max-w-[70ch]">
      {!dunkel ? (
        <p
          className="mb-4 rounded-md px-2.5 py-2 text-xs leading-relaxed"
          style={{ background: "#fef3c7", color: "#b45309" }}
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
              ? { background: "#dcfce7", color: "#15803d" }
              : { background: "#fee2e2", color: "#b91c1c" }
          }
          role={ergebnis.ok ? "status" : "alert"}
        >
          {ergebnis.meldung}
        </p>
      ) : null}

      <form
        action={(formData) =>
          starte(async () => {
            const r = await farbenSpeichern(formData);
            setErgebnis(r);
            if (r.ok) gesichert.current = true;
          })
        }
      >
        <div className="panel mb-3 divide-y" style={{ borderColor: "var(--line)" }}>
          {FARB_FELDER.map(({ schluessel, label, erklaerung }) => (
            <div key={schluessel} className="flex items-center gap-3 p-3">
              <input
                type="color"
                aria-label={label}
                value={farben[schluessel]}
                onChange={(e) => setze(schluessel, e.target.value)}
                style={{
                  width: 40,
                  height: 32,
                  padding: 0,
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  background: "transparent",
                  cursor: "pointer",
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{label}</div>
                <div className="muted text-[11px]">{erklaerung}</div>
              </div>
              <input
                name={schluessel}
                className="field"
                style={{ width: 104, fontFamily: "ui-monospace, monospace", fontSize: "0.75rem" }}
                value={farben[schluessel]}
                onChange={(e) => setze(schluessel, e.target.value)}
                spellCheck={false}
              />
              {farben[schluessel] !== DUNKEL_VOREINSTELLUNG[schluessel] ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 11 }}
                  title={`Zurück auf ${DUNKEL_VOREINSTELLUNG[schluessel]}`}
                  onClick={() => setze(schluessel, DUNKEL_VOREINSTELLUNG[schluessel])}
                >
                  ↺
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="panel mb-3 p-3">
          <h2 className="mb-1.5 text-sm font-semibold">Lesbarkeit</h2>
          <ul className="space-y-1 text-[11px] leading-relaxed">
            <Pruefung
              label="Schrift auf Karten"
              wert={textKontrast}
              schwelle={4.5}
              hinweis="Unter 4.5 wird normaler Text für manche Augen mühsam."
            />
            <Pruefung
              label="Nebensächliche Schrift"
              wert={nebenKontrast}
              schwelle={3}
              hinweis="Hinweise und Datumsangaben sollten mindestens 3 erreichen."
            />
            <Pruefung
              label="Schrift auf dem Akzent"
              wert={akzentKontrast}
              schwelle={4.5}
              hinweis="Betrifft den aktiven Menüpunkt und den Hauptknopf."
            />
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" type="submit" disabled={laeuft || !geaendert}>
            {laeuft ? "Speichere…" : "Speichern"}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={laeuft}
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

function Pruefung({
  label,
  wert,
  schwelle,
  hinweis,
}: {
  label: string;
  wert: number;
  schwelle: number;
  hinweis: string;
}) {
  const gut = wert >= schwelle;
  return (
    <li>
      <span style={{ color: gut ? "#15803d" : "#b45309" }}>{gut ? "✓" : "!"}</span>{" "}
      <span className="font-medium">{label}:</span> {wert.toFixed(1)}:1{" "}
      {gut ? null : <span className="muted">— {hinweis}</span>}
    </li>
  );
}
