/**
 * Protokolle: was geaendert wurde, und was verschickt wurde.
 *
 * Das Aenderungsprotokoll schreibt ein Datenbank-Trigger - nicht die
 * Oberflaeche. Dadurch steht auch drin, was der Sync oder ein Zeitplan
 * getan hat, und es laesst sich nicht dadurch umgehen, dass jemand einen
 * anderen Weg in die Datenbank nimmt.
 */
import { supabaseAdmin, serviceRoleVorhanden } from "@/lib/supabase/admin";
import { NOTIFY_LABEL, type NotifyKind } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Protokolle – Aufgabentool" };

const TABELLE_LABEL: Record<string, string> = {
  tasks: "Aufgabe",
  profiles: "Nutzer",
  broker_contacts: "Kollege",
  categories: "Kategorie",
  email_templates: "Mailvorlage",
};

const FELD_LABEL: Record<string, string> = {
  title: "Titel",
  description: "Beschreibung",
  status: "Status",
  priority: "Priorität",
  category_id: "Kategorie",
  assignee_id: "Bearbeiter",
  creator_id: "Verantwortung",
  broker_contact_id: "Maklerkollege",
  is_pool: "Im Pool",
  is_private: "Privat",
  visible_from: "Sichtbar ab",
  due_date: "Fällig",
  in_progress_note: "Notiz",
  email: "E-Mail",
  full_name: "Name",
  role: "Rolle",
  is_active: "Aktiv",
  onoffice_username: "onOffice-Benutzername",
  onoffice_display_name: "Name in onOffice",
  phone: "Telefon",
  extension: "Durchwahl",
  location: "Standort",
  display_name: "Name",
  short_code: "Kürzel",
  profile_id: "Verknüpfter Nutzer",
  name: "Name",
  color: "Farbe",
  sort_order: "Reihenfolge",
  subject: "Betreff",
  body: "Text",
  bezeichnung: "Bezeichnung",
};

function wert(v: unknown): string {
  if (v === null || v === undefined) return "–";
  if (typeof v === "boolean") return v ? "ja" : "nein";
  const s = String(v);
  if (!s.trim()) return "–";
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
}

function Aenderung({ diff }: { diff: Record<string, unknown> | null }) {
  if (!diff || typeof diff !== "object") return <span className="muted">–</span>;
  const eintraege = Object.entries(diff);
  if (!eintraege.length) return <span className="muted">–</span>;

  return (
    <ul className="space-y-0.5">
      {eintraege.slice(0, 6).map(([feld, v]) => {
        const label = FELD_LABEL[feld] ?? feld;
        const paar = v as { vorher?: unknown; nachher?: unknown } | null;
        const istPaar = paar && typeof paar === "object" && "nachher" in paar;
        return (
          <li key={feld} className="text-[11px] leading-snug">
            <span className="font-medium">{label}:</span>{" "}
            {istPaar ? (
              <>
                <span className="muted line-through">{wert(paar!.vorher)}</span>{" "}
                <span aria-hidden>→</span> <span>{wert(paar!.nachher)}</span>
              </>
            ) : (
              <span className="muted">{wert(v)}</span>
            )}
          </li>
        );
      })}
      {eintraege.length > 6 ? (
        <li className="muted text-[11px]">… und {eintraege.length - 6} weitere</li>
      ) : null}
    </ul>
  );
}

