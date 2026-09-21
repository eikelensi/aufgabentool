"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { isoDate } from "@/lib/data";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
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
            und an <strong>{broker.displayName}</strong>
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
        <p className="mt-2 text-xs font-medium" style={{ color: "#dc2626" }}>
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
  const [assignee, setAssignee] = useState<string>(isAdmin ? "__pool" : me.id);
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
      assigneeId: assignee === "__pool" ? null : assignee,
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
          hint={isAdmin ? "Als Admin kannst du direkt zuweisen oder in den Pool legen." : "Mitarbeitende legen Aufgaben für sich selbst an."}
        >
          <select
            className="field"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            disabled={!isAdmin || isPrivate}
          >
            <option value="__pool">In den Aufgabenpool</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Zugeordneter Kollege" hint="Erhält bei Erledigung automatisch eine E-Mail.">
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
  const { profileById, categoryById, brokerById, moveTask, isAdmin, updateTask, profiles, tasks } =
    useStore();
  const [noteFor, setNoteFor] = useState(false);

  // Immer den aktuellen Stand aus dem Store zeigen, damit neu hochgeladene
  // Dateien sofort in der Liste stehen.
  const task = tasks.find((t) => t.id === taskProp.id) ?? taskProp;

  const assignee = profileById(task.assigneeId);
  const creator = profileById(task.creatorId);
  const broker = brokerById(task.brokerContactId);
  const category = categoryById(task.categoryId);

  const setStatus = (s: TaskStatus) => {
    if (s === "in_bearbeitung") {
      setNoteFor(true);
      return;
    }
    moveTask(task.id, s);
    onClose();
  };

  if (noteFor) return <NoteDialog task={task} onClose={onClose} />;

  return (
    <Modal title={task.title} onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusChip status={task.status} />
        <PriorityChip priority={task.priority} />
        <CategoryChip category={category} />
        {task.isPrivate ? (
          <span className="chip" style={{ background: "#ede9fe", color: "#6d28d9" }}>
            🔒 Privat
          </span>
        ) : null}
        {task.isPool && !task.assigneeId ? (
          <span className="chip" style={{ background: "#e0f2fe", color: "#0369a1" }}>
            Pool
          </span>
        ) : null}
        {task.source !== "manuell" ? (
          <span className="chip" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
            Quelle: {task.source === "email" ? "E-Mail" : task.source === "qm" ? "QM" : "onOffice"}
          </span>
        ) : null}
      </div>

      {task.description ? <p className="mb-4 text-sm leading-relaxed">{task.description}</p> : null}

      <dl className="mb-4 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        <Row label="Bearbeiter">
          <span className="inline-flex items-center gap-1.5">
            <Avatar profile={assignee} size={20} />
            {assignee?.fullName ?? "unbesetzt (Pool)"}
          </span>
        </Row>
        <Row label="Verantwortlich / Ersteller">{creator?.fullName ?? "–"}</Row>
        <Row label="Kollege">{broker ? `${broker.displayName} · ${broker.email}` : "–"}</Row>
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
          style={{ background: "#fffbeb", borderColor: "#fcd34d", color: "#92400e" }}
        >
          <strong>Notiz zu „Rückfragen offen“:</strong> {task.inProgressNote}
        </div>
      ) : null}

      {isAdmin ? (
        <div className="mb-4">
          <Field label="Neu zuordnen (z. B. bei Krankheit)">
            <select
              className="field"
              value={task.assigneeId ?? "__pool"}
              onChange={(e) =>
                updateTask(task.id, {
                  assigneeId: e.target.value === "__pool" ? null : e.target.value,
                  isPool: e.target.value === "__pool",
                })
              }
            >
              <option value="__pool">Zurück in den Aufgabenpool</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

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

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {task.status !== "offen" ? (
          <button className="btn" onClick={() => setStatus("offen")}>
            Auf „Offen“ setzen
          </button>
        ) : null}
        {task.status !== "in_bearbeitung" ? (
          <button className="btn" onClick={() => setStatus("in_bearbeitung")}>
            Rückfragen offen
          </button>
        ) : null}
        {task.status !== "erledigt" ? (
          <button className="btn btn-primary" onClick={() => setStatus("erledigt")}>
            Erledigt
          </button>
        ) : null}
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
