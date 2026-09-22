/**
 * Farben des dunklen Modus.
 *
 * Zwei Gruppen: die Grundfarben, die die Flaechen und die Schrift
 * bestimmen, und die Zustandsfarben fuer Erfolg, Warnung, Fehler und so
 * weiter. Letztere steckten frueher an rund fuenfzig Stellen fest im
 * Code - helle Pastelltoene, die im dunklen Modus wie Textmarker auf
 * schwarzem Papier wirkten.
 *
 * Die Voreinstellung steht hier im Code und nicht in der Datenbank: so
 * wirkt eine spaetere Verbesserung sofort fuer alle, die nichts eigenes
 * eingestellt haben. In der Datenbank liegt nur, was jemand bewusst
 * geaendert hat.
 */

export interface Dunkelfarben {
  bg: string;
  panel: string;
  panel2: string;
  line: string;
  text: string;
  muted: string;
  ci400: string;
  ci500: string;
  aufAkzent: string;
  okBg: string;
  okFg: string;
  warnBg: string;
  warnFg: string;
  errBg: string;
  errFg: string;
  infoBg: string;
  infoFg: string;
  neutralBg: string;
  neutralFg: string;
  privatBg: string;
  privatFg: string;
}

export const DUNKEL_VOREINSTELLUNG: Dunkelfarben = {
  bg: "#10160e",
  panel: "#182115",
  panel2: "#1d281a",
  line: "#2c3a27",
  text: "#e7efe2",
  muted: "#93a48c",
  ci400: "#88cc44",
  ci500: "#6cb02c",
  aufAkzent: "#10200a",
  okBg: "#16301f",
  okFg: "#86e0a6",
  warnBg: "#3a2c12",
  warnFg: "#f2bd6a",
  errBg: "#3a1c1c",
  errFg: "#f5a19b",
  infoBg: "#122a3a",
  infoFg: "#85c9ef",
  neutralBg: "#232f20",
  neutralFg: "#9fb098",
  privatBg: "#251d3d",
  privatFg: "#c4b5fd",
};

export interface FarbFeld {
  schluessel: keyof Dunkelfarben;
  label: string;
  erklaerung: string;
  /** Wogegen die Lesbarkeit geprueft wird. */
  gegen?: keyof Dunkelfarben;
}

export const GRUPPEN: { titel: string; text: string; felder: FarbFeld[] }[] = [
  {
    titel: "Grundfarben",
    text: "Flächen, Linien und Schrift – sie bestimmen den Gesamteindruck.",
    felder: [
      { schluessel: "bg", label: "Seitenhintergrund", erklaerung: "Die Fläche hinter allem." },
      { schluessel: "panel", label: "Karten und Flächen", erklaerung: "Aufgabenkarten, Kopfzeile, Dialoge." },
      { schluessel: "panel2", label: "Vertiefte Flächen", erklaerung: "Eingabefelder, Spalten, Knöpfe." },
      { schluessel: "line", label: "Linien und Ränder", erklaerung: "Trennlinien und Umrandungen." },
      { schluessel: "text", label: "Schrift", erklaerung: "Der normale Text.", gegen: "panel" },
      { schluessel: "muted", label: "Nebensächliche Schrift", erklaerung: "Hinweise, Daten, Zusätze.", gegen: "panel" },
      { schluessel: "ci400", label: "Akzent hell", erklaerung: "Aktiver Menüpunkt, Hauptknopf." },
      { schluessel: "ci500", label: "Akzent dunkel", erklaerung: "Links und Betonungen.", gegen: "panel" },
      { schluessel: "aufAkzent", label: "Schrift auf dem Akzent", erklaerung: "Steht auf der grünen Fläche.", gegen: "ci400" },
    ],
  },
  {
    titel: "Zustandsfarben",
    text: "Erledigt, Warnung, Fehler und die Kennzeichen an den Karten. Jeweils Fläche und Schrift.",
    felder: [
      { schluessel: "okBg", label: "Erledigt – Fläche", erklaerung: "Grüne Meldungen und Haken." },
      { schluessel: "okFg", label: "Erledigt – Schrift", erklaerung: "", gegen: "okBg" },
      { schluessel: "warnBg", label: "Warnung – Fläche", erklaerung: "Fehlende Angaben, offene Punkte." },
      { schluessel: "warnFg", label: "Warnung – Schrift", erklaerung: "", gegen: "warnBg" },
      { schluessel: "errBg", label: "Fehler – Fläche", erklaerung: "Abgelehnt, gesperrt, hohe Priorität." },
      { schluessel: "errFg", label: "Fehler – Schrift", erklaerung: "", gegen: "errBg" },
      { schluessel: "infoBg", label: "Hinweis – Fläche", erklaerung: "„nur in onOffice“ und Ähnliches." },
      { schluessel: "infoFg", label: "Hinweis – Schrift", erklaerung: "", gegen: "infoBg" },
      { schluessel: "neutralBg", label: "Neutral – Fläche", erklaerung: "Offen, unbestimmt, Rohwerte." },
      { schluessel: "neutralFg", label: "Neutral – Schrift", erklaerung: "", gegen: "neutralBg" },
      { schluessel: "privatBg", label: "Privat – Fläche", erklaerung: "Das Schloss an privaten Aufgaben." },
      { schluessel: "privatFg", label: "Privat – Schrift", erklaerung: "", gegen: "privatBg" },
    ],
  },
];

