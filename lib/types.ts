export type TaskStatus = "offen" | "in_bearbeitung" | "erledigt";
/**
 * Drei Stufen, und jede hat eine Aufgabe:
 *  - hoch:    ueberspringt den Trichter, geht sofort an die Person
 *  - normal:  der Regelfall
 *  - niedrig: wartet, bis nichts Dringenderes da ist
 */
export type TaskPriority = "hoch" | "normal" | "niedrig";

export const PRIO_LABEL: Record<TaskPriority, string> = {
  hoch: "Hoch",
  normal: "Normal",
  niedrig: "Niedrig",
};

/** Kleiner ist wichtiger - so sortiert die Warteschlange. */
export const PRIO_RANG: Record<TaskPriority, number> = {
  hoch: 1,
  normal: 2,
  niedrig: 3,
};
/**
 * Die Rollen des Hauses.
 *
 * Frueher hiessen sie superadmin/admin/mitarbeiter. Das beschrieb
 * Rechte, nicht Menschen - und wer im Haus "Admin" ist, war nie klar.
 * Jetzt stehen die Rollen fuer Funktionen: Geschaeftsfuehrung,
 * Qualitaetsmanagement, Mitarbeitende. Der Superadmin bleibt als das,
 * was er ist: der Schluessel fuer alles, unabhaengig von jeder
 * Einstellung.
 */
export type AppRole = "superadmin" | "gf" | "qm" | "user";

/** Die Bereiche, deren Sichtbarkeit sich je Rolle steuern laesst. */
export type Bereich =
  | "dashboard"
  | "mein_tag"
  | "pool"
  | "verteilt"
  | "uebersicht"
  | "verwaltung"
  | "archiv"
  | "asana"
  | "pinnwand";

export const BEREICH_LABEL: Record<Bereich, string> = {
  dashboard: "Dashboard",
  mein_tag: "Mein Tag",
  pool: "Aufgabenpool",
  verteilt: "Verteilt",
  // Der Schluessel heisst weiter "uebersicht" - er steht so in der
  // Tabelle rollen_bereiche. Sichtbar ist nur der Name.
  uebersicht: "Team",
  verwaltung: "Verwaltung",
  archiv: "Archiv",
  asana: "Asana (Geschäftsführung)",
  pinnwand: "Pinnwand",
};

/**
 * Ein Zettel an der Pinnwand.
 *
 * Frueher ein eigenes Projekt ("Teamboard") mit eigener Anmeldung,
 * eigener Datenbank und eigener Adresse - fuer eine Handvoll Notizen.
 * Hier ist es ein Bereich wie jeder andere.
 *
 * Bewusst KEINE Aufgabe: kein Bearbeiter, keine Frist, keine
 * Eskalation. Ein Pin ist etwas, das man wissen muss, nicht etwas,
 * das jemand tun muss. Wer daraus eine Aufgabe macht, legt eine an.
 */
