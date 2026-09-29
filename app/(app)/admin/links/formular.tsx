"use client";

/**
 * Verlinkungen pflegen - anlegen, aendern, verschieben, loeschen.
 *
 * Dasselbe Muster wie die Pinnwand-Themen und die Aufgaben-Kategorien,
 * und zwar absichtlich: drei Listen, die gleich aussehen und gleich
 * funktionieren, muss man nur einmal lernen.
 *
 * Der eine Unterschied: Loeschen fragt nach. Ein Thema zu verlieren
 * ist aergerlich, eine Adresse zu verlieren heisst, sie irgendwo
 * wieder heraussuchen zu muessen.
 */

import { useState } from "react";
import { useStore } from "@/lib/store";

export default function LinkFormular() {
  const { isAdmin, verlinkungen, verlinkungSpeichern, verlinkungLoeschen } = useStore();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [icon, setIcon] = useState("");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState<string | null>(null);

  if (!isAdmin) return <p className="muted text-sm">Dieser Bereich ist Admins vorbehalten.</p>;

  const sortiert = [...verlinkungen].sort((a, b) => a.sortOrder - b.sortOrder);

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
    <section className="panel p-4" style={{ maxWidth: 820 }}>
      <ul className="mb-4 space-y-2">
        {sortiert.map((v, i) => (
          <li key={v.id} className="line rounded-lg border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="field"
                style={{ width: 52, textAlign: "center" }}
                value={v.icon ?? ""}
                placeholder="🔗"
                title="Ein Zeichen als Erkennungsmarke"
                onChange={(e) => void verlinkungSpeichern({ id: v.id, icon: e.target.value })}
              />
              <input
                className="field"
                style={{ flex: "1 1 160px" }}
                value={v.name}
                placeholder="Name"
                onChange={(e) => void verlinkungSpeichern({ id: v.id, name: e.target.value })}
              />
              <input
                className="field"
                style={{ flex: "2 1 220px" }}
                value={v.url}
                placeholder="https://…"
                onChange={(e) => void verlinkungSpeichern({ id: v.id, url: e.target.value })}
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
              <input
                className="field"
                style={{ flex: "1 1 260px" }}
                value={v.beschreibung ?? ""}
                placeholder="Ein Satz, wozu das gut ist (optional)"
                onChange={(e) =>
                  void verlinkungSpeichern({ id: v.id, beschreibung: e.target.value })
                }
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
                  <button type="button" className="btn btn-ghost" onClick={() => setLoeschen(null)}>
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
            Noch keine Verlinkung angelegt.
          </li>
        ) : null}
      </ul>

      <div className="line rounded-lg border p-2" style={{ background: "var(--panel-2)" }}>
        <h3 className="mb-2 text-xs font-semibold">Neue Verlinkung</h3>
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
  );
}
