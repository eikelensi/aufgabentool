/**
 * Platzhalter in Vorlagen füllen. Absichtlich ohne Regex-Engine:
 * die Vorlagen kommen aus der Datenbank und sollen nichts ausführen können.
 */

export type TemplateVars = Record<string, string>;

export function render(template: string, vars: TemplateVars): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split("{{" + key + "}}").join(value);
  }
  // Nicht gefüllte Platzhalter entfernen, damit keine {{…}} in Mails landen.
  return out.replace(/\{\{[a-z_]+\}\}/gi, "");
}

/** Einfacher HTML-Körper aus Text, ohne Fremdinhalte einzubetten. */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<div style="font:14px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a1f18">
${escaped.replace(/\n/g, "<br>")}
</div>`;
}
