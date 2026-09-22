"use client";

/**
 * Verteilt: Aufgaben, fuer die ich in onOffice die Verantwortung habe,
 * die dort aber jemand bearbeitet, der kein Nutzer dieses Tools ist.
 *
 * Diese Seite gibt es, weil genau diese Aufgaben vorher nirgends
 * auftauchten. Sie wurden geholt - die Verantwortung passte ja -, aber
 * sie bekamen keinen Bearbeiter im Tool (der Name in onOffice gehoert
 * zu niemandem hier) und lagen auch nicht im Pool (in onOffice steht ja
 * ein Bearbeiter). Sie fielen zwischen die beiden Ansichten. Im
 * Mandanten der 4waendekanzlei sind das ein paar hundert Stueck - der
 * normale Fall, wenn jemand verteilt und ein anderer arbeitet.
 *
 * Hier wird nichts uebernommen. Die Aufgabe ist vergeben; wer sie an
 * sich ziehen wollte, muesste in onOffice den Bearbeiter aendern.
 */

import { useState } from "react";
import { useStore } from "@/lib/store";
import TaskCard from "@/components/TaskCard";
import Filters, { EMPTY_FILTER, applyFilters, type FilterState } from "@/components/Filters";
import { TaskDetailDialog } from "@/components/dialogs";
import { EmptyState } from "@/components/ui";
import { istVerteilt, type Task } from "@/lib/types";

export default function VerteiltPage() {
  const { bereit, visibleTasks, me, isAdmin } = useStore();
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [detail, setDetail] = useState<Task | null>(null);

  // Wer kein Admin ist, sieht das, wofuer er selbst geradesteht. Die
  // Zeilensicherheit in der Datenbank entscheidet ohnehin, was ueberhaupt
  // ankommt - das hier ist nur die Frage, was davon auf DIESE Seite
  // gehoert.
  const meine = visibleTasks.filter(
    (t) => istVerteilt(t) && (isAdmin || t.creatorId === me.id),
  );
  const liste = applyFilters(meine, filter);

  // Nach Bearbeiter gruppieren: so sieht man auf einen Blick, wo wie viel
  // liegt, statt eine lange Reihe gleich aussehender Kacheln.
  const nachPerson = new Map<string, Task[]>();
  for (const t of liste) {
    const name = t.onofficeAssignee ?? "(ohne Namen)";
    nachPerson.set(name, [...(nachPerson.get(name) ?? []), t]);
  }
  const gruppen = [...nachPerson.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "de"),
  );

  if (!bereit) return <p className="muted text-sm">Lade die verteilten Aufgaben…</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h1 className="text-lg font-semibold">Verteilt</h1>
        <p className="muted text-xs">
          Du hast die Verantwortung, bearbeitet wird in onOffice von jemandem
          außerhalb des Tools.
        </p>
      </div>

      <Filters value={filter} onChange={setFilter} showAssignee={false} />

      {liste.length === 0 ? (
        <EmptyState text="Nichts verteilt – oder alles zurück." />
      ) : (
        <div className="space-y-5">
          {gruppen.map(([name, aufgaben]) => (
            <section key={name}>
              <h2 className="muted mb-2 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-wide">
                {name}
                <span className="chip" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
                  {aufgaben.length}
                </span>
              </h2>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {aufgaben.map((t) => (
                  <TaskCard key={t.id} task={t} onOpen={setDetail} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="muted mt-5 max-w-[70ch] text-[11px] leading-relaxed">
        Übernehmen lässt sich hier nichts: in onOffice steht ein Bearbeiter, und
        ihn von hier aus zu überschreiben hieße, jemandem die Arbeit wegzunehmen,
        der vielleicht schon mittendrin ist. Wer eine dieser Aufgaben an sich
        ziehen will, ändert den Bearbeiter in onOffice – beim nächsten Abgleich
        ist sie hier.
      </p>

      {detail ? <TaskDetailDialog task={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}
