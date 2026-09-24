/**
 * Objekt- und Adressbezug auflösen.
 *
 * Im Aufgabentool tippt man eine Objektnummer wie "OBJ-2419" ein. onOffice
 * braucht intern die estate-ID. Diese Auflösung passiert einmal beim Speichern
 * und wird an der Aufgabe mitgeführt (onoffice_estate_id).
 */

import { call, elements, type OnOfficeRecord } from "./client";

export interface EstateRef {
  id: string;
  number: string;
  title: string;
  street: string;
  city: string;
}

export interface AddressRef {
  id: string;
  name: string;
  email: string;
}

/** Objektnummer -> estate-ID. Gibt null zurück, wenn nichts passt. */
export async function resolveEstateByNumber(estateNumber: string): Promise<EstateRef | null> {
  const value = estateNumber.trim();
  if (!value) return null;

  const res = await call({
    action: "read",
    resourceType: "estate",
    parameters: {
      data: ["Id", "objektnr_extern", "objekttitel", "strasse", "hausnummer", "ort"],
      filter: { objektnr_extern: [{ op: "=", val: value }] },
      listlimit: 1,
    },
  });

  const record = (res.records as OnOfficeRecord[])[0];
  if (!record) return null;

  const e = elements(record);
  const str = (key: string) => String(e[key] ?? "").trim();

  return {
    id: String(record.id ?? str("Id")),
    number: str("objektnr_extern") || value,
    title: str("objekttitel"),
    street: [str("strasse"), str("hausnummer")].filter(Boolean).join(" "),
    city: str("ort"),
  };
}

/** Kundendatensatz prüfen: existiert die address-ID, und wie heißt die Person? */
export async function readAddress(addressId: string | number): Promise<AddressRef | null> {
  const res = await call({
    action: "read",
    resourceType: "address",
    identifier: addressId,
    parameters: { data: ["Vorname", "Name", "Email"], recordids: [String(addressId)] },
  });

  const record = (res.records as OnOfficeRecord[])[0];
  if (!record) return null;

  const e = elements(record);
  const first = String(e.Vorname ?? "").trim();
  const last = String(e.Name ?? "").trim();

  return {
    id: String(record.id ?? addressId),
    name: [first, last].filter(Boolean).join(" ") || "(ohne Namen)",
    email: String(e.Email ?? "").trim(),
  };
}

/**
 * Eine eingetippte Nummer zu einer Objekt-ID machen.
 *
 * Was Menschen "Objektnummer" nennen, ist in onOffice dreierlei: die
 * Maklernummer (objektnr_extern), die interne Nummer und die
 * Datensatz-ID. Wer eine Zahl eintippt, meint irgendeine davon - also
 * probieren wir der Reihe nach, statt ihn raten zu lassen, welche.
 */
export async function findeObjekt(nummer: string): Promise<string | null> {
  const wert = nummer.trim();
  if (!wert) return null;

  for (const feld of ["objektnr_extern", "objektnr_intern"]) {
    try {
      const res = await call({
        action: "read",
        resourceType: "estate",
        parameters: {
          data: ["Id"],
          filter: { [feld]: [{ op: "=", val: wert }] },
          listlimit: 1,
        },
      });
      const record = (res.records as OnOfficeRecord[])[0];
      if (record?.id) return String(record.id);
    } catch {
      // Ein Feld, das dieser Mandant nicht kennt, ist kein Fehler -
      // dann eben das naechste.
    }
  }

  // Zuletzt: die Zahl ist schon die ID.
  if (/^\d+$/.test(wert)) {
    try {
      const res = await call({
        action: "read",
        resourceType: "estate",
        parameters: { data: ["Id"], filter: { Id: [{ op: "=", val: wert }] }, listlimit: 1 },
      });
      if ((res.records as OnOfficeRecord[])[0]?.id) return wert;
    } catch {
      /* dann eben nicht */
    }
  }

  return null;
}

/**
 * Dasselbe fuer Kunden: Kundennummer oder Datensatz-ID.
 *
 * Die Eingabe darf auch "ADR-11482" lauten - der Teil vor der Zahl
 * wird weggeworfen, weil ihn niemand konsequent gleich schreibt.
 */
export async function findeKunde(nummer: string): Promise<string | null> {
  const wert = nummer.trim().replace(/^[A-Za-zÄÖÜäöü-]+[\s-]*/, "").trim() || nummer.trim();
  if (!wert) return null;

  for (const feld of ["KdNr", "Kundennummer"]) {
    try {
      const res = await call({
        action: "read",
        resourceType: "address",
        parameters: {
          data: ["KdNr"],
          filter: { [feld]: [{ op: "=", val: wert }] },
          listlimit: 1,
        },
      });
      const record = (res.records as OnOfficeRecord[])[0];
      if (record?.id) return String(record.id);
    } catch {
      /* Feld gibt es hier nicht */
    }
  }

  if (/^\d+$/.test(wert)) {
    const geprueft = await readAddress(wert).catch(() => null);
    if (geprueft) return wert;
  }

  return null;
}

/**
 * Objekt-IDs zu Objektnummern - fuer mehrere auf einmal.
 *
 * Gebraucht, wenn eine Verknuepfung aus onOffice kommt: die Relation
 * liefert nur die Datensatz-ID, auf der Karte soll aber die Nummer
 * stehen, die im Haus benutzt wird. Eine ID sagt niemandem etwas.
 *
 * Wirft nicht: ohne Nummer wird die ID angezeigt, das ist immer noch
 * besser als ein leeres Feld.
 */
export async function objektNummern(ids: (string | number)[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const recordids = [...new Set(ids.map(String))].filter((x) => /^\d+$/.test(x));
  if (!recordids.length) return map;

  try {
    const res = await call({
      action: "read",
      resourceType: "estate",
      parameters: { data: ["Id", "objektnr_extern"], recordids },
    });

    for (const record of res.records as OnOfficeRecord[]) {
      const e = elements(record);
      const id = String(record.id ?? e.Id ?? "").trim();
      const nummer = String(e.objektnr_extern ?? "").trim();
      if (id && nummer) map.set(id, nummer);
    }
  } catch {
    /* dann eben die ID */
  }

  return map;
}

/** Dasselbe fuer Kundendatensaetze: ID -> Kundennummer. */
export async function kundenNummern(ids: (string | number)[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const recordids = [...new Set(ids.map(String))].filter((x) => /^\d+$/.test(x));
  if (!recordids.length) return map;

  try {
    const res = await call({
      action: "read",
      resourceType: "address",
      parameters: { data: ["KdNr", "Vorname", "Name"], recordids },
    });

    for (const record of res.records as OnOfficeRecord[]) {
      const e = elements(record);
      const id = String(record.id ?? "").trim();
      // Lieber die Kundennummer; ohne die der Name, damit auf der Karte
      // etwas Lesbares steht und nicht eine nackte Datensatznummer.
      const nummer =
        String(e.KdNr ?? "").trim() ||
        [String(e.Vorname ?? "").trim(), String(e.Name ?? "").trim()].filter(Boolean).join(" ");
      if (id && nummer) map.set(id, nummer);
    }
  } catch {
    /* dann eben die ID */
  }

  return map;
}

/**
 * Deeplinks in die onOffice-Oberfläche.
 *
 * Gebaut werden sie in lib/onoffice/links.ts - dieselben Adressen
 * braucht auch der Browser, und der darf diese Datei hier nicht
 * anfassen (sie zieht den API-Client mit Token und Secret nach sich).
 */
export { estateLink as estateDeeplink, addressLink as addressDeeplink } from "./links";
