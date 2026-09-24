"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import TaskCard from "@/components/TaskCard";
import { TaskDetailDialog } from "@/components/dialogs";
import { EmptyState, formatDate } from "@/components/ui";
import type { Task } from "@/lib/types";

/**
 * Das Archiv.
 *
 * Erledigtes verschwindet nach zwei Tagen aus dem Tagesgeschaeft -
 * nicht, weil es unwichtig waere, sondern weil ein Board, das jede
 * abgehakte Aufgabe behaelt, nach einem Monat niemandem mehr hilft.
 * Hier liegt alles weiter, nach Datum, mit Suche. Wer wissen will, was
 * er letzte Woche gemacht hat, sieht hier nach - und wer eine Aufgabe
 * zu frueh abgehakt hat, macht sie hier wieder auf.
 */
export default function ArchivPage() {
  const { bereit, archivTasks, me, isAdmin, profileById } = useStore();
  const [suche, setSuche] = useState("");
  const [nurMeine, setNurMeine] = useState(!isAdmin);
  const [detail, setDetail] = useState<Task | null>(null);

  const gefiltert = useMemo(() => {
    const text = suche.trim().toLowerCase();
    return archivTasks.filter((t) => {
      if (nurMeine && t.assigneeId !== me.id && t.creatorId !== me.id) return false;
      if (!text) return true;
      return (
        t.title.toLowerCase().includes(text) ||
        (t.description ?? "").toLowerCase().includes(text) ||
        (t.onofficeTaskId ?? "").includes(text)
      );
    });
  }, [archivTasks, nurMeine, suche, me.id]);

  // Nach Tagen gruppiert: "wann war das" ist die Frage, mit der man
  // ins Archiv kommt, nicht "wie hiess es".
  const nachTag = useMemo(() => {
    const karten = new Map<string, Task[]>();
    for (const t of gefiltert) {
      const tag = (t.completedAt ?? t.createdAt).slice(0, 10);
      const liste = karten.get(tag) ?? [];
      liste.push(t);
      karten.set(tag, liste);
    }
    return [...karten.entries()];
  }, [gefiltert]);

  if (!bereit) return <p className="muted text-xs">Lade…</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-base font-semibold">Archiv</h1>
        <span className="muted text-[11px]">
          Erledigtes, das älter als zwei Tage ist · {archivTasks.length} Aufgaben
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field"
          style={{ maxWidth: 320 }}
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Suchen – Betreff, Text oder Aufgabennummer"
        />
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={nurMeine}
            onChange={(e) => setNurMeine(e.target.checked)}
          />
          nur meine
        </label>
      </div>

      {nachTag.length === 0 ? (
        <EmptyState text="Hier liegt noch nichts. Erledigte Aufgaben wandern nach zwei Tagen hierher." />
      ) : (
        nachTag.map(([tag, karten]) => (
          <section key={tag} className="flex flex-col gap-2">
            <h2 className="muted text-[11px] font-semibold tracking-wide uppercase">
              {formatDate(tag)} · {karten.length}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {karten.map((t) => (
                <div key={t.id}>
                  <TaskCard task={t} onOpen={setDetail} showAssignee compact />
                  {t.assigneeId ? (
                    <p className="muted mt-0.5 text-[10px]">
                      zuletzt bei {profileById(t.assigneeId)?.fullName ?? "unbekannt"}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {detail ? <TaskDetailDialog task={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}
