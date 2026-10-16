/**
 * Liest QR-Codes mit der Kamera, über die `BarcodeDetector`-Schnittstelle der
 * WebView. Die ist in Chromium – und damit in der Android-WebView – vorhanden,
 * aber nicht in jedem Browser. Fehlt sie, bleibt das Einfügen als Text.
 */

interface ErkannterCode {
  rawValue: string;
}

interface BarcodeDetectorArt {
  detect(quelle: CanvasImageSource): Promise<ErkannterCode[]>;
}

interface BarcodeDetectorKonstruktor {
  new (optionen?: { formats?: string[] }): BarcodeDetectorArt;
  getSupportedFormats?(): Promise<string[]>;
}

function detektorKlasse(): BarcodeDetectorKonstruktor | null {
  const w = globalThis as unknown as { BarcodeDetector?: BarcodeDetectorKonstruktor };
  return w.BarcodeDetector ?? null;
}

/** Ob dieses Gerät überhaupt scannen kann. */
export function scannenMoeglich(): boolean {
  return detektorKlasse() !== null && !!navigator.mediaDevices?.getUserMedia;
}

export type ScannerFehler = 'nicht-unterstuetzt' | 'kein-zugriff' | 'keine-kamera';

export class KamerascannerFehler extends Error {
  constructor(
    readonly art: ScannerFehler,
    nachricht: string,
  ) {
    super(nachricht);
  }
}

/**
 * Ein laufender Scanvorgang. Muss immer über `beenden()` aufgeräumt werden,
 * sonst bleibt die Kamera des Geräts aktiv.
 */
export class Kamerascanner {
  private strom: MediaStream | null = null;
  private laeuft = false;

  constructor(private readonly video: HTMLVideoElement) {}

  /**
   * Startet die Kamera und ruft `beiTreffer` auf, sobald ein QR-Code erkannt
   * wurde. Danach läuft der Scanner weiter, bis `beenden()` gerufen wird –
   * der Aufrufer entscheidet, ob ein Treffer reicht.
   */
  async starten(beiTreffer: (wert: string) => void): Promise<void> {
    const Detektor = detektorKlasse();
    if (!Detektor || !navigator.mediaDevices?.getUserMedia) {
      throw new KamerascannerFehler(
        'nicht-unterstuetzt',
        'Dieses Gerät kann im Browser keine QR-Codes lesen.',
      );
    }

    try {
      this.strom = await navigator.mediaDevices.getUserMedia({
        // Rückkamera bevorzugen, aber notfalls jede nehmen.
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch (fehler) {
      const name = (fehler as { name?: string })?.name;
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        throw new KamerascannerFehler('keine-kamera', 'Keine Kamera gefunden.');
      }
      throw new KamerascannerFehler(
        'kein-zugriff',
        'Kein Zugriff auf die Kamera. Erlaube der App den Kamerazugriff in den Einstellungen.',
      );
    }

    this.video.srcObject = this.strom;
    this.video.setAttribute('playsinline', 'true');
    this.video.muted = true;
    await this.video.play();

    const detektor = new Detektor({ formats: ['qr_code'] });
    this.laeuft = true;

    const schauen = async () => {
      if (!this.laeuft) return;
      try {
        if (this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const treffer = await detektor.detect(this.video);
          if (treffer.length && this.laeuft) beiTreffer(treffer[0].rawValue);
        }
      } catch {
        // Einzelne fehlgeschlagene Bilder sind normal – einfach weitersuchen.
      }
      if (this.laeuft) setTimeout(schauen, 200);
    };
    void schauen();
  }

  /** Hält den Scanner an und schaltet die Kamera ab. */
  beenden(): void {
    this.laeuft = false;
    for (const spur of this.strom?.getTracks() ?? []) spur.stop();
    this.strom = null;
    this.video.srcObject = null;
  }
}
