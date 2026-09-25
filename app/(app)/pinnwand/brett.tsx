"use client";

/**
 * Zettel an der Wand.
 *
 * Bewusst keine Aufgaben: kein Bearbeiter, keine Frist, keine
 * Eskalation. Ein Pin ist etwas, das man WISSEN muss - nicht etwas,
 * das jemand tun muss. Wer daraus etwas zu Tuendes macht, legt eine
 * Aufgabe an, und dafuer gibt es den Knopf oben im Menue.
 *
 * Lesen darf jeder Angemeldete, aendern nur Qualitaetsmanagement und
 * Geschaeftsfuehrung. Durchgesetzt wird das in der Datenbank; hier
 * entscheidet es nur darueber, ob Knoepfe erscheinen - ein Knopf, der
 * nichts tut, ist schlimmer als keiner.
 */

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { EmptyState, Field, Modal } from "@/components/ui";
import type { Pin, PinKategorie } from "@/lib/types";

/** Aus einem Text klickbare Adressen machen, ohne HTML von aussen. */
function MitLinks({ text }: { text: string }) {
  const teile = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {teile.map((t, i) =>
        /^https?:\/\//.test(t) ? (
          <a
            key={i}
            href={t}
            target="_blank"
            rel="noreferrer"
            className="underline"
            style={{ color: "var(--color-ci-500)", overflowWrap: "anywhere" }}
          >
            {t}
          </a>
        ) : (
          <span key={i}>{t}</span>
        ),
      )}
    </>
  );
}

