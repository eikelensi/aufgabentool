"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import Board from "@/components/Board";
import TaskCard from "@/components/TaskCard";
import Filters, { EMPTY_FILTER, applyFilters, type FilterState } from "@/components/Filters";
import { NoteDialog, TaskDetailDialog } from "@/components/dialogs";
import { EmptyState } from "@/components/ui";
import type { Task, TaskStatus } from "@/lib/types";

export default function MeinTagPage() {
  const { bereit, me, visibleTasks, moveTask, claimTask, sortiere, wartendeEigene } =
    useStore();
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [detail, setDetail] = useState<Task | null>(null);
  const [noteFor, setNoteFor] = useState<Task | null>(null);

  const mine = applyFilters(
    visibleTasks.filter((t) => t.assigneeId === me.id),
    filter,
  );
  // Dieselbe Reihenfolge wie im Aufgabenpool: aelteste links. Zwei
  // Ansichten desselben Stapels duerfen ihn nicht verschieden
  // sortieren, sonst sucht man zweimal.
  const pool = visibleTasks
    .filter((t) => t.isPool && t.assigneeId === null && t.status !== "erledigt")
    .sort((a, b) => {
      const links = a.poolSeit ? new Date(a.poolSeit).getTime() : Infinity;
      const rechts = b.poolSeit ? new Date(b.poolSeit).getTime() : Infinity;
      return links - rechts;
    });

  const onDropTask = (taskId: string, status: TaskStatus) => {
    const task = visibleTasks.find((t) => t.id === taskId);
    if (!task) return;
    if (status === "in_bearbeitung") {
      setNoteFor(task);
      return;
    }
    moveTask(taskId, status);
  };

  const offen = mine.filter((t) => t.status === "offen").length;
  const hoch = mine.filter((t) => t.priority === "hoch" && t.status !== "erledigt").length;

  if (!bereit) return <p className="muted text-sm">Lade deine Aufgaben…</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h1 className="text-lg font-semibold">Mein Tag</h1>
        <p className="muted text-xs">
          {offen} offen · {hoch} mit hoher Priorität · {pool.length} im Pool verfügbar
        </p>
      </div>

      {/* Trichter: oben der Eingang, darunter das eigene Board */}
      <section className="panel mb-4 p-3">
        <header className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-[13px] font-semibold">Aufgabeneingang · Pool</h2>
          <span className="muted text-[11px]">
            Für alle sichtbar, die älteste links. Übernehmen setzt dich als Bearbeiter – danach
            verschwindet die Aufgabe hier für die anderen.
          </span>
        </header>
        {pool.length === 0 ? (
          <EmptyState text="Der Pool ist leer." />
        ) : (
          <div className="scroll-x flex gap-2.5 pb-1">
            {pool.map((t) => (
              <div key={t.id} className="w-[260px] shrink-0">
                <TaskCard
                  task={t}
                  onOpen={setDetail}
                  compact
                  action={
                    <button
                      className="btn btn-primary w-full justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        claimTask(t.id);
                      }}
                    >
                      Übernehmen
                    </button>
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Der Trichter arbeitet still: was noch nicht dran ist, steht
          gar nicht erst auf dem Board. Verschwiegen wird es trotzdem
          nicht - sonst wirkt der leere Tisch wie ein Versehen. */}
      {wartendeEigene > 0 ? (
        <p
          className="line mb-3 rounded-lg border px-3 py-2 text-[11px] leading-relaxed"
          style={{ background: "var(--info-bg)", color: "var(--info-fg)" }}
        >
          <strong>
            {wartendeEigene === 1
              ? "Eine weitere Aufgabe wartet auf dich."
              : `${wartendeEigene} weitere Aufgaben warten auf dich.`}
          </strong>{" "}
          Sie sind dir schon zugeteilt, kommen aber erst nach und nach auf dein
          Board – die nächste rückt nach, sobald du eine hier abschließt.
        </p>
      ) : null}

      <Filters value={filter} onChange={setFilter} showAssignee={false} />

      {/* Ziehen heisst hier zweierlei: in eine andere Spalte schieben
          aendert den Status, innerhalb einer Spalte aendert es die
          Reihenfolge. Wer seinen Tag ordnet, will oben haben, was
          zuerst drankommt. */}
      <Board
        tasks={mine}
        onOpen={setDetail}
        onDropTask={onDropTask}
        onSort={(taskId, vorTaskId, spalte) => void sortiere(taskId, vorTaskId, spalte)}
      />

      {mine.length === 0 ? (
        <p className="muted mt-3 text-xs">
          Keine Aufgaben für dich – entweder ist alles erledigt oder die Filter greifen. Aufgaben mit
          einem Startdatum in der Zukunft erscheinen hier erst ab diesem Tag.
        </p>
      ) : null}

      {detail ? <TaskDetailDialog task={detail} onClose={() => setDetail(null)} /> : null}
      {noteFor ? <NoteDialog task={noteFor} onClose={() => setNoteFor(null)} /> : null}
    </div>
  );
}
