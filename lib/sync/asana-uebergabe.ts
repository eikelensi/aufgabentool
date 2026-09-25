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
  const { data: nutzer } = await sb
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

    // Eine Zeile in der Geschichte der Aufgabe - sonst steht spaeter
    // ein Bearbeiterwechsel da, den niemand erklaeren kann.
    await sb.from("task_notes").insert({
      task_id: taskId,
      author_id: durch ?? null,
      body:
        `Nach Asana gegeben: ${beschreibung.label}` +
        (eingang?.name ? ` – Abschnitt „${eingang.name}“.` : "."),
    });

    return {
      ok: true,
      asanaTaskGid: neu.gid,
      meldung: `„${aufgabe.title}“ liegt jetzt bei ${nutzer.name ?? beschreibung.label} in Asana.`,
    };
  } catch (err) {
    return { ok: false, fehler: (err as Error).message };
  }
}
