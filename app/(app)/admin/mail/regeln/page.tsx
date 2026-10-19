/**
 * Wann, wie oft und ob ueberhaupt - die Hausregel je Mailart.
 *
 * Vorher verteilt auf drei Orte: zwei Zahlen unter "Fristen und Pool",
 * die Uhrzeit im Zeitplan bei Vercel, und das OB gar nirgends. Wer
 * eine Mailart loswerden wollte, musste ihre Vorlage abschalten - und
 * verlor damit auch den Text.
 */
import { supabaseAdmin, serviceRoleVorhanden } from "@/lib/supabase/admin";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";
import Seitenkopf from "../../seitenkopf";
import RegelTabelle, { type RegelZeile } from "./tabelle";
import Ausnahmen, { type AusnahmePerson, type AusnahmeSpalte } from "./ausnahmen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Versandregeln – Aufgabentool" };

export default async function RegelSeite() {
  if (!serviceRoleVorhanden() || !istAdmin(await aktuellesProfil())) {
    return <p className="muted p-4 text-sm">Dieser Bereich ist Admins vorbehalten.</p>;
  }

  const sb = supabaseAdmin();
  const [{ data: regeln }, { data: abweichungen }, { data: profile }, { data: makler }] =
    await Promise.all([
      sb
        .from("mail_regeln")
        .select("kind, label, art, aktiv, tage_bis, wiederholen_tage, stunde, nutzer_darf_aendern")
        .order("sort_order"),
      // Wer ist abgeschaltet? Das stellt seit den Ausnahmen je
      // Mitarbeiter allein der Admin ein, unten auf dieser Seite.
      sb.from("mail_einstellungen").select("kind, profile_id, aktiv"),
      sb.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
      sb.from("broker_contacts").select("profile_id").not("profile_id", "is", null),
    ]);

  const aus = (abweichungen ?? []).filter((a) => a.aktiv === false);
  const istMakler = new Set((makler ?? []).map((m) => m.profile_id as string));

  // Die Pool-Meldung geht an eine feste Adresse, nicht an eine Person -
  // sie hat in den Ausnahmen keinen Platz.
  const spalten: AusnahmeSpalte[] = (regeln ?? [])
    .filter((r) => r.kind !== "aufgabe_in_pool")
    .map((r) => ({ kind: r.kind, label: r.label, hausAus: !r.aktiv }));

  const personen: AusnahmePerson[] = (profile ?? []).map((p) => ({
    id: p.id,
    name: p.full_name ?? "ohne Namen",
    aus: aus.filter((a) => a.profile_id === p.id).map((a) => a.kind),
    nichtZutreffend: istMakler.has(p.id) ? [] : ["aufgabe_erledigt_makler"],
  }));

  const zeilen: RegelZeile[] = (regeln ?? []).map((r) => ({
    kind: r.kind,
    label: r.label,
    art: r.art === "frist" ? "frist" : "ereignis",
    aktiv: Boolean(r.aktiv),
    tageBis: r.tage_bis ?? null,
    wiederholenTage: r.wiederholen_tage ?? 0,
    stunde: r.stunde ?? 5,
    nutzerDarfAendern: Boolean(r.nutzer_darf_aendern),
    abweichend: aus.filter((a) => a.kind === r.kind).length,
  }));

  return (
    <>
      <Seitenkopf
        titel="Versandregeln"
        text="Welche Mail wann und wie oft rausgeht – und bei wem einzeln nicht. Die Texte stehen nebenan unter „Vorlagen“."
      />
      <RegelTabelle zeilen={zeilen} />
      <Ausnahmen spalten={spalten} personen={personen} />
    </>
  );
}
