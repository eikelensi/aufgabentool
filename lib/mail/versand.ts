/**
 * Benachrichtigungen verschicken - mit Sperre gegen Doppelversand.
 *
 * Der Ablauf ist absichtlich in dieser Reihenfolge:
 *   1. Eintrag im Protokoll anlegen und damit den dedupe_key beanspruchen
 *   2. erst dann senden
 *   3. Ergebnis im Eintrag nachtragen
 *
 * Wuerde man erst senden und danach protokollieren, wuerden zwei
 * gleichzeitige Laeufe - etwa Zeitplan und Knopfdruck - dieselbe Mail
 * zweimal verschicken. So scheitert der zweite Lauf am eindeutigen Index
 * und sendet nichts.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { deliver, render, type MailProvider } from "./index";
import type { NotifyKind } from "@/lib/types";

export interface Empfaenger {
  email: string;
  name?: string;
}

export interface VersandErgebnis {
  verschickt: number;
  uebersprungen: number;
  fehler: string[];
}

export function leeresErgebnis(): VersandErgebnis {
  return { verschickt: 0, uebersprungen: 0, fehler: [] };
}

/**
 * Die Adresse, unter der das Tool erreichbar ist.
 *
 * Fest aus der Umgebung, nicht aus dem Anfrage-Kopf: diese Links
 * stehen in Mails, die Tage spaeter geoeffnet werden, und ein Cron-Lauf
 * hat ohnehin keinen Kopf, aus dem sich etwas lesen liesse.
 */
export function basisAdresse(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://task.4waendekanzlei.de").replace(/\/+$/, "");
}

/**
 * Der Link auf EINE Aufgabe - an einer Stelle, nicht in jeder Route.
 *
 * "Steht im Tool" war bisher alles, was eine Mail sagen konnte. Wer
 * eine Meldung bekam, suchte die Aufgabe danach in einer Liste.
 */
export function aufgabenLink(taskId: string): string {
  return `${basisAdresse()}/aufgabe/${taskId}`;
}

/**
 * Eine Benachrichtigung an einen Empfaenger. dedupeKey muss den Anlass
 * eindeutig beschreiben, also Aufgabe, Art und den Zeitpunkt, der den
 * Anlass ausgeloest hat.
 */
export async function sendeBenachrichtigung(args: {
  taskId: string | null;
  kind: NotifyKind;
  empfaenger: Empfaenger;
  dedupeKey: string;
  vars: Record<string, string>;
  provider?: MailProvider;
}): Promise<"verschickt" | "uebersprungen" | "fehler"> {
  const sb = supabaseAdmin();

  if (!args.empfaenger.email) return "uebersprungen";

  const { data: vorlage } = await sb
    .from("email_templates")
    .select("subject, body, is_active")
    .eq("key", args.kind)
    .maybeSingle();

  if (!vorlage || vorlage.is_active === false) return "uebersprungen";

  // link und nummer stehen jeder Vorlage zur Verfuegung, ohne dass
  // jede Route sie einzeln fuellen muss. Wer sie ausdruecklich
  // mitgibt, behaelt Vorrang - eine Route weiss manchmal mehr.
  const vars = {
    link: args.taskId ? aufgabenLink(args.taskId) : "",
    nummer: "",
    ...args.vars,
    empfaenger: args.empfaenger.name ?? args.empfaenger.email,
  };
  const betreff = render(vorlage.subject, vars);
  const text = render(vorlage.body, vars);

  const { data: eintrag, error: protokollFehler } = await sb
    .from("notifications_log")
    .insert({
      task_id: args.taskId,
      kind: args.kind,
      recipient: args.empfaenger.email,
      recipient_name: args.empfaenger.name ?? null,
      subject: betreff,
      body: text,
      provider: args.provider ?? "onoffice",
      status: "queued",
      dedupe_key: args.dedupeKey,
    })
    .select("id")
    .single();

  if (protokollFehler) {
    // 23505 = eindeutiger Index verletzt: dieser Anlass ist schon erledigt.
    if (protokollFehler.code === "23505") return "uebersprungen";
    throw new Error(protokollFehler.message);
  }

  const ergebnis = await deliver(
    { to: [args.empfaenger.email], subject: betreff, body: text },
    args.provider,
  );

  await sb
    .from("notifications_log")
    .update({
      status: ergebnis.ok ? "sent" : "failed",
      provider: ergebnis.provider,
      provider_msg_id: ergebnis.providerMessageId ?? null,
      error: ergebnis.ok ? null : (ergebnis.error ?? "unbekannt"),
      sent_at: ergebnis.ok ? new Date().toISOString() : null,
    })
    .eq("id", eintrag.id);

  return ergebnis.ok ? "verschickt" : "fehler";
}

