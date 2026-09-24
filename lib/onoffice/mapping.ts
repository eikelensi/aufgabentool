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

/**
 * Die Statuswerte von onOffice, vollstaendig.
 *
 * Quelle: apidoc.onoffice.de, "Modify Tasks" - Status nimmt die Zahlen
 * 1 bis 8. Das ist wichtiger, als es aussieht: onOffice kennt ACHT
 * Status, das Tool drei. Vier onOffice-Status landen bei uns auf
 * "offen". Wer das nicht weiss und beim Zurueckschreiben stumpf
 * "offen -> 1" setzt, macht aus einer zurueckgestellten, abgebrochenen
 * oder geprueften Aufgabe eine nicht begonnene - und das merkt niemand,
 * weil im Tool beides gleich aussieht. Darum schreibt die Route
 * app/api/onoffice/status nur, wenn sich der Status bei UNS gegenueber
 * dem zuletzt gelesenen Rohwert wirklich geaendert hat.
 */
export const ONOFFICE_STATUS: Record<string, { label: string; unser: TaskStatus }> = {
  "1": { label: "Nicht begonnen", unser: "offen" },
  "2": { label: "In Bearbeitung", unser: "in_bearbeitung" },
  "3": { label: "Erledigt", unser: "erledigt" },
  // Zurueckgestellt ist NICHT abgeschlossen - die Arbeit steht noch an,
  // nur spaeter. Im Mandanten der 4waendekanzlei ist dieser Status in
  // Gebrauch (gesehen im Statusfilter der Aufgabenverwaltung).
  "4": { label: "Zurückgestellt", unser: "offen" },
  // Abgebrochen ist vom Tisch. "offen" waere hier falsch: die Aufgabe
  // stuende dann als zu erledigen im Tool, obwohl sie niemand mehr
  // anfasst. Von den drei Status, die es hier gibt, trifft "erledigt"
  // es am ehesten.
  "5": { label: "Abgebrochen", unser: "erledigt" },
  "6": { label: "Sonstiges", unser: "offen" },
  "7": { label: "Geprüft", unser: "erledigt" },
  // In onOffice heisst dieser Status "Klärungsbedarf". Im Tool gibt es
  // das Wort nicht; der passende der drei Status ist "Rückfragen offen".
  "8": { label: "Klärungsbedarf", unser: "in_bearbeitung" },
};

