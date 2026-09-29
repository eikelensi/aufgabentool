"use client";

/**
 * Verlinkungen pflegen - anlegen, aendern, verschieben, loeschen.
 *
 * WARUM HIER EIN ENTWURF STEHT, und nicht wie bei den Pinnwand-Themen
 * bei jedem Tastendruck gespeichert wird:
 *
 * Eine Adresse wird beim Speichern begradigt - fehlt "https://",
 * setzen wir es davor. Bei jedem Tastendruck zu speichern hiess
 * deshalb: wer die Adresse loeschen und neu tippen wollte, bekam nach
 * dem ersten Zeichen "https://w" zurueckgeschrieben, der Cursor sprang
 * ans Ende, und das Feld liess sich praktisch nicht mehr aendern.
 * Genau so ist es gemeldet worden.
 *
 * Also: tippen in den Entwurf, speichern beim Verlassen des Feldes
 * oder mit Enter. Escape verwirft. Haken und Pfeile wirken weiter
 * sofort - dort gibt es nichts zu tippen.
 */

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { Verlinkung } from "@/lib/types";

/** Ein Feld, das erst beim Verlassen speichert. */
function Entwurfsfeld({
  wert,
  platzhalter,
  titel,
  breite,
  mittig,
  speichern,
}: {
  wert: string;
  platzhalter?: string;
  titel?: string;
  breite: string | number;
  mittig?: boolean;
  speichern: (neu: string) => Promise<unknown> | void;
}) {
  const [entwurf, setEntwurf] = useState(wert);

  // Kommt von aussen ein anderer Wert (nach dem Speichern begradigt,
  // oder von einem zweiten Browser), gilt der - aber nur, wenn hier
  // gerade niemand tippt.
  useEffect(() => {
    setEntwurf(wert);
  }, [wert]);

  const abschicken = () => {
    if (entwurf === wert) return;
    void speichern(entwurf);
  };

  return (
    <input
      className="field"
      style={{ width: typeof breite === "number" ? breite : undefined, flex: typeof breite === "string" ? breite : undefined, textAlign: mittig ? "center" : undefined }}
      value={entwurf}
      placeholder={platzhalter}
      title={titel}
      onChange={(e) => setEntwurf(e.target.value)}
      onBlur={abschicken}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") setEntwurf(wert);
      }}
    />
  );
}

