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
  zuAsanaNutzer,
  zuAsanaSpalte,
  zuAufgabe,
  zuBenachrichtigung,
  zuEinstellungen,
  zuMeldung,
  zuKategorie,
  zuKollege,
  zuProfil,
  zuVorlage,
} from "@/lib/daten/abbildung";
import { ALLOWED_EXTENSIONS } from "./data";
import type {
  AppSettings,
  AsanaNutzer,
  AsanaSpalte,
  BrokerContact,
  Category,
  EmailTemplate,
  Meldung,
  NotificationEntry,
  NotifyKind,
  Profile,
  Task,
  TaskStatus,
} from "./types";

const AUFGABE_SPALTEN = `
  id, title, description, status, priority, category_id, creator_id, assignee_id,
  bereich, asana_task_gid, asana_section_gid, asana_assignee_gid,
  broker_contact_id, onoffice_bearbeiter_id, is_pool, is_private, visible_from, due_date,
  onoffice_task_id, onoffice_estate_no, onoffice_estate_id, onoffice_address_id, source,
  onoffice_assignee, onoffice_responsible,
  in_progress_note, created_at, completed_at, position, reminder_3d_sent_at,
  pool_grund, pool_zurueck_am, pool_zurueck_von,
  escalation_7d_sent_at,
  task_status_history ( created_at, from_status, to_status, note, changed_by ),
  task_attachments ( id, file_name, mime_type, size_bytes, origin, uploaded_by,
                     onoffice_file_id, sync_state, sync_error, created_at, storage_path ),
  task_notes ( id, task_id, author_id, body, created_at, onoffice_pushed_at, onoffice_error )
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

  /** Der Bereich der Geschaeftsfuehrung: Spalten, Karten, Mitglieder. */
  asanaSpalten: AsanaSpalte[];
  asanaTasks: Task[];
  asanaNutzer: AsanaNutzer[];
  /** Karte in eine andere Spalte legen; die Pool-Spalte gibt sie ab. */
  asanaVerschieben: (taskId: string, sectionGid: string) => Promise<Ergebnis>;
  /** Eine Aufgabe im Asana-Bereich anlegen - sie entsteht in Asana. */
  asanaAnlegen: (werte: {
    titel: string;
    beschreibung?: string;
    sectionGid?: string;
    assigneeGid?: string | null;
    dueOn?: string | null;
  }) => Promise<Ergebnis>;
  /** Zustaendigkeit und Frist in Asana setzen. */
  asanaZuteilen: (
    taskId: string,
    werte: { assigneeGid?: string | null; dueOn?: string | null },
  ) => Promise<Ergebnis>;
  /** Eine Karte innerhalb ihrer Liste an eine andere Stelle setzen. */
  sortiere: (taskId: string, vorTaskId: string | null, inListe: Task[]) => Promise<Ergebnis>;

  /** Was diese Person im Chatsymbol sieht, neueste zuerst. */
  meldungen: Meldung[];
  ungelesen: number;
  addNote: (taskId: string, body: string) => Promise<Ergebnis>;
  meldungGelesen: (id: string) => Promise<void>;
  alleMeldungenGelesen: () => Promise<void>;

  moveTask: (taskId: string, status: TaskStatus, note?: string) => Promise<Ergebnis>;
  claimTask: (taskId: string) => Promise<Ergebnis>;
  /**
   * Aufgabe zurueck in den Pool, mit Begruendung. Der Grund ist Pflicht:
   * wer sie als naechstes zieht, soll wissen, woran die vorige Person
   * haengengeblieben ist.
   */
  inDenPool: (taskId: string, grund: string) => Promise<Ergebnis>;
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
  /**
   * Kollege zu einem onOffice-Kuerzel.
   *
   * Die Schnittstelle liefert den Bearbeiter einer Aufgabe als blosses
   * Kuerzel - "BaufiErcan", nicht "Ercan, Dilara". Die Oberflaeche von
   * onOffice zeigt das schoener an, die API nicht. Damit auf einer
   * Kachel ein Name steht und kein Login, wird hier nachgeschlagen.
   */
  kollegeNachKuerzel: (kuerzel: string | null | undefined) => BrokerContact | undefined;
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
  const [meldungen, setMeldungen] = useState<Meldung[]>([]);
  const [asanaSpalten, setAsanaSpalten] = useState<AsanaSpalte[]>([]);
  const [asanaNutzer, setAsanaNutzer] = useState<AsanaNutzer[]>([]);

  const neuLaden = useCallback(async () => {
    const sb = supabaseBrowser();
    setFehler(null);

    const [a, p, k, ka, v, e, n, m, as, an] = await Promise.all([
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
      sb
        .from("notifications")
        .select("id, task_id, note_id, kind, titel, text, created_at, read_at")
        .order("created_at", { ascending: false })
        .limit(100),
      sb
        .from("asana_sections")
        .select("gid, name, sort_order, ist_pool")
        .eq("sichtbar", true)
        .order("sort_order"),
      sb.from("asana_users").select("gid, name, email, profile_id").order("name"),
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
    // Die Zeilen sind durch RLS schon auf die eigene Person begrenzt.
    if (m.data) setMeldungen(m.data.map(zuMeldung));
    if (as.data) setAsanaSpalten(as.data.map(zuAsanaSpalte));
    if (an.data) setAsanaNutzer(an.data.map(zuAsanaNutzer));

    setBereit(true);
  }, []);

  useEffect(() => {
    void neuLaden();
  }, [neuLaden]);

  /**
   * Von allein nachladen.
   *
   * Der Abgleich mit onOffice laeuft alle fuenf Minuten auf dem Server.
   * Der Browser hat davon nichts gemerkt: geladen wurde beim Oeffnen der
   * Seite und danach nur noch nach eigenen Aenderungen. Wer das Tool
   * morgens aufmacht und offen liegen laesst - also der Normalfall -
   * sah den ganzen Tag den Stand von morgens. Eine Aufgabe, die drueben
   * wieder aufgemacht wurde, kam an, war in der Datenbank richtig und
   * blieb auf dem Bildschirm trotzdem erledigt.
   *
   * Zwei Ausloeser, weil beide etwas anderes abdecken:
   *
   *  - beim Zurueckkommen zum Tab. Das ist der haeufigste Fall und der
   *    einzige, der sich sofort richtig anfuehlt: wer hinsieht, sieht
   *    den aktuellen Stand.
   *  - alle sechzig Sekunden, solange der Tab sichtbar ist. Fuer den
   *    zweiten Bildschirm, auf dem das Board einfach liegt.
   *
   * Im Hintergrund wird nicht geladen. Ein Tab, den seit Stunden
   * niemand ansieht, braucht keine Daten - er holt sie sich, sobald
   * jemand hinschaut.
   */
  useEffect(() => {
    const sichtbar = () => document.visibilityState === "visible";

    const beiRueckkehr = () => {
      if (sichtbar()) void neuLaden();
    };

    document.addEventListener("visibilitychange", beiRueckkehr);
    window.addEventListener("focus", beiRueckkehr);

    // Fuenfundzwanzig statt sechzig Sekunden: der Abgleich mit onOffice
    // laeuft alle zwei Minuten, dazu kommen Aenderungen von Kollegen.
    // Wer am Board arbeitet, soll nicht auf eine Minute warten, um zu
    // sehen, dass eine Aufgabe weg ist.
    const takt = setInterval(() => {
      if (sichtbar()) void neuLaden();
    }, 25_000);

    return () => {
      document.removeEventListener("visibilitychange", beiRueckkehr);
      window.removeEventListener("focus", beiRueckkehr);
      clearInterval(takt);
    };
  }, [neuLaden]);

  /**
   * Sofort mitbekommen, wenn sich an den Aufgaben etwas aendert.
   *
   * Der Takt oben ist das Netz; das hier ist der Normalfall. Postgres
   * meldet jede Aenderung an den Aufgaben und Notizen, und wir laden
   * neu - gebuendelt, denn ein Abgleich schreibt vierzig Zeilen in
   * einer Sekunde, und vierzig Ladevorgaenge braucht niemand.
   */
  useEffect(() => {
    const sb = supabaseBrowser();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const spaeter = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.visibilityState === "visible") void neuLaden();
      }, 700);
    };

    const kanal = sb
      .channel("aufgaben-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, spaeter)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_notes" }, spaeter)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void sb.removeChannel(kanal);
    };
  }, [neuLaden]);

  /**
   * Sofort mitbekommen, wenn jemand etwas schreibt.
   *
   * Der Minutentakt oben reicht fuer Aufgaben, nicht fuer ein Gespraech:
   * wer eine Rueckfrage stellt, wartet nicht eine Minute auf das rote
   * Zeichen. Postgres meldet die neue Zeile selbst, gefiltert auf die
   * eigene Person - wir haengen sie nur vorne an.
   *
   * Faellt die Verbindung aus, ist nichts verloren: der naechste
   * Ladevorgang holt dieselben Zeilen.
   */
  useEffect(() => {
    const sb = supabaseBrowser();
    const kanal = sb
      .channel(`meldungen:${profil.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profil.id}`,
        },
        (nachricht) => {
          const neue = zuMeldung(nachricht.new);
          setMeldungen((alt2) => (alt2.some((x) => x.id === neue.id) ? alt2 : [neue, ...alt2]));
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(kanal);
    };
  }, [profil.id]);

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

    const isAdmin = me.role === "gf" || me.role === "superadmin";

    const profileById = (id: string | null) => profiles.find((p) => p.id === id);
    const categoryById = (id: string | null) => categories.find((c) => c.id === id);
    const brokerById = (id: string | null) => brokers.find((b) => b.id === id);
    const kollegeNachKuerzel = (kuerzel: string | null | undefined) => {
      const k = String(kuerzel ?? "").trim().toLowerCase();
      if (!k) return undefined;
      return brokers.find((b) => b.shortCode.trim().toLowerCase() === k);
    };

    const heute = new Date().toISOString().slice(0, 10);
    const grenze = Date.now() - settings.doneHideAfterHours * 3600_000;

    /** Tagesgeschaeft: sichtbar ab Startdatum, Erledigtes nur kurz. */
    const visibleTasks = tasks.filter((t) => {
      // Der Bereich der Geschaeftsfuehrung hat sein eigenes Board. In
      // den Listen des Tagesgeschaefts hat er nichts zu suchen -
      // erst, wenn eine Aufgabe in den Pool abgegeben wurde, und dann
      // steht ihr Bereich ohnehin wieder auf "task".
      if (t.bereich === "asana") return false;
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

      let hinweis: string | undefined;

      if (status === "in_bearbeitung" || status === "erledigt") {
        // Mails laufen auf dem Server; ein Fehlschlag darf den
        // Statuswechsel nicht rueckgaengig machen - aber er darf auch
        // nicht lautlos sein. Vorher stand hier ein "void fetch" mit
        // .catch(() => undefined): als die Route wegen einer
        // mehrdeutigen Verknuepfung 500 lieferte, verschwand das
        // spurlos. Keine Mail, kein Protokolleintrag, keine Meldung -
        // die Pflichtnotiz erreichte niemanden, und es gab nichts, woran
        // man das haette sehen koennen.
        try {
          const res = await fetch("/api/mail/aufgabe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId, status }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            hinweis = `Der Status steht, aber die Benachrichtigung ging nicht raus: ${
              json?.fehler ?? `Fehler ${res.status}`
            }`;
          } else if (Array.isArray(json?.fehler) && json.fehler.length) {
            hinweis = `Der Status steht, aber eine Benachrichtigung scheiterte: ${json.fehler[0]}`;
          }
        } catch {
          hinweis = "Der Status steht, die Benachrichtigung konnte aber nicht ausgelöst werden.";
        }
      }

      // Den Status nach onOffice spiegeln. Wie beim Bearbeiter: danach,
      // fail-soft, und was dabei passiert ist, steht im Protokoll. Die
      // Route entscheidet selbst, ob ueberhaupt etwas zu schreiben ist -
      // sie kennt den zuletzt gelesenen Rohwert aus onOffice und laesst
      // einen zurueckgestellten Vorgang in Ruhe, der bei uns nur
      // "offen" heisst.
      if (aufgabe.onofficeTaskId) {
        try {
          const res = await fetch("/api/onoffice/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId }),
          });
          const json = await res.json().catch(() => ({}));
          // Nur echte Fehlschlaege melden. "Es gibt nichts zu
          // uebertragen" und "ist abgeschaltet" sind keine Nachricht,
          // die jemanden bei der Arbeit unterbrechen muss.
          if (res.status === 207 && json?.meldung) hinweis = json.meldung;
        } catch {
          hinweis = "Der Status steht im Tool, onOffice war aber gerade nicht erreichbar.";
        }
      }

      if (aufgabe.asanaTaskGid && status !== aufgabe.status) {
        if (status === "erledigt") vermerkeInAsana(aufgabe, "erledigt");
        else if (aufgabe.status === "erledigt") vermerkeInAsana(aufgabe, "geoeffnet");
      }

      // Kommt die Aufgabe aus Asana - auch wenn sie laengst abgegeben
      // ist -, muss das Abhaken dort ankommen. Sonst haengt drueben in
      // der Pool-Spalte eine Karte, von der niemand weiss, dass sie
      // fertig ist.
      if (aufgabe.asanaTaskGid && (status === "erledigt" || aufgabe.status === "erledigt")) {
        try {
          const res = await fetch("/api/asana/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId, erledigt: status === "erledigt" }),
          });
          const json = await res.json().catch(() => ({}));
          if (res.status === 207 && json?.meldung) hinweis = json.meldung;
        } catch {
          hinweis = "Der Status steht im Tool, Asana war aber gerade nicht erreichbar.";
        }
      }

      return hinweis ? { ok: true, error: hinweis } : { ok: true };
    }

    /**
     * Den Lebenslauf einer Aufgabe in Asana mitschreiben.
     *
     * Nebenher und ohne Abwarten: ein Vermerk ist eine Notiz, kein
     * Arbeitsschritt. Wer sich eine Aufgabe zieht, soll nicht darauf
     * warten, dass Asana antwortet.
     */
    function vermerkeInAsana(
      aufgabe: Task | undefined,
      anlass: "verteilt" | "pool" | "erledigt" | "geoeffnet",
      grund?: string,
    ) {
      if (!aufgabe?.asanaTaskGid) return;
      void fetch("/api/asana/vermerk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: aufgabe.id,
          anlass,
          grund,
          // Beim Uebernehmen loescht das Tool den Pool-Vermerk. Ob die
          // Aufgabe schon einmal zurueckkam, weiss also nur noch der
          // Stand von vorhin - und der steht hier.
          erneut: Boolean(aufgabe.poolZurueckAm),
        }),
      }).catch(() => undefined);
    }

    async function claimTask(taskId: string): Promise<Ergebnis> {
      // Vor dem Speichern merken: gleich sind pool_grund und
      // pool_zurueck_am geloescht, und damit die Vorgeschichte.
      const vorZugriff = tasks.find((t) => t.id === taskId);

      const { error } = await sb
        .from("tasks")
        .update({
          assignee_id: profil.id,
          is_pool: false,
          updated_by: profil.id,
          // Die Begruendung der vorigen Runde ist erledigt, sobald
          // jemand uebernimmt. Sie stehen zu lassen hiesse, dass eine
          // Aufgabe fuer immer den Vermerk traegt, warum sie vor drei
          // Wochen einmal zurueckkam.
          pool_grund: null,
          pool_zurueck_am: null,
          pool_zurueck_von: null,
        })
        .eq("id", taskId);

      if (error) {
        await neuLaden();
        return { ok: false, error: error.message };
      }

      // In Asana steht die Karte weiter in der Pool-Spalte. Damit dort
      // nicht nur steht, dass sie abgegeben wurde, sondern auch, wer
      // sie genommen hat.
      vermerkeInAsana(vorZugriff, "verteilt");

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

    async function inDenPool(taskId: string, grund: string): Promise<Ergebnis> {
      const text = grund.trim();
      if (!text) return { ok: false, error: "Bitte kurz begründen, warum die Aufgabe zurückgeht." };

      const aufgabe = tasks.find((t) => t.id === taskId);

      const { error } = await sb
        .from("tasks")
        .update({
          assignee_id: null,
          onoffice_bearbeiter_id: null,
          is_pool: true,
          pool_grund: text,
          pool_zurueck_am: new Date().toISOString(),
          pool_zurueck_von: profil.id,
          updated_by: profil.id,
        })
        .eq("id", taskId);

      if (error) {
        await neuLaden();
        return { ok: false, error: error.message };
      }

      vermerkeInAsana(aufgabe, "pool", text);

      // Erst den Bearbeiter drueben leeren, dann melden. Beides
      // fail-soft: die Aufgabe liegt im Pool, auch wenn eines davon
      // hakt - aber was gehakt hat, sagen wir.
      const hinweise: string[] = [];

      if (aufgabe?.onofficeTaskId) {
        try {
          const res = await fetch("/api/onoffice/bearbeiter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId }),
          });
          const json = await res.json().catch(() => ({}));
          if (res.status === 207 && json?.meldung) hinweise.push(json.meldung);
        } catch {
          hinweise.push("onOffice war nicht erreichbar, der Bearbeiter steht dort noch.");
        }
      }

      try {
        const res = await fetch("/api/mail/pool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          hinweise.push(`Die Meldung ging nicht raus: ${json?.fehler ?? `Fehler ${res.status}`}`);
        } else if (Array.isArray(json?.fehler) && json.fehler.length) {
          hinweise.push(`Die Meldung ging nicht raus: ${json.fehler[0]}`);
        }
      } catch {
        hinweise.push("Die Meldung an die Hilfe konnte nicht ausgelöst werden.");
      }

      await neuLaden();
      return hinweise.length ? { ok: true, error: hinweise.join(" ") } : { ok: true };
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

      if (error) {
        await neuLaden();
        setFehler(error.message);
        return null;
      }

      // Gleich auch drueben anlegen. Sonst sucht der Bearbeiter die
      // Aufgabe in onOffice und findet sie nicht - und beim naechsten
      // Abgleich kaeme sie auch nicht von selbst, denn sie existiert
      // dort ja gar nicht. Private Aufgaben lehnt die Route selbst ab.
      if (data?.id && !input.isPrivate) {
        try {
          const res = await fetch("/api/onoffice/anlegen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId: data.id }),
          });
          const json = await res.json().catch(() => ({}));
          if (res.status === 207 && json?.meldung) setFehler(json.meldung);
        } catch {
          setFehler(
            "Die Aufgabe ist angelegt, onOffice war aber gerade nicht erreichbar – " +
              "dort fehlt sie noch.",
          );
        }
      }

      await neuLaden();
      return data?.id ?? null;
    }

    async function updateTask(taskId: string, patch: Partial<Task>): Promise<Ergebnis> {
      const vorher = tasks.find((t) => t.id === taskId);
      const zeile = { ...aufgabeZurZeile(patch), updated_by: profil.id };
      const { error } = await sb.from("tasks").update(zeile).eq("id", taskId);

      if (error) {
        await neuLaden();
        return { ok: false, error: error.message };
      }

      // Die Zuweisung ist kein Feld wie jedes andere: sie steht in
      // onOffice genauso. Wer sie hier aendert und drueben nicht,
      // bekommt sie beim naechsten Abgleich zurueckgedreht - onOffice
      // fuehrt bei diesem Feld. Also derselbe Weg wie beim Ziehen aus
      // dem Pool, mitsamt Leeren beim Zuruecklegen.
      // Zuweisung heisst: Nutzer, Kollege oder Pool - alle drei landen
      // im selben Feld drueben.
      const zuweisungGeaendert =
        (patch.assigneeId !== undefined && patch.assigneeId !== (vorher?.assigneeId ?? null)) ||
        (patch.onofficeBearbeiterId !== undefined &&
          patch.onofficeBearbeiterId !== (vorher?.onofficeBearbeiterId ?? null)) ||
        (patch.isPool !== undefined && patch.isPool !== (vorher?.isPool ?? false));

      // Eine Umverteilung ist fuer die Karte in Asana dasselbe
      // Ereignis wie das Ziehen aus dem Pool: jemand anderes ist
      // jetzt dran.
      if (zuweisungGeaendert && vorher?.asanaTaskGid) {
        const nachher = patch.assigneeId ?? vorher.assigneeId;
        vermerkeInAsana({ ...vorher, assigneeId: nachher ?? null }, nachher ? "verteilt" : "pool");
      }

      let hinweis: string | undefined;
      if (zuweisungGeaendert && vorher?.onofficeTaskId) {
        try {
          const res = await fetch("/api/onoffice/bearbeiter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId }),
          });
          const json = await res.json().catch(() => ({}));
          if (res.status === 207 && json?.meldung) hinweis = json.meldung;
        } catch {
          hinweis = "Die Zuweisung steht im Tool, onOffice war aber gerade nicht erreichbar.";
        }
      }

      // Betreff, Text, Frist und Prioritaet fuehrt onOffice. Wer sie nur
      // hier aendert, sieht die Aenderung fuenf Minuten lang - dann holt
      // der Abgleich den alten Stand zurueck. Also gleich mitschreiben.
      const inhaltFelder: string[] = [];
      if (patch.title !== undefined && patch.title !== vorher?.title) {
        inhaltFelder.push("titel");
      }
      if (
        patch.description !== undefined &&
        (patch.description ?? "") !== (vorher?.description ?? "")
      ) {
        inhaltFelder.push("beschreibung");
      }
      if (patch.dueDate !== undefined && (patch.dueDate ?? null) !== (vorher?.dueDate ?? null)) {
        inhaltFelder.push("faelligkeit");
      }
      if (patch.priority !== undefined && patch.priority !== vorher?.priority) {
        inhaltFelder.push("prioritaet");
      }

      if (inhaltFelder.length && vorher?.onofficeTaskId) {
        try {
          const res = await fetch("/api/onoffice/aufgabe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId, felder: inhaltFelder }),
          });
          const json = await res.json().catch(() => ({}));
          if (res.status === 207 && json?.meldung) hinweis = json.meldung;
        } catch {
          hinweis =
            "Die Änderung steht im Tool, onOffice war aber gerade nicht erreichbar – " +
            "dort gilt weiter der alte Stand.";
        }
      }

      await neuLaden();
      return hinweis ? { ok: true, error: hinweis } : { ok: true };
    }

    /**
     * Eine Notiz an eine Aufgabe schreiben.
     *
     * Wer benachrichtigt wird, entscheidet die Datenbank: ein Trigger
     * legt fuer Ersteller und Bearbeiter je eine Meldung an - nur nicht
     * fuer den, der gerade schreibt. Im Browser waere das falsch
     * aufgehoben, er duerfte gar keine Zeilen fuer andere anlegen.
     */
    async function addNote(taskId: string, body: string): Promise<Ergebnis> {
      const text = body.trim();
      if (!text) return { ok: false, error: "Eine leere Notiz hilft niemandem." };

      const { error } = await sb
        .from("task_notes")
        .insert({ task_id: taskId, author_id: profil.id, body: text });

      if (error) return { ok: false, error: error.message };

      const aufgabe = tasks.find((t) => t.id === taskId);
      let hinweis: string | undefined;

      // Auch nach Asana - und zwar bei JEDER Aufgabe mit Asana-Nummer,
      // auch den abgegebenen im Pool. Gerade bei denen ist die
      // Rueckmeldung das Wichtigste: in Asana steht die Karte in der
      // Pool-Spalte, und wer dort nachsieht, soll lesen, was der
      // Kollege dazu geschrieben hat.
      if (aufgabe?.asanaTaskGid && !aufgabe.isPrivate) {
        void fetch("/api/asana/notiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId }),
        }).catch(() => undefined);
      }

      // Gleich nach drueben. onOffice hat kein Kommentarfeld in der
      // Feldliste, aber den Kommentarstrang - siehe
      // lib/onoffice/notizen.
      if (aufgabe?.onofficeTaskId && !aufgabe.isPrivate) {
        try {
          const res = await fetch("/api/onoffice/notiz", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId }),
          });
          const json = await res.json().catch(() => ({}));
          if (res.status === 207 && json?.meldung && !String(json.meldung).startsWith("Keine")) {
            hinweis = json.meldung;
          }
        } catch {
          hinweis = "Die Notiz steht im Tool, onOffice war aber gerade nicht erreichbar.";
        }
      }

      await neuLaden();
      return hinweis ? { ok: true, error: hinweis } : { ok: true };
    }

    async function meldungGelesen(id: string): Promise<void> {
      const jetzt = new Date().toISOString();
      // Zuerst auf dem Bildschirm, dann in der Datenbank: der Zaehler
      // soll beim Aufklappen sofort stimmen.
      setMeldungen((alt2) => alt2.map((m) => (m.id === id ? { ...m, readAt: jetzt } : m)));
      await sb.from("notifications").update({ read_at: jetzt }).eq("id", id);
    }

    async function alleMeldungenGelesen(): Promise<void> {
      const jetzt = new Date().toISOString();
      const offen = meldungen.filter((m) => !m.readAt).map((m) => m.id);
      if (!offen.length) return;

      setMeldungen((alt2) => alt2.map((m) => (m.readAt ? m : { ...m, readAt: jetzt })));
      await sb.from("notifications").update({ read_at: jetzt }).in("id", offen);
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

    /**
     * Eine Karte an eine bestimmte Stelle ihrer Liste setzen.
     *
     * Anders als verschiebe(), das zwei Nachbarn tauscht: hier zieht
     * jemand eine Karte irgendwohin. Die neue Position ist die Mitte
     * zwischen den beiden Karten, zwischen denen sie landet - bei
     * Gleitkommazahlen geht das beliebig oft, ohne neu durchzunummerieren.
     *
     * vorTaskId ist die Karte, VOR die gelegt wird; null heisst ans Ende.
     */
    async function sortiere(
      taskId: string,
      vorTaskId: string | null,
      inListe: Task[],
    ): Promise<Ergebnis> {
      if (taskId === vorTaskId) return { ok: true };

      // Die Liste ohne die gezogene Karte - sonst rechnet man mit der
      // eigenen alten Stelle.
      const ohne = inListe.filter((t) => t.id !== taskId);
      const posVon = (t: Task, i: number) => t.position ?? (i + 1) * 100;

      const zielIndex = vorTaskId ? ohne.findIndex((t) => t.id === vorTaskId) : ohne.length;
      if (vorTaskId && zielIndex < 0) return { ok: true };

      const davor = zielIndex > 0 ? posVon(ohne[zielIndex - 1], zielIndex - 1) : null;
      const danach =
        zielIndex < ohne.length ? posVon(ohne[zielIndex], zielIndex) : null;

      let neu: number;
      if (davor === null && danach === null) neu = 100;
      else if (davor === null) neu = (danach as number) - 50;
      else if (danach === null) neu = davor + 100;
      else neu = (davor + danach) / 2;

      setTasks((alt2) => alt2.map((t) => (t.id === taskId ? { ...t, position: neu } : t)));

      const { error } = await sb.from("tasks").update({ position: neu }).eq("id", taskId);
      await neuLaden();
      return error ? { ok: false, error: error.message } : { ok: true };
    }

    async function asanaVerschieben(taskId: string, sectionGid: string): Promise<Ergebnis> {
      try {
        const res = await fetch("/api/asana/verschieben", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, sectionGid }),
        });
        const json = await res.json().catch(() => ({}));
        await neuLaden();
        return res.ok ? { ok: true, error: json.meldung } : { ok: false, error: json.fehler };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }

    async function asanaAnlegen(werte: {
      titel: string;
      beschreibung?: string;
      sectionGid?: string;
      assigneeGid?: string | null;
      dueOn?: string | null;
    }): Promise<Ergebnis> {
      try {
        const res = await fetch("/api/asana/anlegen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(werte),
        });
        const json = await res.json().catch(() => ({}));
        await neuLaden();
        return res.ok ? { ok: true } : { ok: false, error: json.fehler };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }

    async function asanaZuteilen(
      taskId: string,
      werte: { assigneeGid?: string | null; dueOn?: string | null },
    ): Promise<Ergebnis> {
      try {
        const res = await fetch("/api/asana/zuteilen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, ...werte }),
        });
        const json = await res.json().catch(() => ({}));
        await neuLaden();
        return res.ok ? { ok: true } : { ok: false, error: json.fehler };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
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

      // Nicht auf den Zeitplan warten. Wer eine Datei anhaengt, will sie
      // gleich drueben haben - und sieht sonst minutenlang "wartet", ohne
      // zu wissen, ob etwas kaputt ist. Der Anstoss laeuft nebenher; geht
      // er daneben, holt der Zeitplan es nach.
      if (added > 0 && settings.attachmentPushOnoffice) {
        void fetch("/api/sync/anhaenge", { method: "POST" })
          .then(() => neuLaden())
          .catch(() => undefined);
      }

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
      // Das Tagesgeschaeft sieht den Asana-Bereich nicht. Nicht nur in
      // den Listen: auch alles, was sich sonst aus "tasks" bedient,
      // soll ihn gar nicht erst in die Finger bekommen. Die Funktionen
      // oben arbeiten weiter auf dem vollstaendigen Bestand - sonst
      // liesse sich aus dem Asana-Board heraus nichts mehr aendern.
      tasks: tasks.filter((t) => t.bereich !== "asana"),
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
      inDenPool,
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
      kollegeNachKuerzel,
      // Die beiden Bereiche teilen sich eine Tabelle, aber keine
      // Ansicht: eine Aufgabe der Geschaeftsfuehrung hat in "Mein Tag"
      // nichts verloren, solange sie nicht abgegeben wurde.
      asanaSpalten,
      asanaTasks: tasks.filter((t) => t.bereich === "asana"),
      asanaNutzer,
      asanaAnlegen,
      asanaVerschieben,
      asanaZuteilen,
      sortiere,
      meldungen,
      ungelesen: meldungen.filter((m) => !m.readAt).length,
      addNote,
      meldungGelesen,
      alleMeldungenGelesen,
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
    meldungen,
    asanaSpalten,
    asanaNutzer,
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
