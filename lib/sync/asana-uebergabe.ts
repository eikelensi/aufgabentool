/**
 * Eine Aufgabe des Tools nach Asana geben.
 *
 * Der Gegenweg zum Pool. Der Pool nimmt etwas aus Asana heraus und
 * legt es ins Haus; hier geht etwas aus dem Haus nach Asana - an die
 * beiden Stellen, an denen drueben wirklich gearbeitet wird:
 *
 *   projekt - das Asana-Projekt "Buchhaltung und HR", in den Eingang.
 *             Zustaendig ist dort Lisa.
 *   eike    - die persoenlichen Aufgaben, in den Aufgabeneingang.
 *
 * Wichtig, und der Unterschied zum Pool: die Aufgabe BLEIBT eine
 * Aufgabe des Tools (bereich "task"). Sie bekommt hier einen
 * Bearbeiter, laeuft ueber den normalen Weg nach onOffice und steht
 * weiter unter "Verteilt". Nach drueben geht eine Kopie, die dieselbe
 * Kennung traegt.
 *
 * Der Abgleich weiss damit umzugehen: fuer Aufgaben mit bereich
 * "task" holt er aus Asana NUR das Abhaken. Wird die Karte drueben
 * abgehakt, ist die Aufgabe hier erledigt - und von hier aus dann
 * auch in onOffice. Alles andere fuehrt weiter das Tool; sonst
 * schriebe Asana einem Kollegen seine Aufgabe um.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { projektGid, ruf, workspaceGid } from "@/lib/asana/client";
import { schreibeBearbeiterNachOnoffice } from "./bearbeiter";

export type Uebergabeziel = "projekt" | "eike";

interface Zielbeschreibung {
  /** Was in der Oberflaeche steht. */
  label: string;
  /** Wessen Asana-Konto die Aufgabe bekommt - gesucht wird ueber die Mailadresse. */
  email: string;
  /** Projektbrett oder persoenliche Liste? */
  bereich: "projekt" | "eigene";
}

export const ZIELE: Record<Uebergabeziel, Zielbeschreibung> = {
  projekt: {
    label: "Asana – Buchhaltung und HR (Lisa Peissig)",
    email: "lisa@4-wk.de",
    bereich: "projekt",
  },
  eike: {
    label: "Asana – Eike Lensinger (persönlich)",
    email: "lensinger@4-wk.de",
    bereich: "eigene",
  },
};

export interface UebergabeErgebnis {
  ok: boolean;
  fehler?: string;
  meldung?: string;
  asanaTaskGid?: string;
}

