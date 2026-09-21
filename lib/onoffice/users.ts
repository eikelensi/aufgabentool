/**
 * onOffice-Benutzer lesen – Quelle für die Auswahlliste der Kollegen.
 *
 * Die Benutzerliste liegt im Settings-Bereich der API. Je nach Mandant und
 * Version heißt die Ressource "user" oder "users"; wir probieren beide, damit
 * der erste Lauf nicht an einer Namensvariante scheitert.
 */

import { elements, tryCall, type OnOfficeRecord } from "./client";

export interface OnofficeUser {
  id: string;
  /** Anzeigename wie im Aufgabenmodul, z.B. "Weis, Markus (mw)". */
  displayName: string;
  shortCode: string;
  email: string;
  isActive: boolean;
  raw: Record<string, unknown>;
}

const USER_FIELDS = ["Vorname", "Name", "email", "Kuerzel", "aktiv", "ID", "username"];

function toUser(record: OnOfficeRecord): OnofficeUser {
  const e = elements(record);
  const str = (...keys: string[]) => {
    for (const key of keys) {
      const value = e[key];
      if (value != null && String(value).trim() !== "") return String(value).trim();
    }
    return "";
  };

  const first = str("Vorname", "firstname");
  const last = str("Name", "lastname", "Nachname");
  const short = str("Kuerzel", "shorthandsymbol", "username");

  const name = last && first ? `${last}, ${first}` : last || first || short || "(ohne Namen)";

  return {
    id: str("ID", "id") || String(record.id ?? ""),
    displayName: short ? `${name} (${short})` : name,
    shortCode: short,
    email: str("email", "Email", "emailPrivate"),
    isActive: str("aktiv", "active") !== "0",
    raw: e,
  };
}

export async function readUsers(): Promise<{ users: OnofficeUser[]; resourceUsed: string }> {
  const candidates = ["user", "users"];
  const problems: string[] = [];

  for (const resourceType of candidates) {
    const attempt = await tryCall({
      action: "get",
      resourceType,
      parameters: { data: USER_FIELDS },
    });

    if (attempt.ok) {
      const users = (attempt.result.records as OnOfficeRecord[])
        .map(toUser)
        .filter((u) => u.email);
      return { users, resourceUsed: resourceType };
    }
    problems.push(`${resourceType}: ${attempt.error.message}`);
  }

  throw new Error(`Benutzerliste nicht lesbar. ${problems.join(" | ")}`);
}
