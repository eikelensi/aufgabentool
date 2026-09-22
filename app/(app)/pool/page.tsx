"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import TaskCard from "@/components/TaskCard";
import Filters, { EMPTY_FILTER, applyFilters, type FilterState } from "@/components/Filters";
import { TaskDetailDialog } from "@/components/dialogs";
import { EmptyState } from "@/components/ui";
import type { Task } from "@/lib/types";


export default function PoolPage() {
  const { bereit, visibleTasks, claimTask } = useStore();
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [detail, setDetail] = useState<Task | null>(null);

  const pool = applyFilters(
    visibleTasks.filter((t) => t.isPool && t.assigneeId === null),
    filter,
  );

  if (!bereit) return <p className="muted text-sm">Lade den Aufgabenpool…</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h1 className="text-lg font-semibold">Aufgabenpool</h1>
        <p className="muted text-xs">
          Unbesetzte Aufgaben, die sich jede und jeder nach Kapazität herausziehen kann.
        </p>
      </div>

      <Filters value={filter} onChange={setFilter} showAssignee={false} />

      {pool.length === 0 ? (
        <EmptyState text="Aktuell liegt nichts im Pool." />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pool.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onOpen={setDetail}
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
          ))}
        </div>
      )}


      {detail ? <TaskDetailDialog task={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}
