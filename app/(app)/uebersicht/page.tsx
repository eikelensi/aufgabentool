"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import Board from "@/components/Board";
import TaskCard from "@/components/TaskCard";
import Filters, { EMPTY_FILTER, applyFilters, type FilterState } from "@/components/Filters";
import { NoteDialog, TaskDetailDialog } from "@/components/dialogs";
import { Avatar, EmptyState } from "@/components/ui";
import type { Task, TaskStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";

type Tab = "tag" | "person" | "kategorie";

const STATUSES: TaskStatus[] = ["offen", "in_bearbeitung", "erledigt"];

export default function UebersichtPage() {
  const { bereit, isAdmin, visibleTasks, profiles, categories, moveTask, updateTask, verschiebe } =
    useStore();
  const [tab, setTab] = useState<Tab>("tag");
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  // Kein profiles[0].id: beim ersten Rendern ist die Liste noch leer.
  const [person, setPerson] = useState("");
  const [detail, setDetail] = useState<Task | null>(null);
  const [noteFor, setNoteFor] = useState<Task | null>(null);
  const [over, setOver] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <p className="muted text-sm">
        Diese Ansicht ist Admins und Vorgesetzten vorbehalten.
      </p>
    );
  }

  if (!bereit) {
    return <p className="muted text-sm">Lade Aufgaben…</p>;
  }

  const tasks = applyFilters(visibleTasks, filter);
  const personId = person || profiles[0]?.id || "";

  const dropInto = (taskId: string, assigneeId: string | null, status: TaskStatus) => {
    const task = visibleTasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.assigneeId !== assigneeId) {
      updateTask(taskId, { assigneeId, isPool: assigneeId === null });
    }
    if (task.status === status) return;
    if (status === "in_bearbeitung") {
      setNoteFor(task);
      return;
    }
    moveTask(taskId, status);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Übersicht</h1>
        <div className="flex gap-1">
          {(
            [
              ["tag", "Tagesübersicht nach Mitarbeitenden"],
              ["person", "Einzelansicht"],
              ["kategorie", "Nach Kategorien"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className="btn"
              style={
                tab === key
                  ? { background: "var(--color-ci-400)", borderColor: "var(--color-ci-500)", color: "var(--auf-akzent)" }
                  : undefined
              }
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Filters value={filter} onChange={setFilter} showAssignee={tab !== "person"} />

      {tab === "tag" ? (
        <div className="scroll-x">
          <div style={{ minWidth: 900 }}>
            <div className="mb-1.5 grid gap-2" style={{ gridTemplateColumns: "170px repeat(3, 1fr)" }}>
              <div />
              {STATUSES.map((s) => (
                <div key={s} className="muted px-1 text-[11px] font-semibold uppercase tracking-wide">
                  {STATUS_LABEL[s]}
                </div>
              ))}
            </div>

            {/* Eingangsbahn */}
            <Lane
              key="pool"
              label="Aufgabeneingang"
              sub="unbesetzt"
              tasks={tasks.filter((t) => t.isPool && t.assigneeId === null)}
              assigneeId={null}
              over={over}
              setOver={setOver}
              onDrop={dropInto}
              onOpen={setDetail}
              onVerschiebe={verschiebe}
            />

            {profiles.map((p) => (
              <Lane
                key={p.id}
                label={p.fullName}
                sub={p.role === "mitarbeiter" ? "Mitarbeiter" : "Admin"}
                avatar={<Avatar profile={p} size={22} />}
                tasks={tasks.filter((t) => t.assigneeId === p.id)}
                assigneeId={p.id}
                over={over}
                setOver={setOver}
                onDrop={dropInto}
                onOpen={setDetail}
                onVerschiebe={verschiebe}
              />
            ))}
          </div>
          <p className="muted mt-2 text-[11px]">
            Karten lassen sich zwischen Status <em>und</em> zwischen Mitarbeitenden ziehen – so wird bei
            Krankheit oder Ausfall in einem Zug neu verteilt. Mit den Pfeilen bringst du sie
            innerhalb einer Spalte in deine eigene Reihenfolge; die bleibt erhalten.
          </p>
        </div>
      ) : null}

      {tab === "person" ? (
        <div>
          <select
            className="field mb-3"
            style={{ width: 220 }}
            value={personId}
            onChange={(e) => setPerson(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
          <Board
            tasks={tasks.filter((t) => t.assigneeId === personId)}
            onOpen={setDetail}
            onDropTask={(id, status) => dropInto(id, personId, status)}
          />
        </div>
      ) : null}

      {tab === "kategorie" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...categories]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .concat([{ id: "__none", name: "Ohne Kategorie", color: "#94a3b8", sortOrder: 999, isActive: true }])
            .map((c) => {
              const items = tasks.filter((t) =>
                c.id === "__none" ? !t.categoryId : t.categoryId === c.id,
              );
              if (items.length === 0) return null;
              return (
                <section key={c.id} className="panel p-2.5" style={{ background: "var(--panel-2)" }}>
                  <header className="mb-2 flex items-center gap-2">
                    <span
                      aria-hidden
                      style={{ width: 9, height: 9, borderRadius: 99, background: c.color }}
                    />
                    <h3 className="text-[13px] font-semibold">{c.name}</h3>
                    <span className="muted text-[11px]">{items.length}</span>
                  </header>
                  <div className="grid gap-2">
                    {items.map((t) => (
                      <TaskCard key={t.id} task={t} onOpen={setDetail} showAssignee compact />
                    ))}
                  </div>
                </section>
              );
            })}
        </div>
      ) : null}

      {detail ? <TaskDetailDialog task={detail} onClose={() => setDetail(null)} /> : null}
      {noteFor ? <NoteDialog task={noteFor} onClose={() => setNoteFor(null)} /> : null}
    </div>
  );
}

function Lane({
  label,
  sub,
  avatar,
  tasks,
  assigneeId,
  over,
  setOver,
  onDrop,
  onOpen,
  onVerschiebe,
}: {
  label: string;
  sub: string;
  avatar?: React.ReactNode;
  tasks: Task[];
  assigneeId: string | null;
  over: string | null;
  setOver: (v: string | null) => void;
  onDrop: (taskId: string, assigneeId: string | null, status: TaskStatus) => void;
  onOpen: (t: Task) => void;
  onVerschiebe: (taskId: string, richtung: -1 | 1, inListe: Task[]) => Promise<unknown>;
}) {
  const key = assigneeId ?? "pool";
  return (
    <div className="mb-2 grid gap-2" style={{ gridTemplateColumns: "170px repeat(3, 1fr)" }}>
      <div className="panel flex items-center gap-2 p-2" style={{ background: "var(--panel-2)" }}>
        {avatar}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">{label}</p>
          <p className="muted text-[11px]">
            {sub} · {tasks.filter((t) => t.status !== "erledigt").length} aktiv
          </p>
        </div>
      </div>
      {STATUSES.map((s) => {
        const cellKey = `${key}:${s}`;
        const items = tasks.filter((t) => t.status === s);
        return (
          <div
            key={s}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(cellKey);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/plain");
              if (id) onDrop(id, assigneeId, s);
            }}
            className={`panel min-h-[64px] space-y-1.5 p-1.5 ${over === cellKey ? "dropzone-active" : ""}`}
            style={{ background: "var(--panel-2)" }}
          >
            {items.map((t, i) => (
              <div key={t.id} className="flex items-stretch gap-1">
                <div className="min-w-0 flex-1">
                  <TaskCard task={t} onOpen={onOpen} onDragStart={() => undefined} compact />
                </div>
                {/* Eigene Reihenfolge: Ziehen verschiebt zwischen Status und
                    Mitarbeitenden, die Pfeile ordnen innerhalb der Spalte. */}
                <div className="flex flex-col justify-center gap-0.5">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: "0 0.25rem", fontSize: 10, lineHeight: 1.2 }}
                    disabled={i === 0}
                    title="Nach oben"
                    aria-label={`„${t.title}“ nach oben`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void onVerschiebe(t.id, -1, items);
                    }}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: "0 0.25rem", fontSize: 10, lineHeight: 1.2 }}
                    disabled={i === items.length - 1}
                    title="Nach unten"
                    aria-label={`„${t.title}“ nach unten`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void onVerschiebe(t.id, 1, items);
                    }}
                  >
                    ▼
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 ? <div className="muted p-1 text-[11px]">–</div> : null}
          </div>
        );
      })}
    </div>
  );
}
