/**
 * SMTP-Versand über ein eigenes Postfach (4-wk.de).
 *
 * Umgebungsvariablen:
 *   SMTP_HOST, SMTP_PORT (465 = SSL, 587 = STARTTLS),
 *   SMTP_USER, SMTP_PASS, SMTP_FROM ("Aufgabentool <aufgaben@4-wk.de>")
 *
 * Das Passwort steht nur in der Umgebung, nie im Code oder in der Datenbank.
 */

import nodemailer, { type Transporter } from "nodemailer";
import { textToHtml } from "./templates";
import type { SendOutcome } from "./onoffice";

export interface SmtpSendArgs {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  replyTo?: string;
}

let cached: Transporter | null = null;

export function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM,
  );
}

export function smtpTransport(): Transporter {
  if (cached) return cached;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP_HOST, SMTP_USER und SMTP_PASS müssen gesetzt sein.");
  }

  const port = Number(process.env.SMTP_PORT ?? 587);

  cached = nodemailer.createTransport({
    host,
    port,
    // 465 spricht direkt TLS, 587 handelt per STARTTLS hoch.
    secure: port === 465,
    auth: { user, pass },
    requireTLS: port !== 465,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return cached;
}

export async function sendViaSmtp(args: SmtpSendArgs): Promise<SendOutcome> {
  if (!args.to.length) return { ok: false, error: "Kein Empfänger." };

  try {
    const info = await smtpTransport().sendMail({
      from: process.env.SMTP_FROM,
      to: args.to,
      cc: args.cc?.length ? args.cc : undefined,
      replyTo: args.replyTo,
      subject: args.subject,
      text: args.body,
      html: textToHtml(args.body),
    });

    return { ok: true, providerMessageId: info.messageId };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Verbindung und Anmeldung prüfen, ohne eine Mail zu senden. */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  try {
    await smtpTransport().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
