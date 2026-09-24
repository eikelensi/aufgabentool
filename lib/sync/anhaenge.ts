/**
 * Dateien abgleichen - in beide Richtungen.
 *
 * Hin: was im Tool hochgeladen wird, haengt kurz darauf auch an der
 * Aufgabe in onOffice (uploadfile, module "task").
 *
 * Zurueck: was in onOffice an der Aufgabe haengt, liegt kurz darauf auch
 * hier. Der Rueckweg geht in zwei Schritten, und die Trennung ist Absicht:
 *
 *   1. Der Aufgaben-Abgleich merkt sich nur die Datei-NUMMERN. Das kostet
 *      einen einzigen Aufruf fuer alle Aufgaben eines Laufs und legt je
 *      Datei eine Zeile im Zustand "nur_onoffice" an - ein Merkzettel.
 *   2. Dieser Job holt die Inhalte nach, portionsweise. Eine Aufgabe mit
 *      dreissig Anhaengen blockiert damit keinen Lauf; was uebrig bleibt,
 *      steht auf dem Merkzettel und kommt beim naechsten Mal.
 *
 * Wer nichts holt, verliert auch nichts: ein Fehler beim Inhalt laesst die
 * Zeile stehen, statt sie zu verwerfen.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { onofficeConfigured } from "@/lib/onoffice/client";
import { dateiWegBekannt, ladeDatei, pushFileToTask } from "@/lib/onoffice/files";
import { taskFileIds } from "@/lib/onoffice/relations";
import { readTaskFields } from "@/lib/onoffice/tasks";

/** Wie viele Dateien ein Lauf hoechstens hoch- bzw. herunterlaedt. */
const PRO_LAUF_HIN = 10;
const PRO_LAUF_ZURUECK = 8;

export interface AnhangErgebnis {
  hochgeladen: number;
  heruntergeladen: number;
  erfasst: number;
  uebersprungen: number;
  fehler: string[];
  meldung: string;
}

function leer(): AnhangErgebnis {
  return {
    hochgeladen: 0,
    heruntergeladen: 0,
    erfasst: 0,
    uebersprungen: 0,
    fehler: [],
    meldung: "",
  };
}

function endungVon(name: string): string {
  const teil = name.split(".").pop() ?? "";
  return /^[a-z0-9]{1,8}$/i.test(teil) ? teil.toLowerCase() : "bin";
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  eml: "message/rfc822",
  msg: "application/vnd.ms-outlook",
  zip: "application/zip",
};

function mimeVon(name: string): string {
  return MIME[endungVon(name)] ?? "application/octet-stream";
}

/**
 * Merkzettel anlegen: welche Datei haengt in onOffice an welcher Aufgabe.
 *
 * Bekommt die Paare (onOffice-Aufgabennummer -> unsere tasks.id) des
 * laufenden Abgleichs. Dateien, die wir schon kennen - egal ob von hier
 * hochgeladen oder frueher geholt - werden uebergangen; dafuer sorgt die
 * onoffice_file_id.
 */
export async function erfasseAnhangIds(
  paare: { onofficeTaskId: string; taskId: string }[],
): Promise<{ erfasst: number; fehler: string[] }> {
  const fehler: string[] = [];
  if (!paare.length || !onofficeConfigured()) return { erfasst: 0, fehler };

  const sb = supabaseAdmin();
  const nachNummer = new Map(paare.map((p) => [p.onofficeTaskId, p.taskId]));

  let proAufgabe: Map<string, string[]>;
  try {
    proAufgabe = await taskFileIds([...nachNummer.keys()]);
  } catch (err) {
    return { erfasst: 0, fehler: [`Datei-Verknuepfungen nicht lesbar: ${(err as Error).message}`] };
  }

  if (proAufgabe.size === 0) return { erfasst: 0, fehler };

  const taskIds = [...proAufgabe.keys()]
    .map((nr) => nachNummer.get(nr))
    .filter((id): id is string => Boolean(id));

  // Was wir zu diesen Aufgaben schon haben - einmal nachsehen statt je Datei.
  const { data: vorhanden } = await sb
    .from("task_attachments")
    .select("task_id, onoffice_file_id")
    .in("task_id", taskIds)
    .not("onoffice_file_id", "is", null);

  const bekannt = new Set((vorhanden ?? []).map((a) => `${a.task_id}:${a.onoffice_file_id}`));

  const neueZeilen: Record<string, unknown>[] = [];
  for (const [nummer, fileIds] of proAufgabe) {
    const taskId = nachNummer.get(nummer);
    if (!taskId) continue;

    for (const fileId of fileIds) {
      if (bekannt.has(`${taskId}:${fileId}`)) continue;
      neueZeilen.push({
        task_id: taskId,
        // Der richtige Name kommt mit dem Inhalt. Bis dahin steht hier
        // etwas, das man wiedererkennt, statt einer leeren Zeile.
        file_name: `onOffice-Datei ${fileId}`,
        origin: "onoffice",
        onoffice_file_id: fileId,
        sync_state: "nur_onoffice",
        storage_path: null,
      });
    }
  }

  if (!neueZeilen.length) return { erfasst: 0, fehler };

  const { error } = await sb.from("task_attachments").insert(neueZeilen);
  if (error) fehler.push(`Merkzettel nicht gespeichert: ${error.message}`);

  return { erfasst: error ? 0 : neueZeilen.length, fehler };
}

