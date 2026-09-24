# Supportanfrage an onOffice: Dateien einer Aufgabe lesen

Stand: 24.09.2026 · einzureichen unter <https://apidoc.onoffice.de/support-form/>

## Worum es geht

Das Aufgabentool spiegelt Aufgaben zwischen onOffice und einer eigenen
Oberfläche. Dateien gehen bisher nur in EINE Richtung: hochladen und
löschen funktionieren, lesen nicht. Damit ist das Tool bei Anhängen die
führende Ablage — gewollt war ein Abgleich in beide Richtungen.

## Was geht

| Vorgang | Aufruf | Ergebnis |
| --- | --- | --- |
| Hochladen | `do` / `uploadfile` mit `{ data: <base64> }` | liefert `tmpUploadId` |
| Zuordnen | `do` / `uploadfile` mit `{ tmpUploadId, module: "task", relatedRecordId, Art }` | Datei hängt an der Aufgabe |
| Löschen | `delete` / `fileRelation` mit `{ relationtype: "task", parentid, fileId }` | Datei ist weg |
| Datei-IDs finden | `get` / `idsfromrelation` mit `relationtype: "...:task:file:attachment"` | die IDs kommen |

Die Dateien sind also da, und wir kennen ihre Nummern.

## Was nicht geht

Den INHALT (oder eine Download-URL) zu dieser Datei-ID zu bekommen.
Geprüft, jeweils mit der Datei-ID 190639, die über
`idsfromrelation` als Anhang der Aufgabe geliefert wurde:

| Versuch | Antwort |
| --- | --- |
| `get` / `file` / `resourceid: "task"` mit `{ taskid }` | Code 24 — `missing configuration for resourceId "task"` |
| `get` / `file` ohne `resourceid`, mit `{ fileid: 190639 }` | Code 24 — `missing configuration for resourceId ""` |
| `get` / `file` / `resourceid: "190639"` | Code 24 |
| `get` / `idsfromrelation` rückwärts über `estate:allFiles` mit `childids` | Code 199 — `Not implemented` |
| `get` / `idsfromrelation` rückwärts über `address:file:attachment` mit `childids` | leer |
| `get` / `file` / `resourceid: "estate"` bzw. `"address"` | kein Datensatz, die Datei hängt ja an der Aufgabe |

In der Dokumentation gibt es „Get Estate files" und „Get Address
files", aber kein Gegenstück „Get Task files" — obwohl der Upload
ausdrücklich `module: "task"` erlaubt und das Löschen über
`fileRelation` mit `relationtype: "task"` dokumentiert ist.

## Unsere Fragen

1. Gibt es einen Weg, zu einer über `idsfromrelation`
   (`...:relationTypes:task:file:attachment`) gelieferten Datei-ID den
   Inhalt oder eine temporäre Download-URL zu bekommen? Wenn ja: welche
   `action`, welcher `resourcetype`, welche `resourceid` und welche
   Parameter?
2. Falls nein: ist das für die Schnittstelle vorgesehen, und gibt es
   einen Zeitplan? Hochladen und Löschen ohne Lesen ist für einen
   Abgleich in beide Richtungen zu wenig.
3. Muss für `resourceid: "task"` am Modul „file" etwas im Mandanten
   freigeschaltet werden? Die Meldung „missing configuration for
   resourceId" liest sich wie eine fehlende Konfiguration, nicht wie
   eine fehlende Funktion.

## Nebenbei, zwei kleinere Punkte

4. **Feld `tags` an der Aufgabe.** Es ist in unserer
   Feldkonfiguration am Modul Aufgabe vorhanden, der Lesecall
   (`read` / `task`, Feld in `parameters.data`) lehnt es aber mit
   „Invalid field in input data" ab. Muss es für die Schnittstelle
   gesondert freigeschaltet werden?
5. **`relatedEstateId` / `relatedAddressId` beim Lesen.** Die
   Dokumentation zeigt sie im Beispiel-Response einer Aufgabe. Bei uns
   kommen sie im Listenabruf (`read` / `task` mit `filter` auf
   `modified`) nie mit — auch dann nicht, wenn in onOffice sichtbar ein
   Objekt an der Aufgabe hängt. Werden sie nur bei der Abfrage eines
   einzelnen Datensatzes geliefert?

## Mandant

- API-Token: (beim Absenden eintragen — NICHT das Secret)
- Beispielaufgabe mit Anhang: (Aufgabennummer eintragen)
- Beispiel-Datei-ID: 190639
