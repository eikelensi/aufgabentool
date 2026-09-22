"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Field } from "@/components/ui";
import { NOTIFY_LABEL, type Category, type NotifyKind } from "@/lib/types";
import type { Anbindung } from "./anbindung";

export default function EinstellungenFormular({ anbindung }: { anbindung: Anbindung }) {
  const {
    isAdmin,
    categories,
    upsertCategory,
    removeCategory,
    moveCategory,
    templates,
    updateTemplate,
    settings,
    updateSettings,
    runEscalationJob,
    runAttachmentSync,
    brokers,
  } = useStore();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#88cc44");
  const [jobResult, setJobResult] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [openTpl, setOpenTpl] = useState<NotifyKind | null>(null);

  if (!isAdmin) {
    return (
      <p className="muted text-sm">
        Der Adminbereich ist Admins und Vorgesetzten vorbehalten. Wechsle oben rechts den
        Vorgesetzten.
      </p>
    );
  }

  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  const addCategory = () => {
    if (!newName.trim()) return;
    const cat: Category = {
      id: `c-${Math.random().toString(36).slice(2, 8)}`,
      name: newName.trim(),
      color: newColor,
      sortOrder: (sorted.at(-1)?.sortOrder ?? 0) + 10,
      isActive: true,
    };
    upsertCategory(cat);
    setNewName("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <h1 className="text-lg font-semibold lg:col-span-2">Einstellungen</h1>


      {/* -------------------------------------------------- Kategorien */}
      <section className="panel p-4">
        <h2 className="mb-1 text-sm font-semibold">Kategorien und Farben</h2>
        <p className="muted mb-3 text-[11px]">
          Frei anlegbar, umbenennbar, farblich änderbar, sortierbar und löschbar – jederzeit, auch
          täglich. Diese Kategorien bleiben intern und werden nicht nach onOffice synchronisiert.
        </p>

        <ul className="mb-3 space-y-1.5">
          {sorted.map((c, i) => (
            <li key={c.id} className="line flex items-center gap-2 rounded-lg border p-1.5">
              <input
                type="color"
                value={c.color}
                onChange={(e) => upsertCategory({ ...c, color: e.target.value })}
                style={{ width: 28, height: 28, border: "none", background: "none", padding: 0 }}
                title="Farbe wählen"
              />
              <input
                className="field"
                style={{ flex: 1 }}
                value={c.name}
                onChange={(e) => upsertCategory({ ...c, name: e.target.value })}
              />
              <label className="muted flex items-center gap-1 text-[11px]">
                <input
                  type="checkbox"
                  checked={c.isActive}
                  onChange={(e) => upsertCategory({ ...c, isActive: e.target.checked })}
                />
                aktiv
              </label>
              <button className="btn btn-ghost" disabled={i === 0} onClick={() => moveCategory(c.id, -1)}>
                ↑
              </button>
              <button
                className="btn btn-ghost"
                disabled={i === sorted.length - 1}
                onClick={() => moveCategory(c.id, 1)}
              >
                ↓
              </button>
              <button
                className="btn btn-ghost"
                title="Löschen – betroffene Aufgaben behalten ihre Daten und stehen dann ohne Kategorie da."
                onClick={() => removeCategory(c.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-end gap-2">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            style={{ width: 32, height: 32, border: "none", background: "none", padding: 0 }}
          />
          <input
            className="field"
            placeholder="Neue Kategorie"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
          <button className="btn btn-primary" onClick={addCategory}>
            Anlegen
          </button>
        </div>
      </section>

      {/* ------------------------------------------- Fristen & Versand */}
      <section className="panel p-4">
        <h2 className="mb-1 text-sm font-semibold">Erinnerungen, Eskalation und Versand</h2>
        <p className="muted mb-3 text-[11px]">
          Der tägliche Lauf prüft offene Aufgaben. Sobald eine Aufgabe erledigt oder auf „In
          Bearbeitung“ gesetzt wird, stoppt die Eskalation sofort.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Erinnerung an den Bearbeiter nach (Tagen)">
            <input
              type="number"
              min={1}
              className="field"
              value={settings.reminderDays}
              onChange={(e) => updateSettings({ reminderDays: Number(e.target.value) })}
            />
          </Field>
          <Field label="Eskalation an Ersteller/Admin nach (Tagen)">
            <input
              type="number"
              min={1}
              className="field"
              value={settings.escalationDays}
              onChange={(e) => updateSettings({ escalationDays: Number(e.target.value) })}
            />
          </Field>
          <Field label="Erledigte ausblenden nach (Stunden)">
            <input
              type="number"
              min={1}
              className="field"
              value={settings.doneHideAfterHours}
              onChange={(e) => updateSettings({ doneHideAfterHours: Number(e.target.value) })}
            />
          </Field>
          <Field label="Versandweg">
            <select
              className="field"
              value={settings.mailProvider}
              onChange={(e) =>
                updateSettings({ mailProvider: e.target.value as typeof settings.mailProvider })
              }
            >
              <option value="onoffice">onOffice (sendmail)</option>
              <option value="smtp">SMTP-Fallback</option>
              <option value="log">Nur protokollieren</option>
            </select>
          </Field>
          <Field
            label="onOffice E-Mail-Identität"
            hint="Pflichtparameter „emailidentity“; das Postfach muss dem API-Benutzer zugeordnet sein."
          >
            <input
              className="field"
              value={settings.onofficeEmailIdentity}
              onChange={(e) => updateSettings({ onofficeEmailIdentity: e.target.value })}
            />
          </Field>
          <Field label="SMTP-Absender (Fallback)">
            <input
              className="field"
              value={settings.smtpFrom}
              onChange={(e) => updateSettings({ smtpFrom: e.target.value })}
            />
          </Field>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            className="btn btn-primary"
            onClick={async () => {
              setJobResult("Läuft…");
              const r = await runEscalationJob();
              setJobResult(
                r.meldung ??
                  `${r.reminders} Erinnerung(en) und ${r.escalations} Eskalationsmail(s) versendet. ` +
                    "Bereits versendete Anlässe wurden über den Dedupe-Schlüssel übersprungen.",
              );
            }}
          >
            Täglichen Lauf jetzt starten
          </button>
          {jobResult ? <p className="muted text-[11px]">{jobResult}</p> : null}
        </div>
      </section>

      {/* -------------------------------------------------- Dateien */}
      <section className="panel p-4">
        <h2 className="mb-1 text-sm font-semibold">Dateien an Aufgaben</h2>
        <p className="muted mb-3 text-[11px]">
          Dateien liegen im Echtbetrieb in einem privaten Supabase-Bucket; Downloads laufen über
          signierte Links mit kurzer Laufzeit. Neue Dateien können zusätzlich an die onOffice-Aufgabe
          gehängt werden.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Obergrenze je Datei (MB)">
            <input
              type="number"
              min={1}
              max={200}
              className="field"
              value={settings.attachmentMaxMb}
              onChange={(e) => updateSettings({ attachmentMaxMb: Number(e.target.value) })}
            />
          </Field>
          <Field
            label="Dateityp „Art“ in onOffice"
            hint="Parameter beim Zuordnen der hochgeladenen Datei."
          >
            <input
              className="field"
              value={settings.attachmentDefaultArt}
              onChange={(e) => updateSettings({ attachmentDefaultArt: e.target.value })}
            />
          </Field>
        </div>

        <label className="mt-3 flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={settings.attachmentPushOnoffice}
            onChange={(e) => updateSettings({ attachmentPushOnoffice: e.target.checked })}
          />
          <span>
            Neue Dateien nach onOffice spiegeln (<code>uploadfile</code> mit
            <code> module=task</code>). Ausgeschaltet bleiben Anhänge ausschließlich im Aufgabentool.
          </span>
        </label>

        <div className="mt-3 flex items-center gap-2">
          <button
            className="btn btn-primary"
            onClick={async () => {
              setSyncResult("Läuft…");
              const r = await runAttachmentSync();
              setSyncResult(
                r.meldung ??
                  (r.pushed === 0
                    ? "Keine Datei in der Warteschlange."
                    : `${r.pushed} Datei(en) nach onOffice übertragen und mit Datei-ID versehen.`),
              );
            }}
          >
            Datei-Warteschlange jetzt übertragen
          </button>
          {syncResult ? <p className="muted text-[11px]">{syncResult}</p> : null}
        </div>

        <div className="line mt-3 rounded-lg border p-2 text-[11px]" style={{ background: "var(--panel-2)" }}>
          <p className="mb-1 font-semibold">Grenze der Schnittstelle</p>
          <p className="muted">
            Hochladen und Löschen von Aufgaben-Dateien ist in der onOffice-API dokumentiert. Ein
            Lesen oder Herunterladen der Dateien einer Aufgabe ist es nicht – für Objekte und
            Adressen gibt es solche Calls, für Aufgaben nicht. Dateien, die jemand direkt in onOffice
            an die Aufgabe hängt, erscheinen deshalb als „nur in onOffice“ und ohne Inhalt.
          </p>
        </div>
      </section>

      {/* --------------------------------------------- Mail-Vorlagen */}
      <section className="panel p-4">
        <h2 className="mb-1 text-sm font-semibold">E-Mail-Vorlagen</h2>
        <p className="muted mb-3 text-[11px]">
          Zentral pflegbar. Platzhalter: <code>{"{{titel}}"}</code> <code>{"{{empfaenger}}"}</code>{" "}
          <code>{"{{bearbeiter}}"}</code> <code>{"{{ersteller}}"}</code> <code>{"{{notiz}}"}</code>{" "}
          <code>{"{{objekt}}"}</code> <code>{"{{datum}}"}</code> <code>{"{{tage}}"}</code>
        </p>
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.key} className="line rounded-lg border p-2">
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-ghost"
                  onClick={() => setOpenTpl(openTpl === t.key ? null : t.key)}
                >
                  {openTpl === t.key ? "▾" : "▸"}
                </button>
                <span className="flex-1 text-[13px] font-medium">{NOTIFY_LABEL[t.key]}</span>
                <label className="muted flex items-center gap-1 text-[11px]">
                  <input
                    type="checkbox"
                    checked={t.isActive}
                    onChange={(e) => updateTemplate(t.key, { isActive: e.target.checked })}
                  />
                  aktiv
                </label>
              </div>
              {openTpl === t.key ? (
                <div className="mt-2 grid gap-2">
                  <Field label="Betreff">
                    <input
                      className="field"
                      value={t.subject}
                      onChange={(e) => updateTemplate(t.key, { subject: e.target.value })}
                    />
                  </Field>
                  <Field label="Text">
                    <textarea
                      className="field"
                      rows={7}
                      value={t.body}
                      onChange={(e) => updateTemplate(t.key, { body: e.target.value })}
                    />
                  </Field>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* --------------------------------------------- onOffice */}
      <section className="panel p-4">
        <h2 className="mb-1 text-sm font-semibold">onOffice-Anbindung</h2>
        <p className="muted mb-3 text-[11px] leading-relaxed">
          Kein Wunschzettel, sondern der gemessene Zustand. Was hier rot steht,
          hat die Schnittstelle dieses Mandanten tatsächlich abgelehnt.
        </p>

        <ul className="space-y-1.5 text-xs">
          {anbindung.zeilen.map((z) => (
            <StatusRow key={z.label} label={z.label} state={z.zustand} note={z.hinweis} />
          ))}
        </ul>

        <div className="line mt-3 border-t pt-3 text-[11px]">
          <p className="mb-1 font-semibold">Statusabbildung onOffice ↔ Aufgabentool</p>
          <p className="muted">
            Links der Wert aus onOffice, rechts unserer: „Nicht begonnen“ →{" "}
            <strong>Offen</strong> · „In Bearbeitung“ → <strong>Rückfragen offen</strong> ·
            „Erledigt“ → <strong>Erledigt</strong> · „Zurückgestellt“ →{" "}
            <strong>Offen</strong> (der Begriff entfällt bei uns, die Aufgabe bleibt
            sichtbar).
          </p>
        </div>
</section>
    </div>
  );
}

function StatusRow({
  label,
  state,
  note,
}: {
  label: string;
  state: "bereit" | "offen" | "prüfen" | "nicht möglich";
  note: string;
}) {
  const style =
    state === "bereit"
      ? { background: "#dcfce7", color: "#15803d" }
      : state === "prüfen"
        ? { background: "#fef3c7", color: "#b45309" }
        : state === "nicht möglich"
          ? // Grau, nicht rot: hier fehlt nichts, was noch kommen könnte.
            { background: "var(--panel-2)", color: "var(--muted)" }
          : { background: "#fee2e2", color: "#b91c1c" };
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="chip" style={style}>
        {state}
      </span>
      <span>{label}</span>
      <span className="muted text-[11px]">— {note}</span>
    </li>
  );
}
