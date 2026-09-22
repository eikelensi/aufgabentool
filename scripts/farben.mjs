/**
 * Prueft die Farben, bevor sie jemandem auf den Bildschirm fallen.
 *
 *   npm run farben
 *
 * Zwei Dinge werden nachgerechnet:
 *
 * 1. Lesbarkeit. Jede Paarung, die aufeinander gelesen wird, muss 4,5:1
 *    erreichen - die Schwelle, ab der normal grosse Schrift auch bei
 *    schlechtem Licht sicher lesbar ist. Geprueft werden beide
 *    Voreinstellungen und alle Vorlagen.
 *
 * 2. Gleichstand. Die Voreinstellungen stehen an zwei Stellen: in
 *    lib/design/farben.ts (fuer die Einstellseite und den style-Block)
 *    und in app/globals.css (fuer die Anmeldeseiten, die keine
 *    Datenbank haben). Zwei Stellen driften auseinander, sobald man
 *    nicht hinsieht - also sieht dieses Skript hin.
 *
 * Gelesen wird mit Mustern statt mit einem Import: so laeuft das Skript
 * mit jedem Node, ohne TypeScript-Lader und ohne Bauschritt.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..");
const quelle = readFileSync(join(wurzel, "lib/design/farben.ts"), "utf8");
const css = readFileSync(join(wurzel, "app/globals.css"), "utf8");

// --- Lesen -----------------------------------------------------------

/** Den Rumpf einer als const deklarierten Palette herausschneiden. */
function palette(name) {
  const start = quelle.indexOf(`export const ${name}: Palette = {`);
  if (start < 0) throw new Error(`${name} nicht gefunden`);
  const auf = quelle.indexOf("{", start);
  const zu = quelle.indexOf("};", auf);
  const werte = {};
  for (const [, k, v] of quelle.slice(auf, zu).matchAll(/(\w+):\s*"(#[0-9a-f]{6})"/gi)) {
    werte[k] = v.toLowerCase();
  }
  return werte;
}

/** Alle Vorlagen eines Modus, jeweils mit der Voreinstellung als Basis. */
function vorlagen(modus, basis) {
  const start = quelle.indexOf(`  ${modus}: [`);
  const ende = quelle.indexOf("\n  ],", start);
  const teil = quelle.slice(start, ende);
  const gefunden = [];
  for (const [, name, rumpf] of teil.matchAll(
    /name:\s*"([^"]+)"[\s\S]*?palette:\s*(\{[\s\S]*?\n\s{6}\}|[A-Z_]+,)/g,
  )) {
    const werte = { ...basis };
    for (const [, k, v] of rumpf.matchAll(/(\w+):\s*"(#[0-9a-f]{6})"/gi)) werte[k] = v.toLowerCase();
    gefunden.push({ name, werte });
  }
  return gefunden;
}

/** Die Variablen eines CSS-Blocks, angesprochen ueber seinen Waehler. */
function cssBlock(waehler) {
  const i = css.indexOf(waehler + " {");
  if (i < 0) throw new Error(`Block ${waehler} nicht gefunden`);
  const zu = css.indexOf("\n}", i);
  const werte = {};
  for (const [, k, v] of css.slice(i, zu).matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    werte[k] = v.toLowerCase();
  }
  return werte;
}

// Muss zu VARIABLE in farben.ts passen.
const VARIABLE = {
  bg: "--bg", panel: "--panel", panel2: "--panel-2", line: "--line",
  text: "--text", muted: "--muted", ci400: "--color-ci-400", ci500: "--color-ci-500",
  aufAkzent: "--auf-akzent", okBg: "--ok-bg", okFg: "--ok-fg",
  warnBg: "--warn-bg", warnFg: "--warn-fg", errBg: "--err-bg", errFg: "--err-fg",
  infoBg: "--info-bg", infoFg: "--info-fg", neutralBg: "--neutral-bg",
  neutralFg: "--neutral-fg", privatBg: "--privat-bg", privatFg: "--privat-fg",
};

// Muss zu den Feldern mit "gegen" in farben.ts passen.
const PAARE = [
  ["Schrift", "text", "panel"],
  ["Nebensächliche Schrift", "muted", "panel"],
  ["Akzent für Links", "ci500", "panel"],
  ["Schrift auf dem Akzent", "aufAkzent", "ci400"],
  ["Erledigt", "okFg", "okBg"],
  ["Warnung", "warnFg", "warnBg"],
  ["Fehler", "errFg", "errBg"],
  ["Hinweis", "infoFg", "infoBg"],
  ["Neutral", "neutralFg", "neutralBg"],
  ["Privat", "privatFg", "privatBg"],
];

// --- Rechnen ---------------------------------------------------------

function helligkeit(hex) {
  const teil = (i) => parseInt(hex.slice(i, i + 2), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(teil(1)) + 0.7152 * lin(teil(3)) + 0.0722 * lin(teil(5));
}

function kontrast(a, b) {
  const [h, d] = [helligkeit(a), helligkeit(b)].sort((x, y) => y - x);
  return (h + 0.05) / (d + 0.05);
}

// --- Pruefen ---------------------------------------------------------

let fehler = 0;
const hell = palette("HELL_VOREINSTELLUNG");
const dunkel = palette("DUNKEL_VOREINSTELLUNG");

console.log("\n=== Lesbarkeit (Schwelle 4,5:1) ===\n");
for (const [modus, basis] of [["hell", hell], ["dunkel", dunkel]]) {
  for (const { name, werte } of [
    { name: "Voreinstellung", werte: basis },
    ...vorlagen(modus, basis),
  ]) {
    const schwach = PAARE.map(([label, a, b]) => ({
      label,
      wert: kontrast(werte[a], werte[b]),
    })).filter((p) => p.wert < 4.5);

    if (schwach.length) {
      fehler += schwach.length;
      console.log(`  FEHLT  ${modus.padEnd(7)} ${name}`);
      for (const s of schwach) console.log(`         ${s.label}: ${s.wert.toFixed(2)}:1`);
    } else {
      console.log(`  ok     ${modus.padEnd(7)} ${name}`);
    }
  }
}

console.log("\n=== Gleichstand farben.ts / globals.css ===\n");
for (const [modus, werte, waehler] of [
  ["hell", hell, ":root"],
  ["dunkel", dunkel, ':root[data-theme="dark"]'],
]) {
  // Der helle Modus steht in globals.css in zwei :root-Bloecken - Masse
  // im ersten, Farben im zweiten. Beide zusammen ergeben das Bild.
  const block = cssBlock(waehler);
  const abweichungen = [];
  for (const [schluessel, variable] of Object.entries(VARIABLE)) {
    if (block[variable] !== werte[schluessel]) {
      abweichungen.push(`${variable}: CSS ${block[variable] ?? "fehlt"} / Code ${werte[schluessel]}`);
    }
  }
  if (abweichungen.length) {
    fehler += abweichungen.length;
    console.log(`  WEICHT AB  ${modus}`);
    for (const a of abweichungen) console.log(`             ${a}`);
  } else {
    console.log(`  ok         ${modus} (${Object.keys(VARIABLE).length} Werte gleich)`);
  }
}

console.log(
  fehler ? `\n  ${fehler} Beanstandung(en).\n` : "\n  Alles in Ordnung.\n",
);
process.exit(fehler ? 1 : 0);