export default function LinkFormular() {
  const {
    isAdmin,
    verlinkungen,
    verlinkungSpeichern,
    verlinkungLoeschen,
    settings,
    updateSettings,
  } = useStore();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [icon, setIcon] = useState("");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState<string | null>(null);
  const [bereichsname, setBereichsname] = useState(settings.linksLabel);

  useEffect(() => setBereichsname(settings.linksLabel), [settings.linksLabel]);

  if (!isAdmin) return <p className="muted text-sm">Dieser Bereich ist Admins vorbehalten.</p>;

  const sortiert = [...verlinkungen].sort((a, b) => a.sortOrder - b.sortOrder);

  const setze = (v: Verlinkung, feld: keyof Verlinkung) => async (neu: string) => {
    const res = await verlinkungSpeichern({ id: v.id, [feld]: neu });
    if (!res.ok) setMeldung(res.error ?? null);
  };

  const anlegen = async () => {
    if (!name.trim() || !url.trim()) {
      setMeldung("Name und Adresse werden beide gebraucht.");
      return;
    }
    const res = await verlinkungSpeichern({
      name: name.trim(),
      url: url.trim(),
      beschreibung: beschreibung.trim() || null,
      icon: icon.trim() || null,
      sortOrder: (sortiert.at(-1)?.sortOrder ?? 0) + 10,
      isActive: true,
    });
    setMeldung(res.ok ? null : (res.error ?? null));
    if (res.ok) {
      setName("");
      setUrl("");
      setBeschreibung("");
      setIcon("");
    }
  };

  // Verschieben heisst: die beiden Sortierwerte tauschen. Kein
  // Durchnummerieren der ganzen Liste - das schriebe bei jedem Klick
  // jede Zeile neu.
  const schieben = async (id: string, richtung: -1 | 1) => {
    const i = sortiert.findIndex((v) => v.id === id);
    const j = i + richtung;
    if (i < 0 || j < 0 || j >= sortiert.length) return;
    await verlinkungSpeichern({ id: sortiert[i].id, sortOrder: sortiert[j].sortOrder });
    await verlinkungSpeichern({ id: sortiert[j].id, sortOrder: sortiert[i].sortOrder });
  };

  return (
    <div className="space-y-4" style={{ maxWidth: 820 }}>
      {/* Wie der Bereich heisst - im Menue, auf seiner Seite und hier. */}
      <section className="panel p-4">
        <h3 className="mb-1 text-xs font-semibold">Name des Bereichs</h3>
        <p className="muted mb-2 text-[11px] leading-relaxed">
          So heißt der Punkt im Hauptmenü und die Überschrift der Seite. „Verlinkungen“ ist
          nur die Vorgabe – wenn im Haus „Werkzeuge“ gesagt wird, sollte es hier auch so
          heißen.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="field"
            style={{ flex: "1 1 200px" }}
            value={bereichsname}
            onChange={(e) => setBereichsname(e.target.value)}
            placeholder="Verlinkungen"
            aria-label="Name des Bereichs"
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={!bereichsname.trim() || bereichsname === settings.linksLabel}
            onClick={async () => {
              const res = await updateSettings({ linksLabel: bereichsname.trim() });
              setMeldung(res.ok ? null : (res.error ?? null));
            }}
          >
            Übernehmen
          </button>
        </div>
      </section>

      <section className="panel p-4">
        <ul className="mb-4 space-y-2">
          {sortiert.map((v, i) => (
            <li key={v.id} className="line rounded-lg border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Entwurfsfeld
                  wert={v.icon ?? ""}
                  platzhalter="🔗"
                  titel="Ein Zeichen als Erkennungsmarke"
                  breite={52}
                  mittig
                  speichern={setze(v, "icon")}
                />
                <Entwurfsfeld
                  wert={v.name}
                  platzhalter="Name"
                  breite="1 1 160px"
                  speichern={setze(v, "name")}
                />
                <Entwurfsfeld
                  wert={v.url}
                  platzhalter="https://…"
                  titel="Beim Verlassen des Feldes gespeichert"
                  breite="2 1 220px"
                  speichern={setze(v, "url")}
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void schieben(v.id, -1)}
                    disabled={i === 0}
                    title="Nach oben"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void schieben(v.id, 1)}
                    disabled={i === sortiert.length - 1}
                    title="Nach unten"
                  >
                    ↓
                  </button>
                </div>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Entwurfsfeld
                  wert={v.beschreibung ?? ""}
                  platzhalter="Ein Satz, wozu das gut ist (optional)"
                  breite="1 1 260px"
                  speichern={setze(v, "beschreibung")}
                />
                <label className="muted flex items-center gap-1 text-[11px]">
                  <input
                    type="checkbox"
                    checked={v.isActive}
                    onChange={(e) =>
                      void verlinkungSpeichern({ id: v.id, isActive: e.target.checked })
                    }
                  />
                  sichtbar
                </label>
                <a
                  href={v.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn btn-ghost"
                  title="Adresse öffnen und prüfen"
                >
                  Prüfen ↗
                </a>
                {/* Zwei Klicks, absichtlich: eine Adresse ist schnell
                    geloescht und dann irgendwo wieder herauszusuchen. */}
                {loeschen === v.id ? (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn"
                      style={{ background: "var(--err-bg)", color: "var(--err-fg)" }}
                      onClick={async () => {
                        const res = await verlinkungLoeschen(v.id);
                        setLoeschen(null);
                        setMeldung(res.ok ? null : (res.error ?? null));
                      }}
                    >
                      Wirklich löschen
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setLoeschen(null)}
                    >
                      Abbrechen
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setLoeschen(v.id)}
                    title="Diesen Eintrag entfernen"
                  >
                    Löschen
                  </button>
                )}
              </div>
            </li>
          ))}
          {sortiert.length === 0 ? (
            <li className="muted line rounded-lg border border-dashed p-3 text-xs">
              Noch nichts angelegt.
            </li>
          ) : null}
        </ul>

        <div className="line rounded-lg border p-2" style={{ background: "var(--panel-2)" }}>
          <h3 className="mb-2 text-xs font-semibold">Neuer Eintrag</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="field"
              style={{ width: 52, textAlign: "center" }}
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🔗"
              aria-label="Zeichen"
            />
            <input
              className="field"
              style={{ flex: "1 1 160px" }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              aria-label="Name"
            />
            <input
              className="field"
              style={{ flex: "2 1 220px" }}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="www.beispiel.4-wk.de"
              aria-label="Adresse"
            />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input
              className="field"
              style={{ flex: "1 1 260px" }}
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              placeholder="Ein Satz, wozu das gut ist (optional)"
              aria-label="Beschreibung"
            />
            <button type="button" className="btn btn-primary" onClick={() => void anlegen()}>
              Anlegen
            </button>
          </div>
          <p className="muted mt-1.5 text-[11px]">
            Ohne „https://“ wird es ergänzt – sonst hängt der Browser die Adresse an die
            eigene an und landet auf einer Unterseite, die es nicht gibt.
          </p>
        </div>

        {meldung ? (
          <p className="mt-2 text-xs" style={{ color: "var(--err-fg)" }}>
            {meldung}
          </p>
        ) : null}
      </section>
    </div>
  );
}
