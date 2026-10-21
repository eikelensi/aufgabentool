/**
 * Welche Figur nach einer erledigten Aufgabe durchs Bild huepft.
 *
 * Nach Monat, damit es zur Jahreszeit passt:
 *   Januar, Februar     Schneemann
 *   Maerz, April        Osterhase
 *   Mai bis September   Einhorn
 *   Oktober, November   Kuerbis (Halloween)
 *   Dezember            Weihnachtsmann
 */
export type Feierfigur = "schneemann" | "osterhase" | "einhorn" | "kuerbis" | "weihnachtsmann";

export function figurZurJahreszeit(datum: Date = new Date()): Feierfigur {
  const monat = datum.getMonth() + 1;
  if (monat === 12) return "weihnachtsmann";
  if (monat >= 10) return "kuerbis";
  if (monat <= 2) return "schneemann";
  if (monat <= 4) return "osterhase";
  return "einhorn";
}