export interface Pin {
  id: string;
  titel: string;
  text: string;
  kategorieId: string | null;
  /** Ein Datum auf dem Zettel, wenn es eins gibt. Sonst null. */
  datum: string | null;
  /** Oben festhalten, damit Wichtiges nicht mit dem Alter nach unten rutscht. */
  angeheftet: boolean;
  sortOrder: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PinKategorie {
  id: string;
  name: string;
  farbe: string;
  sortOrder: number;
  isActive: boolean;
}

export const ROLLE_LABEL: Record<AppRole, string> = {
  superadmin: "Superadmin",
  gf: "Geschäftsführung",
  qm: "Qualitätsmanagement",
  user: "Mitarbeiter",
};

/** Eine Spalte des Asana-Boards. */
export type AsanaBereich = "projekt" | "eigene";

export const ASANA_BEREICH_LABEL: Record<AsanaBereich, string> = {
  projekt: "Projekt",
  eigene: "Eigene Aufgaben",
};

export interface AsanaSpalte {
  gid: string;
  name: string;
  sortOrder: number;
  istPool: boolean;
  /**
   * Woher die Spalte kommt: aus dem gespiegelten Projekt oder aus
   * "Meine Aufgaben". Zwei Bretter, eine Tabelle - die Aufgaben sind
   * dieselben, die Ordnung ist es nicht.
   */
  bereich: AsanaBereich;
}

/** Wer in Asana zustaendig sein kann - auch ohne Zugang zum Tool. */
export interface AsanaNutzer {
  gid: string;
  name: string;
  email?: string;
  profileId?: string | null;
}

/** Sichtbarkeit je Rolle und Bereich, wie sie in der Datenbank steht. */
export type Bereichsrechte = Record<string, Record<string, boolean>>;

/**
 * Darf diese Rolle den Bereich sehen?
 *
 * Der Superadmin fragt gar nicht erst - er sieht alles, immer. Sonst
 * koennte eine falsch gesetzte Zeile den letzten Zugang zur Verwaltung
 * zusperren, und dann hilft nur noch die Datenbank.
 */
export function darfSehen(
  rolle: AppRole,
  bereich: Bereich,
  rechte: Bereichsrechte,
): boolean {
  if (rolle === "superadmin") return true;
  return rechte[rolle]?.[bereich] ?? false;
}
export type TaskSource = "manuell" | "email" | "onoffice" | "qm";

export type NotifyKind =
  | "aufgabe_erledigt_makler"
  | "in_bearbeitung_notiz"
  | "erinnerung_3t"
  | "eskalation_7t"
  | "aufgabe_in_pool";

export interface Profile {
  /** Trichter: sieht diese Person nur eine begrenzte Zahl Aufgaben? */
  trichterAktiv?: boolean;
  /** Wie viele gleichzeitig - intern das Doppelte in Punkten. */
  trichterGrenze?: number;
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
  | "nur_onoffice" // in onOffice gefunden, Inhalt noch nicht geholt
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
  // Frueher hiess das "nur in onOffice" - eine Sackgasse. Seit der
  // Rueckweg offen ist, ist es nur noch eine Durchgangsstation: die
  // Datei ist entdeckt, der Inhalt kommt mit dem naechsten Abgleich.
  nur_onoffice: "wird geholt",
  fehler: "Fehler",
};

/**
 * Eine Notiz an einer Aufgabe.
 *
 * Frueher war das ein einzelnes Feld, das die naechste Notiz
 * ueberschrieb. Jetzt ein Verlauf: wer eine Aufgabe zurueckgibt oder
 * eine Rueckfrage stellt, soll den Faden nachlesen koennen.
 */
export interface TaskNote {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
  /** Wann die Notiz im Kommentarfeld der onOffice-Aufgabe landete. */
  onofficePushedAt?: string | null;
  onofficeError?: string | null;
}

/**
 * Was im Chatsymbol auftaucht.
 *
 * Nicht zu verwechseln mit NotificationEntry: das ist das Protokoll der
 * verschickten E-Mails. Hier geht es um das, was eine Person im Tool
 * noch nicht gelesen hat.
 */
export interface Meldung {
  id: string;
  taskId: string | null;
  noteId: string | null;
  kind: string;
  titel: string;
  text?: string;
  createdAt: string;
  readAt: string | null;
}

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
  /**
   * Objekt und Kunde: je Datensatz eine ID und eine Nummer.
   *
   * Die ID ist die Datensatznummer in onOffice - damit wird
   * verknuepft und verlinkt. Die NUMMER ist, was im Haus benutzt wird
   * (Objektnummer, Kundennummer) - damit wird gesucht und darueber
   * gesprochen. Beides zu verwechseln kostet einen halben Tag: ein
   * Deeplink mit der Objektnummer fuehrt auf ein fremdes Objekt oder
   * ins Leere.
   *
   * Objekt UND Kunde, nicht entweder oder: eine Aufgabe kann an
   * beidem haengen.
   */
  onofficeEstateId?: string;
  onofficeEstateNo?: string;
  onofficeAddressId?: string;
  onofficeAddressNo?: string;
  /**
   * Das Feld "tags" aus onOffice, unveraendert. Dort steht, FUER WEN
   * gearbeitet wird; im Tool ist das "Auftrag von". Bleibt auch dann
   * stehen, wenn das Tag zu keinem Kollegen passt - sonst waere die
   * Angabe verloren und niemand koennte sie nachtragen.
   */
  onofficeTag?: string;
  source: TaskSource;
  inProgressNote?: string;
  createdAt: string;
  completedAt: string | null;
  /** Selbst gewaehlte Reihenfolge; null = noch nie sortiert. */
  position: number | null;
  history: StatusHistoryEntry[];
  attachments: Attachment[];
  notes: TaskNote[];
  /** In welchem Bereich die Aufgabe lebt. */
  bereich: "task" | "asana";
  asanaTaskGid?: string | null;
  asanaSectionGid?: string | null;
  /**
   * Der Abschnitt in "Meine Aufgaben".
   *
   * Unabhaengig von asanaSectionGid: eine Aufgabe kann in beidem
   * liegen und steht dann auf beiden Brettern. Sie bleibt trotzdem
   * EINE Aufgabe - erledigt ist erledigt, auf beiden.
   */
  asanaEigeneSectionGid?: string | null;
  /**
   * Reihenfolge im Asana-Board. Klein heisst weiter oben.
   *
   * Asana fuehrt die Reihenfolge, der Abgleich schreibt sie hier hinein.
   * Beim Verschieben im Board setzt das Tool sofort einen Zwischenwert,
   * damit die Karte nicht erst beim naechsten Abgleich an ihren Platz
   * springt. Null heisst: noch nie eingeordnet - solche Karten haengen
   * hinten an.
   */
  asanaRang?: number | null;
  /** Dasselbe fuer das Brett "Meine Aufgaben". */
  asanaEigeneRang?: number | null;
  asanaAssigneeGid?: string | null;
  /** Zugewiesen, aber hinter dem Trichter - fuer den Bearbeiter unsichtbar. */
  wartet: boolean;
  /**
   * Warum die Aufgabe zurueck in den Pool ging, und von wem. Bleibt
   * stehen, bis sie sich jemand zieht - wer sie uebernimmt, soll wissen,
   * woran die vorige Person haengengeblieben ist.
   */
  poolGrund?: string | null;
  poolZurueckAm?: string | null;
  /**
   * Seit wann die Aufgabe im Pool liegt.
   *
   * Gesetzt von der Datenbank, nicht von der Oberflaeche: in den Pool
   * kommt eine Aufgabe auf vier Wegen, und vier Stellen waeren vier
   * Chancen, den Zeitpunkt zu vergessen.
   */
  poolSeit?: string | null;
  /**
   * Lag die Aufgabe jemals im Pool?
   *
   * Einmal wahr, bleibt wahr. Entscheidet, ob sie privat werden darf:
   * was aus dem Pool kam, gehoert dem Haus und nicht einem Einzelnen.
   */
  jeImPool?: boolean;
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
  /** Ab so vielen Minuten im Pool wird die Karte orange umrandet. */
  poolWarnMinuten: number;
  /** Ab so vielen Minuten rot. */
  poolAlarmMinuten: number;
  attachmentMaxMb: number;
  attachmentPushOnoffice: boolean;
  attachmentDefaultArt: string;
  /**
   * onOffice-Adressen, die nie als "Kunde" an einer Aufgabe stehen.
   * Kommagetrennte Datensatz-IDs. Hintergrund: onOffice haengt die
   * eigene Firmenadresse an fast jede Aufgabe - die ist kein Kunde.
   */
  onofficeAdressAusschluss: string;
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
/**
 * Darf diese Aufgabe privat werden?
 *
 * Drei Bedingungen, und jede hat einen Grund:
 *
 *  - ICH habe sie angelegt. Was jemand anderes mir gegeben hat, darf
 *    ich nicht vor ihm verstecken.
 *  - Sie gehoert MIR. Privat ohne Bearbeiter waere ein Zettel ohne
 *    Besitzer - auf keinem Board, in keiner Auswertung.
 *  - Sie war NIE im Pool. Was das Haus verteilt hat, gehoert dem
 *    Haus; es nachtraeglich hinter einem Haken verschwinden zu
 *    lassen, waere ein stiller Diebstahl aus der gemeinsamen Liste.
 */
export function darfPrivatWerden(t: Task, meineId: string): boolean {
  return (
    t.creatorId === meineId &&
    t.assigneeId === meineId &&
    !t.isPool &&
    !t.jeImPool
  );
}

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
