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

/** Deeplink in die onOffice-Oberfläche, für die Aufgabenkarte. */
export function estateDeeplink(estateId: string): string {
  return `https://smart.onoffice.de/smart/smart.php#estate/${encodeURIComponent(estateId)}`;
}

export function addressDeeplink(addressId: string): string {
  return `https://smart.onoffice.de/smart/smart.php#address/${encodeURIComponent(addressId)}`;
}
