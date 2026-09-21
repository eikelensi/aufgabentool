/**
 * Verbindungstest zur onOffice-API.
 *
 * Aufruf (Token bleibt bei dir, ich sehe nur das Ergebnis):
 *   curl -s -H "x-api-secret: $INTERNAL_API_SECRET" \
 *     "https://<deine-domain>/api/onoffice/probe" | jq
 *
 * Optional eine echte Aufgaben-ID mitgeben, um den Datei-Lesecall zu testen:
 *   ...?taskId=12345
 *
 * Der Bericht enthält bewusst keine Zugangsdaten, nur Befunde:
 * welche Calls funktionieren, welche Status- und Prio-Werte im Mandanten
 * wirklich vorkommen, ob sendmail freigeschaltet ist und ob sich die Dateien
 * einer Aufgabe lesen lassen.
 */

import { NextResponse } from "next/server";
import { fail, guard } from "@/lib/api-guard";
import { onofficeConfigured, tryCall } from "@/lib/onoffice/client";
import { readTasks } from "@/lib/onoffice/tasks";
import { readUsers } from "@/lib/onoffice/users";
import { readTaskFilesExperimental } from "@/lib/onoffice/files";
import { onofficeMailConfigured } from "@/lib/mail/onoffice";
import { smtpConfigured, verifySmtp } from "@/lib/mail/smtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Step {
  name: string;
  ok: boolean;
  detail?: string;
  data?: unknown;
}

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const url = new URL(request.url);
  const taskIdParam = url.searchParams.get("taskId");

  const steps: Step[] = [];

  steps.push({
    name: "Konfiguration",
    ok: onofficeConfigured(),
    detail: onofficeConfigured()
      ? "Token und Secret sind gesetzt."
      : "ONOFFICE_API_TOKEN oder ONOFFICE_API_SECRET fehlt.",
  });

  if (!onofficeConfigured()) {
    return NextResponse.json({ ok: false, steps }, { status: 200 });
  }

  try {
    // 1) Aufgaben lesen und die echten Status-/Prio-Werte einsammeln.
    let firstTaskId = taskIdParam ?? undefined;
    try {
      const { tasks, total } = await readTasks({ listLimit: 50 });
      const statusValues = [...new Set(tasks.map((t) => t.rawStatus))].sort();
      const prioValues = [...new Set(tasks.map((t) => t.rawPriority))].sort();
      const processors = [...new Set(tasks.map((t) => t.processor).filter(Boolean))].sort();

      firstTaskId = firstTaskId ?? tasks[0]?.id;

      steps.push({
        name: "Aufgaben lesen (resourcetype task)",
        ok: true,
        detail: `${tasks.length} von ${total ?? "?"} gelesen.`,
        data: {
          vorkommendeStatusWerte: statusValues,
          vorkommendePrioWerte: prioValues,
          bearbeiter: processors,
          beispiel: tasks[0]
            ? {
                id: tasks[0].id,
                betreff: tasks[0].subject,
                rawStatus: tasks[0].rawStatus,
                gemappt: tasks[0].status,
                bearbeiter: tasks[0].processor,
                deadline: tasks[0].deadline,
              }
            : null,
        },
      });
    } catch (err) {
      steps.push({
        name: "Aufgaben lesen (resourcetype task)",
        ok: false,
        detail: (err as Error).message,
      });
    }

    // 2) Benutzerliste – Quelle für die Kollegen.
    try {
      const { users, resourceUsed } = await readUsers();
      steps.push({
        name: "Benutzerliste lesen",
        ok: true,
        detail: `${users.length} Benutzer mit E-Mail über resourcetype "${resourceUsed}".`,
        data: users.slice(0, 5).map((u) => ({ name: u.displayName, email: u.email })),
      });
    } catch (err) {
      steps.push({ name: "Benutzerliste lesen", ok: false, detail: (err as Error).message });
    }

    // 3) Objekt lesen – prüft Leserechte im Objektmodul.
    {
      const res = await tryCall({
        action: "read",
        resourceType: "estate",
        parameters: { data: ["Id", "objektnr_extern", "objekttitel"], listlimit: 1 },
      });
      steps.push({
        name: "Objekte lesen (resourcetype estate)",
        ok: res.ok,
        detail: res.ok ? "Zugriff vorhanden." : res.error.message,
      });
    }

    // 4) Der entscheidende Test: Dateien einer Aufgabe lesen.
    if (firstTaskId) {
      const filesProbe = await readTaskFilesExperimental(firstTaskId);
      steps.push({
        name: "Aufgaben-Dateien lesen (undokumentiert)",
        ok: filesProbe.worked,
        detail: filesProbe.worked
          ? `Funktioniert über "${filesProbe.variant}" – ${filesProbe.files.length} Datei(en) an Aufgabe ${firstTaskId}. Damit ist der Rückweg von onOffice möglich.`
          : "Kein Erfolg. Damit bleibt es bei der einseitigen Spiegelung ins CRM.",
        data: filesProbe.worked
          ? filesProbe.files.map((f) => ({ fileId: f.fileId, name: f.fileName, bytes: f.sizeBytes }))
          : filesProbe.attempts,
      });
    } else {
      steps.push({
        name: "Aufgaben-Dateien lesen (undokumentiert)",
        ok: false,
        detail:
          "Keine Aufgaben-ID vorhanden. Bitte einmal mit ?taskId=<Nr einer Aufgabe mit Anhang> aufrufen.",
      });
    }

    // 5) Mailwege.
    steps.push({
      name: "onOffice-Mailversand konfiguriert",
      ok: onofficeMailConfigured(),
      detail: onofficeMailConfigured()
        ? `Identität gesetzt: ${process.env.ONOFFICE_EMAIL_IDENTITY}. Ob das Postfach dem API-Benutzer zugeordnet ist, zeigt erst ein echter Versand über /api/mail/test.`
        : "ONOFFICE_EMAIL_IDENTITY fehlt – sendmail wäre nicht nutzbar.",
    });

    if (smtpConfigured()) {
      const smtp = await verifySmtp();
      steps.push({
        name: "SMTP-Verbindung",
        ok: smtp.ok,
        detail: smtp.ok ? "Verbindung und Anmeldung in Ordnung." : smtp.error,
      });
    } else {
      steps.push({
        name: "SMTP-Verbindung",
        ok: false,
        detail: "SMTP_HOST, SMTP_USER, SMTP_PASS oder SMTP_FROM fehlt.",
      });
    }

    return NextResponse.json({
      ok: steps.every((s) => s.ok),
      hinweis:
        "Dieser Bericht enthält keine Zugangsdaten. Er kann unbesorgt weitergegeben werden.",
      steps,
    });
  } catch (err) {
    return fail(err);
  }
}
