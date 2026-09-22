"use client";

/**
 * Farbwahl fuer beide Modi, mit Sofortwirkung.
 *
 * Waehrend des Einstellens legt die Seite einen eigenen style-Block ins
 * Dokument, der dieselben Regeln traegt wie der Betrieb - einmal fuer
 * Hell, einmal fuer Dunkel. Man sieht also die echte Oberflaeche und
 * nicht eine nachgebaute Vorschau. Beim Verlassen ohne Speichern
 * verschwindet der Block.
 *
 * Nicht ueber Inline-Stile am Wurzelelement, wie eine fruehere Fassung:
 * Inline-Angaben schlagen jede Regel aus dem Stylesheet, also auch die
 * des hellen Modus. Der Umschalter sah danach kaputt aus.
 *
 * Der Umschalter hier oben stellt die ganze Seite um, damit man sieht,
 * was man tut. Die eigene Vorliebe wird dabei nicht angefasst: beim
 * Verlassen der Seite steht wieder der Modus, mit dem man gekommen ist.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FARB_FELDER,
  GRUPPEN,
  MODUS_LABEL,
  VARIABLE,
  VOREINSTELLUNG,
  VORLAGEN,
  kontrast,
  themaCss,
  type FarbFeld,
  type Modus,
  type Palette,
} from "@/lib/design/farben";
import { farbenSpeichern, farbenZuruecksetzen, type Ergebnis } from "./aktionen";

type Paletten = Record<Modus, Palette>;

const MODI: Modus[] = ["hell", "dunkel"];

export default function FarbFormular({ gespeichert }: { gespeichert: Paletten }) {
  const router = useRouter();
  const [paletten, setPaletten] = useState<Paletten>(gespeichert);
  const [modus, setModus] = useState<Modus>("dunkel");
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [laeuft, starte] = useTransition();

  // Womit der Mensch hereinkam - das bekommt er beim Gehen zurueck.
  const urspruenglich = useRef<Modus | null>(null);

  const farben = paletten[modus];
  const standard = VOREINSTELLUNG[modus];

  useEffect(() => {
    const wurzel = document.documentElement;
    const jetzt: Modus = wurzel.dataset.theme === "dark" ? "dunkel" : "hell";
    urspruenglich.current = jetzt;
    setModus(jetzt);

    // Aufraeumen nach einem Fehler frueherer Fassungen: die Vorschau
    // schrieb die Farben direkt auf das Wurzelelement. Solche
    // Inline-Angaben schlagen JEDE Regel aus dem Stylesheet - auch die
    // des hellen Modus. Wer die Seite einmal offen hatte, konnte danach
    // nicht mehr auf Hell umschalten.
    for (const { schluessel } of FARB_FELDER) {
      wurzel.style.removeProperty(VARIABLE[schluessel]);
    }

    return () => {
      if (urspruenglich.current) {
        wurzel.dataset.theme = urspruenglich.current === "dunkel" ? "dark" : "light";
      }
    };
  }, []);

  // Die Seite folgt dem Umschalter - aber nur die Anzeige. In den
  // localStorage wird nichts geschrieben, die persoenliche Vorliebe
  // bleibt, wie sie war.
  useEffect(() => {
    document.documentElement.dataset.theme = modus === "dunkel" ? "dark" : "light";
  }, [modus]);

  // Beide Modi gleichzeitig in der Vorschau, damit das Umschalten ohne
  // Zucken geht.
  useEffect(() => {
    const id = "farb-vorschau";
    let block = document.getElementById(id) as HTMLStyleElement | null;
    if (!block) {
      block = document.createElement("style");
      block.id = id;
      document.head.appendChild(block);
    }
    block.textContent = MODI.map((m) => themaCss(m, paletten[m])).join("");

    return () => {
      document.getElementById(id)?.remove();
    };
  }, [paletten]);

  const setze = (schluessel: keyof Palette, wert: string) =>
    setPaletten((p) => ({ ...p, [modus]: { ...p[modus], [schluessel]: wert } }));

  const setzeAlle = (neu: Palette) => setPaletten((p) => ({ ...p, [modus]: neu }));

  const geaendert = FARB_FELDER.some(
    ({ schluessel }) => farben[schluessel] !== gespeichert[modus][schluessel],
  );
  const andererGeaendert = MODI.filter((m) => m !== modus).some((m) =>
    FARB_FELDER.some(({ schluessel }) => paletten[m][schluessel] !== gespeichert[m][schluessel]),
  );

  // Alles, was aufeinander gelesen wird, einmal durchrechnen.
  const pruefungen = FARB_FELDER.filter((f) => f.gegen).map((f) => ({
    label: f.label,
    wert: kontrast(farben[f.schluessel], farben[f.gegen!]),
  }));
  const schwach = pruefungen.filter((p) => p.wert < 4.5);

  return (
    <div className="max-w-[78ch]">
      {/* Modusumschalter */}
      <div className="panel mb-4 p-3">
        <h2 className="mb-1 text-sm font-semibold">Welchen Modus bearbeitest du?</h2>
        <p className="muted mb-2 text-[11px] leading-relaxed">
          Die Seite stellt sich mit um, damit du siehst, was du tust. Deine
          eigene Einstellung bleibt davon unberührt – beim Verlassen der Seite
          ist wieder der Modus da, mit dem du gekommen bist.
        </p>
        <div className="flex flex-wrap gap-2">
          {MODI.map((m) => {
            const aktiv = m === modus;
            const offen = FARB_FELDER.some(
              ({ schluessel }) => paletten[m][schluessel] !== gespeichert[m][schluessel],
            );
            return (
              <button
                key={m}
                type="button"
                className="btn"
                aria-pressed={aktiv}
                style={
                  aktiv
                    ? {
                        background: "var(--color-ci-400)",
                        borderColor: "var(--color-ci-400)",
                        color: "var(--auf-akzent)",
                        fontWeight: 600,
                      }
                    : undefined
                }
                onClick={() => setModus(m)}
              >
                {m === "dunkel" ? "🌙" : "☀️"} {MODUS_LABEL[m]}
                {offen ? (
                  <span
                    aria-label="ungespeicherte Änderungen"
                    title="ungespeicherte Änderungen"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: aktiv ? "var(--auf-akzent)" : "var(--warn-fg)",
                      display: "inline-block",
                      marginLeft: 2,
                    }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

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

      {andererGeaendert ? (
        <p
          className="mb-4 rounded-md px-2.5 py-2 text-xs leading-relaxed"
          style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}
        >
          Im anderen Modus liegen noch ungespeicherte Änderungen. Gespeichert
          wird immer nur der Modus, den du gerade vor dir hast.
        </p>
      ) : null}

      <div className="panel mb-4 p-3">
        <h2 className="mb-1 text-sm font-semibold">Vorlagen</h2>
        <p className="muted mb-2 text-[11px]">
          Ein Ausgangspunkt – danach lässt sich jede Farbe einzeln nachziehen.
        </p>
        <div className="flex flex-wrap gap-2">
          {VORLAGEN[modus].map((v) => (
            <button
              key={v.name}
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 12 }}
              title={v.text}
              onClick={() => setzeAlle(v.palette)}
            >
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: v.palette.bg,
                  border: `1px solid ${v.palette.line}`,
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
            if (r.ok) router.refresh();
          })
        }
      >
        {/* Sagt der Serveraktion, in welche Spalte sie schreiben soll. */}
        <input type="hidden" name="modus" value={modus} />

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
                standard={standard}
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
            {laeuft ? "Speichere…" : `${MODUS_LABEL[modus]} speichern`}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={laeuft || !geaendert}
            onClick={() => setzeAlle(gespeichert[modus])}
          >
            Änderungen verwerfen
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={laeuft}
            onClick={() =>
              starte(async () => {
                const r = await farbenZuruecksetzen(modus);
                setErgebnis(r);
                if (r.ok) {
                  setzeAlle(standard);
                  router.refresh();
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
  standard,
  onSetze,
}: {
  feld: FarbFeld;
  farben: Palette;
  standard: Palette;
  onSetze: (s: keyof Palette, w: string) => void;
}) {
  const { schluessel, label, erklaerung, gegen } = feld;
  const wert = farben[schluessel];
  const abweichend = wert !== standard[schluessel];
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
          borderRadius: "var(--r-klein)",
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
        title={`Zurück auf ${standard[schluessel]}`}
        onClick={() => onSetze(schluessel, standard[schluessel])}
      >
        ↺
      </button>
    </div>
  );
}
