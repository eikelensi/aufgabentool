/**
 * Adressen in die onOffice-Oberflaeche.
 *
 * Bewusst eine eigene Datei ohne jede Abhaengigkeit: records.ts zieht den
 * API-Client und damit node:crypto nach sich. Was die Oberflaeche braucht,
 * ist nur Zeichenkettenbau - der darf nicht den halben Server ins
 * Browser-Buendel ziehen.
 */

const BASIS = "https://smart.onoffice.de/smart/smart.php";

export function estateLink(estateId: string): string {
  return `${BASIS}#estate/${encodeURIComponent(estateId)}`;
}

export function addressLink(addressId: string): string {
  return `${BASIS}#address/${encodeURIComponent(addressId)}`;
}

/**
 * Aufgabe in onOffice.
 *
 * Der Ersatz fuer das, was die Schnittstelle nicht hergibt: den Inhalt
 * einer Datei, die an einer Aufgabe haengt. Wenigstens der Weg dorthin
 * soll ein Klick sein und kein Suchen nach der Nummer.
 */
export function taskLink(taskId: string): string {
  return `${BASIS}#task/${encodeURIComponent(taskId)}`;
}
