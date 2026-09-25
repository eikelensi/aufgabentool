/**
 * Der Weg von einer Datensatznummer in die onOffice-Oberflaeche.
 *
 * Lange stand hier ein selbstgebautes Muster (smart.php#estate/123).
 * Es hat nie funktioniert: onOffice hat den Anker ignoriert und das
 * Dashboard gezeigt. Der Grund ist einfach - die Oberflaeche traegt
 * ihren Zustand in einem verschluesselten "params" mit sich, nicht in
 * lesbaren Parametern. Ein Link auf einen Datensatz laesst sich von
 * aussen nicht zusammensetzen.
 *
 * onOffice beantwortet genau das mit einer eigenen Ressource:
 * "getlink". Man nennt Modul und Datensatznummer und bekommt eine
 * fertige, verschluesselte Adresse zurueck. Die Doku sagt ausdruecklich,
 * dass diese Adressen NICHT dauerhaft gespeichert werden sollen - sie
 * koennen sich mit jedem Release aendern. Deshalb holen wir sie im
 * Moment des Klicks und speichern nichts.
 *
 * Unterstuetzt sind estate, address und agentslog. Aufgaben nicht -
 * fuer sie gibt es keinen Direktlink, und das ist kein Versehen
 * unsererseits.
 */
import { call, elements, type OnOfficeRecord } from "./client";

export type LinkModul = "estate" | "address";

export async function holeDeeplink(
  modul: LinkModul,
  recordId: string | number,
): Promise<string | null> {
  const res = await call({
    action: "get",
    resourceType: "getlink",
    resourceId: modul,
    parameters: { recordId: Number(recordId) },
  });

  for (const record of res.records as OnOfficeRecord[]) {
    const e = elements(record);
    const url = e.url ?? e.link;
    if (typeof url === "string" && /^https?:\/\//i.test(url)) return url;
  }

  return null;
}
