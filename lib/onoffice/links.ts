/**
 * Adressen in die onOffice-Oberflaeche.
 *
 * Bewusst eine eigene Datei ohne jede Abhaengigkeit: records.ts zieht den
 * API-Client und damit node:crypto nach sich. Was die Oberflaeche braucht,
 * ist nur Zeichenkettenbau - der darf nicht den halben Server ins
 * Browser-Buendel ziehen.
 *
 * Was hier entsteht, ist KEINE onOffice-Adresse mehr, sondern eine
 * Adresse im eigenen Haus: /oeffnen/<modul>/<id>. Diese Seite fragt
 * onOffice im Moment des Klicks nach dem echten Link und leitet weiter.
 *
 * Der Grund: die alte Fassung hat "smart.php#estate/123" gebaut und ist
 * immer auf dem Dashboard gelandet. onOffice traegt seinen Zustand in
 * einem verschluesselten Parameter mit sich - ein Link auf einen
 * Datensatz laesst sich von aussen nicht zusammensetzen, er muss von
 * onOffice ausgestellt werden (Ressource "getlink").
 *
 * Verlinkt wird die DATENSATZ-ID, nie die Nummer. Die Objektnummer
 * "4WK-1042" kennt "getlink" nicht. Angezeigt wird trotzdem die Nummer:
 * die kennt man, die ID nicht.
 */

export function estateLink(estateId: string | number): string {
  return `/oeffnen/estate/${encodeURIComponent(String(estateId))}`;
}

export function addressLink(addressId: string | number): string {
  return `/oeffnen/address/${encodeURIComponent(String(addressId))}`;
}

/**
 * Fuer Aufgaben gibt es keinen Link.
 *
 * "getlink" kennt estate, address und agentslog - task nicht. Frueher
 * stand hier ein gebasteltes Muster; es hat auf dem Dashboard geendet,
 * was schlimmer ist als gar kein Link, weil es nach einem Fehler des
 * Benutzers aussieht. Also: undefined, und der Chip bleibt stumm.
 */
export function taskLink(): undefined {
  return undefined;
}
