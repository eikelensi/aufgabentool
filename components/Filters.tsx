"use client";

import React from "react";
import { useStore } from "@/lib/store";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";

export interface FilterState {
  q: string;
  assignee: string; // "" = alle
  category: string;
  priority: "" | TaskPriority;
  status: "" | TaskStatus;
  date: "heute" | "woche" | "alle";
}

export const EMPTY_FILTER: FilterState = {
  q: "",
  assignee: "",
  category: "",
  priority: "",
  status: "",
  date: "alle",
};

export function applyFilters(tasks: Task[], f: FilterState): Task[] {
  const today = new Date().toISOString().slice(0, 10);
  const inWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

  return tasks.filter((t) => {
    if (f.q) {
      const suche = f.q.trim().toLowerCase().replace(/^#/, "");

      // Eine reine Ziffernfolge meint fast immer die Aufgabennummer.
      // Dann exakt vergleichen statt irgendwo im Text zu suchen - sonst
      // findet "219" auch jede Aufgabe, in deren Beschreibung 219 steht.
      if (/^\d+$/.test(suche)) {
        if (String(t.onofficeTaskId ?? "") !== suche) return false;
      } else {
        const hay = `${t.title} ${t.description ?? ""} ${t.onofficeTaskId ?? ""} ${
          t.onofficeEstateNo ?? ""
        } ${t.onofficeAddressId ?? ""}`.toLowerCase();
        if (!hay.includes(suche)) return false;
      }
    }
    if (f.assignee && t.assigneeId !== f.assignee) return false;
    if (f.category && t.categoryId !== f.category) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.status && t.status !== f.status) return false;
    // Tagesgeschäft: sichtbar ab heute und ohne spätere Fälligkeit
    if (f.date === "heute" && !(t.visibleFrom <= today && (!t.dueDate || t.dueDate <= today))) {
      return false;
    }
    if (f.date === "woche" && t.dueDate && t.dueDate > inWeek) return false;
    return true;
  });
}

export default function Filters({
  value,
  onChange,
  showAssignee = true,
}: {
  value: FilterState;
  onChange: (f: FilterState) => void;
  showAssignee?: boolean;
}) {
  const { categories, profiles } = useStore();
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });

  return (
    <div className="panel mb-3 flex flex-wrap items-end gap-2 p-2.5">
      <input
        className="field"
        style={{ width: 220 }}
        placeholder="Suchen – Nr., Titel, Objekt, Kunde"
        title="Eine reine Zahl sucht die onOffice-Aufgabennummer, alles andere Titel, Beschreibung, Objekt und Kunde."
        value={value.q}
        onChange={(e) => set({ q: e.target.value })}
      />
      {showAssignee ? (
        <select className="field" style={{ width: 160 }} value={value.assignee} onChange={(e) => set({ assignee: e.target.value })}>
          <option value="">Alle Mitarbeitenden</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </select>
      ) : null}
      <select className="field" style={{ width: 160 }} value={value.category} onChange={(e) => set({ category: e.target.value })}>
        <option value="">Alle Kategorien</option>
        {categories
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </select>
      <select
        className="field"
        style={{ width: 130 }}
        value={value.priority}
        onChange={(e) => set({ priority: e.target.value as FilterState["priority"] })}
      >
        <option value="">Jede Priorität</option>
        <option value="hoch">Nur Hoch</option>
        <option value="normal">Nur Normal</option>
      </select>
      <select
        className="field"
        style={{ width: 150 }}
        value={value.status}
        onChange={(e) => set({ status: e.target.value as FilterState["status"] })}
      >
        <option value="">Jeder Status</option>
        <option value="offen">Offen</option>
        <option value="in_bearbeitung">Rückfragen offen</option>
        <option value="erledigt">Erledigt</option>
      </select>
      <select
        className="field"
        style={{ width: 150 }}
        value={value.date}
        onChange={(e) => set({ date: e.target.value as FilterState["date"] })}
      >
        <option value="alle">Alle Termine</option>
        <option value="heute">Heute fällig / ohne Termin</option>
        <option value="woche">Fällig bis in 7 Tage</option>
      </select>
      <button className="btn btn-ghost" onClick={() => onChange(EMPTY_FILTER)}>
        Zurücksetzen
      </button>
    </div>
  );
}
