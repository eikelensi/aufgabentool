/**
 * onOffice-Eingang: die echten Aufgaben aus dem CRM.
 *
 * Absichtlich eine Server-Komponente – sie ruft den Client direkt auf,
 * ohne Umweg über die HTTP-Route. Damit bleiben Token und Secret auf dem
 * Server und es braucht keinen x-api-secret-Header im Browser.
 *
 * Diese Seite liest nur. Geschrieben wird nach onOffice erst, wenn die
 * Statusabbildung für das Schreiben geprüft ist.
 */

import { onofficeConfigured } from "@/lib/onoffice/client";
import { readTasks, type OnofficeTask } from "@/lib/onoffice/tasks";
import { STATUS_LABEL } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "onOffice-Eingang – Aufgabentool" };

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  offen: { bg: "#e2e8f0", fg: "#475569" },
  in_bearbeitung: { bg: "#fef3c7", fg: "#b45309" },
  erledigt: { bg: "#dcfce7", fg: "#15803d" },
};

function Chip({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span className="chip" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "–";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

export default async function OnofficePage() {
  if (!onofficeConfigured()) {
    return (
      <div className="panel p-4" style={{ maxWidth: 620 }}>
        <h1 className="mb-2 text-lg font-semibold">onOffice-Eingang</h1>
        <p className="muted text-sm leading-relaxed">
          Die Zugangsdaten sind in dieser Umgebung nicht gesetzt. Lokal trägst du sie mit{" "}
          <code>npm run zugangsdaten</code> ein, auf Vercel unter Settings →
          Environment Variables: <code>ONOFFICE_API_TOKEN</code> und{" "}
          <code>ONOFFICE_API_SECRET</code>.
        </p>
      </div>
    );
  }

  let tasks: OnofficeTask[] = [];
  let total: number | undefined;
  let error: string | null = null;
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);

  try {
    const res = await readTasks({ modifiedSince: since, listLimit: 100 });
    tasks = res.tasks;
    total = res.total;
  } catch (err) {
    error = (err as Error).message;
  }

  const byStatus = {
    offen: tasks.filter((t) => t.status === "offen").length,
    in_bearbeitung: tasks.filter((t) => t.status === "in_bearbeitung").length,
    erledigt: tasks.filter((t) => t.status === "erledigt").length,
  };
  const processors = [...new Set(tasks.map((t) => t.processor).filter(Boolean))].sort();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h1 className="text-lg font-semibold">onOffice-Eingang</h1>
        <p className="muted text-xs">
          Echte Aufgaben aus dem CRM, geändert seit {formatDate(since)}. Nur lesend.
        </p>
      </div>

      {error ? (
        <div
          className="panel p-4"
          style={{ borderLeft: "3px solid #dc2626", maxWidth: 620 }}
        >
          <h2 className="mb-1 text-sm font-semibold">Abruf fehlgeschlagen</h2>
          <p className="muted text-xs leading-relaxed">{error}</p>
          <p className="muted mt-2 text-xs">
            Zur Eingrenzung hilft <code>npm run probe</code> – das prüft die Anmeldung
            Schritt für Schritt.
          </p>
        </div>
      ) : (
        <>
          <div className="panel mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 p-3 text-xs">
            <span>
              <strong className="text-sm">{tasks.length}</strong>
              <span className="muted"> geladen{total ? ` von ${total}` : ""}</span>
            </span>
            {(["offen", "in_bearbeitung", "erledigt"] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <Chip bg={STATUS_STYLE[s].bg} fg={STATUS_STYLE[s].fg}>
                  {STATUS_LABEL[s]}
                </Chip>
                <strong>{byStatus[s]}</strong>
              </span>
            ))}
            <span className="muted">
              {processors.length} Bearbeiter: {processors.slice(0, 6).join(", ")}
              {processors.length > 6 ? " …" : ""}
            </span>
          </div>

          {tasks.length === 0 ? (
            <div className="muted line rounded-lg border border-dashed px-3 py-8 text-center text-xs">
              Keine Aufgaben im Zeitraum.
            </div>
          ) : (
            <div className="panel scroll-x">
              <table className="w-full text-left text-[13px]">
                <thead className="muted text-[11px] uppercase tracking-wide">
                  <tr className="line border-b">
                    <th className="px-3 py-2 font-medium">Nr.</th>
                    <th className="px-3 py-2 font-medium">Betreff</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Prio</th>
                    <th className="px-3 py-2 font-medium">Bearbeiter</th>
                    <th className="px-3 py-2 font-medium">Verantwortung</th>
                    <th className="px-3 py-2 font-medium">Fällig</th>
                    <th className="px-3 py-2 font-medium">Dateien</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => {
                    const st = STATUS_STYLE[t.status];
                    return (
                      <tr key={t.id} className="line border-b last:border-0">
                        <td className="muted whitespace-nowrap px-3 py-2 text-[11px]">{t.id}</td>
                        <td className="px-3 py-2">
                          {t.subject}
                          {t.isPrivate ? (
                            <span className="muted ml-1.5 text-[11px]">(privat)</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <Chip bg={st.bg} fg={st.fg}>
                            {STATUS_LABEL[t.status]}
                          </Chip>
                          <span className="muted ml-1.5 text-[10px]">{t.rawStatus}</span>
                        </td>
                        <td className="px-3 py-2">
                          {t.priority === "hoch" ? (
                            <Chip bg="#fee2e2" fg="#b91c1c">Hoch</Chip>
                          ) : (
                            <span className="muted text-[11px]">{t.rawPriority}</span>
                          )}
                        </td>
                        <td className="muted px-3 py-2 text-[12px]">{t.processor || "–"}</td>
                        <td className="muted px-3 py-2 text-[12px]">{t.responsibility || "–"}</td>
                        <td className="muted whitespace-nowrap px-3 py-2 text-[12px]">
                          {formatDate(t.deadline)}
                        </td>
                        <td className="px-3 py-2">
                          <a
                            className="muted text-[11px] underline"
                            href={`/api/onoffice/task-files?taskId=${t.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            prüfen
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="muted mt-3 max-w-[70ch] text-[11px] leading-relaxed">
            Die kleine Zahl neben dem Status ist der Rohwert aus onOffice – so lässt sich
            die Zuordnung im Betrieb gegenprüfen. Der Link in der Spalte „Dateien“ zeigt
            die Dateien des verknüpften Objekts oder Kunden; er verlangt den Header{" "}
            <code>x-api-secret</code>, öffnet also nur mit gesetztem Geheimnis. Anhänge
            der Aufgabe selbst gibt die onOffice-API nicht heraus.
          </p>
        </>
      )}
    </div>
  );
}