export const FARB_FELDER: FarbFeld[] = GRUPPEN.flatMap((g) => g.felder);

/** CSS-Variable je Schluessel - die einzige Stelle, die beides verbindet. */
export const VARIABLE: Record<keyof Dunkelfarben, string> = {
  bg: "--bg",
  panel: "--panel",
  panel2: "--panel-2",
  line: "--line",
  text: "--text",
  muted: "--muted",
  ci400: "--color-ci-400",
  ci500: "--color-ci-500",
  aufAkzent: "--auf-akzent",
  okBg: "--ok-bg",
  okFg: "--ok-fg",
  warnBg: "--warn-bg",
  warnFg: "--warn-fg",
  errBg: "--err-bg",
  errFg: "--err-fg",
  infoBg: "--info-bg",
  infoFg: "--info-fg",
  neutralBg: "--neutral-bg",
  neutralFg: "--neutral-fg",
  privatBg: "--privat-bg",
  privatFg: "--privat-fg",
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Nimmt entgegen, was aus der Datenbank oder einem Formular kommt, und
 * gibt garantiert gueltige Hexfarben zurueck. Alles Unbekannte faellt auf
 * die Voreinstellung zurueck.
 *
 * Das ist keine Hoeflichkeit: diese Werte landen in einem style-Block.
 * Die Datenbank prueft sie ebenfalls - zwei Schloesser an derselben Tuer,
 * weil ein einziges irgendwann offen steht.
 */
export function sichereFarben(roh: unknown): Dunkelfarben {
  const ergebnis = { ...DUNKEL_VOREINSTELLUNG };
  if (!roh || typeof roh !== "object") return ergebnis;

  for (const { schluessel } of FARB_FELDER) {
    const wert = (roh as Record<string, unknown>)[schluessel];
    if (typeof wert === "string" && HEX.test(wert)) {
      ergebnis[schluessel] = wert.toLowerCase();
    }
  }
  return ergebnis;
}

export function istHexfarbe(wert: string): boolean {
  return HEX.test(wert);
}

export function istVoreinstellung(farben: Dunkelfarben): boolean {
  return FARB_FELDER.every(
    ({ schluessel }) => farben[schluessel] === DUNKEL_VOREINSTELLUNG[schluessel],
  );
}

/** Der style-Block, der die Voreinstellung ueberschreibt. */
export function dunkelCss(farben: Dunkelfarben): string {
  const f = sichereFarben(farben);
  const zeilen = FARB_FELDER.map(({ schluessel }) => `${VARIABLE[schluessel]}:${f[schluessel]}`);
  return `:root[data-theme="dark"]{${zeilen.join(";")}}`;
}

/** Helligkeit nach Wahrnehmung. */
export function helligkeit(hex: string): number {
  if (!HEX.test(hex)) return 0;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Kontrastverhaeltnis zweier Farben, 1 bis 21. */
export function kontrast(a: string, b: string): number {
  const hell = Math.max(helligkeit(a), helligkeit(b));
  const dunkel = Math.min(helligkeit(a), helligkeit(b));
  return (hell + 0.05) / (dunkel + 0.05);
}

/** Fertige Paletten zum Ausprobieren. */
export const VORLAGEN: { name: string; text: string; farben: Dunkelfarben }[] = [
  {
    name: "Grün (Auslieferung)",
    text: "Dunkles Grün, passend zur Hausfarbe.",
    farben: DUNKEL_VOREINSTELLUNG,
  },
  {
    name: "Neutral",
    text: "Grauer Untergrund, die Hausfarbe bleibt der einzige Akzent.",
    farben: {
      ...DUNKEL_VOREINSTELLUNG,
      bg: "#121212",
      panel: "#1b1b1b",
      panel2: "#222222",
      line: "#333333",
      text: "#e9e9e9",
      muted: "#9a9a9a",
      neutralBg: "#262626",
      neutralFg: "#a5a5a5",
    },
  },
  {
    name: "Kontraststark",
    text: "Tiefes Schwarz und hellere Schrift – für helle Räume und müde Augen.",
    farben: {
      ...DUNKEL_VOREINSTELLUNG,
      bg: "#000000",
      panel: "#111511",
      panel2: "#1a201a",
      line: "#3d4a38",
      text: "#ffffff",
      muted: "#c3cfbd",
      okFg: "#a7f3c4",
      warnFg: "#ffd28a",
      errFg: "#ffb3ad",
      infoFg: "#a6dbff",
      neutralFg: "#c3cfbd",
    },
  },
];
