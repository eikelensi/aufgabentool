/**
 * Sind zwei Zeitstempel derselbe Zeitpunkt?
 *
 * Asana liefert "2026-10-20T21:06:47.264Z", Postgres gibt denselben
 * Wert als "2026-10-20T21:06:47.264+00:00" zurueck. Als Text verglichen
 * sind die beiden nie gleich - der Asana-Abgleich hielt deshalb jede
 * abgegebene Aufgabe in jedem Lauf fuer veraendert und schrieb sie neu,
 * jede Minute, und jedes Schreiben liess alle offenen Browser die ganze
 * Aufgabenliste neu laden. Darum hier nach Zeit, nicht nach Text.
 */
export function gleicherZeitpunkt(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a === b;
  return ta === tb;
}
