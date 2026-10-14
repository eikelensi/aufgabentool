/**
 * Wer darf was - an einer Stelle.
 *
 * Vorher stand jede Grenze dort, wo sie geprueft wurde: eine Liste von
 * Rollen in der Route, dieselbe Liste noch einmal im Store, eine
 * dritte in der Oberflaeche. Wer wissen wollte, was eine Rolle darf,
 * musste den Code durchsuchen - und das Handbuch behauptete es
 * daneben in eigenen Worten.
 *
 * Jetzt steht es hier: die Listen sind die Wahrheit, der Code fragt
 * sie, und das Handbuch zeigt genau dieselbe Tabelle. Eine Aenderung
 * hier aendert beides.
 *
 * NICHT hier: welchen Menuepunkt eine Rolle sieht. Das ist
 * einstellbar und steht in der Tabelle rollen_bereiche
 * (Verwaltung -> Rollen). Hier stehen die Grenzen, die fest sind.
 */
import { darfInDenPoolGeben, ROLLE_LABEL, type AppRole } from "./types";

export const ALLE_ROLLEN = Object.keys(ROLLE_LABEL) as AppRole[];

/**
 * Darf jede Aufgabe sehen und aendern, auch fremde.
 *
 * Dieselbe Grenze zieht die Datenbank mit public.darf_alles(); hier
 * steht sie, damit eine Route mit Grund ablehnen kann, statt auf eine
 * leere Antwort der Zeilensicherheit zu warten.
 */
export const DARF_ALLES: AppRole[] = ["superadmin", "gf", "qm"];

/** Darf die Verwaltung oeffnen - entspricht public.is_admin(). */
export const DARF_VERWALTEN: AppRole[] = ["superadmin", "gf"];

/** Fuehrt den Asana-Bereich: anlegen, zuteilen, verschieben. */
export const DARF_ASANA_FUEHREN: AppRole[] = ["superadmin", "gf"];

function hat(liste: AppRole[], rolle: AppRole): boolean {
  return liste.includes(rolle);
}

export const darfAllesRolle = (r: AppRole) => hat(DARF_ALLES, r);
export const darfVerwalten = (r: AppRole) => hat(DARF_VERWALTEN, r);
export const darfAsanaFuehren = (r: AppRole) => hat(DARF_ASANA_FUEHREN, r);
/** Die Dosierung ist Sache derer, die verteilen. */
export const darfTrichtern = (r: AppRole) => darfAllesRolle(r);
/** Objekt oder Kundendatensatz an eine Aufgabe haengen. */
export const darfVerknuepfen = (r: AppRole) => darfAllesRolle(r);
/** Zettel an die Pinnwand haengen, aendern, abnehmen. */
export const darfPinnen = (r: AppRole) => darfAllesRolle(r);
/**
 * Die persoenlichen Asana-Aufgaben gehoeren genau einem Menschen -
 * dem, dessen Zugriffstoken hinterlegt ist. Darum nur der Superadmin.
 */
export const darfEigeneAsanaSpalten = (r: AppRole) => r === "superadmin";

/** Ein Recht, wie es im Handbuch steht. */
export interface Recht {
  /** Was man tun darf, in der Sprache des Hauses. */
  label: string;
  /** Die Rollen, die es duerfen. */
  wer: AppRole[];
  /** Die Ausnahme oder der Grund - eine Zeile, wenn noetig. */
  hinweis?: string;
}

/**
 * Das Verzeichnis, aus dem das Handbuch seine Tabelle baut.
 *
 * Die Reihenfolge ist die des Arbeitstags: erst die eigene Aufgabe,
 * dann das Verteilen, dann die Bretter, zuletzt die Verwaltung.
 */
export const RECHTE: Recht[] = [
  {
    label: "Eigene Aufgaben bearbeiten, Notiz schreiben, Datei anhängen",
    wer: ALLE_ROLLEN,
    hinweis:
      "Dazu gehören die Aufgaben, die man selbst angelegt hat, und alles, was unbesetzt im Pool liegt.",
  },
  {
    label: "Aufgabe aus dem Pool übernehmen",
    wer: ALLE_ROLLEN,
    hinweis: "Wer den Pool sieht, darf sich daraus etwas ziehen.",
  },
  {
    label: "Eigene Mail-Einstellungen ändern",
    wer: ALLE_ROLLEN,
    hinweis:
      "Unter „Meine Mails“, und nur soweit die Verwaltung die jeweilige Mail zur Selbstbedienung freigegeben hat.",
  },
  {
    label: "Jede Aufgabe sehen und ändern, auch fremde",
    wer: DARF_ALLES,
    hinweis:
      "Nicht aber private Aufgaben: die sieht ausschließlich, wer sie angelegt hat – auch ein Superadmin nicht.",
  },
  {
    label: "Aufgabe jemandem direkt zuweisen",
    wer: DARF_ALLES,
  },
  {
    label: "Neue Aufgabe in den Pool geben",
    wer: ALLE_ROLLEN.filter(darfInDenPoolGeben),
    hinweis:
      "Der KBI gibt in den Pool, entscheidet aber nicht, wer sie bekommt – die Kollegen ziehen sie dort, oder die Leitung verteilt.",
  },
  {
    label: "Aufgabe nach Asana übergeben",
    wer: DARF_ALLES,
  },
  {
    label: "Trichter je Mitarbeiter ein- und ausschalten",
    wer: ALLE_ROLLEN.filter(darfTrichtern),
    hinweis: "Wer das Dashboard nur liest, sieht die Kacheln, aber keine Schalter.",
  },
  {
    label: "Objekt oder Kunde mit einer Aufgabe verknüpfen",
    wer: ALLE_ROLLEN.filter(darfVerknuepfen),
  },
  {
    label: "Pinnwand: Zettel anlegen, ändern, abnehmen",
    wer: ALLE_ROLLEN.filter(darfPinnen),
  },
  {
    label: "Asana: Aufgabe anlegen, zuteilen, in eine andere Spalte ziehen",
    wer: DARF_ASANA_FUEHREN,
  },
  {
    label: "Asana: die persönlichen Aufgaben-Spalten („Eigene Aufgaben“)",
    wer: ALLE_ROLLEN.filter(darfEigeneAsanaSpalten),
    hinweis:
      "Sie gehören dem Menschen, dessen Zugriffstoken hinterlegt ist – deshalb sieht den Umschalter nur der Superadmin.",
  },
  {
    label: "Aufgabe löschen",
    wer: DARF_VERWALTEN,
    hinweis: "Dazu jeder für die Aufgaben, die er selbst angelegt hat.",
  },
  {
    label: "Verwaltung öffnen",
    wer: DARF_VERWALTEN,
    hinweis:
      "Alles darin: Kategorien, Fristen, Vorlagen, Versandregeln, Protokolle, Darstellung, Anbindung an onOffice.",
  },
  {
    label: "Zugänge einladen, Rolle vergeben, sperren, Passwort zurücksetzen",
    wer: DARF_VERWALTEN,
  },
  {
    label: "Sichtbarkeit der Bereiche je Rolle umstellen",
    wer: DARF_VERWALTEN,
    hinweis: "Verwaltung → Rollen. Der Superadmin sieht alles, unabhängig davon.",
  },
  {
    label: "Superadmin-Zugänge anlegen oder ändern",
    wer: ["superadmin"],
    hinweis: "Auch die Geschäftsführung kann hier niemanden erheben – und keinen Superadmin sperren.",
  },
];