export async function gibNachAsana(
  taskId: string,
  ziel: Uebergabeziel,
  durch?: string,
  /**
   * Wer drueben zustaendig sein soll.
   *
   * Ohne Angabe gilt der Vorgabemensch des Ziels (bei "projekt"
   * Lisa). Mit Angabe gewinnt sie - im Projekt arbeiten mehrere, und
   * wer eine Aufgabe dorthin gibt, weiss in der Regel besser als
   * eine Voreinstellung, wer sie bekommen soll.
   */
  asanaGid?: string | null,
): Promise<UebergabeErgebnis> {
  const beschreibung = ZIELE[ziel];
  if (!beschreibung) return { ok: false, fehler: "Dieses Ziel gibt es nicht." };

  const sb = supabaseAdmin();

  const { data: aufgabe } = await sb
    .from("tasks")
    .select("id, title, description, due_date, status, bereich, asana_task_gid")
    .eq("id", taskId)
    .maybeSingle();

  if (!aufgabe) return { ok: false, fehler: "Diese Aufgabe gibt es nicht." };
  if (aufgabe.bereich === "asana") {
    return { ok: false, fehler: "Diese Aufgabe kommt schon aus Asana." };
  }
  if (aufgabe.asana_task_gid) {
    return { ok: false, fehler: "Diese Aufgabe liegt bereits in Asana." };
  }

  // Wer ist das drueben, und wer ist das hier? Beides steht in
  // asana_users; fehlt der Eintrag, ist der Abgleich noch nicht
  // gelaufen - dann sagen wir das, statt eine Aufgabe ohne
  // Zustaendigen abzuschicken.
  const { data: nutzer } = asanaGid
    ? await sb.from("asana_users").select("gid, name, profile_id").eq("gid", asanaGid).maybeSingle()
    : await sb
        .from("asana_users")
        .select("gid, name, profile_id")
        .ilike("email", beschreibung.email)
        .maybeSingle();

  if (!nutzer?.gid) {
    return {
      ok: false,
      fehler:
        `In Asana ist niemand mit ${beschreibung.email} bekannt. ` +
        "Der Abgleich läuft alle paar Minuten – danach noch einmal versuchen.",
    };
  }

  // In welchen Abschnitt? In den Eingang des jeweiligen Bretts.
  const { data: eingang } = await sb
    .from("asana_sections")
    .select("gid, name")
    .eq("bereich", beschreibung.bereich)
    .eq("ist_eingang", true)
    .maybeSingle();

  try {
    const neu = await ruf<{ gid: string }>({
      pfad: "/tasks",
      methode: "POST",
      daten:
        beschreibung.bereich === "eigene"
          ? {
              name: aufgabe.title,
              notes: aufgabe.description ?? "",
              workspace: workspaceGid(),
              assignee: nutzer.gid,
              due_on: aufgabe.due_date ?? null,
            }
          : {
              name: aufgabe.title,
              notes: aufgabe.description ?? "",
              projects: [projektGid()],
              assignee: nutzer.gid,
              due_on: aufgabe.due_date ?? null,
            },
    });

    if (eingang?.gid) {
      if (beschreibung.bereich === "eigene") {
        await ruf({
          pfad: `/tasks/${neu.gid}`,
          methode: "PUT",
          daten: { assignee_section: eingang.gid },
        });
      }
      // Oben einsortieren, wie bei allem Neuen. Im eigenen Brett
      // kennt das nicht jede Asana-Umgebung - dort ohne Aufheben.
      try {
        await ruf({
          pfad: `/sections/${eingang.gid}/addTask`,
          methode: "POST",
          daten: { task: neu.gid },
        });
      } catch (err) {
        if (beschreibung.bereich === "projekt") throw err;
      }
    }

    // Und hier: die Aufgabe bekommt ihren Bearbeiter. Sie bleibt eine
    // Aufgabe des Tools - nach onOffice geht sie ueber den normalen
    // Weg, und unter "Verteilt" sieht man weiter, dass es sie gibt.
    const { error } = await sb
      .from("tasks")
      .update({
        assignee_id: nutzer.profile_id ?? null,
        onoffice_bearbeiter_id: null,
        is_pool: false,
        asana_task_gid: neu.gid,
        asana_assignee_gid: nutzer.gid,
        updated_at: new Date().toISOString(),
        ...(durch ? { updated_by: durch } : {}),
      })
      .eq("id", taskId);

    if (error) {
      return {
        ok: false,
        fehler: `In Asana angelegt, hier aber nicht vermerkt: ${error.message}`,
        asanaTaskGid: neu.gid,
      };
    }

    /**
     * Und sofort nach onOffice, wer sie jetzt hat.
     *
     * Ohne das ging die Uebergabe wieder verloren, und zwar leise:
     * die Aufgabe entsteht hier zunaechst ohne Bearbeiter, der
     * onOffice-Abgleich legt sie drueben ebenso ohne Bearbeiter an,
     * und beim naechsten Lesen kommt genau dieses Nichts zurueck -
     * der Bearbeiter wird geleert und die Aufgabe faellt in den Pool.
     * Zehn Minuten spaeter lag sie im Pool, obwohl sie in Asana stand.
     *
     * Also nicht warten, bis der Abgleich es von sich aus tut,
     * sondern es jetzt hinschreiben. Misslingt es, bleibt die
     * Uebergabe trotzdem gueltig - der naechste Lauf holt es nach.
     */
    let bearbeiterMeldung = "";
    try {
      const r = await schreibeBearbeiterNachOnoffice(taskId, durch);
      // Frueher stand hier nur ein leeres catch - und ein "konnte
      // nicht schreiben" ist kein Wurf, sondern eine Rueckgabe. Die
      // ging damit lautlos verloren, und die Aufgabe fiel zehn
      // Minuten spaeter in den Pool, ohne dass irgendwo stand, warum.
      if (!r.uebertragen && r.meldung && !/steht bereits/i.test(r.meldung)) {
        bearbeiterMeldung = r.meldung;
      }
    } catch (err) {
      bearbeiterMeldung = (err as Error)?.message ?? "";
    }

    // Eine Zeile in der Geschichte der Aufgabe - sonst steht spaeter
    // ein Bearbeiterwechsel da, den niemand erklaeren kann.
    await sb.from("task_notes").insert({
      task_id: taskId,
      author_id: durch ?? null,
      body:
        `Nach Asana gegeben: ${beschreibung.label}` +
        (eingang?.name ? ` – Abschnitt „${eingang.name}“.` : ".") +
        (bearbeiterMeldung ? ` ACHTUNG: nach onOffice nicht übertragen – ${bearbeiterMeldung}` : ""),
    });

    return {
      ok: true,
      asanaTaskGid: neu.gid,
      meldung:
        `„${aufgabe.title}“ liegt jetzt bei ${nutzer.name ?? beschreibung.label} in Asana.` +
        (bearbeiterMeldung
          ? ` Achtung: onOffice weiß noch nichts davon – ${bearbeiterMeldung} ` +
            "Bis dahin holt der nächste Abgleich die Aufgabe in den Pool zurück."
          : ""),
    };
  } catch (err) {
    return { ok: false, fehler: (err as Error).message };
  }
}


