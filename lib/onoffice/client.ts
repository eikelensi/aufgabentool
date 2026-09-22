/**
 * onOffice-API-Client (smart 2.5, HMAC v2).
 *
 * Alle Zugangsdaten kommen aus Umgebungsvariablen – niemals in den Code:
 *   ONOFFICE_API_TOKEN, ONOFFICE_API_SECRET, optional ONOFFICE_API_URL
 *
 * Aufbau eines Requests laut Dokumentation:
 *   { token, request: { actions: [ { actionid, resourcetype, resourceid?,
 *     identifier?, timestamp, hmac, hmac_version: "2", parameters } ] } }
 *
 * HMAC v2 = base64( hmac_sha256( ts + token + resourcetype + actionid, secret ) )
 * Reine Verkettung ohne Bezeichner – gegen den Mandanten der 4waendekanzlei
 * verifiziert (scripts/hmac-varianten.mjs, 16.09.2026). Achtung: manche
 * Doku-Fassungen zeigen die Variante MIT Bezeichnern, die wird abgelehnt.
 */

import { createHmac } from "node:crypto";

export const ACTION = {
  read: "urn:onoffice-de-ns:smart:2.5:smartml:action:read",
  create: "urn:onoffice-de-ns:smart:2.5:smartml:action:create",
  modify: "urn:onoffice-de-ns:smart:2.5:smartml:action:modify",
  delete: "urn:onoffice-de-ns:smart:2.5:smartml:action:delete",
  get: "urn:onoffice-de-ns:smart:2.5:smartml:action:get",
  do: "urn:onoffice-de-ns:smart:2.5:smartml:action:do",
} as const;

export type ActionKey = keyof typeof ACTION;

export interface OnOfficeRecord {
  id?: string | number;
  type?: string;
  elements?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface OnOfficeCallResult<T = OnOfficeRecord[]> {
  ok: boolean;
  records: T;
  /** Gesamtanzahl laut API, für Paginierung. */
  total?: number;
  httpStatus: number;
  errorCode?: number;
  message?: string;
  /** Rohantwort, für Diagnose in der Probe-Route. */
  raw?: unknown;
  durationMs: number;
}

export class OnOfficeError extends Error {
  constructor(
    message: string,
    readonly errorCode?: number,
    readonly httpStatus?: number,
    readonly raw?: unknown,
  ) {
    super(message);
    this.name = "OnOfficeError";
  }
}

export interface OnOfficeConfig {
  token: string;
  secret: string;
  url: string;
  emailIdentity?: string;
}

/** Liest die Konfiguration aus der Umgebung. Wirft, wenn etwas fehlt. */
export function onofficeConfig(): OnOfficeConfig {
  const token = process.env.ONOFFICE_API_TOKEN;
  const secret = process.env.ONOFFICE_API_SECRET;

  if (!token || !secret) {
    throw new OnOfficeError(
      "ONOFFICE_API_TOKEN und ONOFFICE_API_SECRET sind nicht gesetzt. " +
        "Bitte als Umgebungsvariablen hinterlegen (Vercel bzw. .env.local).",
    );
  }

  return {
    token,
    secret,
    url: process.env.ONOFFICE_API_URL ?? "https://api.onoffice.de/api/stable/api.php",
    emailIdentity: process.env.ONOFFICE_EMAIL_IDENTITY,
  };
}

/** Ist die Anbindung überhaupt konfiguriert? Ohne zu werfen. */
export function onofficeConfigured(): boolean {
  return Boolean(process.env.ONOFFICE_API_TOKEN && process.env.ONOFFICE_API_SECRET);
}

function hmacV2(args: {
  timestamp: number;
  token: string;
  resourceType: string;
  actionId: string;
  secret: string;
}): string {
  // Reine Verkettung ohne Bezeichner. Gegen den Mandanten verifiziert
  // (scripts/hmac-varianten.mjs, 16.09.2026): timestamp + token +
  // resourcetype + actionid, SHA-256 mit dem Secret als Text, Base64.
  const payload = `${args.timestamp}${args.token}${args.resourceType}${args.actionId}`;

  return createHmac("sha256", args.secret).update(payload, "utf8").digest("base64");
}

export interface CallOptions {
  action: ActionKey;
  resourceType: string;
  /**
   * Das, was die Schnittstelle "resourceid" nennt. Je nach Ressource
   * zweierlei: bei "file" die zweite Ebene ("estate", "address",
   * "task"), bei modify und delete die KENNUNG DES DATENSATZES. Die
   * Doku zu "Modify Tasks" ist da eindeutig: "The task ID has to be
   * specified as resource ID."
   */
  resourceId?: string;
  /**
   * NICHT die Datensatz-ID, auch wenn der Name danach klingt. Beim
   * Aendern wird sie ignoriert, und onOffice antwortet mit "Missing or
   * invalid attribute: resourceid (Code 18)". Wer einen Datensatz
   * aendern will, nimmt resourceId.
   */
  identifier?: string | number;
  parameters?: Record<string, unknown>;
  /** Timeout in Millisekunden, Standard 30 s. */
  timeoutMs?: number;
  config?: OnOfficeConfig;
}

/**
 * Führt genau eine Action aus. Mehrere Actions pro Request wären möglich,
 * machen die Fehlerauswertung aber unübersichtlich – wir bleiben bei einer.
 */
export async function call<T = OnOfficeRecord[]>(
  options: CallOptions,
): Promise<OnOfficeCallResult<T>> {
  const cfg = options.config ?? onofficeConfig();
  const actionId = ACTION[options.action];
  const timestamp = Math.floor(Date.now() / 1000);
  const started = Date.now();

  const body = {
    token: cfg.token,
    request: {
      actions: [
        {
          actionid: actionId,
          resourceid: options.resourceId ?? "",
          identifier: options.identifier != null ? String(options.identifier) : "",
          resourcetype: options.resourceType,
          timestamp,
          hmac_version: "2",
          hmac: hmacV2({
            timestamp,
            token: cfg.token,
            resourceType: options.resourceType,
            actionId,
            secret: cfg.secret,
          }),
          parameters: options.parameters ?? {},
        },
      ],
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

  let httpStatus = 0;
  let json: any;

  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    httpStatus = res.status;
    const text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      throw new OnOfficeError(
        `Antwort war kein JSON (HTTP ${res.status}): ${text.slice(0, 300)}`,
        undefined,
        res.status,
      );
    }
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof OnOfficeError) throw err;
    const aborted = (err as Error)?.name === "AbortError";
    throw new OnOfficeError(
      aborted
        ? `Zeitüberschreitung nach ${(options.timeoutMs ?? 30_000) / 1000} s`
        : `Netzwerkfehler: ${(err as Error).message}`,
      undefined,
      httpStatus,
    );
  }
  clearTimeout(timer);

