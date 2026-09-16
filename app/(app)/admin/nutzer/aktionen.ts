"use server";

/**
 * Serveraktionen der Nutzerverwaltung.
 *
 * Jede Aktion prueft zuerst selbst, ob die anfragende Person Admin ist.
 * Darauf zu verzichten, weil die Seite schon geprueft hat, waere ein
 * Fehler: Serveraktionen sind eigene Endpunkte und direkt aufrufbar.
 *
 * Passwoerter kommen hier nicht vor. Neue Zugaenge bekommen eine
 * Einladungsmail mit einmal gueltigem Link, "Zuruecksetzen" schickt
 * denselben Weg noch einmal.
 */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { verlangeAdmin } from "@/lib/supabase/profil";
import { synchronisiereAufgaben } from "@/lib/sync/onoffice-aufgaben";
import type { AppRole } from "@/lib/types";

export interface Ergebnis {
  ok: boolean;
  meldung: string;
}

const ROLLEN: AppRole[] = ["superadmin", "admin", "mitarbeiter"];

/** Basisadresse fuer Mail-Links - im Betrieb die echte Domain. */
async function basisAdresse(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const schema = host.startsWith("localhost") ? "http" : "https";
  return `${schema}://${host}`;
}

function text(formData: FormData, feld: string): string {
  return String(formData.get(feld) ?? "").trim();
}

export async function nutzerEinladen(formData: FormData): Promise<Ergebnis> {
  let admin;
  try {
    admin = await verlangeAdmin();
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }

  const email = text(formData, "email").toLowerCase();
  const fullName = text(formData, "full_name");
  const rolle = text(formData, "role") as AppRole;
  const onofficeUsername = text(formData, "onoffice_username");
  const phone = text(formData, "phone");

  if (!email || !email.includes("@")) return { ok: false, meldung: "Bitte eine Mailadresse angeben." };
  if (!fullName) return { ok: false, meldung: "Bitte den Namen angeben." };
  if (!ROLLEN.includes(rolle)) return { ok: false, meldung: "Unbekannte Rolle." };
  // Nur ein Superadmin darf einen weiteren Superadmin machen.
  if (rolle === "superadmin" && admin.role !== "superadmin") {
    return { ok: false, meldung: "Nur ein Superadmin kann einen Superadmin anlegen." };
  }

  const sb = supabaseAdmin();
  const basis = await basisAdresse();

  const { data, error } = await sb.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${basis}/auth/bestaetigen?next=/passwort-setzen`,
  });

  if (error || !data.user) {
    const m = error?.message ?? "Unbekannter Fehler";
    if (/already been registered|already exists/i.test(m)) {
      return {
        ok: false,
        meldung:
          "Zu dieser Adresse gibt es schon einen Zugang. Falls er nur nicht in der Liste steht, " +
          "sag es mir - dann muss das Profil nachgetragen werden, nicht neu eingeladen.",
      };
    }
    if (/rate limit|too many/i.test(m)) {
      return {
        ok: false,
        meldung:
          "Supabase hat den Mailversand vorerst gebremst. Das passiert mit dem eingebauten " +
          "Postausgang nach wenigen Mails. Dauerhaft hilft nur ein eigener SMTP-Zugang in den " +
          "Supabase-Einstellungen unter Authentication.",
      };
    }
    return { ok: false, meldung: `Einladung fehlgeschlagen: ${m}` };
  }

  const { error: profilFehler } = await sb.from("profiles").insert({
    id: data.user.id,
    email,
    full_name: fullName,
    role: rolle,
    onoffice_username: onofficeUsername || null,
    phone: phone || null,
    invited_at: new Date().toISOString(),
    invited_by: admin.id,
  });

  if (profilFehler) {
    // Auth-Konto steht, Profil nicht - das waere ein Zugang ohne Rolle.
    // Lieber zurueckdrehen als halb dastehen lassen.
    await sb.auth.admin.deleteUser(data.user.id);
    return {
      ok: false,
      meldung: `Profil konnte nicht angelegt werden, die Einladung wurde zurueckgenommen: ${profilFehler.message}`,
    };
  }

  revalidatePath("/admin/nutzer");
  return { ok: true, meldung: `Einladung an ${email} ist unterwegs.` };
}

export async function rolleAendern(id: string, rolle: AppRole): Promise<Ergebnis> {
  let admin;
  try {
    admin = await verlangeAdmin();
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }

  if (!ROLLEN.includes(rolle)) return { ok: false, meldung: "Unbekannte Rolle." };
  if (id === admin.id) {
    return {
      ok: false,
      meldung: "Die eigene Rolle kann man nicht aendern - sonst sperrt man sich selbst aus.",
    };
  }
  if (rolle === "superadmin" && admin.role !== "superadmin") {
    return { ok: false, meldung: "Nur ein Superadmin kann einen Superadmin einsetzen." };
  }

  const sb = supabaseAdmin();

  // Ein Superadmin darf nicht von einem einfachen Admin herabgestuft werden.
  const { data: ziel } = await sb.from("profiles").select("role").eq("id", id).maybeSingle();
  if (ziel?.role === "superadmin" && admin.role !== "superadmin") {
    return { ok: false, meldung: "Einen Superadmin kann nur ein Superadmin aendern." };
  }

  const { error } = await sb.from("profiles").update({ role: rolle }).eq("id", id);
  if (error) return { ok: false, meldung: error.message };

  revalidatePath("/admin/nutzer");
  return { ok: true, meldung: "Rolle geaendert." };
}

export async function aktivSetzen(id: string, aktiv: boolean): Promise<Ergebnis> {
  let admin;
  try {
    admin = await verlangeAdmin();
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }

  if (id === admin.id) {
    return { ok: false, meldung: "Das eigene Konto kann man nicht abschalten." };
  }

  const sb = supabaseAdmin();

  const { data: ziel } = await sb.from("profiles").select("role").eq("id", id).maybeSingle();
  if (ziel?.role === "superadmin" && admin.role !== "superadmin") {
    return { ok: false, meldung: "Einen Superadmin kann nur ein Superadmin abschalten." };
  }

  // Beides: Merker im Profil und die Anmeldung selbst sperren. Nur den
  // Merker zu setzen wuerde die Anmeldung offen lassen.
  const { error } = await sb
    .from("profiles")
    .update({
      is_active: aktiv,
      deactivated_at: aktiv ? null : new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, meldung: error.message };

  const { error: sperrFehler } = await sb.auth.admin.updateUserById(id, {
    ban_duration: aktiv ? "none" : "876000h", // rund 100 Jahre
  });

  if (sperrFehler) {
    return {
      ok: false,
      meldung:
        `Das Profil wurde auf ${aktiv ? "aktiv" : "inaktiv"} gesetzt, die Anmeldung aber nicht: ` +
        sperrFehler.message,
    };
  }

  revalidatePath("/admin/nutzer");
  return { ok: true, meldung: aktiv ? "Zugang wieder freigegeben." : "Zugang gesperrt." };
}

export async function passwortZuruecksetzen(email: string): Promise<Ergebnis> {
  try {
    await verlangeAdmin();
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }

  // Bewusst der normale Weg und nicht ein selbst gesetztes Passwort: der
  // Mensch setzt es selbst, und niemand - auch kein Admin - kennt es.
  const supabase = await supabaseServer();
  const basis = await basisAdresse();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${basis}/auth/bestaetigen?next=/passwort-setzen`,
  });

  if (error) return { ok: false, meldung: error.message };
  return { ok: true, meldung: `Eine Mail zum Zuruecksetzen ist an ${email} unterwegs.` };
}

