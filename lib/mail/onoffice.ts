/**
 * Mailversand über die onOffice-Schnittstelle.
 *
 * action "do" / resourcetype "sendmail". Pflichtparameter:
 *   emailidentity  – Identität, unter deren Namen gesendet wird. Das Postfach
 *                    muss dem API-Benutzer zugeordnet sein
 *                    (Extras > Einstellungen > Grundeinstellungen > E-Mail).
 *   receiver       – Array aus E-Mail-Adressen oder Adress-IDs
 *   subject        – Betreff (alternativ templateid)
 */

import { call, onofficeConfig } from "@/lib/onoffice/client";

export interface OnofficeSendArgs {
  to: string[];
  subject: string;
  body: string;
  html?: boolean;
  cc?: string[];
  bcc?: string[];
  /** Einzelversand statt einer Mail an alle. */
  separate?: boolean;
}

export interface SendOutcome {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export function onofficeMailConfigured(): boolean {
  return Boolean(
    process.env.ONOFFICE_API_TOKEN &&
      process.env.ONOFFICE_API_SECRET &&
      process.env.ONOFFICE_EMAIL_IDENTITY,
  );
}

export async function sendViaOnoffice(args: OnofficeSendArgs): Promise<SendOutcome> {
  const cfg = onofficeConfig();
  const identity = cfg.emailIdentity;

  if (!identity) {
    return {
      ok: false,
      error:
        "ONOFFICE_EMAIL_IDENTITY ist nicht gesetzt. sendmail verlangt eine Identität, " +
        "deren Postfach dem API-Benutzer zugeordnet ist.",
    };
  }
  if (!args.to.length) return { ok: false, error: "Kein Empfänger." };

  const parameters: Record<string, unknown> = {
    emailidentity: identity,
    receiver: args.to,
    subject: args.subject,
    body: args.body,
  };
  if (args.html) parameters.htmlmail = 1;
  if (args.cc?.length) parameters.cc = args.cc;
  if (args.bcc?.length) parameters.bcc = args.bcc;
  if (args.separate) parameters.separate = 1;

  try {
    const res = await call({ action: "do", resourceType: "sendmail", parameters });
    return { ok: true, providerMessageId: res.message ?? "onoffice-sendmail" };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