/** Hin: wartende Dateien nach onOffice spiegeln. */
async function spiegleHin(ergebnis: AnhangErgebnis): Promise<void> {
  const sb = supabaseAdmin();

  const { data: wartend, error } = await sb
    .from("task_attachments")
    .select("id, task_id, file_name, storage_path, onoffice_art, tasks ( onoffice_task_id )")
    .eq("sync_state", "wartet")
    .not("storage_path", "is", null)
    .limit(PRO_LAUF_HIN);

  if (error) {
    ergebnis.fehler.push(`Wartende Dateien nicht lesbar: ${error.message}`);
    return;
  }

  for (const a of wartend ?? []) {
    const onofficeTaskId = (a.tasks as unknown as { onoffice_task_id: string | null } | null)
      ?.onoffice_task_id;

    // Ohne Gegenstueck in onOffice gibt es kein Ziel fuer die Datei.
    if (!onofficeTaskId) {
      ergebnis.uebersprungen++;
      await sb.from("task_attachments").update({ sync_state: "lokal" }).eq("id", a.id);
      continue;
    }

    try {
      const { data: datei, error: ladeFehler } = await sb.storage
        .from("task-attachments")
        .download(a.storage_path as string);

      if (ladeFehler || !datei) throw new Error(ladeFehler?.message ?? "Datei nicht lesbar");

      const res = await pushFileToTask({
        taskId: onofficeTaskId,
        fileName: a.file_name,
        content: Buffer.from(await datei.arrayBuffer()),
        art: a.onoffice_art ?? undefined,
      });

      // Ohne Datei-ID waere die Datei beim naechsten Rueckweg ein
      // Unbekannter und kaeme als Kopie zurueck. Dann lieber "lokal":
      // hochgeladen ist sie, nur nicht wiedererkennbar.
      await sb
        .from("task_attachments")
        .update({
          sync_state: res.fileId ? "synchron" : "lokal",
          onoffice_file_id: res.fileId ?? null,
          sync_error: res.fileId ? null : "onOffice hat keine Datei-Nummer zurueckgegeben.",
          synced_at: new Date().toISOString(),
        })
        .eq("id", a.id);

      ergebnis.hochgeladen++;
    } catch (err) {
      const meldung = (err as Error).message;
      ergebnis.fehler.push(`${a.file_name}: ${meldung}`);
      await sb
        .from("task_attachments")
        .update({ sync_state: "fehler", sync_error: meldung })
        .eq("id", a.id);
    }
  }
}

