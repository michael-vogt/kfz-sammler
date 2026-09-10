/**
 * Gibt eine erzeugte Datei an den Nutzer aus. Im Browser als Download,
 * unter Android über das System-Teilen-Menü – ein Klick auf einen
 * Blob-Link bewirkt in der WebView nichts.
 */
export interface Ausgabe {
  /** Gibt false zurück, wenn der Nutzer den Vorgang abgebrochen hat. */
  bereitstellen(dateiname: string, inhalt: string, titel: string): Promise<boolean>;
}

/** Web-Variante: klassischer Download über eine Blob-URL. */
export class DownloadAusgabe implements Ausgabe {
  async bereitstellen(dateiname: string, inhalt: string): Promise<boolean> {
    const url = URL.createObjectURL(new Blob([inhalt], { type: 'application/json' }));
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = dateiname;
      link.click();
      return true;
    } finally {
      // Erst nach dem Klick freigeben, sonst bricht der Download ab.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

/**
 * Native Variante: Datei in den Cache schreiben und das Teilen-Menü öffnen.
 * Der Nutzer wählt dort selbst, wohin – Drive, Mail, Dateien-App.
 */
export class TeilenAusgabe implements Ausgabe {
  constructor(
    private readonly filesystem: FilesystemApi,
    private readonly share: ShareApi,
    private readonly cacheVerzeichnis: string,
    private readonly kodierung: string,
  ) {}

  async bereitstellen(dateiname: string, inhalt: string, titel: string): Promise<boolean> {
    const { uri } = await this.filesystem.writeFile({
      path: dateiname,
      data: inhalt,
      directory: this.cacheVerzeichnis,
      encoding: this.kodierung,
      recursive: true,
    });

    try {
      await this.share.share({ title: titel, files: [uri] });
      return true;
    } catch {
      // Share wirft auch beim Abbrechen durch den Nutzer – kein Fehlerfall.
      return false;
    }
  }
}

interface FilesystemApi {
  writeFile(options: {
    path: string;
    data: string;
    directory: string;
    encoding: string;
    recursive?: boolean;
  }): Promise<{ uri: string }>;
}

interface ShareApi {
  share(options: { title?: string; files?: string[] }): Promise<unknown>;
}

/** Wählt die passende Variante; Capacitor wird nur nativ geladen. */
export async function ausgabeErzeugen(): Promise<Ausgabe> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return new DownloadAusgabe();

    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    return new TeilenAusgabe(Filesystem as never, Share as never, Directory.Cache, Encoding.UTF8);
  } catch {
    return new DownloadAusgabe();
  }
}
