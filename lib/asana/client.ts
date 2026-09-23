/**
 * Asana-Client.
 *
 * Schlank mit Absicht: ein Token im Kopf, JSON hin, JSON zurueck. Die
 * Bibliothek von Asana kann mehr, als wir brauchen, und zieht ein
 * halbes Paketverzeichnis nach sich.
 *
 * Zugangsdaten kommen aus der Umgebung, nie aus dem Code:
 *   ASANA_TOKEN         - persoenliches Zugriffstoken
 *   ASANA_PROJECT_GID   - das Projekt, das gespiegelt wird
 *   ASANA_WORKSPACE_GID - fuer das Anlegen neuer Aufgaben
 */

const BASIS = "https://app.asana.com/api/1.0";

export interface AsanaFehlerDetail {
  message?: string;
  help?: string;
}

export class AsanaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly roh?: unknown,
  ) {
    super(message);
    this.name = "AsanaError";
  }
}

export function asanaKonfiguriert(): boolean {
  return Boolean(process.env.ASANA_TOKEN && projektGid());
}

export function projektGid(): string {
  // Das Projekt "Buchhaltung und HR" als Vorgabe: so muss niemand eine
  // Nummer abtippen, und wer ein anderes will, setzt die Variable.
  return (process.env.ASANA_PROJECT_GID ?? "1212315931555191").trim();
}

export function workspaceGid(): string {
  return (process.env.ASANA_WORKSPACE_GID ?? "1209358356488262").trim();
}

interface RufArgs {
  pfad: string;
  methode?: "GET" | "POST" | "PUT" | "DELETE";
  /** Wird als { data: ... } gesendet, so will es Asana. */
  daten?: Record<string, unknown>;
  query?: Record<string, string | number | undefined>;
}

export async function ruf<T = unknown>(args: RufArgs): Promise<T> {
  const token = process.env.ASANA_TOKEN;
  if (!token) throw new AsanaError("ASANA_TOKEN ist nicht gesetzt.");

  const url = new URL(BASIS + args.pfad);
  for (const [schluessel, wert] of Object.entries(args.query ?? {})) {
    if (wert !== undefined && wert !== "") url.searchParams.set(schluessel, String(wert));
  }

  const antwort = await fetch(url, {
    method: args.methode ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: args.daten ? JSON.stringify({ data: args.daten }) : undefined,
    cache: "no-store",
  });

  const roh = (await antwort.json().catch(() => ({}))) as {
    data?: T;
    errors?: AsanaFehlerDetail[];
  };

  if (!antwort.ok) {
    const meldung =
      roh.errors?.map((f) => f.message).filter(Boolean).join("; ") ||
      `Asana antwortete mit ${antwort.status}.`;
    throw new AsanaError(meldung, antwort.status, roh);
  }

  return roh.data as T;
}

/**
 * Seitenweise lesen, bis nichts mehr kommt.
 *
 * Asana gibt hoechstens hundert Datensaetze auf einmal und einen
 * Zeiger auf die naechste Seite. Ein Projekt mit dreihundert Aufgaben
 * braeuchte sonst drei Aufrufe von Hand - und beim vierhundertsten
 * faellt es niemandem auf, dass etwas fehlt.
 */
export async function rufAlle<T = unknown>(
  pfad: string,
  query: Record<string, string | number | undefined> = {},
  grenze = 1000,
): Promise<T[]> {
  const token = process.env.ASANA_TOKEN;
  if (!token) throw new AsanaError("ASANA_TOKEN ist nicht gesetzt.");

  const alle: T[] = [];
  let offset: string | undefined;

  while (alle.length < grenze) {
    const url = new URL(BASIS + pfad);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
    url.searchParams.set("limit", "100");
    if (offset) url.searchParams.set("offset", offset);

    const antwort = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });

    const roh = (await antwort.json().catch(() => ({}))) as {
      data?: T[];
      next_page?: { offset?: string } | null;
      errors?: AsanaFehlerDetail[];
    };

    if (!antwort.ok) {
      throw new AsanaError(
        roh.errors?.map((f) => f.message).filter(Boolean).join("; ") ||
          `Asana antwortete mit ${antwort.status}.`,
        antwort.status,
        roh,
      );
    }

    alle.push(...(roh.data ?? []));
    offset = roh.next_page?.offset;
    if (!offset) break;
  }

  return alle;
}
