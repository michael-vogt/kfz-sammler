import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { NavigationService } from '../navigation.service';
import { SammlungService } from '../sammlung/sammlung.service';
import { Kreis, KarteService } from './karte.service';
import { Kartenblick } from './kartenblick';

/** Ein Kreis mit dem für die Einfärbung nötigen Sammelstand. */
interface KreisAnsicht extends Kreis {
  gesammelt: number;
  /** 0 = nichts, 1 = alle Zeichen dieses Kreises gesammelt. */
  anteil: number;
}

@Component({
  selector: 'app-karte',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './karte.component.html',
  styleUrl: './karte.component.scss',
})
export class KarteComponent implements OnInit {
  private readonly karte = inject(KarteService);
  private readonly navigation = inject(NavigationService);
  protected readonly sammlung = inject(SammlungService);

  private readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('svg');

  protected readonly bereit = this.karte.bereit;
  protected readonly fehler = this.karte.fehler;
  protected readonly viewBox = this.karte.viewBox;

  protected readonly ausgewaehlt = signal<string | null>(null);

  // --- Zoom und Verschieben -------------------------------------------
  private blick = new Kartenblick(1000, 1354);
  /** Signal, das bei jeder Zustandsänderung des Blicks neu gesetzt wird. */
  protected readonly transform = signal('translate(0 0) scale(1)');
  protected readonly vergroessert = signal(false);

  /** Aktive Zeiger, damit Wischen und Zwei-Finger-Zoom unterscheidbar sind. */
  private readonly zeiger = new Map<number, { x: number; y: number }>();
  private letzterAbstand = 0;
  private bewegung = 0;

  constructor() {
    // Masse der Karte übernehmen, sobald die Geometrie geladen ist.
    effect(() => {
      const box = this.viewBox().split(' ').map(Number);
      if (box.length === 4) this.blick = new Kartenblick(box[2], box[3]);
      this.uebernehmen();
    });
  }

  ngOnInit(): void {
    this.karte.laden();
  }

  private uebernehmen(): void {
    this.transform.set(this.blick.transform);
    this.vergroessert.set(this.blick.istVergroessert);
  }

  /** Rechnet Bildschirmpixel in Nutzereinheiten der viewBox um. */
  private proPixel(): number {
    const element = this.svgRef()?.nativeElement;
    const breite = element?.getBoundingClientRect().width ?? 0;
    const box = this.viewBox().split(' ').map(Number);
    return breite > 0 ? box[2] / breite : 1;
  }

  /** Zeigerposition in Nutzereinheiten, relativ zur Grundkarte. */
  private inKarte(ereignis: PointerEvent | WheelEvent): { x: number; y: number } {
    const rechteck = this.svgRef()?.nativeElement.getBoundingClientRect();
    const faktor = this.proPixel();
    return {
      x: ((ereignis.clientX - (rechteck?.left ?? 0)) * faktor),
      y: ((ereignis.clientY - (rechteck?.top ?? 0)) * faktor),
    };
  }

  protected beiZeigerStart(ereignis: PointerEvent): void {
    (ereignis.target as Element).setPointerCapture?.(ereignis.pointerId);
    this.zeiger.set(ereignis.pointerId, { x: ereignis.clientX, y: ereignis.clientY });
    this.bewegung = 0;
    this.letzterAbstand = 0;
  }

  protected beiZeigerBewegung(ereignis: PointerEvent): void {
    const vorher = this.zeiger.get(ereignis.pointerId);
    if (!vorher) return;

    const jetzt = { x: ereignis.clientX, y: ereignis.clientY };
    this.zeiger.set(ereignis.pointerId, jetzt);
    this.bewegung += Math.hypot(jetzt.x - vorher.x, jetzt.y - vorher.y);

    const punkte = [...this.zeiger.values()];
    const faktor = this.proPixel();

    if (punkte.length === 1) {
      this.blick.verschiebe((jetzt.x - vorher.x) * faktor, (jetzt.y - vorher.y) * faktor);
    } else if (punkte.length >= 2) {
      const [a, b] = punkte;
      const abstand = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.letzterAbstand > 0 && abstand > 0) {
        const rechteck = this.svgRef()?.nativeElement.getBoundingClientRect();
        const mitteX = ((a.x + b.x) / 2 - (rechteck?.left ?? 0)) * faktor;
        const mitteY = ((a.y + b.y) / 2 - (rechteck?.top ?? 0)) * faktor;
        this.blick.zoomeAuf(abstand / this.letzterAbstand, mitteX, mitteY);
      }
      this.letzterAbstand = abstand;
    }

    this.uebernehmen();
  }

  protected beiZeigerEnde(ereignis: PointerEvent): void {
    this.zeiger.delete(ereignis.pointerId);
    if (this.zeiger.size < 2) this.letzterAbstand = 0;
  }

  protected beiRad(ereignis: WheelEvent): void {
    ereignis.preventDefault();
    const punkt = this.inKarte(ereignis);
    this.blick.zoomeAuf(ereignis.deltaY < 0 ? 1.15 : 1 / 1.15, punkt.x, punkt.y);
    this.uebernehmen();
  }

  protected zoomStufe(faktor: number): void {
    const box = this.viewBox().split(' ').map(Number);
    this.blick.zoomeAuf(faktor, box[2] / 2, box[3] / 2);
    this.uebernehmen();
  }

  protected zuruecksetzen(): void {
    this.blick.zuruecksetzen();
    this.uebernehmen();
  }

  // --- Daten ------------------------------------------------------------
  protected readonly kreise = computed<KreisAnsicht[]>(() => {
    const gesehen = this.sammlung.gesammelteZeichen();
    return this.karte.kreise().map((k) => {
      const gesammelt = k.zeichen.filter((z) => gesehen.has(z)).length;
      return {
        ...k,
        gesammelt,
        anteil: k.zeichen.length ? gesammelt / k.zeichen.length : 0,
      };
    });
  });

  protected readonly vollstaendig = computed(
    () => this.kreise().filter((k) => k.zeichen.length > 0 && k.anteil === 1).length,
  );

  protected readonly angefangen = computed(
    () => this.kreise().filter((k) => k.anteil > 0 && k.anteil < 1).length,
  );

  protected readonly gesamtKreise = computed(
    () => this.kreise().filter((k) => k.zeichen.length > 0).length,
  );

  protected readonly detail = computed<KreisAnsicht | null>(() => {
    const id = this.ausgewaehlt();
    return id ? this.kreise().find((k) => k.id === id) ?? null : null;
  });

  /** Vier Stufen statt eines Farbverlaufs – auf kleinen Flächen besser unterscheidbar. */
  protected stufe(k: KreisAnsicht): string {
    if (!k.zeichen.length) return 'ohne';
    if (k.anteil === 0) return 'leer';
    if (k.anteil < 1) return 'teilweise';
    return 'voll';
  }

  protected auswaehlen(id: string): void {
    // Nach einer Wischgeste soll kein Kreis ausgewählt werden.
    if (this.bewegung > Kartenblick.TIPP_SCHWELLE) return;
    this.ausgewaehlt.update((aktuell) => (aktuell === id ? null : id));
  }

  protected zeigeKennzeichen(z: string): void {
    this.navigation.zeigeKennzeichen(z);
  }
}
