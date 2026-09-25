"use client";

/**
 * Kategorien und Farben - nichts sonst.
 *
 * Frueher stand das als ein Block unter fuenf anderen auf einer
 * einzigen langen Seite. Wer eine Kategorie umbenennen wollte, scrollte
 * an Mailvorlagen und onOffice-Zustand vorbei.
 */

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Category } from "@/lib/types";

export default function KategorienFormular() {
  const { isAdmin, categories, upsertCategory, removeCategory, moveCategory } = useStore();

  const [neuerName, setNeuerName] = useState("");
  const [neueFarbe, setNeueFarbe] = useState("#88cc44");

  if (!isAdmin) return <p className="muted text-sm">Dieser Bereich ist Admins vorbehalten.</p>;

  const sortiert = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  const anlegen = () => {
    if (!neuerName.trim()) return;
    const kategorie: Category = {
      id: `c-${Math.random().toString(36).slice(2, 8)}`,
      name: neuerName.trim(),
      color: neueFarbe,
      sortOrder: (sortiert.at(-1)?.sortOrder ?? 0) + 10,
      isActive: true,
    };
    upsertCategory(kategorie);
    setNeuerName("");
  };

  return (
    <section className="panel p-4" style={{ maxWidth: 720 }}>
      <ul className="mb-3 space-y-1.5">
        {sortiert.map((c, i) => (
          <li key={c.id} className="line flex items-center gap-2 rounded-lg border p-1.5">
            <input
              type="color"
              value={c.color}
              onChange={(e) => upsertCategory({ ...c, color: e.target.value })}
              style={{ width: 28, height: 28, border: "none", background: "none", padding: 0 }}
              title="Farbe wählen"
            />
            <input
              className="field"
              style={{ flex: 1 }}
              value={c.name}
              onChange={(e) => upsertCategory({ ...c, name: e.target.value })}
            />
            <label className="muted flex items-center gap-1 text-[11px]">
              <input
                type="checkbox"
                checked={c.isActive}
                onChange={(e) => upsertCategory({ ...c, isActive: e.target.checked })}
              />
              aktiv
            </label>
            <button
              className="btn btn-ghost"
              disabled={i === 0}
              onClick={() => moveCategory(c.id, -1)}
              title="Weiter nach oben"
            >
              ↑
            </button>
            <button
              className="btn btn-ghost"
              disabled={i === sortiert.length - 1}
              onClick={() => moveCategory(c.id, 1)}
              title="Weiter nach unten"
            >
              ↓
            </button>
            <button
              className="btn btn-ghost"
              title="Löschen – betroffene Aufgaben behalten ihre Daten und stehen dann ohne Kategorie da."
              onClick={() => removeCategory(c.id)}
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
          placeholder="Neue Kategorie"
          value={neuerName}
          onChange={(e) => setNeuerName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && anlegen()}
        />
        <button className="btn btn-primary" onClick={anlegen}>
          Anlegen
        </button>
      </div>
    </section>
  );
}
