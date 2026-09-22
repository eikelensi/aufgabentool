/**
 * Die Farben beider Modi.
 *
 * Jeder Modus hat dieselben einundzwanzig Schluessel - einmal fuer Hell,
 * einmal fuer Dunkel. Zwei Gruppen: die Grundfarben, die Flaechen und
 * Schrift bestimmen, und die Zustandsfarben fuer Erfolg, Warnung, Fehler
 * und die Kennzeichen an den Karten. Letztere steckten frueher an rund
 * fuenfzig Stellen fest im Code.
 *
 * Die Voreinstellung steht hier und nicht in der Datenbank: so wirkt eine
 * spaetere Verbesserung sofort fuer alle, die nichts eigenes eingestellt
 * haben. In der Datenbank liegt nur, was jemand bewusst geaendert hat.
 *
 * Alle Paarungen, die aufeinander gelesen werden, halten 4,5:1 ein - die
 * Schwelle, ab der normal grosse Schrift auch bei schlechtem Licht und
 * mueden Augen noch sicher lesbar ist. Nachgerechnet wird das unten von
 * kontrast(); die Einstellseite zeigt die Werte an.
 */

export type Modus = "hell" | "dunkel";

export const MODUS_LABEL: Record<Modus, string> = {
  hell: "Heller Modus",
  dunkel: "Dunkler Modus",
};

