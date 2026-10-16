import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { KennzeichenService } from '../kennzeichen/kennzeichen.service';
import { SammlungService } from '../sammlung/sammlung.service';
import { folgebuchstaben } from './tastenfeld';

/** Was beim letzten Eintragen passiert ist – Grundlage für die Rückmeldung. */
interface Rueckmeldung {
  z: string;
  ort: string;
  art: 'neu' | 'bekannt';
}

/** Das Buchstabenfeld. Umlaute hinten, damit die Reihen gleich lang bleiben. */
const TASTEN = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ'];

@Component({
  selector: 'app-beifahrer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './beifahrer.component.html',
  styleUrl: './beifahrer.component.scss',
})
export class BeifahrerComponent {
  private readonly kennzeichen = inject(KennzeichenService);
  private readonly sammlung = inject(SammlungService);

  protected readonly tasten = TASTEN;
  protected readonly eingabe = signal('');
  protected readonly rueckmeldung = signal<Rueckmeldung | null>(null);

  /** In dieser Sitzung neu eingetragene Zeichen – für Zähler und Rückgängig. */
  protected readonly sitzung = signal<string[]>([]);

  protected readonly geladen = this.sammlung.geladen;
  protected readonly bereit = this.kennzeichen.bereit;

  /** Zeichen -> Ortsname, über aktuelle und auslaufende Daten hinweg. */
  private readonly orte = computed(() => {
    const karte = new Map<string, string>();
    for (const k of this.kennzeichen.alleAuslaufend()) karte.set(k.z, k.bisher);
    // Aktuelle Daten gewinnen bei den fünf Zeichen, die in beiden Listen stehen.
    for (const k of this.kennzeichen.alleKennzeichen()) karte.set(k.z, k.ort);
    return karte;
  });

  /** Für jedes Präfix die Buchstaben, mit denen ein gültiges Zeichen weitergeht. */
  private readonly folgen = computed(() => folgebuchstaben(this.orte().keys()));

  protected readonly moeglich = computed(
    () => this.folgen().get(this.eingabe()) ?? new Set<string>(),
  );

  protected readonly istGueltig = computed(() => this.orte().has(this.eingabe()));

  protected readonly ort = computed(() => this.orte().get(this.eingabe()) ?? '');

  protected readonly schonGesammelt = computed(
    () => this.istGueltig() && this.sammlung.hatGesehen(this.eingabe()),
  );

  protected readonly neueInSitzung = computed(() => this.sitzung().length);

  protected tippe(buchstabe: string): void {
    if (!this.moeglich().has(buchstabe)) return;
    this.rueckmeldung.set(null);
    this.eingabe.update((alt) => alt + buchstabe);
  }

  protected zurueck(): void {
    this.rueckmeldung.set(null);
    this.eingabe.update((alt) => alt.slice(0, -1));
  }

  protected eintragen(): void {
    const z = this.eingabe();
    if (!this.orte().has(z)) return;

    const vorhanden = this.sammlung.hatGesehen(z);
    if (!vorhanden) {
      this.sammlung.umschalten(z, this.orte().get(z) ?? null);
      this.sitzung.update((alt) => [...alt, z]);
    }

    this.rueckmeldung.set({
      z,
      ort: this.orte().get(z) ?? '',
      art: vorhanden ? 'bekannt' : 'neu',
    });
    this.eingabe.set('');
    this.spuerbar(vorhanden ? 30 : [20, 60, 20]);
  }

  /** Macht den letzten Eintrag dieser Sitzung rückgängig – gegen Verlesen. */
  protected rueckgaengig(): void {
    const letztes = this.sitzung().at(-1);
    if (!letztes) return;

    this.sammlung.entfernen(letztes);
    this.sitzung.update((alt) => alt.slice(0, -1));
    this.rueckmeldung.set(null);
    this.eingabe.set('');
    this.spuerbar(30);
  }

  /**
   * Kurze Vibration als Bestätigung, damit der Blick auf der Straße bleiben kann.
   * Nicht überall verfügbar – Fehler sind hier bedeutungslos.
   */
  private spuerbar(muster: number | number[]): void {
    try {
      navigator.vibrate?.(muster);
    } catch {
      /* ignorieren */
    }
  }
}
