/**
 * Farben des dunklen Modus.
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
};

export const FARB_FELDER: {
  schluessel: keyof Dunkelfarben;
  label: string;
  erklaerung: string;
}[] = [
  { schluessel: "bg", label: "Seitenhintergrund", erklaerung: "Die Fläche hinter allem." },
  { schluessel: "panel", label: "Karten und Flächen", erklaerung: "Aufgabenkarten, Kopfzeile, Dialoge." },
  { schluessel: "panel2", label: "Vertiefte Flächen", erklaerung: "Eingabefelder, Spalten im Board, Knöpfe." },
  { schluessel: "line", label: "Linien und Ränder", erklaerung: "Trennlinien und Umrandungen." },
  { schluessel: "text", label: "Schrift", erklaerung: "Der normale Text." },
  { schluessel: "muted", label: "Nebensächliche Schrift", erklaerung: "Hinweise, Datumsangaben, Zusätze." },
  { schluessel: "ci400", label: "Akzent hell", erklaerung: "Aktiver Menüpunkt, Hauptknopf, Markierungen." },
  { schluessel: "ci500", label: "Akzent dunkel", erklaerung: "Links und Betonungen." },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Nimmt entgegen, was aus der Datenbank oder einem Formular kommt, und
 * gibt garantiert acht gueltige Hexfarben zurueck. Alles Unbekannte
 * faellt auf die Voreinstellung zurueck.
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

/** Weicht die Einstellung ueberhaupt von der Voreinstellung ab? */
export function istVoreinstellung(farben: Dunkelfarben): boolean {
  return FARB_FELDER.every(
    ({ schluessel }) => farben[schluessel] === DUNKEL_VOREINSTELLUNG[schluessel],
  );
}

/** Der style-Block, der die Voreinstellung ueberschreibt. */
export function dunkelCss(farben: Dunkelfarben): string {
  const f = sichereFarben(farben);
  return (
    `:root[data-theme="dark"]{` +
    `--bg:${f.bg};` +
    `--panel:${f.panel};` +
    `--panel-2:${f.panel2};` +
    `--line:${f.line};` +
    `--text:${f.text};` +
    `--muted:${f.muted};` +
    `--color-ci-400:${f.ci400};` +
    `--color-ci-500:${f.ci500};` +
    `}`
  );
}

/** Helligkeit nach Wahrnehmung - fuer die Warnung bei zu wenig Kontrast. */
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
  const h1 = helligkeit(a);
  const h2 = helligkeit(b);
  const hell = Math.max(h1, h2);
  const dunkel = Math.min(h1, h2);
  return (hell + 0.05) / (dunkel + 0.05);
}
