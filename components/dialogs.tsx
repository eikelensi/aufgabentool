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
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "");
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
      onofficeAddressId: addressId || undefined,
      source: prefill?.source ?? "manuell",
    });
    if (!newId) return;
    if (files.length) await addAttachments(newId, files);
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

        <Field label="oder Kundendatensatz">
          <input
            className="field"
            value={addressId}
            onChange={(e) => setAddressId(e.target.value)}
            placeholder="z. B. ADR-11482"
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
    updateTask, profiles, brokers, tasks } = useStore();
  const [noteFor, setNoteFor] = useState(false);
  const [poolFor, setPoolFor] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

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
      <div className="mb-4">
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
