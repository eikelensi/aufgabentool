/**
 * Mail-Adapter: onOffice zuerst, SMTP als Rückfallebene, "log" für Trockenläufe.
 *
 * Der Weg steht in den App-Einstellungen (app_settings.mail_provider) und lässt
 * sich per Umgebungsvariable MAIL_PROVIDER überschreiben. Fällt onOffice aus –
 * etwa weil sendmail im Mandanten nicht freigeschaltet ist – wird automatisch
 * SMTP versucht, sofern konfiguriert, und beides im Ergebnis vermerkt.
 */

import { render, type TemplateVars } from "./templates";
import { onofficeMailConfigured, sendViaOnoffice, type SendOutcome } from "./onoffice";
import { sendViaSmtp, smtpConfigured } from "./smtp";

export type MailProvider = "onoffice" | "smtp" | "log";

export interface OutgoingMail {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
}

export interface DeliveryResult extends SendOutcome {
  provider: MailProvider;
  /** Wenn der erste Weg scheiterte und der Fallback griff. */
  fellBackFrom?: MailProvider;
  fallbackError?: string;
}

export function preferredProvider(fromSettings?: MailProvider): MailProvider {
  const env = process.env.MAIL_PROVIDER as MailProvider | undefined;
  const wanted = env ?? fromSettings ?? "onoffice";

  if (wanted === "onoffice" && !onofficeMailConfigured()) {
    return smtpConfigured() ? "smtp" : "log";
  }
  if (wanted === "smtp" && !smtpConfigured()) return "log";
  return wanted;
}

export async function deliver(
  mail: OutgoingMail,
  fromSettings?: MailProvider,
): Promise<DeliveryResult> {
  const provider = preferredProvider(fromSettings);

  if (provider === "log") {
    console.info("[mail:log]", {
      to: mail.to,
      subject: mail.subject,
      bodyPreview: mail.body.slice(0, 200),
    });
    return { ok: true, provider: "log", providerMessageId: "log-only" };
  }

  if (provider === "onoffice") {
    const result = await sendViaOnoffice({ ...mail });
    if (result.ok) return { ...result, provider: "onoffice" };

    // onOffice hat abgelehnt – SMTP versuchen, wenn vorhanden.
    if (smtpConfigured()) {
      const fallback = await sendViaSmtp({ ...mail });
      return {
        ...fallback,
        provider: "smtp",
        fellBackFrom: "onoffice",
        fallbackError: result.error,
      };
    }
    return { ...result, provider: "onoffice" };
  }

  const result = await sendViaSmtp({ ...mail });
  return { ...result, provider: "smtp" };
}

/** Mail aus einer Vorlage bauen und versenden. */
export async function deliverFromTemplate(args: {
  to: string[];
  subject: string;
  body: string;
  vars: TemplateVars;
  provider?: MailProvider;
}): Promise<DeliveryResult> {
  return deliver(
    {
      to: args.to,
      subject: render(args.subject, args.vars),
      body: render(args.body, args.vars),
    },
    args.provider,
  );
}

export { render } from "./templates";