/**
 * Wessen Aufgaben immer auch in Asana stehen sollen.
 *
 * Lisa arbeitet in Asana, nicht hier. Eine Aufgabe, die ihr im Tool
 * zugeteilt wird, saehe sie dort nie - egal auf welchem Weg die
 * Zuteilung kam: beim Anlegen vergeben, aus dem Pool gezogen, vom
 * onOffice-Abgleich mitgebracht oder von Hand umgehaengt. Der eine
 * Knopf "Nach Asana geben" deckt nur einen dieser Wege ab.
 *
 * Deshalb haengt die Regel an der PERSON: wer in der
 * Nutzerverwaltung den Haken "Aufgaben zusaetzlich nach Asana" hat,
 * bekommt jede Aufgabe auch drueben - im Projekt "Buchhaltung und
 * HR", im Eingang, und dort ihm selbst zugeteilt.
 *
 * Laeuft nach jedem Asana-Abgleich. Was schon eine Kennung hat, wird
 * uebergangen; erledigte Aufgaben ebenso - eine fertige Aufgabe
 * drueben neu anzulegen waere das Gegenteil von hilfreich.
 */
export async function spiegleZugeteilte(): Promise<{
  gespiegelt: number;
  fehler: string[];
}> {
  const sb = supabaseAdmin();
  const fehler: string[] = [];

  const { data: leute } = await sb
    .from("profiles")
    .select("id, full_name")
    .eq("asana_spiegeln", true)
    .eq("is_active", true);

  if (!leute?.length) return { gespiegelt: 0, fehler };

  // Wer drueben wer ist - ohne diese Zuordnung waere die Aufgabe in
  // Asana ohne Zustaendigen, und das ist keine Hilfe.
  const { data: asanaLeute } = await sb
    .from("asana_users")
    .select("gid, profile_id")
    .in(
      "profile_id",
      leute.map((l) => l.id),
    );

  const gidVon = new Map((asanaLeute ?? []).map((a) => [a.profile_id, a.gid]));

  // Bewusst wenige je Lauf: der Abgleich laeuft oft, und eine
  // Nachzuegler-Aufgabe darf warten. Ein Lauf, der an einer Stelle
  // haengenbleibt, waere schlimmer als ein langsamer.
  const { data: offen } = await sb
    .from("tasks")
    .select("id, title, assignee_id")
    .in(
      "assignee_id",
      leute.map((l) => l.id),
    )
    .is("asana_task_gid", null)
    .eq("bereich", "task")
    .neq("status", "erledigt")
    .order("created_at", { ascending: true })
    .limit(10);

  let gespiegelt = 0;

  for (const aufgabe of offen ?? []) {
    const gid = gidVon.get(aufgabe.assignee_id);
    if (!gid) {
      fehler.push(`${aufgabe.title}: in Asana ist diese Person nicht bekannt.`);
      continue;
    }

    const res = await gibNachAsana(aufgabe.id, "projekt", undefined, gid);
    if (res.ok) gespiegelt++;
    else fehler.push(`${aufgabe.title}: ${res.fehler}`);
  }

  return { gespiegelt, fehler };
}
