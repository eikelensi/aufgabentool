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

export const dynamic = "force-dynamic";
export const metadata = { title: "Versandregeln – Aufgabentool" };

export default async function RegelSeite() {
  if (!serviceRoleVorhanden() || !istAdmin(await aktuellesProfil())) {
    return <p className="muted p-4 text-sm">Dieser Bereich ist Admins vorbehalten.</p>;
  }

  const sb = supabaseAdmin();
  const [{ data: regeln }, { data: abweichungen }] = await Promise.all([
    sb
      .from("mail_regeln")
      .select("kind, label, art, aktiv, tage_bis, wiederholen_tage, stunde, nutzer_darf_aendern")
      .order("sort_order"),
    // Wer weicht ab? Nur zum Anzeigen - geaendert wird das von der
    // Person selbst. Eine Zahl daneben beantwortet die Frage "wirkt
    // meine Vorgabe ueberhaupt", bevor sie jemand stellt.
    sb.from("mail_einstellungen").select("kind, profile_id"),
  ]);

  const zeilen: RegelZeile[] = (regeln ?? []).map((r) => ({
    kind: r.kind,
    label: r.label,
    art: r.art === "frist" ? "frist" : "ereignis",
    aktiv: Boolean(r.aktiv),
    tageBis: r.tage_bis ?? null,
    wiederholenTage: r.wiederholen_tage ?? 0,
    stunde: r.stunde ?? 5,
    nutzerDarfAendern: Boolean(r.nutzer_darf_aendern),
    abweichend: (abweichungen ?? []).filter((a) => a.kind === r.kind).length,
  }));

  return (
    <>
      <Seitenkopf
        titel="Versandregeln"
        text="Welche Mail wann und wie oft rausgeht – und welche davon jeder für sich selbst umstellen darf. Die Texte stehen nebenan unter „Vorlagen“."
      />
      <RegelTabelle zeilen={zeilen} />
    </>
  );
}
