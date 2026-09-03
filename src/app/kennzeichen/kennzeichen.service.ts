import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import {
  AuslaufendesKennzeichen,
  Fussnoten,
  Kennzeichen,
  Sonderkennzeichen,
} from './kennzeichen.model';
import { Datenbestand, analysiere } from './kennzeichen.parser';

const BASIS = 'data';

@Injectable({ providedIn: 'root' })
export class KennzeichenService {
  private readonly http = inject(HttpClient);

  private readonly daten = signal<Datenbestand | null>(null);
  private readonly ladefehler = signal<string | null>(null);

  /** true, sobald alle vier Datendateien geladen sind. */
  readonly bereit = computed(() => this.daten() !== null);
  readonly fehler = this.ladefehler.asReadonly();

  /** Alle aktuellen Zeichen, alphabetisch – für Autovervollständigung und Übersicht. */
  readonly alleZeichen = computed(
    () =>
      this.daten()
        ?.aktuell.map((k) => k.z)
        .sort((a, b) => a.localeCompare(b, 'de')) ?? [],
  );

  /** Vollständige Datensätze – Basis für die Sammlungsstatistik. */
  readonly alleKennzeichen = computed<Kennzeichen[]>(() => this.daten()?.aktuell ?? []);

  constructor() {
    this.laden();
  }

  private laden(): void {
    forkJoin({
      aktuell: this.http.get<Kennzeichen[]>(`${BASIS}/kennzeichen.json`),
      auslaufend: this.http.get<AuslaufendesKennzeichen[]>(`${BASIS}/auslaufend.json`),
      sonder: this.http.get<Sonderkennzeichen[]>(`${BASIS}/sonderkennzeichen.json`),
      fussnoten: this.http.get<Fussnoten>(`${BASIS}/fussnoten.json`),
    }).subscribe({
      next: (bestand) => this.daten.set(bestand),
      error: () =>
        this.ladefehler.set(
          'Die Kennzeichendaten konnten nicht geladen werden. Liegen die JSON-Dateien unter public/data/?',
        ),
    });
  }

  /** Analysiert eine Eingabe. Gibt null zurück, solange die Daten noch laden. */
  analysiere(eingabe: string) {
    const bestand = this.daten();
    return bestand ? analysiere(eingabe, bestand) : null;
  }

  /** Vorschläge für die Autovervollständigung. */
  vorschlaege(praefix: string, limit = 8): Kennzeichen[] {
    const bestand = this.daten();
    const p = praefix.toUpperCase().trim();
    if (!bestand || p.length < 1) return [];
    return bestand.aktuell.filter((k) => k.z.startsWith(p)).slice(0, limit);
  }
}
