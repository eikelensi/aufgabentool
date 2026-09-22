"use client";

import React, { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { ALLOWED_EXTENSIONS } from "@/lib/data";
import type { Attachment, AttachmentSync, Task } from "@/lib/types";
import { SYNC_LABEL } from "@/lib/types";
import { formatDateTime } from "./ui";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const SYNC_STYLE: Record<AttachmentSync, { bg: string; fg: string }> = {
  lokal: { bg: "var(--neutral-bg)", fg: "var(--neutral-fg)" },
  wartet: { bg: "var(--warn-bg)", fg: "var(--warn-fg)" },
  synchron: { bg: "var(--ok-bg)", fg: "var(--ok-fg)" },
  nur_onoffice: { bg: "var(--info-bg)", fg: "var(--info-fg)" },
  fehler: { bg: "var(--err-bg)", fg: "var(--err-fg)" },
};

export function SyncChip({ state }: { state: AttachmentSync }) {
  const s = SYNC_STYLE[state];
  return (
    <span className="chip" style={{ background: s.bg, color: s.fg }}>
      {SYNC_LABEL[state]}
    </span>
  );
}

/** Auswahlfeld plus Ablagefläche. Gibt die gewählten Dateien nach oben. */
export function FileDrop({
  onFiles,
  hint,
}: {
  onFiles: (files: File[]) => void;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const { settings } = useStore();

  const take = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
    if (input.current) input.current.value = "";
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={`line rounded-lg border border-dashed px-3 py-3 text-center ${over ? "dropzone-active" : ""}`}
      style={{ background: "var(--panel-2)" }}
    >
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",")}
        onChange={(e) => take(e.target.files)}
      />
      <button type="button" className="btn" onClick={() => input.current?.click()}>
        Dateien auswählen
      </button>
      <p className="muted mt-1.5 text-[11px]">
        {hint ?? "oder hierher ziehen"} · max. {settings.attachmentMaxMb} MB je Datei · PDF, Bilder,
        Office, E-Mail, ZIP
      </p>
    </div>
  );
}

/** Liste noch nicht gespeicherter Dateien beim Anlegen einer Aufgabe. */
export function PendingFiles({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {files.map((f, i) => (
        <li
          key={`${f.name}-${i}`}
          className="line flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
          style={{ background: "var(--panel)" }}
        >
          <span className="flex-1 truncate">{f.name}</span>
          <span className="muted whitespace-nowrap text-[11px]">{formatBytes(f.size)}</span>
          <button type="button" className="btn btn-ghost" onClick={() => onRemove(i)} title="Entfernen">
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}

function Row({ task, attachment }: { task: Task; attachment: Attachment }) {
  const { attachmentUrl, removeAttachment, profileById, me, isAdmin } = useStore();
  const [holt, setHolt] = useState(false);

  // Kein dauerhafter Link: die Adresse wird beim Klick erzeugt und gilt
  // fuenf Minuten. Sonst waere ein einmal kopierter Link fuer immer offen.
  const oeffnen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setHolt(true);
    const url = await attachmentUrl(attachment.id);
    setHolt(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };
  const uploader = profileById(attachment.uploadedBy);
  const canRemove = isAdmin || attachment.uploadedBy === me.id || attachment.uploadedBy === null;

  return (
    <li
      className="line flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2 text-xs"
      style={{ background: "var(--panel)" }}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium" style={{ fontSize: "0.8125rem" }}>
          {attachment.fileName}
        </span>
        <span className="muted block text-[11px]">
          {formatBytes(attachment.sizeBytes)}
          {uploader ? ` · ${uploader.fullName}` : attachment.origin === "onoffice" ? " · aus onOffice" : ""}
          {` · ${formatDateTime(attachment.createdAt)}`}
          {attachment.onofficeFileId ? ` · Datei-ID ${attachment.onofficeFileId}` : ""}
        </span>
      </span>

      <SyncChip state={attachment.syncState} />

      {attachment.hasContent ? (
        <button type="button" className="btn" onClick={oeffnen} disabled={holt}>
          {holt ? "…" : "Öffnen"}
        </button>
      ) : (
        <span
          className="muted text-[11px]"
          title={
            attachment.syncState === "nur_onoffice"
              ? "Diese Datei hängt in onOffice an der Aufgabe. Ein Download über die API ist nicht dokumentiert."
              : "Zu diesem Eintrag liegt keine Datei im Speicher."
          }
        >
          {attachment.syncState === "nur_onoffice" ? "in onOffice" : "kein Inhalt"}
        </span>
      )}

      {canRemove && attachment.syncState !== "nur_onoffice" ? (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => removeAttachment(task.id, attachment.id)}
          title="Datei entfernen"
        >
          ✕
        </button>
      ) : null}
    </li>
  );
}

/** Dateibereich einer bestehenden Aufgabe: Liste plus Upload. */
export function AttachmentSection({ task }: { task: Task }) {
  const { addAttachments, settings } = useStore();
  const [rejected, setRejected] = useState<string[]>([]);

  const handle = async (files: File[]) => {
    setRejected([]);
    const res = await addAttachments(task.id, files);
    setRejected(res.rejected);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-xs font-semibold">Dateien</h3>
        <span className="muted text-[11px]">{task.attachments.length} Anhänge</span>
        {settings.attachmentPushOnoffice ? (
          <span className="muted text-[11px]">
            · neue Dateien werden nach onOffice an die Aufgabe gespiegelt
          </span>
        ) : (
          <span className="muted text-[11px]">· Spiegelung nach onOffice ist ausgeschaltet</span>
        )}
      </div>

      {task.attachments.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {task.attachments.map((a) => (
            <Row key={a.id} task={task} attachment={a} />
          ))}
        </ul>
      ) : null}

      <FileDrop onFiles={handle} />

      {rejected.length > 0 ? (
        <ul className="flex flex-col gap-0.5">
          {rejected.map((r) => (
            <li key={r} className="text-[11px] font-medium" style={{ color: "var(--err-fg)" }}>
              {r}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