/** Lesen: Beschriftung oder Zahl -> unser Status. */
const STATUS_FROM_ONOFFICE: Record<string, TaskStatus> = {
  // Zahlen und Beschriftungen aus der Tabelle oben, beide Wege.
  ...Object.fromEntries(
    Object.entries(ONOFFICE_STATUS).flatMap(([zahl, { label, unser }]) => [
      [zahl, unser],
      [label.toLowerCase(), unser],
    ]),
  ),
  // Schreibweisen ohne Umlaut, wie sie je nach Mandant vorkommen.
  zurueckgestellt: "offen",
  geprueft: "erledigt",
  "klaerungsbedarf": "in_bearbeitung",
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

/** Die Beschriftung zu einem geschriebenen Wert - fuer Protokoll und Anzeige. */
export function onofficeStatusLabel(wert: string): string {
  return ONOFFICE_STATUS[String(wert).trim()]?.label ?? wert;
}

/**
 * Status, bei denen die Aufgabe vom Tisch ist: Erledigt, Abgebrochen,
 * Geprueft.
 *
 * Wofuer das gebraucht wird: der Mandant hat allein fuer einen einzigen
 * Nutzer knapp 600 Aufgaben, und fast alle stehen auf "erl.". Wer die
 * alle holt, hat am ersten Tag ein Tool voller abgeschlossener Vorgaenge
 * aus zwei Jahren und findet die drei Sachen nicht mehr, die heute
 * anstehen. Der Abgleich holt abgeschlossene Aufgaben deshalb nicht neu.
 *
 * Was wir schon kennen, wird weiter aktualisiert: eine Aufgabe, die im
 * Tool bearbeitet und dann erledigt wurde, verschwindet nicht - sie
 * wurde ja hier fertig.
 *
 * Zurueckgestellt zaehlt bewusst nicht dazu. Die Arbeit steht noch an.
 */
const ABGESCHLOSSEN = new Set(["3", "5", "7"]);

export function istAbgeschlossen(onofficeStatus: unknown): boolean {
  const key = String(onofficeStatus ?? "").trim().toLowerCase();
  for (const [zahl, { label }] of Object.entries(ONOFFICE_STATUS)) {
    if (!ABGESCHLOSSEN.has(zahl)) continue;
    if (key === zahl || key === label.toLowerCase()) return true;
  }
  // Schreibweisen ohne Umlaut.
  return key === "geprueft";
}

/**
 * Prio: in onOffice ist 1 die hoechste Stufe.
 *
 * Aus der Oberflaeche abgelesen (24.09.2026): 1 hoechste, 2 hoch,
 * 3 normal, 4 niedrig, 5 niedrigste. Alles bis einschliesslich der
 * Schwelle gilt bei uns als "Hoch", darueber als "Normal" - die
 * Schwelle liegt deshalb bei 2 und nicht bei 1: was drueben "hoch"
 * heisst, soll hier nicht als normal ankommen.
 */
export function toOurPriority(onofficePrio: unknown): TaskPriority {
  const threshold = Number(process.env.ONOFFICE_PRIO_HOCH_BIS ?? "2");
  const prio = Number(onofficePrio);
  if (!Number.isFinite(prio) || prio === 0) return "normal";
  return prio <= threshold ? "hoch" : "normal";
}

export function toOnofficePriority(priority: TaskPriority): string {
  // Das Tool kennt nur hoch und normal - drueben gibt es fuenf Stufen.
  // Wir treffen die beiden, die gemeint sind, und lassen die uebrigen
  // in Ruhe.
  return priority === "hoch"
    ? (process.env.ONOFFICE_PRIO_HOCH ?? "2")
    : (process.env.ONOFFICE_PRIO_NORMAL ?? "3");
}

/**
 * Die Aufgabenarten dieses Mandanten, aus der Oberflaeche abgelesen
 * (24.09.2026). onOffice verlangt beim Anlegen eine Zahl; welche es
 * gibt, sagt weder die Doku noch die Feldkonfiguration.
 *
 * Ein Teil davon deckt sich mit den Kategorien des Tools - "360 Grad
 * Tour", "Titelbild erstellen". Daraus liesse sich eine Zuordnung
 * bauen, damit eine Aufgabe drueben nicht pauschal als To Do landet.
 */
export const ONOFFICE_AUFGABENARTEN: Record<string, string> = {
  "167": "To Do",
  "249": "Rückrufwunsch",
  "279": "Löschauftrag",
  "281": "Unterlagen anfordern",
  "283": "Anrufen",
  "285": "Termin vereinbaren",
  "333": "360 Grad Tour versenden",
  "335": "Kundendaten anlegen",
  "337": "Titelbild erstellen",
  "339": "Unterlagen verarbeiten",
  "341": "Erinnerung (WV)",
  "345": "Rückruf",
  "417": "Personalthemen",
  "441": "Akquise",
  "651": "Video / Foto Auftrag",
  "657": "Teamboard",
};

/**
 * Felder, die wir beim Lesen anfordern. Einzeln gegen den Mandanten
 * getestet (scripts/feldtest.mjs, 16.09.2026): diese 18 nimmt die
 * Leseabfrage an. ABGELEHNT werden "Nr", "newValue", "hochgeladenAm" und
 * "tags" - sie stehen in der Feldkonfiguration, nicht aber im data-Block.
 * "Kommentar" steht nicht in der Feldkonfiguration - beim SCHREIBEN
 * nimmt die Schnittstelle es laut Doku trotzdem an: es ist der
 * Kommentarstrang der Oberflaeche, kein Datensatzfeld. Siehe
 * lib/onoffice/notizen.ts.
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
