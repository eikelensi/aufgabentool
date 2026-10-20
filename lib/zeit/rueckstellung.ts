/**
 * Zurueckgestellte Aufgaben (Status "Rueckfragen offen") fuer die Liste im
 * Dashboard - nach Aufgaben, nicht nach Personen: die aelteste Rueckstellung
 * steht oben, damit nichts unbemerkt liegenbleibt.
 *
 * Ohne Importe, damit es sich mit `node --test` pruefen laesst.
 */

interface Verlauf {
  at: string;
  to: string;
}

export interface RueckstellungAufgabe {
  status: string;
  createdAt: string;
  history: Verlauf[];
}

/** Zeitpunkt des letzten Wechsels auf "Rueckfragen offen"; ohne Verlauf die Anlage. */
export function zurueckgestelltSeit(aufgabe: RueckstellungAufgabe): string {
  let seit: string | null = null;
  for (const e of aufgabe.history ?? []) {
    if (e.to === "in_bearbeitung" && (!seit || e.at > seit)) seit = e.at;
  }
  return seit ?? aufgabe.createdAt;
}

export function rueckstellungen<T extends RueckstellungAufgabe>(aufgaben: T[]): { aufgabe: T; seit: string }[] {
  return aufgaben
    .filter((t) => t.status === "in_bearbeitung")
    .map((aufgabe) => ({ aufgabe, seit: zurueckgestelltSeit(aufgabe) }))
    .sort((x, y) => x.seit.localeCompare(y.seit));
}
