/**
 * Nutzerverwaltung - wer darf ins Tool.
 *
 * Server-Komponente: die Liste kommt mit dem Service-Role-Schluessel,
 * weil auch der Anmeldestatus aus auth.users gebraucht wird. Davor steht
 * die Rollenpruefung.
 */
import Link from "next/link";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";
import { serviceRoleVorhanden, supabaseAdmin } from "@/lib/supabase/admin";
import { EinladenFormular, NutzerTabelle, type NutzerZeile } from "./tabelle";
import type { AppRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Nutzerverwaltung – Aufgabentool" };

export default async function NutzerSeite() {
  const profil = await aktuellesProfil();

  if (!istAdmin(profil)) {
    return (
      <div className="panel p-4" style={{ maxWidth: 520 }}>
        <h1 className="mb-2 text-base font-semibold">Kein Zugriff</h1>
        <p className="muted text-xs leading-relaxed">
          Die Nutzerverwaltung ist Admins vorbehalten.
        </p>
      </div>
    );
  }

  if (!serviceRoleVorhanden()) {
    return (
      <div className="panel p-4" style={{ maxWidth: 560 }}>
        <h1 className="mb-2 text-base font-semibold">Nutzerverwaltung</h1>
        <p className="muted text-xs leading-relaxed">
          Es fehlt der <code>SUPABASE_SERVICE_ROLE_KEY</code>. Ohne ihn lassen sich
          keine Zugänge anlegen, weil Einladen echte Administratorrechte braucht.
          Lokal eintragen mit <code>npm run zugangsdaten supabase</code>, auf Vercel
          unter Settings → Environment Variables.
        </p>
      </div>
    );
  }

  const sb = supabaseAdmin();

  const { data: profile, error } = await sb
    .from("profiles")
    .select("id, email, full_name, role, is_active, onoffice_username, phone, invited_at")
    .order("full_name");

  if (error) {
    return (
      <div className="panel p-4" style={{ borderLeft: "3px solid #dc2626", maxWidth: 560 }}>
        <h1 className="mb-2 text-base font-semibold">Nutzerverwaltung</h1>
        <p className="muted text-xs leading-relaxed">{error.message}</p>
      </div>
    );
  }

  // Wer sich schon einmal angemeldet hat, steckt in auth.users.
  const angemeldet = new Set<string>();
  try {
    const { data: authListe } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const u of authListe?.users ?? []) {
      if (u.last_sign_in_at) angemeldet.add(u.id);
    }
  } catch {
    // Nicht schlimm: dann steht bei allen "eingeladen".
  }

  const nutzer: NutzerZeile[] = (profile ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    role: p.role as AppRole,
    isActive: p.is_active,
    onofficeUsername: p.onoffice_username,
    phone: p.phone,
    invitedAt: p.invited_at,
    hatSichAngemeldet: angemeldet.has(p.id),
  }));

  const offeneEinladungen = nutzer.filter((n) => !n.hatSichAngemeldet && n.isActive).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h1 className="text-lg font-semibold">Nutzerverwaltung</h1>
        <p className="muted text-xs">
          {nutzer.length} {nutzer.length === 1 ? "Zugang" : "Zugänge"}
          {offeneEinladungen ? `, davon ${offeneEinladungen} noch nicht angemeldet` : ""}
        </p>
        <Link href="/admin" className="muted ml-auto text-xs underline">
          Zurück zum Adminbereich
        </Link>
      </div>

      <EinladenFormular darfSuperadmin={profil!.role === "superadmin"} />

      {nutzer.length === 0 ? (
        <div className="muted line rounded-lg border border-dashed px-3 py-8 text-center text-xs">
          Noch keine Zugänge außer deinem.
        </div>
      ) : (
        <NutzerTabelle nutzer={nutzer} eigeneId={profil!.id} eigeneRolle={profil!.role} />
      )}

      <div className="panel mt-4 p-3">
        <h2 className="mb-1.5 text-sm font-semibold">Wie die Anmeldung funktioniert</h2>
        <ul className="muted space-y-1 text-[11px] leading-relaxed">
          <li>
            Beim Einladen erzeugt das Tool <strong>kein Passwort</strong>. Die Person
            bekommt eine Mail mit einem Link, der einmal gilt, und setzt ihr Passwort
            selbst. Niemand – auch du nicht – kann es danach lesen.
          </li>
          <li>
            „Passwort zurücksetzen“ schickt denselben Weg noch einmal. Der alte Zugang
            bleibt gültig, bis das neue Passwort gesetzt ist.
          </li>
          <li>
            „Sperren“ setzt das Profil auf inaktiv <em>und</em> sperrt die Anmeldung.
            Aufgaben und Verlauf der Person bleiben erhalten.
          </li>
          <li>
            Die eigene Rolle und das eigene Konto sind gesperrt – damit sich niemand
            selbst aussperrt. Ein Superadmin kann nur von einem Superadmin geändert
            werden.
          </li>
        </ul>
      </div>
    </div>
  );
}
