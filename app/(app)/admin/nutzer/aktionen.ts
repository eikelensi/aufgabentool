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
import { sendeZugangsMail } from "@/lib/mail/zugang";
import { verlangeAdmin } from "@/lib/supabase/profil";
import { synchronisiereAufgaben } from "@/lib/sync/onoffice-aufgaben";
import type { AppRole } from "@/lib/types";

export interface Ergebnis {
  ok: boolean;
  meldung: string;
  /** Falls die Mail nicht wegging: der Link zum persoenlichen Weitergeben. */
  linkZumWeitergeben?: string;
}

const ROLLEN: AppRole[] = ["superadmin", "gf", "qm", "user"];

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
  if (rolle === "superadmin" && admin.role !== "superadmin") {
    return { ok: false, meldung: "Nur ein Superadmin kann einen Superadmin anlegen." };
  }

  const basis = await basisAdresse();

  // Erzeugt den Zugang und den Token, verschickt aber ueber UNSEREN
  // Postausgang - siehe lib/mail/zugang.ts.
  const mail = await sendeZugangsMail({ email, name: fullName, art: "invite", basisAdresse: basis });

  if (!mail.benutzerId) {
    return { ok: false, meldung: mail.meldung, linkZumWeitergeben: mail.linkZumWeitergeben };
  }

  const sb = supabaseAdmin();
  const { error: profilFehler } = await sb.from("profiles").insert({
    id: mail.benutzerId,
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
    await sb.auth.admin.deleteUser(mail.benutzerId);
    return {
      ok: false,
      meldung: `Profil konnte nicht angelegt werden, der Zugang wurde zurueckgenommen: ${profilFehler.message}`,
    };
  }

  revalidatePath("/admin/nutzer");
  return {
    ok: mail.ok,
    meldung: mail.ok
      ? `${fullName} wurde angelegt. ${mail.meldung}`
      : `${fullName} wurde angelegt, aber: ${mail.meldung}`,
    linkZumWeitergeben: mail.linkZumWeitergeben,
  };
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

  // Bewusst kein vom Admin gesetztes Passwort: der Mensch setzt es selbst,
  // und niemand - auch kein Admin - kennt es.
  const basis = await basisAdresse();
  const mail = await sendeZugangsMail({ email, art: "recovery", basisAdresse: basis });
  return { ok: mail.ok, meldung: mail.meldung, linkZumWeitergeben: mail.linkZumWeitergeben };
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
  /** Alle in onOffice vorkommenden Namen mit ihrer Aufgabenzahl. */
  gefundeneNamen?: { name: string; anzahl: number }[];
  erkundung?: boolean;
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
    revalidatePath("/mein-tag");
    revalidatePath("/pool");
    revalidatePath("/team");

    const teile = r.erkundung
      ? [
          `${r.gelesen} Aufgaben aus onOffice gelesen`,
          `${r.gefundeneNamen.length} Namen gefunden`,
        ]
      : [
          `${r.gelesen} Aufgaben aus onOffice gelesen`,
          `${r.uebernommen} übernommen (${r.neu} neu, ${r.aktualisiert} aktualisiert)`,
          `${r.uebersprungen} übersprungen, weil weder Bearbeiter noch Verantwortung ein Nutzer ist`,
          `${r.altlasten} abgeschlossene nicht geholt (Altlasten bleiben in onOffice)`,
        ];
    for (const h of r.hinweise) teile.push(h);
    for (const f of r.fehler) teile.push(`Fehler: ${f}`);

    return {
      ok: r.fehler.length === 0,
      meldung: teile.join(". "),
      gelesen: r.gelesen,
      uebernommen: r.uebernommen,
      uebersprungen: r.uebersprungen,
      unbekannteNamen: r.unbekannteNamen,
      gefundeneNamen: r.gefundeneNamen,
      erkundung: r.erkundung,
    };
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }
}
