# KFZ-Kennzeichen erklärt

Angular-Anwendung, die deutsche KFZ-Kennzeichen aufschlüsselt: Stadt/Kreis, Herleitung des
Unterscheidungszeichens, Bundesland, Fußnoten des Kraftfahrt-Bundesamts, Sonder- und
auslaufende Kennzeichen sowie eine Erläuterung der Erkennungsnummer (E, H, Saison, rote Nummern).

## Einrichtung

```bash
ng new kfz-kennzeichen --style=scss --ssr=false --zoneless
cd kfz-kennzeichen
```

Anschliessend die Dateien aus diesem Paket übernehmen:

| Ziel im Projekt | Inhalt |
|---|---|
| `src/app/kennzeichen/` | Modelle, Parser, Service, Komponenten |
| `src/app/sammlung/` | Sammlung gesehener Zeichen (Service, Ansicht) |
| `src/app/app.ts`, `src/app/app.config.ts` | Wurzelkomponente und Konfiguration |
| `public/data/*.json` | Konvertierte Daten |
| `tools/convert.mjs` | CSV → JSON-Konverter |

Bei einer Angular-Version vor 20 heissen die Wurzeldateien `app.component.ts`
(Klasse `AppComponent`); Assets liegen dort unter `src/assets/` statt `public/` – in dem Fall
in `kennzeichen.service.ts` die Konstante `BASIS` auf `'assets/data'` setzen.

```bash
ng serve
```

## Daten aktualisieren

```bash
git clone https://github.com/openpotato/kfz-kennzeichen.git /tmp/kfz
node tools/convert.mjs /tmp/kfz/src/de public/data
```

Der Konverter liest die vier CSV-Dateien und erzeugt `kennzeichen.json`,
`auslaufend.json`, `sonderkennzeichen.json` und `fussnoten.json`.

## Sammlung

Jeder Treffer lässt sich über „Gesehen“ in eine persönliche Sammlung aufnehmen. Der Reiter
*Sammlung* zeigt den Fortschritt insgesamt und je Bundesland (inklusive der noch fehlenden
Zeichen), erlaubt eine Notiz je Sichtung und bietet Export und Import als JSON. Der Export läuft im
Browser als Download, unter Android über das Teilen-Menü (`sammlung/ausgabe.ts`).

Gespeichert wird unter dem Schlüssel `kfz-sammlung.v1`, im Browser via `localStorage`, in der
Android-App via `@capacitor/preferences`. Die Auswahl trifft `speicherErzeugen()` in
`sammlung/speicher.ts`; für Tests lässt sich der Speicher über den `SPEICHER`-Token ersetzen.

Weil das Lesen asynchron ist, zeigt `SammlungService.geladen()` an, ob der Bestand schon
vorliegt. Bei einem künftigen Formatwechsel die Versionsnummer im Schlüssel erhöhen und beim
Laden migrieren.

## Tests

```bash
ng test
```

`kennzeichen.parser.spec.ts` deckt die Trennlogik (mit und ohne Bindestrich), die
Fußnotenauflösung, Sonder- und auslaufende Kennzeichen sowie die Erkennungsnummer ab.

## Single-File-Variante für unterwegs

`kennzeichen.html` enthält App, Styles und alle Daten in einer Datei (rund 136 KB) und läuft
ohne Server und ohne Internetverbindung. Neu bauen nach einer Datenaktualisierung:

```bash
node tools/bauen.mjs   # liest public/data/*.json und tools/vorlage.html
```

Die Logik ist eine Portierung von `kennzeichen.parser.ts` nach Vanilla-JS. Änderungen an der
Analyse müssen daher an beiden Stellen gepflegt werden.

## Karte

Der Reiter *Karte* zeigt alle 402 Landkreise, eingefärbt nach Sammelstand: vollständig,
teilweise, noch nichts. Ein Tippen auf einen Kreis listet seine Unterscheidungszeichen; ein
Tippen auf ein Zeichen springt zur Suche.

Die Geometrie stammt aus
[m-ad/geofeatures-ags-germany](https://github.com/m-ad/geofeatures-ags-germany) (GADM-Daten).
`tools/kreise_bauen.py` projiziert und vereinfacht sie beim Bauen zu fertigen SVG-Pfaden, damit
die App keine Geo-Bibliothek braucht:

```bash
python3 tools/kreise_bauen.py pfad/zu/counties.json public/data/kennzeichen.json public/data/kreise.json
```

Ergebnis: rund 320 KB, geladen erst beim ersten Öffnen des Reiters.

Die Karte lässt sich zoomen und verschieben: zwei Finger beziehungsweise Mausrad zum Zoomen,
wischen oder ziehen zum Verschieben, dazu Knöpfe für Tastatur- und Mausbedienung. Der Zustand
liegt in `karte/kartenblick.ts`; gerechnet wird in Nutzereinheiten der viewBox, sodass der
Punkt unter dem Finger beim Zoomen ortsfest bleibt.

### Grenzen der Zuordnung

Die Kennzeichendaten enthalten keinen amtlichen Kreisschlüssel, nur Klartextnamen. Die
Zuordnung läuft deshalb über Namensabgleich plus eine Korrekturtabelle (`KORREKTUREN` im
Skript) für Schreibvarianten und Gebietsreformen. Aktuell sind alle 714 Zeichen zugeordnet.

Drei Einschränkungen bleiben:

- Wo Stadt und Landkreis denselben Namen tragen (23 Fälle, etwa München oder Rostock), landen
  die Zeichen auf beiden Flächen. Optisch fällt das nicht auf, fachlich ist es unscharf.
- Die Geometrie bildet den Stand vor einigen Kreisreformen ab; *Osterode am Harz* und
  *Eisenach* existieren dort noch als eigene Kreise, führen aber keine Zeichen mehr.
- Ändert sich `kennzeichen.csv`, muss die Korrekturtabelle geprüft werden. Das Skript meldet
  am Ende, welche Zeichen ohne Zuordnung geblieben sind.

## Android-App

Siehe [ANDROID.md](ANDROID.md). Die Angular-App wird per Capacitor verpackt; zusätzlich nötig
sind `capacitor.config.ts` und `src/app/plattform.service.ts` (Zurück-Taste, Statusleiste).

## Datenquelle

[openpotato/kfz-kennzeichen](https://github.com/openpotato/kfz-kennzeichen) – bitte die
Lizenzbedingungen des Repositorys beachten.
