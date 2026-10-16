import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AbgleichService } from './abgleich.service';
import { SammelcodeFehler } from './sammelcode';
import { Kamerascanner, KamerascannerFehler, scannenMoeglich } from './kamerascanner';

type Meldung = { art: 'erfolg' | 'hinweis' | 'fehler'; text: string };

@Component({
  selector: 'app-abgleich',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './abgleich.component.html',
  styleUrl: './abgleich.component.scss',
})
export class AbgleichComponent implements OnDestroy {
  private readonly abgleich = inject(AbgleichService);

  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');

  protected readonly bereit = this.abgleich.bereit;
  protected readonly code = this.abgleich.eigenerCode;
  protected readonly qr = this.abgleich.eigenesQr;

  /**
   * Einmalige Fähigkeitsprüfung, kein Signal – die Ausstattung des Geräts
   * ändert sich zur Laufzeit nicht. Im Template deshalb ohne Klammern.
   */
  protected readonly kannScannen = scannenMoeglich();
  protected readonly scanntGerade = signal(false);
  protected readonly meldung = signal<Meldung | null>(null);
  protected readonly eingefuegt = signal('');
  protected readonly zeigeCodeText = signal(false);

  /** viewBox des QR-Bildes, passend zur Modulanzahl. */
  protected readonly viewBox = computed(() => {
    const bild = this.qr();
    return bild ? `0 0 ${bild.groesse} ${bild.groesse}` : '0 0 1 1';
  });

  private scanner: Kamerascanner | null = null;

  ngOnDestroy(): void {
    this.scannenBeenden();
  }

  protected async scannenStarten(): Promise<void> {
    this.meldung.set(null);
    this.scanntGerade.set(true);

    // Das Video-Element entsteht erst durch das Signal oben, deshalb einen
    // Durchlauf warten, bevor darauf zugegriffen wird.
    await new Promise((fertig) => setTimeout(fertig, 0));

    const video = this.videoRef()?.nativeElement;
    if (!video) {
      this.scanntGerade.set(false);
      return;
    }

    this.scanner = new Kamerascanner(video);
    try {
      await this.scanner.starten((wert) => this.trefferVerarbeiten(wert));
    } catch (fehler) {
      this.scannenBeenden();
      this.meldung.set({
        art: 'fehler',
        text:
          fehler instanceof KamerascannerFehler
            ? fehler.message
            : 'Die Kamera konnte nicht gestartet werden.',
      });
    }
  }

  protected scannenBeenden(): void {
    this.scanner?.beenden();
    this.scanner = null;
    this.scanntGerade.set(false);
  }

  private trefferVerarbeiten(wert: string): void {
    this.scannenBeenden();
    this.uebernehmen(wert);
  }

  protected ausFeldUebernehmen(): void {
    const text = this.eingefuegt().trim();
    if (!text) return;
    this.uebernehmen(text);
    this.eingefuegt.set('');
  }

  private uebernehmen(code: string): void {
    try {
      const neue = this.abgleich.uebernehmen(code);
      this.meldung.set(
        neue
          ? {
              art: 'erfolg',
              text:
                neue === 1
                  ? '1 neues Zeichen übernommen. Zeig jetzt deinen Code, damit ihr beide denselben Stand habt.'
                  : `${neue} neue Zeichen übernommen. Zeig jetzt deinen Code, damit ihr beide denselben Stand habt.`,
            }
          : { art: 'hinweis', text: 'Nichts Neues dabei – ihr habt denselben Stand.' },
      );
    } catch (fehler) {
      this.meldung.set({
        art: 'fehler',
        text:
          fehler instanceof SammelcodeFehler ? fehler.message : 'Der Code ließ sich nicht lesen.',
      });
    }
  }

  protected async kopieren(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.meldung.set({ art: 'hinweis', text: 'Code kopiert.' });
    } catch {
      // Ohne Zwischenablage bleibt der sichtbare Text zum Abtippen.
      this.zeigeCodeText.set(true);
      this.meldung.set({
        art: 'hinweis',
        text: 'Kopieren ging nicht – hier ist der Code zum Weitergeben.',
      });
    }
  }

  protected codeTextUmschalten(): void {
    this.zeigeCodeText.update((a) => !a);
  }
}
