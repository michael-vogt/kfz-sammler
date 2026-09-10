import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

export interface Kreis {
  /** Amtlicher Kreisschlüssel (AGS). */
  id: string;
  name: string;
  land: string;
  /** Unterscheidungszeichen dieses Kreises, kurze zuerst. */
  zeichen: string[];
  /** Fertig projizierter SVG-Pfad. */
  d: string;
}

interface Kreisdaten {
  breite: number;
  hoehe: number;
  kreise: Kreis[];
}

@Injectable({ providedIn: 'root' })
export class KarteService {
  private readonly http = inject(HttpClient);

  private readonly daten = signal<Kreisdaten | null>(null);
  private readonly ladefehler = signal<string | null>(null);
  private angefordert = false;

  readonly kreise = computed<Kreis[]>(() => this.daten()?.kreise ?? []);
  readonly bereit = computed(() => this.daten() !== null);
  readonly fehler = this.ladefehler.asReadonly();

  readonly viewBox = computed(() => {
    const d = this.daten();
    return d ? `0 0 ${d.breite} ${d.hoehe}` : '0 0 1000 1354';
  });

  /** Lädt die Geometrie beim ersten Aufruf; weitere Aufrufe sind wirkungslos. */
  laden(): void {
    if (this.angefordert) return;
    this.angefordert = true;

    this.http.get<Kreisdaten>('data/kreise.json').subscribe({
      next: (daten) => this.daten.set(daten),
      error: () => this.ladefehler.set('Die Kartendaten konnten nicht geladen werden.'),
    });
  }
}
