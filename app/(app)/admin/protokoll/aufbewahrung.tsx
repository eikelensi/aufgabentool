"use client";

/**
 * Wie lange Protokolle bleiben - und wie viel Platz sie gerade kosten.
 *
 * Die Zahl daneben ist der Punkt: eine Frist ohne Groessenangabe ist
 * eine Zahl ohne Bedeutung. Am 05.10.2026 waren es 23 MB allein fuer
 * das Abgleich-Protokoll, bei 1,6 MB Zuwachs am Tag - und niemand
 * konnte das sehen, ohne in die Datenbank zu schauen.
 */

import { useState } from "react";
import { useStore } from "@/lib/store";

export default function Aufbewahrung({
  groessen,
}: {
  groessen: { tabelle: string; label: string; zeilen: number; groesse: string }[];
}) {
  const { settings, updateSettings, isAdmin } = useStore();
  const [technik, setTechnik] = useState(String(settings.protokollTageTechnik));
  const [verlauf, setVerlauf] = useState(String(settings.protokollTageVerlauf));

  if (!isAdmin) return null;

  const speichern = (feld: "technik" | "verlauf", roh: string) => {
    const n = Math.max(0, Math.round(Number(roh)));
    if (!Number.isFinite(n)) return;
    void updateSettings(
      feld === "technik" ? { protokollTageTechnik: n } : { protokollTageVerlauf: n },
    );
  };

  return (
    <section className="panel mb-4 p-4" style={{ maxWidth: 820 }}>
      <h2 className="mb-1 text-xs font-semibold">Aufbewahrung</h2>
      <p className="muted mb-3 text-[11px] leading-relaxed">
        Zwei Fristen, weil es zwei verschiedene Dinge sind. Das Abgleich-Protokoll
        beantwortet „lief es heute Nacht“ – danach fragt nach einem Monat niemand mehr. Die
        Änderungsgeschichte beantwortet „wer hat das geändert“ – danach fragt man spät.
        Aufgeräumt wird einmal täglich. <strong>0 heißt: nie löschen.</strong>
      </p>

      <div className="mb-3 flex flex-wrap items-end gap-4">
        <label className="muted flex items-center gap-1.5 text-[11px]">
          Abgleich-Protokoll:
          <input
            type="number"
            min={0}
            className="field"
            style={{ width: 80 }}
            value={technik}
            onChange={(e) => setTechnik(e.target.value)}
            onBlur={() => speichern("technik", technik)}
          />
          Tage
        </label>
        <label className="muted flex items-center gap-1.5 text-[11px]">
          Änderungsgeschichte:
          <input
            type="number"
            min={0}
            className="field"
            style={{ width: 80 }}
            value={verlauf}
            onChange={(e) => setVerlauf(e.target.value)}
            onBlur={() => speichern("verlauf", verlauf)}
          />
          Tage
        </label>
      </div>

      <table className="w-full text-[11px]">
        <thead className="muted">
          <tr>
            <th className="line border-b py-1 text-left font-medium">Tabelle</th>
            <th className="line border-b py-1 text-right font-medium">Zeilen</th>
            <th className="line border-b py-1 text-right font-medium">Platz</th>
          </tr>
        </thead>
        <tbody>
          {groessen.map((g) => (
            <tr key={g.tabelle}>
              <td className="line border-b py-1">{g.label}</td>
              <td className="line muted border-b py-1 text-right">
                {g.zeilen.toLocaleString("de-DE")}
              </td>
              <td className="line border-b py-1 text-right">{g.groesse}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
