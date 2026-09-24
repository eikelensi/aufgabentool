"use client";

import React from "react";
import { useStore } from "@/lib/store";
import { istVerteilt, type Task } from "@/lib/types";
import { Avatar, CategoryChip, PriorityChip, daysSince, formatDate } from "./ui";

export default function TaskCard({
  task,
  onOpen,
  onDragStart,
  showAssignee = false,
  compact = false,
  winzig = false,
  abhaken,
  action,
}: {
  task: Task;
  onOpen: (t: Task) => void;
  onDragStart?: (t: Task) => void;
  showAssignee?: boolean;
  compact?: boolean;
  /**
   * Eine Zeile statt einer Karte - fuer den Team-Bereich, wo zwoelf
   * Spalten nebeneinander stehen. Hier zaehlt nicht, was an einer
   * Aufgabe alles dranhaengt, sondern wie viele davon jemand hat und
   * ob etwas brennt. Alles Weitere steht einen Klick entfernt im
   * Aufgabenfenster.
   */
  winzig?: boolean;
  /**
   * Haken vor dem Titel: erledigen, ohne die Aufgabe aufzumachen.
   *
   * Es gibt Aufgaben, bei denen das Oeffnen der eigentliche Aufwand
   * ist - "Rechnung abgelegt", "angerufen". Wer erst klicken, lesen,
   * einen Knopf suchen und wieder schliessen muss, laesst sie lieber
   * stehen. Ein zweiter Klick nimmt es zurueck.
   */
  abhaken?: (t: Task) => void;
  action?: React.ReactNode;
}) {
  const { categoryById, profileById, brokerById, kollegeNachKuerzel, settings } = useStore();
  const category = categoryById(task.categoryId);
  const assignee = profileById(task.assigneeId);
  const broker = brokerById(task.brokerContactId);
  const age = daysSince(task.createdAt);
  const overdue = task.dueDate ? task.dueDate < new Date().toISOString().slice(0, 10) : false;

  const fertig = task.status === "erledigt";

  const haken = abhaken ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        abhaken(task);
      }}
      title={fertig ? "Wieder öffnen" : "Erledigt"}
      aria-label={fertig ? `„${task.title}“ wieder öffnen` : `„${task.title}“ erledigen`}
      aria-pressed={fertig}
      className="haken shrink-0"
      style={
        fertig
          ? { background: "var(--ok-fg)", borderColor: "var(--ok-fg)", color: "var(--auf-akzent)" }
          : undefined
      }
    >
      ✓
    </button>
  ) : null;

  const ziehen = {
    draggable: Boolean(onDragStart),
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", task.id);
      e.dataTransfer.effectAllowed = "move";
      onDragStart?.(task);
    },
  };

  if (winzig) {
    return (
      <article
        {...ziehen}
        onClick={() => onOpen(task)}
        title={task.title}
        className={`panel ${task.priority === "hoch" ? "card-hoch" : ""} cursor-pointer px-1.5 py-1 text-left transition hover:border-[color:var(--color-ci-400)]`}
        style={{ background: "var(--panel)" }}
      >
        <div className="flex items-center gap-1.5">
          {haken}
          {category ? (
            <span
              aria-hidden
              title={category.name}
              className="shrink-0"
              style={{ width: 6, height: 6, borderRadius: 99, background: category.color }}
            />
          ) : null}
          <span className="min-w-0 flex-1 truncate text-[12px] leading-tight font-medium">
            {task.title}
          </span>
          {showAssignee ? <Avatar profile={assignee} size={16} /> : null}
        </div>

        {/* Zweite Zeile nur, wenn es etwas zu sagen gibt. Eine leere
            Zeile kostet bei zwanzig Karten mehr Platz als sie wert ist. */}
        {task.priority !== "normal" ||
        task.dueDate ||
        task.isPrivate ||
        task.attachments.length > 0 ||
        task.onofficeTaskId ? (
          <div className="muted mt-0.5 flex items-center gap-1.5 text-[10px] leading-none">
            {task.priority === "hoch" ? (
              <span style={{ color: "var(--err-fg)", fontWeight: 700 }} title="Hohe Priorität">
                ▲
              </span>
            ) : task.priority === "niedrig" ? (
              <span title="Niedrige Priorität">▼</span>
            ) : null}
            {task.onofficeTaskId ? <span>#{task.onofficeTaskId}</span> : null}
            {task.dueDate ? (
              <span
                style={
                  overdue && task.status !== "erledigt"
                    ? { color: "var(--err-fg)", fontWeight: 700 }
                    : undefined
                }
              >
                {formatDate(task.dueDate)}
              </span>
            ) : null}
            {task.attachments.length > 0 ? <span>📎{task.attachments.length}</span> : null}
            {task.isPrivate ? <span title="Privat">🔒</span> : null}
            {task.status === "offen" && !task.isPrivate && age >= settings.escalationDays ? (
              <span style={{ color: "var(--err-fg)", fontWeight: 700 }} title={`${age} Tage offen`}>
                ⚠︎{age}
              </span>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <article
      draggable={Boolean(onDragStart)}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(task);
      }}
      onClick={() => onOpen(task)}
      className={`panel ${task.priority === "hoch" ? "card-hoch" : ""} cursor-pointer p-2.5 text-left transition hover:border-[color:var(--color-ci-400)]`}
      style={{ background: "var(--panel)" }}
    >
      <div className="flex items-start justify-between gap-2">
        {haken}
        <h4
          className={`flex-1 font-medium leading-snug ${compact ? "text-[13px]" : "text-sm"}`}
          style={fertig ? { textDecoration: "line-through", opacity: 0.6 } : undefined}
        >
          {task.title}
        </h4>
        {showAssignee ? <Avatar profile={assignee} size={22} /> : null}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {task.onofficeTaskId ? (
          <span
            className="chip"
            style={{ background: "var(--panel-2)", color: "var(--muted)" }}
            title="Aufgabennummer in onOffice – danach lässt sich oben suchen"
          >
            #{task.onofficeTaskId}
          </span>
        ) : null}
        <PriorityChip priority={task.priority} />
        <CategoryChip category={category} />
        {task.isPrivate ? (
          <span className="chip" style={{ background: "var(--privat-bg)", color: "var(--privat-fg)" }}>
            🔒 Privat
          </span>
        ) : null}
        {task.onofficeEstateNo ? (
          <span className="chip" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
            🏠 {task.onofficeEstateNo}
          </span>
        ) : null}
        {task.onofficeAddressId ? (
          <span className="chip" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
            👤 {task.onofficeAddressId}
          </span>
        ) : null}
        {task.source === "email" ? (
          <span className="chip" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
            ✉️ aus Mail
          </span>
        ) : null}
        {/* In onOffice steht ein Bearbeiter, den das Tool nicht kennt.
            Ohne diesen Hinweis saehe die Aufgabe aus wie herrenlos -
            dabei sitzt jemand daran, nur nicht hier. */}
        {istVerteilt(task) ? (
          <span
            className="chip"
            style={{ background: "var(--info-bg)", color: "var(--info-fg)" }}
            title={`In onOffice als Bearbeiter eingetragen: ${task.onofficeAssignee}`}
          >
            {/* Die Schnittstelle liefert nur das Kuerzel. Steht der
                Kollege in der Mitarbeiterverwaltung, zeigen wir seinen
                Namen - "BaufiErcan" sagt niemandem etwas. */}
            → {kollegeNachKuerzel(task.onofficeAssignee)?.displayName ?? task.onofficeAssignee}
          </span>
        ) : null}
        {task.attachments.length > 0 ? (
          <span
            className="chip"
            style={{ background: "var(--panel-2)", color: "var(--muted)" }}
            title={task.attachments.map((a) => a.fileName).join(", ")}
          >
            📎 {task.attachments.length}
          </span>
        ) : null}
      </div>

      {/* Warum die Aufgabe zurueckkam - genau dort, wo jemand
          ueberlegt, ob er sie sich zieht. */}
      {task.isPool && task.poolGrund ? (
        <p
          className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed"
          style={{ color: "var(--warn-fg)" }}
          title={task.poolGrund}
        >
          ↩︎ zurückgelegt: {task.poolGrund}
        </p>
      ) : null}

      {task.inProgressNote && task.status === "in_bearbeitung" ? (
        <p className="muted mt-1.5 line-clamp-2 text-[11px] italic">„{task.inProgressNote}“</p>
      ) : null}

      <div className="muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {task.dueDate ? (
          <span style={overdue && task.status !== "erledigt" ? { color: "var(--err-fg)", fontWeight: 600 } : undefined}>
            📅 {formatDate(task.dueDate)}
          </span>
        ) : null}
        {broker ? (
          <span title={`Auftrag von ${broker.displayName}`}>🤝 {broker.displayName}</span>
        ) : null}
        {task.status === "offen" && !task.isPrivate && age >= settings.escalationDays ? (
          <span style={{ color: "var(--err-fg)", fontWeight: 600 }}>⚠︎ {age} Tage offen</span>
        ) : task.status === "offen" && !task.isPrivate && age >= settings.reminderDays ? (
          <span style={{ color: "var(--warn-fg)", fontWeight: 600 }}>⏰ {age} Tage offen</span>
        ) : null}
      </div>

      {action ? <div className="mt-2">{action}</div> : null}
    </article>
  );
}
