# Supportanfrage an onOffice: Feld „Tags" einer Aufgabe lesen

Stand: 28.09.2026 · einzureichen unter <https://apidoc.onoffice.de/support-form/>

## Worum es geht

Wir pflegen an jeder Aufgabe in onOffice ein Tag (Feld „Tags"), das
sagt, für wen die Arbeit gemacht wird. Ein eigenes Werkzeug spiegelt
die Aufgaben über die API und soll dieses Tag übernehmen, um die
Aufgabe automatisch dem richtigen Kollegen zuzuordnen.

Das Feld lässt sich über die API nicht lesen.

## Das Feld existiert in unserer Feldkonfiguration

Abgefragt mit `get` / `fields`, `parameters: { labels: true, language: "DEU", modules: ["task"] }`:

```
tags — Beschriftung "Tags" — Typ: multiselect
Erlaubte Werte: indMulti3818Select6324, indMulti3818Select6326, indMulti3818Select6328
```

## Was der Lesecall antwortet

Alle drei Versuche mit derselben Aufgabe, `get` / `task`,
`filter: { Nr: [{ op: "=", val: "32071" }] }`, `listlimit: 1`:

| `data` | Antwort |
| --- | --- |
| `["tags"]` | **Code 144** — `Invalid field in input data: "(0, tags)"` |
| alle 18 übrigen Felder, ohne `tags` | **geht** — die 18 Felder kommen zurück |
| dieselben 18 Felder **plus** `tags` | **Code 144** — `Invalid field in input data: "(18, tags)"` |
| kein `data` | geht, liefert aber keine Felder |

Der Aufruf ist also in Ordnung — abgelehnt wird genau dieses eine
Feld, und zwar unabhängig davon, an welcher Stelle es in `data` steht.

Zum Ausschluss eines Aufruffehlers: `recordids` kennt die
task-Ressource nicht (Code 144), weshalb wir über den Filter auf `Nr`
gehen. Das ist derselbe Weg, mit dem unser Abgleich seit Monaten alle
anderen Felder erfolgreich liest.

## Unsere Fragen

1. Muss das Feld `tags` für den API-Zugang gesondert freigeschaltet
   werden? Wenn ja: bitte für unseren Mandanten freischalten.
2. Falls es über `get` / `task` grundsätzlich nicht ausgelesen werden
   kann — gibt es einen anderen dokumentierten Weg, den an einer
   Aufgabe gesetzten Tag zu ermitteln?
3. Die erlaubten Werte heißen intern `indMulti3818Select6324` und
   ähnlich. Ist die Zuordnung dieser Schlüssel zu ihren
   Beschriftungen über `get` / `fields` (`labels: true`) der
   vorgesehene Weg, oder gibt es dafür einen eigenen Aufruf?

## Was wir währenddessen tun

Wir fragen `tags` beim Lesen nicht mehr mit — jede Anfrage mit diesem
Feld wurde abgelehnt und musste ohne es wiederholt werden, also jede
Aufgabe doppelt geholt. Ersatzweise lesen wir den Namen aus dem
Betreff („… Auftrag von Frau Spiolek"). Das ist ein Notbehelf und
trifft nur, wo der Name dort auch steht.