function zeit(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ProtokollSeite({
  searchParams,
}: {
  searchParams: Promise<{ zeigt?: string }>;
}) {
  const { zeigt } = await searchParams;
  const mailAnsicht = zeigt === "mails";

  if (!serviceRoleVorhanden()) {
    return (
      <div className="panel p-4" style={{ maxWidth: 560 }}>
        <p className="muted text-xs">Es fehlt der Service-Role-Schlüssel.</p>
      </div>
    );
  }

  const sb = supabaseAdmin();

  const [protokoll, mails] = await Promise.all([
    sb.from("v_protokoll").select("*").limit(200),
    sb
      .from("notifications_log")
      .select("id, kind, recipient, recipient_name, subject, provider, status, created_at, sent_at, error, tasks ( title )")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <a
          className="btn"
          href="/admin/protokoll"
          style={
            !mailAnsicht
              ? { background: "var(--color-ci-400)", color: "#10200a" }
              : undefined
          }
        >
          Änderungen
        </a>
        <a
          className="btn"
          href="/admin/protokoll?zeigt=mails"
          style={
            mailAnsicht ? { background: "var(--color-ci-400)", color: "#10200a" } : undefined
          }
        >
          Verschickte Mails
        </a>
      </div>

      {!mailAnsicht ? (
        <>
          <p className="muted mb-3 max-w-[75ch] text-xs leading-relaxed">
            Wird still mitgeschrieben, von der Datenbank selbst. Auch der
            onOffice-Abgleich und die Zeitpläne stehen hier – sie erscheinen als
            „System“, weil dahinter kein angemeldeter Mensch steht. Die letzten
            200 Einträge.
          </p>

          {protokoll.error ? (
            <div className="panel p-4" style={{ borderLeft: "3px solid #dc2626" }}>
              <p className="muted text-xs">{protokoll.error.message}</p>
            </div>
          ) : !protokoll.data?.length ? (
            <div className="muted line rounded-lg border border-dashed px-3 py-8 text-center text-xs">
              Noch nichts protokolliert.
            </div>
          ) : (
            <div className="panel scroll-x">
              <table className="w-full text-left text-[13px]">
                <thead className="muted text-[11px] uppercase tracking-wide">
                  <tr className="line border-b">
                    <th className="px-3 py-2 font-medium">Wann</th>
                    <th className="px-3 py-2 font-medium">Wer</th>
                    <th className="px-3 py-2 font-medium">Was</th>
                    <th className="px-3 py-2 font-medium">Änderung</th>
                  </tr>
                </thead>
                <tbody>
                  {protokoll.data.map((e) => (
                    <tr key={e.id} className="line border-b last:border-0 align-top">
                      <td className="muted whitespace-nowrap px-3 py-2 text-[11px]">
                        {zeit(e.created_at)}
                      </td>
                      <td className="px-3 py-2 text-[12px]">
                        {e.akteur}
                        {e.quelle === "system" ? (
                          <span className="muted ml-1 text-[10px]">(automatisch)</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-[12px]">
                        {TABELLE_LABEL[e.entity] ?? e.entity} {e.action}
                      </td>
                      <td className="px-3 py-2">
                        <Aenderung diff={e.diff} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="muted mb-3 max-w-[75ch] text-xs leading-relaxed">
            Jede Benachrichtigung, die das Tool verschickt hat. Der Eintrag
            entsteht <em>vor</em> dem Versand und hält den Anlass fest – deshalb
            kann dieselbe Mail nicht zweimal rausgehen.
          </p>

          {!mails.data?.length ? (
            <div className="muted line rounded-lg border border-dashed px-3 py-8 text-center text-xs">
              Noch keine Mail verschickt.
            </div>
          ) : (
            <div className="panel scroll-x">
              <table className="w-full text-left text-[13px]">
                <thead className="muted text-[11px] uppercase tracking-wide">
                  <tr className="line border-b">
                    <th className="px-3 py-2 font-medium">Wann</th>
                    <th className="px-3 py-2 font-medium">Anlass</th>
                    <th className="px-3 py-2 font-medium">Aufgabe</th>
                    <th className="px-3 py-2 font-medium">An</th>
                    <th className="px-3 py-2 font-medium">Weg</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mails.data.map((m) => {
                    const aufgabe = m.tasks as unknown as { title: string } | null;
                    return (
                      <tr key={m.id} className="line border-b last:border-0">
                        <td className="muted whitespace-nowrap px-3 py-2 text-[11px]">
                          {zeit(m.created_at)}
                        </td>
                        <td className="px-3 py-2 text-[12px]">
                          {NOTIFY_LABEL[m.kind as NotifyKind] ?? m.kind}
                        </td>
                        <td className="muted px-3 py-2 text-[12px]">
                          {aufgabe?.title ?? "–"}
                        </td>
                        <td className="muted px-3 py-2 text-[12px]">
                          {m.recipient_name || m.recipient}
                        </td>
                        <td className="muted px-3 py-2 text-[11px]">{m.provider}</td>
                        <td className="px-3 py-2">
                          {m.status === "sent" ? (
                            <span className="chip" style={{ background: "#dcfce7", color: "#15803d" }}>
                              versendet
                            </span>
                          ) : m.status === "failed" ? (
                            <span
                              className="chip"
                              style={{ background: "#fee2e2", color: "#b91c1c" }}
                              title={m.error ?? undefined}
                            >
                              fehlgeschlagen
                            </span>
                          ) : (
                            <span className="chip" style={{ background: "#fef3c7", color: "#b45309" }}>
                              {m.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
