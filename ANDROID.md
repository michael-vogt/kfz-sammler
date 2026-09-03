# Android-App aus der Angular-Anwendung

Die App wird mit [Capacitor](https://capacitorjs.com) in eine native Hülle gepackt. Der
Angular-Code bleibt unverändert; Capacitor legt daneben ein echtes Android-Studio-Projekt an,
das du später auch anfassen kannst.

## Voraussetzungen

| Werkzeug | Version | Hinweis |
|---|---|---|
| Node.js | 20 oder neuer | für Angular und die Capacitor-CLI |
| JDK | 21 (Temurin) | Android Gradle Plugin 8.x |
| Android Studio | aktuell | bringt SDK und Emulator mit |

In Android Studio unter *SDK Manager* das **Android SDK Platform 35** und die
**Android SDK Build-Tools** installieren. Danach `ANDROID_HOME` setzen:

```bash
# Linux/macOS – in ~/.zshrc oder ~/.bashrc
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

## Einrichtung (einmalig)

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/app @capacitor/status-bar @capacitor/splash-screen @capacitor/preferences
npx cap init "KFZ-Kennzeichen" de.example.kfzkennzeichen --web-dir dist/kfz-kennzeichen/browser
```

`cap init` erzeugt eine `capacitor.config.ts` – ersetze sie durch die beiliegende Fassung.
Wichtig ist dort vor allem `webDir`: Angular 17+ legt den Build unter
`dist/<projektname>/browser` ab, ältere Versionen direkt unter `dist/<projektname>`. Prüfe nach
dem ersten `ng build`, wo die `index.html` tatsächlich liegt, und passe den Pfad an.

Danach die Anwendungs-ID anpassen. `de.example.kfzkennzeichen` ist ein Platzhalter und wird von
Google Play abgelehnt – nimm eine Domain, die dir gehört, oder etwas wie
`de.deinname.kfzkennzeichen`. Die ID lässt sich nach der ersten Veröffentlichung **nicht mehr
ändern**, deshalb jetzt entscheiden.

```bash
ng build
npx cap add android
npx cap sync
```

## Bauen und testen

```bash
ng build && npx cap sync && npx cap open android
```

Android Studio öffnet sich mit dem Projekt. Über *Run* landet die App auf einem angeschlossenen
Gerät oder im Emulator. Für den schnellen Durchlauf ohne Android Studio:

```bash
ng build && npx cap sync && npx cap run android
```

Praktisch als npm-Skripte in der `package.json`:

```jsonc
{
  "scripts": {
    "android": "ng build && cap sync && cap run android",
    "android:open": "ng build && cap sync && cap open android"
  }
}
```

## Signiertes Release

```bash
# Schlüssel erzeugen – NUR auf deinem Rechner, gut sichern und nie ins Repository legen.
keytool -genkey -v -keystore kfz-release.keystore \
        -alias kfz -keyalg RSA -keysize 2048 -validity 10000
```

Geht dieser Schlüssel verloren, kannst du deine App im Play Store nicht mehr aktualisieren.
Lege eine Sicherungskopie an einem anderen Ort an, zusammen mit den Passwörtern.

In `android/key.properties` (in die `.gitignore` aufnehmen):

```properties
storeFile=../../kfz-release.keystore
storePassword=…
keyAlias=kfz
keyPassword=…
```

Anschliessend in Android Studio über *Build → Generate Signed App Bundle* das AAB erzeugen,
oder auf der Kommandozeile:

```bash
cd android && ./gradlew bundleRelease
```

Für die Installation ausserhalb des Play Store reicht ein APK:

```bash
cd android && ./gradlew assembleRelease
# Ergebnis: android/app/build/outputs/apk/release/app-release.apk
```

## Icon und Splashscreen

```bash
npm install -D @capacitor/assets
mkdir -p assets
# assets/icon.png     1024×1024
# assets/splash.png   2732×2732, Motiv mittig
npx capacitor-assets generate --android
```

## Datenspeicherung

Die Sammlung liegt unter Android in den SharedPreferences (`@capacitor/preferences`) und
überlebt damit ein Leeren des WebView-Caches. Im Browser wird weiterhin `localStorage`
verwendet; welche Variante greift, entscheidet `speicherErzeugen()` in
`src/app/sammlung/speicher.ts` anhand von `Capacitor.isNativePlatform()`.

Beim ersten Start der nativen App wird eine eventuell im WebView-`localStorage` vorhandene
Sammlung automatisch übernommen. Der alte Eintrag bleibt dabei bestehen, damit ein Wechsel
zurück zum Web-Build nichts verliert.

Eine Deinstallation löscht die Daten weiterhin vollständig – dagegen hilft nur der Export.

## Bekannte Stolpersteine

Landen die Kennzeichendaten nicht in der App, fehlt meist das `public/`-Verzeichnis im Build.
Prüfe, dass `ng build` die JSON-Dateien nach `dist/…/browser/data/` kopiert; andernfalls in der
`angular.json` unter `architect.build.options.assets` ergänzen.

Änderungen am Angular-Code erscheinen erst nach `npx cap sync` in der App – `cap sync` kopiert
den Build in das Android-Projekt. Ein reines `ng build` genügt nicht.
