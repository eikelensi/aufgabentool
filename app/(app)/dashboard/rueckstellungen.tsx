"use client";

import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Avatar, formatDate } from "@/components/ui";
import { TaskDetailDialog } from "@/components/dialogs";
import { rueckstellungen } from "@/lib/zeit/rueckstellung";
import type { Task } from "@/lib/types";

/**
 * Alle zurueckgestellten Aufgaben ("Rueckfragen offen") auf einen Blick -
 * nach Aufgaben, nicht nach Personen. Die Kacheln darueber zaehlen je
 * Mitarbeiter; hier steht, WAS liegt und seit wann, die aelteste
 * Rueckstellung zuerst.
 *
 * Nur ab dem Qualitaetsmanagement (darfAlles): wer nicht alle Aufgaben
 * sieht, haette hier eine unvollstaendige Liste.
 */
export default function Rueckstellungen() {
  const { visibleTasks, profileById, categoryById, profiles, categories } = useStore();
  const [person, setPerson] = useState("");
  const [kategorie, setKategorie] = useState("");
  const [detail, setDetail] = useState<Task | null>(null);

  const alle = useMemo(() => rueckstellungen(visibleTasks), [visibleTasks]);
  const liste = alle.filter(
    ({ aufgabe }) =>
      (!person || (person === "__keiner" ? !aufgabe.assigneeId : aufgabe.assigneeId === person)) &&
      (!kategorie || (kategorie === "__keine" ? !aufgabe.categoryId : aufgabe.categoryId === kategorie)),
  );

  const tageSeit = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));

  return (
    <section className="panel p-3">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-semibold">Zurückgestellte Aufgaben</h2>
        <span className="muted text-[11px]">
          {liste.length}
          {liste.length !== alle.length ? ` von ${alle.length}` : ""}
        </span>
        <span className="ml-auto flex flex-wrap gap-1.5">
          <select className="field text-[11px]" value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Bearbeiter">
            <option value="">Alle Bearbeiter</option>
            <option value="__keiner">ohne Bearbeiter</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
          <select className="field text-[11px]" value={kategorie} onChange={(e) => setKategorie(e.target.value)} aria-label="Kategorie">
            <option value="">Alle Kategorien</option>
            <option value="__keine">ohne Kategorie</option>
            {[...categories]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </span>
      </header>

      {liste.length === 0 ? (
        <p className="muted text-xs">
          {alle.length === 0 ? "Keine Aufgabe ist zurückgestellt." : "Zu diesem Filter ist keine Aufgabe zurückgestellt."}
        </p>
      ) : (
        <div className="scroll-x">
          <table className="w-full text-xs">
            <thead>
              <tr className="line border-b text-left">
                <th className="py-2 pr-3 font-semibold">Aufgabe</th>
                <th className="px-3 py-2 font-semibold">Bearbeiter</th>
                <th className="px-3 py-2 font-semibold">zurückgestellt seit</th>
                <th className="px-3 py-2 font-semibold">Rückfrage</th>
                <th className="px-3 py-2 font-semibold">Frist</th>
              </tr>
            </thead>
            <tbody>
              {liste.map(({ aufgabe, seit }) => {
                const bearbeiter = profileById(aufgabe.assigneeId);
                const kat = categoryById(aufgabe.categoryId);
                const tage = tageSeit(seit);
                return (
                  <tr key={aufgabe.id} className="line border-b align-top">
                    <td className="py-2 pr-3">
                      <button type="button" className="text-left hover:underline" onClick={() => setDetail(aufgabe)}>
                        {aufgabe.onofficeTaskId ? <span className="muted mr-1">#{aufgabe.onofficeTaskId}</span> : null}
                        <span className="font-medium">{aufgabe.title}</span>
                      </button>
                      {kat ? (
                        <div className="muted mt-0.5 flex items-center gap-1 text-[10px]">
                          <span aria-hidden style={{ width: 7, height: 7, borderRadius: 99, background: kat.color }} />
                          {kat.name}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {bearbeiter ? (
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <Avatar profile={bearbeiter} size={18} />
                          {bearbeiter.fullName}
                        </span>
                      ) : (
                        <span className="muted">unbesetzt</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDate(seit)}
                      <div className="text-[10px]" style={tage >= 7 ? { color: "var(--warn-fg)", fontWeight: 600 } : { opacity: 0.7 }}>
                        {tage === 0 ? "heute" : tage === 1 ? "seit 1 Tag" : `seit ${tage} Tagen`}
                      </div>
                    </td>
                    <td className="px-3 py-2" style={{ maxWidth: 320 }}>
                      {aufgabe.inProgressNote ? aufgabe.inProgressNote : <span className="muted">–</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{aufgabe.dueDate ? formatDate(aufgabe.dueDate) : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detail ? <TaskDetailDialog task={detail} onClose={() => setDetail(null)} /> : null}
    </section>
  );
}
