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
  const { me, visibleTasks, moveTask, claimTask } = useStore();
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [detail, setDetail] = useState<Task | null>(null);
  const [noteFor, setNoteFor] = useState<Task | null>(null);

  const mine = applyFilters(
    visibleTasks.filter((t) => t.assigneeId === me.id),
    filter,
  );
  const pool = visibleTasks.filter((t) => t.isPool && t.assigneeId === null);

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
            Für alle sichtbar. Übernehmen setzt dich als Bearbeiter – danach verschwindet die Aufgabe
            hier für die anderen.
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

      <Filters value={filter} onChange={setFilter} showAssignee={false} />

      <Board tasks={mine} onOpen={setDetail} onDropTask={onDropTask} />

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
