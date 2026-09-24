/**
 * Adressen in die onOffice-Oberflaeche.
 *
 * Bewusst eine eigene Datei ohne jede Abhaengigkeit: records.ts zieht den
 * API-Client und damit node:crypto nach sich. Was die Oberflaeche braucht,
 * ist nur Zeichenkettenbau - der darf nicht den halben Server ins
 * Browser-Buendel ziehen.
 *
 * Verlinkt wird immer die DATENSATZ-ID, nie die Nummer. Die Objektnummer
 * "4WK-1042" steht auf keinem Schild in onOffice - wer sie in die Adresse
 * schreibt, landet auf einem fremden Objekt oder im Leeren. Angezeigt wird
 * trotzdem die Nummer: die kennt man, die ID nicht.
 */

/** Ohne abschliessenden Schraegstrich, damit der Anker sitzt. */
const BASIS = (
  process.env.NEXT_PUBLIC_ONOFFICE_BASIS ?? "https://smart.onoffice.de/smart/smart.php"
).replace(/\/+$/, "");

export function estateLink(estateId: string | number): string {
  return `${BASIS}#estate/${encodeURIComponent(String(estateId))}`;
}

export function addressLink(addressId: string | number): string {
  return `${BASIS}#address/${encodeURIComponent(String(addressId))}`;
}

/**
 * Aufgabe in onOffice.
 *
 * Der Ersatz fuer das, was die Schnittstelle nicht hergibt: den Inhalt
 * einer Datei, die an einer Aufgabe haengt. Wenigstens der Weg dorthin
 * soll ein Klick sein und kein Suchen nach der Nummer.
 */
export function taskLink(taskId: string | number): string {
  return `${BASIS}#task/${encodeURIComponent(String(taskId))}`;
}
