/**
 * Die onOffice-Anbindung an einer Stelle.
 *
 * Vorher lag das verstreut: der Schalter fuers Rueckschreiben und der
 * gemessene Zustand der Schnittstelle unter "Einstellungen", der
 * Aufgaben-Eingang unter "onOffice", die Tag-Probe irgendwo dazwischen.
 * Wer wissen wollte, warum etwas nicht ankommt, suchte an drei Orten.
 *
 * Jetzt: hier steht, WAS die Schnittstelle kann und was sie darf. Die
 * Aufgaben aus dem CRM stehen nebenan unter "Aufgaben-Eingang".
 */
import { serviceRoleVorhanden, supabaseAdmin } from "@/lib/supabase/admin";
import { onofficeConfigured } from "@/lib/onoffice/client";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";
import { tagsProbe, type ProbeErgebnis } from "@/lib/onoffice/tags-probe";
import Seitenkopf from "../seitenkopf";
import { ladeAnbindung } from "./anbindung";
import Rueckschreiben from "./rueckschreiben";
import Adressausschluss from "./adressausschluss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = { title: "onOffice-Anbindung – Aufgabentool" };

function StatusRow({
  label,
  state,
  note,
}: {
  label: string;
  state: "bereit" | "offen" | "prüfen" | "nicht möglich";
  note: string;
}) {
  const style =
    state === "bereit"
      ? { background: "var(--ok-bg)", color: "var(--ok-fg)" }
      : state === "prüfen"
        ? { background: "var(--warn-bg)", color: "var(--warn-fg)" }
        : state === "nicht möglich"
          ? // Grau, nicht rot: hier fehlt nichts, was noch kommen könnte.
            { background: "var(--panel-2)", color: "var(--muted)" }
          : { background: "var(--err-bg)", color: "var(--err-fg)" };

  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="chip" style={style}>
        {state}
      </span>
      <span>{label}</span>
      <span className="muted text-[11px]">— {note}</span>
    </li>
  );
}

/**
 * Die Tag-Probe.
 *
 * Bewusst ein einfaches GET-Formular auf dieser Seite und kein Aufruf
 * nach /api: dorthin nimmt die Adresszeile keine Sitzung mit, weil die
 * Middleware /api auslaesst. Hier laeuft alles im Server-Rendern der
 * Seite, und die ist angemeldet.
 */
function TagProbe({ wert, ergebnis }: { wert: string; ergebnis: ProbeErgebnis | null }) {
  return (
    <section className="panel p-4">
      <h3 className="mb-1 text-sm font-semibold">Feld „Tags“ prüfen</h3>
      <p className="muted mb-3 text-[11px] leading-relaxed">
        Der Tag an der onOffice-Aufgabe soll „Auftrag von“ füllen. Kommt er nicht an, sagt
        diese Probe, woran es liegt: sie geht vier Lesewege durch und zeigt außerdem, wie
        das Feld in eurer Feldkonfiguration wirklich heißt. Sie liest nur.
      </p>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          name="tagProbe"
          defaultValue={wert}
          placeholder="Aufgabennummer, z. B. 31987"
          className="field"
          style={{ maxWidth: 240 }}
          aria-label="Aufgabennummer für die Tag-Probe"
        />
        <button type="submit" className="btn">
          Prüfen
        </button>
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

          <p className="mb-1 mt-3 font-medium">
            Felder in der onOffice-Konfiguration, die nach „Tag“ aussehen:
          </p>
          {ergebnis.feldFehler ? (
            <p className="muted text-[11px]">{ergebnis.feldFehler}</p>
          ) : ergebnis.feldkandidaten.length === 0 ? (
            <p className="muted text-[11px]">
              Keines. Dann kennt die Schnittstelle das Feld nicht – es muss von onOffice für
              die API freigeschaltet werden.
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
    </section>
  );
}

export default async function OnofficeAnbindung({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!serviceRoleVorhanden()) {
    return (
      <div className="panel p-4" style={{ maxWidth: 560 }}>
        <p className="muted text-xs">Es fehlt der Service-Role-Schlüssel.</p>
      </div>
    );
  }

  const sp = await searchParams;
  const roh = sp.tagProbe;
  const probeWert = (Array.isArray(roh) ? roh[0] : roh)?.trim() ?? "";

  let probe: ProbeErgebnis | null = null;
  if (probeWert && Number.isFinite(Number(probeWert)) && onofficeConfigured()) {
    // Noch einmal nachsehen, wer fragt: die Probe ruft onOffice auf,
    // das soll nicht an der Vermutung haengen, das Layout habe schon
    // geprueft.
    if (istAdmin(await aktuellesProfil())) probe = await tagsProbe(Number(probeWert));
  }

  const sb = supabaseAdmin();
  const [anbindung, { data: schalter }] = await Promise.all([
    ladeAnbindung(),
    sb
      .from("app_settings")
      .select(
        "sync_read_only, sync_push_assignee, sync_push_status, sync_push_inhalt, sync_push_neu, sync_asana_onoffice",
      )
      .maybeSingle(),
  ]);

  return (
    <>
      <Seitenkopf
        titel="Anbindung"
        text="Was die Schnittstelle dieses Mandanten wirklich kann, was das Tool zurückschreiben darf – und die Eigenheiten, die sonst niemand erklärt."
      />

      {/* Steht ganz oben: es ist die folgenreichste Einstellung des Bereichs. */}
      <Rueckschreiben
        stand={{
          // Im Zweifel gesperrt anzeigen - so wie die Sperre selbst
          // im Zweifel sperrt.
          nurLesen: schalter?.sync_read_only !== false,
          bearbeiter: schalter?.sync_push_assignee === true,
          status: schalter?.sync_push_status === true,
          inhalt: schalter?.sync_push_inhalt === true,
          anlegen: schalter?.sync_push_neu === true,
          asana: schalter?.sync_asana_onoffice === true,
        }}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h3 className="mb-1 text-sm font-semibold">Was die Schnittstelle kann</h3>
          <p className="muted mb-3 text-[11px] leading-relaxed">
            Kein Wunschzettel, sondern der gemessene Zustand. Was hier rot steht, hat die
            Schnittstelle dieses Mandanten tatsächlich abgelehnt.
          </p>
          <ul className="space-y-1.5 text-xs">
            {anbindung.zeilen.map((z) => (
              <StatusRow key={z.label} label={z.label} state={z.zustand} note={z.hinweis} />
            ))}
          </ul>

          <div className="line mt-3 border-t pt-3 text-[11px]">
            <p className="mb-1 font-semibold">Status onOffice ↔ Aufgabentool</p>
            <p className="muted leading-relaxed">
              Links der Wert aus onOffice, rechts unserer: „Nicht begonnen“ →{" "}
              <strong>Offen</strong> · „In Bearbeitung“ → <strong>Rückfragen offen</strong> ·
              „Erledigt“ → <strong>Erledigt</strong> · „Zurückgestellt“ → <strong>Offen</strong>{" "}
              (der Begriff entfällt bei uns, die Aufgabe bleibt sichtbar).
            </p>
          </div>
        </section>

        <Adressausschluss />

        <div className="lg:col-span-2">
          <TagProbe wert={probeWert} ergebnis={probe} />
        </div>
      </div>
    </>
  );
}
