/**
 * "Meine Mails" - was JEDER fuer sich selbst einstellen darf.
 *
 * Nicht alles: die Verwaltung gibt je Mailart frei, ob sie
 * ueberschreibbar ist. Eine Eskalation, die sich jeder abschalten
 * kann, waere keine Eskalation; eine Erinnerung, die niemand
 * abschalten kann, wird zum Rauschen und damit ebenfalls wirkungslos.
 * Deshalb steht hier beides nebeneinander - was man aendern darf, und
 * was fest ist, mitsamt dem Grund.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil } from "@/lib/supabase/profil";
import MeineMails, { type MeineZeile } from "./formular";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meine Mails – Aufgabentool" };

export default async function MeineMailsSeite() {
  const profil = await aktuellesProfil();
  if (!profil) return <p className="muted p-4 text-sm">Nicht angemeldet.</p>;

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("v_mail_regel_je_person")
    .select("kind, art, aktiv, tage_bis, wiederholen_tage, stunde, nutzer_darf_aendern, weicht_ab")
    .eq("profile_id", profil.id);

  const { data: labels } = await sb.from("mail_regeln").select("kind, label, sort_order");
  const nach = new Map((labels ?? []).map((l) => [l.kind, l]));

  const zeilen: MeineZeile[] = (data ?? [])
    .map((r) => ({
      kind: r.kind,
      label: nach.get(r.kind)?.label ?? r.kind,
      art: r.art === "frist" ? ("frist" as const) : ("ereignis" as const),
      aktiv: Boolean(r.aktiv),
      tageBis: r.tage_bis ?? null,
      wiederholenTage: r.wiederholen_tage ?? 0,
      stunde: r.stunde ?? 5,
      darfAendern: Boolean(r.nutzer_darf_aendern),
      weichtAb: Boolean(r.weicht_ab),
      sortOrder: nach.get(r.kind)?.sort_order ?? 0,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return <MeineMails zeilen={zeilen} />;
}
