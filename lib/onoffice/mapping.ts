/**
 * Abbildung zwischen onOffice-Aufgaben und unserem Modell.
 *
 * Gegen den Mandanten der 4waendekanzlei geprueft (16.09.2026):
 *  - Beim LESEN liefert die API "Status" als Klartext-Beschriftung
 *    ("Erledigt", "In Bearbeitung", ...), nicht als Zahl.
 *  - Beim SCHREIBEN erwartet "Create/Modify Tasks" laut Doku eine Zahl.
 *    Deshalb sind Lese- und Schreibrichtung getrennt.
 *  - "Prio" ist numerisch (im Mandanten kommen 1-4 vor).
 *  - "Nr" ist ein Filterfeld und darf nicht im data-Block stehen.
 */

import type { TaskPriority, TaskStatus } from "@/lib/types";

/** Lesen: Beschriftung oder Zahl -> unser Status. */
const STATUS_FROM_ONOFFICE: Record<string, TaskStatus> = {
  // Beschriftungen, wie die API sie liefert
  "nicht begonnen": "offen",
  "in bearbeitung": "in_bearbeitung",
  erledigt: "erledigt",
  "zurueckgestellt": "offen",
  "zurückgestellt": "offen",
  // Zahlen, falls ein anderer Mandant sie so liefert
  "1": "offen",
  "2": "in_bearbeitung",
  "3": "erledigt",
  "4": "offen",
};

/** Schreiben: unser Status -> onOffice-Wert. Per Umgebung anpassbar. */
const STATUS_TO_ONOFFICE: Record<TaskStatus, string> = {
  offen: process.env.ONOFFICE_STATUS_OFFEN ?? "1",
  in_bearbeitung: process.env.ONOFFICE_STATUS_IN_BEARBEITUNG ?? "2",
  erledigt: process.env.ONOFFICE_STATUS_ERLEDIGT ?? "3",
};

export function toOurStatus(onofficeStatus: unknown): TaskStatus {
  const key = String(onofficeStatus ?? "").trim().toLowerCase();
  return STATUS_FROM_ONOFFICE[key] ?? "offen";
}

export function toOnofficeStatus(status: TaskStatus): string {
  return STATUS_TO_ONOFFICE[status];
}

/**
 * Prio: in onOffice ist 1 die hoechste Stufe. Alles bis einschliesslich
 * der Schwelle gilt bei uns als "Hoch", darueber als "Normal".
 */
export function toOurPriority(onofficePrio: unknown): TaskPriority {
  const threshold = Number(process.env.ONOFFICE_PRIO_HOCH_BIS ?? "1");
  const prio = Number(onofficePrio);
  if (!Number.isFinite(prio) || prio === 0) return "normal";
  return prio <= threshold ? "hoch" : "normal";
}

export function toOnofficePriority(priority: TaskPriority): string {
  return priority === "hoch"
    ? (process.env.ONOFFICE_PRIO_HOCH_BIS ?? "1")
    : (process.env.ONOFFICE_PRIO_NORMAL ?? "3");
}

/**
 * Felder, die wir beim Lesen anfordern. Einzeln gegen den Mandanten
 * getestet (scripts/feldtest.mjs, 16.09.2026): diese 18 nimmt die
 * Leseabfrage an. ABGELEHNT werden "Nr", "newValue", "hochgeladenAm" und
 * "tags" - sie stehen in der Feldkonfiguration, nicht aber im data-Block.
 * "Kommentar" existiert im Mandanten gar nicht.
 */
export const TASK_FIELDS = [
  "Betreff",
  "Aufgabe",
  "Status",
  "Prio",
  "Art",
  "Verantwortung",
  "Bearbeiter",
  "von",
  "Beginnt_am",
  "Beginnt_um",
  "Deadline",
  "Deadline_strikt",
  "Deadline_Zeit",
  "Privat",
  "Erinnerung",
  "Erinnerungsdatum",
  "Eintragsdatum",
  "modified",
] as const;

/** Ein Datum wie "2019-10-08 00:00:00" oder "" normalisieren. */
export function toIsoDate(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw.startsWith("0000")) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}