function datumLesbar(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function Zettel({
  pin,
  kategorie,
  darfAendern,
  onBearbeiten,
  onLoeschen,
  onAnheften,
}: {
  pin: Pin;
  kategorie?: PinKategorie;
  darfAendern: boolean;
  onBearbeiten: () => void;
  onLoeschen: () => void;
  onAnheften: () => void;
}) {
  const farbe = kategorie?.farbe ?? "var(--muted)";
  const datum = datumLesbar(pin.datum);

  return (
    <article
      className="panel relative flex flex-col p-3.5"
      style={{ borderTop: `3px solid ${farbe}` }}
    >
      {/* Der Punkt auf der Kante - das einzige Zierstueck, und es
          traegt eine Information: welches Thema. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: -8,
          left: "50%",
          transform: "translateX(-50%)",
          width: 13,
          height: 13,
          borderRadius: "50%",
          background: farbe,
        }}
      />

      <header className="mb-1.5 flex items-start gap-2">
        <h2 className="flex-1 text-[14px] font-semibold leading-snug">
          {pin.angeheftet ? <span title="Oben festgehalten">📌 </span> : null}
          {pin.titel}
        </h2>
        {darfAendern ? (
          <span className="flex shrink-0 gap-0.5">
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: "0 0.35rem" }}
              title={pin.angeheftet ? "Nicht mehr oben festhalten" : "Oben festhalten"}
              onClick={onAnheften}
            >
              {pin.angeheftet ? "📌" : "📍"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: "0 0.35rem" }}
              title="Pin bearbeiten"
              onClick={onBearbeiten}
            >
              ✎
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: "0 0.35rem" }}
              title="Pin löschen"
              onClick={onLoeschen}
            >
              ✕
            </button>
          </span>
        ) : null}
      </header>

      {pin.text ? (
        <p className="mb-3 whitespace-pre-wrap text-[12.5px] leading-relaxed">
          <MitLinks text={pin.text} />
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {kategorie ? (
          <span className="chip" style={{ background: kategorie.farbe, color: "#fff" }}>
            {kategorie.name}
          </span>
        ) : (
          <span className="chip" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
            ohne Thema
          </span>
        )}
        {datum ? (
          <span className="chip" style={{ background: "var(--err-bg)", color: "var(--err-fg)" }}>
            {datum}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function PinDialog({
  pin,
  kategorien,
  onClose,
  onSpeichern,
}: {
  pin: Partial<Pin> | null;
  kategorien: PinKategorie[];
  onClose: () => void;
  onSpeichern: (werte: Partial<Pin> & { id?: string }) => Promise<void>;
}) {
  const [titel, setTitel] = useState(pin?.titel ?? "");
  const [text, setText] = useState(pin?.text ?? "");
  const [kategorieId, setKategorieId] = useState(pin?.kategorieId ?? kategorien[0]?.id ?? "");
  const [datum, setDatum] = useState(pin?.datum ?? "");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const speichern = async () => {
    if (!titel.trim()) {
      setFehler("Ohne Überschrift findet den Zettel später niemand wieder.");
      return;
    }
    setLaeuft(true);
    setFehler(null);
    await onSpeichern({
      id: pin?.id,
      titel: titel.trim(),
      text: text.trim(),
      kategorieId: kategorieId || null,
      datum: datum || null,
    });
    setLaeuft(false);
  };

  return (
    <Modal title={pin?.id ? "Pin bearbeiten" : "Pin anlegen"} onClose={onClose}>
      <div className="grid gap-3">
        <Field label="Überschrift">
          <input
            className="field"
            value={titel}
            autoFocus
            onChange={(e) => setTitel(e.target.value)}
            placeholder="Worum geht es?"
          />
        </Field>
        <Field label="Text" hint="Adressen werden automatisch anklickbar.">
          <textarea
            className="field"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Thema">
            <select
              className="field"
              value={kategorieId}
              onChange={(e) => setKategorieId(e.target.value)}
            >
              <option value="">– ohne Thema –</option>
              {kategorien.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Datum" hint="Nur, wenn eins dazugehört.">
            <input
              type="date"
              className="field"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
            />
          </Field>
        </div>

        {fehler ? (
          <p className="text-[12px]" style={{ color: "var(--err-fg)" }}>
            {fehler}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <button className="btn btn-primary" onClick={speichern} disabled={laeuft}>
            {laeuft ? "Speichert…" : "Speichern"}
          </button>
          <button className="btn" onClick={onClose} disabled={laeuft}>
            Abbrechen
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Brett() {
  const { pins, pinKategorien, darfPinnen, pinSpeichern, pinLoeschen, bereit } = useStore();

  const [thema, setThema] = useState<string | null>(null);
  const [suche, setSuche] = useState("");
  const [dialog, setDialog] = useState<Partial<Pin> | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const themen = useMemo(
    () => pinKategorien.filter((k) => k.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [pinKategorien],
  );
  const themaVon = (id: string | null) => pinKategorien.find((k) => k.id === id);

  const sichtbar = useMemo(() => {
    const s = suche.trim().toLowerCase();
    return pins
      .filter((p) => (thema ? p.kategorieId === thema : true))
      .filter((p) =>
        s ? `${p.titel} ${p.text}`.toLowerCase().includes(s) : true,
      )
      .sort((a, b) => {
        if (a.angeheftet !== b.angeheftet) return a.angeheftet ? -1 : 1;
        const av = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const bv = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (av !== bv) return av - bv;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [pins, thema, suche]);

  if (!bereit) return <p className="muted text-xs">Lade…</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Pinnwand</h1>
          <p className="muted text-[12px]">
            Der schnelle Austausch im Team – Informationen anpinnen und teilen.
          </p>
        </div>
        {darfPinnen ? (
          <button className="btn btn-primary" onClick={() => setDialog({})}>
            + Pin anlegen
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <nav className="scroll-x flex items-center gap-1.5" aria-label="Nach Thema filtern">
          <button
            type="button"
            className="btn"
            onClick={() => setThema(null)}
            style={
              thema === null
                ? {
                    background: "var(--color-ci-400)",
                    borderColor: "var(--color-ci-400)",
                    color: "var(--auf-akzent)",
                    fontWeight: 600,
                  }
                : {}
            }
          >
            Alle
          </button>
          {themen.map((k) => (
            <button
              key={k.id}
              type="button"
              className="btn inline-flex items-center gap-1.5"
              onClick={() => setThema(thema === k.id ? null : k.id)}
              style={
                thema === k.id
                  ? { borderColor: k.farbe, background: k.farbe, color: "#fff", fontWeight: 600 }
                  : { borderColor: k.farbe }
              }
            >
              <span
                aria-hidden
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: thema === k.id ? "#fff" : k.farbe,
                }}
              />
              {k.name}
            </button>
          ))}
        </nav>
        <input
          className="field ml-auto"
          style={{ maxWidth: 220 }}
          placeholder="Suchen…"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          aria-label="Pins durchsuchen"
        />
      </div>

      {meldung ? (
        <p className="muted text-[11px]" role="status">
          {meldung}
        </p>
      ) : null}

      {sichtbar.length === 0 ? (
        <EmptyState
          text={
            pins.length === 0
              ? "Noch nichts angepinnt."
              : "Zu diesem Thema oder dieser Suche steht hier nichts."
          }
        />
      ) : (
        <div className="grid items-start gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sichtbar.map((p) => (
            <Zettel
              key={p.id}
              pin={p}
              kategorie={themaVon(p.kategorieId)}
              darfAendern={darfPinnen}
              onBearbeiten={() => setDialog(p)}
              onAnheften={() => void pinSpeichern({ id: p.id, angeheftet: !p.angeheftet })}
              onLoeschen={async () => {
                // Ein Zettel ist schnell weg und nicht wiederherstellbar -
                // also einmal nachfragen. Bei allem anderen im Tool
                // waere das laestig, hier ist es richtig.
                if (!window.confirm(`„${p.titel}“ wirklich löschen?`)) return;
                const res = await pinLoeschen(p.id);
                setMeldung(res.ok ? `„${p.titel}“ ist weg.` : (res.error ?? null));
              }}
            />
          ))}
        </div>
      )}

      {dialog ? (
        <PinDialog
          pin={dialog}
          kategorien={themen}
          onClose={() => setDialog(null)}
          onSpeichern={async (werte) => {
            const res = await pinSpeichern(werte);
            if (res.ok) {
              setDialog(null);
              setMeldung(null);
            } else {
              setMeldung(res.error ?? null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
