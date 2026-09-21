"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import TaskCard from "@/components/TaskCard";
import Filters, { EMPTY_FILTER, applyFilters, type FilterState } from "@/components/Filters";
import { NewTaskDialog, TaskDetailDialog, type Prefill } from "@/components/dialogs";
import { EmptyState } from "@/components/ui";
import type { Task } from "@/lib/types";

const INBOX: Prefill[] = [
  {
    title: "Nachweis Wohnflächenberechnung anfordern – Talstraße 7",
    description:
      "Aus E-Mail von hausverwaltung@talstrasse7.de: „Bitte senden Sie uns die aktuelle Wohnflächenberechnung zu.“",
    source: "email",
    onofficeEstateNo: "OBJ-2431",
    fromEmail: "hausverwaltung@talstrasse7.de",
  },
  {
    title: "Rückruf Interessentin Frau Krause",
    description:
      "Aus E-Mail von k.krause@web.de: Bittet um Rückruf wegen Besichtigungstermin am Wochenende.",
    source: "email",
    fromEmail: "k.krause@web.de",
  },
];

export default function PoolPage() {
  const { bereit, visibleTasks, claimTask, isAdmin } = useStore();
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [detail, setDetail] = useState<Task | null>(null);
  const [prefill, setPrefill] = useState<Prefill | null>(null);

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

      <section className="panel mt-6 p-3">
        <header className="mb-2">
          <h2 className="text-[13px] font-semibold">Posteingang der Assistenz (onOffice)</h2>
          <p className="muted text-[11px]">
            Aus einer eingehenden Mail wird eine Aufgabe, das
            Formular ist mit Betreff, Text und – falls erkennbar – der Objektnummer vorbefüllt.
          </p>
        </header>
        <ul className="grid gap-2 sm:grid-cols-2">
          {INBOX.map((mail) => (
            <li key={mail.title} className="panel p-2.5" style={{ background: "var(--panel-2)" }}>
              <p className="text-[13px] font-medium">{mail.title}</p>
              <p className="muted mt-1 text-[11px]">Von: {mail.fromEmail}</p>
              <button className="btn mt-2" onClick={() => setPrefill(mail)}>
                Aufgabe daraus erstellen
              </button>
            </li>
          ))}
        </ul>
        {!isAdmin ? (
          <p className="muted mt-2 text-[11px]">
            Hinweis: Als Mitarbeitende(r) legst du die Aufgabe für dich selbst an. Admins können sie
            direkt zuweisen oder in den Pool legen.
          </p>
        ) : null}
      </section>

      {detail ? <TaskDetailDialog task={detail} onClose={() => setDetail(null)} /> : null}
      {prefill ? <NewTaskDialog prefill={prefill} onClose={() => setPrefill(null)} /> : null}
    </div>
  );
}