export async function einladungErneutSenden(email: string): Promise<Ergebnis> {
  return passwortZuruecksetzen(email);
}

/**
 * Den onOffice-Anzeigenamen eines Nutzers setzen - der Schluessel fuer den
 * Aufgaben-Sync. Nur Aufgaben, deren Bearbeiter oder Verantwortung auf
 * einen dieser Namen passt, werden uebernommen.
 */
export async function onofficeNameSetzen(id: string, name: string): Promise<Ergebnis> {
  try {
    await verlangeAdmin();
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }

  const wert = name.trim().replace(/\s+/g, " ");
  const sb = supabaseAdmin();

  const { error } = await sb
    .from("profiles")
    .update({ onoffice_display_name: wert || null })
    .eq("id", id);

  if (error) {
    if (/profiles_onoffice_display_idx|duplicate key/i.test(error.message)) {
      return {
        ok: false,
        meldung: `"${wert}" ist schon einem anderen Nutzer zugeordnet. Ein onOffice-Name gehoert zu genau einer Person.`,
      };
    }
    return { ok: false, meldung: error.message };
  }

  revalidatePath("/admin/nutzer");
  return {
    ok: true,
    meldung: wert
      ? `Zuordnung gespeichert: ${wert}`
      : "Zuordnung entfernt - fuer diese Person werden keine Aufgaben mehr geholt.",
  };
}

export interface SyncMeldung extends Ergebnis {
  gelesen?: number;
  uebernommen?: number;
  uebersprungen?: number;
  unbekannteNamen?: string[];
}

/** Aufgaben aus onOffice holen. */
export async function aufgabenSynchronisieren(seit?: string): Promise<SyncMeldung> {
  try {
    await verlangeAdmin();
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }

  try {
    const r = await synchronisiereAufgaben({ seit });
    revalidatePath("/admin/nutzer");
    revalidatePath("/");
    revalidatePath("/pool");
    revalidatePath("/uebersicht");

    const teile = [
      `${r.gelesen} Aufgaben aus onOffice gelesen`,
      `${r.uebernommen} uebernommen (${r.neu} neu, ${r.aktualisiert} aktualisiert)`,
      `${r.uebersprungen} uebersprungen, weil weder Bearbeiter noch Verantwortung ein Nutzer ist`,
    ];
    if (r.unbekannteNamen.length) {
      teile.push(`Unbekannte Namen: ${r.unbekannteNamen.slice(0, 12).join(", ")}`);
    }
    for (const h of r.hinweise) teile.push(h);
    for (const f of r.fehler) teile.push(`Fehler: ${f}`);

    return {
      ok: r.fehler.length === 0,
      meldung: teile.join(". "),
      gelesen: r.gelesen,
      uebernommen: r.uebernommen,
      uebersprungen: r.uebersprungen,
      unbekannteNamen: r.unbekannteNamen,
    };
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }
}