export function zaehle(
  ergebnis: VersandErgebnis,
  ausgang: "verschickt" | "uebersprungen" | "fehler",
  beschreibung: string,
): void {
  if (ausgang === "verschickt") ergebnis.verschickt++;
  else if (ausgang === "uebersprungen") ergebnis.uebersprungen++;
  else ergebnis.fehler.push(beschreibung);
}

/**
 * Die Rahmenbedingungen einer Aufgabe als fertiger Block.
 *
 * Der zugeordnete Kollege arbeitet nicht im Tool. Eine Mail, die nur
 * "die Aufgabe ist erledigt" sagt, zwingt ihn zum Raten: er hat
 * mehrere offene Vorgaenge, und der Betreff allein unterscheidet sie
 * nicht. Deshalb steht hier alles, woran er die Aufgabe erkennt -
 * Nummer, Betreff, Art, Frist, Objekt.
 *
 * Zeilen ohne Inhalt fallen weg. Eine Aufgabe ohne Frist soll keine
 * Zeile "Frist: -" erzeugen; das liest sich wie ein Fehler.
 */
export function aufgabenRahmen(felder: Array<[string, string | null | undefined]>): string {
  const gefuellt = felder.filter(([, wert]) => {
    const w = String(wert ?? "").trim();
    return w !== "" && w !== "-" && w !== "\u2013";
  });
  if (gefuellt.length === 0) return "";

  const breite = Math.max(...gefuellt.map(([name]) => name.length));
  return gefuellt.map(([name, wert]) => `${name.padEnd(breite)} : ${String(wert).trim()}`).join("\n");
}

/**
 * Die Beschreibung auf das Wesentliche kuerzen.
 *
 * Aufgaben entstehen hier meist aus einer E-Mail, und dann steht in
 * der Beschreibung die GANZE Mail: Anliegen, Signatur, Telefonnummern,
 * Social-Media-Zeilen, Haftungsausschluss. Ungekuerzt in eine
 * Benachrichtigung gesetzt, ersaeuft das Anliegen in zwei Kilobyte
 * Fusszeile - und der Empfaenger liest sie nicht.
 *
 * Darum: abschneiden, wo die Hoeflichkeit beginnt. Was dahinter steht,
 * ist nie die Aufgabe. Die vollstaendige Beschreibung bleibt an der
 * Aufgabe im Tool.
 */
const SCHLUSSFORMELN = [
  /^\s*(mit\s+)?(freundliche[nm]?|viele|beste|liebe|herzliche)\s+gr(ü|ue)(ß|ss)e/i,
  /^\s*(mfg|lg|vg)\s*$/i,
  /^\s*diese\s+e-?mail\s+enth(ä|ae)lt/i,
  /^\s*vertretungsberechtigte\s*:/i,
  /^\s*(um\s+diese\s+nachricht\s+anzuh(ö|oe)ren|to\s+listen\s+to\s+this\s+message)/i,
  /^\s*(vielen\s+dank|thank\s+you)\s*,?\s*$/i,
];

export function kurzfassung(
  text: string | null | undefined,
  maxZeichen = 600,
  titel?: string | null,
): string {
  const zeilen = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");

  // Aufgaben aus einer Mail tragen deren Betreff doppelt: als Titel und
  // als erste Zeile der Beschreibung. Einmal genuegt.
  const kopf = String(titel ?? "").trim().toLowerCase();
  while (kopf && zeilen.length > 0 && zeilen[0].trim().toLowerCase() === kopf) zeilen.shift();

  const bis = zeilen.findIndex((z) => SCHLUSSFORMELN.some((r) => r.test(z)));
  let kurz = (bis > 0 ? zeilen.slice(0, bis) : zeilen)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (kurz.length > maxZeichen) {
    const schnitt = kurz.slice(0, maxZeichen);
    const luecke = schnitt.lastIndexOf(" ");
    kurz = `${(luecke > maxZeichen * 0.6 ? schnitt.slice(0, luecke) : schnitt).trimEnd()} […]`;
  }

  return kurz;
}

/**
 * Aus "Marker, Gerrit (Marker)" wird "Gerrit Marker".
 *
 * Die Kollegen stehen so in onOffice, wie onOffice sie sortiert:
 * Nachname zuerst, dahinter das Kuerzel in Klammern. In einer Liste
 * ist das richtig. In einer Anrede - "Hallo Marker, Gerrit (Marker)" -
 * sieht es nach Maschine aus.
 *
 * Bewusst zurueckhaltend: kein Herr, keine Frau (das Geschlecht steht
 * nirgends), und bei allem, was nicht dem Muster entspricht, bleibt
 * der Name unveraendert.
 */
export function anredeName(name: string | null | undefined): string {
  const roh = String(name ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  const teile = roh.split(",");
  if (teile.length !== 2) return roh;
  const [nach, vor] = teile.map((s) => s.trim());
  return vor && nach ? `${vor} ${nach}` : roh;
}

/** Datum fuer Mails: 16.09.2026 statt ISO. */
export function datumDeutsch(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
