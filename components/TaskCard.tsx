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
  action,
}: {
  task: Task;
  onOpen: (t: Task) => void;
  onDragStart?: (t: Task) => void;
  showAssignee?: boolean;
  compact?: boolean;
  action?: React.ReactNode;
}) {
  const { categoryById, profileById, brokerById, settings } = useStore();
  const category = categoryById(task.categoryId);
  const assignee = profileById(task.assigneeId);
  const broker = brokerById(task.brokerContactId);
  const age = daysSince(task.createdAt);
  const overdue = task.dueDate ? task.dueDate < new Date().toISOString().slice(0, 10) : false;

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
        <h4 className={`font-medium leading-snug ${compact ? "text-[13px]" : "text-sm"}`}>
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
            → {task.onofficeAssignee}
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

      {task.inProgressNote && task.status === "in_bearbeitung" ? (
        <p className="muted mt-1.5 line-clamp-2 text-[11px] italic">„{task.inProgressNote}“</p>
      ) : null}

      <div className="muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {task.dueDate ? (
          <span style={overdue && task.status !== "erledigt" ? { color: "var(--err-fg)", fontWeight: 600 } : undefined}>
            📅 {formatDate(task.dueDate)}
          </span>
        ) : null}
        {broker ? <span>🤝 {broker.shortCode}</span> : null}
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
