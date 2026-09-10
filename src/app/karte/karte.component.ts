import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import { NavigationService } from '../navigation.service';
import { SammlungService } from '../sammlung/sammlung.service';
import { Kreis, KarteService } from './karte.service';

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

  protected readonly bereit = this.karte.bereit;
  protected readonly fehler = this.karte.fehler;
  protected readonly viewBox = this.karte.viewBox;

  protected readonly ausgewaehlt = signal<string | null>(null);

  ngOnInit(): void {
    this.karte.laden();
  }

  /** Kreise mit ihrem Sammelstand; wird bei jeder Änderung der Sammlung neu berechnet. */
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
    return id ? (this.kreise().find((k) => k.id === id) ?? null) : null;
  });

  /** Vier Stufen statt eines Farbverlaufs – auf kleinen Flächen besser unterscheidbar. */
  protected stufe(k: KreisAnsicht): string {
    if (!k.zeichen.length) return 'ohne';
    if (k.anteil === 0) return 'leer';
    if (k.anteil < 1) return 'teilweise';
    return 'voll';
  }

  protected auswaehlen(id: string): void {
    this.ausgewaehlt.update((aktuell) => (aktuell === id ? null : id));
  }

  protected zeigeKennzeichen(z: string): void {
    this.navigation.zeigeKennzeichen(z);
  }
}
