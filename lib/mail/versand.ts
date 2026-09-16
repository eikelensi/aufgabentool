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

  const vars = { ...args.vars, empfaenger: args.empfaenger.name ?? args.empfaenger.email };
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

/** Datum fuer Mails: 16.09.2026 statt ISO. */
export function datumDeutsch(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