export interface Palette {
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

/**
 * Hell: ein warmes Papierweiss statt Reinweiss. Reinweiss auf einem
 * hellen Bildschirm blendet ueber Stunden; die leichte Saettigung nimmt
 * die Schaerfe heraus, ohne dass es beige wirkt.
 */
export const HELL_VOREINSTELLUNG: Palette = {
  bg: "#faf9f6",
  panel: "#ffffff",
  panel2: "#f4f2ec",
  line: "#e6e2d9",
  text: "#1c1b17",
  muted: "#716c63",
  ci400: "#88cc44",
  ci500: "#4d7c1b",
  aufAkzent: "#16240c",
  okBg: "#e6f4e4",
  okFg: "#2f6b2a",
  warnBg: "#fbf0da",
  warnFg: "#8a5a12",
  errBg: "#fbe7e4",
  errFg: "#a3302a",
  infoBg: "#e4eefb",
  infoFg: "#1f5b9e",
  neutralBg: "#edebe4",
  neutralFg: "#5d5a52",
  privatBg: "#efe9f9",
  privatFg: "#6b4aa3",
};

/**
 * Dunkel: ein ruhiges Anthrazit, nicht Schwarz. Reines Schwarz laesst
 * jede Kante hart aussehen und die Schrift flimmern; die drei Stufen
 * bg - panel - panel2 liegen dicht genug beieinander, dass die Flaechen
 * sich abheben, ohne zu streifen.
 *
 * Der Akzent fuer Links ist hier heller als im hellen Modus. Dasselbe
 * Gruen auf beiden Untergruenden waere einmal zu blass und einmal zu
 * grell - genau darum ist die Farbe je Modus getrennt.
 */
export const DUNKEL_VOREINSTELLUNG: Palette = {
  bg: "#16161a",
  panel: "#1e1e23",
  panel2: "#26262c",
  line: "#32323a",
  text: "#eceaf0",
  muted: "#9a97a4",
  ci400: "#88cc44",
  ci500: "#9ed95f",
  aufAkzent: "#16240c",
  okBg: "#1b3324",
  okFg: "#89e2a9",
  warnBg: "#3a2e14",
  warnFg: "#f0c072",
  errBg: "#3b1f1f",
  errFg: "#f5a6a0",
  infoBg: "#17293d",
  infoFg: "#8ec8f0",
  neutralBg: "#2b2b32",
  neutralFg: "#a8a5b1",
  privatBg: "#272041",
  privatFg: "#c3b3fd",
};

export const VOREINSTELLUNG: Record<Modus, Palette> = {
  hell: HELL_VOREINSTELLUNG,
  dunkel: DUNKEL_VOREINSTELLUNG,
};

/** Welche Spalte in app_settings den jeweiligen Modus traegt. */
export const SPALTE: Record<Modus, "theme_light" | "theme_dark"> = {
  hell: "theme_light",
  dunkel: "theme_dark",
};

export interface FarbFeld {
  schluessel: keyof Palette;
  label: string;
  erklaerung: string;
  /** Wogegen die Lesbarkeit geprueft wird. */
  gegen?: keyof Palette;
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
      { schluessel: "ci500", label: "Akzent für Links", erklaerung: "Links und Betonungen auf hellen Karten.", gegen: "panel" },
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
export const VARIABLE: Record<keyof Palette, string> = {
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
 * die Voreinstellung des jeweiligen Modus zurueck.
 *
 * Das ist keine Hoeflichkeit: diese Werte landen in einem style-Block.
 * Die Datenbank prueft sie ebenfalls - zwei Schloesser an derselben Tuer,
 * weil ein einziges irgendwann offen steht.
 */
export function sicherePalette(modus: Modus, roh: unknown): Palette {
  const ergebnis = { ...VOREINSTELLUNG[modus] };
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

export function istVoreinstellung(modus: Modus, palette: Palette): boolean {
  const standard = VOREINSTELLUNG[modus];
  return FARB_FELDER.every(({ schluessel }) => palette[schluessel] === standard[schluessel]);
}

/**
 * Der Waehler, unter dem ein Modus gilt.
 *
 * Dunkel haengt schlicht am gesetzten Merkmal. Hell dagegen wird auch
 * ohne Merkmal geschrieben: beim allerersten Bild hat das Skript im
 * Kopf zwar schon gesetzt, aber wer kein JavaScript hat, saehe sonst
 * eine Seite ohne Farben.
 */
export const WAEHLER: Record<Modus, string> = {
  hell: ':root:not([data-theme="dark"])',
  dunkel: ':root[data-theme="dark"]',
};

/** Der style-Block, der die Voreinstellung eines Modus ueberschreibt. */
export function themaCss(modus: Modus, palette: Palette): string {
  const f = sicherePalette(modus, palette);
  const zeilen = FARB_FELDER.map(({ schluessel }) => `${VARIABLE[schluessel]}:${f[schluessel]}`);
  return `${WAEHLER[modus]}{${zeilen.join(";")}}`;
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

export interface Vorlage {
  name: string;
  text: string;
  palette: Palette;
}

/** Fertige Paletten zum Ausprobieren, je Modus. */
export const VORLAGEN: Record<Modus, Vorlage[]> = {
  hell: [
    {
      name: "Warm (Auslieferung)",
      text: "Papierweiß mit einem Hauch Wärme – ruhig über den ganzen Tag.",
      palette: HELL_VOREINSTELLUNG,
    },
    {
      name: "Kühl",
      text: "Klares Grau statt Papier. Sachlich, das Grün sticht stärker heraus.",
      palette: {
        ...HELL_VOREINSTELLUNG,
        bg: "#f7f8fa",
        panel: "#ffffff",
        panel2: "#f1f3f6",
        line: "#e1e5ea",
        text: "#151a20",
        muted: "#69707a",
        neutralBg: "#e9edf2",
        neutralFg: "#59606a",
      },
    },
    {
      name: "Kontraststark",
      text: "Reines Weiß und sehr dunkle Schrift – für helle Räume.",
      palette: {
        ...HELL_VOREINSTELLUNG,
        bg: "#ffffff",
        panel: "#ffffff",
        panel2: "#f2f2f2",
        line: "#c9c9c9",
        text: "#000000",
        muted: "#4a4a4a",
        ci500: "#3c6413",
        neutralBg: "#ebebeb",
        neutralFg: "#3d3d3d",
      },
    },
  ],
  dunkel: [
    {
      name: "Anthrazit (Auslieferung)",
      text: "Ruhiges Dunkelgrau statt Schwarz – Kanten bleiben weich.",
      palette: DUNKEL_VOREINSTELLUNG,
    },
    {
      name: "Grün",
      text: "Alles leicht ins Grüne gezogen, passend zur Hausfarbe.",
      palette: {
        ...DUNKEL_VOREINSTELLUNG,
        bg: "#10160e",
        panel: "#182115",
        panel2: "#1f2a1b",
        line: "#2e3c29",
        text: "#e7efe2",
        muted: "#94a58d",
        neutralBg: "#232f20",
        neutralFg: "#a4b59d",
      },
    },
    {
      name: "Kontraststark",
      text: "Tiefes Schwarz und hellere Schrift – für helle Räume und müde Augen.",
      palette: {
        ...DUNKEL_VOREINSTELLUNG,
        bg: "#000000",
        panel: "#101014",
        panel2: "#191920",
        line: "#3d3d47",
        text: "#ffffff",
        muted: "#c6c3ce",
        ci500: "#b6e884",
        okFg: "#a7f3c4",
        warnFg: "#ffd28a",
        errFg: "#ffb3ad",
        infoFg: "#a6dbff",
        neutralFg: "#c6c3ce",
      },
    },
  ],
};
