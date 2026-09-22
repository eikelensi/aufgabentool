export type TaskStatus = "offen" | "in_bearbeitung" | "erledigt";
export type TaskPriority = "normal" | "hoch";
export type AppRole = "superadmin" | "admin" | "mitarbeiter";
export type TaskSource = "manuell" | "email" | "onoffice" | "qm";

export type NotifyKind =
  | "aufgabe_erledigt_makler"
  | "in_bearbeitung_notiz"
  | "erinnerung_3t"
  | "eskalation_7t"
  | "aufgabe_in_pool";

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  onofficeUsername: string;
  color: string;
  initials: string;
}

export interface BrokerContact {
  id: string;
  displayName: string;
  shortCode: string;
  email: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

export interface StatusHistoryEntry {
  at: string;
  from: TaskStatus | null;
  to: TaskStatus;
  by: string;
  note?: string;
}

export type AttachmentOrigin = "lokal" | "onoffice";

export type AttachmentSync =
  | "lokal"        // nur im Aufgabentool
  | "wartet"       // in der Warteschlange für onOffice
  | "synchron"     // in beiden Systemen
  | "nur_onoffice" // hängt in onOffice, Inhalt liegt uns nicht vor
  | "fehler";

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  origin: AttachmentOrigin;
  uploadedBy: string | null;
  onofficeFileId?: string;
  syncState: AttachmentSync;
  syncError?: string;
  createdAt: string;
  /** Im Prototyp: Inhalt liegt als Blob in dieser Browsersitzung vor. */
  hasContent: boolean;
}

export const SYNC_LABEL: Record<AttachmentSync, string> = {
  lokal: "nur hier",
  wartet: "wird übertragen",
  synchron: "in onOffice",
  nur_onoffice: "nur in onOffice",
  fehler: "Fehler",
};

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  categoryId: string | null;
  creatorId: string;
  assigneeId: string | null;
  /** Wer bei Erledigung eine Mail bekommt. Bleibt im Tool. */
  brokerContactId: string | null;
  /**
   * Kollege ohne Zugang zum Tool, der die Aufgabe bearbeitet. Sein
   * Kuerzel geht als "Bearbeiter" nach onOffice. Nur gesetzt, wenn
   * assigneeId leer ist - zwei Bearbeiter gibt es nicht.
   */
  onofficeBearbeiterId: string | null;
  isPool: boolean;
  isPrivate: boolean;
  visibleFrom: string; // ISO-Datum
  dueDate: string | null;
  /** Die Aufgabennummer aus onOffice, z.B. 21921. */
  onofficeTaskId?: string | null;
  /**
   * Bearbeiter und Verantwortung so, wie sie in onOffice stehen - als
   * Text, nicht als Verweis. Steht hier ein Name, den das Tool nicht
   * kennt, ist die Aufgabe an jemanden ausserhalb vergeben.
   */
  onofficeAssignee?: string | null;
  onofficeResponsible?: string | null;
  onofficeEstateNo?: string;
  onofficeAddressId?: string;
  source: TaskSource;
  inProgressNote?: string;
  createdAt: string;
  completedAt: string | null;
  /** Selbst gewaehlte Reihenfolge; null = noch nie sortiert. */
  position: number | null;
  history: StatusHistoryEntry[];
  attachments: Attachment[];
  /**
   * Warum die Aufgabe zurueck in den Pool ging, und von wem. Bleibt
   * stehen, bis sie sich jemand zieht - wer sie uebernimmt, soll wissen,
   * woran die vorige Person haengengeblieben ist.
   */
  poolGrund?: string | null;
  poolZurueckAm?: string | null;
  poolZurueckVon?: string | null;
  reminder3dSentAt?: string | null;
  escalation7dSentAt?: string | null;
}

export interface NotificationEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  kind: NotifyKind;
  recipient: string;
  recipientName: string;
  subject: string;
  body: string;
  provider: "onoffice" | "smtp" | "log";
  status: "sent" | "queued" | "skipped";
  dedupeKey: string;
  createdAt: string;
}

export interface EmailTemplate {
  key: NotifyKind;
  label: string;
  subject: string;
  body: string;
  isActive: boolean;
}

export interface AppSettings {
  reminderDays: number;
  escalationDays: number;
  mailProvider: "onoffice" | "smtp" | "log";
  /** Wohin die Meldung geht, wenn eine Aufgabe in den Pool zurueckgeht. */
  poolNotifyEmail: string;
  onofficeEmailIdentity: string;
  smtpFrom: string;
  doneHideAfterHours: number;
  attachmentMaxMb: number;
  attachmentPushOnoffice: boolean;
  attachmentDefaultArt: string;
}

/**
 * Vergeben - aber an jemanden, der kein Nutzer dieses Tools ist.
 *
 * In onOffice steht ein Bearbeiter, den wir keinem Profil zuordnen
 * koennen. Solche Aufgaben gehoeren weder in "Mein Tag" (sie sind nicht
 * meine) noch in den Pool (sie sind nicht frei). Sie haben einen
 * eigenen Bereich, sonst faellt ein paar hundert Aufgaben zwischen die
 * Ansichten - siehe app/(app)/verteilt.
 */
export function istVerteilt(t: Task): boolean {
  return (
    !t.assigneeId &&
    !t.isPool &&
    Boolean(t.onofficeAssignee || t.onofficeBearbeiterId)
  );
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  offen: "Offen",
  in_bearbeitung: "Rückfragen offen",
  erledigt: "Erledigt",
};

export const NOTIFY_LABEL: Record<NotifyKind, string> = {
  aufgabe_erledigt_makler: "Erledigt-Info an Kollegen",
  in_bearbeitung_notiz: "Rückmeldung „Rückfragen offen“",
  erinnerung_3t: "Erinnerung nach 3 Tagen",
  eskalation_7t: "Eskalation nach 7 Tagen",
  aufgabe_in_pool: "Aufgabe in den Pool zurückgelegt",
};
