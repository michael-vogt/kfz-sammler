import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormsModule } from '@angular/forms';

import { KennzeichenSchildComponent } from '../kennzeichen-schild/kennzeichen-schild.component';
import { KennzeichenService } from '../kennzeichen.service';
import { herleitungSegmente } from '../kennzeichen.parser';
import { SammlungService } from '../../sammlung/sammlung.service';
import { NavigationService } from '../../navigation.service';

@Component({
  selector: 'app-kennzeichen-suche',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, KennzeichenSchildComponent],
  templateUrl: './kennzeichen-suche.component.html',
  styleUrl: './kennzeichen-suche.component.scss',
})
export class KennzeichenSucheComponent {
  private readonly service = inject(KennzeichenService);
  protected readonly sammlung = inject(SammlungService);
  private readonly navigation = inject(NavigationService);

  constructor() {
    effect(() => {
      const auswahl = this.navigation.vorauswahl();
      if (!auswahl) return;
      this.eingabe.set(auswahl.z);
      this.navigation.vorauswahlVerbraucht();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  protected readonly eingabe = signal('');
  protected readonly bereit = this.service.bereit;
  protected readonly ladefehler = this.service.fehler;

  /** Analyse wird bei jeder Eingabeänderung neu berechnet. */
  protected readonly analyse = computed(() => {
    const text = this.eingabe();
    return text.trim() ? this.service.analysiere(text) : null;
  });

  /** Vorschläge nur anzeigen, solange noch kein Treffer feststeht. */
  protected readonly vorschlaege = computed(() => {
    const a = this.analyse();
    if (!a || a.aktuell.length || a.sonder.length) return [];
    return this.service.vorschlaege(a.normalisiert.replace(/[^A-ZÄÖÜ].*$/, ''));
  });

  protected readonly beispiele = ['MS-AB 123', 'B-MW 4711E', 'HH 1234 H', 'GAP-XY 42', 'THW-91234'];

  protected readonly segmente = herleitungSegmente;

  protected setzeEingabe(wert: string): void {
    this.eingabe.set(wert);
  }

  /** Merkt ein gesehenes Zeichen vor bzw. entfernt es wieder aus der Sammlung. */
  protected gesehenUmschalten(z: string, ort: string): void {
    this.sammlung.umschalten(z, ort);
  }

  protected leeren(): void {
    this.eingabe.set('');
  }

  /** Sichtbarer Nummernteil für die Schild-Darstellung. */
  protected nummerText(): string {
    const e = this.analyse()?.erkennungsnummer;
    if (!e) return '';
    return [e.buchstaben, e.ziffern + (e.suffix ?? '')].filter(Boolean).join(' ');
  }
}