  const durationMs = Date.now() - started;

  // Fehler können auf Request- und auf Action-Ebene stehen.
  const outerStatus = json?.status ?? {};
  const action = json?.response?.results?.[0] ?? {};
  const innerStatus = action?.status ?? {};

  const errorCode: number | undefined =
    Number(innerStatus.errorcode) || Number(outerStatus.errorcode) || undefined;
  const message: string | undefined = innerStatus.message ?? outerStatus.message;

  if (httpStatus >= 400 || (errorCode && errorCode !== 0)) {
    throw new OnOfficeError(
      message ? `onOffice: ${message} (Code ${errorCode ?? "?"})` : `onOffice HTTP ${httpStatus}`,
      errorCode,
      httpStatus,
      json,
    );
  }

  const data = action?.data ?? {};
  const records: T = (data.records ?? []) as T;

  return {
    ok: true,
    records,
    total: data.meta?.cntabsolute != null ? Number(data.meta.cntabsolute) : undefined,
    httpStatus,
    errorCode,
    message,
    raw: json,
    durationMs,
  };
}

/** Wie `call`, wirft aber nicht – für Probe-Läufe und Sammelberichte. */
export async function tryCall<T = OnOfficeRecord[]>(
  options: CallOptions,
): Promise<{ ok: true; result: OnOfficeCallResult<T> } | { ok: false; error: OnOfficeError }> {
  try {
    return { ok: true, result: await call<T>(options) };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof OnOfficeError
          ? err
          : new OnOfficeError((err as Error)?.message ?? "Unbekannter Fehler"),
    };
  }
}

/** Erstes Element eines Records, egal ob die API es flach oder in elements liefert. */
export function elements(record: OnOfficeRecord): Record<string, unknown> {
  return (record.elements as Record<string, unknown>) ?? record;
}
