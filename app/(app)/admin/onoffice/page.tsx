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
import { tagsProbe, type ProbeErgebnis } from "@/lib/onoffice/tags-probe";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";
import { STATUS_LABEL } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "onOffice-Eingang – Aufgabentool" };

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  offen: { bg: "var(--neutral-bg)", fg: "var(--neutral-fg)" },
  in_bearbeitung: { bg: "var(--warn-bg)", fg: "var(--warn-fg)" },
  erledigt: { bg: "var(--ok-bg)", fg: "var(--ok-fg)" },
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

/**
 * Die Tag-Probe, direkt auf der Seite.
 *
 * Bewusst ein einfaches GET-Formular: kein Skript im Browser, keine
 * Serveraktion, und vor allem kein Umweg ueber /api - dorthin nimmt die
 * Adresszeile keine Sitzung mit, weil die Middleware /api auslaesst.
 * Hier laeuft alles im Server-Rendern dieser Seite, und die ist
 * angemeldet.
 */
function TagProbe({ wert, ergebnis }: { wert: string; ergebnis: ProbeErgebnis | null }) {
  return (
    <div className="panel mb-4 p-3">
      <form method="get" className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium" htmlFor="tagProbe">
          Tag-Probe
        </label>
        <input
          id="tagProbe"
          name="tagProbe"
          defaultValue={wert}
          placeholder="Aufgabennummer, z. B. 31987"
          className="line w-56 rounded border px-2 py-1 text-[13px]"
        />
        <button type="submit" className="btn text-[13px]">
          Prüfen
        </button>
        <span className="muted text-[11px]">
          Liest nur – probiert vier Wege, ob onOffice das Feld „tags“ herausgibt.
        </span>
      </form>

      {ergebnis ? (
        <div className="mt-3 text-[12px]">
          <p className="mb-2">
            <strong>Aufgabe {ergebnis.taskId}:</strong> {ergebnis.fazit}
          </p>
          <ul className="space-y-1">
            {ergebnis.versuche.map((v) => (
              <li key={v.weg} className="line border-l-2 pl-2">
                <code className="text-[11px]">{v.weg}</code>{" "}
                {v.geklappt ? (
                  <>
                    <span style={{ color: "var(--ok-fg)" }}>gelesen</span>
                    {" – tags: "}
                    <strong>
                      {v.tags === null || v.tags === undefined || v.tags === ""
                        ? "kam nicht mit"
                        : JSON.stringify(v.tags)}
                    </strong>
                    <span className="muted block text-[10px]">
                      Felder: {(v.felder ?? []).join(", ") || "–"}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ color: "var(--err-fg)" }}>abgelehnt</span>
                    <span className="muted block text-[10px]">{v.meldung}</span>
                  </>
                )}
              </li>
            ))}
          </ul>

          <p className="mt-3 mb-1 font-medium">
            Felder in der onOffice-Konfiguration, die nach „Tag“ aussehen:
          </p>
          {ergebnis.feldFehler ? (
            <p className="muted text-[11px]">{ergebnis.feldFehler}</p>
          ) : ergebnis.feldkandidaten.length === 0 ? (
            <p className="muted text-[11px]">
              Keines. Dann kennt die Schnittstelle das Feld nicht – es muss von onOffice
              für die API freigeschaltet werden.
            </p>
          ) : (
            <ul className="space-y-0.5 text-[11px]">
              {ergebnis.feldkandidaten.map((f) => (
                <li key={f.name}>
                  <code>{f.name}</code>
                  <span className="muted">
                    {" – "}
                    {f.label ?? "ohne Beschriftung"}
                    {f.typ ? ` (${f.typ})` : ""}
                    {f.werte?.length ? ` · Werte: ${f.werte.slice(0, 12).join(", ")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default async function OnofficePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  const sp = await searchParams;
  const roh = sp.tagProbe;
  const probeWert = (Array.isArray(roh) ? roh[0] : roh)?.trim() ?? "";

  let probe: ProbeErgebnis | null = null;
  if (probeWert && Number.isFinite(Number(probeWert))) {
    // Noch einmal nachsehen, wer fragt. Die Probe ruft onOffice auf,
    // das soll nicht an der Vermutung haengen, das Layout habe schon
    // geprueft.
    if (istAdmin(await aktuellesProfil())) {
      probe = await tagsProbe(Number(probeWert));
    }
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

      <TagProbe wert={probeWert} ergebnis={probe} />

      {error ? (
        <div
          className="panel p-4"
          style={{ borderLeft: "3px solid var(--err-fg)", maxWidth: 620 }}
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
                            <Chip bg="var(--err-bg)" fg="var(--err-fg)">Hoch</Chip>
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
