import type {
  AppSettings,
  Attachment,
  BrokerContact,
  Category,
  EmailTemplate,
  NotificationEntry,
  Profile,
  Task,
} from "./types";

export function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function isoTime(offsetDays = 0, hour = 9): string {
  const d = new Date();
  d.setHours(hour, 12, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

export const PROFILES: Profile[] = [
  {
    id: "u-eike",
    fullName: "Eike Lensinger",
    email: "lensinger@4-wk.de",
    role: "superadmin",
    onofficeUsername: "Lensinger, Eike (EL)",
    color: "#88cc44",
    initials: "EL",
  },
  {
    id: "u-markus",
    fullName: "Markus Weis",
    email: "weis@4-wk.de",
    role: "admin",
    onofficeUsername: "Weis, Markus (mw)",
    color: "#3b82f6",
    initials: "MW",
  },
  {
    id: "u-sarah",
    fullName: "Sarah Bauer",
    email: "bauer@4-wk.de",
    role: "mitarbeiter",
    onofficeUsername: "Bauer, Sarah (sb)",
    color: "#a855f7",
    initials: "SB",
  },
  {
    id: "u-jonas",
    fullName: "Jonas Krämer",
    email: "kraemer@4-wk.de",
    role: "mitarbeiter",
    onofficeUsername: "Krämer, Jonas (jk)",
    color: "#f59e0b",
    initials: "JK",
  },
  {
    id: "u-lena",
    fullName: "Lena Fischer",
    email: "fischer@4-wk.de",
    role: "mitarbeiter",
    onofficeUsername: "Fischer, Lena (lf)",
    color: "#ec4899",
    initials: "LF",
  },
];

export const BROKERS: BrokerContact[] = [
  { id: "b-eike", displayName: "Lensinger, Eike (EL)", shortCode: "EL", email: "lensinger@4-wk.de" },
  { id: "b-markus", displayName: "Weis, Markus (mw)", shortCode: "mw", email: "weis@4-wk.de" },
  { id: "b-tim", displayName: "Hoffmann, Tim (th)", shortCode: "th", email: "hoffmann@4-wk.de" },
  { id: "b-anna", displayName: "Schuster, Anna (as)", shortCode: "as", email: "schuster@4-wk.de" },
];

export const CATEGORIES: Category[] = [
  { id: "c-aufb", name: "Aufbereitung", color: "#eab308", sortOrder: 10, isActive: true },
  { id: "c-buch", name: "Buchhaltung", color: "#3b82f6", sortOrder: 20, isActive: true },
  { id: "c-vert", name: "Vertrieb", color: "#88cc44", sortOrder: 30, isActive: true },
  { id: "c-qm", name: "Qualitätsmanagement", color: "#a855f7", sortOrder: 40, isActive: true },
  { id: "c-allg", name: "Allgemein", color: "#94a3b8", sortOrder: 90, isActive: true },
];

export const SETTINGS: AppSettings = {
  reminderDays: 3,
  escalationDays: 7,
  mailProvider: "onoffice",
  onofficeEmailIdentity: "info@4-wk.de",
  smtpFrom: "aufgaben@4-wk.de",
  doneHideAfterHours: 24,
  attachmentMaxMb: 25,
  attachmentPushOnoffice: true,
  attachmentDefaultArt: "Dokument",
};

/** Dateitypen, die onOffice auch über die Oberfläche annimmt. */
export const ALLOWED_EXTENSIONS = [
  "pdf", "jpg", "jpeg", "png", "gif", "webp", "tif", "tiff",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "txt", "csv", "rtf", "odt", "ods",
  "eml", "msg", "zip",
];

let attSeq = 0;

function att(partial: Partial<Attachment> & Pick<Attachment, "fileName" | "sizeBytes">): Attachment {
  const ext = partial.fileName.split(".").pop()?.toLowerCase() ?? "";
  const mimes: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    png: "image/png",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    msg: "application/vnd.ms-outlook",
  };
  return {
    id: `a-${(++attSeq).toString().padStart(3, "0")}`,
    mimeType: mimes[ext] ?? "application/octet-stream",
    origin: "lokal",
    uploadedBy: null,
    syncState: "lokal",
    createdAt: isoTime(-1, 9),
    hasContent: false,
    ...partial,
  };
}

export const TEMPLATES: EmailTemplate[] = [
  {
    key: "aufgabe_erledigt_makler",
    label: "Aufgabe erledigt (an Maklerkollegen)",
    subject: "Aufgabe erledigt: {{titel}}",
    body: `Hallo {{empfaenger}},

die Aufgabe „{{titel}}“ ist erledigt.

Objekt/Kunde: {{objekt}}
Erledigt von: {{bearbeiter}} am {{datum}}

Viele Grüße
4wändekanzlei Aufgabentool`,
    isActive: true,
  },
  {
    key: "in_bearbeitung_notiz",
    label: "Rückmeldung bei „In Bearbeitung“",
    subject: "Rückfrage zur Aufgabe: {{titel}}",
    body: `Hallo {{empfaenger}},

{{bearbeiter}} hat die Aufgabe „{{titel}}“ auf „In Bearbeitung“ gesetzt und folgende Notiz hinterlegt:

{{notiz}}

Bitte klärt kurz, wie es weitergeht.

Viele Grüße
4wändekanzlei Aufgabentool`,
    isActive: true,
  },
  {
    key: "erinnerung_3t",
    label: "Erinnerung nach 3 Tagen",
    subject: "Erinnerung: {{titel}}",
    body: `Hallo {{empfaenger}},

hier hast du noch ein To-do: „{{titel}}“.
Kläre gegebenenfalls Unstimmigkeiten oder Unklarheiten mit deinem Vorgesetzten oder dem beauftragten Vertriebler.

Viele Grüße
4wändekanzlei Aufgabentool`,
    isActive: true,
  },
  {
    key: "eskalation_7t",
    label: "Eskalation nach 7 Tagen",
    subject: "Weiterhin offen: {{titel}}",
    body: `Hallo {{empfaenger}},

die Aufgabe „{{titel}}“ ist seit {{tage}} Tagen offen und wurde weder erledigt noch auf „In Bearbeitung“ gesetzt.

Bearbeiter: {{bearbeiter}}
Erstellt von: {{ersteller}}

Viele Grüße
4wändekanzlei Aufgabentool`,
    isActive: true,
  },
];

let seq = 0;
const nid = (p: string) => `${p}-${(++seq).toString().padStart(3, "0")}`;

export function buildTasks(): Task[] {
  const t = (partial: Partial<Task> & Pick<Task, "title" | "creatorId">): Task => ({
    id: nid("t"),
    description: "",
    status: "offen",
    priority: "normal",
    categoryId: "c-allg",
    assigneeId: null,
    brokerContactId: null,
    isPool: false,
    isPrivate: false,
    visibleFrom: isoDate(0),
    dueDate: null,
    source: "manuell",
    createdAt: isoTime(0, 8),
    completedAt: null,
    history: [],
    attachments: [],
    reminder3dSentAt: null,
    escalation7dSentAt: null,
    ...partial,
  });

  return [
    // ---- Pool ----
    t({
      title: "Exposé Musterstraße 12 aufbereiten",
      description: "Fotos einpflegen, Grundriss prüfen, Text korrekturlesen.",
      creatorId: "u-eike",
      categoryId: "c-aufb",
      priority: "hoch",
      isPool: true,
      brokerContactId: "b-tim",
      onofficeEstateNo: "OBJ-2419",
      createdAt: isoTime(-1, 8),
      attachments: [
        att({
          fileName: "Grundriss_Musterstrasse_12.pdf",
          sizeBytes: 1_842_000,
          syncState: "synchron",
          onofficeFileId: "of-88412",
          createdAt: isoTime(-1, 9),
        }),
        att({
          fileName: "Eigentuemer_Fotos.zip",
          sizeBytes: 14_300_000,
          origin: "onoffice",
          syncState: "nur_onoffice",
          onofficeFileId: "of-88417",
          createdAt: isoTime(-1, 10),
        }),
      ],
    }),
    t({
      title: "Energieausweis Bergweg 4 nachfordern",
      creatorId: "u-markus",
      categoryId: "c-aufb",
      isPool: true,
      brokerContactId: "b-anna",
      onofficeEstateNo: "OBJ-2402",
      createdAt: isoTime(-2, 9),
    }),
    t({
      title: "Rechnungseingänge August kontieren",
      creatorId: "u-eike",
      categoryId: "c-buch",
      isPool: true,
      dueDate: isoDate(4),
      createdAt: isoTime(-1, 10),
    }),

    // ---- Sarah ----
    t({
      title: "Notartermin Seestraße 8 koordinieren",
      description: "Termin mit Käufer und Notariat abstimmen, Bestätigung an alle.",
      creatorId: "u-eike",
      assigneeId: "u-sarah",
      categoryId: "c-vert",
      priority: "hoch",
      brokerContactId: "b-eike",
      onofficeEstateNo: "OBJ-2377",
      dueDate: isoDate(1),
      createdAt: isoTime(-8, 8),
      reminder3dSentAt: isoTime(-5, 7),
      escalation7dSentAt: isoTime(-1, 7),
      attachments: [
        att({
          fileName: "Kaufvertragsentwurf_Seestrasse_8.pdf",
          sizeBytes: 486_000,
          syncState: "synchron",
          onofficeFileId: "of-87220",
          uploadedBy: "u-eike",
          createdAt: isoTime(-8, 9),
        }),
      ],
    }),
    t({
      title: "Vorvertrag Ahornallee prüfen",
      creatorId: "u-markus",
      assigneeId: "u-sarah",
      categoryId: "c-qm",
      status: "in_bearbeitung",
      inProgressNote:
        "Im Vertrag fehlt die Regelung zur Übergabe. Warte auf Rückmeldung vom Notariat, voraussichtlich morgen.",
      brokerContactId: "b-markus",
      createdAt: isoTime(-4, 9),
      attachments: [
        att({
          fileName: "Vorvertrag_Ahornallee_Entwurf.docx",
          sizeBytes: 92_400,
          syncState: "wartet",
          uploadedBy: "u-sarah",
          createdAt: isoTime(-1, 11),
        }),
      ],
      history: [
        {
          at: isoTime(-1, 11),
          from: "offen",
          to: "in_bearbeitung",
          by: "u-sarah",
          note: "Im Vertrag fehlt die Regelung zur Übergabe. Warte auf Rückmeldung vom Notariat, voraussichtlich morgen.",
        },
      ],
    }),
    t({
      title: "Kundendaten Familie Berger vervollständigen",
      creatorId: "u-sarah",
      assigneeId: "u-sarah",
      categoryId: "c-allg",
      onofficeAddressId: "ADR-11482",
      createdAt: isoTime(-4, 14),
    }),
    t({
      title: "Berichtsheft schreiben",
      creatorId: "u-sarah",
      assigneeId: "u-sarah",
      categoryId: "c-allg",
      isPrivate: true,
      dueDate: isoDate(2),
      createdAt: isoTime(-1, 16),
    }),
    t({
      title: "Fotos Lindenhof sortieren",
      creatorId: "u-eike",
      assigneeId: "u-sarah",
      categoryId: "c-aufb",
      status: "erledigt",
      completedAt: isoTime(0, 8),
      brokerContactId: "b-tim",
      createdAt: isoTime(-3, 9),
      history: [{ at: isoTime(0, 8), from: "offen", to: "erledigt", by: "u-sarah" }],
    }),

    // ---- Jonas ----
    t({
      title: "Mahnlauf offene Provisionen erstellen",
      creatorId: "u-eike",
      assigneeId: "u-jonas",
      categoryId: "c-buch",
      priority: "hoch",
      createdAt: isoTime(-5, 8),
      reminder3dSentAt: isoTime(-2, 7),
    }),
    t({
      title: "Grundbuchauszug Talstraße 7 anfordern",
      creatorId: "u-markus",
      assigneeId: "u-jonas",
      categoryId: "c-aufb",
      brokerContactId: "b-anna",
      onofficeEstateNo: "OBJ-2431",
      source: "email",
      createdAt: isoTime(-1, 11),
      attachments: [
        att({
          fileName: "Anfrage_Hausverwaltung.msg",
          sizeBytes: 38_900,
          syncState: "lokal",
          uploadedBy: "u-markus",
          createdAt: isoTime(-1, 11),
        }),
      ],
    }),
    t({
      title: "Quartalsauswertung Vertrieb vorbereiten",
      creatorId: "u-eike",
      assigneeId: "u-jonas",
      categoryId: "c-vert",
      visibleFrom: isoDate(3),
      dueDate: isoDate(6),
      createdAt: isoTime(0, 7),
    }),

    // ---- Lena ----
    t({
      title: "Besichtigungsprotokoll Uferweg 3 nachbereiten",
      creatorId: "u-markus",
      assigneeId: "u-lena",
      categoryId: "c-vert",
      brokerContactId: "b-markus",
      onofficeEstateNo: "OBJ-2388",
      createdAt: isoTime(-2, 10),
    }),
    t({
      title: "QM-Checkliste Objektaufnahme aktualisieren",
      creatorId: "u-eike",
      assigneeId: "u-lena",
      categoryId: "c-qm",
      source: "qm",
      status: "in_bearbeitung",
      inProgressNote: "Punkt 4 der Checkliste widerspricht der neuen Maklerverordnung – kurz abstimmen?",
      createdAt: isoTime(-6, 9),
      history: [
        {
          at: isoTime(-2, 15),
          from: "offen",
          to: "in_bearbeitung",
          by: "u-lena",
          note: "Punkt 4 der Checkliste widerspricht der neuen Maklerverordnung – kurz abstimmen?",
        },
      ],
    }),
    t({
      title: "Nachfassen Interessent Meyer",
      creatorId: "u-lena",
      assigneeId: "u-lena",
      categoryId: "c-vert",
      onofficeAddressId: "ADR-10937",
      status: "erledigt",
      completedAt: isoTime(-1, 17),
      createdAt: isoTime(-3, 8),
      history: [{ at: isoTime(-1, 17), from: "offen", to: "erledigt", by: "u-lena" }],
    }),
  ];
}

export function buildNotifications(tasks: Task[]): NotificationEntry[] {
  const find = (needle: string) => tasks.find((t) => t.title.startsWith(needle));
  const out: NotificationEntry[] = [];

  const notar = find("Notartermin");
  if (notar) {
    out.push({
      id: "n-001",
      taskId: notar.id,
      taskTitle: notar.title,
      kind: "erinnerung_3t",
      recipient: "bauer@4-wk.de",
      recipientName: "Sarah Bauer",
      subject: "Erinnerung: Notartermin Seestraße 8 koordinieren",
      body: `Hallo Sarah Bauer,

hier hast du noch ein To-do: „Notartermin Seestraße 8 koordinieren“.
Kläre gegebenenfalls Unstimmigkeiten oder Unklarheiten mit deinem Vorgesetzten oder dem beauftragten Vertriebler.`,
      provider: "onoffice",
      status: "sent",
      dedupeKey: `task:${notar.id}:erinnerung_3t`,
      createdAt: isoTime(-5, 7),
    });
    out.push({
      id: "n-002",
      taskId: notar.id,
      taskTitle: notar.title,
      kind: "eskalation_7t",
      recipient: "lensinger@4-wk.de",
      recipientName: "Eike Lensinger",
      subject: "Weiterhin offen: Notartermin Seestraße 8 koordinieren",
      body: `Hallo Eike Lensinger,

die Aufgabe „Notartermin Seestraße 8 koordinieren“ ist seit 8 Tagen offen und wurde weder erledigt noch auf „In Bearbeitung“ gesetzt.`,
      provider: "onoffice",
      status: "sent",
      dedupeKey: `task:${notar.id}:eskalation_7t`,
      createdAt: isoTime(-1, 7),
    });
  }

  const vorvertrag = find("Vorvertrag");
  if (vorvertrag) {
    out.push({
      id: "n-003",
      taskId: vorvertrag.id,
      taskTitle: vorvertrag.title,
      kind: "in_bearbeitung_notiz",
      recipient: "weis@4-wk.de",
      recipientName: "Markus Weis",
      subject: "Rückfrage zur Aufgabe: Vorvertrag Ahornallee prüfen",
      body: `Sarah Bauer hat die Aufgabe auf „In Bearbeitung“ gesetzt:

Im Vertrag fehlt die Regelung zur Übergabe. Warte auf Rückmeldung vom Notariat, voraussichtlich morgen.`,
      provider: "onoffice",
      status: "sent",
      dedupeKey: `task:${vorvertrag.id}:in_bearbeitung_notiz:1`,
      createdAt: isoTime(-1, 11),
    });
  }

  const fotos = find("Fotos Lindenhof");
  if (fotos) {
    out.push({
      id: "n-004",
      taskId: fotos.id,
      taskTitle: fotos.title,
      kind: "aufgabe_erledigt_makler",
      recipient: "hoffmann@4-wk.de",
      recipientName: "Hoffmann, Tim (th)",
      subject: "Aufgabe erledigt: Fotos Lindenhof sortieren",
      body: "Die Aufgabe „Fotos Lindenhof sortieren“ ist erledigt.",
      provider: "onoffice",
      status: "sent",
      dedupeKey: `task:${fotos.id}:aufgabe_erledigt_makler`,
      createdAt: isoTime(0, 8),
    });
  }

  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
