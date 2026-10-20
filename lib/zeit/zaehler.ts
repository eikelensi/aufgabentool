/**
 * Ab wann der Hinweis "X Tage offen" zaehlt.
 *
 * Bisher ab der Anlage. Eine Aufgabe mit Frist in der Zukunft ist aber
 * nicht liegengeblieben, nur weil sie frueh angelegt wurde - sie soll
 * erst ab ihrem Fristtag zaehlen und sich rot faerben. Ohne Frist (oder
 * mit einer Frist vor der Anlage) bleibt es bei der Anlage.
 *
 * Dieselbe Regel gilt in der Datenbank fuer Erinnerungs- und
 * Eskalationsmails (Migration at_NN "zaehler_ab_frist").
 *
 * Ohne Importe, damit es sich mit `node --test` pruefen laesst.
 */

export interface ZaehlerAufgabe {
  createdAt: string;
  /** Kalendertag 'YYYY-MM-DD' oder null */
  dueDate: string | null;
}

/** Fristtag als Beginn dieses Tages in Ortszeit. */
function tagesbeginn(tag: string): Date {
  const [j, m, t] = tag.split("-").map(Number);
  return new Date(j, (m ?? 1) - 1, t ?? 1);
}

export function zaehlerStart(aufgabe: ZaehlerAufgabe): Date {
  const angelegt = new Date(aufgabe.createdAt);
  if (!aufgabe.dueDate) return angelegt;
  const frist = tagesbeginn(aufgabe.dueDate);
  return frist > angelegt ? frist : angelegt;
}

/** Ganze Tage seit Zaehlbeginn; null, solange der Zaehlbeginn in der Zukunft liegt. */
export function tageOffen(aufgabe: ZaehlerAufgabe, jetzt: Date = new Date()): number | null {
  const start = zaehlerStart(aufgabe);
  if (start.getTime() > jetzt.getTime()) return null;
  return Math.floor((jetzt.getTime() - start.getTime()) / 864e5);
}
