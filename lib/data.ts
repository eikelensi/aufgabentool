/**
 * Kleinigkeiten, die mehrere Stellen brauchen.
 *
 * Diese Datei war einmal der Demo-Datensatz: erfundene Mitarbeitende,
 * Aufgaben, Mailprotokolle. Seit die Oberflaeche gegen die Datenbank
 * laeuft, ist davon nichts mehr in Gebrauch - geblieben sind die beiden
 * Werte, die tatsaechlich noch jemand aufruft.
 */

/** Erlaubte Dateiendungen, OHNE fuehrenden Punkt. */
export const ALLOWED_EXTENSIONS = [
  "pdf", "jpg", "jpeg", "png", "gif", "webp", "tif", "tiff",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "txt", "csv", "rtf", "odt", "ods",
  "eml", "msg", "zip",
];

/** Datum im Format YYYY-MM-DD, wahlweise um Tage verschoben. */
export function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
