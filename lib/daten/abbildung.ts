/**
 * Umsetzung zwischen Datenbankzeilen (snake_case) und den Typen der
 * Oberflaeche (camelCase). Bewusst an einer Stelle, damit die Namen nicht
 * quer durch die Komponenten wandern.
 */
import type {
  AppSettings,
  Attachment,
  BrokerContact,
  Category,
  EmailTemplate,
  NotificationEntry,
  NotifyKind,
  Profile,
  Task,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const FARBEN = ["#88cc44", "#2f6d94", "#b8701a", "#7b5ea7", "#3f8f7a", "#b3402f", "#a58b2c"];

export function initialen(name: string): string {
  const teile = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!teile.length) return "?";
  if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase();
  return (teile[0][0] + teile[teile.length - 1][0]).toUpperCase();
}

/** Stabile Farbe aus der Kennung - gleiche Person, immer gleiche Farbe. */
function farbeAus(id: string): string {
  let summe = 0;
  for (const z of id) summe = (summe + z.charCodeAt(0)) % 9973;
  return FARBEN[summe % FARBEN.length];
}

export function zuProfil(row: any): Profile {
  return {
    id: row.id,
    fullName: row.full_name ?? row.email ?? "(ohne Namen)",
    email: row.email ?? "",
    role: row.role,
    onofficeUsername: row.onoffice_display_name ?? row.onoffice_username ?? "",
    color: row.color || farbeAus(row.id),
    initials: initialen(row.full_name ?? row.email ?? ""),
  };
}

export function zuKollege(row: any): BrokerContact {
  return {
    id: row.id,
    displayName: row.display_name,
    shortCode: row.short_code ?? "",
    email: row.email ?? "",
  };
}

export function zuKategorie(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order ?? 100,
    isActive: row.is_active ?? true,
  };
}

export function zuAnhang(row: any): Attachment {
  return {
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type ?? "",
    sizeBytes: Number(row.size_bytes ?? 0),
    origin: row.origin,
    uploadedBy: row.uploaded_by ?? null,
    onofficeFileId: row.onoffice_file_id ?? undefined,
    syncState: row.sync_state,
    syncError: row.sync_error ?? undefined,
    createdAt: row.created_at,
    hasContent: Boolean(row.storage_path),
  };
}

export function zuAufgabe(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    categoryId: row.category_id ?? null,
    creatorId: row.creator_id,
    assigneeId: row.assignee_id ?? null,
    brokerContactId: row.broker_contact_id ?? null,
    isPool: Boolean(row.is_pool),
    isPrivate: Boolean(row.is_private),
    visibleFrom: row.visible_from,
    dueDate: row.due_date ?? null,
    onofficeTaskId: row.onoffice_task_id ?? null,
    onofficeEstateNo: row.onoffice_estate_no ?? row.onoffice_estate_id ?? undefined,
    onofficeAddressId: row.onoffice_address_id ?? undefined,
    source: row.source,
    inProgressNote: row.in_progress_note ?? undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
    position: row.position ?? null,
    history: (row.task_status_history ?? [])
      .map((h: any) => ({
        at: h.created_at,
        from: h.from_status,
        to: h.to_status,
        by: h.changed_by ?? "",
        note: h.note ?? undefined,
      }))
      .sort((a: any, b: any) => (a.at < b.at ? 1 : -1)),
    attachments: (row.task_attachments ?? []).map(zuAnhang),
    reminder3dSentAt: row.reminder_3d_sent_at ?? null,
    escalation7dSentAt: row.escalation_7d_sent_at ?? null,
  };
}

export function zuVorlage(row: any): EmailTemplate {
  return {
    key: row.key as NotifyKind,
    label: row.label,
    subject: row.subject,
    body: row.body,
    isActive: row.is_active ?? true,
  };
}

export function zuEinstellungen(row: any): AppSettings {
  return {
    reminderDays: row?.reminder_days ?? 3,
    escalationDays: row?.escalation_days ?? 7,
    mailProvider: row?.mail_provider ?? "onoffice",
    onofficeEmailIdentity: row?.onoffice_email_identity ?? "",
    smtpFrom: row?.smtp_from ?? "",
    doneHideAfterHours: row?.done_hide_after_hours ?? 24,
    attachmentMaxMb: row?.attachment_max_mb ?? 25,
    attachmentPushOnoffice: row?.attachment_push_onoffice ?? true,
    attachmentDefaultArt: row?.attachment_default_art ?? "Dokument",
  };
}

export function einstellungenZurZeile(patch: Partial<AppSettings>): Record<string, unknown> {
  const z: Record<string, unknown> = {};
  if (patch.reminderDays !== undefined) z.reminder_days = patch.reminderDays;
  if (patch.escalationDays !== undefined) z.escalation_days = patch.escalationDays;
  if (patch.mailProvider !== undefined) z.mail_provider = patch.mailProvider;
  if (patch.onofficeEmailIdentity !== undefined) z.onoffice_email_identity = patch.onofficeEmailIdentity;
  if (patch.smtpFrom !== undefined) z.smtp_from = patch.smtpFrom;
  if (patch.doneHideAfterHours !== undefined) z.done_hide_after_hours = patch.doneHideAfterHours;
  if (patch.attachmentMaxMb !== undefined) z.attachment_max_mb = patch.attachmentMaxMb;
  if (patch.attachmentPushOnoffice !== undefined) z.attachment_push_onoffice = patch.attachmentPushOnoffice;
  if (patch.attachmentDefaultArt !== undefined) z.attachment_default_art = patch.attachmentDefaultArt;
  return z;
}

export function aufgabeZurZeile(patch: Partial<Task>): Record<string, unknown> {
  const z: Record<string, unknown> = {};
  if (patch.title !== undefined) z.title = patch.title;
  if (patch.description !== undefined) z.description = patch.description || null;
  if (patch.status !== undefined) z.status = patch.status;
  if (patch.priority !== undefined) z.priority = patch.priority;
  if (patch.categoryId !== undefined) z.category_id = patch.categoryId;
  if (patch.assigneeId !== undefined) z.assignee_id = patch.assigneeId;
  if (patch.brokerContactId !== undefined) z.broker_contact_id = patch.brokerContactId;
  if (patch.isPool !== undefined) z.is_pool = patch.isPool;
  if (patch.isPrivate !== undefined) z.is_private = patch.isPrivate;
  if (patch.visibleFrom !== undefined) z.visible_from = patch.visibleFrom;
  if (patch.dueDate !== undefined) z.due_date = patch.dueDate;
  if (patch.onofficeEstateNo !== undefined) z.onoffice_estate_no = patch.onofficeEstateNo || null;
  if (patch.onofficeAddressId !== undefined) z.onoffice_address_id = patch.onofficeAddressId || null;
  if (patch.inProgressNote !== undefined) z.in_progress_note = patch.inProgressNote || null;
  return z;
}

export function zuBenachrichtigung(row: any): NotificationEntry {
  return {
    id: row.id,
    taskId: row.task_id ?? "",
    taskTitle: row.tasks?.title ?? "(Aufgabe gelöscht)",
    kind: row.kind as NotifyKind,
    recipient: row.recipient,
    recipientName: row.recipient_name ?? row.recipient,
    subject: row.subject,
    body: row.body,
    provider: row.provider,
    status: row.status === "failed" ? "skipped" : row.status,
    dedupeKey: row.dedupe_key,
    createdAt: row.created_at,
  };
}
