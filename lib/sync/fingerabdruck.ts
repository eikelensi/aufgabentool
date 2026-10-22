/**
 * Fingerabdruck einer Aufgabenzeile, wie der onOffice-Abgleich sie
 * schreiben will.
 *
 * Der Abgleich holt jeden Lauf alle Aufgaben, die onOffice "heute
 * geaendert" meldet - onOffice kennt dafuer nur das Datum, keine
 * Uhrzeit. Morgens sind das eine Handvoll, abends ueber hundert, und
 * bisher wurde jede davon alle zwei Minuten neu geschrieben. Jeder
 * Schreibvorgang liess per Realtime alle offenen Fenster neu laden.
 * Am 21.10.2026 waren das ueber 3.000 Schreibvorgaenge je Stunde; die
 * Datenbank war danach so ausgelastet, dass das Tool ab 18 Uhr nicht
 * mehr lud.
 *
 * Jetzt wird nur geschrieben, wenn sich der Inhalt wirklich geaendert
 * hat. Die beiden Zeitstempel, die jeder Lauf neu setzt, zaehlen dabei
 * nicht mit - sonst waere jede Zeile immer "neu".
 */
import { createHash } from "node:crypto";

const LAUF_ZEITSTEMPEL = new Set(["onoffice_synced_at", "updated_at"]);

export function fingerabdruck(zeile: Record<string, unknown>): string {
  const inhalt = Object.keys(zeile)
    .filter((k) => !LAUF_ZEITSTEMPEL.has(k) && zeile[k] !== undefined)
    .sort()
    .map((k) => [k, zeile[k]]);
  return createHash("sha256").update(JSON.stringify(inhalt)).digest("base64");
}
