"use server";

/**
 * Serveraktionen der Mitarbeiterverwaltung - die Liste der zuordenbaren
 * Kollegen.
 *
 * Getrennt von der Nutzerverwaltung, aber verknuepfbar: ein Kollege kann
 * auf einen Tool-Nutzer zeigen, damit dieselbe Person nicht zweimal
 * gepflegt wird und die beiden Eintraege nicht auseinanderlaufen.
 *
 * Wie bei den Nutzern prueft jede Aktion selbst auf Adminrechte -
 * Serveraktionen sind eigene Endpunkte und direkt aufrufbar.
 */

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verlangeAdmin } from "@/lib/supabase/profil";
import { readUsers } from "@/lib/onoffice/users";
import { onofficeConfigured } from "@/lib/onoffice/client";

export interface Ergebnis {
  ok: boolean;
  meldung: string;
}

function text(formData: FormData, feld: string): string {
  return String(formData.get(feld) ?? "").trim();
}

/** Aus "vorname.nachname@..." ein brauchbares "Nachname, Vorname" bauen. */
function nameAusMail(email: string): string {
  const lokal = email.split("@")[0] ?? email;
  const teile = lokal.split(/[._-]+/).filter(Boolean);
  const gross = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  if (teile.length >= 2) return `${gross(teile[teile.length - 1])}, ${gross(teile[0])}`;
  return gross(lokal);
}

export async function kollegeSpeichern(formData: FormData): Promise<Ergebnis> {
  try {
    await verlangeAdmin();
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }

  const id = text(formData, "id");
  const displayName = text(formData, "display_name");
  const email = text(formData, "email").toLowerCase();

  if (!displayName) return { ok: false, meldung: "Bitte den Namen angeben." };
  if (!email.includes("@")) return { ok: false, meldung: "Bitte eine gültige Mailadresse angeben." };

  const zeile = {
    display_name: displayName,
    email,
    short_code: text(formData, "short_code") || null,
    onoffice_tag: text(formData, "onoffice_tag") || null,
    phone: text(formData, "phone") || null,
    extension: text(formData, "extension") || null,
    location: text(formData, "location") || null,
    onoffice_user_id: text(formData, "onoffice_user_id") || null,
    profile_id: text(formData, "profile_id") || null,
    // Von Hand angefasst heisst: der Abgleich laesst diesen Satz in Ruhe.
    sync_source: "manuell",
  };

  const sb = supabaseAdmin();
  const { error } = id
    ? await sb.from("broker_contacts").update(zeile).eq("id", id)
    : await sb.from("broker_contacts").insert(zeile);

  if (error) {
    if (/broker_contacts_email_idx|duplicate key/i.test(error.message)) {
      return {
        ok: false,
        meldung: `${email} steht schon in der Liste. Eine Mailadresse gehört zu genau einem Kollegen.`,
      };
    }
    return { ok: false, meldung: error.message };
  }

  revalidatePath("/admin/kollegen");
  return { ok: true, meldung: id ? "Gespeichert." : `${displayName} angelegt.` };
}

export async function kollegeAktivSetzen(id: string, aktiv: boolean): Promise<Ergebnis> {
  try {
    await verlangeAdmin();
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("broker_contacts").update({ is_active: aktiv }).eq("id", id);
  if (error) return { ok: false, meldung: error.message };

  revalidatePath("/admin/kollegen");
  return {
    ok: true,
    meldung: aktiv
      ? "Wieder auswählbar."
      : "Ausgeblendet. Bestehende Zuordnungen bleiben erhalten.",
  };
}

export async function kollegeEntfernen(id: string): Promise<Ergebnis> {
  try {
    await verlangeAdmin();
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }

  const sb = supabaseAdmin();

  // An einer Aufgabe haengende Kollegen nicht loeschen - sonst verliert die
  // Aufgabe ihre Zuordnung. Solche werden nur ausgeblendet.
  const { count } = await sb
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("broker_contact_id", id);

  if (count && count > 0) {
    await sb.from("broker_contacts").update({ is_active: false }).eq("id", id);
    revalidatePath("/admin/kollegen");
    return {
      ok: true,
      meldung: `Dieser Kollege hängt an ${count} Aufgabe(n) und wurde deshalb nur ausgeblendet, nicht gelöscht.`,
    };
  }

  const { error } = await sb.from("broker_contacts").delete().eq("id", id);
  if (error) return { ok: false, meldung: error.message };

  revalidatePath("/admin/kollegen");
  return { ok: true, meldung: "Gelöscht." };
}

/**
 * Die Mailadressen aus der onOffice-Benutzerliste uebernehmen.
 *
 * Mehr als Mailadressen gibt dieser Mandant nicht her - Vorname, Nachname,
 * Kuerzel, Telefon und Standort kommen alle leer zurueck, gemessen mit
 * npm run kollegen. Der Name wird deshalb aus der Mailadresse geraten und
 * muss von Hand nachgezogen werden.
 *
 * Bestehende Eintraege werden NICHT ueberschrieben: was einmal von Hand
 * gepflegt wurde, bleibt.
 */
export async function ausOnofficeHolen(): Promise<Ergebnis> {
  try {
    await verlangeAdmin();
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }

  if (!onofficeConfigured()) {
    return { ok: false, meldung: "Die onOffice-Zugangsdaten sind in dieser Umgebung nicht gesetzt." };
  }

  let benutzer;
  try {
    const res = await readUsers();
    benutzer = res.users;
  } catch (err) {
    return { ok: false, meldung: `Abruf fehlgeschlagen: ${(err as Error).message}` };
  }

  const sb = supabaseAdmin();
  const { data: vorhanden } = await sb.from("broker_contacts").select("email");
  const bekannt = new Set((vorhanden ?? []).map((b) => String(b.email).toLowerCase()));

  const neu = benutzer
    .filter((u) => u.email && !bekannt.has(u.email.toLowerCase()))
    .map((u) => ({
      email: u.email.toLowerCase(),
      display_name:
        u.displayName && u.displayName !== "(ohne Namen)" ? u.displayName : nameAusMail(u.email),
      short_code: u.shortCode || null,
      onoffice_user_id: u.id || null,
      sync_source: "onoffice",
    }));

  if (!neu.length) {
    return {
      ok: true,
      meldung: `${benutzer.length} Benutzer in onOffice, alle schon in der Liste. Nichts hinzugefügt.`,
    };
  }

  const { error } = await sb.from("broker_contacts").insert(neu);
  if (error) return { ok: false, meldung: error.message };

  revalidatePath("/admin/kollegen");
  return {
    ok: true,
    meldung:
      `${neu.length} von ${benutzer.length} Kollegen übernommen. ` +
      "Die Namen sind aus der Mailadresse abgeleitet – deine Benutzerliste gibt keine her. " +
      "Bitte Namen, Telefon, Durchwahl und Standort nachtragen.",
  };
}
