"use client";

import React, { useState } from "react";
import type { Task, TaskStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import TaskCard from "./TaskCard";
import { EmptyState } from "./ui";

const COLUMNS: { status: TaskStatus; accent: string; hint: string }[] = [
  { status: "offen", accent: "#94a3b8", hint: "Noch nicht angefasst" },
  { status: "in_bearbeitung", accent: "var(--warn-fg)", hint: "Notiz erforderlich" },
  { status: "erledigt", accent: "#88cc44", hint: "Fertig" },
];

export default function Board({
  tasks,
  onOpen,
  onDropTask,
  showAssignee = false,
  readOnly = false,
}: {
  tasks: Task[];
  onOpen: (t: Task) => void;
  onDropTask: (taskId: string, status: TaskStatus) => void;
  showAssignee?: boolean;
  readOnly?: boolean;
}) {
  const [over, setOver] = useState<TaskStatus | null>(null);

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = tasks.filter((t) => t.status === col.status);
        return (
          <section
            key={col.status}
            onDragOver={(e) => {
              if (readOnly) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOver(col.status);
            }}
            onDragLeave={() => setOver((s) => (s === col.status ? null : s))}
            onDrop={(e) => {
              if (readOnly) return;
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/plain");
              if (id) onDropTask(id, col.status);
            }}
            className={`panel flex min-h-[220px] flex-col gap-2 p-2.5 ${over === col.status ? "dropzone-active" : ""}`}
            style={{ background: "var(--panel-2)" }}
          >
            <header className="flex items-center gap-2 px-0.5">
              <span
                aria-hidden
                style={{ width: 8, height: 8, borderRadius: 99, background: col.accent }}
              />
              <h3 className="text-[13px] font-semibold">{STATUS_LABEL[col.status]}</h3>
              <span className="muted text-[11px]">{items.length}</span>
              <span className="muted ml-auto text-[10px]">{col.hint}</span>
            </header>

            {items.length === 0 ? (
              <EmptyState text={readOnly ? "Keine Aufgaben" : "Aufgabe hierher ziehen"} />
            ) : (
              items.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onOpen={onOpen}
                  onDragStart={readOnly ? undefined : () => undefined}
                  showAssignee={showAssignee}
                  compact
                />
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
