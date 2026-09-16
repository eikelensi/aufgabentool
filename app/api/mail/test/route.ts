/**
 * Mailwege prüfen.
 *
 * GET  – nur SMTP-Verbindung und Anmeldung prüfen, ohne Versand
 * POST { to, provider? } – eine echte Testmail senden
 *
 * Die Testmail geht ausschließlich an die Adresse, die du mitgibst.
 */

import { NextResponse } from "next/server";
import { fail, guard } from "@/lib/api-guard";
import { deliver, preferredProvider, type MailProvider } from "@/lib/mail";
import { onofficeMailConfigured } from "@/lib/mail/onoffice";
import { smtpConfigured, verifySmtp } from "@/lib/mail/smtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const smtp = smtpConfigured() ? await verifySmtp() : { ok: false, error: "nicht konfiguriert" };

  return NextResponse.json({
    ok: true,
    gewaehlterWeg: preferredProvider(),
    onoffice: {
      konfiguriert: onofficeMailConfigured(),
      identitaet: process.env.ONOFFICE_EMAIL_IDENTITY ?? null,
    },
    smtp: {
      konfiguriert: smtpConfigured(),
      host: process.env.SMTP_HOST ?? null,
      port: process.env.SMTP_PORT ?? "587",
      absender: process.env.SMTP_FROM ?? null,
      verbindung: smtp.ok ? "in Ordnung" : smtp.error,
    },
  });
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  try {
    const body = (await request.json()) as { to?: string; provider?: MailProvider };
    if (!body.to) return fail("to ist erforderlich.", 400);

    const result = await deliver(
      {
        to: [body.to],
        subject: "Testmail aus dem Aufgabentool",
        body:
          "Diese Mail bestätigt, dass der Versand funktioniert.\n\n" +
          `Weg: ${body.provider ?? preferredProvider()}\n` +
          `Zeitpunkt: ${new Date().toLocaleString("de-DE")}\n\n` +
          "4wändekanzlei Aufgabentool",
      },
      body.provider,
    );

    return NextResponse.json({
      ok: result.ok,
      weg: result.provider,
      fallbackVon: result.fellBackFrom,
      fallbackFehler: result.fallbackError,
      messageId: result.providerMessageId,
      fehler: result.error,
    });
  } catch (err) {
    return fail(err);
  }
}
