/**
 * Verwaltung, Uebersicht: alle Bereiche in derselben Ordnung wie die
 * Navigation, und oben das, was gerade nicht stimmt.
 *
 * Bewusst keine Bedienelemente - hier wird nichts geaendert, nur
 * gezeigt, wo etwas fehlt und wo man es findet. Und bewusst dieselbe
 * Liste wie die Navigation (bereiche.ts): zwei Aufzaehlungen, die
 * auseinanderlaufen, waren Teil des Problems.
 */
import Link from "next/link";
import { supabaseAdmin, serviceRoleVorhanden } from "@/lib/supabase/admin";
import { onofficeConfigured } from "@/lib/onoffice/client";
import { GRUPPEN } from "./bereiche";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Verwaltung – Aufgabentool" };

/** Was auf einer Seite gerade der Rede wert ist. */
interface Notiz {
  zahl?: string;
  warnung?: string;
}

function Karte({
  href,
  label,
  zweck,
  notiz,
}: {
  href: string;
  label: string;
  zweck: string;
  notiz?: Notiz;
}) {
  return (
    <Link
      href={href}
      className="panel block p-3 transition hover:border-[color:var(--color-ci-400)]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">{label}</span>
        {notiz?.zahl ? <span className="text-base font-semibold">{notiz.zahl}</span> : null}
      </div>
      <p className="muted mt-1 text-[11px] leading-relaxed">{zweck}</p>
      {notiz?.warnung ? (
        <p
          className="mt-2 rounded px-2 py-1 text-[11px] leading-relaxed"
          style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}
        >
          {notiz.warnung}
        </p>
      ) : null}
    </Link>
  );
}

export default async function AdminUebersicht() {
  if (!serviceRoleVorhanden()) {
    return (
      <div className="panel p-4" style={{ maxWidth: 560 }}>
        <p className="muted text-xs leading-relaxed">
          Es fehlt der <code>SUPABASE_SERVICE_ROLE_KEY</code>. Ohne ihn bleibt die Verwaltung
          leer.
        </p>
      </div>
    );
  }

  const sb = supabaseAdmin();
  const zaehle = async (tabelle: string) => {
    const { count } = await sb.from(tabelle).select("*", { count: "exact", head: true });
    return count ?? 0;
  };

  const [nutzer, kollegen, kategorien, vorlagen, eintraege, ohneName, ohneTelefon, cursor] =
    await Promise.all([
      zaehle("profiles"),
      zaehle("broker_contacts"),
      zaehle("categories"),
      zaehle("email_templates"),
      zaehle("audit_log"),
      sb
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .is("onoffice_display_name", null)
        .eq("is_active", true),
      sb
        .from("broker_contacts")
        .select("*", { count: "exact", head: true })
        .is("phone", null)
        .eq("is_active", true),
      sb.from("onoffice_sync_cursor").select("last_run_at").eq("resource", "task").maybeSingle(),
    ]);

  const fehlendeNamen = ohneName.count ?? 0;
  const fehlendeTelefone = ohneTelefon.count ?? 0;
  const letzterLauf = cursor.data?.last_run_at
    ? new Date(cursor.data.last_run_at).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Je Adresse hoechstens eine Notiz - mehr macht die Karte zur Tabelle.
  const notizen: Record<string, Notiz> = {
    "/admin/nutzer": {
      zahl: String(nutzer),
      warnung: fehlendeNamen
        ? `Bei ${fehlendeNamen} ${fehlendeNamen === 1 ? "Person fehlt" : "Personen fehlt"} der onOffice-Name – für sie kommen keine Aufgaben an.`
        : undefined,
    },
    "/admin/kollegen": {
      zahl: String(kollegen),
      warnung: fehlendeTelefone ? `${fehlendeTelefone} ohne Telefonnummer.` : undefined,
    },
    "/admin/kategorien": { zahl: String(kategorien) },
    "/admin/mail/vorlagen": { zahl: String(vorlagen) },
    "/admin/protokoll": { zahl: String(eintraege) },
    "/admin/onoffice": {
      warnung: onofficeConfigured()
        ? undefined
        : "Die onOffice-Zugangsdaten sind in dieser Umgebung nicht gesetzt.",
    },
    "/admin/onoffice/eingang": {
      warnung: letzterLauf ? undefined : "Es lief noch kein Abgleich.",
    },
  };

  const warnungen = Object.entries(notizen).filter(([, n]) => n.warnung);

  return (
    <div className="flex flex-col gap-5">
      {/* Was nicht stimmt, steht oben - sonst findet man es nur, wenn
          man ohnehin schon in der richtigen Gruppe sucht. */}
      {warnungen.length ? (
        <section
          className="line rounded-lg border p-3"
          style={{ borderLeft: "3px solid var(--warn-fg)" }}
        >
          <h2 className="mb-1.5 text-[13px] font-semibold">Braucht Aufmerksamkeit</h2>
          <ul className="space-y-1 text-[12px]">
            {warnungen.map(([href, n]) => (
              <li key={href}>
                <Link href={href} className="underline" style={{ color: "var(--color-ci-500)" }}>
                  {GRUPPEN.flatMap((g) => g.seiten).find((s) => s.href === href)?.label ?? href}
                </Link>{" "}
                <span className="muted">— {n.warnung}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="muted text-[12px]">
          Alles in Ordnung
          {letzterLauf ? ` – letzter Abgleich mit onOffice: ${letzterLauf}.` : "."}
        </p>
      )}

      {GRUPPEN.map((g) => (
        <section key={g.schluessel}>
          <h2 className="muted mb-2 text-[11px] font-semibold uppercase tracking-wide">
            {g.label}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.seiten.map((s) => (
              <Karte
                key={s.href}
                href={s.href}
                label={s.label}
                zweck={s.zweck}
                notiz={notizen[s.href]}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
