import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';

import { LocalStorageSpeicher, Speicher, speicherErzeugen } from './speicher';
import { Ausgabe, ausgabeErzeugen } from './ausgabe';

/** Eine einzelne Sichtung eines Unterscheidungszeichens. */
export interface Sichtung {
  z: string;
  /** ISO-Zeitstempel der ersten Sichtung. */
  gesehenAm: string;
  /** Ort zum Zeitpunkt der Sichtung – rein informativ, falls sich die Daten ändern. */
  ort: string | null;
  notiz: string | null;
}

const SPEICHER_SCHLUESSEL = 'kfz-sammlung.v1';

/** Überschreibbar in Tests: `{ provide: SPEICHER, useValue: Promise.resolve(fake) }`. */
export const SPEICHER = new InjectionToken<Promise<Speicher>>('Speicher', {
  providedIn: 'root',
  factory: () => speicherErzeugen(),
});

/** Überschreibbar in Tests, analog zu SPEICHER. */
export const AUSGABE = new InjectionToken<Promise<Ausgabe>>('Ausgabe', {
  providedIn: 'root',
  factory: () => ausgabeErzeugen(),
});

/** Filtert offensichtlich kaputte Einträge heraus. */
function bereinigen(daten: unknown): Record<string, Sichtung> {
  if (!daten || typeof daten !== 'object') return {};
  return Object.fromEntries(
    Object.entries(daten as Record<string, Sichtung>).filter(
      ([z, s]) => typeof z === 'string' && typeof s?.gesehenAm === 'string',
    ),
  );
}

@Injectable({ providedIn: 'root' })
export class SammlungService {
  private readonly speicherPromise = inject(SPEICHER);
  private readonly ausgabePromise = inject(AUSGABE);

  private readonly sichtungen = signal<Record<string, Sichtung>>({});
  private readonly istGeladen = signal(false);

  /** false, solange der Speicher noch gelesen wird – die Oberfläche zeigt solange nichts an. */
  readonly geladen = this.istGeladen.asReadonly();

  readonly anzahl = computed(() => Object.keys(this.sichtungen()).length);

  /** Alle Sichtungen, neueste zuerst. */
  readonly alle = computed(() =>
    Object.values(this.sichtungen()).sort((a, b) => b.gesehenAm.localeCompare(a.gesehenAm)),
  );

  /** Set der gesammelten Zeichen – für schnelle Abfragen in Templates. */
  readonly gesammelteZeichen = computed(() => new Set(Object.keys(this.sichtungen())));

  /** Serialisiert die Schreibvorgänge, damit sie sich nicht gegenseitig überholen. */
  private schreibkette: Promise<unknown> = Promise.resolve();

  constructor() {
    void this.initialisieren();
  }

  private async initialisieren(): Promise<void> {
    try {
      const speicher = await this.speicherPromise;
      let roh = await speicher.lesen(SPEICHER_SCHLUESSEL);

      // Erststart der nativen App: eine im WebView-localStorage liegende Sammlung übernehmen.
      if (roh === null && !(speicher instanceof LocalStorageSpeicher)) {
        roh = await new LocalStorageSpeicher().lesen(SPEICHER_SCHLUESSEL);
        if (roh !== null) await speicher.schreiben(SPEICHER_SCHLUESSEL, roh);
      }

      this.sichtungen.set(roh ? bereinigen(JSON.parse(roh)) : {});
    } catch {
      // Unlesbarer Speicher darf die App nicht blockieren – lieber leer starten.
      this.sichtungen.set({});
    } finally {
      this.istGeladen.set(true);
    }
  }

  /** Schreibt den aktuellen Stand. Fehler werden geschluckt, der Zustand bleibt im Speicher. */
  private persistieren(): void {
    const stand = JSON.stringify(this.sichtungen());
    this.schreibkette = this.schreibkette
      .then(() => this.speicherPromise)
      .then((speicher) => speicher.schreiben(SPEICHER_SCHLUESSEL, stand))
      .catch(() => undefined);
  }

  /** Wartet, bis alle ausstehenden Schreibvorgänge durch sind – vor allem für Tests. */
  async gespeichert(): Promise<void> {
    await this.schreibkette;
  }

  hatGesehen(z: string): boolean {
    return z in this.sichtungen();
  }

  sichtung(z: string): Sichtung | null {
    return this.sichtungen()[z] ?? null;
  }

  /** Markiert ein Zeichen als gesehen bzw. entfernt es wieder. Gibt den neuen Zustand zurück. */
  umschalten(z: string, ort: string | null = null): boolean {
    const vorhanden = this.hatGesehen(z);
    this.sichtungen.update((alt) => {
      const neu = { ...alt };
      if (vorhanden) {
        delete neu[z];
      } else {
        neu[z] = { z, ort, notiz: null, gesehenAm: new Date().toISOString() };
      }
      return neu;
    });
    this.persistieren();
    return !vorhanden;
  }

  notizSetzen(z: string, notiz: string): void {
    this.sichtungen.update((alt) =>
      alt[z] ? { ...alt, [z]: { ...alt[z], notiz: notiz.trim() || null } } : alt,
    );
    this.persistieren();
  }

  entfernen(z: string): void {
    this.sichtungen.update((alt) => {
      const neu = { ...alt };
      delete neu[z];
      return neu;
    });
    this.persistieren();
  }

  leeren(): void {
    this.sichtungen.set({});
    this.persistieren();
  }

  /**
   * Gibt die Sammlung als JSON-Datei aus - im Browser als Download,
   * unter Android über das Teilen-Menü.
   * Gibt false zurück, wenn der Nutzer abgebrochen hat.
   */
  async exportieren(): Promise<boolean> {
    const ausgabe = await this.ausgabePromise;
    const dateiname = `kfz-sammlung-${new Date().toISOString().slice(0, 10)}.json`;
    return ausgabe.bereitstellen(
      dateiname,
      JSON.stringify(this.alle(), null, 2),
      'KFZ-Sammlung',
    );
  }

  /**
   * Importiert eine zuvor exportierte Sammlung. Bestehende Einträge bleiben erhalten;
   * bei Dubletten gewinnt die ältere Sichtung.
   * Gibt die Anzahl neu hinzugefügter Zeichen zurück.
   */
  async importieren(datei: File): Promise<number> {
    const daten = JSON.parse(await datei.text());
    if (!Array.isArray(daten)) throw new Error('Unerwartetes Dateiformat.');

    let neue = 0;
    this.sichtungen.update((alt) => {
      const neuerStand = { ...alt };
      for (const eintrag of daten as Sichtung[]) {
        if (typeof eintrag?.z !== 'string' || typeof eintrag?.gesehenAm !== 'string') continue;
        const bestehend = neuerStand[eintrag.z];
        if (!bestehend) neue++;
        if (!bestehend || eintrag.gesehenAm < bestehend.gesehenAm) {
          neuerStand[eintrag.z] = {
            z: eintrag.z,
            gesehenAm: eintrag.gesehenAm,
            ort: eintrag.ort ?? null,
            notiz: eintrag.notiz ?? null,
          };
        }
      }
      return neuerStand;
    });
    this.persistieren();
    await this.gespeichert();
    return neue;
  }
}