/** Zurueck: Inhalte zu den Merkzetteln holen. */
async function holeZurueck(ergebnis: AnhangErgebnis): Promise<void> {
  const sb = supabaseAdmin();

  const [{ data: offen, error }, { data: einst }] = await Promise.all([
    sb
      .from("task_attachments")
      .select("id, task_id, onoffice_file_id, tasks ( onoffice_task_id )")
      .eq("sync_state", "nur_onoffice")
      .is("storage_path", null)
      .not("onoffice_file_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(PRO_LAUF_ZURUECK),
    sb.from("app_settings").select("attachment_max_mb").maybeSingle(),
  ]);

  if (error) {
    ergebnis.fehler.push(`Merkzettel nicht lesbar: ${error.message}`);
    return;
  }

  const maxBytes = Math.max(1, einst?.attachment_max_mb ?? 25) * 1024 * 1024;

  for (const a of offen ?? []) {
    const onofficeTaskId = (a.tasks as unknown as { onoffice_task_id: string | null } | null)
      ?.onoffice_task_id;

    try {
      const geholt = await ladeDatei(a.onoffice_file_id as string, onofficeTaskId ?? undefined);
      if (!geholt) throw new Error("onOffice liefert diese Datei nicht.");

      if (geholt.inhalt.byteLength > maxBytes) {
        ergebnis.uebersprungen++;
        await sb
          .from("task_attachments")
          .update({
            file_name: geholt.datei.originalName ?? geholt.datei.fileName,
            size_bytes: geholt.inhalt.byteLength,
            sync_error: `Zu gross fuer die Ablage (Grenze ${Math.round(maxBytes / 1024 / 1024)} MB) - die Datei bleibt in onOffice.`,
          })
          .eq("id", a.id);
        continue;
      }

      const name = geholt.datei.originalName ?? geholt.datei.fileName;
      const pfad = `${a.task_id}/${crypto.randomUUID()}.${endungVon(name)}`;
      const typ = mimeVon(name);

      const { error: hochFehler } = await sb.storage
        .from("task-attachments")
        .upload(pfad, geholt.inhalt, { contentType: typ, upsert: false });

      if (hochFehler) throw new Error(`Ablage: ${hochFehler.message}`);

      const { error: schreibFehler } = await sb
        .from("task_attachments")
        .update({
          file_name: name,
          mime_type: typ,
          size_bytes: geholt.inhalt.byteLength,
          storage_path: pfad,
          sync_state: "synchron",
          sync_error: null,
          synced_at: new Date().toISOString(),
        })
        .eq("id", a.id);

      if (schreibFehler) {
        // Die Datei liegt schon in der Ablage, der Eintrag zeigt aber noch
        // ins Leere. Aufraeumen, sonst sammelt sich Unerreichbares an.
        await sb.storage.from("task-attachments").remove([pfad]);
        throw new Error(schreibFehler.message);
      }

      ergebnis.heruntergeladen++;
    } catch (err) {
      const meldung = (err as Error).message;
      ergebnis.fehler.push(`Datei ${a.onoffice_file_id}: ${meldung}`);
      await sb.from("task_attachments").update({ sync_error: meldung }).eq("id", a.id);

      // Solange der Weg zur Datei nicht gefunden ist, probiert ein Lauf
      // ihn an genau einer Datei durch. Acht Dateien mal fuenf Varianten
      // waeren vierzig Anfragen fuer denselben Irrtum.
      if (!dateiWegBekannt()) break;
    }
  }
}

/**
 * Einmal nachsehen, welche Felder eine Aufgabe in diesem Mandanten hat.
 *
 * Vorbereitung fuer die Notizen: die Doku kennt ein Feld "Kommentar",
 * ob es hier eingerichtet ist, sagt sie nicht. Das Ergebnis steht danach
 * im Protokoll und die Abfrage wiederholt sich nicht - sie haengt nur
 * mit im Dateijob, weil der ohnehin alle fuenf Minuten laeuft.
 */
async function einmaligFelderNotieren(): Promise<void> {
  const sb = supabaseAdmin();

  const { data: schon } = await sb
    .from("onoffice_sync_log")
    .select("id")
    .eq("resource", "fields")
    .limit(1);

  if (schon?.length) return;

  try {
    const felder = await readTaskFields();
    await sb.from("onoffice_sync_log").insert({
      direction: "pull",
      resource: "fields",
      ok: true,
      message: `${felder.length} Felder am Modul Aufgabe`,
      payload: {
        felder: felder.map((f) => f.name),
        // Die Pflichtfelder mit fester Werteliste sind das, woran das
        // Anlegen scheitert - die gehoeren ins Protokoll, nicht nur die Namen.
        werte: Object.fromEntries(
          felder.filter((f) => f.werte?.length).map((f) => [f.name, f.werte]),
        ),
      },
    });
  } catch (err) {
    await sb.from("onoffice_sync_log").insert({
      direction: "pull",
      resource: "fields",
      ok: false,
      message: `Feldliste nicht lesbar: ${(err as Error).message}`,
    });
  }
}

/** Beide Richtungen, mit Protokolleintrag. */
export async function syncAnhaenge(): Promise<AnhangErgebnis> {
  const ergebnis = leer();

  if (!onofficeConfigured()) {
    ergebnis.meldung = "onOffice-Zugangsdaten sind in dieser Umgebung nicht gesetzt.";
    return ergebnis;
  }

  await spiegleHin(ergebnis);
  await holeZurueck(ergebnis);
  await einmaligFelderNotieren();

  const teile = [
    `${ergebnis.hochgeladen} nach onOffice`,
    `${ergebnis.heruntergeladen} von onOffice geholt`,
  ];
  if (ergebnis.uebersprungen) teile.push(`${ergebnis.uebersprungen} uebersprungen`);
  if (ergebnis.fehler.length) teile.push(`Fehler: ${ergebnis.fehler.slice(0, 3).join("; ")}`);
  ergebnis.meldung = teile.join(", ");

  await supabaseAdmin()
    .from("onoffice_sync_log")
    .insert({
      direction: "push",
      resource: "file",
      ok: ergebnis.fehler.length === 0,
      message: ergebnis.meldung,
      payload: { fehler: ergebnis.fehler.slice(0, 10) },
    });

  return ergebnis;
}
