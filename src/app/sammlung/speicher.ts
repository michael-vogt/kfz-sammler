/**
 * Schlüssel-Wert-Speicher für die Sammlung. Beide Implementierungen sind asynchron,
 * damit der Aufrufer nicht wissen muss, ob er im Browser oder in der App läuft.
 */
export interface Speicher {
  lesen(schluessel: string): Promise<string | null>;
  schreiben(schluessel: string, wert: string): Promise<void>;
  loeschen(schluessel: string): Promise<void>;
}

/** Web-Variante. Fehler (privater Modus, Speicher voll) werden bewusst geschluckt. */
export class LocalStorageSpeicher implements Speicher {
  async lesen(schluessel: string): Promise<string | null> {
    try {
      return localStorage.getItem(schluessel);
    } catch {
      return null;
    }
  }

  async schreiben(schluessel: string, wert: string): Promise<void> {
    try {
      localStorage.setItem(schluessel, wert);
    } catch {
      // Nicht verfügbar – die Sammlung gilt dann nur für diese Sitzung.
    }
  }

  async loeschen(schluessel: string): Promise<void> {
    try {
      localStorage.removeItem(schluessel);
    } catch {
      /* siehe oben */
    }
  }
}

/**
 * Native Variante über @capacitor/preferences. Landet unter Android in den
 * SharedPreferences und überlebt damit ein Leeren des WebView-Caches.
 */
export class PreferencesSpeicher implements Speicher {
  constructor(private readonly preferences: PreferencesApi) {}

  async lesen(schluessel: string): Promise<string | null> {
    const { value } = await this.preferences.get({ key: schluessel });
    return value ?? null;
  }

  async schreiben(schluessel: string, wert: string): Promise<void> {
    await this.preferences.set({ key: schluessel, value: wert });
  }

  async loeschen(schluessel: string): Promise<void> {
    await this.preferences.remove({ key: schluessel });
  }
}

/** Nur der Teil der Preferences-API, den wir tatsächlich verwenden. */
interface PreferencesApi {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

/**
 * Wählt die passende Implementierung. Der Import von Capacitor erfolgt dynamisch,
 * damit ein reiner Web-Build die Plugins nicht mitbündelt.
 */
export async function speicherErzeugen(): Promise<Speicher> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return new LocalStorageSpeicher();

    const { Preferences } = await import('@capacitor/preferences');
    return new PreferencesSpeicher(Preferences);
  } catch {
    // Capacitor nicht installiert (z. B. im reinen Web-Projekt oder im Test).
    return new LocalStorageSpeicher();
  }
}
