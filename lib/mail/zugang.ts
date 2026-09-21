/**
 * Einladungs- und Passwortmails - ueber UNSEREN Postausgang, nicht ueber
 * den von Supabase.
 *
 * Warum der Umweg? Drei Gruende, alle gemessen:
 *
 *  1. Supabases eingebauter Versand erlaubt nur wenige Mails pro Stunde
 *     und verschickt von einer fremden Absenderadresse.
 *  2. Seine Vorlagen lassen sich ohne eigenen SMTP-Zugang IN Supabase
 *     ueberhaupt nicht aendern - der Link zeigt dann zwingend auf
 *     Supabases /verify-Endpunkt.
 *  3. Und genau dieser Link wird vom Link-Scanner der Mailkette
 *     aufgerufen, bevor der Empfaenger ihn anklickt. In den Protokollen:
 *     Mail um 22:06:54 raus, Link um 22:07:00 geoeffnet, beim echten
 *     Klick um 22:07:22 schon verbraucht.
 *
 * generateLink erzeugt den Token, OHNE eine Mail zu verschicken. Wir
 * bauen daraus einen Link auf unsere eigene Seite, die den Token erst
 * beim Knopfdruck einloest, und verschicken ihn ueber den SMTP-Zugang,
 * den das Tool ohnehin hat. Damit laeuft der Scanner ins Leere.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { deliver, type MailProvider } from "./index";

export type ZugangsArt = "invite" | "recovery";

export interface ZugangsErgebnis {
  ok: boolean;
  meldung: string;
  /** Nur gesetzt, wenn kein Postausgang eingerichtet ist. */
  linkZumWeitergeben?: string;
  benutzerId?: string;
}

function textFuer(art: ZugangsArt, name: string, link: string): { betreff: string; text: string } {
  if (art === "invite") {
    return {
      betreff: "Dein Zugang zum Aufgabentool der 4wändekanzlei",
      text:
        `Hallo ${name},\n\n` +
        "für dich wurde ein Zugang zum Aufgabentool angelegt.\n\n" +
        "Über diesen Link setzt du dein Passwort selbst:\n\n" +
        `${link}\n\n` +
        "Der Link gilt 24 Stunden und lässt sich einmal verwenden. Es wurde kein " +
        "Passwort für dich erzeugt und keines verschickt – du vergibst es selbst, " +
        "und niemand sonst kennt es.\n\n" +
        "Danach meldest du dich hier an:\n" +
        "https://task.4waendekanzlei.de\n\n" +
        "Viele Grüße\n4wändekanzlei Aufgabentool",
    };
  }

  return {
    betreff: "Passwort für das Aufgabentool neu setzen",
    text:
      `Hallo ${name},\n\n` +
      "für deinen Zugang zum Aufgabentool wurde ein neues Passwort angefordert.\n\n" +
      `${link}\n\n` +
      "Der Link gilt eine Stunde. Dein bisheriges Passwort bleibt gültig, bis du " +
      "auf dieser Seite ein neues gespeichert hast.\n\n" +
      "Warst du das nicht, kannst du diese Mail ignorieren – ohne den Link " +
      "ändert sich nichts.\n\n" +
      "Viele Grüße\n4wändekanzlei Aufgabentool",
  };
}

export async function sendeZugangsMail(args: {
  email: string;
  name?: string;
  art: ZugangsArt;
  basisAdresse: string;
  provider?: MailProvider;
}): Promise<ZugangsErgebnis> {
  const sb = supabaseAdmin();
  const email = args.email.trim().toLowerCase();

  const { data, error } = await sb.auth.admin.generateLink({
    type: args.art,
    email,
  });

  if (error || !data?.properties?.hashed_token) {
    const m = error?.message ?? "Kein Token erhalten";
    if (/already been registered|already exists/i.test(m)) {
      return {
        ok: false,
        meldung:
          "Zu dieser Adresse gibt es schon einen Zugang. Für ein neues Passwort " +
          "bitte „Passwort zurücksetzen“ verwenden statt neu einzuladen.",
      };
    }
    if (/not found|user.*does not exist/i.test(m)) {
      return { ok: false, meldung: "Zu dieser Adresse gibt es keinen Zugang." };
    }
    return { ok: false, meldung: `Link konnte nicht erzeugt werden: ${m}` };
  }

  const tokenHash = data.properties.hashed_token;
  const link =
    `${args.basisAdresse.replace(/\/+$/, "")}/passwort-setzen` +
    `?token_hash=${encodeURIComponent(tokenHash)}&type=${args.art}`;

  const { betreff, text } = textFuer(args.art, args.name || email, link);

  const ergebnis = await deliver({ to: [email], subject: betreff, body: text }, args.provider);

  if (!ergebnis.ok) {
    // Der Zugang steht trotzdem - nur die Mail kam nicht weg. Den Link
    // zurueckgeben, damit der Admin ihn notfalls selbst weitergeben kann,
    // statt jemanden ohne Zugang stehen zu lassen.
    return {
      ok: false,
      meldung:
        `Der Link wurde erzeugt, konnte aber nicht verschickt werden: ${ergebnis.error ?? "unbekannt"}. ` +
        "Prüfe die SMTP-Werte, oder gib den Link unten persönlich weiter.",
      linkZumWeitergeben: link,
      benutzerId: data.user?.id,
    };
  }

  if (ergebnis.provider === "log") {
    return {
      ok: false,
      meldung:
        "Es ist kein Postausgang eingerichtet (MAIL_PROVIDER steht auf „log“). " +
        "Der Link wurde nur protokolliert – gib ihn unten persönlich weiter.",
      linkZumWeitergeben: link,
      benutzerId: data.user?.id,
    };
  }

  return {
    ok: true,
    meldung: `Mail an ${email} ist unterwegs${
      ergebnis.fellBackFrom ? ` (über SMTP, weil onOffice abgelehnt hat)` : ""
    }.`,
    benutzerId: data.user?.id,
  };
}
