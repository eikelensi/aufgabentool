/**
 * Mitarbeiterverwaltung - die zuordenbaren Kollegen.
 *
 * Getrennt von der Nutzerverwaltung: hier stehen Menschen, die einer
 * Aufgabe zugeordnet und bei Erledigung benachrichtigt werden. Einen
 * Zugang zum Tool braucht dafuer niemand. Wer beides ist, wird ueber das
 * Feld "Gehoert zu einem Nutzer" verknuepft.
 */
import Link from "next/link";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";
import { serviceRoleVorhanden, supabaseAdmin } from "@/lib/supabase/admin";
import { KollegenBereich, type KollegeZeile, type NutzerOption } from "./tabelle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Mitarbeiterverwaltung – Aufgabentool" };

export default async function KollegenSeite() {
  const profil = await aktuellesProfil();

  if (!istAdmin(profil)) {
    return (
      <div className="panel p-4" style={{ maxWidth: 520 }}>
        <h1 className="mb-2 text-base font-semibold">Kein Zugriff</h1>
        <p className="muted text-xs leading-relaxed">
          Die Mitarbeiterverwaltung ist Admins vorbehalten.
        </p>
      </div>
    );
  }

  if (!serviceRoleVorhanden()) {
    return (
      <div className="panel p-4" style={{ maxWidth: 560 }}>
        <h1 className="mb-2 text-base font-semibold">Mitarbeiterverwaltung</h1>
        <p className="muted text-xs leading-relaxed">
          Es fehlt der <code>SUPABASE_SERVICE_ROLE_KEY</code>. Lokal eintragen mit{" "}
          <code>npm run zugangsdaten supabase</code>, auf Vercel unter Settings →
          Environment Variables.
        </p>
      </div>
    );
  }

  const sb = supabaseAdmin();

  const [kollegenRes, nutzerRes, aufgabenRes, namenRes] = await Promise.all([
    sb
      .from("broker_contacts")
      .select(
        "id, display_name, short_code, email, phone, extension, location, onoffice_user_id, profile_id, sync_source, is_active",
      )
      .order("is_active", { ascending: false })
      .order("display_name"),
    sb.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
    sb.from("tasks").select("broker_contact_id").not("broker_contact_id", "is", null),
    sb.from("v_unbekannte_onoffice_namen").select("name").limit(30),
  ]);

  if (kollegenRes.error) {
    return (
      <div className="panel p-4" style={{ borderLeft: "3px solid var(--err-fg)", maxWidth: 560 }}>
        <h1 className="mb-2 text-base font-semibold">Mitarbeiterverwaltung</h1>
        <p className="muted text-xs leading-relaxed">{kollegenRes.error.message}</p>
      </div>
    );
  }

  const proKollege = new Map<string, number>();
  for (const t of aufgabenRes.data ?? []) {
    const id = t.broker_contact_id as string;
    proKollege.set(id, (proKollege.get(id) ?? 0) + 1);
  }

  const kollegen: KollegeZeile[] = (kollegenRes.data ?? []).map((k) => ({
    id: k.id,
    displayName: k.display_name,
    shortCode: k.short_code,
    email: k.email,
    phone: k.phone,
    extension: k.extension,
    location: k.location,
    onofficeUserId: k.onoffice_user_id,
    profileId: k.profile_id,
    syncSource: k.sync_source,
    isActive: k.is_active,
    aufgaben: proKollege.get(k.id) ?? 0,
  }));

  const nutzer: NutzerOption[] = (nutzerRes.data ?? []).map((n) => ({
    id: n.id,
    fullName: n.full_name,
    email: n.email,
  }));

  const unbekannteNamen = (namenRes.data ?? []).map((n) => n.name as string);

  const aktive = kollegen.filter((k) => k.isActive).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h1 className="text-lg font-semibold">Mitarbeiterverwaltung</h1>
        <p className="muted text-xs">
          {aktive} {aktive === 1 ? "Kollege" : "Kollegen"} auswählbar
          {kollegen.length > aktive ? `, ${kollegen.length - aktive} ausgeblendet` : ""}
        </p>
        <Link href="/admin/nutzer" className="muted ml-auto text-xs underline">
          Zur Nutzerverwaltung
        </Link>
        <Link href="/admin" className="muted text-xs underline">
          Adminbereich
        </Link>
      </div>

      <p className="muted mb-4 max-w-[75ch] text-xs leading-relaxed">
        Diese Liste speist die Auswahl „zugeordneter Kollege“ an einer
        Aufgabe. Wer hier steht, bekommt die Mail, wenn eine Aufgabe auf „In
        Bearbeitung“ geht oder erledigt wird – ein Zugang zum Tool ist dafür
        nicht nötig. Zugänge verwaltest du nebenan.
      </p>

      <KollegenBereich
        kollegen={kollegen}
        nutzer={nutzer}
        unbekannteNamen={unbekannteNamen}
      />
    </div>
  );
}
