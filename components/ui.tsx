"use client";

import React from "react";
import type { Category, Profile, TaskPriority, TaskStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";

export function Avatar({ profile, size = 26 }: { profile?: Profile; size?: number }) {
  if (!profile) {
    return (
      <span
        title="Unbesetzt"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        className="muted inline-flex shrink-0 items-center justify-center rounded-full border border-dashed"
      >
        ?
      </span>
    );
  }
  return (
    <span
      title={profile.fullName}
      style={{
        width: size,
        height: size,
        background: profile.color,
        fontSize: size * 0.4,
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
    >
      {profile.initials}
    </span>
  );
}

export function PriorityChip({ priority }: { priority: TaskPriority }) {
  if (priority === "normal") return null;
  return (
    <span className="chip" style={{ background: "var(--err-bg)", color: "var(--err-fg)" }}>
      ▲ Hoch
    </span>
  );
}

export function CategoryChip({ category }: { category?: Category }) {
  if (!category) return null;
  return (
    <span
      className="chip"
      style={{
        background: `color-mix(in srgb, ${category.color} 18%, transparent)`,
        color: category.color,
        border: `1px solid color-mix(in srgb, ${category.color} 45%, transparent)`,
      }}
    >
      <span
        aria-hidden
        style={{ width: 7, height: 7, borderRadius: 99, background: category.color }}
      />
      {category.name}
    </span>
  );
}

const STATUS_STYLE: Record<TaskStatus, { bg: string; fg: string }> = {
  offen: { bg: "var(--neutral-bg)", fg: "var(--neutral-fg)" },
  in_bearbeitung: { bg: "var(--warn-bg)", fg: "var(--warn-fg)" },
  erledigt: { bg: "var(--ok-bg)", fg: "var(--ok-fg)" },
};

export function StatusChip({ status }: { status: TaskStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="chip" style={{ background: s.bg, color: s.fg }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      style={{ background: "rgba(15, 23, 12, 0.45)" }}
      onClick={onClose}
    >
      <div
        className="panel w-full"
        style={{ maxWidth: wide ? 760 : 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="line flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="muted mb-1 block text-xs font-medium">{label}</span>
      {children}
      {hint ? <span className="muted mt-1 block text-[11px]">{hint}</span> : null}
    </label>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="muted line rounded-lg border border-dashed px-3 py-6 text-center text-xs">
      {text}
    </div>
  );
}
