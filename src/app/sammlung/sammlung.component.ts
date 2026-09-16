import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { KennzeichenService } from '../kennzeichen/kennzeichen.service';
import { SammlungService } from './sammlung.service';
import { NavigationService } from '../navigation.service';

interface Fortschritt {
  gesammelt: number;
  gesamt: number;
  fehlend: string[];
}

interface LandFortschritt {
  land: string;
  gesammelt: number;
  gesamt: number;
  /** Fehlende Zeichen dieses Bundeslands, alphabetisch. */
  fehlend: string[];
}

@Component({
  selector: 'app-sammlung',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule],
  templateUrl: './sammlung.component.html',
  styleUrl: './sammlung.component.scss',
})
export class SammlungComponent {
  private readonly kennzeichen = inject(KennzeichenService);
  protected readonly sammlung = inject(SammlungService);
  private readonly navigation = inject(NavigationService);

  protected readonly meldung = signal<string | null>(null);
  protected readonly bearbeiteteNotiz = signal<string | null>(null);
  protected readonly notizEntwurf = signal('');
  protected readonly ausgeklappt = signal<string | null>(null);

  protected readonly anzahl = this.sammlung.anzahl;
  protected readonly geladen = this.sammlung.geladen;

  protected readonly gesamt = computed(
    () => new Set(this.kennzeichen.alleKennzeichen().map((k) => k.z)).size,
  );

  /**
   * Auslaufende Zeichen werden getrennt geführt: ihnen fehlt das Bundesland,
   * und sie sollen den Stand bei den aktuellen Zeichen nicht verwässern.
   */
  protected readonly auslaufend = computed<Fortschritt>(() => {
    const gesehen = this.sammlung.gesammelteZeichen();
    const zeichen = [...new Set(this.kennzeichen.alleAuslaufend().map((k) => k.z))];
    return {
      gesamt: zeichen.length,
      gesammelt: zeichen.filter((z) => gesehen.has(z)).length,
      fehlend: zeichen.filter((z) => !gesehen.has(z)).sort((a, b) => a.localeCompare(b, 'de')),
    };
  });

  /** Nur die aktuell vergebenen Zeichen – Grundlage des Hauptfortschritts. */
  protected readonly aktuellGesammelt = computed(() => {
    const gesehen = this.sammlung.gesammelteZeichen();
    return new Set(
      this.kennzeichen.alleKennzeichen().map((k) => k.z).filter((z) => gesehen.has(z)),
    ).size;
  });

  protected readonly prozent = computed(() => {
    const g = this.gesamt();
    return g ? Math.round((this.aktuellGesammelt() / g) * 1000) / 10 : 0;
  });

  /** Fortschritt je Bundesland, absteigend nach Vollständigkeit. */
  protected readonly proBundesland = computed<LandFortschritt[]>(() => {
    const gesehen = this.sammlung.gesammelteZeichen();
    const gruppen = new Map<string, string[]>();

    for (const k of this.kennzeichen.alleKennzeichen()) {
      const liste = gruppen.get(k.land) ?? [];
      if (!liste.includes(k.z)) liste.push(k.z);
      gruppen.set(k.land, liste);
    }

    return [...gruppen.entries()]
      .map(([land, zeichen]) => ({
        land,
        gesamt: zeichen.length,
        gesammelt: zeichen.filter((z) => gesehen.has(z)).length,
        fehlend: zeichen.filter((z) => !gesehen.has(z)).sort((a, b) => a.localeCompare(b, 'de')),
      }))
      .sort((a, b) => b.gesammelt / b.gesamt - a.gesammelt / a.gesamt || a.land.localeCompare(b.land, 'de'));
  });

  /** Sichtungen angereichert um den aktuellen Ortsnamen aus den Stammdaten. */
  protected readonly eintraege = computed(() => {
    const orte = new Map(this.kennzeichen.alleKennzeichen().map((k) => [k.z, k.ort]));
    const frueher = new Map(this.kennzeichen.alleAuslaufend().map((k) => [k.z, k.bisher]));
    return this.sammlung.alle().map((s) => ({
      ...s,
      ort: orte.get(s.z) ?? frueher.get(s.z) ?? s.ort,
      // Zeichen, die es nur noch historisch gibt, werden in der Liste markiert.
      nurAuslaufend: !orte.has(s.z) && frueher.has(s.z),
    }));
  });

  /** Wechselt zur Suche und zeigt dort das gewählte Zeichen. */
  protected zeigeKennzeichen(z: string): void {
    this.navigation.zeigeKennzeichen(z);
  }

  protected landAusklappen(land: string): void {
    this.ausgeklappt.update((aktuell) => (aktuell === land ? null : land));
  }

  protected notizBearbeiten(z: string, aktuell: string | null): void {
    this.bearbeiteteNotiz.set(z);
    this.notizEntwurf.set(aktuell ?? '');
  }

  protected notizSpeichern(z: string): void {
    this.sammlung.notizSetzen(z, this.notizEntwurf());
    this.bearbeiteteNotiz.set(null);
  }

  protected entfernen(z: string): void {
    this.sammlung.entfernen(z);
  }

  protected alleLoeschen(): void {
    if (confirm(`Wirklich alle ${this.anzahl()} gesammelten Zeichen löschen?`)) {
      this.sammlung.leeren();
      this.meldung.set('Sammlung geleert.');
    }
  }

  protected async exportieren(): Promise<void> {
    this.meldung.set(null);
    try {
      const erfolgreich = await this.sammlung.exportieren();
      if (erfolgreich) this.meldung.set('Sammlung exportiert.');
    } catch {
      this.meldung.set('Der Export ist fehlgeschlagen.');
    }
  }

  protected async importieren(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const datei = input.files?.[0];
    if (!datei) return;
    try {
      const neue = await this.sammlung.importieren(datei);
      this.meldung.set(
        neue ? `${neue} neue Zeichen importiert.` : 'Keine neuen Zeichen in der Datei.',
      );
    } catch {
      this.meldung.set('Die Datei konnte nicht gelesen werden.');
    } finally {
      input.value = '';
    }
  }
}
