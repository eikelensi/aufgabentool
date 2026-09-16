"use client";

import { Fragment, useState } from "react";
import { useStore } from "@/lib/store";
import { EmptyState, formatDateTime } from "@/components/ui";
import { NOTIFY_LABEL, type NotifyKind } from "@/lib/types";

export default function ProtokollPage() {
  const { isAdmin, notifications } = useStore();
  const [kind, setKind] = useState<"" | NotifyKind>("");
  const [open, setOpen] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <p className="muted text-sm">
        Das Benachrichtigungsprotokoll ist Admins vorbehalten. Wechsle oben rechts den Demo-Benutzer.
      </p>
    );
  }

  const rows = notifications.filter((n) => !kind || n.kind === kind);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <h1 className="text-lg font-semibold">Mail-Protokoll</h1>
        <p className="muted text-xs">
          Jede automatische Mail wird mit einem eindeutigen Dedupe-Schlüssel protokolliert – derselbe
          Anlass kann kein zweites Mal versendet werden.
        </p>
      </div>

      <select
        className="field mb-3"
        style={{ width: 260 }}
        value={kind}
        onChange={(e) => setKind(e.target.value as "" | NotifyKind)}
      >
        <option value="">Alle Anlässe</option>
        {(Object.keys(NOTIFY_LABEL) as NotifyKind[]).map((k) => (
          <option key={k} value={k}>
            {NOTIFY_LABEL[k]}
          </option>
        ))}
      </select>

      {rows.length === 0 ? (
        <EmptyState text="Noch keine Benachrichtigungen. Verschiebe eine Aufgabe oder simuliere im Adminbereich den täglichen Lauf." />
      ) : (
        <div className="panel scroll-x">
          <table className="w-full text-left text-[13px]">
            <thead className="muted text-[11px] uppercase tracking-wide">
              <tr className="line border-b">
                <th className="px-3 py-2 font-medium">Zeit</th>
                <th className="px-3 py-2 font-medium">Anlass</th>
                <th className="px-3 py-2 font-medium">Empfänger</th>
                <th className="px-3 py-2 font-medium">Betreff</th>
                <th className="px-3 py-2 font-medium">Weg</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <Fragment key={n.id}>
                  <tr
                    className="line cursor-pointer border-b last:border-0"
                    onClick={() => setOpen(open === n.id ? null : n.id)}
                  >
                    <td className="muted whitespace-nowrap px-3 py-2 text-[11px]">
                      {formatDateTime(n.createdAt)}
                    </td>
                    <td className="px-3 py-2">{NOTIFY_LABEL[n.kind]}</td>
                    <td className="px-3 py-2">
                      {n.recipientName}
                      <span className="muted block text-[11px]">{n.recipient}</span>
                    </td>
                    <td className="px-3 py-2">{n.subject}</td>
                    <td className="px-3 py-2">
                      <span className="chip" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
                        {n.provider === "onoffice" ? "onOffice" : n.provider === "smtp" ? "SMTP" : "Log"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="chip" style={{ background: "#dcfce7", color: "#15803d" }}>
                        {n.status === "sent" ? "versendet" : n.status}
                      </span>
                    </td>
                  </tr>
                  {open === n.id ? (
                    <tr className="line border-b last:border-0">
                      <td colSpan={6} className="px-3 py-3" style={{ background: "var(--panel-2)" }}>
                        <p className="muted mb-1 text-[11px]">
                          Aufgabe: {n.taskTitle} · Dedupe-Schlüssel: <code>{n.dedupeKey}</code>
                        </p>
                        <pre className="whitespace-pre-wrap text-[12px] leading-relaxed">{n.body}</pre>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
