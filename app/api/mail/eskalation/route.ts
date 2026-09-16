/**
 * Taeglicher Lauf: Erinnerung nach 3 Tagen, Eskalation nach 7.
 *
 * Grundlage sind die Sichten v_faellige_erinnerungen und
 * v_faellige_eskalationen. Die Zeitstempel im Datensatz werden erst nach
 * dem Versand gesetzt - und der Statuswechsel setzt sie ebenfalls, wodurch
 * die Uhr bei einer bearbeiteten Aufgabe von selbst stehenbleibt.
 *
 * Aufrufbar per Zeitplan mit x-api-secret oder CRON_SECRET, und von einem
 * angemeldeten Admin.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";
import {
  datumDeutsch,
  leeresErgebnis,
  sendeBenachrichtigung,
  zaehle,
} from "@/lib/mail/versand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function darfLaufen(request: Request): Promise<boolean> {
  const geheim = process.env.INTERNAL_API_SECRET;
  const kopf = request.headers.get("x-api-secret");
  if (geheim && kopf && kopf === geheim) return true;

  const cron = request.headers.get("authorization");
  if (process.env.CRON_SECRET && cron === `Bearer ${process.env.CRON_SECRET}`) return true;

  return istAdmin(await aktuellesProfil());
}

function tageSeit(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));
}

export async function POST(request: Request) {
  if (!(await darfLaufen(request))) {
    return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });
  }

  const sb = supabaseAdmin();
  const ergebnis = leeresErgebnis();
  let erinnerungen = 0;
  let eskalationen = 0;

  const spalten = `
    id, title, created_at, onoffice_estate_no, onoffice_estate_id,
    creator:profiles!tasks_creator_id_fkey ( full_name, email ),
    bearbeiter:profiles!tasks_assignee_id_fkey ( full_name, email )
  `;

  // ---------------------------------------------------- Erinnerung (3 Tage)
  const { data: faellig, error: f1 } = await sb.from("v_faellige_erinnerungen").select("id");
  if (f1) return NextResponse.json({ fehler: f1.message }, { status: 500 });

  for (const zeile of faellig ?? []) {
    const { data: t } = await sb.from("tasks").select(spalten).eq("id", zeile.id).maybeSingle();
    if (!t) continue;

    const bearbeiter = t.bearbeiter as unknown as { full_name: string; email: string } | null;
    if (!bearbeiter?.email) continue;

    const vars = {
      titel: t.title,
      bearbeiter: bearbeiter.full_name,
      ersteller: (t.creator as unknown as { full_name: string } | null)?.full_name ?? "",
      objekt: t.onoffice_estate_no ?? t.onoffice_estate_id ?? "–",
      tage: String(tageSeit(t.created_at)),
      datum: datumDeutsch(new Date().toISOString()),
      notiz: "",
      faellig: "",
    };

    const ausgang = await sendeBenachrichtigung({
      taskId: t.id,
      kind: "erinnerung_3t",
      empfaenger: { email: bearbeiter.email, name: bearbeiter.full_name },
      dedupeKey: `task:${t.id}:erinnerung_3t`,
      vars,
    });
    zaehle(ergebnis, ausgang, `Erinnerung ${t.id}`);
    if (ausgang === "verschickt") erinnerungen++;

    if (ausgang !== "fehler") {
      await sb
        .from("tasks")
        .update({ reminder_3d_sent_at: new Date().toISOString() })
        .eq("id", t.id);
    }
  }

  // --------------------------------------------------- Eskalation (7 Tage)
  const { data: eskaliert, error: f2 } = await sb.from("v_faellige_eskalationen").select("id");
  if (f2) return NextResponse.json({ fehler: f2.message }, { status: 500 });

  for (const zeile of eskaliert ?? []) {
    const { data: t } = await sb.from("tasks").select(spalten).eq("id", zeile.id).maybeSingle();
    if (!t) continue;

    const bearbeiter = t.bearbeiter as unknown as { full_name: string; email: string } | null;
    const creator = t.creator as unknown as { full_name: string; email: string } | null;

    const vars = {
      titel: t.title,
      bearbeiter: bearbeiter?.full_name ?? "niemand zugewiesen",
      ersteller: creator?.full_name ?? "",
      objekt: t.onoffice_estate_no ?? t.onoffice_estate_id ?? "–",
      tage: String(tageSeit(t.created_at)),
      datum: datumDeutsch(new Date().toISOString()),
      notiz: "",
      faellig: "",
    };

    // Nach 7 Tagen zusaetzlich an den Ersteller beziehungsweise Admin.
    let einerGing = false;
    for (const e of [
      bearbeiter ? { email: bearbeiter.email, name: bearbeiter.full_name, rolle: "bearbeiter" } : null,
      creator ? { email: creator.email, name: creator.full_name, rolle: "ersteller" } : null,
    ]) {
      if (!e?.email) continue;
      const ausgang = await sendeBenachrichtigung({
        taskId: t.id,
        kind: "eskalation_7t",
        empfaenger: { email: e.email, name: e.name },
        dedupeKey: `task:${t.id}:eskalation_7t:${e.rolle}`,
        vars,
      });
      zaehle(ergebnis, ausgang, `Eskalation ${t.id} an ${e.email}`);
      if (ausgang === "verschickt") {
        eskalationen++;
        einerGing = true;
      } else if (ausgang === "uebersprungen") {
        einerGing = true;
      }
    }

    if (einerGing) {
      await sb
        .from("tasks")
        .update({ escalation_7d_sent_at: new Date().toISOString() })
        .eq("id", t.id);
    }
  }

  const meldung =
    `${erinnerungen} Erinnerung(en) und ${eskalationen} Eskalationsmail(s) versendet. ` +
    `${ergebnis.uebersprungen} übersprungen, weil der Anlass schon erledigt war.` +
    (ergebnis.fehler.length ? ` Fehler: ${ergebnis.fehler.slice(0, 5).join("; ")}` : "");

  return NextResponse.json({
    erinnerungen,
    eskalationen,
    uebersprungen: ergebnis.uebersprungen,
    fehler: ergebnis.fehler,
    meldung,
  });
}

export const GET = POST;
