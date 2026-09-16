"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ALLOWED_EXTENSIONS,
  BROKERS,
  CATEGORIES,
  PROFILES,
  SETTINGS,
  TEMPLATES,
  buildNotifications,
  buildTasks,
  isoDate,
} from "./data";
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
  TaskStatus,
} from "./types";

const STORAGE_KEY = "aufgabentool-demo-v2";

/**
 * Dateiinhalte liegen im Prototyp nur als Blob-URL in dieser Browsersitzung –
 * bewusst außerhalb des persistierten Zustands, damit localStorage nicht
 * volläuft. Im Echtbetrieb übernimmt das Supabase Storage.
 */
const blobUrls = new Map<string, string>();

interface State {
  currentUserId: string;
  tasks: Task[];
  categories: Category[];
  notifications: NotificationEntry[];
  templates: EmailTemplate[];
  settings: AppSettings;
}

interface StoreValue extends State {
  profiles: Profile[];
  brokers: BrokerContact[];
  me: Profile;
  isAdmin: boolean;
  setCurrentUser: (id: string) => void;
  moveTask: (taskId: string, status: TaskStatus, note?: string) => { ok: boolean; error?: string };
  claimTask: (taskId: string) => void;
  createTask: (input: Partial<Task> & { title: string }) => string;
  updateTask: (taskId: string, patch: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  addAttachments: (taskId: string, files: File[]) => { added: number; rejected: string[] };
  removeAttachment: (taskId: string, attachmentId: string) => void;
  attachmentUrl: (attachmentId: string) => string | null;
  runAttachmentSync: () => { pushed: number };
  upsertCategory: (cat: Category) => void;
  removeCategory: (id: string) => void;
  moveCategory: (id: string, dir: -1 | 1) => void;
  updateTemplate: (key: NotifyKind, patch: Partial<EmailTemplate>) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  runEscalationJob: () => { reminders: number; escalations: number };
  resetDemo: () => void;
  visibleTasks: Task[];
  profileById: (id: string | null) => Profile | undefined;
  categoryById: (id: string | null) => Category | undefined;
  brokerById: (id: string | null) => BrokerContact | undefined;
}

const StoreContext = createContext<StoreValue | null>(null);

function initialState(): State {
  const tasks = buildTasks();
  return {
    currentUserId: "u-sarah",
    tasks,
    categories: CATEGORIES,
    notifications: buildNotifications(tasks),
    templates: TEMPLATES,
    settings: SETTINGS,
  };
}

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split("{{" + key + "}}").join(value);
  }
  return out;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        if (parsed && Array.isArray(parsed.tasks) && parsed.tasks.length) {
          // Zustand aus einer älteren Version kennt noch keine Anhänge
          setState({
            ...parsed,
            settings: { ...SETTINGS, ...parsed.settings },
            tasks: parsed.tasks.map((t) => ({ ...t, attachments: t.attachments ?? [] })),
          });
          return;
        }
      }
    } catch {
      /* Demo-Daten neu aufbauen */
    }
    setState(initialState());
  }, []);

  useEffect(() => {
    if (!state) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* Speicher nicht verfügbar – Demo läuft trotzdem */
    }
  }, [state]);

  const patch = useCallback((fn: (s: State) => State) => {
    setState((s) => (s ? fn(s) : s));
  }, []);

  const value = useMemo<StoreValue | null>(() => {
    if (!state) return null;

    const me = PROFILES.find((p) => p.id === state.currentUserId) ?? PROFILES[0];
    const isAdmin = me.role === "admin" || me.role === "superadmin";

    const profileById = (id: string | null) => PROFILES.find((p) => p.id === id);
    const categoryById = (id: string | null) => state.categories.find((c) => c.id === id);
    const brokerById = (id: string | null) => BROKERS.find((b) => b.id === id);

    const today = isoDate(0);

    // Sichtbarkeit: Rollenrecht + Startdatum + Ausblendfrist für Erledigte
    const visibleTasks = state.tasks.filter((t) => {
      if (t.isPrivate && t.creatorId !== me.id) return false;
      if (!isAdmin && !t.isPrivate) {
        const mine = t.assigneeId === me.id || t.creatorId === me.id;
        const pool = t.isPool && t.assigneeId === null;
        if (!mine && !pool) return false;
      }
      if (t.visibleFrom > today) return false;
      if (t.status === "erledigt" && t.completedAt) {
        const ageH = (Date.now() - new Date(t.completedAt).getTime()) / 36e5;
        if (ageH > state.settings.doneHideAfterHours) return false;
      }
      return true;
    });

    const logMail = (
      s: State,
      kind: NotifyKind,
      task: Task,
      recipientName: string,
      recipient: string,
      vars: Record<string, string>,
      suffix = "",
    ): NotificationEntry | null => {
      const tpl = s.templates.find((t) => t.key === kind);
      if (!tpl || !tpl.isActive) return null;
      const dedupeKey = `task:${task.id}:${kind}${suffix}`;
      if (s.notifications.some((n) => n.dedupeKey === dedupeKey)) return null; // Doppelversand verhindern
      return {
        id: `n-${Math.random().toString(36).slice(2, 9)}`,
        taskId: task.id,
        taskTitle: task.title,
        kind,
        recipient,
        recipientName,
        subject: fillTemplate(tpl.subject, vars),
        body: fillTemplate(tpl.body, { ...vars, empfaenger: recipientName }),
        provider: s.settings.mailProvider,
        status: "sent",
        dedupeKey,
        createdAt: new Date().toISOString(),
      };
    };

    const moveTask: StoreValue["moveTask"] = (taskId, status, note) => {
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return { ok: false, error: "Aufgabe nicht gefunden." };
      if (status === "in_bearbeitung" && (!note || !note.trim())) {
        return { ok: false, error: "Für „In Bearbeitung“ ist eine Notiz verpflichtend." };
      }
      if (task.status === status) return { ok: true };

      patch((s) => {
        const now = new Date().toISOString();
        const mails: NotificationEntry[] = [];
        const t = s.tasks.find((x) => x.id === taskId)!;
        const assignee = profileById(t.assigneeId) ?? me;
        const creator = profileById(t.creatorId);
        const broker = brokerById(t.brokerContactId);
        const objekt = t.onofficeEstateNo ?? t.onofficeAddressId ?? "–";

        const updated: Task = {
          ...t,
          status,
          assigneeId: t.assigneeId ?? me.id,
          isPool: t.assigneeId ? t.isPool : false,
          inProgressNote: status === "in_bearbeitung" ? note!.trim() : t.inProgressNote,
          completedAt: status === "erledigt" ? now : null,
          // Eskalationsuhr stoppt, sobald die Aufgabe nicht mehr offen ist
          reminder3dSentAt: status !== "offen" ? t.reminder3dSentAt ?? now : t.reminder3dSentAt,
          escalation7dSentAt: status !== "offen" ? t.escalation7dSentAt ?? now : t.escalation7dSentAt,
          history: [
            ...t.history,
            { at: now, from: t.status, to: status, by: me.id, note: note?.trim() },
          ],
        };

        if (!t.isPrivate) {
          const vars = {
            titel: t.title,
            bearbeiter: assignee.fullName,
            ersteller: creator?.fullName ?? "–",
            notiz: note?.trim() ?? "",
            objekt,
            datum: new Date().toLocaleDateString("de-DE"),
            tage: String(
              Math.max(
                0,
                Math.round((Date.now() - new Date(t.createdAt).getTime()) / 864e5),
              ),
            ),
          };

          if (status === "in_bearbeitung") {
            const suffix = `:${updated.history.length}`;
            if (creator) {
              const m = logMail(s, "in_bearbeitung_notiz", t, creator.fullName, creator.email, vars, suffix);
              if (m) mails.push(m);
            }
            if (broker) {
              const m = logMail(
                s,
                "in_bearbeitung_notiz",
                t,
                broker.displayName,
                broker.email,
                vars,
                `${suffix}:makler`,
              );
              if (m) mails.push(m);
            }
          }

          if (status === "erledigt" && broker) {
            const m = logMail(s, "aufgabe_erledigt_makler", t, broker.displayName, broker.email, vars);
            if (m) mails.push(m);
          }
        }

        return {
          ...s,
          tasks: s.tasks.map((x) => (x.id === taskId ? updated : x)),
          notifications: [...mails, ...s.notifications],
        };
      });

      return { ok: true };
    };

    const claimTask: StoreValue["claimTask"] = (taskId) => {
      patch((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === taskId ? { ...t, assigneeId: me.id, isPool: false } : t,
        ),
      }));
    };

    const createTask: StoreValue["createTask"] = (input) => {
      const newId = `t-${Math.random().toString(36).slice(2, 9)}`;
      patch((s) => {
        const task: Task = {
          id: newId,
          title: input.title.trim(),
          description: input.description ?? "",
          status: "offen",
          priority: input.priority ?? "normal",
          categoryId: input.categoryId ?? null,
          creatorId: me.id,
          assigneeId: input.isPool ? null : input.assigneeId ?? me.id,
          brokerContactId: input.isPrivate ? null : input.brokerContactId ?? null,
          isPool: Boolean(input.isPool),
          isPrivate: Boolean(input.isPrivate),
          visibleFrom: input.visibleFrom ?? isoDate(0),
          dueDate: input.dueDate ?? null,
          onofficeEstateNo: input.onofficeEstateNo,
          onofficeAddressId: input.onofficeAddressId,
          source: input.source ?? "manuell",
          createdAt: new Date().toISOString(),
          completedAt: null,
          history: [],
          attachments: [],
          reminder3dSentAt: null,
          escalation7dSentAt: null,
        };
        return { ...s, tasks: [task, ...s.tasks] };
      });
      return newId;
    };

    /* ---------------- Dateianhänge ---------------- */

    const addAttachments: StoreValue["addAttachments"] = (taskId, files) => {
      const maxBytes = state.settings.attachmentMaxMb * 1024 * 1024;
      const rejected: string[] = [];
      const accepted: Attachment[] = [];

      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          rejected.push(`${file.name} – Dateityp ${ext ? `.${ext}` : "unbekannt"} nimmt onOffice nicht an`);
          continue;
        }
        if (file.size > maxBytes) {
          rejected.push(`${file.name} – größer als ${state.settings.attachmentMaxMb} MB`);
          continue;
        }
        const id = `a-${Math.random().toString(36).slice(2, 10)}`;
        try {
          blobUrls.set(id, URL.createObjectURL(file));
        } catch {
          /* ohne Blob-URL bleibt die Datei hier nur als Eintrag */
        }
        accepted.push({
          id,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          origin: "lokal",
          uploadedBy: me.id,
          syncState: state.settings.attachmentPushOnoffice ? "wartet" : "lokal",
          createdAt: new Date().toISOString(),
          hasContent: blobUrls.has(id),
        });
      }

      if (accepted.length) {
        patch((s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, attachments: [...t.attachments, ...accepted] } : t,
          ),
        }));
      }

      return { added: accepted.length, rejected };
    };

    const removeAttachment: StoreValue["removeAttachment"] = (taskId, attachmentId) => {
      const url = blobUrls.get(attachmentId);
      if (url) {
        URL.revokeObjectURL(url);
        blobUrls.delete(attachmentId);
      }
      patch((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? { ...t, attachments: t.attachments.filter((a) => a.id !== attachmentId) }
            : t,
        ),
      }));
    };

    const attachmentUrl: StoreValue["attachmentUrl"] = (attachmentId) =>
      blobUrls.get(attachmentId) ?? null;

    /** Simuliert den Upload der Warteschlange nach onOffice (module=task). */
    const runAttachmentSync: StoreValue["runAttachmentSync"] = () => {
      let pushed = 0;
      patch((s) => ({
        ...s,
        tasks: s.tasks.map((t) => {
          if (!t.attachments.some((a) => a.syncState === "wartet")) return t;
          return {
            ...t,
            attachments: t.attachments.map((a) => {
              if (a.syncState !== "wartet") return a;
              pushed++;
              return {
                ...a,
                syncState: "synchron" as const,
                onofficeFileId: `of-${Math.floor(100000 + Math.random() * 899999)}`,
                syncError: undefined,
              };
            }),
          };
        }),
      }));
      return { pushed };
    };

    const updateTask: StoreValue["updateTask"] = (taskId, p) => {
      patch((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...p } : t)),
      }));
    };

    const deleteTask: StoreValue["deleteTask"] = (taskId) => {
      patch((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== taskId) }));
    };

    const upsertCategory: StoreValue["upsertCategory"] = (cat) => {
      patch((s) => {
        const exists = s.categories.some((c) => c.id === cat.id);
        return {
          ...s,
          categories: exists
            ? s.categories.map((c) => (c.id === cat.id ? cat : c))
            : [...s.categories, cat],
        };
      });
    };

    const removeCategory: StoreValue["removeCategory"] = (id) => {
      patch((s) => ({
        ...s,
        categories: s.categories.filter((c) => c.id !== id),
        tasks: s.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
      }));
    };

    const moveCategory: StoreValue["moveCategory"] = (id, dir) => {
      patch((s) => {
        const sorted = [...s.categories].sort((a, b) => a.sortOrder - b.sortOrder);
        const i = sorted.findIndex((c) => c.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= sorted.length) return s;
        [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
        return {
          ...s,
          categories: sorted.map((c, idx) => ({ ...c, sortOrder: (idx + 1) * 10 })),
        };
      });
    };

    const updateTemplate: StoreValue["updateTemplate"] = (key, p) => {
      patch((s) => ({
        ...s,
        templates: s.templates.map((t) => (t.key === key ? { ...t, ...p } : t)),
      }));
    };

    const updateSettings: StoreValue["updateSettings"] = (p) => {
      patch((s) => ({ ...s, settings: { ...s.settings, ...p } }));
    };

    // Simuliert den täglichen Cron-Lauf für Erinnerungen und Eskalationen
    const runEscalationJob: StoreValue["runEscalationJob"] = () => {
      let reminders = 0;
      let escalations = 0;

      patch((s) => {
        const now = new Date().toISOString();
        const mails: NotificationEntry[] = [];
        const tasks = s.tasks.map((t) => {
          if (t.status !== "offen" || t.isPrivate || t.visibleFrom > isoDate(0)) return t;
          const ageDays = (Date.now() - new Date(t.createdAt).getTime()) / 864e5;
          let next = t;
          const assignee = PROFILES.find((p) => p.id === t.assigneeId);
          const creator = PROFILES.find((p) => p.id === t.creatorId);
          const vars = {
            titel: t.title,
            bearbeiter: assignee?.fullName ?? "unbesetzt",
            ersteller: creator?.fullName ?? "–",
            objekt: t.onofficeEstateNo ?? t.onofficeAddressId ?? "–",
            notiz: "",
            datum: new Date().toLocaleDateString("de-DE"),
            tage: String(Math.round(ageDays)),
          };

          if (ageDays >= s.settings.reminderDays && !t.reminder3dSentAt && assignee) {
            const m = logMail(
              { ...s, notifications: [...mails, ...s.notifications] },
              "erinnerung_3t",
              t,
              assignee.fullName,
              assignee.email,
              vars,
            );
            if (m) {
              mails.push(m);
              reminders++;
              next = { ...next, reminder3dSentAt: now };
            }
          }

          if (ageDays >= s.settings.escalationDays && !t.escalation7dSentAt) {
            for (const person of [assignee, creator]) {
              if (!person) continue;
              const m = logMail(
                { ...s, notifications: [...mails, ...s.notifications] },
                "eskalation_7t",
                t,
                person.fullName,
                person.email,
                vars,
                person === creator ? ":ersteller" : "",
              );
              if (m) {
                mails.push(m);
                escalations++;
              }
            }
            next = { ...next, escalation7dSentAt: now };
          }

          return next;
        });

        return { ...s, tasks, notifications: [...mails, ...s.notifications] };
      });

      return { reminders, escalations };
    };

    const resetDemo = () => setState(initialState());

    return {
      ...state,
      profiles: PROFILES,
      brokers: BROKERS,
      me,
      isAdmin,
      setCurrentUser: (id) => patch((s) => ({ ...s, currentUserId: id })),
      moveTask,
      claimTask,
      createTask,
      updateTask,
      deleteTask,
      addAttachments,
      removeAttachment,
      attachmentUrl,
      runAttachmentSync,
      upsertCategory,
      removeCategory,
      moveCategory,
      updateTemplate,
      updateSettings,
      runEscalationJob,
      resetDemo,
      visibleTasks,
      profileById,
      categoryById,
      brokerById,
    };
  }, [state, patch]);

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="muted text-sm">Aufgabentool wird geladen …</p>
      </div>
    );
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore muss innerhalb von StoreProvider verwendet werden.");
  return ctx;
}
