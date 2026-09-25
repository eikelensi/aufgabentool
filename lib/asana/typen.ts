/** Die Ausschnitte der Asana-Antworten, die wir wirklich lesen. */

export interface AsanaNutzer {
  gid: string;
  name?: string;
  email?: string;
}

export interface AsanaSection {
  gid: string;
  name: string;
}

export interface AsanaMitgliedschaft {
  project?: { gid: string };
  section?: AsanaSection;
}

export interface AsanaAufgabe {
  gid: string;
  name: string;
  notes?: string;
  completed?: boolean;
  completed_at?: string | null;
  due_on?: string | null;
  start_on?: string | null;
  modified_at?: string;
  created_at?: string;
  assignee?: AsanaNutzer | null;
  /** Wer die Aufgabe in Asana angelegt hat. */
  created_by?: AsanaNutzer | null;
  /**
   * Der Abschnitt in "Meine Aufgaben" - die persoenliche Ordnung des
   * Bearbeiters, unabhaengig von jeder Projektspalte.
   */
  assignee_section?: AsanaSection | null;
  memberships?: AsanaMitgliedschaft[];
  permalink_url?: string;
}

/**
 * Eine Story ist alles, was an einer Aufgabe passiert - auch
 * "Status geaendert". Uns interessiert nur der Typ "comment".
 */
export interface AsanaStory {
  gid: string;
  type?: string;
  resource_subtype?: string;
  text?: string;
  created_at?: string;
  created_by?: AsanaNutzer | null;
}

export const AUFGABEN_FELDER = [
  "gid",
  "name",
  "notes",
  "completed",
  "completed_at",
  "due_on",
  "start_on",
  "modified_at",
  "created_at",
  "assignee.gid",
  "assignee.name",
  "assignee.email",
  "created_by.gid",
  "created_by.name",
  "created_by.email",
  "memberships.project.gid",
  "memberships.section.gid",
  "memberships.section.name",
  "permalink_url",
].join(",");
