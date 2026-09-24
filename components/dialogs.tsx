"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { isoDate } from "@/lib/data";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { STATUS_LABEL, istVerteilt } from "@/lib/types";
import { Avatar, CategoryChip, Field, Modal, PriorityChip, StatusChip, formatDate, formatDateTime } from "./ui";
import { AttachmentSection, FileDrop, PendingFiles } from "./Attachments";

/* ------------------------------------------------------------------ */
/* Pflichtnotiz beim Wechsel auf „Rückfragen offen“                      */
/* ------------------------------------------------------------------ */
export function NoteDialog({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const { moveTask, profileById, brokerById } = useStore();
  const [note, setNote] = useState(task.inProgressNote ?? "");
  const [error, setError] = useState<string | null>(null);

  const creator = profileById(task.creatorId);
  const broker = brokerById(task.brokerContactId);

  const [laeuft, setLaeuft] = useState(false);

  const submit = async () => {
    setError(null);
    setLaeuft(true);
    const res = await moveTask(task.id, "in_bearbeitung", note);
    setLaeuft(false);
    if (!res.ok) {
      setError(res.error ?? "Speichern nicht möglich.");
      return;
    }
    onClose();
  };

  return (
    <Modal title="Status „Rückfragen offen“ – Notiz erforderlich" onClose={onClose}>
      <p className="muted mb-3 text-xs leading-relaxed">
        Ohne Notiz lässt sich dieser Status nicht speichern. Die Notiz geht an{" "}
        <strong>{creator?.fullName ?? "den Verantwortlichen"}</strong>
        {broker ? (
          <>
            {" "}
            und an <strong>{broker.displayName}</strong> (Auftraggeber)
          </>
        ) : null}
        .
      </p>
      <Field label={`Was ist offen? – „${task.title}“`}>
        <textarea
          className="field"
          rows={5}
          autoFocus
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setError(null);
          }}
          placeholder="z. B. Unterlage fehlt, Rückfrage beim Eigentümer läuft …"
        />
      </Field>
      {error ? (
        <p className="mt-2 text-xs font-medium" style={{ color: "var(--err-fg)" }}>
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>
          Abbrechen
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={!note.trim()}>
          Speichern und benachrichtigen
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Begruendung beim Zuruecklegen in den Pool                            */
/* ------------------------------------------------------------------ */
export function PoolDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const { inDenPool, brokerById, settings } = useStore();
  const [grund, setGrund] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const makler = brokerById(task.brokerContactId);

  const submit = async () => {
    setFehler(null);
    setLaeuft(true);
    const res = await inDenPool(task.id, grund);
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.error ?? "Zurücklegen nicht möglich.");
      return;
    }
    onClose();
  };

  return (
    <Modal title="Zurück in den Aufgabenpool – kurz begründen" onClose={onClose}>
      <p className="muted mb-3 text-xs leading-relaxed">
        Wer sich die Aufgabe als Nächstes zieht, soll wissen, woran du
        hängengeblieben bist. Eine Zeile reicht.
      </p>

      <div
        className="line mb-3 rounded-md border px-3 py-2 text-xs leading-relaxed"
        style={{ background: "var(--panel-2)" }}
      >
        <div>
          <span className="muted">Aufgabe: </span>
          {task.onofficeTaskId ? <strong>#{task.onofficeTaskId} </strong> : null}
          {task.title}
        </div>
        <div>
          <span className="muted">Auftrag von: </span>
          {makler?.displayName ?? "nicht hinterlegt"}
        </div>
      </div>

      <Field label="Warum geht die Aufgabe zurück? *">
        <textarea
          className="field"
          rows={4}
          autoFocus
          value={grund}
          onChange={(e) => {
            setGrund(e.target.value);
            setFehler(null);
          }}
          placeholder="z. B. Unterlagen fehlen und der Eigentümer ist bis nächste Woche im Urlaub"
        />
      </Field>

      <p className="muted mt-2 text-[11px] leading-relaxed">
        Geht als Meldung an <strong>{settings.poolNotifyEmail}</strong> – mit
        Aufgabennummer, Titel, deinem Namen, dem Auftraggeber und dieser
        Begründung.
      </p>

      {fehler ? (
        <p className="mt-2 text-xs font-medium" style={{ color: "var(--err-fg)" }}>
          {fehler}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose} disabled={laeuft}>
          Abbrechen
        </button>
        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={laeuft || !grund.trim()}
        >
          {laeuft ? "Lege zurück…" : "Zurücklegen und melden"}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Aufgabe anlegen (auch „aus E-Mail“)                                 */
/* ------------------------------------------------------------------ */
export interface Prefill {
  title?: string;
  description?: string;
  source?: Task["source"];
  onofficeEstateNo?: string;
  fromEmail?: string;
}

export function NewTaskDialog({ prefill, onClose }: { prefill?: Prefill; onClose: () => void }) {
  const { createTask, addAttachments, categories, profiles, brokers, isAdmin, me } = useStore();
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [description, setDescription] = useState(prefill?.description ?? "");
  // Bewusst leer, nicht die erste Kategorie: eine Vorauswahl, die niemand
  // getroffen hat, wird uebersehen und mitgespeichert. Dann steht an der
  // Aufgabe "Social Media", weil das oben in der Liste stand.
  const [categoryId, setCategoryId] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [assignee, setAssignee] = useState<string>(isAdmin ? "__pool" : `p:${me.id}`);
  const [brokerContactId, setBroker] = useState<string>("");
  const [visibleFrom, setVisibleFrom] = useState(isoDate(0));
  const [dueDate, setDueDate] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [estateNo, setEstateNo] = useState(prefill?.onofficeEstateNo ?? "");
  const [addressId, setAddressId] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const submit = async () => {
    if (!title.trim()) return;
    const newId = await createTask({
      title,
      description,
      categoryId: categoryId || null,
      priority,
      isPool: assignee === "__pool",
      assigneeId: assignee.startsWith("p:") ? assignee.slice(2) : null,
      onofficeBearbeiterId: assignee.startsWith("k:") ? assignee.slice(2) : null,
      brokerContactId: brokerContactId || null,
      visibleFrom,
      dueDate: dueDate || null,
      isPrivate,
      onofficeEstateNo: estateNo || undefined,
      // Die Eingabe ist eine Kundennummer, keine ID - die loest der
      // Server auf. Beides zusammen ist erlaubt: eine Aufgabe kann an
      // einem Objekt UND an einem Kunden haengen.
      onofficeAddressNo: addressId || undefined,
      source: prefill?.source ?? "manuell",
    });
    if (!newId) return;

    // Das Fenster geht zu, sobald die Aufgabe steht. Dateien laufen
    // danach weiter - ein Upload von zehn Megabyte darf niemanden vor
    // einem offenen Formular festhalten, und die Anhaenge erscheinen
    // an der Aufgabe, sobald sie oben sind.
    if (files.length) void addAttachments(newId, files);
    onClose();
  };

  return (
    <Modal title={prefill?.source === "email" ? "Aufgabe aus E-Mail anlegen" : "Neue Aufgabe"} onClose={onClose} wide>
      {prefill?.fromEmail ? (
        <div
          className="line mb-4 rounded-lg border px-3 py-2 text-xs"
          style={{ background: "var(--panel-2)" }}
        >
          <span className="muted">Übernommen aus onOffice-Posteingang: </span>
          <strong>{prefill.fromEmail}</strong>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Titel *">
            <input
              className="field"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Was ist zu tun?"
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Beschreibung">
            <textarea
              className="field"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Kategorie">
          <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">– keine –</option>
            {categories
              .filter((c) => c.isActive)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Priorität">
          <select
            className="field"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            <option value="normal">Normal</option>
            <option value="hoch">Hoch (rot)</option>
          </select>
        </Field>

        <Field
          label="Bearbeiter"
          hint={isAdmin ? "Nutzer des Tools oder ein Kollege, der nur in onOffice arbeitet." : "Mitarbeitende legen Aufgaben für sich selbst an."}
        >
          <select
            className="field"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            disabled={!isAdmin || isPrivate}
          >
            <option value="__pool">In den Aufgabenpool</option>
            <optgroup label="Nutzer des Aufgabentools">
              {profiles.map((p) => (
                <option key={p.id} value={`p:${p.id}`}>
                  {p.fullName}
                </option>
              ))}
            </optgroup>
            <optgroup label="Kollegen in onOffice (ohne Zugang zum Tool)">
              {brokers
                .filter((b) => b.shortCode)
                .map((b) => (
                  <option key={b.id} value={`k:${b.id}`}>
                    {b.displayName}
                  </option>
                ))}
            </optgroup>
          </select>
        </Field>

        <Field label="Auftrag von (Makler)" hint="Welcher Maklerkollege die Aufgabe in Auftrag gegeben hat. Er bekommt bei Erledigung eine E-Mail. Hat mit onOffice nichts zu tun.">
          <select
            className="field"
            value={brokerContactId}
            onChange={(e) => setBroker(e.target.value)}
            disabled={isPrivate}
          >
            <option value="">– keiner –</option>
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Startdatum (Sichtbarkeit)" hint="Vorher taucht die Aufgabe nicht im Tagesgeschäft auf.">
          <input
            type="date"
            className="field"
            value={visibleFrom}
            onChange={(e) => setVisibleFrom(e.target.value)}
          />
        </Field>

        <Field label="Fälligkeit (optional)">
          <input type="date" className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>

        <Field label="onOffice-Objektnummer">
          <input
            className="field"
            value={estateNo}
            onChange={(e) => setEstateNo(e.target.value)}
            placeholder="z. B. OBJ-2419"
          />
        </Field>

        <Field label="Kundennummer" hint="Objekt und Kunde lassen sich beide angeben – die Aufgabe hängt dann in onOffice an beiden.">
          <input
            className="field"
            value={addressId}
            onChange={(e) => setAddressId(e.target.value)}
            placeholder="z. B. 11482"
          />
        </Field>

        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => {
                setPrivate(e.target.checked);
                if (e.target.checked) {
                  setAssignee(me.id);
                  setBroker("");
                }
              }}
            />
            <span>
              Private Aufgabe – nur für mich sichtbar, keine Erinnerung oder Eskalation an andere
            </span>
          </label>
        </div>

        <div className="sm:col-span-2">
          <Field label="Dateien">
            <FileDrop onFiles={(f) => setFiles((prev) => [...prev, ...f])} />
          </Field>
          <PendingFiles files={files} onRemove={(i) => setFiles((p) => p.filter((_, idx) => idx !== i))} />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>
          Abbrechen
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={!title.trim()}>
          Aufgabe anlegen
        </button>
      </div>
    </Modal>
  );
}

/**
 * Der Gespraechsfaden an einer Aufgabe.
 *
 * Bewusst wie ein Chat und nicht wie ein Formularfeld: eine Rueckfrage
 * ist ein Wechsel, kein Eintrag. Wer schreibt, benachrichtigt damit
 * Ersteller und Bearbeiter - das erledigt die Datenbank, nicht diese
 * Ansicht.
 *
 * Eigene Notizen stehen rechts, fremde links. Das ist keine Spielerei:
 * man sieht auf einen Blick, wer zuletzt am Zug war.
 */
function NotizFaden({ task }: { task: Task }) {
  const { addNote, profileById, me } = useStore();
  const [text, setText] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const senden = async () => {
    if (!text.trim()) return;
    setLaeuft(true);
    const res = await addNote(task.id, text);
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.error ?? "Die Notiz ließ sich nicht speichern.");
      return;
    }
    setText("");
    setFehler(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-xs font-semibold">Notizen</h3>
        <span className="muted text-[11px]">
          {task.notes.length === 0
            ? "noch keine"
            : `${task.notes.length} ${task.notes.length === 1 ? "Eintrag" : "Einträge"}`}
        </span>
      </div>

      {task.notes.length > 0 ? (
        <ul className="flex max-h-[280px] flex-col gap-2 overflow-y-auto pr-1">
          {task.notes.map((n) => {
            const wer = profileById(n.authorId);
            const eigene = n.authorId === me.id;
            return (
              <li
                key={n.id}
                className={`flex items-start gap-2 ${eigene ? "flex-row-reverse" : ""}`}
              >
                <Avatar profile={wer} size={24} />
                <div
                  className="line max-w-[80%] rounded-lg border px-2.5 py-1.5"
                  style={{ background: eigene ? "var(--ok-bg)" : "var(--panel-2)" }}
                >
                  <div className="muted mb-0.5 flex flex-wrap gap-2 text-[10px]">
                    <span className="font-semibold">{wer?.fullName ?? "Unbekannt"}</span>
                    <span>{formatDateTime(n.createdAt)}</span>
                  </div>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{n.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="flex items-end gap-2">
        <textarea
          className="field min-h-[60px] flex-1"
          placeholder="Notiz schreiben – Ersteller und Bearbeiter bekommen sie angezeigt"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter schickt ab, Umschalt+Enter macht einen Absatz. So
            // schreibt man in jedem Chat, und so erwartet man es hier.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void senden();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={senden}
          disabled={laeuft || !text.trim()}
        >
          {laeuft ? "…" : "Senden"}
        </button>
      </div>

      {fehler ? (
        <p className="text-[11px]" style={{ color: "var(--err-fg)" }}>
          {fehler}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Aufgabendetail mit Statushistorie                                   */
/* ------------------------------------------------------------------ */
export function TaskDetailDialog({
  task: taskProp,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const { profileById, categoryById, brokerById, kollegeNachKuerzel, moveTask, isAdmin,
    updateTask, profiles, brokers, categories, tasks,
    asanaSpalten, asanaNutzer, asanaVerschieben, asanaZuteilen } = useStore();
  const [noteFor, setNoteFor] = useState(false);
  const [poolFor, setPoolFor] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Bearbeiten ist ein eigener Zustand, kein dauerhaft offenes Formular:
  // die Aufgabe wird hundertmal gelesen und einmal geaendert. Wer liest,
  // soll Text sehen und keine Eingabefelder.
  const [bearbeitet, setBearbeitet] = useState(false);
  const [entwurf, setEntwurf] = useState({
    title: "",
    description: "",
    dueDate: "",
    visibleFrom: "",
    priority: "normal" as TaskPriority,
  });

  // Immer den aktuellen Stand aus dem Store zeigen, damit neu hochgeladene
  // Dateien sofort in der Liste stehen.
  const task = tasks.find((t) => t.id === taskProp.id) ?? taskProp;

  const assignee = profileById(task.assigneeId);
  const creator = profileById(task.creatorId);
  const broker = brokerById(task.brokerContactId);
  const category = categoryById(task.categoryId);

  /**
   * Statuswechsel aus dem Dialog heraus.
   *
   * Das Fenster geht zu, sobald die Aenderung steht - wer eine Aufgabe
   * erledigt, ist mit ihr fertig und will die Liste sehen, nicht noch
   * einmal dieselbe Karte.
   *
   * Es bleibt nur dann offen, wenn die Aenderung NICHT durchging: dann
   * gehoert die Begruendung dorthin, wo man gerade hinsieht. Frueher
   * wurde hier nicht abgewartet und blind geschlossen - eine Ablehnung
   * der Datenbank verschwand mit dem Fenster.
   */
  const setStatus = async (s: TaskStatus) => {
    if (s === "in_bearbeitung") {
      setNoteFor(true);
      return;
    }
    setLaeuft(true);
    const res = await moveTask(task.id, s);
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.error ?? "Der Status ließ sich nicht ändern.");
      return;
    }
    onClose();
  };


  const beginneBearbeitung = () => {
    setFehler(null);
    setEntwurf({
      title: task.title,
      description: task.description ?? "",
      dueDate: task.dueDate ?? "",
      visibleFrom: task.visibleFrom ?? "",
      priority: task.priority,
    });
    setBearbeitet(true);
  };

  /**
   * Speichern schickt nur, was sich wirklich geaendert hat.
   *
   * Nicht aus Sparsamkeit: jedes Feld, das mitgeschickt wird, landet
   * auch in onOffice. Wer nur den Text korrigiert, soll dort nicht
   * nebenbei die Frist neu setzen.
   */
  const speichere = async () => {
    const titel = entwurf.title.trim();
    if (!titel) {
      setFehler("Ohne Betreff geht es nicht – das Feld ist auch in onOffice Pflicht.");
      return;
    }

    const patch: Partial<Task> = {};
    if (titel !== task.title) patch.title = titel;
    if (entwurf.description.trim() !== (task.description ?? "")) {
      patch.description = entwurf.description.trim() || undefined;
    }
    if ((entwurf.dueDate || null) !== (task.dueDate ?? null)) {
      patch.dueDate = entwurf.dueDate || null;
    }
    if ((entwurf.visibleFrom || null) !== (task.visibleFrom ?? null)) {
      patch.visibleFrom = entwurf.visibleFrom || undefined;
    }
    if (entwurf.priority !== task.priority) patch.priority = entwurf.priority;

    if (Object.keys(patch).length === 0) {
      setBearbeitet(false);
      return;
    }

    setLaeuft(true);
    const res = await updateTask(task.id, patch);
    setLaeuft(false);

    // ok mit Text heisst: hier gespeichert, drueben nicht angekommen.
    // Das Fenster bleibt offen, damit der Satz gelesen wird.
    if (!res.ok) {
      setFehler(res.error ?? "Die Änderung ließ sich nicht speichern.");
      return;
    }
    setBearbeitet(false);
    setFehler(res.error ?? null);
  };

  if (noteFor) return <NoteDialog task={task} onClose={onClose} />;
  if (poolFor) return <PoolDialog task={task} onClose={onClose} />;

  return (
    <Modal title={task.title} onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusChip status={task.status} />
        <PriorityChip priority={task.priority} />
        <CategoryChip category={category} />
        {task.isPrivate ? (
          <span className="chip" style={{ background: "var(--privat-bg)", color: "var(--privat-fg)" }}>
            🔒 Privat
          </span>
        ) : null}
        {task.isPool && !task.assigneeId ? (
          <span className="chip" style={{ background: "var(--info-bg)", color: "var(--info-fg)" }}>
            Pool
          </span>
        ) : null}
        {task.source !== "manuell" ? (
          <span className="chip" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
            Quelle: {task.source === "email" ? "E-Mail" : task.source === "qm" ? "QM" : "onOffice"}
          </span>
        ) : null}

        {!bearbeitet ? (
          <button type="button" className="btn ml-auto" onClick={beginneBearbeitung}>
            ✎ Bearbeiten
          </button>
        ) : null}
      </div>

      {/* Betreff und Beschreibung standen vorher beide ohne
          Kennzeichnung da: der Betreff oben in der Fensterleiste, der
          Text darunter als nackter Absatz. Man sah nicht, was wovon
          ist - bei Aufgabe 31789 las sich "Dublette: Daten wurden
          uebertragen" wie eine Statusmeldung statt wie der Auftrag.
          Jetzt zwei beschriftete Bloecke untereinander, beide so
          benannt, wie die Felder in onOffice heissen. Den Betreff noch
          einmal gross zu wiederholen waere doppelt gewesen - die
          Beschriftung allein macht schon klar, was man liest. */}
      {bearbeitet ? (
        <div className="mb-4 space-y-3">
          <Field label="Betreff *">
            <input
              className="field"
              value={entwurf.title}
              autoFocus
              onChange={(e) => setEntwurf((v) => ({ ...v, title: e.target.value }))}
            />
          </Field>

          <Field label="Aufgabenbeschreibung">
            <textarea
              className="field min-h-[120px]"
              value={entwurf.description}
              onChange={(e) => setEntwurf((v) => ({ ...v, description: e.target.value }))}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Priorität">
              <select
                className="field"
                value={entwurf.priority}
                onChange={(e) =>
                  setEntwurf((v) => ({ ...v, priority: e.target.value as TaskPriority }))
                }
              >
                <option value="hoch">Hoch</option>
                <option value="normal">Normal</option>
                <option value="niedrig">Niedrig</option>
              </select>
            </Field>

            <Field label="Fälligkeit">
              <input
                type="date"
                className="field"
                value={entwurf.dueDate}
                onChange={(e) => setEntwurf((v) => ({ ...v, dueDate: e.target.value }))}
              />
            </Field>

            <Field label="Sichtbar ab" hint="Nur im Tool.">
              <input
                type="date"
                className="field"
                value={entwurf.visibleFrom}
                onChange={(e) => setEntwurf((v) => ({ ...v, visibleFrom: e.target.value }))}
              />
            </Field>
          </div>

          {/* Gesagt werden muss es, bevor jemand tippt: bei diesen
              Feldern fuehrt onOffice, die Aenderung geht also dorthin
              zurueck. Wer das nicht weiss, korrigiert hier einen
              Betreff und aendert ungewollt den im CRM. */}
          {task.onofficeTaskId ? (
            <p className="muted text-[11px] leading-relaxed">
              Betreff, Beschreibung, Priorität und Fälligkeit werden auch in der
              onOffice-Aufgabe {task.onofficeTaskId} geändert – dort führen diese Felder.
              „Sichtbar ab“ und die Kategorie bleiben hier.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary" onClick={speichere} disabled={laeuft}>
              {laeuft ? "Speichert…" : "Speichern"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setBearbeitet(false);
                setFehler(null);
              }}
              disabled={laeuft}
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
      <div className="mb-4 space-y-3">
        <div>
          <h3 className="muted mb-1 text-[11px] font-semibold tracking-wide uppercase">
            Betreff
          </h3>
          <p className="text-base leading-snug font-semibold">{task.title}</p>
        </div>

        <div>
          <h3 className="muted mb-1 text-[11px] font-semibold tracking-wide uppercase">
            Aufgabenbeschreibung
          </h3>
          {task.description ? (
            <p
              className="line rounded-md border px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
              style={{ background: "var(--panel-2)" }}
            >
              {task.description}
            </p>
          ) : (
            <p
              className="muted line rounded-md border border-dashed px-3 py-2 text-xs"
              style={{ background: "var(--panel-2)" }}
            >
              {task.onofficeTaskId
                ? "In onOffice ist zu dieser Aufgabe kein Text hinterlegt."
                : "Keine Beschreibung hinterlegt."}
            </p>
          )}
        </div>
      </div>
      )}

      <dl className="mb-4 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        <Row label="Bearbeiter">
          <span className="inline-flex items-center gap-1.5">
            <Avatar profile={assignee} size={20} />
            {assignee?.fullName ?? "unbesetzt (Pool)"}
          </span>
        </Row>
        {/* Bei Aufgaben aus onOffice steht die Verantwortung DORT, und
            nur dort ist sie wahr. creator_id kann das nicht abbilden:
            die Spalte darf nicht leer sein, also faellt der Abgleich auf
            den Bearbeiter zurueck, wenn die verantwortliche Person
            keinen Zugang zum Tool hat. Dann behauptete diese Zeile, der
            Bearbeiter sei verantwortlich - bei Aufgabe 31789 stand hier
            "Kim Dann", waehrend onOffice "Fries, Jessica (JFR)" fuehrt.
            Also zeigen wir den Rohwert, wenn es einen gibt. */}
        <Row label="Verantwortlich">
          {task.onofficeResponsible ? (
            <>
              {kollegeNachKuerzel(task.onofficeResponsible)?.displayName ??
                task.onofficeResponsible}
              <span className="muted ml-1.5 text-[11px]">laut onOffice</span>
            </>
          ) : (
            (creator?.fullName ?? "–")
          )}
        </Row>
        <Row label="Aufgabennummer in onOffice">
          {task.onofficeTaskId ? (
            <a
              className="underline"
              style={{ color: "var(--color-ci-500)" }}
              href={`https://smart.onoffice.de/smart/smart.php#task/${task.onofficeTaskId}`}
              target="_blank"
              rel="noreferrer"
            >
              #{task.onofficeTaskId}
            </a>
          ) : (
            <span className="muted">nur hier angelegt</span>
          )}
        </Row>
        <Row label="Auftrag von">
          {broker ? `${broker.displayName} · ${broker.email}` : "– niemand hinterlegt –"}
        </Row>
        <Row label="Objekt / Kunde">
          {task.onofficeEstateNo ? (
            <a
              className="underline"
              style={{ color: "var(--color-ci-500)" }}
              href={`https://smart.onoffice.de/smart/smart.php#estate/${task.onofficeEstateNo}`}
              target="_blank"
              rel="noreferrer"
            >
              {task.onofficeEstateNo}
            </a>
          ) : task.onofficeAddressId ? (
            <a
              className="underline"
              style={{ color: "var(--color-ci-500)" }}
              href={`https://smart.onoffice.de/smart/smart.php#address/${task.onofficeAddressId}`}
              target="_blank"
              rel="noreferrer"
            >
              {task.onofficeAddressId}
            </a>
          ) : (
            "–"
          )}
        </Row>
        <Row label="Sichtbar ab">{formatDate(task.visibleFrom)}</Row>
        <Row label="Fällig">{formatDate(task.dueDate)}</Row>
        <Row label="Erstellt">{formatDateTime(task.createdAt)}</Row>
        <Row label="Erledigt">{formatDateTime(task.completedAt)}</Row>
      </dl>

      {task.inProgressNote ? (
        <div
          className="mb-4 rounded-lg border px-3 py-2 text-xs"
          style={{ background: "var(--warn-bg)", borderColor: "var(--warn-fg)", color: "var(--warn-fg)" }}
        >
          <strong>Notiz zu „Rückfragen offen“:</strong> {task.inProgressNote}
        </div>
      ) : null}

      {isAdmin ? (
        <div className="mb-4">
          <Field
            label="Bearbeiter"
            hint={
              task.onofficeTaskId
                ? "Wird in onOffice als „Bearbeiter“ eingetragen. „Aufgabenpool“ leert das Feld dort."
                : "Diese Aufgabe wurde nur hier angelegt – es gibt in onOffice nichts, wohin das geschrieben werden könnte."
            }
          >
            <select
              className="field"
              value={
                task.assigneeId
                  ? `p:${task.assigneeId}`
                  : task.onofficeBearbeiterId && !task.isPool
                    ? `k:${task.onofficeBearbeiterId}`
                    : "__pool"
              }
              onChange={(e) => {
                const wert = e.target.value;
                if (wert === "__pool") {
                  updateTask(task.id, {
                    assigneeId: null,
                    onofficeBearbeiterId: null,
                    isPool: true,
                  });
                } else if (wert.startsWith("p:")) {
                  // Ein Nutzer des Tools: er arbeitet hier, die Aufgabe
                  // erscheint bei ihm in "Mein Tag".
                  updateTask(task.id, {
                    assigneeId: wert.slice(2),
                    onofficeBearbeiterId: null,
                    isPool: false,
                  });
                } else {
                  // Ein Kollege ohne Zugang: im Tool gibt es niemanden,
                  // dem die Aufgabe gehoeren koennte - in onOffice schon.
                  // Sie steht danach unter "Verteilt".
                  updateTask(task.id, {
                    assigneeId: null,
                    onofficeBearbeiterId: wert.slice(2),
                    isPool: false,
                  });
                }
              }}
            >
              <option value="__pool">Niemand – zurück in den Aufgabenpool</option>
              <optgroup label="Nutzer des Aufgabentools">
                {profiles.map((p) => (
                  <option key={p.id} value={`p:${p.id}`}>
                    {p.fullName}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Kollegen in onOffice (ohne Zugang zum Tool)">
                {brokers
                  .filter((b) => b.shortCode)
                  .map((b) => (
                    <option key={b.id} value={`k:${b.id}`}>
                      {b.displayName}
                    </option>
                  ))}
              </optgroup>
            </select>
          </Field>

          {/* Steht in onOffice ein Bearbeiter, den wir keinem Kollegen
              zuordnen koennen, sagen wir das - und nennen das Kuerzel,
              damit man in onOffice danach suchen kann. */}
          {istVerteilt(task) && task.onofficeAssignee && !kollegeNachKuerzel(task.onofficeAssignee) ? (
            <p className="muted mt-1.5 text-[11px] leading-relaxed">
              In onOffice steht derzeit <code>{task.onofficeAssignee}</code> – dieses
              Kürzel gehört zu keinem Kollegen in der Mitarbeiterverwaltung.
            </p>
          ) : null}

        </div>
      ) : null}

      {/* Etwas ganz ANDERES als der Bearbeiter, auch wenn beide aus
          derselben Liste kommen: hier steht, wer die Aufgabe in Auftrag
          gegeben hat. Das beantwortet beim Lesen einer Kachel die erste
          Frage - fuer wen mache ich das eigentlich - und entscheidet,
          wer bei Erledigung Bescheid bekommt.

          Makler arbeiten nicht im Tool und stehen auch nicht in onOffice
          als Bearbeiter. Dieses Feld geht nie nach drueben. Beides in
          eine Spalte zu legen war mein Fehler.

          Bewusst NICHT auf Admins begrenzt: wer an einer Aufgabe
          arbeitet, weiss am besten, fuer wen - und muss das eintragen
          koennen, ohne zu fragen. */}
      {/* Was in Asana steht, wird hier gesetzt - nicht nur angezeigt.
          Eine Zuteilung, die nur im Tool stuende, waere beim naechsten
          Abgleich wieder weg: in diesem Bereich fuehrt Asana. Deshalb
          schreiben diese drei Felder direkt hinueber. */}
      {task.bereich === "asana" ? (
        <div
          className="line mb-4 rounded-lg border p-3"
          style={{ background: "var(--panel-2)" }}
        >
          <h3 className="mb-2 text-xs font-semibold">In Asana</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Spalte" hint="Verschiebt die Karte auch drüben.">
              <select
                className="field"
                value={task.asanaSectionGid ?? ""}
                onChange={async (e) => {
                  if (!e.target.value) return;
                  setLaeuft(true);
                  const res = await asanaVerschieben(task.id, e.target.value);
                  setLaeuft(false);
                  // Die Pool-Spalte nimmt die Aufgabe aus diesem
                  // Bereich heraus - dann gibt es hier nichts mehr zu
                  // sehen.
                  const spalte = asanaSpalten.find((sp) => sp.gid === e.target.value);
                  if (res.ok && spalte?.istPool) onClose();
                  else if (!res.ok) setFehler(res.error ?? "Verschieben ging nicht.");
                }}
                disabled={laeuft}
              >
                <option value="">– keine –</option>
                {asanaSpalten.map((sp) => (
                  <option key={sp.gid} value={sp.gid}>
                    {sp.name}
                    {sp.istPool ? " (gibt die Aufgabe ab)" : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Zuständig" hint="Die Mitglieder des Asana-Projekts.">
              <select
                className="field"
                value={task.asanaAssigneeGid ?? ""}
                onChange={async (e) => {
                  setLaeuft(true);
                  const res = await asanaZuteilen(task.id, { assigneeGid: e.target.value || null });
                  setLaeuft(false);
                  if (!res.ok) setFehler(res.error ?? "Zuteilen ging nicht.");
                }}
                disabled={laeuft}
              >
                <option value="">– niemand –</option>
                {asanaNutzer.map((n) => (
                  <option key={n.gid} value={n.gid}>
                    {n.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Fällig in Asana">
              <input
                type="date"
                className="field"
                defaultValue={task.dueDate ?? ""}
                onChange={async (e) => {
                  setLaeuft(true);
                  const res = await asanaZuteilen(task.id, { dueOn: e.target.value || null });
                  setLaeuft(false);
                  if (!res.ok) setFehler(res.error ?? "Frist ging nicht.");
                }}
                disabled={laeuft}
              />
            </Field>
          </div>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {/* Die Kategorie gehoert hierher und nicht nur ins Anlegen-Fenster:
            fast jede Aufgabe kommt aus onOffice und wird gar nicht hier
            angelegt. Ohne dieses Feld liesse sich der groesste Teil des
            Bestands nie einordnen.

            Rein lokal - onOffice kennt keine Kategorien und
            ueberschreibt sie beim Abgleich deshalb auch nicht. */}
        <Field
          label="Kategorie"
          hint="Nur im Tool. Sortiert die Übersicht und wird von onOffice nicht überschrieben."
        >
          <select
            className="field"
            value={task.categoryId ?? ""}
            onChange={(e) => updateTask(task.id, { categoryId: e.target.value || null })}
          >
            <option value="">– keine –</option>
            {categories
              .filter((c) => c.isActive || c.id === task.categoryId)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>

        <Field
          label="Auftrag von (Makler)"
          hint="Wer die Aufgabe in Auftrag gegeben hat. Er bekommt bei Erledigung eine E-Mail. Geht nicht nach onOffice – Makler arbeiten nicht im Tool."
        >
          <select
            className="field"
            value={task.brokerContactId ?? ""}
            onChange={(e) => updateTask(task.id, { brokerContactId: e.target.value || null })}
          >
            <option value="">– nicht hinterlegt –</option>
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mb-4">
        <AttachmentSection task={task} />
      </div>

      <div className="mb-4">
        <NotizFaden task={task} />
      </div>

      <h3 className="mb-2 text-xs font-semibold">Statushistorie</h3>
      {task.history.length === 0 ? (
        <p className="muted text-xs">Noch keine Statusänderung.</p>
      ) : (
        <ul className="space-y-1.5 text-xs">
          {[...task.history].reverse().map((h, i) => (
            <li key={i} className="line flex flex-wrap gap-1 border-l-2 pl-2">
              <span className="muted">{formatDateTime(h.at)}</span>
              <span>
                {h.from ? STATUS_LABEL[h.from] : "neu"} → <strong>{STATUS_LABEL[h.to]}</strong>
              </span>
              <span className="muted">· {profileById(h.by)?.fullName ?? h.by}</span>
              {h.note ? <span className="basis-full italic">„{h.note}“</span> : null}
            </li>
          ))}
        </ul>
      )}

      {fehler ? (
        <p
          className="mt-4 rounded-md px-2.5 py-2 text-xs leading-relaxed"
          style={{ background: "var(--err-bg)", color: "var(--err-fg)" }}
          role="alert"
        >
          {fehler}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {/* Abgeben braucht kein Adminrecht: wer eine Aufgabe hat und
            sie nicht schafft, soll sie loslassen koennen, ohne jemanden
            zu fragen. Steht links, weil es nichts mit dem Status zu tun
            hat - und weit weg von "Erledigt". */}
        {!task.isPool && (task.assigneeId || task.onofficeBearbeiterId) ? (
          <button
            className="btn"
            title={
              task.onofficeTaskId
                ? "Legt die Aufgabe zurück in den Pool und leert den Bearbeiter in onOffice."
                : "Legt die Aufgabe zurück in den Pool."
            }
            disabled={laeuft}
            onClick={() => setPoolFor(true)}
          >
            ↩︎ Zurück in den Aufgabenpool
          </button>
        ) : null}

        <div className="ml-auto flex flex-wrap justify-end gap-2">
        {task.status !== "offen" ? (
          <button className="btn" disabled={laeuft} onClick={() => setStatus("offen")}>
            Auf „Offen“ setzen
          </button>
        ) : null}
        {task.status !== "in_bearbeitung" ? (
          <button className="btn" disabled={laeuft} onClick={() => setStatus("in_bearbeitung")}>
            Rückfragen offen
          </button>
        ) : null}
        {task.status !== "erledigt" ? (
          <button className="btn btn-primary" disabled={laeuft} onClick={() => setStatus("erledigt")}>
            {laeuft ? "Moment…" : "Erledigt"}
          </button>
        ) : null}
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="muted w-40 shrink-0">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
