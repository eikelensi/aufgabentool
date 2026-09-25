/**
 * Der Bauplan der Verwaltung: welche Seiten es gibt und wozu sie
 * gehoeren.
 *
 * Bewusst reine Daten in einer eigenen Datei - die Navigation braucht
 * sie im Browser, die Uebersichtsseite auf dem Server. Zwei Listen, die
 * auseinanderlaufen, waeren genau die Unordnung, die hier beseitigt
 * werden sollte.
 */

export interface Seite {
  href: string;
  label: string;
  /** Kurz, was hier passiert - erscheint als Tooltip und auf der Uebersicht. */
  zweck: string;
  /** Nur diese Adresse gilt als aktiv, nicht ihre Unterseiten. */
  exakt?: boolean;
}

export interface Gruppe {
  schluessel: string;
  label: string;
  seiten: Seite[];
}

export const GRUPPEN: Gruppe[] = [
  {
    schluessel: "menschen",
    label: "Menschen",
    seiten: [
      {
        href: "/admin/nutzer",
        label: "Zugänge",
        zweck: "Wer sich anmelden darf: einladen, Rolle vergeben, sperren, Passwort zurücksetzen.",
      },
      {
        href: "/admin/kollegen",
        label: "Mitarbeiter",
        zweck: "Die Kollegen, denen Aufgaben zugeordnet werden – mit Telefon, Durchwahl und onOffice-Tag. Ohne eigenen Zugang.",
      },
      {
        href: "/admin/rollen",
        label: "Rollen und Rechte",
        zweck: "Welche Rolle welchen Bereich der Anwendung sieht.",
      },
    ],
  },
  {
    schluessel: "aufgaben",
    label: "Aufgaben",
    seiten: [
      {
        href: "/admin/kategorien",
        label: "Kategorien",
        zweck: "Die Kategorien und ihre Farben. Bleiben im Haus, gehen nicht nach onOffice.",
      },
      {
        href: "/admin/fristen",
        label: "Fristen und Pool",
        zweck: "Nach wie vielen Tagen erinnert und eskaliert wird, wann Erledigtes verschwindet, ab wann eine Pool-Aufgabe auffällt.",
      },
      {
        href: "/admin/dateien",
        label: "Dateien",
        zweck: "Obergrenze je Datei und ob neue Anhänge zusätzlich nach onOffice gehen.",
      },
    ],
  },
  {
    schluessel: "onoffice",
    label: "onOffice",
    seiten: [
      {
        href: "/admin/onoffice",
        label: "Anbindung",
        exakt: true,
        zweck: "Was die Schnittstelle dieses Mandanten wirklich kann, was zurückgeschrieben wird – und die Adressen, die kein Kunde sind.",
      },
      {
        href: "/admin/onoffice/eingang",
        label: "Aufgaben-Eingang",
        zweck: "Die echten Aufgaben aus dem CRM, ungefiltert und nur lesend. Zum Gegenprüfen.",
      },
    ],
  },
  {
    schluessel: "mitteilungen",
    label: "Mitteilungen",
    seiten: [
      {
        href: "/admin/mail",
        label: "Versand",
        exakt: true,
        zweck: "Über welchen Weg Mails rausgehen, von wem, und wer die Pool-Meldung bekommt.",
      },
      {
        href: "/admin/mail/vorlagen",
        label: "Vorlagen",
        zweck: "Betreff und Text jeder Mail, die das Tool verschickt.",
      },
    ],
  },
  {
    schluessel: "system",
    label: "System",
    seiten: [
      {
        href: "/admin/darstellung",
        label: "Darstellung",
        zweck: "Die Farben des dunklen Modus – gelten für alle, mit Prüfung auf Lesbarkeit.",
      },
      {
        href: "/admin/protokoll",
        label: "Protokolle",
        zweck: "Wer was geändert hat, und jede verschickte Mail. Wird still mitgeschrieben.",
      },
      {
        href: "/admin/handbuch",
        label: "Handbuch",
        zweck: "Die Anleitung – erzeugt aus den Einstellungen, die gerade wirklich gelten.",
      },
    ],
  },
];

/** Zu welcher Gruppe gehoert diese Adresse? */
export function gruppeVon(pfad: string): Gruppe | null {
  let treffer: { gruppe: Gruppe; laenge: number } | null = null;
  for (const g of GRUPPEN) {
    for (const s of g.seiten) {
      if (pfad === s.href || pfad.startsWith(`${s.href}/`)) {
        if (!treffer || s.href.length > treffer.laenge) {
          treffer = { gruppe: g, laenge: s.href.length };
        }
      }
    }
  }
  return treffer?.gruppe ?? null;
}

