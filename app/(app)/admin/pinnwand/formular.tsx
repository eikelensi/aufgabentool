"use client";

/**
 * Die Themen der Pinnwand - Name, Farbe, Reihenfolge.
 *
 * Dasselbe Muster wie die Aufgaben-Kategorien, und zwar absichtlich:
 * zwei Dinge, die gleich aussehen und gleich funktionieren, muss man
 * nur einmal lernen.
 */

import { useState } from "react";
import { useStore } from "@/lib/store";

export default function PinThemenFormular() {
  const { isAdmin, pinKategorien, pins, pinKategorieSpeichern, pinKategorieLoeschen } = useStore();

  const [neuerName, setNeuerName] = useState("");
  const [neueFarbe, setNeueFarbe] = useState("#88cc44");
  const [meldung, setMeldung] = useState<string | null>(null);

  if (!isAdmin) return <p className="muted text-sm">Dieser Bereich ist Admins vorbehalten.</p>;

  const sortiert = [...pinKategorien].sort((a, b) => a.sortOrder - b.sortOrder);
  const anzahl = (id: string) => pins.filter((p) => p.kategorieId === id).length;

  const anlegen = async () => {
    if (!neuerName.trim()) return;
    const res = await pinKategorieSpeichern({
      name: neuerName.trim(),
      farbe: neueFarbe,
      sortOrder: (sortiert.at(-1)?.sortOrder ?? 0) + 10,
      isActive: true,
    });
    setMeldung(res.ok ? null : (res.error ?? null));
    if (res.ok) setNeuerName("");
  };

  const schieben = async (id: string, richtung: -1 | 1) => {
    const i = sortiert.findIndex((k) => k.id === id);
    const j = i + richtung;
    if (i < 0 || j < 0 || j >= sortiert.length) return;
    await pinKategorieSpeichern({ id: sortiert[i].id, sortOrder: sortiert[j].sortOrder });
    await pinKategorieSpeichern({ id: sortiert[j].id, sortOrder: sortiert[i].sortOrder });
  };

  return (
    <section className="panel p-4" style={{ maxWidth: 720 }}>
      <ul className="mb-3 space-y-1.5">
        {sortiert.map((k, i) => (
          <li key={k.id} className="line flex items-center gap-2 rounded-lg border p-1.5">
            <input
              type="color"
              value={k.farbe}
              onChange={(e) => void pinKategorieSpeichern({ id: k.id, farbe: e.target.value })}
              style={{ width: 28, height: 28, border: "none", background: "none", padding: 0 }}
              title="Farbe wählen"
            />
            <input
              className="field"
              style={{ flex: 1 }}
              value={k.name}
              onChange={(e) => void pinKategorieSpeichern({ id: k.id, name: e.target.value })}
            />
            <span className="muted whitespace-nowrap text-[11px]">
              {anzahl(k.id)} {anzahl(k.id) === 1 ? "Pin" : "Pins"}
            </span>
            <label className="muted flex items-center gap-1 text-[11px]">
              <input
                type="checkbox"
                checked={k.isActive}
                onChange={(e) => void pinKategorieSpeichern({ id: k.id, isActive: e.target.checked })}
              />
              aktiv
            </label>
            <button
              className="btn btn-ghost"
              disabled={i === 0}
              onClick={() => void schieben(k.id, -1)}
              title="Weiter nach vorne"
            >
              ↑
            </button>
            <button
              className="btn btn-ghost"
              disabled={i === sortiert.length - 1}
              onClick={() => void schieben(k.id, 1)}
              title="Weiter nach hinten"
            >
              ↓
            </button>
            <button
              className="btn btn-ghost"
              title="Löschen – die Pins bleiben und stehen dann ohne Thema da."
              onClick={async () => {
                if (!window.confirm(`Thema „${k.name}“ löschen? Die Pins bleiben erhalten.`)) return;
                const res = await pinKategorieLoeschen(k.id);
                setMeldung(res.ok ? null : (res.error ?? null));
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="line flex items-end gap-2 border-t pt-3">
        <input
          type="color"
          value={neueFarbe}
          onChange={(e) => setNeueFarbe(e.target.value)}
          style={{ width: 32, height: 32, border: "none", background: "none", padding: 0 }}
        />
        <input
          className="field"
          placeholder="Neues Thema"
          value={neuerName}
          onChange={(e) => setNeuerName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void anlegen()}
        />
        <button className="btn btn-primary" onClick={() => void anlegen()}>
          Anlegen
        </button>
      </div>

      {meldung ? (
        <p className="mt-2 text-[12px]" style={{ color: "var(--err-fg)" }}>
          {meldung}
        </p>
      ) : null}
    </section>
  );
}
