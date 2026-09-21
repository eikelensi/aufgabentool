"use client";

/**
 * Der Zustand der Oberflaeche - jetzt gegen die echte Datenbank.
 *
 * Die Demo-Daten sind weg. Gelesen und geschrieben wird mit dem Schluessel
 * des angemeldeten Menschen, das heisst: was sichtbar ist und was sich
 * aendern laesst, entscheidet die Zeilensicherheit in Postgres. Dieser Code
 * filtert nicht nach Rechten - er koennte es gar nicht verlaesslich.
 *
 * Nach jeder Aenderung wird neu geladen statt lokal weitergerechnet. Etwas
 * mehr Netzverkehr, dafuer zeigt die Oberflaeche nie etwas an, das die
 * Datenbank abgelehnt hat.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  aufgabeZurZeile,
  einstellungenZurZeile,
  zuAufgabe,
  zuBenachrichtigung,
  zuEinstellungen,
  zuKategorie,
  zuKollege,
  zuProfil,
  zuVorlage,
} from "@/lib/daten/abbildung";
import { ALLOWED_EXTENSIONS } from "./data";
import type {
  AppSettings,
  BrokerContact,
  Category,
  EmailTemplate,
  NotificationEntry,
  NotifyKind,
  Profile,
  Task,
  TaskStatus,
} from "./types";

const AUFGABE_SPALTEN = `
  id, title, description, status, priority, category_id, creator_id, assignee_id,
  broker_contact_id, is_pool, is_private, visible_from, due_date,
  onoffice_estate_no, onoffice_estate_id, onoffice_address_id, source,
  in_progress_note, created_at, completed_at, position, reminder_3d_sent_at,
  escalation_7d_sent_at,
  task_status_history ( created_at, from_status, to_status, note, changed_by ),
  task_attachments ( id, file_name, mime_type, size_bytes, origin, uploaded_by,
                     onoffice_file_id, sync_state, sync_error, created_at, storage_path )
`;

export interface Ergebnis {
  ok: boolean;
  error?: string;
}

interface StoreValue {
  bereit: boolean;
  fehler: string | null;

  tasks: Task[];
  visibleTasks: Task[];
  profiles: Profile[];
  brokers: BrokerContact[];
  categories: Category[];
  templates: EmailTemplate[];
  notifications: NotificationEntry[];
  settings: AppSettings;

  me: Profile;
  isAdmin: boolean;

  neuLaden: () => Promise<void>;

  moveTask: (taskId: string, status: TaskStatus, note?: string) => Promise<Ergebnis>;
  claimTask: (taskId: string) => Promise<Ergebnis>;
  createTask: (input: Partial<Task> & { title: string }) => Promise<string | null>;
  updateTask: (taskId: string, patch: Partial<Task>) => Promise<Ergebnis>;
  deleteTask: (taskId: string) => Promise<Ergebnis>;
  verschiebe: (taskId: string, richtung: -1 | 1, inListe: Task[]) => Promise<Ergebnis>;

  addAttachments: (taskId: string, files: File[]) => Promise<{ added: number; rejected: string[] }>;
  removeAttachment: (taskId: string, attachmentId: string) => Promise<Ergebnis>;
  attachmentUrl: (attachmentId: string) => Promise<string | null>;
  runAttachmentSync: () => Promise<{ pushed: number; meldung?: string }>;

  upsertCategory: (cat: Category) => Promise<Ergebnis>;
  removeCategory: (id: string) => Promise<Ergebnis>;
  moveCategory: (id: string, dir: -1 | 1) => Promise<Ergebnis>;
  updateTemplate: (key: NotifyKind, patch: Partial<EmailTemplate>) => Promise<Ergebnis>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<Ergebnis>;
  runEscalationJob: () => Promise<{ reminders: number; escalations: number; meldung?: string }>;

  profileById: (id: string | null) => Profile | undefined;
  categoryById: (id: string | null) => Category | undefined;
  brokerById: (id: string | null) => BrokerContact | undefined;
}

const StoreContext = createContext<StoreValue | null>(null);

export interface StoreProfil {
  id: string;
  email: string;
  fullName: string;
  role: Profile["role"];
}

export function StoreProvider({
  children,
  profil,
}: {
  children: React.ReactNode;
  profil: StoreProfil;
}) {
  const [bereit, setBereit] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [brokers, setBrokers] = useState<BrokerContact[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(zuEinstellungen(null));

  const neuLaden = useCallback(async () => {
    const sb = supabaseBrowser();
    setFehler(null);

    const [a, p, k, ka, v, e, n] = await Promise.all([
      sb
        .from("tasks")
        .select(AUFGABE_SPALTEN)
        .order("position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
      sb.from("profiles").select("id, email, full_name, role, onoffice_display_name, onoffice_username, color, is_active").order("full_name"),
      sb.from("broker_contacts").select("id, display_name, short_code, email, is_active").eq("is_active", true).order("display_name"),
      sb.from("categories").select("id, name, color, sort_order, is_active").order("sort_order"),
      sb.from("email_templates").select("key, label, subject, body, is_active"),
      sb.from("app_settings").select("*").maybeSingle(),
      sb
        .from("notifications_log")
        .select("id, task_id, kind, recipient, recipient_name, subject, body, provider, status, dedupe_key, created_at, tasks ( title )")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const ersterFehler = [a.error, p.error, k.error, ka.error, v.error, e.error].find(Boolean);
    if (ersterFehler) setFehler(ersterFehler.message);

    if (a.data) setTasks(a.data.map(zuAufgabe));
    if (p.data) setProfiles(p.data.map(zuProfil));
    if (k.data) setBrokers(k.data.map(zuKollege));
    if (ka.data) setCategories(ka.data.map(zuKategorie));
    if (v.data) setTemplates(v.data.map(zuVorlage));
    if (e.data) setSettings(zuEinstellungen(e.data));
    // Das Protokoll sehen nur Admins - ein Fehler hier ist kein Problem.
    if (n.data) setNotifications(n.data.map(zuBenachrichtigung));

    setBereit(true);
  }, []);

  useEffect(() => {
    void neuLaden();
  }, [neuLaden]);

  const value = useMemo<StoreValue>(() => {
    const sb = supabaseBrowser();

    const me: Profile =
      profiles.find((p) => p.id === profil.id) ?? {
        id: profil.id,
        fullName: profil.fullName,
        email: profil.email,
        role: profil.role,
        onofficeUsername: "",
        color: "#88cc44",
        initials: profil.fullName.slice(0, 2).toUpperCase(),
      };

    const isAdmin = me.role === "admin" || me.role === "superadmin";

    const profileById = (id: string | null) => profiles.find((p) => p.id === id);
    const categoryById = (id: string | null) => categories.find((c) => c.id === id);
    const brokerById = (id: string | null) => brokers.find((b) => b.id === id);

    const heute = new Date().toISOString().slice(0, 10);
    const grenze = Date.now() - settings.doneHideAfterHours * 3600_000;

    /** Tagesgeschaeft: sichtbar ab Startdatum, Erledigtes nur kurz. */
    const visibleTasks = tasks.filter((t) => {
      if (t.visibleFrom > heute) return false;
      if (t.status === "erledigt" && t.completedAt) {
        return new Date(t.completedAt).getTime() > grenze;
      }
      return true;
    });

    async function moveTask(taskId: string, status: TaskStatus, note?: string): Promise<Ergebnis> {
      const aufgabe = tasks.find((t) => t.id === taskId);
      if (!aufgabe) return { ok: false, error: "Aufgabe nicht gefunden." };

      const zeile: Record<string, unknown> = { status, updated_by: profil.id };

      if (status === "in_bearbeitung") {
        const text = (note ?? aufgabe.inProgressNote ?? "").trim();
        if (!text) {
          return {
            ok: false,
            error: "Für „Rückfragen offen“ ist eine Notiz erforderlich.",
          };
        }
        zeile.in_progress_note = text;
      }

      if (status === "erledigt") {
        zeile.completed_at = new Date().toISOString();
        zeile.completed_by = profil.id;
      }

      // Sofort umschalten, damit sich das Ziehen nicht zaeh anfuehlt.
      setTasks((alt) => alt.map((t) => (t.id === taskId ? { ...t, status } : t)));

      const { error } = await sb.from("tasks").update(zeile).eq("id", taskId);
      await neuLaden();

      if (error) {
        return {
          ok: false,
          error: /tasks_in_bearbeitung_braucht_notiz/.test(error.message)
            ? "Die Datenbank verlangt für „Rückfragen offen“ eine Notiz."
            : error.message,
        };
      }

      if (status === "in_bearbeitung" || status === "erledigt") {
        // Mails laufen auf dem Server; ein Fehlschlag darf den
        // Statuswechsel nicht rueckgaengig machen.
        void fetch("/api/mail/aufgabe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, status }),
        }).catch(() => undefined);
      }

      return { ok: true };
    }

    async function claimTask(taskId: string): Promise<Ergebnis> {
      const { error } = await sb
        .from("tasks")
        .update({ assignee_id: profil.id, is_pool: false, updated_by: profil.id })
        .eq("id", taskId);

      if (error) {
        await neuLaden();
        return { ok: false, error: error.message };
      }

      // Wer sich eine Aufgabe zieht, steht auch in onOffice als Bearbeiter.
      // Bewusst danach und ohne Abwarten des Ergebnisses: eine hakende
      // Schnittstelle darf niemanden daran hindern, seine Arbeit zu
      // uebernehmen. Was dabei passiert ist, steht im Protokoll.
      let hinweis: string | undefined;
      try {
        const res = await fetch("/api/onoffice/bearbeiter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId }),
        });
        const json = await res.json().catch(() => ({}));
        if (json?.uebertragen === false && json?.meldung) hinweis = json.meldung;
      } catch {
        hinweis = "Die Übernahme steht, onOffice war aber gerade nicht erreichbar.";
      }

      await neuLaden();
      return hinweis ? { ok: true, error: hinweis } : { ok: true };
    }

    async function createTask(input: Partial<Task> & { title: string }): Promise<string | null> {
      const zeile = {
        ...aufgabeZurZeile(input),
        title: input.title,
        creator_id: profil.id,
        status: input.status ?? "offen",
        priority: input.priority ?? "normal",
        visible_from: input.visibleFrom ?? heute,
        is_pool: input.isPool ?? false,
        is_private: input.isPrivate ?? false,
        source: "manuell",
        updated_by: profil.id,
      };

      const { data, error } = await sb.from("tasks").insert(zeile).select("id").single();
      await neuLaden();

      if (error) {
        setFehler(error.message);
        return null;
      }
      return data?.id ?? null;
    }

    async function updateTask(taskId: string, patch: Partial<Task>): Promise<Ergebnis> {
      const zeile = { ...aufgabeZurZeile(patch), updated_by: profil.id };
      const { error } = await sb.from("tasks").update(zeile).eq("id", taskId);
      await neuLaden();
      return error ? { ok: false, error: error.message } : { ok: true };
    }

    async function deleteTask(taskId: string): Promise<Ergebnis> {
      const { error } = await sb.from("tasks").delete().eq("id", taskId);
      await neuLaden();
      return error ? { ok: false, error: error.message } : { ok: true };
    }

    /**
     * Eine Karte in ihrer Liste nach oben oder unten schieben.
     *
     * Getauscht werden die Positionswerte der beiden Nachbarn. Weil das
     * Gleitkommazahlen sind, muss dabei nichts neu durchnummeriert werden.
     * "inListe" ist die Liste, die der Mensch gerade vor sich sieht - nur
     * darin ergibt oben und unten einen Sinn.
     */
    async function verschiebe(taskId: string, richtung: -1 | 1, inListe: Task[]): Promise<Ergebnis> {
      const i = inListe.findIndex((t) => t.id === taskId);
      const j = i + richtung;
      if (i < 0 || j < 0 || j >= inListe.length) return { ok: true };

      const a = inListe[i];
      const b = inListe[j];

      // Wer noch nie sortiert wurde, hat keine Position - dann vergeben wir
      // eine aus der aktuellen Reihenfolge, sonst tauscht man gegen NULL.
      const posA = a.position ?? (i + 1) * 100;
      const posB = b.position ?? (j + 1) * 100;

      setTasks((alt2) =>
        alt2.map((t) =>
          t.id === a.id ? { ...t, position: posB } : t.id === b.id ? { ...t, position: posA } : t,
        ),
      );

      const [e1, e2] = await Promise.all([
        sb.from("tasks").update({ position: posB }).eq("id", a.id),
        sb.from("tasks").update({ position: posA }).eq("id", b.id),
      ]);
      await neuLaden();

      const fehler2 = e1.error ?? e2.error;
      return fehler2 ? { ok: false, error: fehler2.message } : { ok: true };
    }

    async function addAttachments(taskId: string, files: File[]) {
      const rejected: string[] = [];
      let added = 0;
      const maxBytes = settings.attachmentMaxMb * 1024 * 1024;

      for (const file of files) {
        // ALLOWED_EXTENSIONS steht ohne fuehrenden Punkt. Der Vergleich lief
        // vorher mit Punkt und war damit immer falsch - jede Datei waere
        // abgelehnt worden.
        const endung = (file.name.split(".").pop() ?? "").toLowerCase();
        if (!endung || !ALLOWED_EXTENSIONS.includes(endung)) {
          rejected.push(`${file.name} – Dateityp nicht erlaubt`);
          continue;
        }
        if (file.size > maxBytes) {
          rejected.push(`${file.name} – größer als ${settings.attachmentMaxMb} MB`);
          continue;
        }

        const pfad = `${taskId}/${crypto.randomUUID()}.${endung}`;
        const { error: ladeFehler } = await sb.storage
          .from("task-attachments")
          .upload(pfad, file, { contentType: file.type || undefined, upsert: false });

        if (ladeFehler) {
          rejected.push(`${file.name} – ${ladeFehler.message}`);
          continue;
        }

        const { error: zeileFehler } = await sb.from("task_attachments").insert({
          task_id: taskId,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          storage_path: pfad,
          origin: "lokal",
          uploaded_by: profil.id,
          sync_state: settings.attachmentPushOnoffice ? "wartet" : "lokal",
          onoffice_art: settings.attachmentDefaultArt,
        });

        if (zeileFehler) {
          // Datei liegt schon im Speicher, der Eintrag fehlt - dann die
          // Datei wieder weg, sonst bleibt sie unerreichbar liegen.
          await sb.storage.from("task-attachments").remove([pfad]);
          rejected.push(`${file.name} – ${zeileFehler.message}`);
          continue;
        }
        added++;
      }

      await neuLaden();
      return { added, rejected };
    }

    async function removeAttachment(taskId: string, attachmentId: string): Promise<Ergebnis> {
      const { data } = await sb
        .from("task_attachments")
        .select("storage_path")
        .eq("id", attachmentId)
        .maybeSingle();

      const { error } = await sb.from("task_attachments").delete().eq("id", attachmentId);
      if (!error && data?.storage_path) {
        await sb.storage.from("task-attachments").remove([data.storage_path]);
      }
      await neuLaden();
      return error ? { ok: false, error: error.message } : { ok: true };
    }

    /** Kurzlebiger Link statt oeffentlicher Adresse. */
    async function attachmentUrl(attachmentId: string): Promise<string | null> {
      const { data } = await sb
        .from("task_attachments")
        .select("storage_path")
        .eq("id", attachmentId)
        .maybeSingle();

      if (!data?.storage_path) return null;

      const { data: link } = await sb.storage
        .from("task-attachments")
        .createSignedUrl(data.storage_path, 300);

      return link?.signedUrl ?? null;
    }

    async function runAttachmentSync() {
      try {
        const res = await fetch("/api/sync/anhaenge", { method: "POST" });
        const json = await res.json().catch(() => ({}));
        await neuLaden();
        return { pushed: Number(json.pushed ?? 0), meldung: json.meldung };
      } catch (err) {
        return { pushed: 0, meldung: (err as Error).message };
      }
    }

    async function upsertCategory(cat: Category): Promise<Ergebnis> {
      const zeile = {
        name: cat.name,
        color: cat.color,
        sort_order: cat.sortOrder,
        is_active: cat.isActive,
      };
      const { error } = cat.id
        ? await sb.from("categories").update(zeile).eq("id", cat.id)
        : await sb.from("categories").insert(zeile);
      await neuLaden();
      return error ? { ok: false, error: error.message } : { ok: true };
    }

    async function removeCategory(id: string): Promise<Ergebnis> {
      const { error } = await sb.from("categories").delete().eq("id", id);
      await neuLaden();
      return error ? { ok: false, error: error.message } : { ok: true };
    }

    async function moveCategory(id: string, dir: -1 | 1): Promise<Ergebnis> {
      const sortiert = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
      const i = sortiert.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= sortiert.length) return { ok: true };

      const a = sortiert[i];
      const b = sortiert[j];
      const [e1, e2] = await Promise.all([
        sb.from("categories").update({ sort_order: b.sortOrder }).eq("id", a.id),
        sb.from("categories").update({ sort_order: a.sortOrder }).eq("id", b.id),
      ]);
      await neuLaden();
      const err = e1.error ?? e2.error;
      return err ? { ok: false, error: err.message } : { ok: true };
    }

    async function updateTemplate(key: NotifyKind, patch: Partial<EmailTemplate>): Promise<Ergebnis> {
      const zeile: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.subject !== undefined) zeile.subject = patch.subject;
      if (patch.body !== undefined) zeile.body = patch.body;
      if (patch.isActive !== undefined) zeile.is_active = patch.isActive;
      if (patch.label !== undefined) zeile.label = patch.label;

      const { error } = await sb.from("email_templates").update(zeile).eq("key", key);
      await neuLaden();
      return error ? { ok: false, error: error.message } : { ok: true };
    }

    async function updateSettings(patch: Partial<AppSettings>): Promise<Ergebnis> {
      const { error } = await sb
        .from("app_settings")
        .update({ ...einstellungenZurZeile(patch), updated_at: new Date().toISOString() })
        .eq("id", true);
      await neuLaden();
      return error ? { ok: false, error: error.message } : { ok: true };
    }

    async function runEscalationJob() {
      try {
        const res = await fetch("/api/mail/eskalation", { method: "POST" });
        const json = await res.json().catch(() => ({}));
        await neuLaden();
        return {
          reminders: Number(json.erinnerungen ?? 0),
          escalations: Number(json.eskalationen ?? 0),
          meldung: json.meldung,
        };
      } catch (err) {
        return { reminders: 0, escalations: 0, meldung: (err as Error).message };
      }
    }

    return {
      bereit,
      fehler,
      tasks,
      visibleTasks,
      profiles,
      brokers,
      categories,
      templates,
      notifications,
      settings,
      me,
      isAdmin,
      neuLaden,
      moveTask,
      claimTask,
      createTask,
      updateTask,
      deleteTask,
      verschiebe,
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
      profileById,
      categoryById,
      brokerById,
    };
  }, [
    bereit,
    fehler,
    tasks,
    profiles,
    brokers,
    categories,
    templates,
    notifications,
    settings,
    profil,
    neuLaden,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore muss innerhalb von StoreProvider verwendet werden.");
  return ctx;
}
