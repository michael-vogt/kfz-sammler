import { Injectable, signal } from '@angular/core';

export type Ansicht = 'suche' | 'sammlung' | 'karte';

/**
 * Verbindet Suche und Sammlung: welche Ansicht sichtbar ist und welches
 * Unterscheidungszeichen die Suche beim Wechsel übernehmen soll.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  readonly ansicht = signal<Ansicht>('suche');

  /**
   * Von der Sammlung gesetzt, von der Suche gelesen und danach zurückgesetzt.
   * Der Zeitstempel sorgt dafür, dass auch zweimal dasselbe Zeichen eine Änderung auslöst.
   */
  readonly vorauswahl = signal<{ z: string; stand: number } | null>(null);

  /** Wechselt zur Suche und zeigt dort das übergebene Zeichen an. */
  zeigeKennzeichen(z: string): void {
    this.vorauswahl.set({ z, stand: Date.now() });
    this.ansicht.set('suche');
  }

  vorauswahlVerbraucht(): void {
    this.vorauswahl.set(null);
  }
}
